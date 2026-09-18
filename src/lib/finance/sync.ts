import { useFinance } from "./store";
import { loadFinanceFromDb, saveFinanceToDb, clearFinanceDb } from "./db-api";
import type {
  BankAccount,
  BankTransfer,
  Driver,
  Expense,
  FinanceSnapshot,
  Loan,
  Payout,
} from "./types";

const WSB_LOAN_015: Loan = {
  id: "loan_wsb_000015",
  name: "WSB Mini — A/c …000015",
  bank: "Warana Sahakari Bank (HDFC0CSWSBL)",
  accountNo: "3970254350000015",
  ifsc: "HDFC0CSWSBL",
  principal: 398000,
  emiAmount: 8359,
  emiDay: 9,
  totalEmis: 60,
  startDate: "2026-09-09",
  endDate: "2031-09-09",
  interestRate: 9.5,
  outstanding: 398000,
  pendingEmis: 59,
  status: "active",
  fleetId: null,
  note: "SATELKARS LOGISTIC · Customer ID 554827 · Disburse 09/09/2026 · 398000 · EMI starts 09/10/2026 · 9.50%",
};

const WSB_CC_BANK: BankAccount = {
  id: "bank_wsb_cc_000001",
  name: "Warana CC · …000001",
  isDefault: false,
  opening: 0,
};

const WSB_CURRENT_BANK: BankAccount = {
  id: "bank_wsb_current_0498",
  name: "Warana Current · …0498",
  isDefault: false,
  opening: 11390,
};

const STMT_DRIVERS: { id: string; name: string }[] = [
  { id: "drv_anand", name: "Anand" },
  { id: "drv_vikas", name: "Vikas" },
  { id: "drv_sandeep", name: "Sandeep" },
  { id: "drv_vivek", name: "Vivek" },
  { id: "drv_ballu", name: "Ballu" },
  { id: "drv_karan", name: "Karan" },
  { id: "drv_devraj", name: "Devraj" },
];

function ensureDriverByName(name: string, preferredId: string): string {
  const s = useFinance.getState();
  const existing = s.drivers.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const row: Driver = {
    id: preferredId,
    name,
    mobile: "",
    kind: "full",
    baseSalary: 0,
    dailyRate: 0,
    openingBalance: 0,
    active: true,
    upiVpa: "",
    upiPayeeName: name,
    upiUpdatedAt: null,
    fleetId: null,
    note: "From Warana statement import",
  };
  s.upsertDriver(row);
  return preferredId;
}

function resolveCurrentBankId(): string {
  const s = useFinance.getState();
  const found =
    s.banks.find(
      (b) =>
        b.id === WSB_CURRENT_BANK.id ||
        (/warana|warna/i.test(b.name) && /current|0498/i.test(b.name)),
    )?.id ||
    s.banks.find((b) => /warana|warna/i.test(b.name) && !/cc/i.test(b.name))?.id;
  if (found) return found;
  s.upsertBank(WSB_CURRENT_BANK);
  return WSB_CURRENT_BANK.id;
}

function resolveBajajBankId(): string {
  const s = useFinance.getState();
  const found = s.banks.find((b) => /bajaj/i.test(b.name))?.id;
  if (found) return found;
  const id = "bank_bajaj_auto";
  s.upsertBank({ id, name: "Bajaj", isDefault: false, opening: 0 });
  return id;
}

const STMT_DELETED_KEY = "finance_wsb_stmt_deleted_v1";

function readDeletedSeedIds(): Set<string> {
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(STMT_DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function rememberDeletedSeedId(id: string) {
  if (!id) return;
  if (
    !id.startsWith("po_stmt_") &&
    !id.startsWith("exp_stmt_") &&
    !id.startsWith("xfer_") &&
    !id.startsWith("lp_stmt_") &&
    id !== "exp_cc_gst_20260825"
  ) {
    return;
  }
  try {
    if (typeof localStorage === "undefined") return;
    const set = readDeletedSeedIds();
    set.add(id);
    localStorage.setItem(STMT_DELETED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function ensureWsbLoan015AndCc(): boolean {
  // Full statement seed ensure temporarily disabled (kept as no-op).
  // Data already lives on Neon; re-enable only with careful merge.
  return false;
}

export const EMPTY_FINANCE_SNAPSHOT: FinanceSnapshot = {
  drivers: [],
  fleets: [],
  loans: [],
  loanPayments: [],
  banks: [],
  bankTransfers: [],
  vendors: [],
  customers: [],
  receipts: [],
  rentPayments: [],
  attendances: [],
  rentWaivers: [],
  payouts: [],
  expenses: [],
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;
let hydrating = false;
let lastSaveError: string | null = null;

export function getFinanceSyncStatus() {
  return { hydrated, hydrating, lastSaveError };
}

function snapshotFromStore(): FinanceSnapshot {
  const s = useFinance.getState();
  return {
    drivers: s.drivers,
    fleets: s.fleets,
    loans: s.loans,
    loanPayments: s.loanPayments,
    banks: s.banks,
    bankTransfers: s.bankTransfers ?? [],
    vendors: s.vendors,
    customers: s.customers,
    receipts: s.receipts,
    rentPayments: s.rentPayments,
    attendances: s.attendances,
    rentWaivers: s.rentWaivers,
    payouts: s.payouts,
    expenses: s.expenses,
  };
}

function applySnapshot(data: FinanceSnapshot) {
  useFinance.setState({
    drivers: data.drivers,
    fleets: data.fleets,
    loans: data.loans,
    loanPayments: data.loanPayments,
    banks: data.banks,
    bankTransfers: data.bankTransfers ?? [],
    vendors: data.vendors,
    customers: data.customers,
    receipts: data.receipts,
    rentPayments: data.rentPayments,
    attendances: data.attendances,
    rentWaivers: data.rentWaivers,
    payouts: data.payouts,
    expenses: data.expenses,
  });
}

function mergeById<T extends { id: string; createdAt?: string }>(server: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of server) map.set(row.id, row);
  for (const row of local) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const a = prev.createdAt || "";
    const b = row.createdAt || "";
    if (b && (!a || b > a)) map.set(row.id, row);
  }
  return [...map.values()];
}

function mergeMastersById<T extends { id: string }>(server: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of server) map.set(row.id, row);
  for (const row of local) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

/**
 * Drivers: Neon is source of truth for existing ids.
 * Only fill EMPTY Neon fields from local — never overwrite real UPI/mobile/opening with zeros.
 * Local-only drivers (not on Neon yet) are kept.
 */
function mergeDrivers(server: Driver[], local: Driver[]): Driver[] {
  const map = new Map<string, Driver>();
  for (const row of server) map.set(row.id, row);
  for (const row of local) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const merged: Driver = { ...prev };
    if (!(prev.baseSalary ?? 0) && (row.baseSalary ?? 0)) merged.baseSalary = row.baseSalary;
    if (!(prev.openingBalance ?? 0) && (row.openingBalance ?? 0)) {
      merged.openingBalance = row.openingBalance;
    }
    if (!prev.upiVpa && row.upiVpa) merged.upiVpa = row.upiVpa;
    if (!prev.upiPayeeName && row.upiPayeeName) merged.upiPayeeName = row.upiPayeeName;
    if (!prev.mobile && row.mobile) merged.mobile = row.mobile;
    if (!(prev.dailyRate ?? 0) && (row.dailyRate ?? 0)) merged.dailyRate = row.dailyRate;
    if (!prev.note && row.note) merged.note = row.note;
    map.set(row.id, merged);
  }
  return [...map.values()];
}

/** Banks: Neon wins for existing ids; only keep local-only banks. */
function mergeBanks(server: BankAccount[], local: BankAccount[]): BankAccount[] {
  const map = new Map<string, BankAccount>();
  for (const row of server) map.set(row.id, row);
  for (const row of local) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

function mergeSnapshots(server: FinanceSnapshot, local: FinanceSnapshot): FinanceSnapshot {
  return {
    banks: mergeBanks(server.banks, local.banks),
    fleets: mergeMastersById(server.fleets, local.fleets),
    loans: mergeMastersById(server.loans, local.loans),
    drivers: mergeDrivers(server.drivers, local.drivers),
    vendors: mergeMastersById(server.vendors, local.vendors),
    customers: mergeMastersById(server.customers, local.customers),
    loanPayments: mergeById(server.loanPayments, local.loanPayments),
    bankTransfers: mergeById(server.bankTransfers ?? [], local.bankTransfers ?? []),
    receipts: mergeById(server.receipts, local.receipts),
    rentPayments: mergeById(server.rentPayments, local.rentPayments),
    attendances: mergeMastersById(server.attendances, local.attendances),
    rentWaivers: mergeMastersById(server.rentWaivers, local.rentWaivers),
    payouts: mergeById(server.payouts, local.payouts),
    expenses: mergeById(server.expenses, local.expenses),
  };
}

function countTxn(s: FinanceSnapshot) {
  return (
    (s.expenses?.length || 0) +
    (s.payouts?.length || 0) +
    (s.receipts?.length || 0) +
    (s.loanPayments?.length || 0) +
    (s.bankTransfers?.length || 0) +
    (s.rentPayments?.length || 0)
  );
}

async function pushSnapshot(snap: FinanceSnapshot) {
  return saveFinanceToDb({ data: snap } as never);
}

export async function hydrateFinanceFromDb(): Promise<{
  ok: boolean;
  source: "neon" | "seed-pushed" | "local";
  error?: string;
}> {
  if (hydrating) return { ok: true, source: "local" };
  hydrating = true;
  try {
    const localBefore = snapshotFromStore();
    const res = await loadFinanceFromDb();
    if (!res.ok) {
      hydrated = true;
      return { ok: false, source: "local", error: res.error };
    }
    if (res.empty || !res.data) {
      if (countTxn(localBefore) > 0 || localBefore.banks.length > 0) {
        applySnapshot(localBefore);
        hydrated = true;
        void flushFinanceSave();
        return { ok: true, source: "seed-pushed" };
      }
      applySnapshot(EMPTY_FINANCE_SNAPSHOT);
      hydrated = true;
      return { ok: true, source: "neon" };
    }
    const merged = mergeSnapshots(res.data, localBefore);
    applySnapshot(merged);
    ensureWsbLoan015AndCc();
    hydrated = true;
    // Only push if local had rows Neon does not (never rewrite Neon from empty local)
    const recovered =
      countTxn(merged) > countTxn(res.data) ||
      merged.drivers.length > res.data.drivers.length ||
      merged.banks.length > res.data.banks.length;
    if (recovered) {
      void flushFinanceSave();
    }
    return { ok: true, source: "neon" };
  } catch (e) {
    hydrated = true;
    return {
      ok: false,
      source: "local",
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    hydrating = false;
  }
}

export function scheduleFinanceSave(delayMs = 400) {
  if (!hydrated || hydrating) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushFinanceSave();
  }, delayMs);
}

export async function flushFinanceSave(): Promise<{ ok: boolean; error?: string }> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!hydrated) return { ok: true };
  try {
    const snap = snapshotFromStore();
    const res = await pushSnapshot(snap);
    lastSaveError = res.ok ? null : res.error ?? "save failed";
    return res;
  } catch (e) {
    lastSaveError = e instanceof Error ? e.message : String(e);
    return { ok: false, error: lastSaveError };
  }
}

export function startFinanceDbSync() {
  let first = true;
  const unsub = useFinance.subscribe(() => {
    if (first) {
      first = false;
      return;
    }
    if (!hydrated || hydrating) return;
    scheduleFinanceSave();
  });
  const onLeave = () => {
    if (!hydrated || hydrating) return;
    void flushFinanceSave();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onLeave();
    });
  }
  return () => {
    unsub();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onLeave);
    }
  };
}

export async function clearAllFinanceData(): Promise<{ ok: boolean; error?: string }> {
  hydrating = true;
  try {
    const res = await clearFinanceDb();
    if (!res.ok) return res;
    applySnapshot(EMPTY_FINANCE_SNAPSHOT);
    try {
      localStorage.removeItem("satelkar-finance-v5");
      localStorage.removeItem(STMT_DELETED_KEY);
    } catch {
      // ignore
    }
    hydrated = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    hydrating = false;
  }
}

import { useFinance } from "./store";
import { loadFinanceFromDb, saveFinanceToDb, clearFinanceDb } from "./db-api";
import type {
  BankAccount,
  BankTransfer,
  Driver,
  Expense,
  FinanceSnapshot,
  Fleet,
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
  fleetId: "fleet_wego_mh12zp2301",
  note: "SATELKARS LOGISTIC · Customer ID 554827 · Disburse 09/09/2026 · 398000 · EMI starts 09/10/2026 · 9.50% · Bajaj Wego MH-12-ZP-2301",
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

const FLEET_WEGO: Fleet = {
  id: "fleet_wego_mh12zp2301",
  name: "Bajaj Wego",
  regNo: "MH-12-ZP-2301",
  kind: "tempo",
  monthlyRent: 0,
  active: true,
  loanId: "loan_wsb_000015",
  note: "New vehicle · loan …000015 · statement MH12ZP2301",
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

function resolveCcBankId(): string {
  const s = useFinance.getState();
  const found =
    s.banks.find((b) => b.id === WSB_CC_BANK.id)?.id ||
    s.banks.find((b) => /warana|warna/i.test(b.name) && /cc|cash.?credit|000001/i.test(b.name))?.id;
  if (found) return found;
  s.upsertBank(WSB_CC_BANK);
  return WSB_CC_BANK.id;
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
  const s0 = useFinance.getState();
  let changed = false;
  if (!s0.fleets.some((f) => f.id === FLEET_WEGO.id || /MH-?12-?ZP-?2301/i.test(f.regNo || ""))) {
    s0.upsertFleet(FLEET_WEGO);
    changed = true;
  }
  if (!s0.loans.some((l) => l.id === WSB_LOAN_015.id)) {
    s0.upsertLoan(WSB_LOAN_015);
    changed = true;
  } else {
    const loan015 = useFinance.getState().loans.find((l) => l.id === WSB_LOAN_015.id);
    if (loan015 && loan015.fleetId !== FLEET_WEGO.id) {
      useFinance.getState().upsertLoan({ ...loan015, fleetId: FLEET_WEGO.id });
      changed = true;
    }
  }
  if (!s0.banks.some((b) => b.id === WSB_CC_BANK.id)) {
    s0.upsertBank(WSB_CC_BANK);
    changed = true;
  } else {
    const ccExisting = useFinance.getState().banks.find((b) => b.id === WSB_CC_BANK.id);
    if (ccExisting && Math.abs((ccExisting.opening ?? 0) - 0) > 0.001) {
      useFinance.getState().upsertBank({ ...ccExisting, opening: 0 });
      changed = true;
    }
  }
  const currentId = resolveCurrentBankId();
  const cur = useFinance.getState().banks.find((b) => b.id === currentId);
  if (cur && Math.abs((cur.opening ?? 0) - 11390) > 0.001) {
    useFinance.getState().upsertBank({ ...cur, opening: 11390 });
    changed = true;
  }
  const driverIds: Record<string, string> = {};
  for (const d of STMT_DRIVERS) {
    driverIds[d.name] = ensureDriverByName(d.name, d.id);
  }
  // Seed statement rows are add-only; full seed body lives in production tree.
  // Keep masters/loans/drivers ensured above. Statement txns already in Neon.
  return changed;
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

function mergeLocalOnlyRows(neon: FinanceSnapshot, local: FinanceSnapshot): FinanceSnapshot {
  const merge = <T extends { id: string }>(neonRows: T[], localRows: T[]): T[] => {
    const map = new Map(neonRows.map((r) => [r.id, r]));
    for (const row of localRows) {
      if (!map.has(row.id)) map.set(row.id, row);
    }
    return [...map.values()];
  };
  return {
    ...neon,
    drivers: merge(neon.drivers, local.drivers),
    fleets: merge(neon.fleets, local.fleets),
    loans: merge(neon.loans, local.loans),
    banks: merge(neon.banks, local.banks),
    vendors: merge(neon.vendors ?? [], local.vendors ?? []),
    customers: merge(neon.customers ?? [], local.customers ?? []),
    payouts: merge(neon.payouts, local.payouts),
    expenses: merge(neon.expenses, local.expenses),
    receipts: merge(neon.receipts ?? [], local.receipts ?? []),
    loanPayments: merge(neon.loanPayments ?? [], local.loanPayments ?? []),
    bankTransfers: merge(neon.bankTransfers ?? [], local.bankTransfers ?? []),
    rentPayments: merge(neon.rentPayments ?? [], local.rentPayments ?? []),
    attendances: merge(neon.attendances ?? [], local.attendances ?? []),
    rentWaivers: merge(neon.rentWaivers ?? [], local.rentWaivers ?? []),
  };
}

function localHasUserData(s: FinanceSnapshot): boolean {
  return (
    (s.drivers?.length ?? 0) +
      (s.banks?.length ?? 0) +
      (s.payouts?.length ?? 0) +
      (s.expenses?.length ?? 0) +
      (s.receipts?.length ?? 0) >
    0
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
    const res = await loadFinanceFromDb();
    if (!res.ok) {
      hydrated = true;
      return { ok: false, source: "local", error: res.error };
    }
    const localBefore = snapshotFromStore();
    if (res.empty || !res.data) {
      if (localHasUserData(localBefore)) {
        applySnapshot(localBefore);
        hydrated = true;
        void flushFinanceSave();
        return { ok: true, source: "seed-pushed" };
      }
      applySnapshot(EMPTY_FINANCE_SNAPSHOT);
      hydrated = true;
      const seeded = ensureWsbLoan015AndCc();
      if (seeded) void flushFinanceSave();
      return { ok: true, source: "neon" };
    }
    const merged = mergeLocalOnlyRows(res.data, localBefore);
    applySnapshot(merged);
    const added = ensureWsbLoan015AndCc();
    hydrated = true;
    if (added) void flushFinanceSave();
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

export function scheduleFinanceSave(delayMs = 800) {
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
  if (!hydrated || hydrating) return { ok: true };
  try {
    const snap = snapshotFromStore();
    const res = await pushSnapshot(snap);
    if (!res.ok) {
      lastSaveError = res.error || "Save failed";
      return { ok: false, error: lastSaveError };
    }
    lastSaveError = null;
    return { ok: true };
  } catch (e) {
    lastSaveError = e instanceof Error ? e.message : String(e);
    return { ok: false, error: lastSaveError };
  }
}

export function startFinanceDbSync() {
  if (typeof window === "undefined") return () => {};
  const unsub = useFinance.subscribe(() => {
    if (!hydrated || hydrating) return;
    scheduleFinanceSave();
  });
  const onHide = () => {
    if (!hydrated || hydrating) return;
    void flushFinanceSave();
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
  return () => {
    unsub();
    window.removeEventListener("pagehide", onHide);
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

import { useFinance } from "./store";
import { loadFinanceFromDb, saveFinanceToDb, clearFinanceDb } from "./db-api";
import type { BankAccount, FinanceSnapshot, Loan } from "./types";

/** Canonical WSB Mini …000015 — from statement 11-Sep-2026. */
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

/** Warana Cash Credit …000001 — drawn ~20,206.20 as of 11-Sep-2026. */
const WSB_CC_BANK: BankAccount = {
  id: "bank_wsb_cc_000001",
  name: "Warana CC · …000001",
  isDefault: false,
  opening: -20206.2,
};

/** Ensure loan 015 + CC bank exist after hydrate (safe if already present). */
function ensureWsbLoan015AndCc(): boolean {
  const s = useFinance.getState();
  let changed = false;
  if (!s.loans.some((l) => l.id === WSB_LOAN_015.id)) {
    s.upsertLoan(WSB_LOAN_015);
    changed = true;
  }
  if (!s.banks.some((b) => b.id === WSB_CC_BANK.id)) {
    s.upsertBank(WSB_CC_BANK);
    changed = true;
  }
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

async function pushSnapshot(snap: FinanceSnapshot) {
  return saveFinanceToDb({ data: snap });
}

/** Load from Neon. Empty DB → empty UI (no auto demo seed). */
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
    if (res.empty || !res.data) {
      applySnapshot(EMPTY_FINANCE_SNAPSHOT);
      hydrated = true;
      return { ok: true, source: "neon" };
    }
    applySnapshot(res.data);
    const added = ensureWsbLoan015AndCc();
    hydrated = true;
    if (added) {
      // Persist new loan/CC without waiting for user edit
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
  return useFinance.subscribe(() => {
    if (first) {
      first = false;
      return;
    }
    if (!hydrated || hydrating) return;
    scheduleFinanceSave();
  });
}

/** Clear Neon + local store (and browser persist). */
export async function clearAllFinanceData(): Promise<{ ok: boolean; error?: string }> {
  hydrating = true;
  try {
    const res = await clearFinanceDb();
    if (!res.ok) return res;
    applySnapshot(EMPTY_FINANCE_SNAPSHOT);
    try {
      localStorage.removeItem("satelkar-finance-v5");
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

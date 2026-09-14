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
  opening: -20206.2,
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

  if (!s0.loans.some((l) => l.id === WSB_LOAN_015.id)) {
    s0.upsertLoan(WSB_LOAN_015);
    changed = true;
  }
  if (!s0.banks.some((b) => b.id === WSB_CC_BANK.id)) {
    s0.upsertBank(WSB_CC_BANK);
    changed = true;
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

  const ccId = WSB_CC_BANK.id;
  const deletedIds = readDeletedSeedIds();

  const xfers: BankTransfer[] = [
    {
      id: "xfer_cc_to_cur_100_20260910",
      fromBankId: ccId,
      toBankId: currentId,
      amount: 100,
      date: "2026-09-10",
      note: "OWN CC → Current · statement",
      createdAt: "2026-09-10T12:00:00.000Z",
    },
    {
      id: "xfer_cc_to_cur_10k_a_20260911",
      fromBankId: ccId,
      toBankId: currentId,
      amount: 10000,
      date: "2026-09-11",
      note: "OWN CC → Current SELF · statement",
      createdAt: "2026-09-11T12:00:00.000Z",
    },
    {
      id: "xfer_cc_to_cur_10k_b_20260911",
      fromBankId: ccId,
      toBankId: currentId,
      amount: 10000,
      date: "2026-09-11",
      note: "OWN CC → Current · statement",
      createdAt: "2026-09-11T12:30:00.000Z",
    },
  ];

  const bajajId = resolveBajajBankId();
  xfers.push(
    {
      id: "xfer_bajaj_to_warana_5000_20260901",
      fromBankId: bajajId,
      toBankId: currentId,
      amount: 5000,
      date: "2026-09-01",
      note: "Bajaj → Warana · Dinesh · 01-Sep statement",
      createdAt: "2026-09-01T12:00:00.000Z",
    },
    {
      id: "xfer_bajaj_to_warana_5000_20260904",
      fromBankId: bajajId,
      toBankId: currentId,
      amount: 5000,
      date: "2026-09-04",
      note: "Bajaj → Warana · Dinesh · 04-Sep statement",
      createdAt: "2026-09-04T12:00:00.000Z",
    },
    {
      id: "xfer_bajaj_to_warana_20000_20260909",
      fromBankId: bajajId,
      toBankId: currentId,
      amount: 20000,
      date: "2026-09-09",
      note: "Bajaj → Warana · Dinesh · 09-Sep statement",
      createdAt: "2026-09-09T12:00:00.000Z",
    },
  );

  const existingXferIds = new Set((useFinance.getState().bankTransfers ?? []).map((x) => x.id));
  const missingXfers = xfers.filter((x) => !existingXferIds.has(x.id) && !deletedIds.has(x.id));
  if (missingXfers.length) {
    useFinance.setState((state) => ({
      bankTransfers: [...missingXfers, ...(state.bankTransfers ?? [])],
    }));
    changed = true;
  }

  const gstId = "exp_cc_gst_20260825";
  if (!deletedIds.has(gstId) && !useFinance.getState().expenses.some((e) => e.id === gstId)) {
    const cc = useFinance.getState().banks.find((b) => b.id === ccId);
    if (cc) {
      useFinance.getState().upsertBank({
        ...cc,
        opening: Math.round((cc.opening + 16.2) * 100) / 100,
      });
    }
    useFinance.setState((state) => ({
      expenses: [
        {
          id: gstId,
          category: "Other",
          vendor: "Warana Bank GST",
          amount: 16.2,
          date: "2026-08-25",
          mode: "bank" as const,
          status: "paid" as const,
          bankAccountId: ccId,
          upiVpa: "",
          fleetId: null,
          note: "GST · cheque book 1–45 · CC statement",
          createdAt: "2026-08-25T12:00:00.000Z",
        },
        ...state.expenses,
      ],
    }));
    changed = true;
  }

  type PSeed = Omit<Payout, "createdAt"> & { createdAt?: string };
  type ESeed = Omit<Expense, "createdAt"> & { createdAt?: string };

  const po = (
    id: string,
    driver: string,
    kind: Payout["kind"],
    amount: number,
    date: string,
    note: string,
  ): PSeed => ({
    id,
    driverId: driverIds[driver],
    kind,
    amount,
    date,
    mode: "upi",
    status: "paid",
    bankAccountId: currentId,
    upiVpa: "",
    note,
    createdAt: `${date}T12:00:00.000Z`,
  });

  const ex = (
    id: string,
    category: string,
    vendor: string,
    amount: number,
    date: string,
    note: string,
  ): ESeed => ({
    id,
    category,
    vendor,
    amount,
    date,
    mode: "upi",
    status: "paid",
    bankAccountId: currentId,
    upiVpa: "",
    fleetId: null,
    note,
    createdAt: `${date}T12:00:00.000Z`,
  });

  const payouts: PSeed[] = [
    po("po_stmt_20260827_vikas_er_250", "Vikas", "extra_route", 250, "2026-08-27", "UPI Vikas · statement"),
    po("po_stmt_20260827_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-27", "UPI Vivek · statement"),
    po("po_stmt_20260827_anand_ret_300", "Anand", "return", 300, "2026-08-27", "UPI Mohan/Anand return · statement"),
    po("po_stmt_20260827_vikas_adv_1500", "Vikas", "advance", 1500, "2026-08-27", "UPI Vikas advance · statement"),
    po("po_stmt_20260828_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-28", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260828_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-28", "UPI Vivek · statement"),
    po("po_stmt_20260829_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-29", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260829_vikas_adv_2000", "Vikas", "advance", 2000, "2026-08-29", "UPI Dnyaneshwar/Vikas advance · statement"),
    po("po_stmt_20260829_vikas_adv_1500", "Vikas", "advance", 1500, "2026-08-29", "UPI Dnyaneshwar/Vikas advance · statement"),
    po("po_stmt_20260830_ballu_adv_2000", "Ballu", "advance", 2000, "2026-08-30", "AVI Servicing → Ballu advance · statement"),
    po("po_stmt_20260831_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-31", "UPI Vivek · statement"),
    po("po_stmt_20260831_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-31", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260831_vikas_er_250", "Vikas", "extra_route", 250, "2026-08-31", "UPI Vikas · statement"),
    po("po_stmt_20260901_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-01", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260901_sandeep_adv_1000", "Sandeep", "advance", 1000, "2026-09-01", "UPI Balaji/Sandeep advance · statement"),
    po("po_stmt_20260901_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-01", "UPI Vikas · statement"),
    po("po_stmt_20260902_ballu_er_500", "Ballu", "extra_route", 500, "2026-09-02", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260902_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-02", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260902_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-02", "UPI Vikas · statement"),
    po("po_stmt_20260903_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-03", "UPI Vikas · statement"),
    po("po_stmt_20260903_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-03", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260903_ballu_er_500", "Ballu", "extra_route", 500, "2026-09-03", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260904_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-04", "UPI Vikas · statement"),
    po("po_stmt_20260904_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-04", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260904_ballu_er_700", "Ballu", "extra_route", 700, "2026-09-04", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260905_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-05", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260905_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-05", "UPI Vikas · statement"),
    po("po_stmt_20260905_karan_adv_2000", "Karan", "advance", 2000, "2026-09-05", "Vaishali/AVI → Karan advance · statement"),
    po("po_stmt_20260905_karan_adv_1000", "Karan", "advance", 1000, "2026-09-05", "Vaishali/AVI → Karan advance · statement"),
    po("po_stmt_20260905_vikas_ret_4000", "Vikas", "return", 4000, "2026-09-05", "Deepa → Vikas return · statement"),
    po("po_stmt_20260906_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-06", "UPI Vikas · statement"),
    po("po_stmt_20260906_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-06", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260906_sandeep_adv_500", "Sandeep", "advance", 500, "2026-09-06", "Sandeep advance · statement"),
    po("po_stmt_20260907_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-07", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260907_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-07", "UPI Vikas · statement"),
    po("po_stmt_20260908_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-08", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260908_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-08", "UPI Vikas · statement"),
    po("po_stmt_20260908_vivek_adv_300", "Vivek", "advance", 300, "2026-09-08", "Vivek advance · statement"),
    po("po_stmt_20260909_karan_adv_1968", "Karan", "advance", 1968, "2026-09-09", "Karan advance · statement"),
    po("po_stmt_20260909_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-09", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260909_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-09", "UPI Vikas · statement"),
  ];

  const expenses: ESeed[] = [
    ex("exp_stmt_20260827_fleet8026_138", "Maintenance", "Fleet 8026", 138, "2026-08-27", "UPI Vivek · expense fleet 8026 · statement"),
    ex("exp_stmt_20260830_porter_200", "Porter", "Porter", 200, "2026-08-30", "Porter smartshift · statement"),
    ex("exp_stmt_20260903_cibil_siddhesh_199", "Other", "CIBIL · Siddhesh", 199.42, "2026-09-03", "CIBIL charges tax Siddhesh · new loan file · statement"),
    ex("exp_stmt_20260903_cibil_dinesh_199", "Other", "CIBIL · Dinesh", 199.42, "2026-09-03", "CIBIL charges tax Dinesh · new loan file · statement"),
    ex("exp_stmt_20260904_porter_300", "Porter", "Porter", 300, "2026-09-04", "Porter · statement"),
    ex("exp_stmt_20260904_cab_250", "Other", "Cab book", 250, "2026-09-04", "Krushnat Sathe · cab book · statement"),
    ex("exp_stmt_20260904_tempo_300", "Other", "Tempo collect", 300, "2026-09-04", "AVI · tempo collect · statement"),
    ex("exp_stmt_20260904_ballu_food_100", "Other", "Ballu food", 100, "2026-09-04", "AVI · Ballu food · statement"),
    ex("exp_stmt_20260906_porter_200", "Porter", "Porter", 200, "2026-09-06", "Porter · statement"),
    ex("exp_stmt_20260907_stamp_2000", "Other", "Stamp in stock", 2000, "2026-09-07", "Loan stamp · statement"),
    ex("exp_stmt_20260909_project_report_2002", "Other", "Project report fee", 2002.96, "2026-09-09", "NEFT project report fee · loan file · statement"),
    ex("exp_stmt_20260909_bclass_300", "Other", "B Class fee", 300, "2026-09-09", "B CLASS FEE · statement"),
    ex("exp_stmt_20260909_excess_share_10000", "Other", "Excess share", 10000, "2026-09-09", "EXCESS SHARE AMT · statement"),
    ex("exp_stmt_20260909_process_fee_1298", "Other", "Process fee", 1298, "2026-09-09", "PROCESS FEE · loan · statement"),
    ex("exp_stmt_20260909_cibil_2537", "Other", "CIBIL", 2537, "2026-09-09", "CIBIL · loan · statement"),
    ex("exp_stmt_20260909_laxmi_motors_398029", "Other", "Laxmi Motors", 398029.5, "2026-09-09", "RTGS Laxmi Motors · vehicle · statement"),
  ];

  const existingPo = new Set(useFinance.getState().payouts.map((p) => p.id));
  const missingPo = payouts.filter((p) => !existingPo.has(p.id) && !deletedIds.has(p.id));
  if (missingPo.length) {
    useFinance.setState((state) => ({
      payouts: [...(missingPo as Payout[]), ...state.payouts],
    }));
    changed = true;
  }

  const existingEx = new Set(useFinance.getState().expenses.map((e) => e.id));
  const missingEx = expenses.filter((e) => !existingEx.has(e.id) && !deletedIds.has(e.id));
  if (missingEx.length) {
    useFinance.setState((state) => ({
      expenses: [...(missingEx as Expense[]), ...state.expenses],
    }));
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
    if (res.empty || !res.data) {
      applySnapshot(EMPTY_FINANCE_SNAPSHOT);
      hydrated = true;
      return { ok: true, source: "neon" };
    }
    applySnapshot(res.data);
    const added = ensureWsbLoan015AndCc();
    hydrated = true;
    if (added) {
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

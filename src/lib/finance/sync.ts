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
      // Dinesh UPI on Warana = Bajaj → Warana (user said 04-Sep, not 01-Sep)
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

  // Drop wrong-dated 01-Sep Bajaj seed if present (moved to 04-Sep)
  const OLD_BAJAJ_01 = "xfer_bajaj_to_warana_5000_20260901";
  if ((useFinance.getState().bankTransfers ?? []).some((x) => x.id === OLD_BAJAJ_01)) {
    useFinance.setState((state) => ({
      bankTransfers: (state.bankTransfers ?? []).filter((x) => x.id !== OLD_BAJAJ_01),
    }));
    changed = true;
  }

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

  // --- Statement payouts & expenses (classified with user) ---
  // Full list continues below in original file content...

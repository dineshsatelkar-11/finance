import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BankAccount,
  Customer,
  Driver,
  Expense,
  Fleet,
  Loan,
  LoanPayment,
  LoanPaymentKind,
  PayMode,
  Payout,
} from "./types";
import { monthISO, todayISO } from "./format";
import { parseUpiPayload } from "./upi";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultBankId() {
  // Prefer HDFC / primary operating account if present
  return "bank_hdfc";
}

function seedState(): {
  month: string;
  banks: BankAccount[];
  fleets: Fleet[];
  loans: Loan[];
  drivers: Driver[];
  customers: Customer[];
  expenses: Expense[];
  payouts: Payout[];
  loanPayments: LoanPayment[];
} {
  const month = monthISO();
  const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const hdfc = "bank_hdfc";
  const cash = "bank_cash";
  const Q = "loan_wsb_0014";
  const $ = "fleet_mini";

  const loan: Loan = {
    id: Q,
    name: "WSB Mini — New Vehicle Loan",
    bank: "Warana Sahakari Bank (HDFC0CSWSBL)",
    accountNo: "3970254350000014",
    ifsc: "HDFC0CSWSBL",
    principal: 388000,
    emiAmount: 8149,
    emiDay: 15,
    totalEmis: 60,
    startDate: "2026-06-15",
    endDate: "2031-05-15",
    interestRate: 9.5,
    outstanding: 372616,
    pendingEmis: 59,
    status: "active",
    fleetId: $,
    note: "SATELKARS LOGISTIC · Customer ID 554827 · Gultekadi Pune",
  };

  const fleet: Fleet = {
    id: $,
    name: "Mini commercial",
    regNo: "MH-XX-XXXX",
    kind: "mini",
    monthlyRent: 5000,
    active: true,
    loanId: Q,
    note: "WSB loan vehicle · A/c …000014",
  };

  const drivers: Driver[] = [
    {
      id: "drv_bharat",
      name: "Bharat",
      mobile: "9876543210",
      kind: "full",
      baseSalary: 18000,
      dailyRate: 0,
      active: true,
      upiVpa: "",
      upiPayeeName: "Bharat",
      upiUpdatedAt: null,
      fleetId: $,
      note: "Lohegaon route",
    },
    {
      id: "drv_anand",
      name: "Anand",
      mobile: "9823011122",
      kind: "full",
      baseSalary: 16500,
      dailyRate: 0,
      active: true,
      upiVpa: "anand.satelkar@ybl",
      upiPayeeName: "Anand Satelkar",
      upiUpdatedAt: `${day(1)}T08:00:00`,
      fleetId: null,
      note: "",
    },
    {
      id: "drv_vikas",
      name: "Vikas",
      mobile: "9890122233",
      kind: "full",
      baseSalary: 17000,
      dailyRate: 0,
      active: true,
      upiVpa: "vikas@okaxis",
      upiPayeeName: "Vikas",
      upiUpdatedAt: `${day(2)}T08:00:00`,
      fleetId: null,
      note: "",
    },
  ];

  return {
    month,
    banks: [
      {
        id: hdfc,
        name: "HDFC Current",
        accountNo: "502000XXXXXX",
        ifsc: "HDFC0000123",
        balance: 125000,
        kind: "current",
        note: "Primary ops",
      },
      {
        id: cash,
        name: "Cash in hand",
        accountNo: "-",
        ifsc: "-",
        balance: 8500,
        kind: "cash",
        note: "",
      },
    ],
    fleets: [fleet],
    loans: [loan],
    drivers,
    customers: [],
    expenses: [],
    payouts: [],
    loanPayments: [],
  };
}

type FinanceState = ReturnType<typeof seedState> & {
  setMonth: (m: string) => void;
  upsertBank: (b: BankAccount) => void;
  removeBank: (id: string) => void;
  upsertFleet: (f: Fleet) => void;
  removeFleet: (id: string) => void;
  upsertLoan: (l: Loan) => void;
  removeLoan: (id: string) => void;
  upsertDriver: (d: Driver) => void;
  removeDriver: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  removeCustomer: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => { ok: true; id: string } | { ok: false; error: string };
  removeExpense: (id: string) => void;
  recordPayout: (input: {
    driverId: string;
    amount: number;
    mode: PayMode;
    date?: string;
    note?: string;
    upiVpa?: string;
    bankAccountId?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  markPayoutPaid: (id: string) => void;
  removePayout: (id: string) => void;
  recordLoanPayment: (input: {
    loanId: string;
    kind: LoanPaymentKind;
    amount: number;
    date?: string;
    mode?: PayMode;
    note?: string;
    bankAccountId?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  markLoanPaymentPaid: (id: string) => void;
  ensureMonthlyEmi: (loanId: string) => { ok: true; created: boolean; id?: string } | { ok: false; error: string };
  hydrateFromDb: (data: Partial<ReturnType<typeof seedState>>) => void;
  replaceAll: (data: ReturnType<typeof seedState>) => void;
};

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      setMonth: (m) => set({ month: m }),
      upsertBank: (b) =>
        set((s) => ({
          banks: s.banks.some((x) => x.id === b.id)
            ? s.banks.map((x) => (x.id === b.id ? b : x))
            : [...s.banks, b],
        })),
      removeBank: (id) => set((s) => ({ banks: s.banks.filter((x) => x.id !== id) })),
      upsertFleet: (f) =>
        set((s) => ({
          fleets: s.fleets.some((x) => x.id === f.id)
            ? s.fleets.map((x) => (x.id === f.id ? f : x))
            : [...s.fleets, f],
        })),
      removeFleet: (id) => set((s) => ({ fleets: s.fleets.filter((x) => x.id !== id) })),
      upsertLoan: (l) =>
        set((s) => ({
          loans: s.loans.some((x) => x.id === l.id)
            ? s.loans.map((x) => (x.id === l.id ? l : x))
            : [...s.loans, l],
        })),
      removeLoan: (id) => set((s) => ({ loans: s.loans.filter((x) => x.id !== id) })),
      upsertDriver: (d) =>
        set((s) => ({
          drivers: s.drivers.some((x) => x.id === d.id)
            ? s.drivers.map((x) => (x.id === d.id ? d : x))
            : [...s.drivers, d],
        })),
      removeDriver: (id) => set((s) => ({ drivers: s.drivers.filter((x) => x.id !== id) })),
      upsertCustomer: (c) =>
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id)
            ? s.customers.map((x) => (x.id === c.id ? c : x))
            : [...s.customers, c],
        })),
      removeCustomer: (id) => set((s) => ({ customers: s.customers.filter((x) => x.id !== id) })),
      addExpense: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const id = uid("exp");
        const row: Expense = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ expenses: [row, ...s.expenses] }));
        return { ok: true, id };
      },
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),
      recordPayout: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const drv = get().drivers.find((d) => d.id === input.driverId);
        if (!drv) return { ok: false, error: "Select a driver." };
        let vpa = (input.upiVpa || "").trim();
        if (input.mode === "upi") {
          const parsed =
            parseUpiPayload(vpa) ||
            (drv.upiVpa ? { vpa: drv.upiVpa, payeeName: "", amount: null } : null);
          if (!parsed?.vpa) return { ok: false, error: "UPI VPA required for UPI payout." };
          vpa = parsed.vpa;
        }
        const id = uid("pay");
        const row: Payout = {
          id,
          driverId: input.driverId,
          amount: input.amount,
          mode: input.mode,
          status: "pending",
          date: input.date || todayISO(),
          note: input.note || "",
          upiVpa: vpa || null,
          bankAccountId: input.bankAccountId || defaultBankId(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ payouts: [row, ...s.payouts] }));
        return { ok: true, id };
      },
      markPayoutPaid: (id) =>
        set((s) => ({
          payouts: s.payouts.map((p) => (p.id === id ? { ...p, status: "paid" as const } : p)),
        })),
      removePayout: (id) => set((s) => ({ payouts: s.payouts.filter((x) => x.id !== id) })),
      recordLoanPayment: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const loan = get().loans.find((l) => l.id === input.loanId);
        if (!loan) return { ok: false, error: "Loan not found." };
        const id = uid("lp");
        const row: LoanPayment = {
          id,
          loanId: input.loanId,
          kind: input.kind,
          amount: input.amount,
          date: input.date || todayISO(),
          mode: input.mode || "bank",
          status: "pending",
          bankAccountId: input.bankAccountId || defaultBankId(),
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ loanPayments: [row, ...s.loanPayments] }));
        return { ok: true, id };
      },
      markLoanPaymentPaid: (id) =>
        set((s) => ({
          loanPayments: s.loanPayments.map((p) =>
            p.id === id ? { ...p, status: "paid" as const } : p,
          ),
        })),
      ensureMonthlyEmi: (loanId) => {
        const loan = get().loans.find((l) => l.id === loanId);
        if (!loan || loan.status !== "active") return { ok: false, error: "Active loan not found." };
        const ym = get().month;
        // Coerce emiDay from DB (may arrive as string/null) before padStart
        const dayNum = Math.min(28, Math.max(1, Number(loan.emiDay) || 1));
        const dueDay = String(dayNum).padStart(2, "0");
        const dueDate = `${ym}-${dueDay}`;
        const exists = get().loanPayments.some(
          (p) => p.loanId === loanId && p.kind === "emi" && p.date === dueDate,
        );
        if (exists) return { ok: true, created: false };
        const id = uid("lp");
        const row: LoanPayment = {
          id,
          loanId,
          kind: "emi",
          amount: Number(loan.emiAmount) || 0,
          date: dueDate,
          mode: "bank",
          status: "pending",
          bankAccountId: defaultBankId(),
          note: `Auto EMI due ${dueDate}`,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ loanPayments: [row, ...s.loanPayments] }));
        return { ok: true, created: true, id };
      },
      hydrateFromDb: (data) => set((s) => ({ ...s, ...data })),
      replaceAll: (data) => set(data),
    }),
    {
      name: "satelkar-finance-v1",
      partialize: (s) => ({
        month: s.month,
        banks: s.banks,
        fleets: s.fleets,
        loans: s.loans,
        drivers: s.drivers,
        customers: s.customers,
        expenses: s.expenses,
        payouts: s.payouts,
        loanPayments: s.loanPayments,
      }),
    },
  ),
);

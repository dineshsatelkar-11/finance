import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BankAccount,
  Driver,
  Expense,
  Fleet,
  Loan,
  LoanPayment,
  LoanPaymentKind,
  PayMode,
  Payout,
  PayoutKind,
  PayoutStatus,
  Vendor,
} from "./types";
import { monthISO, todayISO, uid } from "./format";
import { isValidVpa, normalizeVpa, parseUpiPayload } from "./upi";

const LOAN_ID = "loan_wsb_mini";
const FLEET_ID = "flt_mini_000014";

function seed(): {
  drivers: Driver[];
  fleets: Fleet[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  banks: BankAccount[];
  vendors: Vendor[];
  payouts: Payout[];
  expenses: Expense[];
} {
  const month = monthISO();
  const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const hdfc = "bank_hdfc";
  const cash = "bank_cash";

  const loan: Loan = {
    id: LOAN_ID,
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
    fleetId: FLEET_ID,
    note: "SATELKARS LOGISTIC · Customer ID 554827 · Gultekadi Pune",
  };

  const fleet: Fleet = {
    id: FLEET_ID,
    name: "Mini commercial",
    regNo: "MH-XX-XXXX",
    kind: "mini",
    monthlyRent: 0,
    active: true,
    loanId: LOAN_ID,
    note: "WSB loan vehicle · A/c …000014",
  };

  const bharat: Driver = {
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
    fleetId: FLEET_ID,
    note: "Lohegaon route",
  };
  const anand: Driver = {
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
  };
  const vikas: Driver = {
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
  };
  const yuvraj: Driver = {
    id: "drv_yuvraj",
    name: "Yuvraj",
    mobile: "9765432109",
    kind: "part",
    baseSalary: 0,
    dailyRate: 800,
    active: true,
    upiVpa: "",
    upiPayeeName: "Yuvraj",
    upiUpdatedAt: null,
    fleetId: null,
    note: "Weekend cover",
  };
  const rama: Driver = {
    id: "drv_rama",
    name: "Rama",
    mobile: "9012345678",
    kind: "full",
    baseSalary: 15500,
    dailyRate: 0,
    active: true,
    upiVpa: "rama.pune@ibl",
    upiPayeeName: "Rama",
    upiUpdatedAt: `${day(3)}T08:00:00`,
    fleetId: null,
    note: "",
  };

  const loanPayments: LoanPayment[] = [
    {
      id: "lp_disb",
      loanId: LOAN_ID,
      kind: "disbursement",
      amount: 388000,
      date: "2026-05-15",
      mode: "bank",
      status: "paid",
      bankAccountId: hdfc,
      note: "NEW DISBURSEMENT",
      createdAt: "2026-05-15T10:00:00",
    },
    {
      id: "lp_emi_jun",
      loanId: LOAN_ID,
      kind: "emi",
      amount: 8149,
      date: "2026-06-15",
      mode: "bank",
      status: "paid",
      bankAccountId: hdfc,
      note: "EMI · BY TRF SATELKARS LOGISTIC",
      createdAt: "2026-06-15T10:00:00",
    },
    {
      id: "lp_emi_jul",
      loanId: LOAN_ID,
      kind: "emi",
      amount: 8149,
      date: "2026-07-15",
      mode: "bank",
      status: "paid",
      bankAccountId: hdfc,
      note: "EMI · Dr from operating a/c",
      createdAt: "2026-07-15T10:00:00",
    },
    {
      id: "lp_emi_aug",
      loanId: LOAN_ID,
      kind: "emi",
      amount: 8149,
      date: "2026-08-15",
      mode: "bank",
      status: "paid",
      bankAccountId: hdfc,
      note: "EMI · Dr from operating a/c",
      createdAt: "2026-08-15T10:00:00",
    },
  ];

  return {
    drivers: [bharat, anand, vikas, yuvraj, rama],
    fleets: [fleet],
    loans: [loan],
    loanPayments,
    banks: [
      { id: hdfc, name: "HDFC Current · IBCAB", isDefault: true, opening: 186400 },
      { id: cash, name: "Cash in hand", isDefault: false, opening: 12400 },
    ],
    vendors: [
      {
        id: "vnd_fuel",
        name: "HP Pump · Dhanori",
        upiVpa: "hppump.dhanori@okhdfcbank",
        upiPayeeName: "HP Petrol Pump",
      },
      {
        id: "vnd_print",
        name: "Sticker Print",
        upiVpa: "printworks@paytm",
        upiPayeeName: "Print Works",
      },
      {
        id: "vnd_wsb",
        name: "Warana Bank · Loan EMI",
        upiVpa: "",
        upiPayeeName: "Warana Sahakari Bank",
      },
    ],
    payouts: [
      {
        id: "po_anand_sal",
        driverId: anand.id,
        kind: "salary",
        amount: 16500,
        date: day(1),
        mode: "upi",
        status: "paid",
        bankAccountId: hdfc,
        upiVpa: anand.upiVpa,
        note: "September salary",
        createdAt: `${day(1)}T10:12:00`,
      },
      {
        id: "po_vikas_adv",
        driverId: vikas.id,
        kind: "advance",
        amount: 3000,
        date: day(4),
        mode: "upi",
        status: "paid",
        bankAccountId: hdfc,
        upiVpa: vikas.upiVpa,
        note: "Festival advance",
        createdAt: `${day(4)}T18:40:00`,
      },
      {
        id: "po_bharat_sal",
        driverId: bharat.id,
        kind: "salary",
        amount: 18000,
        date: day(5),
        mode: "upi",
        status: "pending",
        bankAccountId: hdfc,
        upiVpa: "",
        note: "Blocked — no UPI on file",
        createdAt: `${day(5)}T09:00:00`,
      },
    ],
    expenses: [
      {
        id: "ex_fuel",
        category: "Fuel",
        vendor: "HP Pump · Dhanori",
        amount: 4200,
        date: day(3),
        mode: "upi",
        status: "paid",
        bankAccountId: hdfc,
        upiVpa: "hppump.dhanori@okhdfcbank",
        fleetId: FLEET_ID,
        note: "Tempo diesel",
        createdAt: `${day(3)}T07:30:00`,
      },
      {
        id: "ex_stickers",
        category: "Packaging",
        vendor: "Sticker Print",
        amount: 1850,
        date: day(6),
        mode: "upi",
        status: "paid",
        bankAccountId: hdfc,
        upiVpa: "printworks@paytm",
        fleetId: null,
        note: "Box labels",
        createdAt: `${day(6)}T14:10:00`,
      },
    ],
  };
}

type Actions = {
  setMonth: (m: string) => void;
  upsertDriver: (d: Driver) => void;
  setDriverUpi: (
    driverId: string,
    vpa: string,
    payeeName: string,
  ) => { ok: true } | { ok: false; error: string };
  removeDriverUpi: (driverId: string) => void;
  assignDriverFleet: (driverId: string, fleetId: string | null) => void;
  upsertFleet: (f: Fleet) => void;
  upsertLoan: (l: Loan) => void;
  recordLoanPayment: (input: {
    loanId: string;
    kind: LoanPaymentKind;
    amount: number;
    date?: string;
    mode: PayMode;
    bankAccountId: string;
    note?: string;
    /** When true (default for EMI), reduce loan outstanding & pendingEmis. */
    reduceBalance?: boolean;
  }) => { ok: true; id: string } | { ok: false; error: string };
  /** Create this month’s EMI as pending if not already recorded for the due date. */
  ensureMonthlyEmi: (loanId: string) => { ok: true; created: boolean; id?: string } | { ok: false; error: string };
  recordPayout: (input: {
    driverId: string;
    kind: PayoutKind;
    amount: number;
    date?: string;
    mode: PayMode;
    bankAccountId: string;
    upiVpa?: string;
    note?: string;
    status?: PayoutStatus;
  }) => { ok: true; id: string } | { ok: false; error: string };
  setPayoutStatus: (id: string, status: PayoutStatus) => void;
  recordExpense: (input: {
    category: string;
    vendor: string;
    amount: number;
    date?: string;
    mode: PayMode;
    bankAccountId: string;
    upiVpa?: string;
    fleetId?: string | null;
    note?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  upsertVendor: (v: Vendor) => void;
  resetDemo: () => void;
};

export const useFinance = create<
  {
    month: string;
    drivers: Driver[];
    fleets: Fleet[];
    loans: Loan[];
    loanPayments: LoanPayment[];
    banks: BankAccount[];
    vendors: Vendor[];
    payouts: Payout[];
    expenses: Expense[];
  } & Actions
>()(
  persist(
    (set, get) => ({
      month: monthISO(),
      ...seed(),
      setMonth: (m) => set({ month: m }),
      upsertDriver: (d) =>
        set((s) => {
          const i = s.drivers.findIndex((x) => x.id === d.id);
          const next = [...s.drivers];
          if (i >= 0) next[i] = d;
          else next.push(d);
          return { drivers: next };
        }),
      setDriverUpi: (driverId, vpa, payeeName) => {
        const parsed =
          parseUpiPayload(vpa) ||
          (isValidVpa(vpa) ? { vpa: normalizeVpa(vpa), payeeName: "", amount: null } : null);
        if (!parsed || !isValidVpa(parsed.vpa)) {
          return {
            ok: false,
            error: "Enter a valid UPI ID (must include @), or paste a upi:// QR payload.",
          };
        }
        const drv = get().drivers.find((d) => d.id === driverId);
        if (!drv) return { ok: false, error: "Driver not found." };
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === driverId
              ? {
                  ...d,
                  upiVpa: parsed.vpa,
                  upiPayeeName: (payeeName || parsed.payeeName || d.upiPayeeName || d.name).trim(),
                  upiUpdatedAt: new Date().toISOString(),
                }
              : d,
          ),
        }));
        return { ok: true };
      },
      removeDriverUpi: (driverId) =>
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === driverId ? { ...d, upiVpa: "", upiUpdatedAt: null } : d,
          ),
        })),
      assignDriverFleet: (driverId, fleetId) =>
        set((s) => ({
          drivers: s.drivers.map((d) => (d.id === driverId ? { ...d, fleetId } : d)),
        })),
      upsertFleet: (f) =>
        set((s) => {
          const i = s.fleets.findIndex((x) => x.id === f.id);
          const next = [...s.fleets];
          if (i >= 0) next[i] = f;
          else next.push(f);
          return { fleets: next };
        }),
      upsertLoan: (l) =>
        set((s) => {
          const i = s.loans.findIndex((x) => x.id === l.id);
          const next = [...s.loans];
          if (i >= 0) next[i] = l;
          else next.push(l);
          return { loans: next };
        }),
      recordLoanPayment: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const loan = get().loans.find((l) => l.id === input.loanId);
        if (!loan) return { ok: false, error: "Select a loan." };
        const id = uid("lp");
        const row: LoanPayment = {
          id,
          loanId: input.loanId,
          kind: input.kind,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          mode: input.mode,
          status: "paid",
          bankAccountId: input.bankAccountId,
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        const reduce = input.reduceBalance !== false && (input.kind === "emi" || input.kind === "prepay");
        set((s) => ({
          loanPayments: [row, ...s.loanPayments],
          loans: s.loans.map((l) => {
            if (l.id !== input.loanId) return l;
            if (!reduce) return l;
            const outstanding = Math.max(0, Math.round((l.outstanding - row.amount) * 100) / 100);
            const pendingEmis =
              input.kind === "emi" ? Math.max(0, l.pendingEmis - 1) : l.pendingEmis;
            return {
              ...l,
              outstanding,
              pendingEmis,
              status: outstanding <= 0 ? "closed" : l.status,
            };
          }),
        }));
        return { ok: true, id };
      },
      ensureMonthlyEmi: (loanId) => {
        const loan = get().loans.find((l) => l.id === loanId);
        if (!loan || loan.status !== "active") return { ok: false, error: "Active loan not found." };
        const ym = get().month;
        const dueDay = String(Math.min(28, Math.max(1, loan.emiDay))).padStart(2, "0");
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
          amount: loan.emiAmount,
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
      recordPayout: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const drv = get().drivers.find((d) => d.id === input.driverId);
        if (!drv) return { ok: false, error: "Select a driver." };
        let vpa = (input.upiVpa || "").trim();
        if (input.mode === "upi") {
          const parsed =
            parseUpiPayload(vpa) ||
            (drv.upiVpa ? { vpa: drv.upiVpa, payeeName: "", amount: null } : null);
          if (!parsed || !isValidVpa(parsed.vpa)) {
            return { ok: false, error: "Add a valid driver UPI ID before recording a UPI payout." };
          }
          vpa = parsed.vpa;
        }
        const id = uid("po");
        const row: Payout = {
          id,
          driverId: input.driverId,
          kind: input.kind,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          mode: input.mode,
          status: input.status || "pending",
          bankAccountId: input.bankAccountId,
          upiVpa: vpa,
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ payouts: [row, ...s.payouts] }));
        return { ok: true, id };
      },
      setPayoutStatus: (id, status) =>
        set((s) => ({
          payouts: s.payouts.map((p) => (p.id === id ? { ...p, status } : p)),
        })),
      recordExpense: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const id = uid("ex");
        const row: Expense = {
          id,
          category: input.category,
          vendor: input.vendor,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          mode: input.mode,
          status: "paid",
          bankAccountId: input.bankAccountId,
          upiVpa: input.upiVpa ? normalizeVpa(input.upiVpa) : "",
          fleetId: input.fleetId ?? null,
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ expenses: [row, ...s.expenses] }));
        return { ok: true, id };
      },
      upsertVendor: (v) =>
        set((s) => {
          const i = s.vendors.findIndex((x) => x.id === v.id);
          const next = [...s.vendors];
          if (i >= 0) next[i] = v;
          else next.push(v);
          return { vendors: next };
        }),
      resetDemo: () => set({ month: monthISO(), ...seed() }),
    }),
    { name: "satelkar-finance-v3", skipHydration: true },
  ),
);

export function defaultBankId() {
  const banks = useFinance.getState().banks;
  return banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BankAccount,
  BankTransfer,
  Customer,
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
  Receipt,
  RentPayment,
  RentWaiver,
  Attendance,
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
  bankTransfers: BankTransfer[];
  vendors: Vendor[];
  customers: Customer[];
  receipts: Receipt[];
  rentPayments: RentPayment[];
  attendances: Attendance[];
  rentWaivers: RentWaiver[];
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
    monthlyRent: 5000,
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
    bankTransfers: [],
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
    customers: [
      {
        id: "cus_ibcab",
        name: "IBCAB client A",
        mobile: "9876500001",
        note: "Regular route",
      },
      {
        id: "cus_kharadi",
        name: "Kharadi store",
        mobile: "9876500002",
        note: "",
      },
    ],
    receipts: [
      {
        id: "rc_sample",
        customerId: "cus_ibcab",
        customerName: "IBCAB client A",
        amount: 12500,
        date: day(2),
        mode: "upi",
        status: "paid",
        bankAccountId: hdfc,
        fleetId: FLEET_ID,
        note: "Weekly settlement",
        createdAt: `${day(2)}T16:00:00`,
      },
    ],
    rentPayments: [
      {
        id: "rp_sample",
        fleetId: FLEET_ID,
        driverId: "drv_bharat",
        amount: 5000,
        date: day(1),
        forMonth: month,
        mode: "cash",
        status: "paid",
        note: "September rent",
        createdAt: `${day(1)}T11:00:00`,
      },
    ],
    attendances: [],
    rentWaivers: [],
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
  upsertBank: (b: BankAccount) => void;
  setDefaultBank: (id: string) => void;
  recordBankTransfer: (input: {
    fromBankId: string;
    toBankId: string;
    amount: number;
    date?: string;
    note?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  upsertLoan: (l: Loan) => void;
  recordLoanPayment: (input: {
    loanId: string;
    kind: LoanPaymentKind;
    amount: number;
    date?: string;
    mode: PayMode;
    bankAccountId: string;
    note?: string;
    reduceBalance?: boolean;
  }) => { ok: true; id: string } | { ok: false; error: string };
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
  updatePayout: (
    id: string,
    patch: Partial<Pick<Payout, "amount" | "note" | "date" | "kind" | "mode" | "status" | "bankAccountId" | "upiVpa">>,
  ) => void;
  removePayout: (id: string) => void;
  /** Remove only pending + failed payouts (optionally scoped to month YYYY-MM). Paid rows stay. */
  clearHeldOrFailedPayouts: (month?: string) => number;
  updateExpense: (
    id: string,
    patch: Partial<Pick<Expense, "amount" | "note" | "date" | "category" | "vendor" | "mode" | "status" | "bankAccountId" | "upiVpa" | "fleetId">>,
  ) => void;
  removeExpense: (id: string) => void;
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
  upsertCustomer: (c: Customer) => void;
  recordReceipt: (input: {
    customerId: string;
    amount: number;
    date?: string;
    mode: PayMode;
    bankAccountId: string;
    fleetId?: string | null;
    note?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  recordRent: (input: {
    fleetId: string;
    driverId: string;
    amount: number;
    date?: string;
    forMonth?: string;
    mode: PayMode;
    note?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  setAttendance: (driverId: string, month: string, leaveDays: number, note?: string) => void;
  setRentWaiver: (
    fleetId: string,
    month: string,
    breakdownDays: number,
    amount?: number,
    note?: string,
  ) => void;
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
    bankTransfers: BankTransfer[];
    vendors: Vendor[];
    customers: Customer[];
    receipts: Receipt[];
    rentPayments: RentPayment[];
    attendances: Attendance[];
    rentWaivers: RentWaiver[];
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
      upsertBank: (b) =>
        set((s) => {
          const i = s.banks.findIndex((x) => x.id === b.id);
          let next = [...s.banks];
          if (i >= 0) next[i] = b;
          else next.push(b);
          if (b.isDefault) {
            next = next.map((x) => ({ ...x, isDefault: x.id === b.id }));
          }
          return { banks: next };
        }),
      setDefaultBank: (id) =>
        set((s) => ({
          banks: s.banks.map((x) => ({ ...x, isDefault: x.id === id })),
        })),
      recordBankTransfer: (input) => {
        const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
        if (!(amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        if (!input.fromBankId || !input.toBankId) {
          return { ok: false, error: "Select both accounts." };
        }
        if (input.fromBankId === input.toBankId) {
          return { ok: false, error: "Choose two different accounts." };
        }
        const from = get().banks.find((b) => b.id === input.fromBankId);
        const to = get().banks.find((b) => b.id === input.toBankId);
        if (!from || !to) return { ok: false, error: "Account not found." };
        const id = uid("xfer");
        const row: BankTransfer = {
          id,
          fromBankId: input.fromBankId,
          toBankId: input.toBankId,
          amount,
          date: input.date || todayISO(),
          note: (input.note || "").trim(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          bankTransfers: [row, ...(s.bankTransfers ?? [])],
          banks: s.banks.map((b) => {
            if (b.id === from.id) {
              return { ...b, opening: Math.round((b.opening - amount) * 100) / 100 };
            }
            if (b.id === to.id) {
              return { ...b, opening: Math.round((b.opening + amount) * 100) / 100 };
            }
            return b;
          }),
        }));
        return { ok: true, id };
      },
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
      updatePayout: (id, patch) =>
        set((s) => ({
          payouts: s.payouts.map((p) => {
            if (p.id !== id) return p;
            const next = { ...p, ...patch };
            if (patch.amount != null) next.amount = Math.round(Number(patch.amount) * 100) / 100;
            return next;
          }),
        })),
      removePayout: (id) => set((s) => ({ payouts: s.payouts.filter((p) => p.id !== id) })),
      clearHeldOrFailedPayouts: (month) => {
        const before = get().payouts.length;
        set((s) => ({
          payouts: s.payouts.filter((p) => {
            if (p.status === "paid") return true;
            if (month && !p.date.startsWith(month)) return true;
            return false;
          }),
        }));
        return before - get().payouts.length;
      },
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
      updateExpense: (id, patch) =>
        set((s) => ({
          expenses: s.expenses.map((e) => {
            if (e.id !== id) return e;
            const next = { ...e, ...patch };
            if (patch.amount != null) next.amount = Math.round(Number(patch.amount) * 100) / 100;
            return next;
          }),
        })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      upsertVendor: (v) =>
        set((s) => {
          const i = s.vendors.findIndex((x) => x.id === v.id);
          const next = [...s.vendors];
          if (i >= 0) next[i] = v;
          else next.push(v);
          return { vendors: next };
        }),
      upsertCustomer: (c) =>
        set((s) => {
          const i = s.customers.findIndex((x) => x.id === c.id);
          const next = [...s.customers];
          if (i >= 0) next[i] = c;
          else next.push(c);
          return { customers: next };
        }),
      recordReceipt: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const customer = get().customers.find((c) => c.id === input.customerId);
        if (!customer) return { ok: false, error: "Select a customer." };
        const id = uid("rc");
        const row: Receipt = {
          id,
          customerId: customer.id,
          customerName: customer.name,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          mode: input.mode,
          status: "paid",
          bankAccountId: input.bankAccountId,
          fleetId: input.fleetId ?? null,
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ receipts: [row, ...s.receipts] }));
        return { ok: true, id };
      },
      recordRent: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const fleet = get().fleets.find((f) => f.id === input.fleetId);
        const driver = get().drivers.find((d) => d.id === input.driverId);
        if (!fleet) return { ok: false, error: "Select a fleet." };
        if (!driver) return { ok: false, error: "Select a driver." };
        const id = uid("rp");
        const row: RentPayment = {
          id,
          fleetId: input.fleetId,
          driverId: input.driverId,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          forMonth: input.forMonth || get().month,
          mode: input.mode,
          status: "paid",
          note: input.note || "",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ rentPayments: [row, ...s.rentPayments] }));
        return { ok: true, id };
      },
      setAttendance: (driverId, month, leaveDays, note) =>
        set((s) => {
          const days = Math.max(0, Math.min(31, Math.floor(leaveDays) || 0));
          const i = s.attendances.findIndex((a) => a.driverId === driverId && a.month === month);
          const row: Attendance = {
            id: i >= 0 ? s.attendances[i]!.id : uid("att"),
            driverId,
            month,
            leaveDays: days,
            note: note || (i >= 0 ? s.attendances[i]!.note : ""),
          };
          const next = [...s.attendances];
          if (i >= 0) next[i] = row;
          else next.push(row);
          return { attendances: next };
        }),
      setRentWaiver: (fleetId, month, breakdownDays, amount, note) =>
        set((s) => {
          const days = Math.max(0, Math.min(31, Math.floor(breakdownDays) || 0));
          const i = s.rentWaivers.findIndex((w) => w.fleetId === fleetId && w.month === month);
          const row: RentWaiver = {
            id: i >= 0 ? s.rentWaivers[i]!.id : uid("rw"),
            fleetId,
            month,
            breakdownDays: days,
            amount: Math.max(0, amount || 0),
            note: note || (i >= 0 ? s.rentWaivers[i]!.note : ""),
          };
          const next = [...s.rentWaivers];
          if (i >= 0) next[i] = row;
          else next.push(row);
          return { rentWaivers: next };
        }),
      resetDemo: () => set({ month: monthISO(), ...seed() }),
    }),
    { name: "satelkar-finance-v5", skipHydration: true },
  ),
);

export function defaultBankId() {
  const banks = useFinance.getState().banks;
  return banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
}

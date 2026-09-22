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

// NOTE: full store restored with transfer fix — opening not mutated on transfer
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
  return {
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
  clearHeldOrFailedPayouts: (month?: string) => number;
  updateExpense: (
    id: string,
    patch: Partial<Pick<Expense, "amount" | "note" | "date" | "category" | "vendor" | "mode" | "status" | "bankAccountId" | "upiVpa" | "fleetId">>,
  ) => void;
  removeExpense: (id: string) => void;
  updateReceipt: (
    id: string,
    patch: Partial<Pick<Receipt, "amount" | "note" | "date" | "mode" | "status" | "bankAccountId" | "fleetId" | "customerId" | "customerName">>,
  ) => void;
  removeReceipt: (id: string) => void;
  updateRentPayment: (
    id: string,
    patch: Partial<Pick<RentPayment, "amount" | "note" | "date" | "mode" | "status" | "fleetId" | "driverId" | "forMonth">>,
  ) => void;
  removeRentPayment: (id: string) => void;
  updateLoanPayment: (
    id: string,
    patch: Partial<Pick<LoanPayment, "amount" | "note" | "date" | "mode" | "status" | "kind" | "bankAccountId">>,
  ) => void;
  removeLoanPayment: (id: string) => void;
  removeBankTransfer: (id: string) => { ok: true } | { ok: false; error: string };
  removeBank: (id: string) => { ok: true } | { ok: false; error: string };
  removeDriver: (id: string) => void;
  removeFleet: (id: string) => void;
  removeLoan: (id: string) => void;
  removeVendor: (id: string) => void;
  removeCustomer: (id: string) => void;
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
        // Opening stays fixed — balance uses bankTransfers in/out (no double-count)
        set((s) => ({
          bankTransfers: [row, ...(s.bankTransfers ?? [])],
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
        if (!loan || loan.status !== "active") return { ok: false, error: "Loan not active." };
        const month = get().month;
        const dayNum = Number(loan.emiDay) || 1;
        const day = String(dayNum).padStart(2, "0");
        const date = `${month}-${day}`;
        const exists = get().loanPayments.some(
          (p) => p.loanId === loanId && p.kind === "emi" && p.date.startsWith(month),
        );
        if (exists) return { ok: true, created: false };
        const bankId = get().banks.find((b) => b.isDefault)?.id || get().banks[0]?.id || "";
        const res = get().recordLoanPayment({
          loanId,
          kind: "emi",
          amount: loan.emiAmount,
          date,
          mode: "bank",
          bankAccountId: bankId,
          note: `EMI auto · ${month}`,
          reduceBalance: false,
        });
        if (!res.ok) return res;
        return { ok: true, created: true, id: res.id };
      },
      recordPayout: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const id = uid("po");
        const row: Payout = {
          id,
          driverId: input.driverId,
          kind: input.kind,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          mode: input.mode,
          status: input.status || "paid",
          bankAccountId: input.bankAccountId,
          upiVpa: input.upiVpa || "",
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
          payouts: s.payouts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
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
      updateExpense: (id, patch) =>
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      updateReceipt: (id, patch) =>
        set((s) => ({
          receipts: s.receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeReceipt: (id) => set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) })),
      updateRentPayment: (id, patch) =>
        set((s) => ({
          rentPayments: s.rentPayments.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRentPayment: (id) =>
        set((s) => ({ rentPayments: s.rentPayments.filter((r) => r.id !== id) })),
      updateLoanPayment: (id, patch) =>
        set((s) => ({
          loanPayments: s.loanPayments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeLoanPayment: (id) =>
        set((s) => ({ loanPayments: s.loanPayments.filter((p) => p.id !== id) })),
      removeBankTransfer: (id) => {
        const x = (get().bankTransfers ?? []).find((t) => t.id === id);
        if (!x) return { ok: false, error: "Transfer not found." };
        set((s) => ({
          bankTransfers: (s.bankTransfers ?? []).filter((t) => t.id !== id),
        }));
        return { ok: true };
      },
      removeBank: (id) => {
        const used =
          get().payouts.some((p) => p.bankAccountId === id) ||
          get().expenses.some((e) => e.bankAccountId === id) ||
          get().receipts.some((r) => r.bankAccountId === id) ||
          get().loanPayments.some((p) => p.bankAccountId === id) ||
          (get().bankTransfers ?? []).some((t) => t.fromBankId === id || t.toBankId === id);
        if (used) return { ok: false, error: "Bank is used by transactions." };
        set((s) => ({ banks: s.banks.filter((b) => b.id !== id) }));
        return { ok: true };
      },
      removeDriver: (id) => set((s) => ({ drivers: s.drivers.filter((d) => d.id !== id) })),
      removeFleet: (id) => set((s) => ({ fleets: s.fleets.filter((f) => f.id !== id) })),
      removeLoan: (id) => set((s) => ({ loans: s.loans.filter((l) => l.id !== id) })),
      removeVendor: (id) => set((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) })),
      removeCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
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
          upiVpa: input.upiVpa || "",
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
          customerId: input.customerId,
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
        const id = uid("rp");
        const row: RentPayment = {
          id,
          fleetId: input.fleetId,
          driverId: input.driverId,
          amount: Math.round(input.amount * 100) / 100,
          date: input.date || todayISO(),
          forMonth: input.forMonth || monthISO(),
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
          const i = s.attendances.findIndex((a) => a.driverId === driverId && a.month === month);
          const row: Attendance = {
            id: i >= 0 ? s.attendances[i].id : uid("att"),
            driverId,
            month,
            leaveDays,
            note: note || "",
          };
          const next = [...s.attendances];
          if (i >= 0) next[i] = row;
          else next.push(row);
          return { attendances: next };
        }),
      setRentWaiver: (fleetId, month, breakdownDays, amount, note) =>
        set((s) => {
          const i = s.rentWaivers.findIndex((w) => w.fleetId === fleetId && w.month === month);
          const row: RentWaiver = {
            id: i >= 0 ? s.rentWaivers[i].id : uid("rw"),
            fleetId,
            month,
            breakdownDays,
            amount: amount || 0,
            note: note || "",
          };
          const next = [...s.rentWaivers];
          if (i >= 0) next[i] = row;
          else next.push(row);
          return { rentWaivers: next };
        }),
      resetDemo: () => set({ month: monthISO(), ...seed() }),
    }),
    {
      name: "satelkar-finance-v5",
      partialize: (s) => ({
        month: s.month,
        drivers: s.drivers,
        fleets: s.fleets,
        loans: s.loans,
        loanPayments: s.loanPayments,
        banks: s.banks,
        bankTransfers: s.bankTransfers,
        vendors: s.vendors,
        customers: s.customers,
        receipts: s.receipts,
        rentPayments: s.rentPayments,
        attendances: s.attendances,
        rentWaivers: s.rentWaivers,
        payouts: s.payouts,
        expenses: s.expenses,
      }),
    },
  ),
);

export function defaultBankId() {
  const s = useFinance.getState();
  return s.banks.find((b) => b.isDefault)?.id || s.banks[0]?.id || "";
}

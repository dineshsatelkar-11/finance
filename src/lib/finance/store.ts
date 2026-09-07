import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BankAccount,
  Driver,
  Expense,
  PayMode,
  Payout,
  PayoutKind,
  PayoutStatus,
  Vendor,
} from "./types";
import { monthISO, todayISO, uid } from "./format";
import { isValidVpa, normalizeVpa, parseUpiPayload } from "./upi";

function seed(): {
  drivers: Driver[];
  banks: BankAccount[];
  vendors: Vendor[];
  payouts: Payout[];
  expenses: Expense[];
} {
  const month = monthISO();
  const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const hdfc = "bank_hdfc";
  const cash = "bank_cash";

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
    note: "",
  };

  return {
    drivers: [bharat, anand, vikas, yuvraj, rama],
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
        note: "Box labels",
        createdAt: `${day(6)}T14:10:00`,
      },
    ],
  };
}

type Actions = {
  setMonth: (m: string) => void;
  upsertDriver: (d: Driver) => void;
  setDriverUpi: (driverId: string, vpa: string, payeeName: string) => { ok: true } | { ok: false; error: string };
  removeDriverUpi: (driverId: string) => void;
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
    note?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  upsertVendor: (v: Vendor) => void;
  resetDemo: () => void;
};

export const useFinance = create<
  {
    month: string;
    drivers: Driver[];
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
        const parsed = parseUpiPayload(vpa) || (isValidVpa(vpa) ? { vpa: normalizeVpa(vpa), payeeName: "", amount: null } : null);
        if (!parsed || !isValidVpa(parsed.vpa)) {
          return { ok: false, error: "Enter a valid UPI ID (must include @), or paste a upi:// QR payload." };
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
      recordPayout: (input) => {
        if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
        const drv = get().drivers.find((d) => d.id === input.driverId);
        if (!drv) return { ok: false, error: "Select a driver." };
        let vpa = (input.upiVpa || "").trim();
        if (input.mode === "upi") {
          const parsed = parseUpiPayload(vpa) || (drv.upiVpa ? { vpa: drv.upiVpa, payeeName: "", amount: null } : null);
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
    { name: "satelkar-finance-v2", skipHydration: true },
  ),
);

export function defaultBankId() {
  const banks = useFinance.getState().banks;
  return banks.find((b) => b.isDefault)?.id || banks[0]?.id || "";
}

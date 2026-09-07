export type PayMode = "upi" | "cash" | "bank";

export type DriverKind = "full" | "part";

export type PayoutKind = "salary" | "advance" | "extra_route" | "fine" | "return";

export type PayoutStatus = "pending" | "paid" | "failed";

export type Driver = {
  id: string;
  name: string;
  mobile: string;
  kind: DriverKind;
  baseSalary: number;
  dailyRate: number;
  active: boolean;
  /** Canonical VPA stored on the driver — never only in a side map keyed by name. */
  upiVpa: string;
  upiPayeeName: string;
  upiUpdatedAt: string | null;
  note: string;
};

export type BankAccount = {
  id: string;
  name: string;
  isDefault: boolean;
  opening: number;
};

export type Vendor = {
  id: string;
  name: string;
  upiVpa: string;
  upiPayeeName: string;
};

export type Payout = {
  id: string;
  driverId: string;
  kind: PayoutKind;
  amount: number;
  date: string;
  mode: PayMode;
  status: PayoutStatus;
  bankAccountId: string;
  upiVpa: string;
  note: string;
  createdAt: string;
};

export type Expense = {
  id: string;
  category: string;
  vendor: string;
  amount: number;
  date: string;
  mode: PayMode;
  status: PayoutStatus;
  bankAccountId: string;
  upiVpa: string;
  note: string;
  createdAt: string;
};

export type FinanceState = {
  month: string;
  drivers: Driver[];
  banks: BankAccount[];
  vendors: Vendor[];
  payouts: Payout[];
  expenses: Expense[];
};

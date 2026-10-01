export type DriverKind = "salary" | "daily";

export type Driver = {
  id: string;
  name: string;
  mobile: string;
  upiVpa: string;
  upiPayeeName: string;
  kind: DriverKind;
  baseSalary: number;
  dailyRate: number;
  opening: number;
  active: boolean;
  note: string;
};

export type FleetKind = "owned" | "rented";

export type Fleet = {
  id: string;
  name: string;
  regNo: string;
  kind: FleetKind;
  monthlyRent: number;
  active: boolean;
  loanId: string;
  note: string;
  /** When false, skip tempo rent deduction on salary slip. */
  chargesRent?: boolean;
};

export type Loan = {
  id: string;
  bank: string;
  accountNo: string;
  emi: number;
  emiDay: number;
  opening: number;
  fleetId: string;
  note: string;
};

export type LoanPaymentKind = "emi" | "principal" | "other";

export type LoanPayment = {
  id: string;
  loanId: string;
  kind: LoanPaymentKind;
  amount: number;
  date: string;
  mode: PayMode;
  status: PayoutStatus;
  bankAccountId: string;
  note: string;
  createdAt: string;
};

export type BankAccount = {
  id: string;
  name: string;
  isDefault: boolean;
  opening: number;
};

export type BankTransfer = {
  id: string;
  fromBankId: string;
  toBankId: string;
  amount: number;
  date: string;
  note: string;
  createdAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  upiVpa: string;
  upiPayeeName: string;
};

export type Customer = {
  id: string;
  name: string;
  mobile: string;
  note: string;
};

export type Receipt = {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  mode: PayMode;
  status: PayoutStatus;
  bankAccountId: string;
  fleetId: string;
  note: string;
  createdAt: string;
};

export type RentPayment = {
  id: string;
  fleetId: string;
  driverId: string;
  amount: number;
  date: string;
  forMonth: string;
  mode: PayMode;
  status: PayoutStatus;
  note: string;
  createdAt: string;
};

export type Attendance = {
  id: string;
  driverId: string;
  month: string;
  leaveDays: number;
  note: string;
};

export type RentWaiver = {
  id: string;
  fleetId: string;
  month: string;
  breakdownDays: number;
  amount: number;
  note: string;
};

export type PayoutKind =
  | "advance"
  | "salary"
  | "bonus"
  | "extra_route"
  | "return"
  | "fine";

export type PayoutStatus = "pending" | "paid" | "failed";

export type PayMode = "cash" | "upi" | "bank";

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
  fleetId: string;
  note: string;
  createdAt: string;
};

export type FinanceState = {
  month: string;
  drivers: Driver[];
  fleets: Fleet[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  banks: BankAccount[];
  /** Optional until bank_transfers is fully loaded from Neon. */
  bankTransfers?: BankTransfer[];
  vendors: Vendor[];
  customers: Customer[];
  receipts: Receipt[];
  rentPayments: RentPayment[];
  attendances: Attendance[];
  rentWaivers: RentWaiver[];
  payouts: Payout[];
  expenses: Expense[];
};

/** Full business data without UI month selector — used for Neon load/save. */
export type FinanceSnapshot = Omit<FinanceState, "month"> & {
  /** Client-side tombstones: rows removed on this device; Neon must delete these ids. */
  deletedIds?: string[];
};

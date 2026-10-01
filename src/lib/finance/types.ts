export type PayMode = "upi" | "cash" | "bank";

export type DriverKind = "full" | "part";

export type PayoutKind = "salary" | "advance" | "extra_route" | "bonus" | "fine" | "return";

export type PayoutStatus = "pending" | "paid" | "failed";

export type FleetKind = "mini" | "tempo" | "truck" | "other";

export type LoanStatus = "active" | "closed";

export type LoanPaymentKind = "emi" | "interest" | "prepay" | "disbursement";

export type Driver = {
  id: string;
  name: string;
  mobile: string;
  kind: DriverKind;
  baseSalary: number;
  dailyRate: number;
  /**
   * Opening balance for this driver (₹).
   * Positive = company owes driver; negative = driver owes company.
   * Optional for older local data; treat missing as 0.
   */
  openingBalance?: number;
  active: boolean;
  /** Canonical VPA stored on the driver — never only in a side map keyed by name. */
  upiVpa: string;
  upiPayeeName: string;
  upiUpdatedAt: string | null;
  /** Fleet this driver currently runs / rents (optional). */
  fleetId: string | null;
  note: string;
};

export type Fleet = {
  id: string;
  name: string;
  regNo: string;
  kind: FleetKind;
  /** Monthly rent charged to the driver (0 if company-owned / route-only). */
  monthlyRent: number;
  /**
   * When false, vehicle is route-only (no rent collected from driver).
   * Missing on older data → treat as true if monthlyRent > 0.
   */
  chargesRent?: boolean;
  active: boolean;
  loanId: string | null;
  note: string;
};

export type Loan = {
  id: string;
  name: string;
  bank: string;
  accountNo: string;
  ifsc: string;
  principal: number;
  emiAmount: number;
  emiDay: number;
  totalEmis: number;
  startDate: string;
  endDate: string;
  interestRate: number;
  outstanding: number;
  pendingEmis: number;
  status: LoanStatus;
  fleetId: string | null;
  note: string;
};

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

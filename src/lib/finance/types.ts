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
  /** Monthly rent charged to the driver (0 if company-owned, no rent). */
  monthlyRent: number;
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

export type Vendor = {
  id: string;
  name: string;
  upiVpa: string;
  upiPayeeName: string;
};

/** Customer who pays Satelkar’s for logistics service. */
export type Customer = {
  id: string;
  name: string;
  mobile: string;
  note: string;
};

/** Money received from a customer (service collection). */
export type Receipt = {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  mode: PayMode;
  status: PayoutStatus;
  bankAccountId: string;
  fleetId: string | null;
  note: string;
  createdAt: string;
};

/** Driver paying fleet rent to the company. */
export type RentPayment = {
  id: string;
  fleetId: string;
  driverId: string;
  amount: number;
  date: string;
  /** Month this rent covers, YYYY-MM */
  forMonth: string;
  mode: PayMode;
  status: PayoutStatus;
  note: string;
  createdAt: string;
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
  fleetId: string | null;
  note: string;
  createdAt: string;
};

/** Leave days for a driver in a calendar month (affects salary). */
export type Attendance = {
  id: string;
  driverId: string;
  /** YYYY-MM */
  month: string;
  leaveDays: number;
  note: string;
};

/** Rent not charged due to vehicle breakdown / off-road days. */
export type RentWaiver = {
  id: string;
  fleetId: string;
  /** YYYY-MM */
  month: string;
  breakdownDays: number;
  /** If > 0, use this; else compute monthlyRent/30 * breakdownDays */
  amount: number;
  note: string;
};

export type FinanceState = {
  month: string;
  drivers: Driver[];
  fleets: Fleet[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  banks: BankAccount[];
  vendors: Vendor[];
  customers: Customer[];
  receipts: Receipt[];
  rentPayments: RentPayment[];
  attendances: Attendance[];
  rentWaivers: RentWaiver[];
  payouts: Payout[];
  expenses: Expense[];
};

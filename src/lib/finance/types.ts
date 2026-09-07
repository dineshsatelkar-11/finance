export type PayMode = "upi" | "cash" | "bank";

export type DriverKind = "full" | "part";

export type PayoutKind = "salary" | "advance" | "extra_route" | "fine" | "return";

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
  /** Original sanctioned / disbursed principal. */
  principal: number;
  emiAmount: number;
  /** Day of month EMI is due (1–28). */
  emiDay: number;
  totalEmis: number;
  startDate: string;
  endDate: string;
  interestRate: number;
  /** Current outstanding (rupees owed). */
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
  /** Optional: which fleet this expense belongs to. */
  fleetId: string | null;
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
  vendors: Vendor[];
  payouts: Payout[];
  expenses: Expense[];
};

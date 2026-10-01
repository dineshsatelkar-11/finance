import { getSql } from "@/lib/db";
import type {
  Attendance,
  BankAccount,
  BankTransfer,
  Customer,
  Driver,
  Expense,
  FinanceSnapshot,
  Fleet,
  Loan,
  LoanPayment,
  Payout,
  Receipt,
  RentPayment,
  RentWaiver,
  Vendor,
} from "./types";

function mapDriver(r: Record<string, unknown>): Driver {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    mobile: String(r.mobile ?? ""),
    upiVpa: String(r.upi_vpa ?? ""),
    upiPayeeName: String(r.upi_payee_name ?? ""),
    kind: (r.kind as Driver["kind"]) || "salary",
    baseSalary: Number(r.base_salary ?? 0),
    dailyRate: Number(r.daily_rate ?? 0),
    opening: Number(r.opening ?? 0),
    active: Boolean(r.active ?? true),
    note: String(r.note ?? ""),
  };
}

export async function loadFinanceSnapshot(): Promise<FinanceSnapshot> {
  const sql = await getSql();
  const [
    banks,
    drivers,
    fleets,
    loans,
    loanPayments,
    vendors,
    customers,
    receipts,
    rentPayments,
    attendances,
    rentWaivers,
    payouts,
    expenses,
  ] = await Promise.all([
    sql.query(`select * from banks order by name`),
    sql.query(`select * from drivers order by name`),
    sql.query(`select * from fleets order by name`),
    sql.query(`select * from loans order by bank`),
    sql.query(`select * from loan_payments order by date desc, created_at desc`),
    sql.query(`select * from vendors order by name`),
    sql.query(`select * from customers order by name`),
    sql.query(`select * from receipts order by date desc, created_at desc`),
    sql.query(`select * from rent_payments order by date desc, created_at desc`),
    sql.query(`select * from attendances`),
    sql.query(`select * from rent_waivers`),
    sql.query(`select * from payouts order by date desc, created_at desc`),
    sql.query(`select * from expenses order by date desc, created_at desc`),
  ]);

  let bankTransfers: BankTransfer[] = [];
  try {
    const rows = await sql.query(`select * from bank_transfers order by date desc, created_at desc`);
    bankTransfers = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      fromBankId: String(r.from_bank_id),
      toBankId: String(r.to_bank_id),
      amount: Number(r.amount),
      date: String(r.date),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  } catch {
    /* older DB */
  }

  return {
    banks: banks.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      isDefault: Boolean(r.is_default),
      opening: Number(r.opening ?? 0),
    })),
    drivers: drivers.map((r: Record<string, unknown>) => mapDriver(r)),
    fleets: fleets.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      regNo: String(r.reg_no ?? ""),
      kind: (r.kind as Fleet["kind"]) || "owned",
      monthlyRent: Number(r.monthly_rent ?? 0),
      active: Boolean(r.active ?? true),
      loanId: String(r.loan_id ?? ""),
      note: String(r.note ?? ""),
    })),
    loans: loans.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      bank: String(r.bank ?? ""),
      accountNo: String(r.account_no ?? ""),
      emi: Number(r.emi ?? 0),
      emiDay: Number(r.emi_day ?? 1),
      opening: Number(r.opening ?? 0),
      fleetId: String(r.fleet_id ?? ""),
      note: String(r.note ?? ""),
    })),
    loanPayments: loanPayments.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      loanId: String(r.loan_id),
      kind: (r.kind as LoanPayment["kind"]) || "emi",
      amount: Number(r.amount),
      date: String(r.date),
      mode: (r.mode as LoanPayment["mode"]) || "bank",
      status: (r.status as LoanPayment["status"]) || "paid",
      bankAccountId: String(r.bank_account_id ?? ""),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
    bankTransfers,
    vendors: vendors.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      upiVpa: String(r.upi_vpa ?? ""),
      upiPayeeName: String(r.upi_payee_name ?? ""),
    })),
    customers: customers.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      mobile: String(r.mobile ?? ""),
      note: String(r.note ?? ""),
    })),
    receipts: receipts.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      customerId: String(r.customer_id ?? ""),
      customerName: String(r.customer_name ?? ""),
      amount: Number(r.amount),
      date: String(r.date),
      mode: (r.mode as Receipt["mode"]) || "cash",
      status: (r.status as Receipt["status"]) || "paid",
      bankAccountId: String(r.bank_account_id ?? ""),
      fleetId: String(r.fleet_id ?? ""),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
    rentPayments: rentPayments.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      fleetId: String(r.fleet_id),
      driverId: String(r.driver_id ?? ""),
      amount: Number(r.amount),
      date: String(r.date),
      forMonth: String(r.for_month ?? ""),
      mode: (r.mode as RentPayment["mode"]) || "cash",
      status: (r.status as RentPayment["status"]) || "paid",
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
    attendances: attendances.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      driverId: String(r.driver_id),
      month: String(r.month),
      leaveDays: Number(r.leave_days ?? 0),
      note: String(r.note ?? ""),
    })),
    rentWaivers: rentWaivers.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      fleetId: String(r.fleet_id),
      month: String(r.month),
      breakdownDays: Number(r.breakdown_days ?? 0),
      amount: Number(r.amount ?? 0),
      note: String(r.note ?? ""),
    })),
    payouts: payouts.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      driverId: String(r.driver_id),
      kind: (r.kind as Payout["kind"]) || "advance",
      amount: Number(r.amount),
      date: String(r.date),
      mode: (r.mode as Payout["mode"]) || "cash",
      status: (r.status as Payout["status"]) || "paid",
      bankAccountId: String(r.bank_account_id ?? ""),
      upiVpa: String(r.upi_vpa ?? ""),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
    expenses: expenses.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      category: String(r.category ?? ""),
      vendor: String(r.vendor ?? ""),
      amount: Number(r.amount),
      date: String(r.date),
      mode: (r.mode as Expense["mode"]) || "cash",
      status: (r.status as Expense["status"]) || "paid",
      bankAccountId: String(r.bank_account_id ?? ""),
      upiVpa: String(r.upi_vpa ?? ""),
      fleetId: String(r.fleet_id ?? ""),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
  };
}

export async function saveFinanceSnapshot(snap: FinanceSnapshot): Promise<void> {
  const sql = await getSql();

  const hasData =
    (snap.banks?.length ?? 0) +
      (snap.drivers?.length ?? 0) +
      (snap.payouts?.length ?? 0) +
      (snap.expenses?.length ?? 0) +
      (snap.bankTransfers?.length ?? 0) +
      (snap.receipts?.length ?? 0) >
    0;
  if (!hasData) {
    return;
  }

  /**
   * SAFE SAVE — masters + transactions UPSERT; intentional deletes via snap.deletedIds only.
   */
  for (const b of snap.banks ?? []) {
    await sql.query(
      `insert into banks (id, name, is_default, opening) values ($1, $2, $3, $4)
       on conflict (id) do update set
         name = excluded.name,
         is_default = excluded.is_default,
         opening = excluded.opening`,
      [b.id, b.name, b.isDefault, b.opening],
    );
  }
  for (const f of snap.fleets ?? []) {
    await sql.query(
      `insert into fleets (id, name, reg_no, kind, monthly_rent, active, loan_id, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do update set
         name = excluded.name,
         reg_no = excluded.reg_no,
         kind = excluded.kind,
         monthly_rent = excluded.monthly_rent,
         active = excluded.active,
         loan_id = excluded.loan_id,
         note = excluded.note`,
      [f.id, f.name, f.regNo, f.kind, f.monthlyRent, f.active, f.loanId, f.note],
    );
  }
  for (const l of snap.loans ?? []) {
    await sql.query(
      `insert into loans (id, bank, account_no, emi, emi_day, opening, fleet_id, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do update set
         bank = excluded.bank,
         account_no = excluded.account_no,
         emi = excluded.emi,
         emi_day = excluded.emi_day,
         opening = excluded.opening,
         fleet_id = excluded.fleet_id,
         note = excluded.note`,
      [l.id, l.bank, l.accountNo, l.emi, l.emiDay, l.opening, l.fleetId, l.note],
    );
  }
  for (const d of snap.drivers ?? []) {
    await sql.query(
      `insert into drivers (id, name, mobile, upi_vpa, upi_payee_name, kind, base_salary, daily_rate, opening, active, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         name = excluded.name,
         mobile = CASE WHEN excluded.mobile IS NULL OR excluded.mobile = '' THEN drivers.mobile ELSE excluded.mobile END,
         upi_vpa = CASE WHEN excluded.upi_vpa IS NULL OR excluded.upi_vpa = '' THEN drivers.upi_vpa ELSE excluded.upi_vpa END,
         upi_payee_name = CASE WHEN excluded.upi_payee_name IS NULL OR excluded.upi_payee_name = '' THEN drivers.upi_payee_name ELSE excluded.upi_payee_name END,
         kind = excluded.kind,
         base_salary = excluded.base_salary,
         daily_rate = excluded.daily_rate,
         opening = excluded.opening,
         active = excluded.active,
         note = excluded.note`,
      [
        d.id,
        d.name,
        d.mobile,
        d.upiVpa,
        d.upiPayeeName,
        d.kind,
        d.baseSalary,
        d.dailyRate,
        d.opening,
        d.active,
        d.note,
      ],
    );
  }
  for (const v of snap.vendors ?? []) {
    await sql.query(
      `insert into vendors (id, name, upi_vpa, upi_payee_name) values ($1,$2,$3,$4)
       on conflict (id) do update set
         name = excluded.name,
         upi_vpa = CASE WHEN excluded.upi_vpa IS NULL OR excluded.upi_vpa = '' THEN vendors.upi_vpa ELSE excluded.upi_vpa END,
         upi_payee_name = CASE WHEN excluded.upi_payee_name IS NULL OR excluded.upi_payee_name = '' THEN vendors.upi_payee_name ELSE excluded.upi_payee_name END`,
      [v.id, v.name, v.upiVpa, v.upiPayeeName],
    );
  }
  for (const c of snap.customers ?? []) {
    await sql.query(
      `insert into customers (id, name, mobile, note) values ($1,$2,$3,$4)
       on conflict (id) do update set
         name = excluded.name,
         mobile = CASE WHEN excluded.mobile IS NULL OR excluded.mobile = '' THEN customers.mobile ELSE excluded.mobile END,
         note = excluded.note`,
      [c.id, c.name, c.mobile, c.note],
    );
  }

  /**
   * Transaction tables: UPSERT only (no DELETE ALL).
   * Multi-device safe — one phone cannot wipe another phone's new salary/expense rows.
   * Intentional deletes are applied via snap.deletedIds.
   */
  const deletedIds = Array.isArray((snap as { deletedIds?: string[] }).deletedIds)
    ? ((snap as { deletedIds?: string[] }).deletedIds as string[]).filter(Boolean)
    : [];
  for (const id of deletedIds) {
    for (const tbl of [
      "payouts",
      "expenses",
      "receipts",
      "rent_payments",
      "loan_payments",
      "bank_transfers",
      "attendances",
      "rent_waivers",
    ]) {
      try {
        await sql.query(`delete from ${tbl} where id = $1`, [id]);
      } catch {
        /* table / row may not exist */
      }
    }
  }

  for (const p of snap.payouts ?? []) {
    await sql.query(
      `insert into payouts (id, driver_id, kind, amount, date, mode, status, bank_account_id, upi_vpa, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         driver_id = excluded.driver_id,
         kind = excluded.kind,
         amount = excluded.amount,
         date = excluded.date,
         mode = excluded.mode,
         status = excluded.status,
         bank_account_id = excluded.bank_account_id,
         upi_vpa = excluded.upi_vpa,
         note = excluded.note`,
      [p.id, p.driverId, p.kind, p.amount, p.date, p.mode, p.status, p.bankAccountId, p.upiVpa, p.note, p.createdAt],
    );
  }
  for (const e of snap.expenses ?? []) {
    await sql.query(
      `insert into expenses (id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set
         category = excluded.category,
         vendor = excluded.vendor,
         amount = excluded.amount,
         date = excluded.date,
         mode = excluded.mode,
         status = excluded.status,
         bank_account_id = excluded.bank_account_id,
         upi_vpa = excluded.upi_vpa,
         fleet_id = excluded.fleet_id,
         note = excluded.note`,
      [e.id, e.category, e.vendor, e.amount, e.date, e.mode, e.status, e.bankAccountId, e.upiVpa, e.fleetId, e.note, e.createdAt],
    );
  }
  for (const r of snap.receipts ?? []) {
    await sql.query(
      `insert into receipts (id, customer_id, customer_name, amount, date, mode, status, bank_account_id, fleet_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         customer_id = excluded.customer_id,
         customer_name = excluded.customer_name,
         amount = excluded.amount,
         date = excluded.date,
         mode = excluded.mode,
         status = excluded.status,
         bank_account_id = excluded.bank_account_id,
         fleet_id = excluded.fleet_id,
         note = excluded.note`,
      [r.id, r.customerId, r.customerName, r.amount, r.date, r.mode, r.status, r.bankAccountId, r.fleetId, r.note, r.createdAt],
    );
  }
  for (const r of snap.rentPayments ?? []) {
    await sql.query(
      `insert into rent_payments (id, fleet_id, driver_id, amount, date, for_month, mode, status, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         fleet_id = excluded.fleet_id,
         driver_id = excluded.driver_id,
         amount = excluded.amount,
         date = excluded.date,
         for_month = excluded.for_month,
         mode = excluded.mode,
         status = excluded.status,
         note = excluded.note`,
      [r.id, r.fleetId, r.driverId, r.amount, r.date, r.forMonth, r.mode, r.status, r.note, r.createdAt],
    );
  }
  for (const a of snap.attendances ?? []) {
    await sql.query(
      `insert into attendances (id, driver_id, month, leave_days, note) values ($1,$2,$3,$4,$5)
       on conflict (id) do update set leave_days = excluded.leave_days, note = excluded.note`,
      [a.id, a.driverId, a.month, a.leaveDays, a.note],
    );
  }
  for (const w of snap.rentWaivers ?? []) {
    await sql.query(
      `insert into rent_waivers (id, fleet_id, month, breakdown_days, amount, note) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set breakdown_days = excluded.breakdown_days, amount = excluded.amount, note = excluded.note`,
      [w.id, w.fleetId, w.month, w.breakdownDays, w.amount, w.note],
    );
  }
  for (const p of snap.loanPayments ?? []) {
    await sql.query(
      `insert into loan_payments (id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         loan_id = excluded.loan_id,
         kind = excluded.kind,
         amount = excluded.amount,
         date = excluded.date,
         mode = excluded.mode,
         status = excluded.status,
         bank_account_id = excluded.bank_account_id,
         note = excluded.note`,
      [p.id, p.loanId, p.kind, p.amount, p.date, p.mode, p.status, p.bankAccountId, p.note, p.createdAt],
    );
  }
  for (const x of snap.bankTransfers ?? []) {
    try {
      await sql.query(
        `insert into bank_transfers (id, from_bank_id, to_bank_id, amount, date, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           from_bank_id = excluded.from_bank_id,
           to_bank_id = excluded.to_bank_id,
           amount = excluded.amount,
           date = excluded.date,
           note = excluded.note`,
        [x.id, x.fromBankId, x.toBankId, x.amount, x.date, x.note, x.createdAt],
      );
    } catch {
      /* table may not exist */
    }
  }
}

/** Quick empty-check used by loadFinanceFromDb. */
export async function countBanks(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ c: number }>(`select count(*)::int as c from banks`);
  return Number(rows[0]?.c ?? 0);
}

/** Wipe all finance rows (FK-safe order). Keeps schema. Manual / admin only. */
export async function clearFinanceTables(): Promise<void> {
  const sql = await getSql();
  const tables = [
    "loan_payments",
    "rent_waivers",
    "attendances",
    "rent_payments",
    "receipts",
    "expenses",
    "payouts",
    "bank_transfers",
    "customers",
    "vendors",
    "drivers",
    "loans",
    "fleets",
    "banks",
  ];
  for (const tbl of tables) {
    try {
      await sql.query(`delete from ${tbl}`);
    } catch {
      /* table may not exist */
    }
  }
}

/**
 * Server-only finance repository (Neon / PGLite via getSql).
 * Single-tenant — no user_id scoping.
 */
import { getSql } from "@/lib/db";
import type {
  Attendance,
  BankAccount,
  Customer,
  Driver,
  Expense,
  Fleet,
  FinanceSnapshot,
  Loan,
  LoanPayment,
  Payout,
  Receipt,
  RentPayment,
  RentWaiver,
  Vendor,
} from "./types";

export type { FinanceSnapshot };

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1;
}

function dateStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function countBanks(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ c: string | number }>(`select count(*)::int as c from banks`);
  return num(rows[0]?.c);
}

export async function loadFinanceSnapshot(): Promise<FinanceSnapshot> {
  const sql = await getSql();

  const [
    banks,
    fleets,
    loans,
    drivers,
    vendors,
    customers,
    payouts,
    expenses,
    receipts,
    rentPayments,
    loanPayments,
    attendances,
    rentWaivers,
  ] = await Promise.all([
    sql.query(`select id, name, is_default, opening from banks order by name`),
    sql.query(
      `select id, name, reg_no, kind, monthly_rent, active, loan_id, note from fleets order by name`,
    ),
    sql.query(
      `select id, name, bank, account_no, ifsc, principal, emi_amount, emi_day, total_emis,
              start_date, end_date, interest_rate, outstanding, pending_emis, status, fleet_id, note
       from loans order by name`,
    ),
    sql.query(
      `select id, name, mobile, kind, base_salary, daily_rate, active, upi_vpa, upi_payee_name,
              upi_updated_at, fleet_id, note from drivers order by name`,
    ),
    sql.query(`select id, name, upi_vpa, upi_payee_name from vendors order by name`),
    sql.query(`select id, name, mobile, note from customers order by name`),
    sql.query(
      `select id, driver_id, kind, amount, date, mode, status, bank_account_id, upi_vpa, note, created_at
       from payouts order by date desc, created_at desc`,
    ),
    sql.query(
      `select id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at
       from expenses order by date desc, created_at desc`,
    ),
    sql.query(
      `select id, customer_id, customer_name, amount, date, mode, status, bank_account_id, fleet_id, note, created_at
       from receipts order by date desc, created_at desc`,
    ),
    sql.query(
      `select id, fleet_id, driver_id, amount, date, for_month, mode, status, note, created_at
       from rent_payments order by date desc`,
    ),
    sql.query(
      `select id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at
       from loan_payments order by date desc`,
    ),
    sql.query(`select id, driver_id, month, leave_days, note from attendances`),
    sql.query(
      `select id, fleet_id, month, breakdown_days, amount, note from rent_waivers`,
    ),
  ]);

  return {
    banks: banks.map(
      (r): BankAccount => ({
        id: str(r.id),
        name: str(r.name),
        isDefault: bool(r.is_default),
        opening: num(r.opening),
      }),
    ),
    fleets: fleets.map(
      (r): Fleet => ({
        id: str(r.id),
        name: str(r.name),
        regNo: str(r.reg_no),
        kind: str(r.kind) as Fleet["kind"],
        monthlyRent: num(r.monthly_rent),
        active: bool(r.active),
        loanId: r.loan_id ? str(r.loan_id) : null,
        note: str(r.note),
      }),
    ),
    loans: loans.map(
      (r): Loan => ({
        id: str(r.id),
        name: str(r.name),
        bank: str(r.bank),
        accountNo: str(r.account_no),
        ifsc: str(r.ifsc),
        principal: num(r.principal),
        emiAmount: num(r.emi_amount),
        emiDay: num(r.emi_day),
        totalEmis: num(r.total_emis),
        startDate: dateStr(r.start_date),
        endDate: dateStr(r.end_date),
        interestRate: num(r.interest_rate),
        outstanding: num(r.outstanding),
        pendingEmis: num(r.pending_emis),
        status: str(r.status) as Loan["status"],
        fleetId: r.fleet_id ? str(r.fleet_id) : null,
        note: str(r.note),
      }),
    ),
    drivers: drivers.map(
      (r): Driver => ({
        id: str(r.id),
        name: str(r.name),
        mobile: str(r.mobile),
        kind: str(r.kind) as Driver["kind"],
        baseSalary: num(r.base_salary),
        dailyRate: num(r.daily_rate),
        active: bool(r.active),
        upiVpa: str(r.upi_vpa),
        upiPayeeName: str(r.upi_payee_name),
        upiUpdatedAt: isoOrNull(r.upi_updated_at),
        fleetId: r.fleet_id ? str(r.fleet_id) : null,
        note: str(r.note),
      }),
    ),
    vendors: vendors.map(
      (r): Vendor => ({
        id: str(r.id),
        name: str(r.name),
        upiVpa: str(r.upi_vpa),
        upiPayeeName: str(r.upi_payee_name),
      }),
    ),
    customers: customers.map(
      (r): Customer => ({
        id: str(r.id),
        name: str(r.name),
        mobile: str(r.mobile),
        note: str(r.note),
      }),
    ),
    payouts: payouts.map(
      (r): Payout => ({
        id: str(r.id),
        driverId: str(r.driver_id),
        kind: str(r.kind) as Payout["kind"],
        amount: num(r.amount),
        date: dateStr(r.date),
        mode: str(r.mode) as Payout["mode"],
        status: str(r.status) as Payout["status"],
        bankAccountId: str(r.bank_account_id),
        upiVpa: str(r.upi_vpa),
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || "",
      }),
    ),
    expenses: expenses.map(
      (r): Expense => ({
        id: str(r.id),
        category: str(r.category),
        vendor: str(r.vendor),
        amount: num(r.amount),
        date: dateStr(r.date),
        mode: str(r.mode) as Expense["mode"],
        status: str(r.status) as Expense["status"],
        bankAccountId: str(r.bank_account_id),
        upiVpa: str(r.upi_vpa),
        fleetId: r.fleet_id ? str(r.fleet_id) : null,
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || "",
      }),
    ),
    receipts: receipts.map(
      (r): Receipt => ({
        id: str(r.id),
        customerId: str(r.customer_id),
        customerName: str(r.customer_name),
        amount: num(r.amount),
        date: dateStr(r.date),
        mode: str(r.mode) as Receipt["mode"],
        status: str(r.status) as Receipt["status"],
        bankAccountId: str(r.bank_account_id),
        fleetId: r.fleet_id ? str(r.fleet_id) : null,
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || "",
      }),
    ),
    rentPayments: rentPayments.map(
      (r): RentPayment => ({
        id: str(r.id),
        fleetId: str(r.fleet_id),
        driverId: str(r.driver_id),
        amount: num(r.amount),
        date: dateStr(r.date),
        forMonth: str(r.for_month),
        mode: str(r.mode) as RentPayment["mode"],
        status: str(r.status) as RentPayment["status"],
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || "",
      }),
    ),
    loanPayments: loanPayments.map(
      (r): LoanPayment => ({
        id: str(r.id),
        loanId: str(r.loan_id),
        kind: str(r.kind) as LoanPayment["kind"],
        amount: num(r.amount),
        date: dateStr(r.date),
        mode: str(r.mode) as LoanPayment["mode"],
        status: str(r.status) as LoanPayment["status"],
        bankAccountId: str(r.bank_account_id),
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || "",
      }),
    ),
    attendances: attendances.map(
      (r): Attendance => ({
        id: str(r.id),
        driverId: str(r.driver_id),
        month: str(r.month),
        leaveDays: num(r.leave_days),
        note: str(r.note),
      }),
    ),
    rentWaivers: rentWaivers.map(
      (r): RentWaiver => ({
        id: str(r.id),
        fleetId: str(r.fleet_id),
        month: str(r.month),
        breakdownDays: num(r.breakdown_days),
        amount: num(r.amount),
        note: str(r.note),
      }),
    ),
  };
}

/** Delete every finance row (FK-safe order). Leaves schema intact. */
export async function clearFinanceTables(): Promise<void> {
  const sql = await getSql();
  await sql.query(`delete from attendances`);
  await sql.query(`delete from rent_waivers`);
  await sql.query(`delete from loan_payments`);
  await sql.query(`delete from rent_payments`);
  await sql.query(`delete from receipts`);
  await sql.query(`delete from expenses`);
  await sql.query(`delete from payouts`);
  await sql.query(`delete from drivers`);
  await sql.query(`delete from vendors`);
  await sql.query(`delete from customers`);
  await sql.query(`delete from fleets`);
  await sql.query(`delete from loans`);
  await sql.query(`delete from banks`);
}

/** Replace all finance rows with the given snapshot (transactional). */
export async function saveFinanceSnapshot(snap: FinanceSnapshot): Promise<void> {
  await clearFinanceTables();
  const sql = await getSql();

  for (const b of snap.banks) {
    await sql.query(
      `insert into banks (id, name, is_default, opening) values ($1, $2, $3, $4)`,
      [b.id, b.name, b.isDefault, b.opening],
    );
  }
  for (const l of snap.loans) {
    await sql.query(
      `insert into loans (
        id, name, bank, account_no, ifsc, principal, emi_amount, emi_day, total_emis,
        start_date, end_date, interest_rate, outstanding, pending_emis, status, fleet_id, note
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        l.id,
        l.name,
        l.bank,
        l.accountNo,
        l.ifsc,
        l.principal,
        l.emiAmount,
        l.emiDay,
        l.totalEmis,
        l.startDate || null,
        l.endDate || null,
        l.interestRate,
        l.outstanding,
        l.pendingEmis,
        l.status,
        l.fleetId,
        l.note,
      ],
    );
  }
  for (const f of snap.fleets) {
    await sql.query(
      `insert into fleets (id, name, reg_no, kind, monthly_rent, active, loan_id, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [f.id, f.name, f.regNo, f.kind, f.monthlyRent, f.active, f.loanId, f.note],
    );
  }
  for (const d of snap.drivers) {
    await sql.query(
      `insert into drivers (
        id, name, mobile, kind, base_salary, daily_rate, active,
        upi_vpa, upi_payee_name, upi_updated_at, fleet_id, note
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        d.id,
        d.name,
        d.mobile,
        d.kind,
        d.baseSalary,
        d.dailyRate,
        d.active,
        d.upiVpa,
        d.upiPayeeName,
        d.upiUpdatedAt,
        d.fleetId,
        d.note,
      ],
    );
  }
  for (const v of snap.vendors) {
    await sql.query(
      `insert into vendors (id, name, upi_vpa, upi_payee_name) values ($1,$2,$3,$4)`,
      [v.id, v.name, v.upiVpa, v.upiPayeeName],
    );
  }
  for (const c of snap.customers) {
    await sql.query(
      `insert into customers (id, name, mobile, note) values ($1,$2,$3,$4)`,
      [c.id, c.name, c.mobile, c.note],
    );
  }
  for (const p of snap.payouts) {
    await sql.query(
      `insert into payouts (
        id, driver_id, kind, amount, date, mode, status, bank_account_id, upi_vpa, note, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz, now()))`,
      [
        p.id,
        p.driverId,
        p.kind,
        p.amount,
        p.date,
        p.mode,
        p.status,
        p.bankAccountId,
        p.upiVpa,
        p.note,
        p.createdAt || null,
      ],
    );
  }
  for (const e of snap.expenses) {
    await sql.query(
      `insert into expenses (
        id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz, now()))`,
      [
        e.id,
        e.category,
        e.vendor,
        e.amount,
        e.date,
        e.mode,
        e.status,
        e.bankAccountId,
        e.upiVpa,
        e.fleetId,
        e.note,
        e.createdAt || null,
      ],
    );
  }
  for (const r of snap.receipts) {
    await sql.query(
      `insert into receipts (
        id, customer_id, customer_name, amount, date, mode, status, bank_account_id, fleet_id, note, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz, now()))`,
      [
        r.id,
        r.customerId,
        r.customerName,
        r.amount,
        r.date,
        r.mode,
        r.status,
        r.bankAccountId,
        r.fleetId,
        r.note,
        r.createdAt || null,
      ],
    );
  }
  for (const r of snap.rentPayments) {
    await sql.query(
      `insert into rent_payments (
        id, fleet_id, driver_id, amount, date, for_month, mode, status, note, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10::timestamptz, now()))`,
      [
        r.id,
        r.fleetId,
        r.driverId,
        r.amount,
        r.date,
        r.forMonth,
        r.mode,
        r.status,
        r.note,
        r.createdAt || null,
      ],
    );
  }
  for (const lp of snap.loanPayments) {
    await sql.query(
      `insert into loan_payments (
        id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10::timestamptz, now()))`,
      [
        lp.id,
        lp.loanId,
        lp.kind,
        lp.amount,
        lp.date,
        lp.mode,
        lp.status,
        lp.bankAccountId,
        lp.note,
        lp.createdAt || null,
      ],
    );
  }
  for (const a of snap.attendances) {
    await sql.query(
      `insert into attendances (id, driver_id, month, leave_days, note) values ($1,$2,$3,$4,$5)`,
      [a.id, a.driverId, a.month, a.leaveDays, a.note],
    );
  }
  for (const w of snap.rentWaivers) {
    await sql.query(
      `insert into rent_waivers (id, fleet_id, month, breakdown_days, amount, note)
       values ($1,$2,$3,$4,$5,$6)`,
      [w.id, w.fleetId, w.month, w.breakdownDays, w.amount, w.note],
    );
  }
}

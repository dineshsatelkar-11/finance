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

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}
function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === "t" || v === "true" || v === 1 || v === "1") return true;
  return false;
}
function dateStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v as string).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
function isoOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  try {
    return new Date(v as string).toISOString();
  } catch {
    return null;
  }
}

/** One-time data repair: rows present in 2026-09-30 backup but wiped from Neon. INSERT only. */
async function ensureRestoredMissingRowsInDb(): Promise<void> {
  const sql = await getSql();
  const expenses = [
    {"id": "ex_f1kguzpd7386", "category": "Maintenance", "vendor": "", "amount": 200, "date": "2026-09-16", "mode": "upi", "status": "paid", "bankAccountId": "bank_47vo5fspkd", "upiVpa": "", "fleetId": "", "note": "Washing", "createdAt": "2026-09-16T12:00:00.000Z"},
    {"id": "ex_mby5zbkt51tf", "category": "Maintenance", "vendor": "", "amount": 700, "date": "2026-09-14", "mode": "upi", "status": "paid", "bankAccountId": "bank_47vo5fspkd", "upiVpa": "", "fleetId": "", "note": "Handle work", "createdAt": "2026-09-14T12:00:00.000Z"},
    {"id": "exp_stmt_20260911_test_1", "category": "Other", "vendor": "", "amount": 1, "date": "2026-09-11", "mode": "upi", "status": "paid", "bankAccountId": "bank_wsb_current_0498", "upiVpa": "", "fleetId": "", "note": "\u20b91 testing \u00b7 statement", "createdAt": "2026-09-11T12:00:00.000Z"},
    {"id": "ex_3cpy6ipg32zn", "category": "Other", "vendor": "", "amount": 111, "date": "2026-09-09", "mode": "upi", "status": "paid", "bankAccountId": "bank_u6js9w5oba", "upiVpa": "", "fleetId": "", "note": "", "createdAt": "2026-09-09T12:00:00.000Z"},
    {"id": "ex_wawilvo7pckh", "category": "Other", "vendor": "", "amount": 58000, "date": "2026-09-09", "mode": "upi", "status": "paid", "bankAccountId": "bank_u6js9w5oba", "upiVpa": "", "fleetId": "", "note": "Lakshmi Bajaj For down payment", "createdAt": "2026-09-09T12:00:00.000Z"},
    {"id": "ex_ckulenvdzgfx", "category": "Other", "vendor": "", "amount": 179, "date": "2026-09-01", "mode": "upi", "status": "paid", "bankAccountId": "bank_u6js9w5oba", "upiVpa": "", "fleetId": "", "note": "", "createdAt": "2026-09-01T12:00:00.000Z"},
    {"id": "exp_cc_gst_20260825", "category": "Other", "vendor": "", "amount": 16, "date": "2026-08-25", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_cc_000001", "upiVpa": "", "fleetId": "", "note": "GST \u00b7 cheque book 1\u201345 \u00b7 CC statement", "createdAt": "2026-08-25T12:00:00.000Z"},
  ] as const;
  const transfers = [
    {"id": "xfer_11tncsucyybo", "fromBankId": "bank_wsb_cc_000001", "toBankId": "bank_wsb_current_0498", "amount": 10000, "date": "2026-09-28", "note": "", "createdAt": "2026-09-28T04:28:24.000Z"},
    {"id": "xfer_extdt2o6klfn", "fromBankId": "bank_wsb_cc_000001", "toBankId": "bank_wsb_current_0498", "amount": 100000, "date": "2026-09-24", "note": "", "createdAt": "2026-09-24T12:00:00.000Z"},
    {"id": "xfer_her3jezemvqh", "fromBankId": "bank_wsb_current_0498", "toBankId": "bank_u6js9w5oba", "amount": 80000, "date": "2026-09-24", "note": "", "createdAt": "2026-09-24T12:00:00.000Z"},
    {"id": "xfer_sjqdougklss2", "fromBankId": "bank_wsb_current_0498", "toBankId": "bank_u6js9w5oba", "amount": 10000, "date": "2026-09-24", "note": "", "createdAt": "2026-09-24T12:00:00.000Z"},
    {"id": "xfer_55in74mqmbp0", "fromBankId": "bank_wsb_current_0498", "toBankId": "bank_u6js9w5oba", "amount": 10000, "date": "2026-09-24", "note": "", "createdAt": "2026-09-24T12:00:00.000Z"},
    {"id": "xfer_cc_to_cur_5k_20260921", "fromBankId": "bank_wsb_cc_000001", "toBankId": "bank_wsb_current_0498", "amount": 5000, "date": "2026-09-21", "note": "OWN CC \u2192 Current \u00b7 statement", "createdAt": "2026-09-21T12:00:00.000Z"},
  ] as const;
  const loanPays = [
    {"id": "lp_stmt_emi_000014_20260917", "loanId": "loan_wsb_000014", "kind": "emi", "amount": 8149, "date": "2026-09-17", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_current_0498", "note": "SI EMI \u00b7 \u2026000014 \u00b7 statement", "createdAt": "2026-09-17T14:00:00.000Z"},
    {"id": "lp_stmt_emi_000010_20260917", "loanId": "loan_wsb_000010", "kind": "emi", "amount": 7960, "date": "2026-09-17", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_current_0498", "note": "SI EMI \u00b7 \u2026000010 \u00b7 statement", "createdAt": "2026-09-17T14:00:00.000Z"},
    {"id": "lp_stmt_emi_000012_20260917", "loanId": "loan_wsb_000012", "kind": "emi", "amount": 7960, "date": "2026-09-17", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_current_0498", "note": "SI EMI \u00b7 \u2026000012 \u00b7 statement", "createdAt": "2026-09-17T14:00:00.000Z"},
    {"id": "lp_stmt_wsb015_disb_20260909", "loanId": "loan_wsb_000015", "kind": "disbursement", "amount": 398000, "date": "2026-09-09", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_current_0498", "note": "Loan disbursement \u2192 Current \u00b7 statement \u00b7 then Laxmi Motors RTGS", "createdAt": "2026-09-09T10:00:00.000Z"},
  ] as const;
  const receipts = [
    {"id": "rc_hvoq42xmiz5h", "customerId": "cust_0zgkt8z4ptc6", "customerName": "Its Baked", "amount": 125000, "date": "2026-09-19", "mode": "bank", "status": "paid", "bankAccountId": "bank_wsb_cc_000001", "fleetId": "", "note": "Aug Month Payment", "createdAt": "2026-09-25T03:56:58.000Z"},
  ] as const;

  for (const e of expenses) {
    try {
      await sql.query(
        `insert into expenses (id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do nothing`,
        [e.id, e.category, e.vendor || "", e.amount, e.date, e.mode, e.status, e.bankAccountId || "", e.upiVpa || "", e.fleetId || "", e.note || "", e.createdAt],
      );
    } catch { /* ignore */ }
  }
  for (const x of transfers) {
    try {
      await sql.query(
        `insert into bank_transfers (id, from_bank_id, to_bank_id, amount, date, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do nothing`,
        [x.id, x.fromBankId, x.toBankId, x.amount, x.date, x.note || "", x.createdAt],
      );
    } catch { /* ignore */ }
  }
  for (const p of loanPays) {
    try {
      await sql.query(
        `insert into loan_payments (id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (id) do nothing`,
        [p.id, p.loanId, p.kind, p.amount, p.date, p.mode, p.status, p.bankAccountId || "", p.note || "", p.createdAt],
      );
    } catch { /* ignore */ }
  }
  for (const r of receipts) {
    try {
      await sql.query(
        `insert into receipts (id, customer_id, customer_name, amount, date, mode, status, bank_account_id, fleet_id, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do nothing`,
        [r.id, r.customerId || "", r.customerName || "", r.amount, r.date, r.mode, r.status, r.bankAccountId || "", r.fleetId || "", r.note || "", r.createdAt],
      );
    } catch { /* ignore */ }
  }
}

export async function loadFinanceSnapshot(): Promise<FinanceSnapshot> {
  try {
    await ensureRestoredMissingRowsInDb();
  } catch {
    /* non-fatal */
  }
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
    attendances,
    rentWaivers,
    loanPayments,
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
      `select id, name, mobile, kind, base_salary, daily_rate, opening_balance, active, upi_vpa, upi_payee_name,
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
       from rent_payments order by date desc, created_at desc`,
    ),
    sql.query(`select id, driver_id, month, leave_days, note from attendances`),
    sql.query(`select id, fleet_id, month, breakdown_days, amount, note from rent_waivers`),
    sql.query(
      `select id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at
       from loan_payments order by date desc, created_at desc`,
    ),
  ]);

  let bankTransfers: BankTransfer[] = [];
  try {
    const bankTransferRows = await sql.query(
      `select id, from_bank_id, to_bank_id, amount, date, note, created_at from bank_transfers order by date desc`,
    );
    bankTransfers = bankTransferRows.map((r) => ({
      id: str(r.id),
      fromBankId: str(r.from_bank_id),
      toBankId: str(r.to_bank_id),
      amount: num(r.amount),
      date: dateStr(r.date),
      note: str(r.note),
      createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
    }));
  } catch {
    bankTransfers = [];
  }

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
        openingBalance: num(r.opening_balance),
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
        createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
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
        fleetId: str(r.fleet_id),
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
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
        fleetId: str(r.fleet_id),
        note: str(r.note),
        createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
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
        createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
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
        createdAt: isoOrNull(r.created_at) || new Date().toISOString(),
      }),
    ),
    bankTransfers,
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
         name = excluded.name, reg_no = excluded.reg_no, kind = excluded.kind,
         monthly_rent = excluded.monthly_rent, active = excluded.active,
         loan_id = excluded.loan_id, note = excluded.note`,
      [f.id, f.name, f.regNo, f.kind, f.monthlyRent, f.active, f.loanId, f.note],
    );
  }
  for (const l of snap.loans ?? []) {
    await sql.query(
      `insert into loans (id, name, bank, account_no, ifsc, principal, emi_amount, emi_day, total_emis,
        start_date, end_date, interest_rate, outstanding, pending_emis, status, fleet_id, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (id) do update set
         name = excluded.name, bank = excluded.bank, account_no = excluded.account_no, ifsc = excluded.ifsc,
         principal = excluded.principal, emi_amount = excluded.emi_amount, emi_day = excluded.emi_day,
         total_emis = excluded.total_emis, start_date = excluded.start_date, end_date = excluded.end_date,
         interest_rate = excluded.interest_rate, outstanding = excluded.outstanding,
         pending_emis = excluded.pending_emis, status = excluded.status, fleet_id = excluded.fleet_id,
         note = excluded.note`,
      [l.id, l.name, l.bank, l.accountNo, l.ifsc, l.principal, l.emiAmount, l.emiDay, l.totalEmis,
        l.startDate, l.endDate, l.interestRate, l.outstanding, l.pendingEmis, l.status, l.fleetId, l.note],
    );
  }
  for (const d of snap.drivers ?? []) {
    await sql.query(
      `insert into drivers (id, name, mobile, kind, base_salary, daily_rate, opening_balance, active,
        upi_vpa, upi_payee_name, upi_updated_at, fleet_id, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (id) do update set
         name = excluded.name,
         mobile = case when excluded.mobile = '' then drivers.mobile else excluded.mobile end,
         kind = excluded.kind,
         base_salary = excluded.base_salary,
         daily_rate = excluded.daily_rate,
         opening_balance = excluded.opening_balance,
         active = excluded.active,
         upi_vpa = case when excluded.upi_vpa = '' then drivers.upi_vpa else excluded.upi_vpa end,
         upi_payee_name = case when excluded.upi_payee_name = '' then drivers.upi_payee_name else excluded.upi_payee_name end,
         upi_updated_at = excluded.upi_updated_at,
         fleet_id = excluded.fleet_id,
         note = excluded.note`,
      [d.id, d.name, d.mobile || "", d.kind, d.baseSalary, d.dailyRate, d.openingBalance, d.active,
        d.upiVpa || "", d.upiPayeeName || "", d.upiUpdatedAt, d.fleetId, d.note],
    );
  }
  for (const v of snap.vendors ?? []) {
    await sql.query(
      `insert into vendors (id, name, upi_vpa, upi_payee_name) values ($1,$2,$3,$4)
       on conflict (id) do update set
         name = excluded.name,
         upi_vpa = case when excluded.upi_vpa = '' then vendors.upi_vpa else excluded.upi_vpa end,
         upi_payee_name = case when excluded.upi_payee_name = '' then vendors.upi_payee_name else excluded.upi_payee_name end`,
      [v.id, v.name, v.upiVpa || "", v.upiPayeeName || ""],
    );
  }
  for (const c of snap.customers ?? []) {
    await sql.query(
      `insert into customers (id, name, mobile, note) values ($1,$2,$3,$4)
       on conflict (id) do update set name = excluded.name, mobile = excluded.mobile, note = excluded.note`,
      [c.id, c.name, c.mobile, c.note],
    );
  }

  const deleted = new Set(snap.deletedIds ?? []);
  for (const id of deleted) {
    for (const tbl of ["payouts", "expenses", "receipts", "rent_payments", "loan_payments", "bank_transfers"] as const) {
      try {
        await sql.query(`delete from ${tbl} where id = $1`, [id]);
      } catch { /* ignore */ }
    }
  }

  for (const p of snap.payouts ?? []) {
    if (deleted.has(p.id)) continue;
    await sql.query(
      `insert into payouts (id, driver_id, kind, amount, date, mode, status, bank_account_id, upi_vpa, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         driver_id = excluded.driver_id, kind = excluded.kind, amount = excluded.amount, date = excluded.date,
         mode = excluded.mode, status = excluded.status, bank_account_id = excluded.bank_account_id,
         upi_vpa = excluded.upi_vpa, note = excluded.note`,
      [p.id, p.driverId, p.kind, p.amount, p.date, p.mode, p.status, p.bankAccountId, p.upiVpa, p.note, p.createdAt],
    );
  }
  for (const e of snap.expenses ?? []) {
    if (deleted.has(e.id)) continue;
    await sql.query(
      `insert into expenses (id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set
         category = excluded.category, vendor = excluded.vendor, amount = excluded.amount, date = excluded.date,
         mode = excluded.mode, status = excluded.status, bank_account_id = excluded.bank_account_id,
         upi_vpa = excluded.upi_vpa, fleet_id = excluded.fleet_id, note = excluded.note`,
      [e.id, e.category, e.vendor, e.amount, e.date, e.mode, e.status, e.bankAccountId, e.upiVpa, e.fleetId, e.note, e.createdAt],
    );
  }
  for (const r of snap.receipts ?? []) {
    if (deleted.has(r.id)) continue;
    await sql.query(
      `insert into receipts (id, customer_id, customer_name, amount, date, mode, status, bank_account_id, fleet_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         customer_id = excluded.customer_id, customer_name = excluded.customer_name, amount = excluded.amount,
         date = excluded.date, mode = excluded.mode, status = excluded.status,
         bank_account_id = excluded.bank_account_id, fleet_id = excluded.fleet_id, note = excluded.note`,
      [r.id, r.customerId, r.customerName, r.amount, r.date, r.mode, r.status, r.bankAccountId, r.fleetId, r.note, r.createdAt],
    );
  }
  for (const a of snap.attendances ?? []) {
    await sql.query(
      `insert into attendances (id, driver_id, month, leave_days, note) values ($1,$2,$3,$4,$5)
       on conflict (id) do update set driver_id = excluded.driver_id, month = excluded.month,
         leave_days = excluded.leave_days, note = excluded.note`,
      [a.id, a.driverId, a.month, a.leaveDays, a.note],
    );
  }
  for (const p of snap.loanPayments ?? []) {
    if (deleted.has(p.id)) continue;
    await sql.query(
      `insert into loan_payments (id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         loan_id = excluded.loan_id, kind = excluded.kind, amount = excluded.amount, date = excluded.date,
         mode = excluded.mode, status = excluded.status, bank_account_id = excluded.bank_account_id,
         note = excluded.note`,
      [p.id, p.loanId, p.kind, p.amount, p.date, p.mode, p.status, p.bankAccountId, p.note, p.createdAt],
    );
  }
  for (const x of snap.bankTransfers ?? []) {
    if (deleted.has(x.id)) continue;
    try {
      await sql.query(
        `insert into bank_transfers (id, from_bank_id, to_bank_id, amount, date, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           from_bank_id = excluded.from_bank_id, to_bank_id = excluded.to_bank_id,
           amount = excluded.amount, date = excluded.date, note = excluded.note`,
        [x.id, x.fromBankId, x.toBankId, x.amount, x.date, x.note, x.createdAt],
      );
    } catch {
      /* table may not exist */
    }
  }
}

export async function countBanks(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ c: number }>(`select count(*)::int as c from banks`);
  return Number(rows[0]?.c ?? 0);
}

export async function clearFinanceTables(): Promise<void> {
  const sql = await getSql();
  const tables = [
    "loan_payments", "rent_waivers", "attendances", "rent_payments", "receipts",
    "expenses", "payouts", "bank_transfers", "customers", "vendors",
    "drivers", "loans", "fleets", "banks",
  ];
  for (const tbl of tables) {
    try {
      await sql.query(`delete from ${tbl}`);
    } catch {
      /* table may not exist */
    }
  }
}

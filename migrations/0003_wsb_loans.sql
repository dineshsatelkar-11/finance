-- Seed existing Warana Sahakari Bank (WSB) Mini commercial vehicle loans
-- from account statements (Customer ID 554827, as of 06-Sep-2026).
-- Idempotent: safe to re-run.

insert into loans (
  id, name, bank, account_no, ifsc,
  principal, emi_amount, emi_day, total_emis,
  start_date, end_date, interest_rate,
  outstanding, pending_emis, status, fleet_id, note
)
values
(
  'loan_wsb_000010',
  'WSB Mini — A/c …000010',
  'Warana Sahakari Bank (HDFC0CSWSBL)',
  '3970254350000010',
  'HDFC0CSWSBL',
  379000,
  7960,
  19,
  60,
  '2025-11-19',
  '2030-11-19',
  9.50,
  332658,
  59,
  'active',
  null,
  'SATELKARS LOGISTIC · Customer ID 554827 · NEW VEHICLE LOAN COMMERCIAL · Gultekadi Pune · Sanction 19/11/2025 · Disburse 379000'
),
(
  'loan_wsb_000012',
  'WSB Mini — A/c …000012',
  'Warana Sahakari Bank (HDFC0CSWSBL)',
  '3970254350000012',
  'HDFC0CSWSBL',
  379000,
  7960,
  13,
  60,
  '2026-01-13',
  '2031-01-13',
  9.50,
  342955,
  59,
  'active',
  null,
  'SATELKARS LOGISTIC · Customer ID 554827 · NEW VEHICLE LOAN COMMERCIAL · Gultekadi Pune · Sanction 09/01/2026 · Disburse 13/01/2026 · 379000'
),
(
  'loan_wsb_000014',
  'WSB Mini — A/c …000014',
  'Warana Sahakari Bank (HDFC0CSWSBL)',
  '3970254350000014',
  'HDFC0CSWSBL',
  388000,
  8149,
  15,
  60,
  '2026-05-15',
  '2031-05-15',
  9.50,
  372616,
  59,
  'active',
  null,
  'SATELKARS LOGISTIC · Customer ID 554827 · NEW VEHICLE LOAN COMMERCIAL · Gultekadi Pune · Sanction 15/05/2026 · Disburse 388000'
)
on conflict (id) do update set
  name = excluded.name,
  bank = excluded.bank,
  account_no = excluded.account_no,
  ifsc = excluded.ifsc,
  principal = excluded.principal,
  emi_amount = excluded.emi_amount,
  emi_day = excluded.emi_day,
  total_emis = excluded.total_emis,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  interest_rate = excluded.interest_rate,
  outstanding = excluded.outstanding,
  pending_emis = excluded.pending_emis,
  status = excluded.status,
  note = excluded.note;

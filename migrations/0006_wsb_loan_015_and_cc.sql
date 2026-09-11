-- WSB Mini vehicle loan …000015 + Warana Cash Credit …000001
-- From statements Customer ID 554827 (11-Sep-2026). Idempotent.

insert into loans (
  id, name, bank, account_no, ifsc,
  principal, emi_amount, emi_day, total_emis,
  start_date, end_date, interest_rate,
  outstanding, pending_emis, status, fleet_id, note
)
values (
  'loan_wsb_000015',
  'WSB Mini — A/c …000015',
  'Warana Sahakari Bank (HDFC0CSWSBL)',
  '3970254350000015',
  'HDFC0CSWSBL',
  398000,
  8359,
  9,
  60,
  '2026-09-09',
  '2031-09-09',
  9.50,
  398000,
  59,
  'active',
  null,
  'SATELKARS LOGISTIC · Customer ID 554827 · NEW VEHICLE LOAN COMMERCIAL · Gultekadi Pune · Sanction/Disburse 09/09/2026 · 398000 · EMI starts 09/10/2026 · Rate 9.50%'
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

-- Cash Credit A/c …000001 — drawn ~20,206.20 as of 11-Sep-2026 mini statement
-- (GST 16.2 + cheque 90 + transfers to current 100+10000+10000). Negative = drawn/OD.
insert into banks (id, name, is_default, opening)
values (
  'bank_wsb_cc_000001',
  'Warana CC · …000001',
  false,
  -20206.20
)
on conflict (id) do update set
  name = excluded.name,
  opening = excluded.opening;

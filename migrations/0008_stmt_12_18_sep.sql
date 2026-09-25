-- Warana statement 12-Sep to 18-Sep (Customer 554827).
-- Add-only. Safe to re-run.

-- Drivers
insert into drivers (id, name, mobile, kind, base_salary, daily_rate, opening_balance, active, upi_vpa, upi_payee_name, fleet_id, note)
values
  ('drv_sandeep', 'Sandeep', '', 'full', 0, 0, 0, true, '', '', null, 'alias Balaji'),
  ('drv_anand', 'Anand', '', 'full', 0, 0, 0, true, '', '', null, 'alias Mohan'),
  ('drv_vikas', 'Vikas', '', 'full', 0, 0, 0, true, '', '', null, 'alias Dnyaneshwar'),
  ('drv_ballu', 'Ballu', '', 'full', 0, 0, 0, true, '', '', null, 'alias AVI')
on conflict (id) do nothing;

-- Banks
insert into banks (id, name, is_default, opening)
values
  ('bank_warana_current', 'Warana Current', true, 11390),
  ('bank_bajaj', 'Bajaj', false, 0)
on conflict (id) do nothing;

-- Seed note only — actual txn rows are client-side ensure on hydrate (sync.ts)
-- This migration documents the period; do not delete existing rows.

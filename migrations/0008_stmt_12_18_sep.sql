-- Warana statement 12-Sep → 18-Sep (Customer 554827).
-- Add-only inserts. EMI outstanding reduced only while pending_emis still at seed (>=59).

insert into drivers (id, name, mobile, kind, base_salary, daily_rate, opening_balance, active, upi_vpa, upi_payee_name, note)
values
  ('drv_vivek', 'Vivek', '', 'full', 0, 0, 0, true, '', 'Vivek', 'From Warana statement import'),
  ('drv_vikas', 'Vikas', '', 'full', 0, 0, 0, true, '', 'Vikas', 'From Warana statement import'),
  ('drv_ballu', 'Ballu', '', 'full', 0, 0, 0, true, '', 'Ballu', 'From Warana statement import'),
  ('drv_devraj', 'Devraj', '', 'full', 0, 0, 0, true, '', 'Devraj', 'From Warana statement import')
on conflict (id) do nothing;

insert into banks (id, name, is_default, opening)
values
  ('bank_wsb_current_0498', 'Warana Current · …0498', false, 11390),
  ('bank_wsb_cc_000001', 'Warana CC · …000001', false, 0)
on conflict (id) do nothing;

insert into payouts (id, driver_id, kind, amount, date, mode, status, bank_account_id, upi_vpa, note, created_at)
values
  ('po_stmt_20260912_vivek_er_250', 'drv_vivek', 'extra_route', 250, '2026-09-12', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Master Vivek · extra route · statement', '2026-09-12T12:00:00Z'),
  ('po_stmt_20260912_vikas_er_250', 'drv_vikas', 'extra_route', 250, '2026-09-12', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Maruti Biradar/Vikas · extra route · statement', '2026-09-12T12:00:00Z'),
  ('po_stmt_20260912_ballu_er_1250', 'drv_ballu', 'extra_route', 1250, '2026-09-12', 'upi', 'paid', 'bank_wsb_current_0498', '', 'AVI Servicing → Ballu extra route · statement', '2026-09-12T12:00:00Z'),
  ('po_stmt_20260915_vivek_er_250_a', 'drv_vivek', 'extra_route', 250, '2026-09-15', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Master Vivek · extra route · statement', '2026-09-15T12:00:00Z'),
  ('po_stmt_20260915_vivek_er_250_b', 'drv_vivek', 'extra_route', 250, '2026-09-15', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Master Vivek · extra route · statement', '2026-09-15T12:30:00Z'),
  ('po_stmt_20260915_vikas_er_250_a', 'drv_vikas', 'extra_route', 250, '2026-09-15', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Vikas · extra route · statement', '2026-09-15T12:00:00Z'),
  ('po_stmt_20260915_vikas_er_250_b', 'drv_vikas', 'extra_route', 250, '2026-09-15', 'upi', 'paid', 'bank_wsb_current_0498', '', 'UPI Vikas · extra route · statement', '2026-09-15T12:30:00Z'),
  ('po_stmt_20260916_vikas_adv_9000', 'drv_vikas', 'advance', 9000, '2026-09-16', 'upi', 'paid', 'bank_wsb_current_0498', '', 'Deepa → Vikas advance · statement', '2026-09-16T12:00:00Z'),
  ('po_stmt_20260917_devraj_er_1500', 'drv_devraj', 'extra_route', 1500, '2026-09-17', 'upi', 'paid', 'bank_wsb_current_0498', '', 'KOLI Devraj · extra route · statement', '2026-09-17T12:00:00Z'),
  ('po_stmt_20260918_vivek_adv_300', 'drv_vivek', 'advance', 300, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', 'Mane Rajkiran → Vivek advance · statement', '2026-09-18T12:00:00Z')
on conflict (id) do nothing;

insert into expenses (id, category, vendor, amount, date, mode, status, bank_account_id, upi_vpa, fleet_id, note, created_at)
values
  ('exp_stmt_20260917_tempo_pickup_200', 'Other', 'Tempo pickup & drop', 200, '2026-09-17', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'MH12ZP2301 · tempo pickup & drop · Vivek Nashta · statement', '2026-09-17T12:00:00Z'),
  ('exp_stmt_20260917_tempo_pickup_100', 'Other', 'Tempo pickup & drop', 100, '2026-09-17', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'MH12ZP2301 · tempo pickup & drop · Vivek Master · statement', '2026-09-17T12:15:00Z'),
  ('exp_stmt_20260917_tempo_pickup_300', 'Other', 'Tempo pickup & drop', 300, '2026-09-17', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'MH12ZP2301 · tempo pickup & drop · Vivek Master · statement', '2026-09-17T12:30:00Z'),
  ('exp_stmt_20260918_tempo_pickup_300', 'Other', 'Tempo pickup & drop', 300, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'MH12ZP2301 · tempo pickup & drop · Vivek Master · statement', '2026-09-18T12:00:00Z'),
  ('exp_stmt_20260918_prakash_1', 'Other', 'Prakash', 1, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'Prakash · tempo body · statement', '2026-09-18T12:00:00Z'),
  ('exp_stmt_20260918_prakash_varma_20000', 'Other', 'Prakash Varma', 20000, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'Prakash Varma · tempo body · statement', '2026-09-18T12:15:00Z'),
  ('exp_stmt_20260918_prakash_varma_10499', 'Other', 'Prakash Varma', 10499, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'Prakash Varma · tempo body · statement', '2026-09-18T12:30:00Z'),
  ('exp_stmt_20260918_mane_number_plate_500', 'Other', 'Mane Rajkiran', 500, '2026-09-18', 'upi', 'paid', 'bank_wsb_current_0498', '', null, 'Tempo number plate · statement', '2026-09-18T12:45:00Z')
on conflict (id) do nothing;

insert into bank_transfers (id, from_bank_id, to_bank_id, amount, date, note, created_at)
values
  ('xfer_own_to_cur_10k_20260916', 'bank_wsb_cc_000001', 'bank_wsb_current_0498', 10000, '2026-09-16', 'OWN ADVANCE → Current · statement', '2026-09-16T12:00:00Z'),
  ('xfer_own_to_cur_31k_20260916', 'bank_wsb_cc_000001', 'bank_wsb_current_0498', 31000, '2026-09-16', 'OWN MACRO BODY → Current · statement', '2026-09-16T12:30:00Z'),
  ('xfer_own_to_cur_25k_20260918', 'bank_wsb_cc_000001', 'bank_wsb_current_0498', 25000, '2026-09-18', 'OWN → Current · statement', '2026-09-18T12:00:00Z'),
  ('xfer_own_to_cur_2k_20260918', 'bank_wsb_cc_000001', 'bank_wsb_current_0498', 2000, '2026-09-18', 'OWN → Current · statement', '2026-09-18T12:30:00Z')
on conflict (id) do nothing;

insert into loan_payments (id, loan_id, kind, amount, date, mode, status, bank_account_id, note, created_at)
values
  ('lp_stmt_emi_000010_20260917', 'loan_wsb_000010', 'emi', 7960, '2026-09-17', 'bank', 'paid', 'bank_wsb_current_0498', 'SI EMI · …000010 · statement', '2026-09-17T14:00:00Z'),
  ('lp_stmt_emi_000012_20260917', 'loan_wsb_000012', 'emi', 7960, '2026-09-17', 'bank', 'paid', 'bank_wsb_current_0498', 'SI EMI · …000012 · statement', '2026-09-17T14:00:00Z'),
  ('lp_stmt_emi_000014_20260917', 'loan_wsb_000014', 'emi', 8149, '2026-09-17', 'bank', 'paid', 'bank_wsb_current_0498', 'SI EMI · …000014 · statement', '2026-09-17T14:00:00Z')
on conflict (id) do nothing;

-- Mark EMI deducted once (seed pending_emis was 59)
update loans set
  outstanding = greatest(0, coalesce(outstanding, 0) - 7960),
  pending_emis = greatest(0, coalesce(pending_emis, 0) - 1)
where id = 'loan_wsb_000010' and coalesce(pending_emis, 0) >= 59;

update loans set
  outstanding = greatest(0, coalesce(outstanding, 0) - 7960),
  pending_emis = greatest(0, coalesce(pending_emis, 0) - 1)
where id = 'loan_wsb_000012' and coalesce(pending_emis, 0) >= 59;

update loans set
  outstanding = greatest(0, coalesce(outstanding, 0) - 8149),
  pending_emis = greatest(0, coalesce(pending_emis, 0) - 1)
where id = 'loan_wsb_000014' and coalesce(pending_emis, 0) >= 59;

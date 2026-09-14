-- Warana Current opening = end of 26-Aug-2026 statement balance (₹11,390.30 → stored as 11390).
-- Statement rows 27-Aug → 04-Sep are seeded client-side on hydrate (fixed ids in sync.ts).

insert into banks (id, name, is_default, opening)
values (
  'bank_wsb_current_0498',
  'Warana Current · …0498',
  false,
  11390
)
on conflict (id) do update set
  name = excluded.name,
  opening = excluded.opening;

-- If an older Warana current-style bank exists under another id, leave it;
-- client ensureWsbLoan015AndCc will set opening 11390 on the matched bank.

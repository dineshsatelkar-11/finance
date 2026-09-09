-- Driver opening balance (company owes driver if positive)
alter table drivers
  add column if not exists opening_balance numeric(14, 2) not null default 0;

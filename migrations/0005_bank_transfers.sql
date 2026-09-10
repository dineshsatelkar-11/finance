-- Internal bank-to-bank transfers
create table if not exists bank_transfers (
  id text primary key,
  from_bank_id text not null,
  to_bank_id text not null,
  amount numeric(14, 2) not null,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

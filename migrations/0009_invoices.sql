-- Customer billing invoices (amount due before payment).
create table if not exists invoices (
  id text primary key,
  invoice_no text not null default '',
  customer_id text not null references customers (id) on delete restrict,
  customer_name text not null default '',
  customer_mobile text not null default '',
  invoice_date date,
  due_date date,
  description text not null default '',
  amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  fleet_id text,
  for_month text not null default '',
  status text not null default 'unpaid',
  paid_date date,
  paid_mode text not null default '',
  paid_bank_account_id text not null default '',
  receipt_id text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists invoices_date_idx on invoices (invoice_date);
create index if not exists invoices_customer_idx on invoices (customer_id);
create index if not exists invoices_status_idx on invoices (status);

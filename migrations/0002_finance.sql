-- Finance schema for Satelkar Logistics (single-tenant).
-- Applied on Vercel build when DATABASE_URL is set (see scripts/migrate.mjs).
-- PGLite applies the same file automatically in local preview.

create table if not exists banks (
  id text primary key,
  name text not null,
  is_default boolean not null default false,
  opening numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists fleets (
  id text primary key,
  name text not null,
  reg_no text not null default '',
  kind text not null default 'mini',
  monthly_rent numeric(14, 2) not null default 0,
  active boolean not null default true,
  loan_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists loans (
  id text primary key,
  name text not null,
  bank text not null default '',
  account_no text not null default '',
  ifsc text not null default '',
  principal numeric(14, 2) not null default 0,
  emi_amount numeric(14, 2) not null default 0,
  emi_day int not null default 1,
  total_emis int not null default 0,
  start_date date,
  end_date date,
  interest_rate numeric(8, 4) not null default 0,
  outstanding numeric(14, 2) not null default 0,
  pending_emis int not null default 0,
  status text not null default 'active',
  fleet_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists drivers (
  id text primary key,
  name text not null,
  mobile text not null default '',
  kind text not null default 'full',
  base_salary numeric(14, 2) not null default 0,
  daily_rate numeric(14, 2) not null default 0,
  active boolean not null default true,
  upi_vpa text not null default '',
  upi_payee_name text not null default '',
  upi_updated_at timestamptz,
  fleet_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id text primary key,
  name text not null,
  upi_vpa text not null default '',
  upi_payee_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  mobile text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id text primary key,
  driver_id text not null references drivers (id) on delete restrict,
  kind text not null,
  amount numeric(14, 2) not null,
  date date not null,
  mode text not null default 'upi',
  status text not null default 'pending',
  bank_account_id text not null references banks (id) on delete restrict,
  upi_vpa text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  category text not null default '',
  vendor text not null default '',
  amount numeric(14, 2) not null,
  date date not null,
  mode text not null default 'upi',
  status text not null default 'paid',
  bank_account_id text not null references banks (id) on delete restrict,
  upi_vpa text not null default '',
  fleet_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists receipts (
  id text primary key,
  customer_id text not null references customers (id) on delete restrict,
  customer_name text not null default '',
  amount numeric(14, 2) not null,
  date date not null,
  mode text not null default 'upi',
  status text not null default 'paid',
  bank_account_id text not null references banks (id) on delete restrict,
  fleet_id text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists rent_payments (
  id text primary key,
  fleet_id text not null references fleets (id) on delete restrict,
  driver_id text not null references drivers (id) on delete restrict,
  amount numeric(14, 2) not null,
  date date not null,
  for_month text not null,
  mode text not null default 'cash',
  status text not null default 'paid',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists loan_payments (
  id text primary key,
  loan_id text not null references loans (id) on delete restrict,
  kind text not null,
  amount numeric(14, 2) not null,
  date date not null,
  mode text not null default 'bank',
  status text not null default 'paid',
  bank_account_id text not null references banks (id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists attendances (
  id text primary key,
  driver_id text not null references drivers (id) on delete cascade,
  month text not null,
  leave_days int not null default 0,
  note text not null default '',
  unique (driver_id, month)
);

create table if not exists rent_waivers (
  id text primary key,
  fleet_id text not null references fleets (id) on delete cascade,
  month text not null,
  breakdown_days int not null default 0,
  amount numeric(14, 2) not null default 0,
  note text not null default '',
  unique (fleet_id, month)
);

create index if not exists payouts_driver_date_idx on payouts (driver_id, date);
create index if not exists expenses_date_idx on expenses (date);
create index if not exists receipts_date_idx on receipts (date);
create index if not exists rent_payments_month_idx on rent_payments (for_month);
create index if not exists loan_payments_loan_idx on loan_payments (loan_id);

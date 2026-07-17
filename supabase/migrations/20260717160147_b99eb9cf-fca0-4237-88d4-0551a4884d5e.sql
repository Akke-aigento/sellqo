create table public.admin_customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null,
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.admin_customer_ledger to authenticated;
grant all on public.admin_customer_ledger to service_role;

alter table public.admin_customer_ledger enable row level security;

create policy "admin_customer_ledger_platform_admin_only"
  on public.admin_customer_ledger
  for all
  to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create index idx_admin_customer_ledger_customer_date
  on public.admin_customer_ledger (customer_id, entry_date desc);

create trigger set_admin_customer_ledger_updated_at
  before update on public.admin_customer_ledger
  for each row execute function public.update_updated_at_column();

create table public.admin_customer_ledger_recurring (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null,
  note text,
  interval_months int not null default 1 check (interval_months > 0),
  next_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.admin_customer_ledger_recurring to authenticated;
grant all on public.admin_customer_ledger_recurring to service_role;

alter table public.admin_customer_ledger_recurring enable row level security;

create policy "admin_customer_ledger_recurring_platform_admin_only"
  on public.admin_customer_ledger_recurring
  for all
  to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create index idx_admin_customer_ledger_recurring_customer
  on public.admin_customer_ledger_recurring (customer_id);

create trigger set_admin_customer_ledger_recurring_updated_at
  before update on public.admin_customer_ledger_recurring
  for each row execute function public.update_updated_at_column();
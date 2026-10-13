-- FOOD-2 (13-10-2026): keukenscherm voor pizzeria's, kebabzaken en frituren.
-- Keukenstatus staat in een EIGEN tabel, niet op orders of pos_transactions: op die
-- tabellen hangen update-triggers (meldingen, loyalty, voorraad, tracking-mails) die bij
-- elke statusklik in de keuken anders zouden afgaan. Alles additief.
--
-- Een keukenbon hoort bij precies één bron:
--   webshop → order_id (orders met service_type; de bon ontstaat bij de eerste klik)
--   kassa   → pos_transaction_id (bij het afrekenen met keukeninfo)
--   telefoon→ parked_cart_id (geparkeerde bon; na afrekenen ook pos_transaction_id)
create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null check (source in ('webshop', 'pos', 'phone')),
  order_id uuid references public.orders(id) on delete cascade,
  pos_transaction_id uuid references public.pos_transactions(id) on delete set null,
  parked_cart_id uuid references public.pos_parked_carts(id) on delete set null,
  service_type text check (service_type is null or service_type in ('pickup', 'local_delivery', 'eat_in')),
  requested_time timestamptz,
  customer_label text,
  customer_phone text,
  note text,
  items jsonb,
  total numeric,
  paid boolean not null default false,
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'done', 'cancelled')),
  status_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_kitchen_tickets_order on public.kitchen_tickets (order_id) where order_id is not null;
create unique index if not exists idx_kitchen_tickets_pos on public.kitchen_tickets (pos_transaction_id) where pos_transaction_id is not null;
create unique index if not exists idx_kitchen_tickets_parked on public.kitchen_tickets (parked_cart_id) where parked_cart_id is not null;
create index if not exists idx_kitchen_tickets_tenant_open on public.kitchen_tickets (tenant_id, created_at) where status in ('new', 'preparing', 'ready');

alter table public.kitchen_tickets enable row level security;
-- Keuken en kassa: alle tenantleden lezen en schrijven (kok en kassier hebben geen adminrol nodig).
drop policy if exists kitchen_tickets_select on public.kitchen_tickets;
create policy kitchen_tickets_select on public.kitchen_tickets for select
  using (is_platform_admin(auth.uid()) or tenant_id in (select get_user_tenant_ids(auth.uid())));
drop policy if exists kitchen_tickets_write on public.kitchen_tickets;
create policy kitchen_tickets_write on public.kitchen_tickets for all
  using (is_platform_admin(auth.uid()) or tenant_id in (select get_user_tenant_ids(auth.uid())))
  with check (is_platform_admin(auth.uid()) or tenant_id in (select get_user_tenant_ids(auth.uid())));

-- Webshoporders voor het keukenscherm snel vinden.
create index if not exists idx_orders_tenant_service_created on public.orders (tenant_id, created_at) where service_type is not null;

-- Betalen bij afhalen/levering (contant of kaart aan de toog), per winkel aan te zetten.
-- Bewust niet in tenants.payment_methods_enabled: dat veld lezen ook de eigen frontends.
alter table public.fulfillment_settings add column if not exists pay_on_pickup boolean not null default false;

-- Opmerking van de klant ("geen ui", "bel aan bij nr. 3"), gaat mee naar orders.notes.
alter table public.storefront_carts add column if not exists customer_note text;

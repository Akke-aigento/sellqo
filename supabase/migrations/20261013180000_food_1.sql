-- FOOD-1 (13-10-2026): afhalen/leveren met tijdslot en extra's (toppings) voor de
-- SellQo-standaardshop. Alles additief en nullable/met defaults: bestaande verzend-
-- methodes, carts, orders en eigen frontends gedragen zich exact zoals voorheen.
-- Live toegepast via query_database op 13-10-2026 (idempotent).

-- 1) Verzendmethodes: soort + leverzone + minimumbedrag
alter table public.shipping_methods
  add column if not exists fulfillment_type text not null default 'shipping',
  add column if not exists postal_codes text[],
  add column if not exists min_order_amount numeric;
do $$ begin
  alter table public.shipping_methods add constraint shipping_methods_fulfillment_type_check
    check (fulfillment_type in ('shipping','pickup','local_delivery'));
exception when duplicate_object then null; end $$;

-- 2) Cart en order: soort dienst + gewenst tijdstip
alter table public.storefront_carts
  add column if not exists service_type text,
  add column if not exists requested_time timestamptz;
alter table public.orders
  add column if not exists service_type text,
  add column if not exists requested_time timestamptz;
create index if not exists idx_orders_tenant_requested_time on public.orders (tenant_id, requested_time) where requested_time is not null;

-- 3) Extra's op cartregels en orderregels
alter table public.storefront_cart_items
  add column if not exists addons jsonb,
  add column if not exists addon_key text,
  add column if not exists addons_total numeric not null default 0;
alter table public.order_items
  add column if not exists addons jsonb;
-- Zelfde product met andere extra's = aparte regel. Rijen zonder extra's: zelfde uniciteit als voorheen.
drop index if exists public.idx_cart_items_product_variant;
create unique index if not exists idx_cart_items_product_variant_addons on public.storefront_cart_items
  (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(addon_key, ''));

-- 4) Tijdsloten per winkel
create table if not exists public.fulfillment_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  slots_enabled boolean not null default false,
  slot_minutes integer not null default 15 check (slot_minutes between 5 and 120),
  prep_minutes integer not null default 20 check (prep_minutes between 0 and 600),
  days_ahead integer not null default 0 check (days_ahead between 0 and 14),
  max_orders_per_slot integer check (max_orders_per_slot is null or max_orders_per_slot > 0),
  timezone text not null default 'Europe/Brussels',
  hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) Extra's: groepen (bv. "Extra toppings") per categorie en/of product, met opties
create table if not exists public.product_addon_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer check (max_select is null or max_select >= 1),
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.product_addon_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_addon_groups(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price numeric not null default 0 check (price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_addon_groups_tenant on public.product_addon_groups (tenant_id);
create index if not exists idx_addon_options_group on public.product_addon_options (group_id);

-- RLS: zelfde patroon als shipping_methods. De shop leest via storefront-api (service role).
alter table public.fulfillment_settings enable row level security;
alter table public.product_addon_groups enable row level security;
alter table public.product_addon_options enable row level security;
do $$
declare t text;
begin
  foreach t in array array['fulfillment_settings','product_addon_groups','product_addon_options'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (is_platform_admin(auth.uid()) or tenant_id in (select get_user_tenant_ids(auth.uid())))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all using (is_platform_admin(auth.uid()) or (tenant_id in (select get_user_tenant_ids(auth.uid())) and has_tenant_role(tenant_id, array[''tenant_admin''::app_role]))) with check (is_platform_admin(auth.uid()) or (tenant_id in (select get_user_tenant_ids(auth.uid())) and has_tenant_role(tenant_id, array[''tenant_admin''::app_role])))', t || '_write', t);
  end loop;
end $$;

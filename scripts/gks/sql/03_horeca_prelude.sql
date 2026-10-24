-- Stub: tabellen waar TAFEL-1 op leunt, in de vorm van live (23-10-2026) / ZAAL-H1.
create table if not exists public.dining_tables (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, area_id uuid, label text not null, is_active boolean not null default true);
create table if not exists public.vat_rates (id uuid primary key default gen_random_uuid(), tenant_id uuid, rate numeric not null, is_default boolean default false, is_active boolean default true);
create table if not exists public.product_variants (id uuid primary key default gen_random_uuid(), product_id uuid not null, tenant_id uuid, title text, price numeric, is_active boolean default true);
create table if not exists public.product_categories (id uuid primary key default gen_random_uuid(), product_id uuid, category_id uuid);
create table if not exists public.product_addon_groups (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, name text, min_select int default 0, max_select int, category_ids uuid[] default '{}', product_ids uuid[] default '{}', sort_order int default 0, is_active boolean default true);
create table if not exists public.product_addon_options (id uuid primary key default gen_random_uuid(), group_id uuid not null, tenant_id uuid not null, name text not null, price numeric default 0, sort_order int default 0, is_active boolean default true);
create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, source text not null, order_id uuid, pos_transaction_id uuid, parked_cart_id uuid,
  service_type text, requested_time timestamptz, customer_label text, customer_phone text, note text, items jsonb, total numeric, paid boolean not null default false,
  status text not null default 'new', status_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.kitchen_tickets add constraint kitchen_tickets_source_check check (source in ('webshop', 'pos', 'phone'));
alter table public.kitchen_tickets add constraint kitchen_tickets_service_type_check check (service_type is null or service_type in ('pickup', 'local_delivery', 'eat_in'));

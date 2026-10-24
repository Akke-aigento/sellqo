-- KAART-1 — extra kolommen zoals live (24-10-2026 nagetrokken via information_schema / pg_indexes).
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists requires_shipping boolean default true;
alter table public.products alter column track_inventory set default true;
create unique index if not exists products_tenant_id_slug_key on public.products (tenant_id, slug);
alter table public.categories add column if not exists slug text;
alter table public.categories add column if not exists sort_order int default 0;
alter table public.categories add column if not exists is_active boolean default true;
alter table public.categories add column if not exists created_at timestamptz default now();
create unique index if not exists categories_tenant_id_slug_key on public.categories (tenant_id, slug);
alter table public.product_categories add column if not exists is_primary boolean not null default false;
alter table public.product_categories add column if not exists sort_order int not null default 0;
create unique index if not exists product_categories_product_id_category_id_key on public.product_categories (product_id, category_id);
grant select, insert, update, delete on public.products, public.categories, public.product_categories, public.vat_rates to authenticated;
-- KASSA-0.6 — "op voor vandaag" zoals live (24-10-2026 nagetrokken).
create or replace function public.sold_out_reset_at(p_now timestamp with time zone default now()) returns timestamp with time zone language sql stable set search_path to 'public', 'pg_temp' as $$
  select ((date_trunc('day', p_now at time zone 'Europe/Brussels')
      + case when (p_now at time zone 'Europe/Brussels')::time < time '05:00' then interval '5 hours' else interval '1 day 5 hours' end)
    at time zone 'Europe/Brussels')
$$;
-- KAART-3 — productvelden die kaart_duplicate_product kopieert (zoals live).
alter table public.products add column if not exists allergens text[] not null default '{}';
alter table public.products add column if not exists dietary text[] not null default '{}';
alter table public.products add column if not exists description text;
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists images text[] default '{}';
alter table public.products add column if not exists featured_image text;
alter table public.products add column if not exists product_type text default 'physical';
alter table public.products add column if not exists hide_from_storefront boolean default false;
-- KAART-3 — kolommen die guard_product_commercial_fields leest (zoals live).
alter table public.products add column if not exists compare_at_price numeric;
alter table public.products add column if not exists cost_price numeric;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists low_stock_threshold int;

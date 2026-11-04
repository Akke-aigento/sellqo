-- UREN-1 — fulfillment_settings, reservation_settings en table_reservations zoals live (kolommen nagetrokken
-- 4-11-2026), update_updated_at_column zoals live. Enkel wat 20261104120000_uren_1.sql en zijn test nodig hebben.
create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end $$;
create table if not exists public.fulfillment_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  slots_enabled boolean not null default false, slot_minutes integer not null default 15, prep_minutes integer not null default 20,
  days_ahead integer not null default 0, max_orders_per_slot integer, timezone text not null default 'Europe/Brussels',
  hours jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  pay_on_pickup boolean not null default false, notify_ready boolean not null default true, qr_mode text not null default 'view',
  paused_until timestamptz, closed_dates date[] not null default '{}');
create table if not exists public.reservation_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  lead_minutes integer not null default 60, late_minutes integer not null default 15, updated_at timestamptz not null default now(),
  online_enabled boolean not null default false, online_hours jsonb not null default '{}'::jsonb, slot_minutes integer not null default 15,
  max_guests_per_slot integer not null default 20, max_party integer not null default 8, days_ahead integer not null default 30,
  min_notice_minutes integer not null default 120);
create table if not exists public.table_reservations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, table_id uuid, name text not null, guests integer not null,
  starts_at timestamptz not null, status text not null default 'booked');
alter table public.fulfillment_settings enable row level security;
alter table public.reservation_settings enable row level security;
grant select, insert, update, delete on public.fulfillment_settings, public.reservation_settings to authenticated;
grant all on public.fulfillment_settings, public.reservation_settings, public.table_reservations to service_role;
-- Testzaak U met een oude sluitingsdag (PAUSE-1) die nog komt en één die voorbij is: de migratie moet de
-- komende kopiëren naar business_hours.closures, één keer (ook bij twee keer draaien).
insert into public.tenants (id, name, slug) values
  ('b0000000-0000-0000-0000-000000000001', 'Uren', 'uren'),
  ('b0000000-0000-0000-0000-000000000002', 'Ander', 'ander')
on conflict (id) do nothing;
insert into public.fulfillment_settings (tenant_id, closed_dates)
values ('b0000000-0000-0000-0000-000000000001', array[current_date + 5, current_date - 1])
on conflict (tenant_id) do update set closed_dates = excluded.closed_dates;
-- UREN-1b: kolommen die live al bestaan (qr_*), zodat de prelude dicht bij live blijft.
alter table public.fulfillment_settings add column if not exists qr_flow text not null default 'order';

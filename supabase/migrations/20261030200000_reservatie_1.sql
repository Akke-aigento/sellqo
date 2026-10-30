-- RESERVATIE-1 — tafelreservaties als aparte laag boven het zaalplan.
--
-- Harde regel (Akke, 29-10): een reservatie raakt NOOIT een open rekening. Daarom:
--  * eigen tabel, geen kolom of verwijzing op dining_checks, geen trigger op dining_checks;
--  * geen cron die reservaties afsluit, verwijdert of tafels vrijmaakt. De kassa berekent de kleur
--    van een tafel zelf; een open rekening wint daar altijd;
--  * "aangekomen", "niet gekomen" en "geannuleerd" zet altijd een mens (kassa of beheer).
-- Enkel het gsm-nummer wordt 30 dagen na de reservatie automatisch gewist (privacy).
--
-- Nieuw: table_reservations, reservation_settings, trigger die horeca_state ophoogt (zodat elke
-- kassa binnen een poll ververst), cron purge-reservation-phones-daily.
-- Idempotent. Handmatig terugdraaien:
--   select cron.unschedule('purge-reservation-phones-daily');
--   drop table public.table_reservations; drop table public.reservation_settings;
--   drop function public.table_reservations_touch(); drop function public.reservation_settings_touch();

create table if not exists public.table_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- null = nog geen tafel toegewezen; een tafel die gedeactiveerd wordt, laat de reservatie staan.
  table_id uuid references public.dining_tables(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  guests integer not null default 2 check (guests between 1 and 99),
  phone text check (phone is null or char_length(phone) <= 30),
  note text check (note is null or char_length(note) <= 200),
  starts_at timestamptz not null,
  duration_min integer not null default 120 check (duration_min between 15 and 720),
  status text not null default 'booked' check (status in ('booked', 'seated', 'cancelled', 'no_show')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_reservations_tenant_start_idx on public.table_reservations (tenant_id, starts_at);
create index if not exists table_reservations_phone_purge_idx on public.table_reservations (starts_at) where phone is not null;

create table if not exists public.reservation_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  -- Vanaf hoeveel minuten vóór het uur de tafel paars kleurt op het zaalplan.
  lead_minutes integer not null default 60 check (lead_minutes between 0 and 1440),
  -- Na hoeveel minuten zonder gasten de kassa "te laat" toont (enkel weergave).
  late_minutes integer not null default 15 check (late_minutes between 0 and 240),
  updated_at timestamptz not null default now()
);

alter table public.table_reservations enable row level security;
alter table public.reservation_settings enable row level security;

-- Persoonsgegevens (naam, gsm): enkel zaakvoerder en personeel, nooit publiek, nooit marketing/boekhouding.
drop policy if exists table_reservations_select on public.table_reservations;
create policy table_reservations_select on public.table_reservations for select
  using (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]));
drop policy if exists table_reservations_insert on public.table_reservations;
create policy table_reservations_insert on public.table_reservations for insert
  with check (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]));
drop policy if exists table_reservations_update on public.table_reservations;
create policy table_reservations_update on public.table_reservations for update
  using (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]))
  with check (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin', 'staff']::public.app_role[]));
-- Geen delete-policy: annuleren = status 'cancelled' (spoor blijft).

drop policy if exists reservation_settings_select on public.reservation_settings;
create policy reservation_settings_select on public.reservation_settings for select
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists reservation_settings_write on public.reservation_settings;
create policy reservation_settings_write on public.reservation_settings for all
  using (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]))
  with check (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));

grant select, insert, update on public.table_reservations to authenticated;
grant select, insert, update on public.reservation_settings to authenticated;

-- Tafel moet van dezelfde zaak zijn; updated_at bijhouden; kassa's laten verversen.
create or replace function public.table_reservations_touch()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if new.table_id is not null
     and not exists (select 1 from public.dining_tables t where t.id = new.table_id and t.tenant_id = new.tenant_id) then
    raise exception 'onbekende tafel' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id then raise exception 'zaak wijzigen kan niet' using errcode = '22023'; end if;
    new.updated_at := now();
  end if;
  perform public.horeca_bump(new.tenant_id);
  return new;
end
$fn$;

drop trigger if exists trg_table_reservations_touch on public.table_reservations;
create trigger trg_table_reservations_touch before insert or update on public.table_reservations
  for each row execute function public.table_reservations_touch();
create or replace function public.reservation_settings_touch()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  new.updated_at := now();
  perform public.horeca_bump(new.tenant_id);
  return new;
end
$fn$;

drop trigger if exists trg_reservation_settings_touch on public.reservation_settings;
create trigger trg_reservation_settings_touch before insert or update on public.reservation_settings
  for each row execute function public.reservation_settings_touch();

-- Privacy: gsm-nummer 30 dagen na de reservatie leegmaken. Raakt niets anders.
do $cron$
begin
  perform cron.unschedule('purge-reservation-phones-daily')
    where exists (select 1 from cron.job where jobname = 'purge-reservation-phones-daily');
  perform cron.schedule(
    'purge-reservation-phones-daily',
    '35 3 * * *',
    $cmd$ update public.table_reservations set phone = null where phone is not null and starts_at < now() - interval '30 days' $cmd$
  );
end
$cron$;

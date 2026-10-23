-- ZAAL-H1 (24-10-2026): zaalplan voor horeca — ruimtes, tafels en decor (toog, deur, muur…).
-- Los van de eventzalen van ZAAL-1 (venues/venue_seats): dat zijn stoelen voor tickets,
-- dit zijn tafels waaraan besteld en (later, TAFEL-1) afgerekend wordt.
--
--  - dining_areas:  een ruimte ("Binnen", "Terras", "Boven") met een raster grid_w × grid_h.
--  - dining_tables: een tafel, barkruk of statafel op dat raster (x, y, w, h in rastereenheden),
--                   met een geheime qr_token voor de QR-code op tafel (?t=<token>).
--  - floor_markers: niet-bestelbare dingen op het plan (toog, deur, muur, plant, tekst).
--
-- Vaste afspraken (fiscaal, GKS 2.0): een tafel-id is stabiel en wordt nooit hergebruikt.
-- Verwijderen = is_active = false. Er is daarom GEEN delete-recht op dining_tables en
-- dining_areas voor gebruikers; enkel floor_markers (decor) mag echt weg.
--
-- qr_token is geheim: anon krijgt geen enkel recht op deze tabellen. De storefront kent een
-- token enkel via storefront-api (service role, actie resolve_table). Gebruikers kunnen de
-- token niet zelf kiezen of overschrijven (geen kolomrecht); vernieuwen gaat via de functie
-- public.renew_dining_table_token(uuid), die een nieuwe willekeurige token zet.
--
-- Additief op gedeelde tabellen: storefront_carts en orders krijgen een nullable
-- dining_table_id (welke tafel uit het zaalplan). Niets hernoemd, geen default gewijzigd.
--
-- Idempotent: tweemaal draaien geeft hetzelfde resultaat (IF NOT EXISTS, DROP … IF EXISTS
-- vóór CREATE POLICY/TRIGGER, CREATE OR REPLACE FUNCTION).
--
-- Handmatig terugdraaien (enkel zolang er geen orders/carts naar een tafel verwijzen die je
-- wil bewaren; de kolommen op orders/carts zijn dan leeg en mogen blijven staan):
--   drop function if exists public.renew_dining_table_token(uuid);
--   alter table public.orders drop column if exists dining_table_id;          -- enkel als leeg
--   alter table public.storefront_carts drop column if exists dining_table_id; -- enkel als leeg
--   drop table if exists public.floor_markers;
--   drop table if exists public.dining_tables;
--   drop table if exists public.dining_areas;

-- ── Ruimtes ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort integer not null default 0,
  grid_w integer not null default 40 check (grid_w between 8 and 120),
  grid_h integer not null default 24 check (grid_h between 6 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Doel voor de samengestelde sleutel van tafels/decor: een tafel kan zo nooit in een
  -- ruimte van een andere winkel hangen.
  constraint dining_areas_id_tenant_unique unique (id, tenant_id)
);
create index if not exists idx_dining_areas_tenant on public.dining_areas (tenant_id, sort);

-- ── Tafels ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  area_id uuid not null,
  label text not null check (label ~ '^[A-Za-z0-9][A-Za-z0-9 _./-]{0,15}$'),
  kind text not null default 'table' check (kind in ('table', 'bar_seat', 'standing')),
  shape text not null default 'square' check (shape in ('round', 'square', 'rect')),
  seats integer not null default 4 check (seats between 0 and 99),
  x integer not null default 0 check (x between 0 and 119),
  y integer not null default 0 check (y between 0 and 79),
  w integer not null default 2 check (w between 1 and 40),
  h integer not null default 2 check (h between 1 and 40),
  rotation integer not null default 0 check (rotation between 0 and 359),
  qr_token text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dining_tables_area_fk foreign key (area_id, tenant_id)
    references public.dining_areas (id, tenant_id) on delete restrict,
  constraint dining_tables_qr_token_unique unique (qr_token),
  constraint dining_tables_qr_token_format check (qr_token ~ '^[0-9a-f]{24,64}$')
);
create index if not exists idx_dining_tables_tenant_area on public.dining_tables (tenant_id, area_id) where is_active;
-- Een label is uniek per ruimte, enkel onder actieve tafels (een verwijderde "B4" maakt
-- plaats voor een nieuwe "B4" met een nieuw id).
create unique index if not exists idx_dining_tables_label_active
  on public.dining_tables (tenant_id, area_id, lower(label)) where is_active;

-- ── Decor ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.floor_markers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  area_id uuid not null,
  kind text not null check (kind in ('bar', 'door', 'wall', 'plant', 'text')),
  label text check (label is null or char_length(label) <= 40),
  x integer not null default 0 check (x between 0 and 119),
  y integer not null default 0 check (y between 0 and 79),
  w integer not null default 4 check (w between 1 and 120),
  h integer not null default 1 check (h between 1 and 80),
  rotation integer not null default 0 check (rotation between 0 and 359),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_markers_area_fk foreign key (area_id, tenant_id)
    references public.dining_areas (id, tenant_id) on delete cascade
);
create index if not exists idx_floor_markers_tenant_area on public.floor_markers (tenant_id, area_id);

-- ── updated_at ───────────────────────────────────────────────────────────────────────────
drop trigger if exists update_dining_areas_updated_at on public.dining_areas;
create trigger update_dining_areas_updated_at before update on public.dining_areas
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_dining_tables_updated_at on public.dining_tables;
create trigger update_dining_tables_updated_at before update on public.dining_tables
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_floor_markers_updated_at on public.floor_markers;
create trigger update_floor_markers_updated_at before update on public.floor_markers
  for each row execute function public.update_updated_at_column();

-- ── Rechten ──────────────────────────────────────────────────────────────────────────────
-- Supabase geeft nieuwe tabellen standaard ALL aan anon en authenticated: eerst alles weg,
-- dan gericht toekennen. anon krijgt niets (qr_token is geheim).
revoke all on public.dining_areas, public.dining_tables, public.floor_markers from anon, authenticated;
grant all on public.dining_areas, public.dining_tables, public.floor_markers to service_role;

grant select on public.dining_areas, public.dining_tables, public.floor_markers to authenticated;
-- Ruimtes: geen delete (soft via is_active).
grant insert (id, tenant_id, name, sort, grid_w, grid_h, is_active) on public.dining_areas to authenticated;
grant update (name, sort, grid_w, grid_h, is_active) on public.dining_areas to authenticated;
-- Tafels: geen delete, geen qr_token, geen tenant_id/id wijzigen.
grant insert (id, tenant_id, area_id, label, kind, shape, seats, x, y, w, h, rotation, is_active) on public.dining_tables to authenticated;
grant update (area_id, label, kind, shape, seats, x, y, w, h, rotation, is_active) on public.dining_tables to authenticated;
-- Decor: mag echt weg.
grant insert (id, tenant_id, area_id, kind, label, x, y, w, h, rotation) on public.floor_markers to authenticated;
grant update (area_id, kind, label, x, y, w, h, rotation) on public.floor_markers to authenticated;
grant delete on public.floor_markers to authenticated;

alter table public.dining_areas enable row level security;
alter table public.dining_tables enable row level security;
alter table public.floor_markers enable row level security;

-- Lezen: elk lid van de winkel (kassa, keuken en bediening hebben het plan nodig).
-- Schrijven: tenant_admin of staff (zelfde predicaat als de eventzalen van ZAAL-1).
-- Platformadmin: overal (is_platform_admin), zoals bij de keukentabellen.
do $$
declare
  t text;
  rd text := '(public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())))';
  wr text := '(public.is_platform_admin(auth.uid()) or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array[''tenant_admin''::public.app_role, ''staff''::public.app_role])))';
begin
  foreach t in array array['dining_areas', 'dining_tables', 'floor_markers'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using %s', t || '_select', t, rd);
    execute format('create policy %I on public.%I for insert to authenticated with check %s', t || '_insert', t, wr);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s', t || '_update', t, wr, wr);
  end loop;
  -- Enkel decor kent een delete-policy; tafels en ruimtes blijven bestaan (soft delete).
  execute format('create policy %I on public.%I for delete to authenticated using %s', 'floor_markers_delete', 'floor_markers', wr);
end $$;

-- ── Token vernieuwen ─────────────────────────────────────────────────────────────────────
-- Een nieuwe QR-code voor een tafel: de oude sticker werkt meteen niet meer. SECURITY
-- DEFINER omdat gebruikers geen kolomrecht op qr_token hebben; de rolcontrole zit erin.
create or replace function public.renew_dining_table_token(_table_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  _tenant uuid;
  _token text;
begin
  select tenant_id into _tenant from public.dining_tables where id = _table_id;
  if _tenant is null then
    raise exception 'table_not_found' using errcode = 'P0002';
  end if;
  if not (
    public.is_platform_admin(auth.uid())
    or (_tenant in (select public.get_user_tenant_ids(auth.uid()))
        and public.has_tenant_role(_tenant, array['tenant_admin'::public.app_role, 'staff'::public.app_role]))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  _token := encode(extensions.gen_random_bytes(12), 'hex');
  update public.dining_tables set qr_token = _token where id = _table_id;
  return _token;
end $$;
revoke all on function public.renew_dining_table_token(uuid) from public, anon;
grant execute on function public.renew_dining_table_token(uuid) to authenticated, service_role;

-- ── Additief: welke tafel bij een mandje / bestelling hoort ──────────────────────────────
-- Gezet door storefront-api (checkout_table met table_token). table_label blijft wat het
-- was: de keuken en de mails lezen dat. Tafels worden nooit hard verwijderd; set null is
-- enkel een vangnet.
alter table public.storefront_carts add column if not exists dining_table_id uuid
  references public.dining_tables(id) on delete set null;
alter table public.orders add column if not exists dining_table_id uuid
  references public.dining_tables(id) on delete set null;
create index if not exists idx_orders_dining_table on public.orders (dining_table_id) where dining_table_id is not null;

-- TAFEL-1 (23-10-2026): rekeningen aan tafel en op naam, rondes naar keuken en bar.
-- Eisenmatrix: EVT-04..08, TX-07, TX-09, TX-11..14, TBL-01..06, TBL-10.
--
-- Model (ontwerp §3.1/§3.2, horeca-tafelkassa-ontwerp.md):
--   dining_checks   = een rekening (= fiscaal costCenter-sessie; reference uniek per sessie)
--   check_lines     = append-only lijnen in chronologische volgorde (seq). Een verstuurde lijn
--                     wordt NOOIT gewijzigd: annuleren, korting of verplaatsen na versturen
--                     = nieuwe lijnen (negatief met reden, en zo nodig een nieuwe positieve).
--   check_rounds    = één ronde = één P/ORDER-event = de lijnen die nieuw zijn sinds de vorige
--                     ronde (FAQ Q207) = keukenbonnen per station.
--   prep_stations   = keuken, bar, … met routing per categorie of product.
--   horeca_commands = idempotentie: elk commando heeft een client-UUID en wordt één keer
--                     toegepast; dubbel versturen geeft het eerste resultaat terug.
--   horeca_state    = één versienummer per zaak; toestellen pollen dat (goedkoop).
--
-- Schrijven gaat UITSLUITEND via public.horeca_apply (security definer): tenant en rol uit
-- auth.uid(), prijzen en btw uit de databank (products, product_variants, product_addon_*,
-- vat_rates), nooit van het toestel. Lezen via public.horeca_snapshot of rechtstreeks (RLS).
--
-- Additief: nieuwe tabellen; kitchen_tickets krijgt kolommen en de bron 'table' erbij
-- (de check-constraint wordt verruimd, niet versmald).
-- Idempotent. Terugdraaien (handmatig, enkel zonder echte rekeningen):
--   drop function if exists public.horeca_apply(uuid, text, jsonb); drop function if exists public.horeca_snapshot(uuid);
--   drop function if exists public.horeca_vat_label(numeric); drop function if exists public.horeca_bump(uuid);
--   drop function if exists public.horeca_apply_one(uuid, jsonb); drop function if exists public.horeca_check_json(uuid);
--   drop function if exists public.horeca_open_qty(uuid); drop function if exists public.check_lines_guard();
--   drop table if exists public.horeca_commands, public.check_lines, public.check_rounds, public.dining_checks,
--     public.prep_station_routes, public.prep_stations, public.horeca_state;
--   alter table public.kitchen_tickets drop column if exists round_id, drop column if exists station_id,
--     drop column if exists check_id, drop column if exists table_label;
--   (kitchen_tickets_source_check terugzetten naar ('webshop','pos','phone') kan pas als er geen 'table'-bonnen meer zijn)

-- ── Stations ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.prep_stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  kind text not null default 'kitchen' check (kind in ('kitchen', 'bar', 'other')),
  sort integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists prep_stations_default_uq on public.prep_stations (tenant_id) where is_default and is_active;

-- Routing: product wint van categorie (ontwerp §3.5).
create table if not exists public.prep_station_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  station_id uuid not null references public.prep_stations(id) on delete cascade,
  category_id uuid,
  product_id uuid,
  created_at timestamptz not null default now(),
  constraint prep_station_routes_target check ((category_id is null) <> (product_id is null))
);
create unique index if not exists prep_station_routes_cat_uq on public.prep_station_routes (tenant_id, category_id) where category_id is not null;
create unique index if not exists prep_station_routes_prod_uq on public.prep_station_routes (tenant_id, product_id) where product_id is not null;

-- ── Rekeningen, rondes, lijnen ────────────────────────────────────────────────────────────
create table if not exists public.dining_checks (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  table_id uuid references public.dining_tables(id) on delete restrict,
  name text check (name is null or char_length(btrim(name)) between 1 and 40),
  status text not null default 'open' check (status in ('open', 'closed', 'void')),
  guests integer check (guests is null or guests between 0 and 999),
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  bill_requested_at timestamptz,
  -- TBL-02: uniek per tafelsessie, blijft gelijk zolang de rekening loopt (ook bij volledig
  -- verplaatsen naar een lege tafel, TBL-03).
  cost_center_reference text not null check (char_length(cost_center_reference) between 1 and 64),
  -- TX-12: volgnummer voor prijswijzigingen op deze rekening.
  next_grouping_id integer not null default 1,
  next_seq integer not null default 1,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  -- TAFEL-2: apart afrekenen. Een deelrekening hangt aan de hoofdrekening van dezelfde tafel
  -- (fiscaal TABLE › CHAIR, UC4119bis); split_no = volgnummer van het deel.
  split_of uuid references public.dining_checks(id) on delete restrict,
  split_no integer check (split_no is null or split_no between 1 and 99),
  -- TAFEL-2: afrekenen. Een rekening "in betaling" (horeca_pay_begin) weigert elke wijziging tot
  -- de betaling binnen is, vrijgegeven wordt of paying_until verstrijkt.
  paying_payment_id uuid,
  paying_until timestamptz,
  -- TAFEL-2: na afrekenen met nog niet verstuurde lijnen van een collega: de nieuwe rekening
  -- waar die naartoe gingen (een add_line die nog onderweg was, volgt mee).
  carried_to uuid,
  constraint dining_checks_place check (table_id is not null or name is not null),
  constraint dining_checks_split check ((split_of is null) = (split_no is null))
);
-- Eén hoofdrekening per tafel; deelrekeningen (split_of) staan naast die van hun hoofdrekening.
create unique index if not exists dining_checks_open_table_uq on public.dining_checks (tenant_id, table_id) where status = 'open' and table_id is not null and split_of is null;
create unique index if not exists dining_checks_open_split_uq on public.dining_checks (split_of, split_no) where status = 'open' and split_of is not null;
create unique index if not exists dining_checks_reference_uq on public.dining_checks (tenant_id, cost_center_reference) where status = 'open';
create index if not exists dining_checks_tenant_open on public.dining_checks (tenant_id) where status = 'open';

create table if not exists public.check_rounds (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  check_id uuid not null references public.dining_checks(id) on delete restrict,
  seq integer not null,
  source text not null default 'staff' check (source in ('staff', 'qr')),
  sent_by uuid,
  sent_at timestamptz not null default now(),
  fiscal_event_id uuid,
  unique (check_id, seq)
);

create table if not exists public.check_lines (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  check_id uuid not null references public.dining_checks(id) on delete restrict,
  seq integer not null,
  product_id uuid,
  variant_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  department_id text not null,
  department_name text not null,
  vat_rate numeric(5,2) not null,
  vat_label text not null check (vat_label in ('A', 'B', 'C', 'D', 'X')),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  qty integer not null check (qty <> 0 and qty between -999 and 999),
  -- [{option_id, name, price_cents}] — prijs uit de databank; > 0 = eigen fiscale lijn (UC4120bis)
  addons jsonb not null default '[]'::jsonb,
  note text check (note is null or char_length(note) <= 200),
  course integer check (course is null or course between 1 and 9),
  station_id uuid,
  state text not null default 'draft' check (state in ('draft', 'sent', 'void')),
  round_id uuid references public.check_rounds(id),
  -- TX-07: negatief aantal = verplicht een reden, afgeleid uit de actie (nooit vrij gekozen)
  neg_reason text check (neg_reason in ('CORRECTION', 'PRICE_CHANGE', 'COST_CENTER_CHANGE', 'REFUND', 'PRODUCT_SUBSTITUTION', 'OTHER')),
  corrects_line_id uuid references public.check_lines(id),
  -- TX-11: [{grouping_id, id, name, scope, type, amount_cents}] op het lijntotaal (excl. supplementen)
  price_changes jsonb not null default '[]'::jsonb,
  void_reason text,
  voided_by uuid,
  voided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (check_id, seq),
  constraint check_lines_neg_reason check ((qty > 0 and neg_reason is null) or (qty < 0 and neg_reason is not null))
);
create index if not exists check_lines_check on public.check_lines (check_id, seq);

-- Een verstuurde of gecorrigeerde lijn verandert nooit meer (EVT-04, EVT-13). Enkel een
-- ontwerp-lijn mag nog aangepast of geschrapt worden (dat is vóór de FDM, dus niet fiscaal).
create or replace function public.check_lines_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'check_lines: nooit verwijderen' using errcode = 'insufficient_privilege';
  end if;
  if old.state <> 'draft' then
    raise exception 'check_lines: een verstuurde lijn verandert niet meer' using errcode = 'insufficient_privilege';
  end if;
  if new.check_id <> old.check_id or new.tenant_id <> old.tenant_id or new.seq <> old.seq then
    raise exception 'check_lines: sleutelvelden vast' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists check_lines_guard on public.check_lines;
create trigger check_lines_guard before update or delete on public.check_lines
  for each row execute function public.check_lines_guard();

create table if not exists public.horeca_commands (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null,
  applied_at timestamptz not null default now(),
  applied_by uuid default auth.uid(),
  device_id text,
  result jsonb not null
);
create index if not exists horeca_commands_tenant_time on public.horeca_commands (tenant_id, applied_at);

create table if not exists public.horeca_state (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ── Keukenbonnen per ronde en station ─────────────────────────────────────────────────────
alter table public.kitchen_tickets add column if not exists round_id uuid;
alter table public.kitchen_tickets add column if not exists station_id uuid;
alter table public.kitchen_tickets add column if not exists check_id uuid;
alter table public.kitchen_tickets add column if not exists table_label text;
create unique index if not exists idx_kitchen_tickets_round_station on public.kitchen_tickets (round_id, station_id) where round_id is not null;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'kitchen_tickets_source_check' and pg_get_constraintdef(oid) not like '%table%') then
    alter table public.kitchen_tickets drop constraint kitchen_tickets_source_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kitchen_tickets_source_check') then
    alter table public.kitchen_tickets add constraint kitchen_tickets_source_check check (source in ('webshop', 'pos', 'phone', 'table'));
  end if;
end $$;

-- ── Rechten ───────────────────────────────────────────────────────────────────────────────
revoke all on public.prep_stations, public.prep_station_routes, public.dining_checks, public.check_rounds,
  public.check_lines, public.horeca_commands, public.horeca_state from anon, authenticated;
grant all on public.prep_stations, public.prep_station_routes, public.dining_checks, public.check_rounds,
  public.check_lines, public.horeca_commands, public.horeca_state to service_role;
grant select on public.prep_stations, public.prep_station_routes, public.dining_checks, public.check_rounds,
  public.check_lines, public.horeca_state to authenticated;
-- Stations en routing beheert de zaak zelf (instellingen); rekeningen enkel via horeca_apply.
grant insert, update, delete on public.prep_stations, public.prep_station_routes to authenticated;

alter table public.prep_stations enable row level security;
alter table public.prep_station_routes enable row level security;
alter table public.dining_checks enable row level security;
alter table public.check_rounds enable row level security;
alter table public.check_lines enable row level security;
alter table public.horeca_commands enable row level security;
alter table public.horeca_state enable row level security;

do $$
declare
  t text;
  rd text := '(public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())))';
  wr text := '(public.has_tenant_role(tenant_id, array[''tenant_admin''::public.app_role]))';
begin
  foreach t in array array['prep_stations', 'prep_station_routes', 'dining_checks', 'check_rounds', 'check_lines', 'horeca_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using %s', t || '_select', t, rd);
  end loop;
  foreach t in array array['prep_stations', 'prep_station_routes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using %s with check %s', t || '_write', t, wr, wr);
  end loop;
end $$;

-- ── Hulpfuncties ──────────────────────────────────────────────────────────────────────────
create or replace function public.horeca_vat_label(p_rate numeric)
returns text
language sql
immutable
set search_path to ''
as $$
  select case p_rate when 21 then 'A' when 12 then 'B' when 6 then 'C' when 0 then 'D' else null end;
$$;

create or replace function public.horeca_bump(p_tenant_id uuid)
returns bigint
language sql
security definer
set search_path to ''
as $$
  insert into public.horeca_state (tenant_id, version, updated_at) values (p_tenant_id, 1, now())
  on conflict (tenant_id) do update set version = public.horeca_state.version + 1, updated_at = now()
  returning version;
$$;
revoke all on function public.horeca_bump(uuid) from public, anon, authenticated;

-- Wat staat er van een lijn nog open: haar aantal min de negatieve correcties erop
-- (annulering, prijswijziging, verplaatsing). Een nieuwe lijn met korting telt apart.
create or replace function public.horeca_open_qty(p_line_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select l.qty + coalesce((select sum(x.qty) from public.check_lines x
                           where x.corrects_line_id = l.id and x.qty < 0 and x.state <> 'void'), 0)
  from public.check_lines l where l.id = p_line_id;
$$;
revoke all on function public.horeca_open_qty(uuid) from public, anon, authenticated;

-- Volledige rekening als JSON (voor antwoorden en de snapshot).
create or replace function public.horeca_check_json(p_check_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', c.id, 'table_id', c.table_id, 'name', c.name, 'status', c.status, 'guests', c.guests,
    'opened_at', c.opened_at, 'bill_requested_at', c.bill_requested_at, 'reference', c.cost_center_reference,
    'split_of', c.split_of, 'split_no', c.split_no,
    'parent_reference', (select pc.cost_center_reference from public.dining_checks pc where pc.id = c.split_of),
    'paying', c.paying_until is not null and c.paying_until > now(),
    'version', c.version, 'next_grouping_id', c.next_grouping_id,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'product_id', l.product_id, 'variant_id', l.variant_id, 'name', l.name,
        'department_id', l.department_id, 'department_name', l.department_name, 'vat_label', l.vat_label, 'vat_rate', l.vat_rate,
        'unit_price_cents', l.unit_price_cents, 'qty', l.qty, 'addons', l.addons, 'note', l.note, 'course', l.course,
        'station_id', l.station_id, 'state', l.state, 'round_id', l.round_id, 'neg_reason', l.neg_reason,
        'corrects_line_id', l.corrects_line_id, 'price_changes', l.price_changes, 'void_reason', l.void_reason,
        'created_by', l.created_by, 'created_at', l.created_at,
        'open_qty', case when l.qty > 0 and l.state <> 'void' then public.horeca_open_qty(l.id) else 0 end) order by l.seq)
      from public.check_lines l where l.check_id = c.id), '[]'::jsonb)
  )
  from public.dining_checks c where c.id = p_check_id;
$$;
revoke all on function public.horeca_check_json(uuid) from public, anon, authenticated;

-- ── Lezen: één goedkope versie + snapshot van de open rekeningen ──────────────────────────
create or replace function public.horeca_snapshot(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not (public.is_platform_admin(auth.uid()) or p_tenant_id in (select public.get_user_tenant_ids(auth.uid()))) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'version', coalesce((select version from public.horeca_state where tenant_id = p_tenant_id), 0),
    'checks', coalesce((select jsonb_agg(public.horeca_check_json(c.id) order by c.opened_at)
      from public.dining_checks c where c.tenant_id = p_tenant_id and c.status = 'open'), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.horeca_snapshot(uuid) from public, anon;
grant execute on function public.horeca_snapshot(uuid) to authenticated;

-- ── Schrijven: commando's ─────────────────────────────────────────────────────────────────
-- p_commands = [{id, kind, ...}]; max 50 per aanroep. Elk commando in een eigen
-- subtransactie: een geweigerd commando blokkeert de rest niet en laat niets half achter.
-- Antwoord: {version, results: [{id, ok, error?, check?}]}
create or replace function public.horeca_apply(p_tenant_id uuid, p_device_id text, p_commands jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  cmd jsonb;
  res jsonb;
  results jsonb := '[]'::jsonb;
  prior jsonb;
  v_kind text;
  v_id uuid;
  touched boolean := false;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if jsonb_typeof(p_commands) <> 'array' or jsonb_array_length(p_commands) > 50 then
    raise exception 'commando''s: lijst van max. 50 verwacht' using errcode = '22023';
  end if;

  for cmd in select * from jsonb_array_elements(p_commands) loop
    v_id := (cmd ->> 'id')::uuid;
    v_kind := cmd ->> 'kind';
    select result into prior from public.horeca_commands where id = v_id and tenant_id = p_tenant_id;
    if prior is not null then
      results := results || jsonb_build_array(prior || jsonb_build_object('duplicate', true));
      continue;
    end if;
    begin
      res := public.horeca_apply_one(p_tenant_id, cmd);
      insert into public.horeca_commands (id, tenant_id, kind, device_id, result) values (v_id, p_tenant_id, v_kind, left(p_device_id, 200), res);
      touched := true;
    exception when others then
      -- Geweigerd: niets van dit commando blijft staan. Het resultaat wordt NIET bewaard, zodat
      -- een herhaling na een herstelbare fout (bv. rekening net vrijgegeven) opnieuw kan.
      res := jsonb_build_object('id', v_id, 'ok', false, 'code', sqlstate,
        -- Twee toestellen openen tegelijk dezelfde tafel: leesbare melding i.p.v. de indexnaam.
        'error', case when sqlstate = '23505' and sqlerrm like '%dining_checks_open_table_uq%' then 'die tafel heeft al een open rekening' else sqlerrm end);
    end;
    results := results || jsonb_build_array(res);
  end loop;

  return jsonb_build_object(
    'version', case when touched then public.horeca_bump(p_tenant_id) else coalesce((select version from public.horeca_state where tenant_id = p_tenant_id), 0) end,
    'results', results
  );
end;
$$;
revoke all on function public.horeca_apply(uuid, text, jsonb) from public, anon;
grant execute on function public.horeca_apply(uuid, text, jsonb) to authenticated;

-- Eén commando. Roept enkel horeca_apply aan (niet rechtstreeks uitvoerbaar).
create or replace function public.horeca_apply_one(p_tenant_id uuid, cmd jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind text := cmd ->> 'kind';
  v_id uuid := (cmd ->> 'id')::uuid;
  v_staff uuid := nullif(cmd ->> 'staff_id', '')::uuid;
  c public.dining_checks%rowtype;
  tgt public.dining_checks%rowtype;
  l public.check_lines%rowtype;
  p record;
  v_price integer;
  v_rate numeric;
  v_label text;
  v_dept_id text;
  v_dept_name text;
  v_station uuid;
  v_addons jsonb := '[]'::jsonb;
  v_opt record;
  v_qty integer;
  v_seq integer;
  v_round_seq integer;
  v_line_id uuid;
  v_pc jsonb;
  v_pct numeric;
  v_amount integer;
  v_gross integer;
  v_ids uuid[];
  v_lid uuid;
  v_table uuid;
  v_root uuid;
begin
  if v_staff is not null and not exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id and s.is_active) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;

  if v_kind = 'open_check' then
    v_table := nullif(cmd ->> 'table_id', '')::uuid;
    if v_table is not null and not exists (select 1 from public.dining_tables t where t.id = v_table and t.tenant_id = p_tenant_id and t.is_active) then
      raise exception 'onbekende tafel' using errcode = '22023';
    end if;
    if v_table is not null and exists (select 1 from public.dining_checks x where x.tenant_id = p_tenant_id and x.table_id = v_table and x.status = 'open' and x.split_of is null) then
      raise exception 'die tafel heeft al een open rekening' using errcode = '55000';
    end if;
    if v_table is null and coalesce(btrim(cmd ->> 'name'), '') = '' then
      raise exception 'kies een tafel of geef een naam' using errcode = '22023';
    end if;
    insert into public.dining_checks (id, tenant_id, table_id, name, guests, opened_by, cost_center_reference)
    values ((cmd ->> 'check_id')::uuid, p_tenant_id, v_table, nullif(btrim(cmd ->> 'name'), ''),
            nullif(cmd ->> 'guests', '')::integer, v_staff, (cmd ->> 'check_id'));
    return jsonb_build_object('id', v_id, 'ok', true, 'check', public.horeca_check_json((cmd ->> 'check_id')::uuid));
  end if;

  -- Alle andere commando's werken op een open rekening van deze zaak.
  -- Vaste lock-volgorde: eerst de hoofdrekening, dan het deel (anders deadlock tussen
  -- "splitsen vanuit een deel" en "samenvoegen naar dat deel").
  select x.split_of into v_root from public.dining_checks x where x.id = (cmd ->> 'check_id')::uuid and x.tenant_id = p_tenant_id;
  if v_root is not null then
    perform 1 from public.dining_checks r where r.id = v_root and r.tenant_id = p_tenant_id for update;
  end if;
  select * into c from public.dining_checks where id = (cmd ->> 'check_id')::uuid and tenant_id = p_tenant_id for update;
  if c.id is null then raise exception 'rekening niet gevonden' using errcode = 'P0002'; end if;
  -- TAFEL-2: een lijn die nog onderweg was toen de rekening afgerekend werd, volgt de
  -- ontwerp-lijnen naar de nieuwe rekening (carried_to), in plaats van verloren te gaan.
  for i in 1..5 loop
    exit when c.status = 'open' or c.carried_to is null or v_kind <> 'add_line';
    select * into c from public.dining_checks where id = c.carried_to and tenant_id = p_tenant_id for update;
  end loop;
  if c.id is null then raise exception 'rekening niet gevonden' using errcode = 'P0002'; end if;
  if c.status <> 'open' then raise exception 'rekening is al afgesloten' using errcode = '55000'; end if;
  -- In betaling (claim): ontwerp-lijnen mogen nog (aantikken, aantal, opmerking, weghalen):
  -- die raken het getekende totaal niet en schuiven bij het afrekenen door naar een nieuwe
  -- rekening. Al de rest (versturen, annuleren van verstuurde lijnen, korting, verhuizen) wacht.
  if c.paying_until is not null and c.paying_until > now() and v_kind not in ('add_line', 'change_qty', 'set_note', 'void_line') then
    raise exception 'deze rekening wordt net afgerekend' using errcode = '55000';
  end if;

  if v_kind = 'add_line' then
    v_qty := (cmd ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 999 then raise exception 'aantal ongeldig' using errcode = '22023'; end if;
    select pr.id, pr.name, pr.price, pr.vat_rate_id, pr.category_id, pr.is_active, pr.channels, pr.sold_out_until
      into p from public.products pr where pr.id = (cmd ->> 'product_id')::uuid and pr.tenant_id = p_tenant_id;
    if p.id is null or not p.is_active then raise exception 'product niet beschikbaar' using errcode = '22023'; end if;
    if p.sold_out_until is not null and p.sold_out_until > now() then raise exception 'product is op' using errcode = '22023'; end if;
    v_price := round(p.price * 100);
    if nullif(cmd ->> 'variant_id', '') is not null then
      select round(v.price * 100) into v_price from public.product_variants v
        where v.id = (cmd ->> 'variant_id')::uuid and v.product_id = p.id and v.is_active;
      if v_price is null then raise exception 'variant niet beschikbaar' using errcode = '22023'; end if;
    end if;
    select vr.rate into v_rate from public.vat_rates vr where vr.id = p.vat_rate_id;
    if v_rate is null then
      select vr.rate into v_rate from public.vat_rates vr where vr.tenant_id = p_tenant_id and vr.is_default and vr.is_active limit 1;
    end if;
    v_rate := coalesce(v_rate, 21);
    v_label := public.horeca_vat_label(v_rate);
    if v_label is null then raise exception 'btw-tarief % past niet op een Belgisch label', v_rate using errcode = '22023'; end if;
    select coalesce(cat.id::text, '0'), coalesce(cat.name, 'Overige') into v_dept_id, v_dept_name
      from (select 1) x left join public.categories cat on cat.id = p.category_id and cat.tenant_id = p_tenant_id;
    -- Extra's: enkel geldige opties van groepen die bij dit product horen; prijs uit de databank.
    for v_opt in
      select o.id, o.name, o.price from public.product_addon_options o
      join public.product_addon_groups g on g.id = o.group_id and g.tenant_id = p_tenant_id and g.is_active
      where o.tenant_id = p_tenant_id and o.is_active
        and o.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(cmd -> 'addon_ids', '[]'::jsonb)) x)
        and (p.id = any(g.product_ids) or p.category_id = any(g.category_ids)
             or exists (select 1 from public.product_categories pc where pc.product_id = p.id and pc.category_id = any(g.category_ids)))
      order by g.sort_order, o.sort_order
    loop
      v_addons := v_addons || jsonb_build_array(jsonb_build_object('option_id', v_opt.id, 'name', v_opt.name, 'price_cents', round(coalesce(v_opt.price, 0) * 100)));
    end loop;
    if jsonb_array_length(v_addons) <> (select count(distinct x) from jsonb_array_elements_text(coalesce(cmd -> 'addon_ids', '[]'::jsonb)) x) then
      raise exception 'extra niet beschikbaar bij dit product' using errcode = '22023';
    end if;
    -- Enkel actieve posten: een uitgezette post valt terug op de categorie of de standaardpost.
    select r.station_id into v_station from public.prep_station_routes r join public.prep_stations s on s.id = r.station_id and s.is_active
      where r.tenant_id = p_tenant_id and r.product_id = p.id;
    if v_station is null then
      select r.station_id into v_station from public.prep_station_routes r join public.prep_stations s on s.id = r.station_id and s.is_active
        where r.tenant_id = p_tenant_id and r.category_id = p.category_id;
    end if;
    if v_station is null then
      select s.id into v_station from public.prep_stations s where s.tenant_id = p_tenant_id and s.is_default and s.is_active;
    end if;
    v_seq := c.next_seq;
    insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
      vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, created_by)
    values ((cmd ->> 'line_id')::uuid, p_tenant_id, c.id, v_seq, p.id, nullif(cmd ->> 'variant_id', '')::uuid,
      p.name || coalesce(' · ' || (select v.title from public.product_variants v where v.id = nullif(cmd ->> 'variant_id', '')::uuid), ''),
      v_dept_id, v_dept_name, v_rate, v_label, v_price, v_qty, v_addons,
      nullif(left(btrim(cmd ->> 'note'), 200), ''), nullif(cmd ->> 'course', '')::integer, v_station, v_staff);
    update public.dining_checks set next_seq = v_seq + 1, version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'change_qty' then
    select * into l from public.check_lines where id = (cmd ->> 'line_id')::uuid and check_id = c.id for update;
    if l.id is null then raise exception 'lijn niet gevonden' using errcode = 'P0002'; end if;
    if l.state <> 'draft' then raise exception 'een verstuurde lijn wijzig je met annuleren' using errcode = '55000'; end if;
    v_qty := (cmd ->> 'qty')::integer;
    if v_qty is null or v_qty < 0 or v_qty > 999 then raise exception 'aantal ongeldig' using errcode = '22023'; end if;
    if v_qty = 0 then
      update public.check_lines set state = 'void', voided_by = v_staff, voided_at = now(), void_reason = 'draft_removed' where id = l.id;
    else
      update public.check_lines set qty = v_qty where id = l.id;
    end if;
    update public.dining_checks set version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'set_note' then
    select * into l from public.check_lines where id = (cmd ->> 'line_id')::uuid and check_id = c.id for update;
    if l.id is null or l.state <> 'draft' then raise exception 'enkel een nog niet verstuurde lijn' using errcode = '55000'; end if;
    update public.check_lines set note = nullif(left(btrim(cmd ->> 'note'), 200), ''), course = nullif(cmd ->> 'course', '')::integer where id = l.id;
    update public.dining_checks set version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'void_line' then
    -- Annuleren (TX-07). Ontwerp-lijn: gewoon weg. Verstuurde lijn: nieuwe negatieve
    -- CORRECTION-lijn als ontwerp, gaat met de volgende ronde naar keuken en FDM.
    select * into l from public.check_lines where id = (cmd ->> 'line_id')::uuid and check_id = c.id for update;
    if l.id is null then raise exception 'lijn niet gevonden' using errcode = 'P0002'; end if;
    if coalesce(cmd ->> 'reason', '') !~ '^(mistake|customer|broken|other)$' then raise exception 'reden verplicht' using errcode = '22023'; end if;
    if l.state = 'draft' then
      -- Ontwerp: weg. Hoort de lijn bij een kortingspaar (tegenboeking + nieuwe lijn), dan
      -- gaat het hele paar weg, anders blijft er een halve prijswijziging over.
      update public.check_lines set state = 'void', void_reason = cmd ->> 'reason', voided_by = v_staff, voided_at = now()
        where check_id = c.id and state = 'draft'
          and (id = l.id
               or (l.corrects_line_id is not null and corrects_line_id = l.corrects_line_id and (neg_reason = 'PRICE_CHANGE' or qty > 0)
                   and exists (select 1 from public.check_lines y where y.check_id = c.id and y.state = 'draft'
                               and y.corrects_line_id = l.corrects_line_id and y.neg_reason = 'PRICE_CHANGE')));
    elsif l.state = 'sent' and l.qty > 0 then
      if c.paying_until is not null and c.paying_until > now() then
        raise exception 'deze rekening wordt net afgerekend' using errcode = '55000';
      end if;
      v_qty := coalesce((cmd ->> 'qty')::integer, public.horeca_open_qty(l.id));
      if v_qty < 1 or v_qty > public.horeca_open_qty(l.id) then
        raise exception 'zoveel staat er niet meer open op deze lijn' using errcode = '22023';
      end if;
      v_seq := c.next_seq;
      insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
        vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, neg_reason, corrects_line_id, price_changes,
        void_reason, created_by)
      values ((cmd ->> 'new_line_id')::uuid, p_tenant_id, c.id, v_seq, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
        l.vat_rate, l.vat_label, l.unit_price_cents, -v_qty, l.addons, l.note, l.course, l.station_id, 'CORRECTION', l.id,
        (select coalesce(jsonb_agg(e || jsonb_build_object('amount_cents', -round((e ->> 'amount_cents')::numeric * v_qty / l.qty))), '[]'::jsonb)
           from jsonb_array_elements(l.price_changes) e),
        cmd ->> 'reason', v_staff);
      update public.dining_checks set next_seq = v_seq + 1 where id = c.id;
    else
      raise exception 'deze lijn kan je niet annuleren' using errcode = '55000';
    end if;
    update public.dining_checks set version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'discount_line' then
    -- Korting of "van het huis" op één lijn (TX-11, TX-13, TX-14). Op een ontwerp-lijn
    -- rechtstreeks; op een verstuurde lijn: tegenboeken (PRICE_CHANGE) + opnieuw boeken met
    -- korting, beide als ontwerp voor de volgende ronde.
    select * into l from public.check_lines where id = (cmd ->> 'line_id')::uuid and check_id = c.id for update;
    if l.id is null or l.qty < 0 or l.state = 'void' then raise exception 'lijn niet geschikt voor korting' using errcode = '22023'; end if;
    if l.state = 'sent' and public.horeca_open_qty(l.id) <> l.qty then raise exception 'deze lijn is (deels) geannuleerd of verplaatst' using errcode = '55000'; end if;
    v_gross := l.qty * l.unit_price_cents;
    v_pct := nullif(cmd ->> 'percent', '')::numeric;
    v_amount := case when v_pct is not null then round(v_gross * v_pct / 100) else (cmd ->> 'amount_cents')::integer end;
    if v_amount is null or v_amount <= 0 or v_amount > v_gross then raise exception 'korting tussen 0 en 100 %%' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(l.price_changes)) then raise exception 'deze lijn heeft al een korting' using errcode = '55000'; end if;
    v_pc := jsonb_build_array(jsonb_build_object('grouping_id', c.next_grouping_id, 'id', coalesce(cmd ->> 'discount_id', 'D'),
      'name', left(coalesce(nullif(btrim(cmd ->> 'name'), ''), 'Korting'), 40), 'scope', 'LINE', 'type', 'PUBLIC', 'amount_cents', -v_amount));
    if l.state = 'draft' then
      update public.check_lines set price_changes = v_pc where id = l.id;
    else
      -- TX-13: tegenboeking van het nog openstaande deel en een nieuwe lijn met de korting.
      v_seq := c.next_seq;
      insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
        vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, neg_reason, corrects_line_id, created_by)
      values ((cmd ->> 'neg_line_id')::uuid, p_tenant_id, c.id, v_seq, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
        l.vat_rate, l.vat_label, l.unit_price_cents, -l.qty, l.addons, l.note, l.course, l.station_id, 'PRICE_CHANGE', l.id, v_staff);
      insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
        vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, price_changes, corrects_line_id, created_by)
      values ((cmd ->> 'new_line_id')::uuid, p_tenant_id, c.id, v_seq + 1, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
        l.vat_rate, l.vat_label, l.unit_price_cents, l.qty, l.addons, l.note, l.course, l.station_id, v_pc, l.id, v_staff);
      update public.dining_checks set next_seq = v_seq + 2 where id = c.id;
    end if;
    update public.dining_checks set next_grouping_id = next_grouping_id + 1, version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'send_round' then
    -- Ronde = alle ontwerp-lijnen van deze rekening (EVT-06: enkel nieuwe/gewijzigde lijnen).
    -- fiscal_event_id: het ondertekende P/ORDER-event (in fiscale modus verplicht).
    if not exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft') then
      raise exception 'niets te versturen' using errcode = '55000';
    end if;
    -- Ronde = de ontwerp-lijnen (EVT-06: enkel nieuwe/gewijzigde lijnen).
    if nullif(cmd ->> 'fiscal_event_id', '') is not null and not exists (
      select 1 from public.fiscal_events f where f.id = (cmd ->> 'fiscal_event_id')::uuid and f.tenant_id = p_tenant_id and f.mutation = 'signOrder') then
      raise exception 'onbekend fiscaal event' using errcode = '22023';
    end if;
    -- Het toestel geeft mee welke lijnen het ondertekende: precies die gaan mee (een lijn die een
    -- collega intussen toevoegde, wacht op de volgende ronde). Elke opgegeven lijn moet een
    -- ontwerp-lijn van deze rekening zijn, anders klopt het ondertekende bericht niet meer.
    if cmd ? 'line_ids' then
      select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(cmd -> 'line_ids') x;
      if coalesce(array_length(v_ids, 1), 0) = 0 or (select count(*) from public.check_lines x
          where x.check_id = c.id and x.state = 'draft' and x.id = any(v_ids)) <> array_length(v_ids, 1) then
        raise exception 'de ronde is intussen gewijzigd' using errcode = '40001';
      end if;
    else
      select array_agg(x.id) into v_ids from public.check_lines x where x.check_id = c.id and x.state = 'draft';
    end if;
    select coalesce(max(r.seq), 0) + 1 into v_round_seq from public.check_rounds r where r.check_id = c.id;
    insert into public.check_rounds (id, tenant_id, check_id, seq, source, sent_by, fiscal_event_id)
    values ((cmd ->> 'round_id')::uuid, p_tenant_id, c.id, v_round_seq, 'staff', v_staff, nullif(cmd ->> 'fiscal_event_id', '')::uuid);
    -- Keukenbonnen per station (nooit bedragen, PRT-05).
    insert into public.kitchen_tickets (tenant_id, source, service_type, customer_label, table_label, check_id, round_id, station_id, items, paid, status)
    select p_tenant_id, 'table', 'eat_in',
      coalesce(c.name, (select t.label from public.dining_tables t where t.id = c.table_id)),
      (select t.label from public.dining_tables t where t.id = c.table_id),
      c.id, (cmd ->> 'round_id')::uuid, x.station_id,
      jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,
        'addons', (select coalesce(jsonb_agg(jsonb_build_object('name', a ->> 'name')), '[]'::jsonb) from jsonb_array_elements(x.addons) a))
        order by x.course nulls first, x.seq),
      false, 'new'
    from public.check_lines x
    where x.check_id = c.id and x.state = 'draft' and x.id = any(v_ids)
      -- Een korting verandert niets aan wat de keuken maakt: geen bon voor PRICE_CHANGE-paren.
      and x.neg_reason is distinct from 'PRICE_CHANGE' and not (x.corrects_line_id is not null and x.qty > 0)
    group by x.station_id;
    update public.check_lines set state = 'sent', round_id = (cmd ->> 'round_id')::uuid where check_id = c.id and state = 'draft' and id = any(v_ids);
    update public.dining_checks set version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'request_bill' then
    -- Voorlopige rekening (EVT-07/08): enkel als alles verstuurd is.
    if exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft') then
      raise exception 'eerst de open ronde versturen' using errcode = '55000';
    end if;
    update public.dining_checks set bill_requested_at = now(), version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'rename_check' then
    update public.dining_checks set name = nullif(btrim(cmd ->> 'name'), ''), guests = coalesce(nullif(cmd ->> 'guests', '')::integer, guests),
      version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'move_check' then
    -- Hele rekening naar een lege tafel (TBL-03: reference gaat mee) of naar een naam.
    v_table := nullif(cmd ->> 'to_table_id', '')::uuid;
    if v_table is not null then
      if not exists (select 1 from public.dining_tables t where t.id = v_table and t.tenant_id = p_tenant_id and t.is_active) then
        raise exception 'onbekende tafel' using errcode = '22023';
      end if;
      if exists (select 1 from public.dining_checks x where x.tenant_id = p_tenant_id and x.table_id = v_table and x.status = 'open' and x.split_of is null) then
        raise exception 'die tafel is bezet: kies samenvoegen' using errcode = '55000';
      end if;
    elsif coalesce(btrim(cmd ->> 'to_name'), '') = '' then
      raise exception 'kies een tafel of een naam' using errcode = '22023';
    end if;
    if c.split_of is not null then raise exception 'een deelrekening verplaats je niet: reken ze af of voeg ze samen' using errcode = '55000'; end if;
    -- Met open delen eerst die afrekenen of samenvoegen: anders verandert hun fiscale plaats
    -- (TABLE › CHAIR) zonder ondertekende verplaatsing.
    if exists (select 1 from public.dining_checks x where x.split_of = c.id and x.status = 'open') then
      raise exception 'er staan nog delen van deze rekening open: reken die eerst af of voeg ze samen' using errcode = '55000';
    end if;
    update public.dining_checks set table_id = v_table, name = case when v_table is null then btrim(cmd ->> 'to_name') else name end,
      version = version + 1, updated_at = now() where id = c.id;

  elsif v_kind = 'move_lines' then
    -- Lijnen (of de hele rekening) naar een andere rekening: splitsen of samenvoegen (TBL-03..05).
    -- Doel = bestaande open rekening (samenvoegen: haar reference) of nieuwe (eigen reference).
    -- Ontwerp-lijnen verhuizen gewoon; verstuurde lijnen worden fiscaal verplaatst: negatieve
    -- COST_CENTER_CHANGE-lijn hier, positieve kopie (met dezelfde korting) daar.
    select * into tgt from public.dining_checks where id = (cmd ->> 'to_check_id')::uuid and tenant_id = p_tenant_id for update;
    if tgt.id is null and coalesce((cmd ->> 'split')::boolean, false) then
      if c.split_of is not null then
        perform 1 from public.dining_checks r where r.id = c.split_of for update;
      end if;
      -- TAFEL-2: apart afrekenen = deelrekening van dezelfde tafel/naam. Een deel van een deel
      -- hangt aan de hoofdrekening (max. 2 niveaus costCenter, TBL-01).
      insert into public.dining_checks (id, tenant_id, table_id, name, opened_by, cost_center_reference, split_of, split_no)
      values ((cmd ->> 'to_check_id')::uuid, p_tenant_id, c.table_id,
              coalesce(nullif(btrim(cmd ->> 'to_name'), ''), c.name), v_staff, cmd ->> 'to_check_id',
              coalesce(c.split_of, c.id),
              -- Volgnummer enkel voor de weergave ("deel 2"); het fiscale CHAIR-id is de eigen
              -- reference. De hoofdrekening is vergrendeld, dus twee toestellen krijgen nooit
              -- hetzelfde nummer.
              (select coalesce(max(x.split_no), 0) + 1 from public.dining_checks x where x.split_of = coalesce(c.split_of, c.id) and x.status = 'open'))
      returning * into tgt;
    elsif tgt.id is null then
      v_table := nullif(cmd ->> 'to_table_id', '')::uuid;
      if v_table is not null and exists (select 1 from public.dining_checks x where x.tenant_id = p_tenant_id and x.table_id = v_table and x.status = 'open' and x.split_of is null) then
        raise exception 'die tafel is bezet: kies de rekening van die tafel' using errcode = '55000';
      end if;
      insert into public.dining_checks (id, tenant_id, table_id, name, opened_by, cost_center_reference)
      values ((cmd ->> 'to_check_id')::uuid, p_tenant_id, v_table, nullif(btrim(cmd ->> 'to_name'), ''), v_staff, cmd ->> 'to_check_id')
      returning * into tgt;
    end if;
    if tgt.status <> 'open' or tgt.id = c.id then raise exception 'doelrekening ongeldig' using errcode = '22023'; end if;
    if tgt.paying_until is not null and tgt.paying_until > now() then raise exception 'die rekening wordt net afgerekend' using errcode = '55000'; end if;
    for v_pc in select * from jsonb_array_elements(cmd -> 'moves') loop
      select * into l from public.check_lines where id = (v_pc ->> 'line_id')::uuid and check_id = c.id for update;
      if l.id is null or l.qty < 0 or l.state = 'void' then raise exception 'lijn niet verplaatsbaar' using errcode = '22023'; end if;
      v_qty := coalesce((v_pc ->> 'qty')::integer, case when l.state = 'draft' then l.qty else public.horeca_open_qty(l.id) end);
      if l.state = 'draft' then
        if v_qty <> l.qty then raise exception 'een nog niet verstuurde lijn verplaats je volledig' using errcode = '22023'; end if;
        -- Ontwerp: als nieuwe ontwerp-lijn op de doelrekening, origineel weg.
        update public.check_lines set state = 'void', void_reason = 'moved', voided_by = v_staff, voided_at = now() where id = l.id;
        insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
          vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, price_changes, created_by)
        values ((v_pc ->> 'to_line_id')::uuid, p_tenant_id, tgt.id, tgt.next_seq, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
          l.vat_rate, l.vat_label, l.unit_price_cents, l.qty, l.addons, l.note, l.course, l.station_id, l.price_changes, v_staff);
        update public.dining_checks set next_seq = next_seq + 1 where id = tgt.id returning * into tgt;
      else
        if v_qty < 1 or v_qty > public.horeca_open_qty(l.id) then
          raise exception 'zoveel staat er niet meer open op deze lijn' using errcode = '22023';
        end if;
        insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
          vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, state, round_id, neg_reason, corrects_line_id, price_changes, created_by)
        values ((v_pc ->> 'from_line_id')::uuid, p_tenant_id, c.id, c.next_seq, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
          l.vat_rate, l.vat_label, l.unit_price_cents, -v_qty, l.addons, l.note, l.course, l.station_id, 'sent', null, 'COST_CENTER_CHANGE', l.id,
          (select coalesce(jsonb_agg(e || jsonb_build_object('amount_cents', -round((e ->> 'amount_cents')::numeric * v_qty / l.qty))), '[]'::jsonb) from jsonb_array_elements(l.price_changes) e),
          v_staff);
        update public.dining_checks set next_seq = next_seq + 1 where id = c.id returning * into c;
        insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
          vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, state, round_id, price_changes, created_by)
        values ((v_pc ->> 'to_line_id')::uuid, p_tenant_id, tgt.id, tgt.next_seq, l.product_id, l.variant_id, l.name, l.department_id, l.department_name,
          l.vat_rate, l.vat_label, l.unit_price_cents, v_qty, l.addons, l.note, l.course, l.station_id, 'sent', null,
          (select coalesce(jsonb_agg(e || jsonb_build_object('amount_cents', round((e ->> 'amount_cents')::numeric * v_qty / l.qty))), '[]'::jsonb) from jsonb_array_elements(l.price_changes) e),
          v_staff);
        update public.dining_checks set next_seq = next_seq + 1 where id = tgt.id returning * into tgt;
      end if;
    end loop;
    if nullif(cmd ->> 'fiscal_event_id', '') is not null and not exists (
      select 1 from public.fiscal_events f where f.id = (cmd ->> 'fiscal_event_id')::uuid and f.tenant_id = p_tenant_id and f.mutation = 'signCostCenterChange') then
      raise exception 'onbekend fiscaal event' using errcode = '22023';
    end if;
    update public.dining_checks set version = version + 1, updated_at = now() where id in (c.id, tgt.id);
    -- Bron leeg (alles verplaatst, niets meer open)? Dan sluit ze: een verplaatste tafel is geen verkoop.
    if coalesce((select sum(x.qty) from public.check_lines x where x.check_id = c.id and x.state <> 'void'), 0) = 0 then
      update public.dining_checks set status = 'closed', closed_at = now() where id = c.id;
    end if;
    return jsonb_build_object('id', v_id, 'ok', true, 'check', public.horeca_check_json(c.id), 'target', public.horeca_check_json(tgt.id));

  elsif v_kind = 'void_check' then
    -- Een rekening zonder verstuurde lijnen mag weg (niets fiscaals gebeurd).
    if exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'sent') then
      raise exception 'er is al iets verstuurd: annuleer de lijnen' using errcode = '55000';
    end if;
    update public.check_lines set state = 'void', void_reason = 'check_voided', voided_by = v_staff, voided_at = now() where check_id = c.id and state = 'draft';
    update public.dining_checks set status = 'void', closed_at = now(), version = version + 1, updated_at = now() where id = c.id;

  else
    raise exception 'onbekend commando %', v_kind using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_id, 'ok', true, 'check', public.horeca_check_json(c.id));
end;
$$;
revoke all on function public.horeca_apply_one(uuid, jsonb) from public, anon, authenticated;

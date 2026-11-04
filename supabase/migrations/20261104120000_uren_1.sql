-- UREN-1 — openingsuren van de zaak: één weekschema + uitzonderlijke sluitingsdagen, op één plek
-- (Instellingen › Bedrijf). Afhalen, leveren en online reserveren nemen ze standaard over.
--
--  * business_hours (nieuw, één rij per zaak): week (zelfde vorm als fulfillment_settings.hours per soort:
--    {"1": [["11:30","14:00"],["17:30","22:00"]], ...}, 0 = zondag; "tot" vóór "van" = tot na middernacht),
--    closures ([{"from":"2026-12-24","to":"2026-12-26","reason":"Kerstvakantie"}]) en timezone.
--    Bewust NIET op tenant_theme_settings: elke kolom daar stroomt via select('*') naar alle eigen frontends.
--  * fulfillment_settings.pickup_hours_mode / delivery_hours_mode en reservation_settings.online_hours_mode:
--    'business' = zelfde als de openingsuren, 'own' = eigen uren. NULL = afgeleid uit de bestaande data:
--    eigen uren ingevuld → 'own', anders 'business'. Geen enkele bestaande rij wordt overschreven.
--  * reservation_slots: volgt de keuze, en de sluitingsdagen komen uit business_hours.closures.
--  * Bestaande sluitingsdagen (fulfillment_settings.closed_dates, PAUSE-1) die nog komen, worden gekopieerd
--    naar business_hours.closures. De kolom blijft staan (DB-safety) maar wordt na deze batch niet meer gelezen.
--    Live op 4-11-2026: 0 rijen met closed_dates, dus de kopie is vandaag leeg. Ze is herhaalbaar: draai
--    blok 5 opnieuw na de publish van sellqo.app (vangt een datum die in het oude scherm bijkwam).
--
-- RLS: lezen voor leden van de zaak, schrijven enkel voor tenant_admin (zoals Instellingen › Bedrijf op
-- tenants en zoals fulfillment_settings). Geen anon-policy: de publieke site leest via storefront-api
-- (service role).
--
-- Idempotent (if not exists / create or replace / drop policy if exists; de kopie voegt enkel ontbrekende
-- datums toe). Handmatig terugdraaien:
--   reservation_slots: de definitie uit 20261030220000_reservatie_2.sql opnieuw uitvoeren;
--   drop table public.business_hours;
--   drop function public.business_hours_week_valid(jsonb), public.business_closures_valid(jsonb),
--     public.hours_week_has_ranges(jsonb);
--   de drie *_hours_mode-kolommen mogen blijven staan (NULL = oud gedrag zodra de code teruggedraaid is).

-- ── 1. Validatie (ook als CHECK-constraint) ─────────────────────────────────────────────────────────────
create or replace function public.business_hours_week_valid(p jsonb)
returns boolean
language plpgsql
immutable
set search_path to ''
as $fn$
declare
  k text;
  v jsonb;
  r jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if k !~ '^[0-6]$' or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 3 then return false; end if;
    for r in select * from jsonb_array_elements(v) loop
      if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> 2
         or coalesce(r ->> 0, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(r ->> 1, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or r ->> 0 = r ->> 1 then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end
$fn$;

create or replace function public.business_closures_valid(p jsonb)
returns boolean
language plpgsql
immutable
set search_path to ''
as $fn$
declare
  c jsonb;
  d1 date;
  d2 date;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 100 then return false; end if;
  for c in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(c) <> 'object'
       or coalesce(c ->> 'from', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(c ->> 'to', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or (c ? 'reason' and jsonb_typeof(c -> 'reason') not in ('string', 'null'))
       or char_length(coalesce(c ->> 'reason', '')) > 80 then
      return false;
    end if;
    begin
      d1 := make_date(substr(c ->> 'from', 1, 4)::int, substr(c ->> 'from', 6, 2)::int, substr(c ->> 'from', 9, 2)::int);
      d2 := make_date(substr(c ->> 'to', 1, 4)::int, substr(c ->> 'to', 6, 2)::int, substr(c ->> 'to', 9, 2)::int);
    exception when others then
      return false;
    end;
    if d2 < d1 or d2 - d1 > 366 then return false; end if;
  end loop;
  return true;
end
$fn$;

-- Staat er in een weekschema minstens één uurblok? (afleiding van de *_hours_mode als die NULL is)
create or replace function public.hours_week_has_ranges(p jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $fn$
  select coalesce(jsonb_typeof(p) = 'object', false) and exists (
    select 1 from jsonb_each(p) d, jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) r
     where jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 2
       and (r ->> 0) ~ '^\d{1,2}:\d{2}$' and (r ->> 1) ~ '^\d{1,2}:\d{2}$');
$fn$;

-- ── 2. Tabel ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.business_hours (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  week jsonb not null default '{}'::jsonb,
  closures jsonb not null default '[]'::jsonb,
  timezone text not null default 'Europe/Brussels',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_hours_week_check') then
    alter table public.business_hours add constraint business_hours_week_check check (public.business_hours_week_valid(week));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_hours_closures_check') then
    alter table public.business_hours add constraint business_hours_closures_check check (public.business_closures_valid(closures));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_hours_timezone_check') then
    alter table public.business_hours add constraint business_hours_timezone_check check (timezone ~ '^[A-Za-z]+(/[A-Za-z_+-]+){1,2}$');
  end if;
end $$;

drop trigger if exists trg_business_hours_updated_at on public.business_hours;
create trigger trg_business_hours_updated_at before update on public.business_hours
  for each row execute function public.update_updated_at_column();

alter table public.business_hours enable row level security;
drop policy if exists business_hours_select on public.business_hours;
create policy business_hours_select on public.business_hours for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists business_hours_write on public.business_hours;
create policy business_hours_write on public.business_hours for all to authenticated
  using (public.is_platform_admin(auth.uid())
         or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::public.app_role])))
  with check (public.is_platform_admin(auth.uid())
         or (tenant_id in (select public.get_user_tenant_ids(auth.uid())) and public.has_tenant_role(tenant_id, array['tenant_admin'::public.app_role])));
revoke all on public.business_hours from anon;
grant select, insert, update, delete on public.business_hours to authenticated;
grant all on public.business_hours to service_role;

-- ── 3. Keuze per soort: zelfde als de openingsuren of eigen uren (NULL = afgeleid) ─────────────────────
alter table public.fulfillment_settings add column if not exists pickup_hours_mode text;
alter table public.fulfillment_settings add column if not exists delivery_hours_mode text;
alter table public.reservation_settings add column if not exists online_hours_mode text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fulfillment_settings_pickup_hours_mode_check') then
    alter table public.fulfillment_settings add constraint fulfillment_settings_pickup_hours_mode_check
      check (pickup_hours_mode is null or pickup_hours_mode in ('business', 'own'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fulfillment_settings_delivery_hours_mode_check') then
    alter table public.fulfillment_settings add constraint fulfillment_settings_delivery_hours_mode_check
      check (delivery_hours_mode is null or delivery_hours_mode in ('business', 'own'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_settings_online_hours_mode_check') then
    alter table public.reservation_settings add constraint reservation_settings_online_hours_mode_check
      check (online_hours_mode is null or online_hours_mode in ('business', 'own'));
  end if;
end $$;

-- ── 4. Online reserveren volgt de keuze ─────────────────────────────────────────────────────────────────
-- 'own' (eigen uren): zoals RESERVATIE-2, eerste en laatste aankomstuur (laatste inbegrepen).
-- 'business' (zelfde als openingsuren): aankomen vanaf het openingsuur tot vóór het sluitingsuur; een blok
-- "tot" vóór "van" loopt door tot na middernacht (de staart hoort bij de volgende kalenderdag).
-- Sluitingsdagen: business_hours.closures (niet meer fulfillment_settings.closed_dates, zie blok 5).
create or replace function public.reservation_slots(p_tenant_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  s public.reservation_settings%rowtype;
  bh public.business_hours%rowtype;
  v_tz text;
  v_today date;
  v_mode text;
  v_blocks jsonb := '[]'::jsonb;  -- [[van, tot, inclusief], ...]
  v_ranges jsonb;
  v_range jsonb;
  v_block jsonb;
  v_t time;
  v_end time;
  v_incl boolean;
  v_at timestamptz;
  v_taken integer;
  v_slots jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
begin
  select * into s from public.reservation_settings where tenant_id = p_tenant_id;
  if s.tenant_id is null or not s.online_enabled then
    return jsonb_build_object('enabled', false, 'slots', '[]'::jsonb);
  end if;
  select * into bh from public.business_hours where tenant_id = p_tenant_id;
  select coalesce(nullif(f.timezone, ''), 'Europe/Brussels') into v_tz from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  v_tz := coalesce(v_tz, nullif(bh.timezone, ''), 'Europe/Brussels');
  v_today := (now() at time zone v_tz)::date;
  if p_date is null or p_date < v_today or p_date > v_today + s.days_ahead
     or exists (select 1 from jsonb_array_elements(coalesce(bh.closures, '[]'::jsonb)) c
                 where p_date between (c ->> 'from')::date and (c ->> 'to')::date) then
    return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', '[]'::jsonb);
  end if;

  v_mode := coalesce(s.online_hours_mode, case when public.hours_week_has_ranges(s.online_hours) then 'own' else 'business' end);
  if v_mode = 'own' then
    v_ranges := coalesce(s.online_hours -> extract(dow from p_date)::int::text, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
    for v_range in select * from jsonb_array_elements(v_ranges) loop
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_array(v_range ->> 0, v_range ->> 1, true));
    end loop;
  else
    -- Blokken van vandaag (over middernacht: tot 24:00) …
    v_ranges := coalesce(bh.week -> extract(dow from p_date)::int::text, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
    for v_range in select * from jsonb_array_elements(v_ranges) loop
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_array(v_range ->> 0,
        case when (v_range ->> 1) < (v_range ->> 0) then '24:00' else v_range ->> 1 end, false));
    end loop;
    -- … en de staart van gisteren na middernacht.
    v_ranges := coalesce(bh.week -> ((extract(dow from p_date)::int + 6) % 7)::text, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
    for v_range in select * from jsonb_array_elements(v_ranges) loop
      if (v_range ->> 1) < (v_range ->> 0) then
        v_blocks := v_blocks || jsonb_build_array(jsonb_build_array('00:00', v_range ->> 1, false));
      end if;
    end loop;
  end if;

  for v_block in select * from jsonb_array_elements(v_blocks) loop
    begin
      v_t := (v_block ->> 0)::time;
      v_end := (v_block ->> 1)::time;
      v_incl := (v_block ->> 2)::boolean;
    exception when others then
      continue;
    end;
    while (v_incl and v_t <= v_end) or (not v_incl and v_t < v_end) loop
      v_at := (p_date + v_t) at time zone v_tz;
      if v_at >= now() + make_interval(mins => s.min_notice_minutes) and not (to_char(v_t, 'HH24:MI') = any(v_seen)) then
        v_seen := v_seen || to_char(v_t, 'HH24:MI');
        select coalesce(sum(r.guests), 0) into v_taken from public.table_reservations r
         where r.tenant_id = p_tenant_id and r.starts_at = v_at and r.status in ('requested', 'booked', 'seated');
        if v_taken < s.max_guests_per_slot then
          v_slots := v_slots || jsonb_build_array(jsonb_build_object('time', to_char(v_t, 'HH24:MI'), 'left', s.max_guests_per_slot - v_taken));
        end if;
      end if;
      exit when v_t + make_interval(mins => s.slot_minutes) <= v_t; -- over middernacht: stoppen
      v_t := v_t + make_interval(mins => s.slot_minutes);
    end loop;
  end loop;
  -- Op tijd gesorteerd (een staart van gisteren komt vóór de blokken van vandaag).
  select coalesce(jsonb_agg(x order by x ->> 'time'), '[]'::jsonb) into v_slots from jsonb_array_elements(v_slots) x;
  return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', v_slots);
end
$fn$;
revoke all on function public.reservation_slots(uuid, date) from public, anon, authenticated;
grant execute on function public.reservation_slots(uuid, date) to service_role;

-- ── 5. Bestaande sluitingsdagen (PAUSE-1) kopiëren — herhaalbaar, voegt enkel ontbrekende datums toe ──────
insert into public.business_hours (tenant_id, closures)
select f.tenant_id, '[]'::jsonb
  from public.fulfillment_settings f
 where exists (select 1 from unnest(f.closed_dates) d where d >= current_date)
on conflict (tenant_id) do nothing;

update public.business_hours bh
   set closures = bh.closures || x.add
  from (
    select f.tenant_id,
           jsonb_agg(jsonb_build_object('from', to_char(d, 'YYYY-MM-DD'), 'to', to_char(d, 'YYYY-MM-DD'), 'reason', null) order by d) as add
      from public.fulfillment_settings f, unnest(f.closed_dates) d
     where d >= current_date
       and not exists (select 1 from public.business_hours b, jsonb_array_elements(b.closures) c
                        where b.tenant_id = f.tenant_id and d between (c ->> 'from')::date and (c ->> 'to')::date)
     group by f.tenant_id
  ) x
 where bh.tenant_id = x.tenant_id;

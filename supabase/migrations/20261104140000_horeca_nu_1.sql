-- HORECA-NU-1 + HORECA-NU-2 — het "Nu"-paneel voor de cafébaas tijdens de dienst, met twee nieuwe
-- schakelaars: een zone (terras) open of dicht, en de dagschotel.
--
--  1. dining_areas.is_open (nieuw, standaard true): een zone tijdelijk dicht. Los van is_active: een
--     verwijderde ruimte blijft verwijderd, een dichte ruimte blijft bestaan en het personeel werkt er
--     gewoon op verder. storefront-api weigert bestellen en oproepen aan een tafel in een dichte zone
--     (ZONE_CLOSED). Schrijven: zoals het zaalplan (dining_areas_update: tenant_admin of staff).
--  2. products.daily_special_until (nieuw, null = geen dagschotel): tot wanneer het product dagschotel is.
--     Zelfde dag als "op voor vandaag" (sold_out_until): sold_out_reset_at(), de volgende 05:00 Brussel.
--     Daarna vervalt het vanzelf. Geen eigen prijs: de dagschotel is een gewoon product van de kaart.
--  3. set_product_daily_special / clear_daily_specials (security invoker: de RLS op products beslist, zoals
--     set_product_sold_out_today).
--  4. business_hours_close_today (security invoker: enkel tenant_admin via business_hours_write): vandaag
--     uitzonderlijk dicht of terug open, als een sluitingsdag van één dag in business_hours.closures.
--     Zelfde vorm als het urenscherm ({from,to,reason}); een periode wordt nooit aangeraakt.
--     "Vroeger dicht" (een sluitingsuur voor vandaag) zit hier bewust NIET in: zie de role-audit.
--  5. kassa_now_state / kassa_now_apply (security definer): de "Nu"-tegels op het kassatoestel. Het toestel
--     heeft enkel leesrechten (KASSA-ACCOUNT-1), dus schrijven gaat via deze ene smalle functie:
--     kassa_can_operate(zaak, toestel) én een eigenaar/verantwoordelijke (sessietoken van precies die
--     medewerker, of goedkeurder + PIN met dezelfde lockout als kassa_product_quick_edit). Acties: keuken
--     pauzeren (0/15/30/60 min), zone open/dicht, dagschotel aan/uit/allemaal uit, op voor vandaag. Elke
--     wijziging komt in fiscal_audit_log (append-only, enkel insert). Geen fiscaal event.
--
-- Fiscaal: niets. Geen kasticket, geen FDM-bericht, geen prijs. De dagschotel wordt aangeslagen als het
-- gewone product, aan de gewone prijs.
--
-- Idempotent (add column if not exists, create or replace, snapshot "if not exists").
-- Handmatig terugdraaien (in deze volgorde):
--   drop function if exists public.kassa_now_apply(uuid, text, jsonb), public.kassa_now_state(uuid),
--     public.business_hours_close_today(uuid, boolean, text), public.clear_daily_specials(uuid),
--     public.set_product_daily_special(uuid, boolean);
--   drop index if exists public.products_daily_special_idx;
--   De twee kolommen mogen blijven staan (DB-safety: een kolom droppen is onomkeerbaar). Wie ze toch weg
--   wil: eerst controleren dat geen code ze nog leest (storefront-api, _shared/diningTables.ts, kassa).
--   Dichte zones heropenen: update public.dining_areas set is_open = true where is_open = false;

-- 0. Snapshot vooraf (enkel ter controle) ----------------------------------------------------------------
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_horeca_nu_1_dining_areas as
  select a.id, a.tenant_id, a.name, a.is_active, a.updated_at, now() as taken_at from public.dining_areas a;
revoke all on snapshots.sellqo_20261104_horeca_nu_1_dining_areas from anon, authenticated;

-- 1. Zone open of dicht -----------------------------------------------------------------------------------
alter table public.dining_areas add column if not exists is_open boolean not null default true;
comment on column public.dining_areas.is_open is
  'HORECA-NU-2a: false = zone tijdelijk dicht (QR-bestellen en oproepen geweigerd met ZONE_CLOSED; personeel werkt er wel op). Los van is_active.';

-- 2. Dagschotel -------------------------------------------------------------------------------------------
alter table public.products add column if not exists daily_special_until timestamptz;
comment on column public.products.daily_special_until is
  'HORECA-NU-2b: dagschotel tot dit moment (sold_out_reset_at(), volgende 05:00 Brussel). null of voorbij = geen dagschotel. Geen eigen prijs.';
create index if not exists products_daily_special_idx on public.products (tenant_id) where daily_special_until is not null;

-- 3. Dagschotel aan of uit (admin). Security invoker: de gewone RLS op products bepaalt wie het mag.
create or replace function public.set_product_daily_special(p_product_id uuid, p_on boolean)
returns timestamptz
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare v timestamptz;
begin
  update public.products
     set daily_special_until = case when p_on then public.sold_out_reset_at() else null end
   where id = p_product_id
  returning daily_special_until into v;
  if not found then raise exception 'Product niet gevonden' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function public.set_product_daily_special(uuid, boolean) from public, anon;
grant execute on function public.set_product_daily_special(uuid, boolean) to authenticated, service_role;

-- "Geen dagschotel vandaag": alle dagschotels van de zaak uit. Geeft het aantal terug.
create or replace function public.clear_daily_specials(p_tenant_id uuid)
returns integer
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare n integer;
begin
  update public.products set daily_special_until = null
   where tenant_id = p_tenant_id and daily_special_until is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.clear_daily_specials(uuid) from public, anon;
grant execute on function public.clear_daily_specials(uuid) to authenticated, service_role;

-- 4. Vandaag uitzonderlijk dicht (of terug open). "Vandaag" = de lokale datum in de tijdzone van de zaak
-- (business_hours.timezone, anders fulfillment_settings.timezone, anders Brussel), zoals storefront-api.
-- Dicht: een sluiting {from: vandaag, to: vandaag, reason} erbij, tenzij er al zo'n dag staat.
-- Terug open: enkel sluitingen van precies vandaag (één dag) gaan weg; een periode blijft staan (die beheer
-- je in Instellingen › Openingsuren). Geeft {day, closed, period} terug: period = vandaag valt in een periode.
create or replace function public.business_hours_close_today(p_tenant_id uuid, p_closed boolean, p_reason text default null)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tz text;
  v_day text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_obj jsonb;
  v_closures jsonb;
begin
  if p_tenant_id is null then raise exception 'zaak ontbreekt' using errcode = '22023'; end if;
  select coalesce(
           (select b.timezone from public.business_hours b where b.tenant_id = p_tenant_id),
           (select f.timezone from public.fulfillment_settings f where f.tenant_id = p_tenant_id),
           'Europe/Brussels')
    into v_tz;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then v_tz := 'Europe/Brussels'; end if;
  v_day := to_char((now() at time zone v_tz)::date, 'YYYY-MM-DD');
  v_obj := jsonb_build_object('from', v_day, 'to', v_day, 'reason', left(v_reason, 80));

  if p_closed then
    insert into public.business_hours as b (tenant_id, closures)
    values (p_tenant_id, jsonb_build_array(v_obj))
    on conflict (tenant_id) do update
      set closures = case
        when exists (select 1 from jsonb_array_elements(b.closures) c where c ->> 'from' = v_day and c ->> 'to' = v_day) then b.closures
        else b.closures || jsonb_build_array(v_obj) end;
  else
    update public.business_hours b
       set closures = coalesce((select jsonb_agg(c) from jsonb_array_elements(b.closures) c
                                 where not (c ->> 'from' = v_day and c ->> 'to' = v_day)), '[]'::jsonb)
     where b.tenant_id = p_tenant_id
       and exists (select 1 from jsonb_array_elements(b.closures) c where c ->> 'from' = v_day and c ->> 'to' = v_day);
  end if;

  -- Wat er nu staat (ook als RLS de schrijfactie stil weigerde: dan zie je de oude stand).
  select b.closures into v_closures from public.business_hours b where b.tenant_id = p_tenant_id;
  return jsonb_build_object(
    'day', v_day,
    'closed', coalesce((select bool_or(c ->> 'from' <= v_day and c ->> 'to' >= v_day) from jsonb_array_elements(coalesce(v_closures, '[]'::jsonb)) c), false),
    'period', coalesce((select bool_or(c ->> 'from' <= v_day and c ->> 'to' >= v_day and c ->> 'from' <> c ->> 'to') from jsonb_array_elements(coalesce(v_closures, '[]'::jsonb)) c), false));
end $$;
revoke all on function public.business_hours_close_today(uuid, boolean, text) from public, anon;
grant execute on function public.business_hours_close_today(uuid, boolean, text) to authenticated, service_role;

-- 5a. Kassa: wat het toestel niet zelf mag lezen (tenant_theme_settings heeft geen toestelpolicy).
-- online = de webshop staat online én online bestellen staat aan (enkel dan valt er iets te pauzeren).
create or replace function public.kassa_now_state(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.kassa_can_operate(p_tenant_id) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'online', coalesce((select ts.shop_live and ts.shop_ordering from public.tenant_theme_settings ts where ts.tenant_id = p_tenant_id), false),
    'paused_until', (select f.paused_until from public.fulfillment_settings f where f.tenant_id = p_tenant_id));
end $$;
revoke all on function public.kassa_now_state(uuid) from public, anon;
grant execute on function public.kassa_now_state(uuid) to authenticated;

-- 5b. Kassa: één "Nu"-handeling. p = {kind, staff_id, staff_token | approver_id + pin, ...}:
--   pause       {minutes: 0|15|30|60}            0 = hervatten
--   area        {area_id, open: bool}
--   special     {product_id, on: bool}
--   special_clear {}
--   sold_out    {product_id, sold_out: bool}
-- Mag enkel een eigenaar/verantwoordelijke: met een geldig sessietoken van precies die medewerker, of met
-- de PIN van een goedkeurder (zelfde controle en lockout als kassa_product_quick_edit).
create or replace function public.kassa_now_apply(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c public.pos_cashiers%rowtype;
  v_kind text := coalesce(p ->> 'kind', '');
  v_staff uuid;
  v_by uuid;
  v_id uuid;
  v_until timestamptz;
  v_n integer;
  v_details jsonb;
  v_dev text;
begin
  if not public.kassa_can_operate(p_tenant_id, p_device_id) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  -- HORECA-NU-1b — device_id voor het auditspoor: bij een kassatoestel (niet-ingetrokken rij in
  -- kassa_device_accounts voor auth.uid()) zijn device_uuid, precies wat de insert-policy van KASSA-ACCOUNT-1
  -- voor een toestel eist; anders genormaliseerd (lower). Deze definer-functie omzeilt RLS, dus de waarde
  -- moet hier zelf kloppen.
  select a.device_uuid into v_dev from public.kassa_device_accounts a
   where a.user_id = auth.uid() and a.revoked_at is null and a.tenant_id = p_tenant_id;
  v_dev := coalesce(v_dev, left(lower(coalesce(p_device_id, '')), 120));
  if jsonb_typeof(coalesce(p, 'null'::jsonb)) <> 'object' or v_kind not in ('pause', 'area', 'special', 'special_clear', 'sold_out') then
    raise exception 'onbekende handeling' using errcode = '22023';
  end if;
  -- Wie het startte (de medewerker met de PIN op het toestel); enkel voor het spoor.
  if coalesce(p ->> 'staff_id', '') ~ '^[0-9a-f-]{36}$' then
    select x.id into v_by from public.pos_cashiers x where x.id = (p ->> 'staff_id')::uuid and x.tenant_id = p_tenant_id;
  end if;

  -- Eigenaar of verantwoordelijke zelf aan de kassa: enkel met een geldig sessietoken van die medewerker.
  if v_by is not null and exists (select 1 from public.pos_cashiers s where s.id = v_by and s.tenant_id = p_tenant_id
                                    and s.is_active and coalesce(s.can_use_pos, true) and s.role in ('owner', 'manager'))
     and public.kassa_staff_session_valid(p_tenant_id, v_by, p ->> 'staff_token') then
    v_staff := v_by;
  else
    if coalesce(p ->> 'approver_id', '') !~ '^[0-9a-f-]{36}$' then
      raise exception 'akkoord van een eigenaar of verantwoordelijke nodig' using errcode = '42501';
    end if;
    select * into c from public.pos_cashiers x where x.id = (p ->> 'approver_id')::uuid and x.tenant_id = p_tenant_id for update;
    if c.id is null or not c.is_active or not coalesce(c.can_use_pos, true) then raise exception 'onbekende medewerker' using errcode = '22023'; end if;
    if c.role not in ('owner', 'manager') then
      raise exception 'enkel een eigenaar of verantwoordelijke' using errcode = '42501';
    end if;
    if c.locked_until is not null and c.locked_until > now() then
      raise exception 'pin geblokkeerd tot %', c.locked_until using errcode = '28000';
    end if;
    if coalesce(p ->> 'pin', '') = '' or c.pin_hash is null or c.pin_hash <> crypt(p ->> 'pin', c.pin_hash) then
      -- Zelfde lockout als kassa_staff_login. Geen exception: anders rolt de teller terug.
      update public.pos_cashiers set
        failed_pin_attempts = case when c.failed_pin_attempts + 1 >= 5 then 0 else c.failed_pin_attempts + 1 end,
        locked_until = case when c.failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
      where id = c.id;
      insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
        values (p_tenant_id, auth.uid(), v_dev, 'pin_failed',
                jsonb_build_object('staff_id', c.id, 'attempt', c.failed_pin_attempts + 1, 'context', 'kassa_now'));
      return jsonb_build_object('ok', false, 'reason', case when c.failed_pin_attempts + 1 >= 5 then 'locked' else 'wrong_pin' end);
    end if;
    update public.pos_cashiers set failed_pin_attempts = 0, locked_until = null where id = c.id and (failed_pin_attempts <> 0 or locked_until is not null);
    v_staff := c.id;
  end if;

  if v_kind = 'pause' then
    if coalesce(p ->> 'minutes', '') not in ('0', '15', '30', '60') then raise exception 'minuten: 0, 15, 30 of 60' using errcode = '22023'; end if;
    v_until := case when (p ->> 'minutes')::int = 0 then null else now() + make_interval(mins => (p ->> 'minutes')::int) end;
    insert into public.fulfillment_settings as f (tenant_id, paused_until, updated_at)
    values (p_tenant_id, v_until, now())
    on conflict (tenant_id) do update set paused_until = excluded.paused_until, updated_at = now();
    v_details := jsonb_build_object('paused_until', v_until);
  elsif v_kind = 'area' then
    if coalesce(p ->> 'area_id', '') !~ '^[0-9a-f-]{36}$' or coalesce(jsonb_typeof(p -> 'open'), '') <> 'boolean' then
      raise exception 'zone en open zijn verplicht' using errcode = '22023';
    end if;
    update public.dining_areas set is_open = (p ->> 'open')::boolean
     where id = (p ->> 'area_id')::uuid and tenant_id = p_tenant_id and is_active
    returning id into v_id;
    if v_id is null then raise exception 'onbekende zone' using errcode = '22023'; end if;
    v_details := jsonb_build_object('area_id', v_id, 'open', (p ->> 'open')::boolean);
  elsif v_kind in ('special', 'sold_out') then
    if coalesce(p ->> 'product_id', '') !~ '^[0-9a-f-]{36}$' then raise exception 'product is verplicht' using errcode = '22023'; end if;
    if v_kind = 'special' and coalesce(jsonb_typeof(p -> 'on'), '') <> 'boolean' then raise exception 'on: waar of onwaar' using errcode = '22023'; end if;
    if v_kind = 'sold_out' and coalesce(jsonb_typeof(p -> 'sold_out'), '') <> 'boolean' then raise exception 'sold_out: waar of onwaar' using errcode = '22023'; end if;
    -- Tenant van de eigen rij: nooit een product van een andere zaak.
    if v_kind = 'special' then
      update public.products
         set daily_special_until = case when (p ->> 'on')::boolean then public.sold_out_reset_at() else null end
       where id = (p ->> 'product_id')::uuid and tenant_id = p_tenant_id
      returning id, daily_special_until into v_id, v_until;
    else
      update public.products
         set sold_out_until = case when (p ->> 'sold_out')::boolean then public.sold_out_reset_at() else null end
       where id = (p ->> 'product_id')::uuid and tenant_id = p_tenant_id
      returning id, sold_out_until into v_id, v_until;
    end if;
    if v_id is null then raise exception 'onbekend product' using errcode = '22023'; end if;
    v_details := jsonb_build_object('product_id', v_id, 'until', v_until);
  else -- special_clear
    update public.products set daily_special_until = null where tenant_id = p_tenant_id and daily_special_until is not null;
    get diagnostics v_n = row_count;
    v_details := jsonb_build_object('cleared', v_n);
  end if;

  insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
    values (p_tenant_id, auth.uid(), v_dev, 'kassa_now',
            v_details || jsonb_build_object('kind', v_kind, 'approver_id', v_staff, 'staff_id', coalesce(v_by, v_staff)));
  return jsonb_build_object('ok', true, 'kind', v_kind) || v_details;
end;
$$;
revoke all on function public.kassa_now_apply(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_now_apply(uuid, text, jsonb) to authenticated;

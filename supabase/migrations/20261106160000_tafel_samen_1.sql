-- TAFEL-SAMEN-1 — één gedeeld tafelmandje per gezelschap, en nooit de rekening van vorige gasten.
--
-- Probleem (De Wissel, 06-11): elke gsm aan tafel had een eigen mandje, wat de ene gsm doorgaf zag de andere
-- niet, en de gastweergave van de rekening (table_check_view) toonde álle lijnen van de open tafelrekening,
-- ook die van gisteren en van vorige gasten.
--
-- Model: een tafelgroep (table_guest_groups) = het gezelschap dat nu aan een zaalplan-tafel zit.
--   - Per tafel hoogstens één actieve groep (Akke 06-11: 1 rekening per tafel, 1 groep per tafel; twee
--     gezelschappen aan één tafel = aparte tafels/stickers). Afgedwongen met een partiële unieke index.
--   - Wie de QR van de tafel scant terwijl er een groep actief is, sluit aan bij die groep.
--   - Een groep eindigt lui (in de functies hieronder, geen cron): bij de dagreset (05:00 Brussel), als haar
--     rekening aan de kassa gesloten is (enkel als er iets van deze groep op stond), met "Tafel vrijgeven" in Zaal
--     (table_group_release), of na qr_group_idle_minutes zonder activiteit (standaard 120) — dat laatste enkel
--     als de groep niets meer openstaan heeft (Akke 06-11: 1 rekening per tafel). Een nieuwe groep start enkel
--     met een verse scan van de QR-code; wie vertrok, sluit nooit vanzelf aan bij de volgende gasten.
--   - De groep heeft één gedeeld mandje (cart_id, session_id 'tafelgroep:<id>'). Na het doorgeven krijgt de
--     groep een nieuw, leeg mandje (in dezelfde transactie): leeg voor iedereen.
--   - De groep ziet enkel lijnen van de tafelrekening die ná haar start zijn aangemaakt (QR én personeel),
--     nooit lijnen van vóór de start. Staan er nog lijnen van vóór de start open, dan is de rekening "gemengd":
--     gelijk delen kan dan niet, en Zaal/Nu tonen een waarschuwing.
--
-- Fiscaal verandert niets: de rekening (dining_checks) blijft één per tafel, lijnen komen er zoals vandaag op
-- via horeca_table_request_accept op de kassa. Niet aangeraakt: src/kassa, horeca_apply(_one), horeca_snapshot,
-- horeca_check_json, horeca_pay*, horeca_table_request_accept/reject, dining_checks/check_lines/check_rounds,
-- dining_checks_open_table_uq. table_request_place, table_check_view en table_check_pay_* blijven byte-gelijk:
-- de nieuwe functies roepen ze aan of spiegelen hun logica (enkel lezend).
--
-- Additief en idempotent: nieuwe tabel, nieuwe functies, nullable kolom op table_requests, twee kolommen met
-- default op fulfillment_settings. Geen secrets.
--
-- Handmatig terugdraaien:
--   drop function if exists public.table_group_release(uuid, uuid), public.horeca_table_groups(uuid),
--     public.table_group_cart_put(uuid, uuid, uuid, text, jsonb, timestamptz),
--     public.table_group_request_place(uuid, uuid, uuid, uuid, text, text, text, timestamptz),
--     public.table_group_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer, timestamptz),
--     public.table_group_view(uuid, uuid, timestamptz), public.table_check_view_since(uuid, uuid, timestamptz),
--     public.table_group_lines_view(uuid, uuid, timestamptz, uuid, timestamptz), public.table_group_state(uuid, uuid, uuid, timestamptz),
--     public.table_group_join(uuid, uuid, uuid, uuid, timestamptz, boolean), public.table_group_settle(uuid, uuid, timestamptz),
--     public.table_group_new_cart(uuid, uuid), public.table_group_end_reason(public.table_guest_groups, timestamptz, integer),
--     public.table_group_has_open(public.table_guest_groups, uuid), public.table_group_hidden_open(uuid, uuid, timestamptz, uuid),
--     public.table_group_other_lines(uuid, uuid, uuid), public.table_group_cur_check(public.table_guest_groups),
--     public.table_group_last_reset(timestamptz);
--   drop table if exists public.table_guest_groups;
--   alter table public.table_requests drop column if exists group_id;
--   alter table public.fulfillment_settings drop column if exists qr_shared_cart, drop column if exists qr_group_idle_minutes;

-- 1. Instellingen (Instellingen › Horeca › QR) ------------------------------------------------------
alter table public.fulfillment_settings add column if not exists qr_shared_cart boolean not null default true;
alter table public.fulfillment_settings add column if not exists qr_group_idle_minutes integer not null default 120;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.fulfillment_settings'::regclass and conname = 'fulfillment_settings_qr_group_idle_check') then
    alter table public.fulfillment_settings add constraint fulfillment_settings_qr_group_idle_check check (qr_group_idle_minutes between 30 and 480);
  end if;
end
$mig$;
comment on column public.fulfillment_settings.qr_shared_cart is 'TAFEL-SAMEN-1: één gedeeld mandje per tafelgroep (QR op de tafelrekening).';
comment on column public.fulfillment_settings.qr_group_idle_minutes is 'TAFEL-SAMEN-1: een tafelgroep eindigt na zoveel minuten zonder activiteit.';

-- 2. Tafelgroepen ------------------------------------------------------------------------------------
create table if not exists public.table_guest_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dining_table_id uuid not null references public.dining_tables(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  -- idle_new_guest: verse scan door nieuwe gasten na lange stilte terwijl de vorige nog iets openstaan hadden (R1).
  ended_reason text check (ended_reason is null or ended_reason in ('idle', 'idle_new_guest', 'day_reset', 'check_closed', 'staff_release')),
  -- Het gedeelde mandje (shopping). Roteert bij elk doorgeven. Null als het gedeelde mandje uit staat.
  cart_id uuid,
  -- De open hoofdrekening van de tafel zoals laatst gezien (lui bijgewerkt); gesloten = groep afgelopen.
  check_id uuid,
  -- +1 bij elke wijziging aan mandje of rondes: goedkope poll voor de gsm's aan tafel.
  version bigint not null default 1,
  constraint table_guest_groups_end check ((ended_at is null) = (ended_reason is null))
);
comment on table public.table_guest_groups is 'TAFEL-SAMEN-1: het gezelschap aan een zaalplan-tafel (QR). Eén actieve groep per tafel; gedeeld mandje en enkel eigen lijnen.';
-- Eén actieve groep per tafel.
create unique index if not exists table_guest_groups_active_uq on public.table_guest_groups (tenant_id, dining_table_id) where ended_at is null;
create index if not exists table_guest_groups_tenant_idx on public.table_guest_groups (tenant_id, started_at);

revoke all on public.table_guest_groups from anon, authenticated;
grant select on public.table_guest_groups to authenticated;
alter table public.table_guest_groups enable row level security;
drop policy if exists table_guest_groups_select on public.table_guest_groups;
create policy table_guest_groups_select on public.table_guest_groups for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
-- Schrijven enkel via de security-definer-functies hieronder.

alter table public.table_requests add column if not exists group_id uuid;
create index if not exists table_requests_group_idx on public.table_requests (group_id) where group_id is not null;
comment on column public.table_requests.group_id is 'TAFEL-SAMEN-1: tafelgroep die deze aanvraag doorgaf (de kassa negeert dit veld).';

-- 3. Hulpfuncties ------------------------------------------------------------------------------------
-- De laatste dagreset (05:00 Brussel) op of vóór p_now. Gerekend in lokale tijd (review B2): "min één dag"
-- op een timestamptz hangt af van de TimeZone van de sessie en schuift rond de zomer-/wintertijd een uur.
create or replace function public.table_group_last_reset(p_now timestamptz)
returns timestamptz
language sql
stable
set search_path to ''
as $$
  select ((public.sold_out_reset_at(p_now) at time zone 'Europe/Brussels') - interval '1 day') at time zone 'Europe/Brussels';
$$;
revoke all on function public.table_group_last_reset(timestamptz) from public, anon;
grant execute on function public.table_group_last_reset(timestamptz) to authenticated, service_role;

-- De rekening die de groep ziet: de open hoofdrekening van haar tafel; heeft de tafel er geen (bv. de kassa
-- verplaatste de rekening naar een andere tafel), dan haar laatst geziene rekening als die nog open is.
create or replace function public.table_group_cur_check(g public.table_guest_groups)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select c.id from public.dining_checks c
      where c.tenant_id = g.tenant_id and c.table_id = g.dining_table_id and c.status = 'open' and c.split_of is null
      order by c.opened_at limit 1),
    (select c.id from public.dining_checks c where c.id = g.check_id and c.tenant_id = g.tenant_id and c.status = 'open'));
$$;
revoke all on function public.table_group_cur_check(public.table_guest_groups) from public, anon, authenticated;
grant execute on function public.table_group_cur_check(public.table_guest_groups) to service_role;

-- Lijnen op een rekening die horen bij een aanvraag van een andere groep dan p_group_id.
create or replace function public.table_group_other_lines(p_tenant_id uuid, p_check_id uuid, p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(distinct li), '{}')
    from public.table_requests r, unnest(coalesce(r.line_ids, '{}')) li
   where r.tenant_id = p_tenant_id and r.check_id = p_check_id and r.group_id is not null
     and r.group_id is distinct from p_group_id;
$$;
revoke all on function public.table_group_other_lines(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.table_group_other_lines(uuid, uuid, uuid) to service_role;

-- Aantal open lijnen op de rekening die de groep NIET ziet (van vóór haar start, of van een andere groep).
-- Eén bron voor "gemengd" in de gastweergave en "Lijnen van vorige gasten" in Zaal (review K5).
create or replace function public.table_group_hidden_open(p_tenant_id uuid, p_check_id uuid, p_since timestamptz, p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::integer
    from public.check_lines x
   where x.check_id = p_check_id and x.tenant_id = p_tenant_id and x.state = 'sent' and x.qty > 0 and x.corrects_line_id is null
     and not (x.created_at >= p_since and not (x.id = any(public.table_group_other_lines(p_tenant_id, p_check_id, p_group_id))))
     and public.horeca_open_qty(x.id) > 0;
$$;
revoke all on function public.table_group_hidden_open(uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.table_group_hidden_open(uuid, uuid, timestamptz, uuid) to service_role;

-- Heeft de groep nog iets openstaan? Eigen lijnen (verstuurd of ontwerp) met een open aantal op haar rekening, of
-- een aanvraag die de kassa nog moet bevestigen. Zo'n groep loopt niet af door inactiviteit (review B4).
create or replace function public.table_group_has_open(g public.table_guest_groups, p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.table_requests r where r.group_id = g.id and r.status = 'pending')
      or (p_check_id is not null and exists (
            select 1 from public.check_lines x
             where x.check_id = p_check_id and x.tenant_id = g.tenant_id and x.state <> 'void' and x.qty > 0 and x.corrects_line_id is null
               and x.created_at >= g.started_at
               and not (x.id = any(public.table_group_other_lines(g.tenant_id, p_check_id, g.id)))
               and public.horeca_open_qty(x.id) > 0));
$$;
revoke all on function public.table_group_has_open(public.table_guest_groups, uuid) from public, anon, authenticated;
grant execute on function public.table_group_has_open(public.table_guest_groups, uuid) to service_role;

-- Laatste activiteit van een groep: toevoegen, doorgeven, betalen, paginalading (last_activity_at), een bevestiging
-- aan de kassa (decided_at) of een nieuwe lijn van de groep op haar rekening.
create or replace function public.table_group_last_activity(g public.table_guest_groups)
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $$
  select greatest(g.last_activity_at,
    (select max(r.decided_at) from public.table_requests r where r.group_id = g.id),
    (select max(x.created_at) from public.check_lines x
      where x.check_id = public.table_group_cur_check(g) and x.created_at >= g.started_at));
$$;
revoke all on function public.table_group_last_activity(public.table_guest_groups) from public, anon, authenticated;
grant execute on function public.table_group_last_activity(public.table_guest_groups) to service_role;

-- Waarom is deze (actieve) groep afgelopen, of null.
--   day_reset    — gestart vóór de laatste dagreset (05:00 Brussel);
--   check_closed — haar rekening is niet meer open én er stond iets van deze groep op (een lijn van na haar start
--                  of een aanvraag van haar). Een oude rekening van vorige gasten afsluiten raakt de groep niet (B3);
--   idle         — geen activiteit (toevoegen, doorgeven, betalen, paginalading, bevestiging aan de kassa, nieuwe
--                  lijn) gedurende p_idle_minutes, en enkel als de groep niets meer openstaan heeft (B4).
create or replace function public.table_group_end_reason(g public.table_guest_groups, p_now timestamptz, p_idle_minutes integer)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  k uuid;
  cur uuid;
  last_act timestamptz;
begin
  if g.ended_at is not null then return g.ended_reason; end if;
  if g.started_at < public.table_group_last_reset(p_now) then return 'day_reset'; end if;
  k := coalesce(g.check_id, (select r.check_id from public.table_requests r
                              where r.group_id = g.id and r.check_id is not null order by r.decided_at desc nulls last limit 1));
  if k is not null
     and not exists (select 1 from public.dining_checks c where c.id = k and c.status = 'open')
     and (exists (select 1 from public.check_lines x where x.check_id = k and x.created_at >= g.started_at)
          or exists (select 1 from public.table_requests r where r.group_id = g.id and r.check_id = k)) then
    return 'check_closed';
  end if;
  cur := public.table_group_cur_check(g);
  last_act := public.table_group_last_activity(g);
  if last_act + make_interval(mins => coalesce(p_idle_minutes, 120)) < p_now and not public.table_group_has_open(g, cur) then
    return 'idle';
  end if;
  return null;
end;
$$;
revoke all on function public.table_group_end_reason(public.table_guest_groups, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.table_group_end_reason(public.table_guest_groups, timestamptz, integer) to service_role;

-- Nieuw, leeg gedeeld mandje voor een groep (session_id uniek per groep zolang het 'shopping' is).
create or replace function public.table_group_new_cart(p_tenant_id uuid, p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v uuid;
begin
  select c.id into v from public.storefront_carts c
   where c.tenant_id = p_tenant_id and c.session_id = 'tafelgroep:' || p_group_id::text and c.checkout_status = 'shopping'
     and c.expires_at > now()
   limit 1;
  if v is not null then return v; end if;
  -- Een verlopen mandje met dezelfde sessie blokkeert de unieke index: loslaten.
  update public.storefront_carts set checkout_status = 'abandoned'
   where tenant_id = p_tenant_id and session_id = 'tafelgroep:' || p_group_id::text and checkout_status = 'shopping';
  insert into public.storefront_carts (tenant_id, session_id, currency, expires_at)
  values (p_tenant_id, 'tafelgroep:' || p_group_id::text, 'EUR', now() + interval '1 day')
  returning id into v;
  return v;
end;
$$;
revoke all on function public.table_group_new_cart(uuid, uuid) from public, anon, authenticated;
grant execute on function public.table_group_new_cart(uuid, uuid) to service_role;

-- De actieve groep van een tafel, na lui afsluiten. Neemt een slot per tafel (twee scans tegelijk = één groep)
-- en een rijlock op de groep. Werkt check_id bij: naar de open hoofdrekening van de tafel, of op null als de
-- laatst geziene rekening dicht is zonder iets van deze groep (B3). Null = geen groep.
create or replace function public.table_group_settle(p_tenant_id uuid, p_table_id uuid, p_now timestamptz)
returns public.table_guest_groups
language plpgsql
security definer
set search_path to ''
as $$
declare
  g public.table_guest_groups%rowtype;
  v_idle integer;
  v_reason text;
  v_cur uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('table_group:' || p_tenant_id::text || ':' || p_table_id::text, 0));
  select * into g from public.table_guest_groups x
   where x.tenant_id = p_tenant_id and x.dining_table_id = p_table_id and x.ended_at is null
   for update;
  if g.id is null then return null; end if;
  select coalesce(f.qr_group_idle_minutes, 120) into v_idle from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  v_reason := public.table_group_end_reason(g, p_now, v_idle);
  if v_reason is not null then
    update public.table_guest_groups set
      ended_reason = v_reason,
      ended_at = case v_reason when 'day_reset' then least(p_now, public.table_group_last_reset(p_now)) else p_now end,
      version = version + 1
     where id = g.id;
    -- Het gedeelde mandje van een afgelopen groep wordt niet meer gebruikt.
    if g.cart_id is not null then
      update public.storefront_carts set checkout_status = 'abandoned' where id = g.cart_id and checkout_status = 'shopping';
    end if;
    return null;
  end if;
  select c.id into v_cur from public.dining_checks c
   where c.tenant_id = p_tenant_id and c.table_id = p_table_id and c.status = 'open' and c.split_of is null
   order by c.opened_at limit 1;
  if v_cur is not null and g.check_id is distinct from v_cur then
    update public.table_guest_groups set check_id = v_cur where id = g.id;
    g.check_id := v_cur;
  elsif v_cur is null and g.check_id is not null
        and not exists (select 1 from public.dining_checks c where c.id = g.check_id and c.status = 'open') then
    -- Dicht zonder iets van deze groep (de rekening van vorige gasten): loslaten, de groep loopt door.
    update public.table_guest_groups set check_id = null where id = g.id;
    g.check_id := null;
  end if;
  return g;
end;
$$;
revoke all on function public.table_group_settle(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_settle(uuid, uuid, timestamptz) to service_role;

-- 4. Aansluiten (storefront-api, bij paginalading aan tafel) -------------------------------------------------
-- Eén actieve groep per tafel. p_group_id = de groep uit de cookie van deze gsm, p_link = de groep uit een
-- deellink, p_fresh_scan = de QR-code (?t=) werd bij DEZE paginalading gescand.
--   - lid van de actieve groep → 'member' (geen scan nodig);
--   - deellink (p_link): enkel als die de actieve groep is en mét de QR-token → 'link'; anders 'LINK_EXPIRED' (R2);
--   - anders enkel met een verse scan: aansluiten bij de actieve groep ('joined') of een nieuwe starten. Is de
--     actieve groep al langer dan qr_group_idle_minutes stil, dan zijn dit nieuwe gasten: de oude groep eindigt
--     ('idle_new_guest') en er start een nieuwe (R1);
--   - zonder verse scan nooit aansluiten of een groep maken (review B1): wie vertrok en later zijn oude tab of de
--     terugkeer van Stripe opent, ziet niets van de volgende gasten. reason 'PREVIOUS_ENDED' (eigen groep
--     afgelopen) of 'SCAN_REQUIRED' (geen groep); de storefront wist dan de tafelcookies.
create or replace function public.table_group_join(p_tenant_id uuid, p_table_id uuid, p_group_id uuid, p_link uuid,
  p_now timestamptz default now(), p_fresh_scan boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  fs record;
  t record;
  g public.table_guest_groups%rowtype;
  v_joined text;
  v_cart_ok boolean;
begin
  select coalesce(f.qr_mode, 'view') as qr_mode, coalesce(f.qr_flow, 'order') as qr_flow, coalesce(f.qr_shared_cart, true) as shared,
         coalesce(f.qr_group_idle_minutes, 120) as idle
    into fs from (select 1) x left join public.fulfillment_settings f on f.tenant_id = p_tenant_id;
  if fs.qr_mode <> 'order' or fs.qr_flow <> 'check' then
    return jsonb_build_object('group_id', null, 'reason', 'TABLE_GROUPS_OFF');
  end if;
  select d.id, d.label into t from public.dining_tables d where d.id = p_table_id and d.tenant_id = p_tenant_id and d.is_active;
  if t.id is null then raise exception 'TABLE_NOT_FOUND' using errcode = 'P0002'; end if;

  g := public.table_group_settle(p_tenant_id, p_table_id, p_now);
  if g.id is not null and p_group_id is not null and p_group_id = g.id then
    v_joined := 'member';
  elsif p_link is not null then
    -- Deellink: enkel geldig voor de actieve groep van deze tafel, en enkel met de QR-token erbij (R2).
    if g.id is null or p_link <> g.id or not coalesce(p_fresh_scan, false) then
      return jsonb_build_object('group_id', null, 'reason', 'LINK_EXPIRED');
    end if;
    v_joined := 'link';
  elsif not coalesce(p_fresh_scan, false) then
    return jsonb_build_object('group_id', null, 'reason', case when p_group_id is not null then 'PREVIOUS_ENDED' else 'SCAN_REQUIRED' end);
  else
    -- R1: verse scan door een toestel dat geen lid is. Is de actieve groep al langer dan qr_group_idle_minutes stil
    -- (ook met openstaande lijnen: gasten die vertrokken zonder te betalen), dan zijn dit nieuwe gasten: de oude
    -- groep eindigt ('idle_new_guest'), haar open lijnen worden "lijnen van vorige gasten" (verborgen, Zaal waarschuwt).
    if g.id is not null and public.table_group_last_activity(g) + make_interval(mins => fs.idle) < p_now then
      update public.table_guest_groups set ended_at = p_now, ended_reason = 'idle_new_guest', version = version + 1 where id = g.id;
      if g.cart_id is not null then
        update public.storefront_carts set checkout_status = 'abandoned' where id = g.cart_id and checkout_status = 'shopping';
      end if;
      perform public.horeca_bump(p_tenant_id);
      g := null;
    end if;
    if g.id is null then
      insert into public.table_guest_groups (tenant_id, dining_table_id, started_at, last_activity_at)
      values (p_tenant_id, p_table_id, p_now, p_now)
      returning * into g;
      -- De open rekening die er al staat (bv. van vorige gasten) is wel de rekening van deze tafel; de groep
      -- ziet er enkel de lijnen van ná haar start van.
      update public.table_guest_groups set check_id = (
        select c.id from public.dining_checks c where c.tenant_id = p_tenant_id and c.table_id = p_table_id
           and c.status = 'open' and c.split_of is null order by c.opened_at limit 1)
       where id = g.id returning * into g;
      v_joined := 'new';
    else
      v_joined := 'joined';
    end if;
  end if;

  if fs.shared then
    v_cart_ok := g.cart_id is not null and exists (select 1 from public.storefront_carts c where c.id = g.cart_id
                   and c.checkout_status = 'shopping' and c.expires_at > p_now);
    if not v_cart_ok then g.cart_id := public.table_group_new_cart(p_tenant_id, g.id); end if;
  end if;
  update public.table_guest_groups set last_activity_at = greatest(last_activity_at, p_now), cart_id = g.cart_id
   where id = g.id returning * into g;

  return jsonb_build_object(
    'group_id', g.id, 'started_at', g.started_at, 'joined', v_joined, 'shared', fs.shared,
    'cart_id', case when fs.shared then g.cart_id end, 'version', g.version, 'table_label', t.label,
    'previous_ended', p_group_id is not null and p_group_id <> g.id);
end;
$$;
revoke all on function public.table_group_join(uuid, uuid, uuid, uuid, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.table_group_join(uuid, uuid, uuid, uuid, timestamptz, boolean) to service_role;

-- 5. Goedkope poll ---------------------------------------------------------------------------------------
-- Lezend (review K6): geen slot of rijlock, tenzij de groep afgelopen is of haar rekening wisselde (dan
-- table_group_settle). Geen activiteit: de achtergrondpoll houdt een groep niet in leven. ended = true → de
-- storefront meldt dat het bezoek afgesloten is. hv = horeca_state.version (stand van aanvragen en rekening).
create or replace function public.table_group_state(p_tenant_id uuid, p_table_id uuid, p_group_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  g public.table_guest_groups%rowtype;
  v_shared boolean;
  v_idle integer;
begin
  select * into g from public.table_guest_groups x
   where x.id = p_group_id and x.tenant_id = p_tenant_id and x.dining_table_id = p_table_id and x.ended_at is null;
  if g.id is null then return jsonb_build_object('ended', true); end if;
  select coalesce(f.qr_shared_cart, true), coalesce(f.qr_group_idle_minutes, 120) into v_shared, v_idle
    from (select 1) x left join public.fulfillment_settings f on f.tenant_id = p_tenant_id;
  -- R5: vergelijken met de rekening die de groep ziet (table_group_cur_check), zodat een rekening die de kassa naar
  -- een andere tafel verplaatste de poll niet telkens laat vergrendelen.
  if public.table_group_end_reason(g, p_now, v_idle) is not null or public.table_group_cur_check(g) is distinct from g.check_id then
    g := public.table_group_settle(p_tenant_id, p_table_id, p_now);
    if g.id is null or g.id <> p_group_id then return jsonb_build_object('ended', true); end if;
  end if;
  return jsonb_build_object(
    'ended', false, 'group_id', g.id, 'version', g.version, 'started_at', g.started_at, 'shared', v_shared,
    'cart_id', case when v_shared then g.cart_id end,
    'item_count', case when v_shared then coalesce((select sum(i.quantity) from public.storefront_cart_items i where i.cart_id = g.cart_id), 0) end,
    'open_requests', (select count(*) from public.table_requests r where r.group_id = g.id and r.status = 'pending'),
    'hv', coalesce((select s.version from public.horeca_state s where s.tenant_id = p_tenant_id), 0));
end;
$$;
revoke all on function public.table_group_state(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_state(uuid, uuid, uuid, timestamptz) to service_role;

-- 6. Rekening voor de groep ------------------------------------------------------------------------------
-- Zelfde vorm als table_check_view (zelfde berekening per lijn: horeca_open_qty, horeca_line_part_cents,
-- vasthoudingen uit check_online_payments), op rekening p_check_id, maar enkel de lijnen die zichtbaar zijn:
--   zichtbaar = aangemaakt op of na p_since, en niet van een aanvraag van een andere groep.
-- Correcties (corrects_line_id) volgen hun originele lijn. Extra velden: mixed (er staan nog onzichtbare lijnen
-- open, table_group_hidden_open), hidden_open, since, settings.share (gelijk delen: split aan en niet gemengd),
-- settings.pay_note. Bij een gemengde rekening:
--   - telt het online voorschot (gelijk delen) niet mee in de weergave;
--   - kan online betalen enkel via "mijn items"/"alles van jullie" (= lijnen). Dat vraagt splitsen aan en geen
--     voorschot op de rekening (table_check_pay_start weigert anders); zo niet, dan online_pay uit met
--     pay_note 'mixed_ask_staff' (review B7, K2).
create or replace function public.table_group_lines_view(p_tenant_id uuid, p_check_id uuid, p_since timestamptz, p_group_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  s record;
  c public.dining_checks%rowtype;
  v_total bigint;
  v_held_share bigint;
  v_stripe boolean;
  v_fiscal boolean;
  v_hidden integer;
  v_mixed boolean;
  v_other uuid[];
  v_pay boolean;
  v_note text;
begin
  select coalesce(h.online_pay, false) as online_pay, coalesce(h.online_tip, true) as online_tip, coalesce(h.online_split, true) as online_split
    into s from (select 1) x left join public.horeca_pay_settings h on h.tenant_id = p_tenant_id;
  select coalesce(t.stripe_charges_enabled, false) and t.stripe_account_id is not null into v_stripe from public.tenants t where t.id = p_tenant_id;
  v_fiscal := public.horeca_tenant_fiscal(p_tenant_id);
  v_pay := s.online_pay and v_stripe and not v_fiscal;
  if p_check_id is not null then
    select * into c from public.dining_checks x where x.id = p_check_id and x.tenant_id = p_tenant_id and x.status = 'open';
  end if;
  if c.id is null then
    return jsonb_build_object('check', null, 'since', p_since, 'settings', jsonb_build_object('online_pay', v_pay,
      'tip', s.online_tip, 'split', s.online_split, 'share', s.online_split, 'pay_note', null));
  end if;
  v_other := public.table_group_other_lines(p_tenant_id, c.id, p_group_id);
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total
    from public.check_lines x
    join public.check_lines o on o.id = coalesce(x.corrects_line_id, x.id)
   where x.check_id = c.id and x.state = 'sent'
     and o.created_at >= p_since and not (o.id = any(v_other));
  v_hidden := public.table_group_hidden_open(p_tenant_id, c.id, p_since, p_group_id);
  v_mixed := v_hidden > 0;
  if v_pay and v_mixed and (not s.online_split or c.online_credit_cents > 0) then
    v_pay := false;
    v_note := 'mixed_ask_staff';
  end if;
  select coalesce(sum(o.amount_cents), 0) into v_held_share from public.check_online_payments o
   where o.check_id = c.id and o.status = 'pending' and o.hold_until > p_now and o.kind in ('share', 'full');
  return jsonb_build_object(
    'since', p_since,
    'check', jsonb_build_object(
      'id', c.id, 'opened_at', c.opened_at,
      'total_cents', v_total,
      'credit_cents', case when v_mixed then 0 else c.online_credit_cents end,
      'remaining_cents', greatest(v_total - case when v_mixed then 0 else c.online_credit_cents end, 0),
      'held_cents', case when v_mixed then 0 else v_held_share end,
      'has_drafts', exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft' and x.created_at >= p_since),
      'open_splits', (select count(*) from public.dining_checks y where y.split_of = c.id and y.status = 'open'),
      'pending_kinds', coalesce((select jsonb_agg(distinct o.kind) from public.check_online_payments o
                                  where o.check_id = c.id and o.status = 'pending' and o.hold_until > p_now), '[]'::jsonb),
      'mixed', v_mixed,
      'hidden_open', v_hidden,
      'lines', coalesce((select jsonb_agg(jsonb_build_object(
          'id', q.id, 'name', q.name, 'addons', q.addons, 'open_qty', q.open_qty, 'held_qty', q.held_qty,
          'created_at', q.created_at,
          'unit_cents', public.horeca_line_part_cents(q.l, 1),
          'open_cents', public.horeca_line_part_cents(q.l, q.open_qty),
          'part_cents', (select jsonb_agg(public.horeca_line_part_cents(q.l, g) order by g) from generate_series(1, q.open_qty) g)) order by q.seq)
        from (
          select x.id, x.seq, x.name, x.created_at, x as l,
                 coalesce((select jsonb_agg(a ->> 'name') from jsonb_array_elements(x.addons) a), '[]'::jsonb) as addons,
                 public.horeca_open_qty(x.id) as open_qty,
                 coalesce((select sum((e ->> 'qty')::integer) from public.check_online_payments o, jsonb_array_elements(o.lines) e
                            where o.check_id = c.id and o.status = 'pending' and o.hold_until > p_now and o.kind = 'lines'
                              and e ->> 'line_id' = x.id::text), 0) as held_qty
          from public.check_lines x
          where x.check_id = c.id and x.state = 'sent' and x.qty > 0 and x.corrects_line_id is null
            and x.created_at >= p_since and not (x.id = any(v_other))
        ) q where q.open_qty > 0), '[]'::jsonb)),
    'settings', jsonb_build_object('online_pay', v_pay, 'tip', s.online_tip,
      'split', s.online_split, 'share', s.online_split and not v_mixed, 'pay_note', v_note));
end;
$$;
revoke all on function public.table_group_lines_view(uuid, uuid, timestamptz, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_lines_view(uuid, uuid, timestamptz, uuid, timestamptz) to service_role;

-- De rekening zoals de groep ze ziet (table_group_cur_check, review K4). Groep afgelopen → ended.
create or replace function public.table_group_view(p_tenant_id uuid, p_group_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  g0 public.table_guest_groups%rowtype;
  g public.table_guest_groups%rowtype;
begin
  select * into g0 from public.table_guest_groups x where x.id = p_group_id and x.tenant_id = p_tenant_id;
  if g0.id is null then return jsonb_build_object('ended', true); end if;
  g := public.table_group_settle(p_tenant_id, g0.dining_table_id, p_now);
  if g.id is null or g.id <> p_group_id then return jsonb_build_object('ended', true); end if;
  return public.table_group_lines_view(p_tenant_id, public.table_group_cur_check(g), g.started_at, g.id, p_now)
    || jsonb_build_object('ended', false, 'group', jsonb_build_object('id', g.id, 'started_at', g.started_at, 'version', g.version));
end;
$$;
revoke all on function public.table_group_view(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_view(uuid, uuid, timestamptz) to service_role;

-- Vangnet voor table_check_get/table_check_pay zonder groep (oude tabbladen): enkel lijnen van na de laatste dagreset.
create or replace function public.table_check_view_since(p_tenant_id uuid, p_table_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select public.table_group_lines_view(p_tenant_id,
    (select c.id from public.dining_checks c where c.tenant_id = p_tenant_id and c.table_id = p_table_id and c.status = 'open' and c.split_of is null
      order by c.opened_at limit 1),
    public.table_group_last_reset(p_now), null, p_now);
$$;
revoke all on function public.table_check_view_since(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.table_check_view_since(uuid, uuid, timestamptz) to service_role;

-- Online betalen door de groep (review B6): één transactie. Rekening van de tafel FOR UPDATE, dan in dezelfde
-- transactie de lijnen van de groep en "gemengd" bepalen, dan de ONGEWIJZIGDE table_check_pay_start:
--   lines — elke lijn moet van de groep zijn (CHECK_LINES_CHANGED);
--   share — enkel als niet gemengd (CHECK_PAY_NO_SHARE);
--   full  — niet gemengd: het bestaande "alles"; gemengd: "lines" met alle vrije lijnen van de groep. Meer dan
--           60 lijnen: CHECK_PAY_TOO_MANY (nooit stil afkappen, K1).
-- Gemengd en splitsen uit of al een voorschot op de rekening: CHECK_PAY_MIXED (vraag de rekening, B7/K2).
-- Idempotent: een bestaande betaling-ID gaat met haar eigen soort en lijnen naar table_check_pay_start.
create or replace function public.table_group_pay_start(p_tenant_id uuid, p_group_id uuid, p_payment_id uuid, p_kind text, p_lines jsonb,
  p_share_n integer, p_share_k integer, p_tip_cents integer, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  prior public.check_online_payments%rowtype;
  g0 public.table_guest_groups%rowtype;
  g public.table_guest_groups%rowtype;
  c public.dining_checks%rowtype;
  s record;
  v jsonb;
  v_mixed boolean;
  v_kind text := p_kind;
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  e jsonb;
begin
  if p_payment_id is null or p_kind not in ('full', 'lines', 'share') then raise exception 'CHECK_PAY_INVALID' using errcode = '22023'; end if;
  select * into g0 from public.table_guest_groups x where x.id = p_group_id and x.tenant_id = p_tenant_id;
  if g0.id is null then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  select * into prior from public.check_online_payments where id = p_payment_id;
  if prior.id is not null then
    return public.table_check_pay_start(p_tenant_id, g0.dining_table_id, p_payment_id, prior.kind, prior.lines, prior.share_n, prior.share_k, prior.tip_cents);
  end if;
  g := public.table_group_settle(p_tenant_id, g0.dining_table_id, p_now);
  if g.id is null or g.id <> p_group_id then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  select * into c from public.dining_checks x
   where x.tenant_id = p_tenant_id and x.table_id = g.dining_table_id and x.status = 'open' and x.split_of is null
   order by x.opened_at limit 1 for update;
  if c.id is null then raise exception 'CHECK_NOT_FOUND' using errcode = 'P0002'; end if;
  v := public.table_group_lines_view(p_tenant_id, c.id, g.started_at, g.id, p_now);
  v_mixed := coalesce((v -> 'check' ->> 'mixed')::boolean, false);
  select coalesce(h.online_split, true) as online_split into s from (select 1) x left join public.horeca_pay_settings h on h.tenant_id = p_tenant_id;
  if v_mixed and (not s.online_split or c.online_credit_cents > 0) then raise exception 'CHECK_PAY_MIXED' using errcode = '55000'; end if;
  if p_kind = 'lines' then
    for e in select * from jsonb_array_elements(v_lines) loop
      if not ((v -> 'check' -> 'lines') @> jsonb_build_array(jsonb_build_object('id', e ->> 'line_id'))) then
        raise exception 'CHECK_LINES_CHANGED' using errcode = '40001';
      end if;
    end loop;
  elsif v_mixed and p_kind = 'share' then
    raise exception 'CHECK_PAY_NO_SHARE' using errcode = '55000';
  elsif v_mixed then
    select coalesce(jsonb_agg(jsonb_build_object('line_id', l ->> 'id', 'qty', (l ->> 'open_qty')::integer - (l ->> 'held_qty')::integer)), '[]'::jsonb)
      into v_lines
      from jsonb_array_elements(v -> 'check' -> 'lines') l
     where (l ->> 'open_qty')::integer - (l ->> 'held_qty')::integer > 0;
    if jsonb_array_length(v_lines) = 0 then
      if exists (select 1 from jsonb_array_elements(v -> 'check' -> 'lines') l where (l ->> 'held_qty')::integer > 0) then
        raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
      end if;
      raise exception 'CHECK_NOTHING_OPEN' using errcode = '55000';
    end if;
    if jsonb_array_length(v_lines) > 60 then raise exception 'CHECK_PAY_TOO_MANY' using errcode = '54000'; end if;
    v_kind := 'lines';
  end if;
  update public.table_guest_groups set last_activity_at = greatest(last_activity_at, p_now) where id = g.id;
  return public.table_check_pay_start(p_tenant_id, g.dining_table_id, p_payment_id, v_kind, v_lines, p_share_n, p_share_k, p_tip_cents);
end;
$$;
revoke all on function public.table_group_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer, timestamptz) to service_role;

-- 7. Doorgeven (gedeeld mandje → tafelaanvraag) ---------------------------------------------------------------
-- Groep vergrendelen → table_request_place (ongewijzigd, vergrendelt het mandje) → group_id op de aanvraag →
-- nieuw leeg mandje voor de groep. Eén transactie: wie tegelijk toevoegt (table_group_cart_put wacht op de
-- groep) komt ofwel mee in deze ronde, ofwel in het nieuwe mandje. Idempotent op p_request_id.
-- p_cart_id: gedeeld mandje aan = het mandje dat de gsm toonde; is dat intussen doorgegeven door een tafelgenoot,
-- dan JUST_SENT ("Net doorgegeven door je tafelgenoot", review K7). Gedeeld mandje uit = het mandje van de gsm.
create or replace function public.table_group_request_place(
  p_tenant_id uuid, p_group_id uuid, p_request_id uuid, p_cart_id uuid, p_table_label text, p_guest_name text, p_note text,
  p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  g0 public.table_guest_groups%rowtype;
  g public.table_guest_groups%rowtype;
  prior public.table_requests%rowtype;
  v_shared boolean;
  v_cart uuid;
  r jsonb;
begin
  if p_request_id is null or p_group_id is null then raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023'; end if;
  -- Idempotent: dezelfde aanvraag opnieuw (netwerk, dubbel tikken) = hetzelfde antwoord, geen nieuw mandje.
  select * into prior from public.table_requests where id = p_request_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id or prior.group_id is distinct from p_group_id then
      raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
    end if;
    select * into g from public.table_guest_groups where id = p_group_id;
    return jsonb_build_object('request_id', prior.id, 'status', prior.status, 'duplicate', true, 'group_id', p_group_id, 'cart_id', g.cart_id);
  end if;
  select * into g0 from public.table_guest_groups x where x.id = p_group_id and x.tenant_id = p_tenant_id;
  if g0.id is null then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  g := public.table_group_settle(p_tenant_id, g0.dining_table_id, p_now);
  -- R3: dubbel tikken met dezelfde ID. De eerste aanvraag kan net gecommit zijn terwijl deze op het slot wachtte.
  select * into prior from public.table_requests where id = p_request_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id or prior.group_id is distinct from p_group_id then
      raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
    end if;
    return jsonb_build_object('request_id', prior.id, 'status', prior.status, 'duplicate', true, 'group_id', p_group_id, 'cart_id', g.cart_id);
  end if;
  if g.id is null or g.id <> p_group_id then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  select coalesce(f.qr_shared_cart, true) into v_shared from (select 1) x left join public.fulfillment_settings f on f.tenant_id = p_tenant_id;
  if v_shared and p_cart_id is not null and p_cart_id is distinct from g.cart_id then
    raise exception 'JUST_SENT' using errcode = '55000';
  end if;
  v_cart := case when v_shared then g.cart_id else p_cart_id end;
  if v_cart is null then raise exception 'CART_EMPTY' using errcode = '22023'; end if;

  r := public.table_request_place(p_tenant_id, p_request_id, v_cart, g.dining_table_id, p_table_label, p_guest_name, p_note);
  update public.table_requests set group_id = g.id where id = p_request_id and tenant_id = p_tenant_id and group_id is null;
  if v_shared and coalesce((r ->> 'duplicate')::boolean, false) is not true then
    g.cart_id := public.table_group_new_cart(p_tenant_id, g.id);
  end if;
  update public.table_guest_groups set cart_id = case when v_shared then g.cart_id else cart_id end,
         version = version + 1, last_activity_at = greatest(last_activity_at, p_now)
   where id = g.id returning * into g;
  return r || jsonb_build_object('group_id', g.id, 'cart_id', case when v_shared then g.cart_id end, 'version', g.version);
end;
$$;
revoke all on function public.table_group_request_place(uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_request_place(uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;

-- 8. Schrijven in het gedeelde mandje ---------------------------------------------------------------------------
-- De laatste stap van cart_add_item / cart_update_item / cart_remove_item met table_group_id. Validatie en prijs
-- doet storefront-api zoals altijd; hier enkel het schrijven, onder het slot van de groep:
--   - mandje van de groep is intussen doorgegeven (geroteerd) → CART_ROTATED (de storefront probeert opnieuw
--     op het nieuwe mandje, dat in de foutmelding staat: 'CART_ROTATED:<cart_id>');
--   - 'add': insert … on conflict (zelfde product/variant/extra's) do update quantity = quantity + excluded
--     → twee gsm's die tegelijk hetzelfde toevoegen, verliezen niets (geen read-then-update, geen 23505);
--   - p_item.max_qty (voorraad) en 99 per regel (zoals table_request_place) worden na het optellen bewaakt.
-- p_item: add {product_id, variant_id, quantity, unit_price, addons, addon_key, addons_total, max_qty};
--         set {item_id, quantity}; remove {item_id}.
create or replace function public.table_group_cart_put(p_tenant_id uuid, p_group_id uuid, p_cart_id uuid, p_op text, p_item jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  g0 public.table_guest_groups%rowtype;
  g public.table_guest_groups%rowtype;
  cart record;
  v_qty integer;
  v_max integer;
  v_item uuid;
  v_n integer;
begin
  if p_op not in ('add', 'set', 'remove') or p_group_id is null or p_cart_id is null then
    raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
  end if;
  select * into g0 from public.table_guest_groups x where x.id = p_group_id and x.tenant_id = p_tenant_id;
  if g0.id is null then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  g := public.table_group_settle(p_tenant_id, g0.dining_table_id, p_now);
  if g.id is null or g.id <> p_group_id then raise exception 'GROUP_ENDED' using errcode = '55000'; end if;
  if g.cart_id is null then raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023'; end if;
  if g.cart_id <> p_cart_id then raise exception 'CART_ROTATED:%', g.cart_id using errcode = '40001'; end if;
  select c.id, c.checkout_status into cart from public.storefront_carts c where c.id = p_cart_id and c.tenant_id = p_tenant_id for update;
  if cart.id is null or cart.checkout_status is distinct from 'shopping' then
    -- Zou niet mogen (doorgeven roteert in dezelfde transactie); veilig: een nieuw mandje.
    g.cart_id := public.table_group_new_cart(p_tenant_id, g.id);
    update public.table_guest_groups set cart_id = g.cart_id, version = version + 1 where id = g.id;
    raise exception 'CART_ROTATED:%', g.cart_id using errcode = '40001';
  end if;

  if p_op = 'add' then
    v_qty := (p_item ->> 'quantity')::integer;
    v_max := nullif(p_item ->> 'max_qty', '')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 or (p_item ->> 'product_id') is null or (p_item ->> 'unit_price') is null then
      raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
    end if;
    insert into public.storefront_cart_items as ci (cart_id, product_id, variant_id, quantity, unit_price, addons, addon_key, addons_total)
    values (p_cart_id, (p_item ->> 'product_id')::uuid, nullif(p_item ->> 'variant_id', '')::uuid, v_qty, (p_item ->> 'unit_price')::numeric,
            case when jsonb_typeof(p_item -> 'addons') = 'array' then p_item -> 'addons' end,
            nullif(p_item ->> 'addon_key', ''), coalesce((p_item ->> 'addons_total')::numeric, 0))
    on conflict (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(addon_key, ''))
    do update set quantity = ci.quantity + excluded.quantity, unit_price = excluded.unit_price
    returning ci.id, ci.quantity into v_item, v_n;
    if v_n > 99 then raise exception 'QTY_LIMIT' using errcode = '22023'; end if;
    if v_max is not null and v_n > v_max then raise exception 'INSUFFICIENT_STOCK:%', greatest(v_max, 0) using errcode = '22023'; end if;
  elsif p_op = 'set' then
    v_qty := (p_item ->> 'quantity')::integer;
    v_max := nullif(p_item ->> 'max_qty', '')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_max is not null and v_qty > v_max then raise exception 'INSUFFICIENT_STOCK:%', greatest(v_max, 0) using errcode = '22023'; end if;
    update public.storefront_cart_items set quantity = v_qty
     where id = (p_item ->> 'item_id')::uuid and cart_id = p_cart_id returning id into v_item;
    if v_item is null then raise exception 'ITEM_GONE' using errcode = 'P0002'; end if;
  else
    delete from public.storefront_cart_items where id = (p_item ->> 'item_id')::uuid and cart_id = p_cart_id returning id into v_item;
    -- Al weg (een tafelgenoot was sneller): geen fout, het mandje is zoals gevraagd.
  end if;
  update public.storefront_carts set updated_at = p_now where id = p_cart_id;
  update public.table_guest_groups set version = version + 1, last_activity_at = greatest(last_activity_at, p_now)
   where id = g.id returning * into g;
  return jsonb_build_object('cart_id', p_cart_id, 'item_id', v_item, 'version', g.version);
end;
$$;
revoke all on function public.table_group_cart_put(uuid, uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.table_group_cart_put(uuid, uuid, uuid, text, jsonb, timestamptz) to service_role;

-- 9. Beheer (Zaal en Nu-paneel) ----------------------------------------------------------------------------------
-- Per open hoofdrekening aan een tafel en per actieve groep: is de rekening ouder dan de laatste dagreset
-- (stale), hoeveel open lijnen van vóór de start van de actieve groep (prev_open_lines), en de groep zelf.
-- Alleen-lezen; groepen die lui afgelopen zijn, tellen als niet actief (zonder ze hier te beëindigen).
create or replace function public.horeca_table_groups(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_reset timestamptz := public.table_group_last_reset(now());
  v_idle integer;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(f.qr_group_idle_minutes, 120) into v_idle from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  return jsonb_build_object('last_reset', v_reset, 'tables', coalesce((
    select jsonb_agg(row_to_json(z)::jsonb order by z.table_id)
      from (
        select coalesce(c.table_id, g.dining_table_id) as table_id,
               c.id as check_id, c.opened_at as check_opened_at,
               coalesce(c.opened_at < v_reset, false) as stale,
               case when g.id is null or c.id is null then 0
                    else public.table_group_hidden_open(p_tenant_id, c.id, g.started_at, g.id) end as prev_open_lines,
               case when g.id is null then null else jsonb_build_object('id', g.id, 'started_at', g.started_at,
                 'last_activity_at', public.table_group_last_activity(gr.r),
                 -- R1b: stil sinds langer dan de inactiviteitstijd, maar nog iets open (vertrokken zonder te betalen?).
                 'idle_open', public.table_group_last_activity(gr.r) + make_interval(mins => v_idle) < now()
                              and public.table_group_has_open(gr.r, public.table_group_cur_check(gr.r))) end as "group"
          from (select * from public.dining_checks c0
                 where c0.tenant_id = p_tenant_id and c0.status = 'open' and c0.split_of is null and c0.table_id is not null) c
          full join (select g1.* from public.table_guest_groups g1
                      where g1.tenant_id = p_tenant_id and g1.ended_at is null
                        and public.table_group_end_reason(g1, now(), v_idle) is null) g
            on g.dining_table_id = c.table_id
          left join lateral (select x as r from public.table_guest_groups x where x.id = g.id) gr on true
      ) z), '[]'::jsonb));
end;
$$;
revoke all on function public.horeca_table_groups(uuid) from public, anon;
grant execute on function public.horeca_table_groups(uuid) to authenticated;

-- "Tafel vrijgeven": beëindigt de actieve groep van een tafel. De rekening zelf blijft ongemoeid (die reken je
-- af of verplaats je op de kassa). De volgende gasten starten met een leeg overzicht.
create or replace function public.table_group_release(p_tenant_id uuid, p_table_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  g public.table_guest_groups%rowtype;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('table_group:' || p_tenant_id::text || ':' || p_table_id::text, 0));
  update public.table_guest_groups set ended_at = now(), ended_reason = 'staff_release', version = version + 1
   where tenant_id = p_tenant_id and dining_table_id = p_table_id and ended_at is null
   returning * into g;
  if g.id is null then return jsonb_build_object('released', 0); end if;
  if g.cart_id is not null then
    update public.storefront_carts set checkout_status = 'abandoned' where id = g.cart_id and checkout_status = 'shopping';
  end if;
  perform public.horeca_bump(p_tenant_id);
  return jsonb_build_object('released', 1, 'group_id', g.id);
end;
$$;
revoke all on function public.table_group_release(uuid, uuid) from public, anon;
grant execute on function public.table_group_release(uuid, uuid) to authenticated;

-- TAFEL-3 — SellQo Kassa als enige kassa: verkoop aan de toog, kas in/uit en shifttelling,
-- X- en Z-rapporten. Eisenmatrix: EVT-04 (directe verkoop = N zonder P), TX-01 (btw ter plaatse
-- of meenemen), PAY-09/PAY-10 (kas in/uit, lade), RPT-01..RPT-09 (rapporten).
--
-- 1. Toogverkoop. Een toogverkoop is een rekening van het soort 'counter' (geen tafel). Je tikt
--    producten aan zoals op een tafel, maar er gaat geen ronde naar de FDM: afrekenen tekent één
--    N over de lijnen (directe verkoop, UC M110). Keukenbonnen ontstaan bij het afrekenen.
--    "Ter plaatse" of "meenemen" kiest het btw-tarief: products.takeaway_vat_rate_id (bv. 6 %
--    voor afhaalmaaltijden) geldt enkel bij meenemen; zonder dat veld blijft het gewone tarief.
-- 2. Kas in/uit (kassa_cash_move) en shift openen/tellen/sluiten (kassa_shift). Fiscaal: een
--    signMoneyInOut-event (MONEY_IN_OUT of DRAWER_DECLARATION) dat aan het verzoek-id hangt.
-- 3. Rapporten (kassa_report_begin/finish). Een Z krijgt een doorlopend nummer per zaak (RPT-02),
--    gereserveerd vóór het tekenen (het nummer staat in het ondertekende bericht). Een Z dekt
--    de bedrijfsdag (afkapuur, standaard 06:00) of het stuk sinds de vorige Z van die dag.
--    Cijfers komen uit de SellQo-tabellen (pos_transactions, check_payments, check_lines); in
--    een GKS-zaak tekent het toestel daarnaast de officiële rapporten uit fiscal_events
--    (kassa_report_source) en hangen die events aan het rapport.
--
-- Additief: nieuwe kolommen (products, dining_checks, pos_sessions, pos_cash_movements),
-- nieuwe tabellen en functies. horeca_apply, horeca_check_json, horeca_pay_begin en horeca_pay
-- worden vervangen door een versie die de toog kent; het tafelgedrag blijft identiek.
-- Idempotent.
--
-- Handmatig terugdraaien (enkel zonder echte toogverkopen of rapporten):
--   de vier vervangen functies terugzetten uit 20261024130000_tafel_1_checks.sql en
--   20261024140000_tafel_2_pay.sql;
--   drop function if exists public.kassa_report_begin(uuid, text, jsonb), public.kassa_report_finish(uuid, text, jsonb),
--     public.kassa_report_release(uuid, uuid), public.kassa_report_due(uuid), public.kassa_report_source(uuid, uuid),
--     public.kassa_report_data(uuid, timestamptz, timestamptz), public.kassa_cash_move(uuid, text, jsonb),
--     public.kassa_shift(uuid, text, jsonb), public.kassa_open_session(uuid, uuid, numeric, text),
--     public.kassa_cutoff_hour(uuid), public.kassa_business_day(uuid, timestamptz), public.kassa_day_start(uuid, date),
--     public.kassa_product_vat_rate(uuid, uuid, boolean), public.kassa_counter_guard(uuid, jsonb),
--     public.kassa_counter_after(uuid, jsonb, jsonb), public.kassa_fiscal_ref_ok(uuid, uuid, text[], text);
--   drop table if exists public.kassa_reports, public.kassa_report_numbers;
--   alter table public.dining_checks drop column if exists kind, drop column if exists service;
--   alter table public.products drop column if exists takeaway_vat_rate_id;
--   alter table public.pos_cash_movements drop column if exists pos_cashier_id, drop column if exists fiscal_event_id, drop column if exists kind;
--   alter table public.pos_sessions drop column if exists opening_fiscal_event_id, drop column if exists closing_fiscal_event_id,
--     drop column if exists closed_by_cashier;

-- ── Kolommen ──────────────────────────────────────────────────────────────────────────────
-- Btw bij meenemen (TX-01). Leeg = het gewone tarief van het product. Geen gevoelig gegeven.
alter table public.products add column if not exists takeaway_vat_rate_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_takeaway_vat_rate_fk') then
    alter table public.products add constraint products_takeaway_vat_rate_fk
      foreign key (takeaway_vat_rate_id) references public.vat_rates(id) on delete set null;
  end if;
end $$;

alter table public.dining_checks add column if not exists kind text not null default 'table';
alter table public.dining_checks add column if not exists service text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dining_checks_kind_chk') then
    alter table public.dining_checks add constraint dining_checks_kind_chk check (kind in ('table', 'counter'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dining_checks_service_chk') then
    alter table public.dining_checks add constraint dining_checks_service_chk check (service is null or service in ('eat_in', 'takeaway'));
  end if;
  -- Een toogverkoop hoort nooit bij een tafel en wordt nooit gesplitst.
  if not exists (select 1 from pg_constraint where conname = 'dining_checks_counter_chk') then
    alter table public.dining_checks add constraint dining_checks_counter_chk check (kind = 'table' or (table_id is null and split_of is null));
  end if;
end $$;

alter table public.pos_cash_movements add column if not exists pos_cashier_id uuid;
alter table public.pos_cash_movements add column if not exists fiscal_event_id uuid;
-- 'manual' = kas in/uit op de kassa, 'tip' = contante fooi bij het afrekenen.
alter table public.pos_cash_movements add column if not exists kind text;
alter table public.pos_sessions add column if not exists opening_fiscal_event_id uuid;
alter table public.pos_sessions add column if not exists closing_fiscal_event_id uuid;
alter table public.pos_sessions add column if not exists closed_by_cashier uuid;
-- Verzoek-id's van SellQo Kassa (idempotent openen/sluiten).
alter table public.pos_sessions add column if not exists opening_request_id uuid;
alter table public.pos_sessions add column if not exists closing_request_id uuid;
create unique index if not exists pos_sessions_opening_request_uq on public.pos_sessions (opening_request_id) where opening_request_id is not null;
create unique index if not exists pos_sessions_closing_request_uq on public.pos_sessions (closing_request_id) where closing_request_id is not null;

-- ── Bedrijfsdag ───────────────────────────────────────────────────────────────────────────
-- Afkapuur van de zaak: cutoffHour van de kassa's (pos_terminals.settings.fiscal), anders 6.
create or replace function public.kassa_cutoff_hour(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select max((t.settings -> 'fiscal' ->> 'cutoffHour')::integer) from public.pos_terminals t
                   where t.tenant_id = p_tenant_id and (t.settings -> 'fiscal' ->> 'cutoffHour') ~ '^([0-9]|1[0-2])$'), 6);
$$;

-- Bedrijfsdag van een tijdstip (zoals bookingDateFor in de kassa-app).
create or replace function public.kassa_business_day(p_tenant_id uuid, p_at timestamptz)
returns date
language sql
stable
security definer
set search_path to ''
as $$
  select ((p_at at time zone 'Europe/Brussels') - make_interval(hours => public.kassa_cutoff_hour(p_tenant_id)))::date;
$$;

-- Begin van een bedrijfsdag (Brusselse tijd + afkapuur).
create or replace function public.kassa_day_start(p_tenant_id uuid, p_day date)
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $$
  select (p_day::timestamp + make_interval(hours => public.kassa_cutoff_hour(p_tenant_id))) at time zone 'Europe/Brussels';
$$;

revoke all on function public.kassa_cutoff_hour(uuid), public.kassa_business_day(uuid, timestamptz), public.kassa_day_start(uuid, date)
  from public, anon, authenticated;

-- ── Btw van een product, ter plaatse of meenemen ─────────────────────────────────────────
create or replace function public.kassa_product_vat_rate(p_tenant_id uuid, p_product_id uuid, p_takeaway boolean)
returns numeric
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select vr.rate from public.products pr join public.vat_rates vr on vr.id = pr.takeaway_vat_rate_id
      where p_takeaway and pr.id = p_product_id and pr.tenant_id = p_tenant_id),
    (select vr.rate from public.products pr join public.vat_rates vr on vr.id = pr.vat_rate_id
      where pr.id = p_product_id and pr.tenant_id = p_tenant_id),
    (select vr.rate from public.vat_rates vr where vr.tenant_id = p_tenant_id and vr.is_default and vr.is_active limit 1),
    21);
$$;
revoke all on function public.kassa_product_vat_rate(uuid, uuid, boolean) from public, anon, authenticated;

-- ── Rekening als JSON: + kind en service ─────────────────────────────────────────────────
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
    'kind', c.kind, 'service', c.service,
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

-- ── Toog: regels vóór en na een commando ─────────────────────────────────────────────────
-- Vóór: een toogverkoop kent enkel aantikken, aantal, opmerking, weghalen, korting, naam,
-- schrappen en ter plaatse/meenemen; tijdens het afrekenen niets. Niets mag naar een toog
-- verhuizen. Geeft het resultaat terug voor commando's die hier volledig afgehandeld worden.
create or replace function public.kassa_counter_guard(p_tenant_id uuid, cmd jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind text := cmd ->> 'kind';
  c public.dining_checks%rowtype;
  l record;
  v_rate numeric;
  v_label text;
begin
  if v_kind = 'open_check' then
    return null; -- kind en service zet kassa_counter_after
  end if;
  if v_kind = 'move_lines' and nullif(cmd ->> 'to_check_id', '') is not null
     and exists (select 1 from public.dining_checks x where x.id = (cmd ->> 'to_check_id')::uuid and x.tenant_id = p_tenant_id and x.kind = 'counter') then
    raise exception 'naar een toogverkoop kan je niets verplaatsen' using errcode = '55000';
  end if;
  select * into c from public.dining_checks where id = nullif(cmd ->> 'check_id', '')::uuid and tenant_id = p_tenant_id;
  if c.id is null then
    if v_kind = 'set_service' then raise exception 'rekening niet gevonden' using errcode = 'P0002'; end if;
    return null;
  end if;
  if c.kind <> 'counter' then
    if v_kind = 'set_service' then raise exception 'ter plaatse of meenemen geldt enkel aan de toog' using errcode = '22023'; end if;
    return null;
  end if;
  if v_kind not in ('add_line', 'change_qty', 'set_note', 'void_line', 'discount_line', 'rename_check', 'void_check', 'set_service') then
    raise exception 'dat kan niet bij een toogverkoop' using errcode = '55000';
  end if;
  if c.paying_until is not null and c.paying_until > now() then
    raise exception 'deze verkoop wordt net afgerekend' using errcode = '55000';
  end if;
  if c.status <> 'open' then raise exception 'rekening is al afgesloten' using errcode = '55000'; end if;

  if v_kind = 'set_service' then
    if coalesce(cmd ->> 'service', '') not in ('eat_in', 'takeaway') then
      raise exception 'kies ter plaatse of meenemen' using errcode = '22023';
    end if;
    perform 1 from public.dining_checks where id = c.id for update;
    update public.dining_checks set service = cmd ->> 'service', version = version + 1, updated_at = now() where id = c.id;
    -- Het tarief van de nog open lijnen volgt (enkel ontwerp-lijnen bestaan aan de toog).
    for l in select x.id, x.product_id from public.check_lines x where x.check_id = c.id and x.state = 'draft' and x.product_id is not null for update loop
      v_rate := public.kassa_product_vat_rate(p_tenant_id, l.product_id, cmd ->> 'service' = 'takeaway');
      v_label := public.horeca_vat_label(v_rate);
      if v_label is null then raise exception 'btw-tarief % past niet op een Belgisch label', v_rate using errcode = '22023'; end if;
      update public.check_lines set vat_rate = v_rate, vat_label = v_label where id = l.id;
    end loop;
    return jsonb_build_object('id', (cmd ->> 'id')::uuid, 'ok', true, 'check', public.horeca_check_json(c.id));
  end if;
  return null;
end;
$$;
revoke all on function public.kassa_counter_guard(uuid, jsonb) from public, anon, authenticated;

-- Na: een nieuwe toogverkoop krijgt kind/service; een nieuwe lijn aan een toog die meeneemt,
-- krijgt het afhaaltarief.
create or replace function public.kassa_counter_after(p_tenant_id uuid, cmd jsonb, res jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind text := cmd ->> 'kind';
  c public.dining_checks%rowtype;
  l record;
  v_rate numeric;
  v_label text;
begin
  if v_kind = 'open_check' and cmd ->> 'check_kind' = 'counter' then
    if nullif(cmd ->> 'table_id', '') is not null then
      raise exception 'een toogverkoop hoort niet bij een tafel' using errcode = '22023';
    end if;
    update public.dining_checks
      set kind = 'counter', service = case when cmd ->> 'service' in ('eat_in', 'takeaway') then cmd ->> 'service' else 'eat_in' end
      where id = (cmd ->> 'check_id')::uuid and tenant_id = p_tenant_id;
    return res || jsonb_build_object('check', public.horeca_check_json((cmd ->> 'check_id')::uuid));
  end if;
  if v_kind = 'add_line' then
    select * into c from public.dining_checks where id = (res -> 'check' ->> 'id')::uuid and tenant_id = p_tenant_id;
    if c.id is null then
      select x.* into c from public.dining_checks x join public.check_lines y on y.check_id = x.id
        where y.id = (cmd ->> 'line_id')::uuid and x.tenant_id = p_tenant_id;
    end if;
    if c.id is not null and c.kind = 'counter' and c.service = 'takeaway' then
      select x.id, x.product_id into l from public.check_lines x where x.id = (cmd ->> 'line_id')::uuid and x.check_id = c.id and x.state = 'draft';
      if l.id is not null and l.product_id is not null then
        v_rate := public.kassa_product_vat_rate(p_tenant_id, l.product_id, true);
        v_label := public.horeca_vat_label(v_rate);
        if v_label is null then raise exception 'btw-tarief % past niet op een Belgisch label', v_rate using errcode = '22023'; end if;
        update public.check_lines set vat_rate = v_rate, vat_label = v_label where id = l.id;
        return res || jsonb_build_object('check', public.horeca_check_json(c.id));
      end if;
    end if;
  end if;
  return res;
end;
$$;
revoke all on function public.kassa_counter_after(uuid, jsonb, jsonb) from public, anon, authenticated;

-- ── horeca_apply: identiek, met de toogregels vóór en na elk commando ─────────────────────
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
      res := public.kassa_counter_guard(p_tenant_id, cmd);
      if res is null then
        res := public.horeca_apply_one(p_tenant_id, cmd);
        res := public.kassa_counter_after(p_tenant_id, cmd, res);
      end if;
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

-- ── Fiscaal event bij een kas-, shift- of rapporthandeling ───────────────────────────────
-- Het event hangt via cost_center_reference aan het verzoek-id (de kassa-app geeft dat mee).
create or replace function public.kassa_fiscal_ref_ok(p_tenant_id uuid, p_event uuid, p_mutations text[], p_reference text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.fiscal_events f where f.id = p_event and f.tenant_id = p_tenant_id and not f.is_training
                 and f.mutation = any(p_mutations) and f.cost_center_reference = p_reference
                 -- Een zaak met een echte zwarte doos aanvaardt geen simulator-handtekening.
                 and not (public.horeca_tenant_fiscal(p_tenant_id) and f.fdm_id like 'SIM%'));
$$;
revoke all on function public.kassa_fiscal_ref_ok(uuid, uuid, text[], text) from public, anon, authenticated;

-- Open shift van een kassa, of een nieuwe (zelfde regel als bij afrekenen).
create or replace function public.kassa_open_session(p_tenant_id uuid, p_terminal_id uuid, p_opening numeric, p_note text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_session uuid;
begin
  select s.id into v_session from public.pos_sessions s
    where s.tenant_id = p_tenant_id and s.terminal_id = p_terminal_id and s.status = 'open' order by s.opened_at desc limit 1;
  if v_session is null then
    insert into public.pos_sessions (tenant_id, terminal_id, opened_by, opening_cash, status, notes)
    values (p_tenant_id, p_terminal_id, auth.uid(), coalesce(p_opening, 0), 'open', p_note)
    on conflict (terminal_id) where status = 'open' do nothing
    returning id into v_session;
    if v_session is null then
      select s.id into v_session from public.pos_sessions s
        where s.tenant_id = p_tenant_id and s.terminal_id = p_terminal_id and s.status = 'open' order by s.opened_at desc limit 1;
    end if;
  end if;
  return v_session;
end;
$$;
revoke all on function public.kassa_open_session(uuid, uuid, numeric, text) from public, anon, authenticated;

-- ── Afrekenen: claim (tafel ongewijzigd; toog = de ontwerp-lijnen) ───────────────────────
create or replace function public.horeca_pay_begin(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.dining_checks%rowtype;
  v_pay uuid := (p ->> 'payment_id')::uuid;
  v_ids uuid[];
  v_total bigint;
  v_state text;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_pay is null then raise exception 'betaling zonder id' using errcode = '22023'; end if;
  select * into c from public.dining_checks where id = (p ->> 'check_id')::uuid and tenant_id = p_tenant_id for update;
  if c.id is null then raise exception 'rekening niet gevonden' using errcode = 'P0002'; end if;
  if c.status <> 'open' then raise exception 'rekening is al afgesloten' using errcode = '55000'; end if;
  if c.paying_until is not null and c.paying_until > now() and c.paying_payment_id is distinct from v_pay then
    raise exception 'deze rekening wordt al afgerekend' using errcode = '55000';
  end if;
  if c.paying_payment_id is distinct from v_pay and exists (select 1 from public.fiscal_events f where f.tenant_id = p_tenant_id and f.mutation = 'signSale' and not f.is_training
             and f.cost_center_reference = c.cost_center_reference
             and not exists (select 1 from public.check_payments cp where cp.fiscal_event_id = f.id)) then
    raise exception 'voor deze rekening bestaat al een ondertekende verkoop die nog niet geboekt is' using errcode = '55000';
  end if;
  -- Tafel: de verstuurde lijnen. Toog: de ontwerp-lijnen (daar gaat niets vooraf naar de FDM).
  v_state := case when c.kind = 'counter' then 'draft' else 'sent' end;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(p -> 'line_ids', '[]'::jsonb)) x;
  if coalesce(array_length(v_ids, 1), 0) = 0
     or exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = v_state and not (x.id = any(v_ids)))
     or (select count(*) from public.check_lines x where x.check_id = c.id and x.state = v_state and x.id = any(v_ids)) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = v_state;
  if (p ->> 'expected_total_cents')::bigint is distinct from v_total then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;
  update public.dining_checks set paying_payment_id = v_pay, paying_until = now() + interval '10 minutes', version = version + 1, updated_at = now()
    where id = c.id;
  perform public.horeca_bump(p_tenant_id);
  return jsonb_build_object('ok', true, 'paying_until', now() + interval '10 minutes', 'fiscal', public.horeca_tenant_fiscal(p_tenant_id));
end;
$$;
revoke all on function public.horeca_pay_begin(uuid, text, jsonb) from public, anon;
grant execute on function public.horeca_pay_begin(uuid, text, jsonb) to authenticated;

-- ── Afrekenen (tafel ongewijzigd; toog: eerst de lijnen "versturen" met keukenbonnen) ────
-- Extra in p_payment voor de toog: kitchen (boolean, standaard true) = keukenbonnen maken voor
-- lijnen die niet naar een bar-post gaan.
create or replace function public.horeca_pay(p_tenant_id uuid, p_device_id text, p_payment jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := (p_payment ->> 'id')::uuid;
  v_staff uuid := nullif(p_payment ->> 'staff_id', '')::uuid;
  v_terminal uuid := (p_payment ->> 'terminal_id')::uuid;
  v_event uuid := nullif(p_payment ->> 'fiscal_event_id', '')::uuid;
  v_tip integer := coalesce((p_payment ->> 'tip_cents')::integer, 0);
  v_tip_method text := nullif(p_payment ->> 'tip_method', '');
  v_round integer := coalesce((p_payment ->> 'rounding_cents')::integer, 0);
  c public.dining_checks%rowtype;
  term record;
  prior public.check_payments%rowtype;
  v_total bigint;
  v_tender_sum bigint;
  v_cash bigint;
  v_expected_round bigint;
  v_mode text;
  v_items jsonb;
  v_tax numeric;
  v_discount bigint;
  v_session uuid;
  v_receipt text;
  v_tenders jsonb;
  v_primary text;
  t jsonb;
  v_ids uuid[];
  v_new uuid;
  v_state text;
  v_round_id uuid;
  v_round_seq integer;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'betaling zonder id' using errcode = '22023'; end if;

  -- Idempotent: dezelfde betaling twee keer = het eerste antwoord.
  select * into prior from public.check_payments where id = v_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id then raise exception 'geen toegang' using errcode = '42501'; end if;
    if prior.check_id is distinct from (p_payment ->> 'check_id')::uuid then raise exception 'betaling hoort bij een andere rekening' using errcode = '22023'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', prior.id, 'pos_transaction_id', prior.pos_transaction_id,
      'receipt_number', (select x.receipt_number from public.pos_transactions x where x.id = prior.pos_transaction_id),
      'total_cents', prior.total_cents);
  end if;

  if v_staff is null or not exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id and s.is_active) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  select pt.id, pt.settings into term from public.pos_terminals pt where pt.id = v_terminal and pt.tenant_id = p_tenant_id;
  if term.id is null then raise exception 'onbekende kassa' using errcode = '22023'; end if;
  v_mode := coalesce(term.settings -> 'fiscal' ->> 'mode', 'off');

  select * into c from public.dining_checks where id = (p_payment ->> 'check_id')::uuid and tenant_id = p_tenant_id for update;
  if c.id is null then raise exception 'rekening niet gevonden' using errcode = 'P0002'; end if;
  select * into prior from public.check_payments where id = v_id;
  if prior.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', prior.id, 'pos_transaction_id', prior.pos_transaction_id,
      'receipt_number', (select x.receipt_number from public.pos_transactions x where x.id = prior.pos_transaction_id),
      'total_cents', prior.total_cents);
  end if;
  if c.status <> 'open' then raise exception 'rekening is al afgesloten' using errcode = '55000'; end if;
  if c.paying_until is not null and c.paying_until > now() and c.paying_payment_id is distinct from v_id then
    raise exception 'deze rekening wordt al afgerekend' using errcode = '55000';
  end if;
  v_state := case when c.kind = 'counter' then 'draft' else 'sent' end;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(p_payment -> 'line_ids', '[]'::jsonb)) x;
  if coalesce(array_length(v_ids, 1), 0) = 0
     or exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = v_state and not (x.id = any(v_ids)))
     or (select count(*) from public.check_lines x where x.check_id = c.id and x.state = v_state and x.id = any(v_ids)) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;

  -- Totaal uit de databank, nooit van het toestel.
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = v_state;
  if v_total < 0 then raise exception 'negatief totaal: dat is een terugbetaling' using errcode = '22023'; end if;
  if (p_payment ->> 'expected_total_cents')::bigint is distinct from v_total then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;

  v_tenders := coalesce(p_payment -> 'tenders', '[]'::jsonb);
  if jsonb_typeof(v_tenders) <> 'array' or jsonb_array_length(v_tenders) > 10 then
    raise exception 'betaalmiddelen: lijst van max. 10' using errcode = '22023';
  end if;
  for t in select * from jsonb_array_elements(v_tenders) loop
    if coalesce(t ->> 'method', '') !~ '^(cash|card|cheque_meal|voucher|other)$' then
      raise exception 'onbekend betaalmiddel' using errcode = '22023';
    end if;
    if (t ->> 'amount_cents')::bigint is null or (t ->> 'amount_cents')::bigint <= 0 then
      raise exception 'bedrag per betaalmiddel moet positief zijn' using errcode = '22023';
    end if;
  end loop;
  select coalesce(sum((x ->> 'amount_cents')::bigint), 0), coalesce(sum((x ->> 'amount_cents')::bigint) filter (where x ->> 'method' = 'cash'), 0)
    into v_tender_sum, v_cash from jsonb_array_elements(v_tenders) x;
  if v_tender_sum <> v_total then
    raise exception 'betaalmiddelen (%) sluiten niet op het totaal (%)', v_tender_sum, v_total using errcode = '22023';
  end if;
  if v_total > 0 and jsonb_array_length(v_tenders) = 0 then raise exception 'geen betaalmiddel' using errcode = '22023'; end if;

  v_expected_round := public.horeca_round5(v_cash) - v_cash;
  if v_round <> v_expected_round then
    raise exception 'afronding klopt niet (verwacht %)', v_expected_round using errcode = '22023';
  end if;

  if v_tip < 0 or v_tip > 100000 then raise exception 'fooi ongeldig' using errcode = '22023'; end if;
  if (v_tip = 0) <> (v_tip_method is null) or (v_tip_method is not null and v_tip_method not in ('cash', 'card')) then
    raise exception 'fooi: bedrag en betaalwijze horen samen' using errcode = '22023';
  end if;

  if v_mode in ('simulator', 'fdm') or public.horeca_tenant_fiscal(p_tenant_id) or v_event is not null then
    if v_event is null then raise exception 'ondertekening ontbreekt' using errcode = '22023'; end if;
    if not exists (select 1 from public.fiscal_events f where f.id = v_event and f.tenant_id = p_tenant_id
        and f.mutation = 'signSale' and not f.is_training and f.event_label = 'N'
        and f.cost_center_reference = c.cost_center_reference and f.transaction_total_cents = v_total) then
      raise exception 'ondertekening hoort niet bij deze rekening' using errcode = '22023';
    end if;
    if public.horeca_tenant_fiscal(p_tenant_id) and exists (select 1 from public.fiscal_events f where f.id = v_event and f.fdm_id like 'SIM%') then
      raise exception 'simulator-handtekening in een zaak met een echte zwarte doos' using errcode = '22023';
    end if;
  end if;

  -- Toog: de afgerekende lijnen worden nu "verstuurd" (één ronde zonder P-event).
  if c.kind = 'counter' then
    v_round_id := gen_random_uuid();
    select coalesce(max(r.seq), 0) + 1 into v_round_seq from public.check_rounds r where r.check_id = c.id;
    insert into public.check_rounds (id, tenant_id, check_id, seq, source, sent_by, fiscal_event_id)
    values (v_round_id, p_tenant_id, c.id, v_round_seq, 'staff', v_staff, null);
    update public.check_lines set state = 'sent', round_id = v_round_id where check_id = c.id and state = 'draft' and id = any(v_ids);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.product_id, 'product_id', g.product_id, 'name', g.name, 'sku', null,
      'price', round(g.unit_cents / 100.0, 2), 'quantity', g.qty, 'tax_rate', g.vat_rate,
      'discount', round(-g.pc_cents / 100.0, 2), 'total', round(g.total_cents / 100.0, 2))), '[]'::jsonb)
    into v_items
  from (
    select x.product_id, min(x.name) as name, x.unit_price_cents + coalesce((select sum((a ->> 'price_cents')::bigint) from jsonb_array_elements(x.addons) a), 0) as unit_cents,
           x.vat_rate, sum(x.qty)::integer as qty,
           sum(coalesce((select sum((p ->> 'amount_cents')::bigint) from jsonb_array_elements(x.price_changes) p), 0)) as pc_cents,
           sum(public.horeca_line_total(x)) as total_cents
    from public.check_lines x
    where x.check_id = c.id and x.state = 'sent' and x.product_id is not null
    group by x.product_id, unit_cents, x.vat_rate
    having sum(x.qty) > 0
  ) g;

  select coalesce(sum(round(s.total * s.rate / (100 + s.rate))), 0) into v_tax
  from (select x.vat_rate as rate, sum(public.horeca_line_total(x))::numeric as total
        from public.check_lines x where x.check_id = c.id and x.state = 'sent' group by x.vat_rate) s;
  select coalesce(-sum(coalesce((select sum((p ->> 'amount_cents')::bigint) from jsonb_array_elements(x.price_changes) p), 0)), 0)
    into v_discount from public.check_lines x where x.check_id = c.id and x.state = 'sent';

  v_session := public.kassa_open_session(p_tenant_id, v_terminal, 0, 'Automatisch geopend door SellQo Kassa (eerste betaling)');

  select coalesce(jsonb_agg(jsonb_build_object(
      'method', case when x ->> 'method' = 'cash' then 'cash' when x ->> 'method' = 'card' then 'card' else 'manual' end,
      'amount', round(((x ->> 'amount_cents')::bigint + case when x ->> 'method' = 'cash' and ord = (
          select min(o2) from jsonb_array_elements(v_tenders) with ordinality y(v2, o2) where y.v2 ->> 'method' = 'cash') then v_round else 0 end) / 100.0, 2),
      'reference', x ->> 'method')), '[]'::jsonb)
    into t
  from jsonb_array_elements(v_tenders) with ordinality z(x, ord);
  v_primary := coalesce((select x ->> 'method' from jsonb_array_elements(v_tenders) x order by (x ->> 'amount_cents')::bigint desc, x ->> 'method' limit 1), 'cash');

  insert into public.pos_transactions (id, tenant_id, terminal_id, session_id, cashier_id, pos_cashier_id, items, payments,
    cash_received, subtotal, discount_total, tax_total, total, status)
  values (v_id, p_tenant_id, v_terminal, v_session, auth.uid(), v_staff, v_items, t,
    case when v_cash > 0 then round((v_cash + v_round) / 100.0, 2) else null end,
    round((v_total - v_tax) / 100.0, 2), round(v_discount / 100.0, 2), round(v_tax / 100.0, 2), round(v_total / 100.0, 2), 'completed')
  returning receipt_number into v_receipt;

  insert into public.check_payments (id, tenant_id, check_id, pos_transaction_id, terminal_id, staff_id, device_id, fiscal_event_id,
    total_cents, tenders, rounding_cents, tip_cents, tip_method)
  values (v_id, p_tenant_id, c.id, v_id, v_terminal, v_staff, left(p_device_id, 200), v_event,
    v_total, v_tenders, v_round, v_tip, v_tip_method);

  -- Toog: keukenbonnen per post (nooit bedragen, PRT-05), niet voor bar-posten.
  if c.kind = 'counter' and coalesce((p_payment ->> 'kitchen')::boolean, true) then
    insert into public.kitchen_tickets (tenant_id, source, service_type, customer_label, check_id, round_id, station_id, items, paid, status, pos_transaction_id)
    select p_tenant_id, 'pos', case when c.service = 'takeaway' then 'pickup' else 'eat_in' end, c.name, c.id, v_round_id, x.station_id,
      jsonb_agg(jsonb_build_object('name', x.name, 'quantity', x.qty, 'note', x.note, 'course', x.course,
        'addons', (select coalesce(jsonb_agg(jsonb_build_object('name', a ->> 'name')), '[]'::jsonb) from jsonb_array_elements(x.addons) a))
        order by x.course nulls first, x.seq),
      true, 'new', v_id
    from public.check_lines x
    left join public.prep_stations s on s.id = x.station_id
    where x.check_id = c.id and x.round_id = v_round_id and x.qty > 0 and coalesce(s.kind, 'kitchen') <> 'bar'
    group by x.station_id;
  end if;

  if v_tip > 0 and v_tip_method = 'cash' then
    insert into public.pos_cash_movements (id, tenant_id, session_id, terminal_id, user_id, movement_type, amount, reason, notes, pos_cashier_id, kind)
    values (gen_random_uuid(), p_tenant_id, v_session, v_terminal, auth.uid(), 'in', round(v_tip / 100.0, 2), 'Fooi', 'Rekening ' || c.cost_center_reference, v_staff, 'tip');
  end if;

  update public.dining_checks set status = 'closed', closed_at = now(), paying_payment_id = null, paying_until = null,
    version = version + 1, updated_at = now() where id = c.id;

  if exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft') then
    v_new := gen_random_uuid();
    insert into public.dining_checks (id, tenant_id, table_id, name, opened_by, cost_center_reference, split_of, split_no, kind, service)
    values (v_new, p_tenant_id, c.table_id, c.name, v_staff, v_new::text, c.split_of, c.split_no, c.kind, c.service);
    insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
      vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, price_changes, neg_reason, corrects_line_id, created_by)
    select gen_random_uuid(), p_tenant_id, v_new, row_number() over (order by x.seq), x.product_id, x.variant_id, x.name, x.department_id, x.department_name,
      x.vat_rate, x.vat_label, x.unit_price_cents, x.qty, x.addons, x.note, x.course, x.station_id, x.price_changes, null, null, x.created_by
    from public.check_lines x where x.check_id = c.id and x.state = 'draft' and x.qty > 0 and x.corrects_line_id is null;
    update public.dining_checks set next_seq = coalesce((select max(seq) from public.check_lines where check_id = v_new), 0) + 1 where id = v_new;
    update public.check_lines set state = 'void', void_reason = 'carried_over', voided_by = v_staff, voided_at = now()
      where check_id = c.id and state = 'draft';
    update public.dining_checks set carried_to = v_new where id = c.id;
  end if;
  perform public.horeca_bump(p_tenant_id);

  begin
    perform public.record_transaction(p_tenant_id, case when v_primary = 'card' then 'pos_card' else 'pos_cash' end, null);
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'payment_id', v_id, 'pos_transaction_id', v_id, 'receipt_number', v_receipt, 'total_cents', v_total,
    'carried_over_check_id', v_new);
end;
$$;
revoke all on function public.horeca_pay(uuid, text, jsonb) from public, anon;
grant execute on function public.horeca_pay(uuid, text, jsonb) to authenticated;

-- ── Kas in/uit (PAY-09) ──────────────────────────────────────────────────────────────────
-- p = {id, terminal_id, staff_id, direction: in|out, amount_cents (> 0), reason, fiscal_event_id}
-- Fiscaal: signMoneyInOut met cost_center_reference = id.
create or replace function public.kassa_cash_move(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_staff uuid := nullif(p ->> 'staff_id', '')::uuid;
  v_terminal uuid := (p ->> 'terminal_id')::uuid;
  v_event uuid := nullif(p ->> 'fiscal_event_id', '')::uuid;
  v_amount bigint := (p ->> 'amount_cents')::bigint;
  v_dir text := p ->> 'direction';
  v_reason text := nullif(btrim(left(p ->> 'reason', 80)), '');
  v_mode text;
  v_session uuid;
  v_name text;
  prior record;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'verzoek zonder id' using errcode = '22023'; end if;
  select m.id, m.tenant_id, m.session_id into prior from public.pos_cash_movements m where m.id = v_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id then raise exception 'geen toegang' using errcode = '42501'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_id, 'session_id', prior.session_id);
  end if;
  if v_dir not in ('in', 'out') then raise exception 'kies in of uit' using errcode = '22023'; end if;
  if v_amount is null or v_amount <= 0 or v_amount > 1000000 then raise exception 'bedrag tussen 0,01 en 10.000 euro' using errcode = '22023'; end if;
  if v_reason is null then raise exception 'reden verplicht' using errcode = '22023'; end if;
  select s.display_name into v_name from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id and s.is_active;
  if v_name is null then raise exception 'onbekende medewerker' using errcode = '22023'; end if;
  select coalesce(pt.settings -> 'fiscal' ->> 'mode', 'off') into v_mode from public.pos_terminals pt where pt.id = v_terminal and pt.tenant_id = p_tenant_id;
  if v_mode is null then raise exception 'onbekende kassa' using errcode = '22023'; end if;
  if v_mode in ('simulator', 'fdm') or public.horeca_tenant_fiscal(p_tenant_id) or v_event is not null then
    if v_event is null or not public.kassa_fiscal_ref_ok(p_tenant_id, v_event, array['signMoneyInOut'], v_id::text) then
      raise exception 'ondertekening ontbreekt of hoort niet bij deze kasbeweging' using errcode = '22023';
    end if;
  end if;
  v_session := public.kassa_open_session(p_tenant_id, v_terminal, 0, 'Automatisch geopend door SellQo Kassa (kas in/uit)');
  insert into public.pos_cash_movements (id, tenant_id, session_id, terminal_id, user_id, movement_type, amount, reason, notes, pos_cashier_id, fiscal_event_id, kind)
  values (v_id, p_tenant_id, v_session, v_terminal, auth.uid(), v_dir, round(v_amount / 100.0, 2), v_reason, 'SellQo Kassa · ' || v_name, v_staff, v_event, 'manual');
  return jsonb_build_object('ok', true, 'id', v_id, 'session_id', v_session);
end;
$$;
revoke all on function public.kassa_cash_move(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_cash_move(uuid, text, jsonb) to authenticated;

-- ── Shift openen en sluiten met telling ──────────────────────────────────────────────────
-- p = {action: open|close, id (verzoek-id), terminal_id, staff_id, counted_cents, fiscal_event_id}
-- Fiscaal: signMoneyInOut DRAWER_DECLARATION met cost_center_reference = id.
-- Antwoord bij sluiten: {opening_cents, expected_cents, counted_cents, difference_cents}.
create or replace function public.kassa_shift(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_staff uuid := nullif(p ->> 'staff_id', '')::uuid;
  v_terminal uuid := (p ->> 'terminal_id')::uuid;
  v_event uuid := nullif(p ->> 'fiscal_event_id', '')::uuid;
  v_counted bigint := (p ->> 'counted_cents')::bigint;
  v_action text := p ->> 'action';
  v_mode text;
  s record;
  v_expected numeric;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'verzoek zonder id' using errcode = '22023'; end if;
  if v_action not in ('open', 'close') then raise exception 'openen of sluiten' using errcode = '22023'; end if;
  if v_counted is null or v_counted < 0 or v_counted > 10000000 then raise exception 'telling ongeldig' using errcode = '22023'; end if;
  if not exists (select 1 from public.pos_cashiers x where x.id = v_staff and x.tenant_id = p_tenant_id and x.is_active) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  select coalesce(pt.settings -> 'fiscal' ->> 'mode', 'off') into v_mode from public.pos_terminals pt where pt.id = v_terminal and pt.tenant_id = p_tenant_id;
  if v_mode is null then raise exception 'onbekende kassa' using errcode = '22023'; end if;

  -- Herhaling van een gelukt verzoek: hetzelfde antwoord.
  select * into s from public.pos_sessions x where x.tenant_id = p_tenant_id
    and ((v_action = 'open' and x.opening_request_id = v_id) or (v_action = 'close' and x.closing_request_id = v_id));
  if s.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'session_id', s.id,
      'opening_cents', round(s.opening_cash * 100), 'expected_cents', round(coalesce(s.expected_cash, 0) * 100),
      'counted_cents', round(coalesce(s.closing_cash, 0) * 100), 'difference_cents', round(coalesce(s.cash_difference, 0) * 100));
  end if;

  if v_mode in ('simulator', 'fdm') or public.horeca_tenant_fiscal(p_tenant_id) or v_event is not null then
    if v_event is null or not public.kassa_fiscal_ref_ok(p_tenant_id, v_event, array['signMoneyInOut'], v_id::text) then
      raise exception 'ondertekening ontbreekt of hoort niet bij deze telling' using errcode = '22023';
    end if;
  end if;

  select * into s from public.pos_sessions x where x.tenant_id = p_tenant_id and x.terminal_id = v_terminal and x.status = 'open'
    order by x.opened_at desc limit 1 for update;

  if v_action = 'open' then
    if s.id is not null then
      -- Een automatisch geopende shift zonder verkopen of bewegingen krijgt alsnog zijn begintelling.
      if s.opening_cash = 0 and not exists (select 1 from public.pos_transactions x where x.session_id = s.id)
         and not exists (select 1 from public.pos_cash_movements x where x.session_id = s.id) then
        update public.pos_sessions set opening_cash = round(v_counted / 100.0, 2), opening_fiscal_event_id = v_event,
          opening_request_id = v_id, updated_at = now() where id = s.id;
        return jsonb_build_object('ok', true, 'session_id', s.id, 'opening_cents', v_counted);
      end if;
      raise exception 'er loopt al een shift op deze kassa' using errcode = '55000';
    end if;
    insert into public.pos_sessions (tenant_id, terminal_id, opened_by, opening_cash, status, notes, opening_fiscal_event_id, opening_request_id)
    values (p_tenant_id, v_terminal, auth.uid(), round(v_counted / 100.0, 2), 'open', 'SellQo Kassa · begintelling', v_event, v_id)
    returning * into s;
    return jsonb_build_object('ok', true, 'session_id', s.id, 'opening_cents', v_counted);
  end if;

  if s.id is null then raise exception 'er loopt geen shift op deze kassa' using errcode = '55000'; end if;
  v_expected := public.calculate_session_expected_cash(s.id);
  update public.pos_sessions set status = 'closed', closed_at = now(), closed_by = auth.uid(), closed_by_cashier = v_staff,
    closing_cash = round(v_counted / 100.0, 2), expected_cash = v_expected, cash_difference = round(v_counted / 100.0, 2) - v_expected,
    closing_fiscal_event_id = v_event, closing_request_id = v_id, updated_at = now()
    where id = s.id;
  return jsonb_build_object('ok', true, 'session_id', s.id, 'opening_cents', round(s.opening_cash * 100),
    'expected_cents', round(v_expected * 100), 'counted_cents', v_counted, 'difference_cents', v_counted - round(v_expected * 100));
end;
$$;
revoke all on function public.kassa_shift(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_shift(uuid, text, jsonb) to authenticated;

-- ── Rapporten ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.kassa_report_numbers (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  report_no integer not null check (report_no > 0),
  report_id uuid not null unique,
  booking_date date not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  reserved_at timestamptz not null default now(),
  primary key (tenant_id, report_no)
);

create table if not exists public.kassa_reports (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  kind text not null check (kind in ('X', 'Z')),
  report_no integer,
  booking_date date not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  cutoff_hour integer not null,
  data jsonb not null,
  fiscal_event_ids uuid[] not null default '{}',
  terminal_id uuid,
  staff_id uuid,
  auto boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint kassa_reports_no check ((kind = 'Z') = (report_no is not null))
);
create unique index if not exists kassa_reports_z_no_uq on public.kassa_reports (tenant_id, report_no) where kind = 'Z';
create index if not exists kassa_reports_tenant_day on public.kassa_reports (tenant_id, booking_date desc);

-- Een rapport verandert nooit meer (zoals fiscal_events).
create or replace function public.kassa_reports_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'kassa_reports: append-only' using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists kassa_reports_guard on public.kassa_reports;
create trigger kassa_reports_guard before update or delete on public.kassa_reports
  for each row execute function public.kassa_reports_guard();
drop trigger if exists kassa_reports_no_truncate on public.kassa_reports;
create trigger kassa_reports_no_truncate before truncate on public.kassa_reports
  for each statement execute function public.kassa_reports_guard();

revoke all on public.kassa_reports, public.kassa_report_numbers from public, anon, authenticated;
grant all on public.kassa_reports, public.kassa_report_numbers to service_role;
grant select on public.kassa_reports to authenticated;
alter table public.kassa_reports enable row level security;
alter table public.kassa_report_numbers enable row level security;
drop policy if exists kassa_reports_select on public.kassa_reports;
create policy kassa_reports_select on public.kassa_reports for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- De cijfers van een periode, uit de SellQo-tabellen. Bedragen in centen.
create or replace function public.kassa_report_data(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with tx as (
    select t.* from public.pos_transactions t where t.tenant_id = p_tenant_id and t.created_at >= p_from and t.created_at < p_to
  ), done as (
    select * from tx where status = 'completed'
  ), cp as (
    select cp.* from public.check_payments cp join done d on d.id = cp.pos_transaction_id
  ), lines as (
    -- Per betaling en tarief: exact uit de afgerekende lijnen (tafel en toog) …
    select cp.id as pay_id, x.vat_rate as rate, sum(public.horeca_line_total(x))::numeric as gross
    from cp join public.check_lines x on x.check_id = cp.check_id and x.state = 'sent'
    group by cp.id, x.vat_rate
    union all
    -- … of uit de artikels van een verkoop op de klassieke kassa.
    select d.id, coalesce((i ->> 'tax_rate')::numeric, 21), round(sum((i ->> 'total')::numeric) * 100)
    from done d cross join lateral jsonb_array_elements(d.items) i
    where not exists (select 1 from cp where cp.pos_transaction_id = d.id)
    group by d.id, coalesce((i ->> 'tax_rate')::numeric, 21)
  ), vat as (
    -- Btw zoals de FDM: per ticket en tarief half-up(totaal × t / (100 + t)).
    select rate, sum(gross)::bigint as gross, sum(round(gross * rate / (100 + rate)))::bigint as vat from lines group by rate
  ), classic as (
    select d.* from done d where not exists (select 1 from cp where cp.pos_transaction_id = d.id)
  ), pays as (
    select x ->> 'method' as method, sum((x ->> 'amount_cents')::bigint) as cents
    from cp cross join lateral jsonb_array_elements(cp.tenders) x group by 1
    union all
    select case when p ->> 'method' in ('cash', 'card') then p ->> 'method' else 'other' end, round(sum((p ->> 'amount')::numeric) * 100)::bigint
    from classic d cross join lateral jsonb_array_elements(d.payments) p group by 1
    union all
    -- Wisselgeld op de klassieke kassa zat in het contante bedrag.
    select 'cash', -round(coalesce(sum(cash_change), 0) * 100)::bigint from classic
  ), moves as (
    select m.* from public.pos_cash_movements m where m.tenant_id = p_tenant_id and m.created_at >= p_from and m.created_at < p_to
  ), staff as (
    select coalesce(cp.staff_id, d.pos_cashier_id) as staff_id, count(*) as cnt, round(sum(d.total) * 100)::bigint as cents,
           coalesce(sum(cp.tip_cents), 0)::bigint as tips
    from done d left join cp on cp.pos_transaction_id = d.id
    group by 1
  ), paid_lines as (
    select x.* from cp join public.check_lines x on x.check_id = cp.check_id and x.state = 'sent'
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'sales', jsonb_build_object(
      'count', (select count(*) from done),
      'total_cents', coalesce((select round(sum(total) * 100)::bigint from done), 0),
      'vat_cents', coalesce((select sum(vat) from vat), 0),
      'net_cents', coalesce((select sum(gross - vat) from vat), 0),
      'discount_cents', coalesce((select sum(coalesce((select sum((pc ->> 'amount_cents')::bigint) from jsonb_array_elements(x.price_changes) pc), 0)) from paid_lines x), 0)
    ),
    'vats', coalesce((select jsonb_agg(jsonb_build_object('rate', rate, 'gross_cents', gross, 'vat_cents', vat, 'net_cents', gross - vat) order by rate desc) from vat), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('method', method, 'cents', cents) order by method)
                          from (select method, sum(cents)::bigint as cents from pays group by method) q), '[]'::jsonb),
    'rounding_cents', coalesce((select sum(rounding_cents) from cp), 0),
    'tips', coalesce((select jsonb_agg(jsonb_build_object('method', tip_method, 'cents', cents) order by tip_method)
                      from (select tip_method, sum(tip_cents)::bigint as cents from cp where tip_cents > 0 group by tip_method) q), '[]'::jsonb),
    'cash', jsonb_build_object(
      'in_cents', coalesce((select round(sum(amount) * 100)::bigint from moves where movement_type = 'in' and kind is distinct from 'tip'), 0),
      'out_cents', coalesce((select round(sum(amount) * 100)::bigint from moves where movement_type = 'out'), 0),
      'count', (select count(*) from moves where kind is distinct from 'tip')
    ),
    'voided', jsonb_build_object('count', (select count(*) from tx where status = 'voided'),
                                 'total_cents', coalesce((select round(sum(total) * 100)::bigint from tx where status = 'voided'), 0)),
    'corrections', jsonb_build_object(
      'count', (select count(*) from paid_lines where neg_reason = 'CORRECTION'),
      'total_cents', coalesce((select sum(public.horeca_line_total(x)) from paid_lines x where x.neg_reason = 'CORRECTION'), 0)
    ),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('staff_id', s.staff_id, 'name', coalesce(pc.display_name, '—'), 'count', s.cnt, 'total_cents', s.cents, 'tips_cents', s.tips)
                                        order by coalesce(pc.display_name, '—'))
                       from staff s left join public.pos_cashiers pc on pc.id = s.staff_id), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(jsonb_build_object('terminal_id', s.terminal_id, 'closed_at', s.closed_at,
                          'opening_cents', round(s.opening_cash * 100), 'expected_cents', round(coalesce(s.expected_cash, 0) * 100),
                          'counted_cents', round(coalesce(s.closing_cash, 0) * 100), 'difference_cents', round(coalesce(s.cash_difference, 0) * 100)) order by s.closed_at)
                        from public.pos_sessions s where s.tenant_id = p_tenant_id and s.status = 'closed' and s.closed_at >= p_from and s.closed_at < p_to), '[]'::jsonb),
    'drawer_opens', (select count(*) from public.fiscal_events f where f.tenant_id = p_tenant_id and f.mutation = 'signDrawerOpen' and not f.is_training
                     and f.created_at >= p_from and f.created_at < p_to),
    'open_checks', (select count(*) from public.dining_checks c where c.tenant_id = p_tenant_id and c.status = 'open'
                    and exists (select 1 from public.check_lines x where x.check_id = c.id and x.state <> 'void'))
  );
$$;
revoke all on function public.kassa_report_data(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Reserveren vóór het tekenen. p = {id, kind: X|Z, booking_date, staff_id, auto}
-- Z: doorlopend nummer per zaak; dekt de bedrijfsdag of het stuk sinds de vorige Z van die dag.
-- Antwoord: {report_no?, booking_date, period_start, period_end, fiscal}
create or replace function public.kassa_report_begin(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_kind text := p ->> 'kind';
  v_staff uuid := nullif(p ->> 'staff_id', '')::uuid;
  v_auto boolean := coalesce((p ->> 'auto')::boolean, false);
  v_day date := coalesce(nullif(p ->> 'booking_date', '')::date, public.kassa_business_day(p_tenant_id, now()));
  v_today date := public.kassa_business_day(p_tenant_id, now());
  v_start timestamptz;
  v_end timestamptz;
  v_role text;
  v_no integer;
  r public.kassa_report_numbers%rowtype;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'rapport zonder id' using errcode = '22023'; end if;
  if v_kind not in ('X', 'Z') then raise exception 'X of Z' using errcode = '22023'; end if;
  if v_day > v_today or v_day < v_today - 366 then raise exception 'ongeldige bedrijfsdag' using errcode = '22023'; end if;
  if v_staff is not null then
    select x.role into v_role from public.pos_cashiers x where x.id = v_staff and x.tenant_id = p_tenant_id and x.is_active;
    if v_role is null then raise exception 'onbekende medewerker' using errcode = '22023'; end if;
  elsif not (v_auto and v_kind = 'Z') then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  -- Een Z afsluiten: eigenaar of verantwoordelijke (of automatisch).
  if v_kind = 'Z' and v_staff is not null and v_role not in ('owner', 'manager') then
    raise exception 'een Z-rapport mag enkel de eigenaar of een verantwoordelijke maken' using errcode = '42501';
  end if;

  v_start := public.kassa_day_start(p_tenant_id, v_day);
  v_end := least(public.kassa_day_start(p_tenant_id, v_day + 1), now());

  if v_kind = 'X' then
    return jsonb_build_object('booking_date', v_day, 'period_start', v_start, 'period_end', v_end, 'fiscal', public.horeca_tenant_fiscal(p_tenant_id));
  end if;

  perform pg_advisory_xact_lock(hashtext('kassa_report|' || p_tenant_id::text));
  select * into r from public.kassa_report_numbers x where x.report_id = v_id;
  if r.report_id is not null then
    if r.tenant_id <> p_tenant_id then raise exception 'geen toegang' using errcode = '42501'; end if;
    return jsonb_build_object('report_no', r.report_no, 'booking_date', r.booking_date, 'period_start', r.period_start,
      'period_end', r.period_end, 'fiscal', public.horeca_tenant_fiscal(p_tenant_id));
  end if;
  v_start := greatest(v_start, coalesce((select max(x.period_end) from public.kassa_report_numbers x where x.tenant_id = p_tenant_id and x.booking_date = v_day), v_start));
  if v_start >= v_end then raise exception 'deze bedrijfsdag is al afgesloten' using errcode = '55000'; end if;
  select coalesce(max(x.report_no), 0) + 1 into v_no from public.kassa_report_numbers x where x.tenant_id = p_tenant_id;
  insert into public.kassa_report_numbers (tenant_id, report_no, report_id, booking_date, period_start, period_end)
  values (p_tenant_id, v_no, v_id, v_day, v_start, v_end);
  return jsonb_build_object('report_no', v_no, 'booking_date', v_day, 'period_start', v_start, 'period_end', v_end,
    'fiscal', public.horeca_tenant_fiscal(p_tenant_id));
end;
$$;
revoke all on function public.kassa_report_begin(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_report_begin(uuid, text, jsonb) to authenticated;

-- Reservering vrijgeven als het tekenen aantoonbaar mislukte: enkel het laatste nummer en
-- enkel zonder rapport (zo blijft de nummering doorlopend).
create or replace function public.kassa_report_release(p_tenant_id uuid, p_report_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('kassa_report|' || p_tenant_id::text));
  delete from public.kassa_report_numbers n
    where n.tenant_id = p_tenant_id and n.report_id = p_report_id
      and not exists (select 1 from public.kassa_reports k where k.id = p_report_id)
      and n.report_no = (select max(x.report_no) from public.kassa_report_numbers x where x.tenant_id = p_tenant_id);
end;
$$;
revoke all on function public.kassa_report_release(uuid, uuid) from public, anon;
grant execute on function public.kassa_report_release(uuid, uuid) to authenticated;

-- Afronden en bewaren. p = {id, kind, booking_date, terminal_id, staff_id, auto, fiscal_event_ids: [uuid]}
-- GKS: X = signReportTurnoverX + signReportUserX, Z = de Z-versies, met cost_center_reference = id.
create or replace function public.kassa_report_finish(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_kind text := p ->> 'kind';
  v_staff uuid := nullif(p ->> 'staff_id', '')::uuid;
  v_terminal uuid := nullif(p ->> 'terminal_id', '')::uuid;
  v_auto boolean := coalesce((p ->> 'auto')::boolean, false);
  v_events uuid[];
  v_mode text := 'off';
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_no integer;
  v_data jsonb;
  k public.kassa_reports%rowtype;
  r public.kassa_report_numbers%rowtype;
  v_need text[];
  e uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  select * into k from public.kassa_reports x where x.id = v_id;
  if k.id is not null then
    if k.tenant_id <> p_tenant_id then raise exception 'geen toegang' using errcode = '42501'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', k.id, 'kind', k.kind, 'report_no', k.report_no,
      'booking_date', k.booking_date, 'period_start', k.period_start, 'period_end', k.period_end, 'data', k.data);
  end if;
  if v_kind not in ('X', 'Z') then raise exception 'X of Z' using errcode = '22023'; end if;
  if v_staff is not null and not exists (select 1 from public.pos_cashiers x where x.id = v_staff and x.tenant_id = p_tenant_id) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  if v_terminal is not null then
    select coalesce(pt.settings -> 'fiscal' ->> 'mode', 'off') into v_mode from public.pos_terminals pt where pt.id = v_terminal and pt.tenant_id = p_tenant_id;
    if v_mode is null then raise exception 'onbekende kassa' using errcode = '22023'; end if;
  end if;

  if v_kind = 'Z' then
    select * into r from public.kassa_report_numbers x where x.report_id = v_id and x.tenant_id = p_tenant_id;
    if r.report_id is null then raise exception 'eerst een nummer reserveren' using errcode = '55000'; end if;
    v_no := r.report_no; v_day := r.booking_date; v_start := r.period_start; v_end := r.period_end;
  else
    v_day := coalesce(nullif(p ->> 'booking_date', '')::date, public.kassa_business_day(p_tenant_id, now()));
    v_start := public.kassa_day_start(p_tenant_id, v_day);
    v_end := least(public.kassa_day_start(p_tenant_id, v_day + 1), now());
  end if;

  select coalesce(array_agg(x::uuid), '{}') into v_events from jsonb_array_elements_text(coalesce(p -> 'fiscal_event_ids', '[]'::jsonb)) x;
  if v_mode in ('simulator', 'fdm') or public.horeca_tenant_fiscal(p_tenant_id) or cardinality(v_events) > 0 then
    v_need := case when v_kind = 'Z' then array['signReportTurnoverZ', 'signReportUserZ'] else array['signReportTurnoverX', 'signReportUserX'] end;
    if cardinality(v_events) <> 2 then raise exception 'twee ondertekende rapporten verwacht' using errcode = '22023'; end if;
    foreach e in array v_events loop
      if not public.kassa_fiscal_ref_ok(p_tenant_id, e, v_need, v_id::text) then
        raise exception 'ondertekening hoort niet bij dit rapport' using errcode = '22023';
      end if;
    end loop;
    if (select count(distinct f.mutation) from public.fiscal_events f where f.id = any(v_events)) <> 2 then
      raise exception 'omzet- en gebruikersrapport verwacht' using errcode = '22023';
    end if;
  end if;

  v_data := public.kassa_report_data(p_tenant_id, v_start, v_end);
  insert into public.kassa_reports (id, tenant_id, kind, report_no, booking_date, period_start, period_end, cutoff_hour, data,
    fiscal_event_ids, terminal_id, staff_id, auto)
  values (v_id, p_tenant_id, v_kind, v_no, v_day, v_start, v_end, public.kassa_cutoff_hour(p_tenant_id), v_data,
    v_events, v_terminal, v_staff, v_auto);
  return jsonb_build_object('ok', true, 'id', v_id, 'kind', v_kind, 'report_no', v_no, 'booking_date', v_day,
    'period_start', v_start, 'period_end', v_end, 'data', v_data);
end;
$$;
revoke all on function public.kassa_report_finish(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_report_finish(uuid, text, jsonb) to authenticated;

-- Bedrijfsdagen (max. 31 dagen terug, vóór vandaag) met verkopen of kasbewegingen na de laatste
-- Z van die dag (RPT-03: ontbrekende Z aanvullen).
create or replace function public.kassa_report_due(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_today date;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  v_today := public.kassa_business_day(p_tenant_id, now());
  return coalesce((
    select jsonb_agg(d order by d)
    from (
      select distinct public.kassa_business_day(p_tenant_id, a.at) as d
      from (
        select t.created_at as at from public.pos_transactions t where t.tenant_id = p_tenant_id and t.created_at > now() - interval '32 days'
        union all
        select m.created_at from public.pos_cash_movements m where m.tenant_id = p_tenant_id and m.created_at > now() - interval '32 days'
      ) a
      where a.at >= coalesce((select max(n.period_end) from public.kassa_report_numbers n
                              where n.tenant_id = p_tenant_id and n.booking_date = public.kassa_business_day(p_tenant_id, a.at)), '-infinity'::timestamptz)
    ) q
    where d < v_today and d >= v_today - 31
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.kassa_report_due(uuid) from public, anon;
grant execute on function public.kassa_report_due(uuid) to authenticated;

-- Ondertekende events van de periode van een gereserveerde Z (of een X voor vandaag), voor de
-- officiële rapporten op een toestel met zwarte doos. Bevat werknemersnummers: enkel voor het
-- toestel dat het rapport tekent; de kassa-app bewaart ze niet.
create or replace function public.kassa_report_source(p_tenant_id uuid, p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  r public.kassa_report_numbers%rowtype;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  select * into r from public.kassa_report_numbers x where x.report_id = p_report_id and x.tenant_id = p_tenant_id;
  if r.report_id is not null then
    v_day := r.booking_date; v_start := r.period_start; v_end := r.period_end;
  else
    v_day := public.kassa_business_day(p_tenant_id, now());
    v_start := public.kassa_day_start(p_tenant_id, v_day);
    v_end := now();
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('mutation', f.mutation, 'is_training', f.is_training,
      'request_body', f.request_body, 'response_body', f.response_body) order by f.total_counter, f.created_at)
    from public.fiscal_events f
    where f.tenant_id = p_tenant_id and f.booking_date = v_day
      and f.pos_date_time ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
      and (case when f.pos_date_time ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then f.pos_date_time::timestamptz end) >= v_start
      and (case when f.pos_date_time ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then f.pos_date_time::timestamptz end) < v_end
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.kassa_report_source(uuid, uuid) from public, anon;
grant execute on function public.kassa_report_source(uuid, uuid) to authenticated;

-- TAFEL-2 — afrekenen van een tafelrekening, server-side en in één transactie.
--
-- Waarom: de klassieke kassa rekent het totaal in de browser uit en schrijft de verkoop
-- rechtstreeks weg (usePOS.ts). Voor tafels doen we dat niet: het totaal komt uit de
-- verstuurde lijnen in de databank, de betaalmiddelen moeten er exact op sluiten, en de
-- rekening sluit in dezelfde transactie. Eén betaling per rekening = één btw-kasticket (N),
-- ook bij gesplitste betaling (UC4119: meerdere betaalmiddelen op één ticket). Apart
-- afrekenen per persoon gebeurt via een deelrekening (TAFEL-1 move_lines split, UC4119bis).
--
-- Volgorde (FDM-04: eerst tekenen, dan doorvoeren):
--   1. horeca_pay_begin  — rekening "in betaling" zetten (claim): niemand kan ze nog wijzigen,
--                          verplaatsen of tegelijk afrekenen; lijnen en totaal worden vastgelegd.
--   2. signSale op het toestel (FDM).
--   3. horeca_pay        — boeken en sluiten; enkel met de claim van deze betaling.
--   Mislukt het tekenen: horeca_pay_release. Zo kan een rekening nooit twee keer getekend worden.
--
-- Fiscaal (GKS): heeft de zaak minstens één kassa op 'simulator' of 'fdm', dan is elke betaling
-- fiscaal (ook via een andere kassa): het ondertekende signSale-event moet in fiscal_events
-- staan, voor deze rekening (cost_center_reference = het onderste niveau van de costCenter) en
-- voor exact dit bedrag. Een meegegeven event wordt altijd gecontroleerd.
--
-- Contant afronden (PAY-02/03): de server rekent de afronding zelf na (som contant → 5 cent,
-- max ±0,02) en weigert een afwijkend voorstel van het toestel.
-- Fooi (PAY-06): buiten de omzet en de btw; apart bewaard per medewerker.
--
-- Handmatig terugdraaien (niet live gedraaid; nog geen data):
--   drop function if exists public.horeca_pay(uuid, text, jsonb);
--   drop function if exists public.horeca_pay_begin(uuid, text, jsonb);
--   drop function if exists public.horeca_pay_release(uuid, uuid, uuid);
--   drop function if exists public.horeca_tenant_fiscal(uuid);
--   drop function if exists public.horeca_line_total(public.check_lines);
--   drop function if exists public.horeca_round5(bigint);
--   drop table if exists public.check_payments;

-- ── Betalingen ────────────────────────────────────────────────────────────────────────────
create table if not exists public.check_payments (
  id uuid primary key,                                  -- client-UUID = idempotentiesleutel = pos_transactions.id
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  check_id uuid not null references public.dining_checks(id) on delete restrict,
  pos_transaction_id uuid not null,
  terminal_id uuid not null,                            -- pos_terminals.id
  staff_id uuid,                                        -- pos_cashiers.id
  device_id text,
  fiscal_event_id uuid,
  total_cents bigint not null check (total_cents >= 0),
  -- [{method, amount_cents}] — som = total_cents (exact, vóór afronding)
  tenders jsonb not null,
  rounding_cents integer not null default 0 check (rounding_cents between -2 and 2),
  tip_cents integer not null default 0 check (tip_cents between 0 and 100000),
  tip_method text check (tip_method is null or tip_method in ('cash', 'card')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint check_payments_one_per_check unique (check_id),
  constraint check_payments_tip check ((tip_cents = 0) = (tip_method is null))
);
create unique index if not exists check_payments_fiscal_event_uq on public.check_payments (fiscal_event_id) where fiscal_event_id is not null;
create index if not exists check_payments_tenant_time on public.check_payments (tenant_id, created_at);

-- Een betaling verandert nooit meer (zoals fiscal_events). Correcties = nieuw event (TAFEL-3).
create or replace function public.check_payments_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'check_payments: append-only' using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists check_payments_guard on public.check_payments;
create trigger check_payments_guard before update or delete on public.check_payments
  for each row execute function public.check_payments_guard();
drop trigger if exists check_payments_no_truncate on public.check_payments;
create trigger check_payments_no_truncate before truncate on public.check_payments
  for each statement execute function public.check_payments_guard();

revoke all on public.check_payments from public, anon, authenticated;
grant all on public.check_payments to service_role;
grant select on public.check_payments to authenticated;
alter table public.check_payments enable row level security;
drop policy if exists check_payments_select on public.check_payments;
create policy check_payments_select on public.check_payments for select to authenticated
  using (public.is_platform_admin(auth.uid()) or tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- ── Hulpfuncties ──────────────────────────────────────────────────────────────────────────
-- Contant afronden op 5 cent (zelfde regel als src/kassa/fiscal/rounding.ts): laatste cijfer
-- 1,2 → omlaag; 3,4 → omhoog naar 5; 6,7 → omlaag naar 5; 8,9 → omhoog. Onder 5 cent niet.
create or replace function public.horeca_round5(p_cents bigint)
returns bigint
language sql
immutable
set search_path to ''
as $$
  select case
    when abs(p_cents) < 5 then p_cents
    else sign(p_cents) * (case when abs(p_cents) % 5 <= 2 then abs(p_cents) - abs(p_cents) % 5 else abs(p_cents) - abs(p_cents) % 5 + 5 end)
  end;
$$;

revoke all on function public.horeca_round5(bigint) from public, anon;

-- Is deze zaak een geregistreerde kassa (GKS)? Minstens één kassa op simulator of fdm.
create or replace function public.horeca_tenant_fiscal(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.pos_terminals t where t.tenant_id = p_tenant_id
                 and coalesce(t.settings -> 'fiscal' ->> 'mode', 'off') in ('simulator', 'fdm'));
$$;
revoke all on function public.horeca_tenant_fiscal(uuid) from public, anon, authenticated;

-- Bedrag van één lijn in centen: aantal × (prijs + supplementen) + prijswijzigingen.
-- Zelfde formule als lineTotalCents() in de kassa-app.
create or replace function public.horeca_line_total(l public.check_lines)
returns bigint
language sql
immutable
set search_path to ''
as $$
  select l.qty::bigint * (l.unit_price_cents + coalesce((select sum((a ->> 'price_cents')::bigint) from jsonb_array_elements(l.addons) a), 0))
       + coalesce((select sum((p ->> 'amount_cents')::bigint) from jsonb_array_elements(l.price_changes) p), 0);
$$;

-- ── Afrekenen: claim ──────────────────────────────────────────────────────────────────────
-- p = {check_id, payment_id, line_ids, expected_total_cents}. Vóór het tekenen. Controleert
-- dat de rekening nog exact zo is als het toestel ze gaat tekenen en zet ze 10 minuten "in
-- betaling" voor deze betaling. Dezelfde betaling opnieuw = de claim verlengen.
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
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(p -> 'line_ids', '[]'::jsonb)) x;
  if coalesce(array_length(v_ids, 1), 0) = 0
     or exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'sent' and not (x.id = any(v_ids)))
     or (select count(*) from public.check_lines x where x.check_id = c.id and x.state = 'sent' and x.id = any(v_ids)) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = 'sent';
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

-- Claim vrijgeven (tekenen mislukt of geannuleerd). Enkel de eigen betaling.
create or replace function public.horeca_pay_release(p_tenant_id uuid, p_check_id uuid, p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  update public.dining_checks set paying_payment_id = null, paying_until = null, version = version + 1, updated_at = now()
    where id = p_check_id and tenant_id = p_tenant_id and paying_payment_id = p_payment_id and status = 'open';
  if found then perform public.horeca_bump(p_tenant_id); end if;
end;
$$;
revoke all on function public.horeca_pay_release(uuid, uuid, uuid) from public, anon;
grant execute on function public.horeca_pay_release(uuid, uuid, uuid) to authenticated;

-- ── Afrekenen ─────────────────────────────────────────────────────────────────────────────
-- p_payment = {
--   id, check_id, terminal_id, staff_id, expected_total_cents,
--   line_ids: de verstuurde lijnen die het toestel afrekent (= wat in het ondertekende bericht zit),
--   tenders: [{method: cash|card|cheque_meal|voucher|other, amount_cents}],
--   rounding_cents, tip_cents, tip_method, fiscal_event_id
-- }
-- Antwoord: {ok, payment_id, pos_transaction_id, receipt_number, total_cents, carried_over_check_id?, duplicate?}
--
-- Ontwerp-lijnen die een collega intussen aantikte (nog niet verstuurd, dus niet fiscaal),
-- gaan niet verloren: ze verhuizen naar een nieuwe open rekening op dezelfde tafel/naam.
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
  -- Gelijktijdige herhaling van dezelfde betaling (antwoord verloren): na de lock opnieuw kijken.
  select * into prior from public.check_payments where id = v_id;
  if prior.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', prior.id, 'pos_transaction_id', prior.pos_transaction_id,
      'receipt_number', (select x.receipt_number from public.pos_transactions x where x.id = prior.pos_transaction_id),
      'total_cents', prior.total_cents);
  end if;
  if c.status <> 'open' then raise exception 'rekening is al afgesloten' using errcode = '55000'; end if;
  -- Claim: een rekening in betaling door een andere betaling = afblijven.
  if c.paying_until is not null and c.paying_until > now() and c.paying_payment_id is distinct from v_id then
    raise exception 'deze rekening wordt al afgerekend' using errcode = '55000';
  end if;
  -- Precies de lijnen die het toestel ondertekende (anders zegt de FDM iets anders dan de rekening).
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(p_payment -> 'line_ids', '[]'::jsonb)) x;
  if coalesce(array_length(v_ids, 1), 0) = 0
     or exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'sent' and not (x.id = any(v_ids)))
     or (select count(*) from public.check_lines x where x.check_id = c.id and x.state = 'sent' and x.id = any(v_ids)) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;

  -- Totaal uit de databank, nooit van het toestel.
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = 'sent';
  if v_total < 0 then raise exception 'negatief totaal: dat is een terugbetaling' using errcode = '22023'; end if;
  if (p_payment ->> 'expected_total_cents')::bigint is distinct from v_total then
    raise exception 'de rekening is intussen gewijzigd' using errcode = '40001';
  end if;

  -- Betaalmiddelen: exact het totaal, elk > 0, gekende methode.
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

  -- Contant afronden (PAY-02/03): over de som contant, max ±0,02.
  v_expected_round := public.horeca_round5(v_cash) - v_cash;
  if v_round <> v_expected_round then
    raise exception 'afronding klopt niet (verwacht %)', v_expected_round using errcode = '22023';
  end if;

  if v_tip < 0 or v_tip > 100000 then raise exception 'fooi ongeldig' using errcode = '22023'; end if;
  if (v_tip = 0) <> (v_tip_method is null) or (v_tip_method is not null and v_tip_method not in ('cash', 'card')) then
    raise exception 'fooi: bedrag en betaalwijze horen samen' using errcode = '22023';
  end if;

  -- Fiscaal: een GKS-zaak boekt nooit zonder ondertekend N-event (welke kassa ook betaalt), en
  -- een meegegeven event moet altijd bij deze rekening en dit bedrag horen.
  if v_mode in ('simulator', 'fdm') or public.horeca_tenant_fiscal(p_tenant_id) or v_event is not null then
    if v_event is null then raise exception 'ondertekening ontbreekt' using errcode = '22023'; end if;
    if not exists (select 1 from public.fiscal_events f where f.id = v_event and f.tenant_id = p_tenant_id
        and f.mutation = 'signSale' and not f.is_training and f.event_label = 'N'
        and f.cost_center_reference = c.cost_center_reference and f.transaction_total_cents = v_total) then
      raise exception 'ondertekening hoort niet bij deze rekening' using errcode = '22023';
    end if;
  end if;

  -- Verkoop voor shiftrapport, transactieoverzicht en voorraad (trigger op status completed).
  -- items: per product en prijs, zoals de klassieke kassa ze schrijft.
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

  -- Btw zoals de FDM: per tarief half-up(totaal × t / (100 + t)).
  select coalesce(sum(round(s.total * s.rate / (100 + s.rate))), 0) into v_tax
  from (select x.vat_rate as rate, sum(public.horeca_line_total(x))::numeric as total
        from public.check_lines x where x.check_id = c.id and x.state = 'sent' group by x.vat_rate) s;
  select coalesce(-sum(coalesce((select sum((p ->> 'amount_cents')::bigint) from jsonb_array_elements(x.price_changes) p), 0)), 0)
    into v_discount from public.check_lines x where x.check_id = c.id and x.state = 'sent';

  -- Shift: elke tafelbetaling hoort bij een open kassashift van deze kassa (kasafsluiting,
  -- verwacht contant). Staat er geen open, dan opent de eerste betaling er een (beginkas 0;
  -- de telling bij het afsluiten corrigeert).
  select s.id into v_session from public.pos_sessions s
    where s.tenant_id = p_tenant_id and s.terminal_id = v_terminal and s.status = 'open' order by s.opened_at desc limit 1;
  if v_session is null then
    insert into public.pos_sessions (tenant_id, terminal_id, opened_by, opening_cash, status, notes)
    values (p_tenant_id, v_terminal, auth.uid(), 0, 'open', 'Automatisch geopend door SellQo Kassa (eerste betaling)')
    returning id into v_session;
  end if;

  -- Geld zoals het binnenkwam: contant inclusief afronding (wat er in de lade zit).
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

  -- Contante fooi zit in de lade: als kasbeweging boeken, zodat de verwachte kas klopt.
  if v_tip > 0 and v_tip_method = 'cash' then
    insert into public.pos_cash_movements (id, tenant_id, session_id, terminal_id, user_id, movement_type, amount, reason, notes)
    values (gen_random_uuid(), p_tenant_id, v_session, v_terminal, auth.uid(), 'in', round(v_tip / 100.0, 2), 'Fooi', 'Rekening ' || c.cost_center_reference);
  end if;

  update public.dining_checks set status = 'closed', closed_at = now(), paying_payment_id = null, paying_until = null,
    version = version + 1, updated_at = now() where id = c.id;

  -- Ontwerp-lijnen van een collega → nieuwe open rekening op dezelfde plek.
  if exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft') then
    v_new := gen_random_uuid();
    insert into public.dining_checks (id, tenant_id, table_id, name, opened_by, cost_center_reference, split_of, split_no)
    values (v_new, p_tenant_id, c.table_id, c.name, v_staff, v_new::text, c.split_of, c.split_no);
    insert into public.check_lines (id, tenant_id, check_id, seq, product_id, variant_id, name, department_id, department_name,
      vat_rate, vat_label, unit_price_cents, qty, addons, note, course, station_id, price_changes, neg_reason, corrects_line_id, created_by)
    select gen_random_uuid(), p_tenant_id, v_new, row_number() over (order by x.seq), x.product_id, x.variant_id, x.name, x.department_id, x.department_name,
      x.vat_rate, x.vat_label, x.unit_price_cents, x.qty, x.addons, x.note, x.course, x.station_id, x.price_changes, null, null, x.created_by
    from public.check_lines x where x.check_id = c.id and x.state = 'draft' and x.qty > 0 and x.corrects_line_id is null;
    -- (Correcties en kortingsparen op al afgerekende lijnen vervallen: die lijnen zijn betaald.)
    update public.dining_checks set next_seq = coalesce((select max(seq) from public.check_lines where check_id = v_new), 0) + 1 where id = v_new;
    update public.check_lines set state = 'void', void_reason = 'carried_over', voided_by = v_staff, voided_at = now()
      where check_id = c.id and state = 'draft';
    update public.dining_checks set carried_to = v_new where id = c.id;
  end if;
  perform public.horeca_bump(p_tenant_id);

  -- Verbruik (facturatie per transactie), zoals de klassieke kassa. Nooit blokkerend.
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
revoke all on function public.horeca_line_total(public.check_lines) from public, anon;

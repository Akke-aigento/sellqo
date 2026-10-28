-- REKENING-ONLINE-1 — de gast betaalt de tafelrekening online (Stripe), helemaal of een deel.
--
-- Drie manieren, gekozen op de rekeningpagina van het QR-menu:
--   full  = alles wat nog openstaat;
--   lines = "mijn items": de gekozen lijnen (en aantallen) gaan bij betaling naar een eigen deel
--           van de rekening (zoals splitsen aan de kassa, move_lines split) dat meteen afgesloten wordt;
--   share = gelijk delen: "k van n personen". Het bedrag komt als online voorschot op de rekening
--           (dining_checks.online_credit_cents). Is alles betaald, dan sluit de rekening vanzelf;
--           anders rekent de kassa de rest af en telt het voorschot mee als betaalwijze 'online'.
--
-- Geld en fiscaal:
--   - Bedragen komen altijd uit de databank (check_lines), nooit van de gast.
--   - Een betaling start met een vasthouding van 10 min (hold_until): die lijnen of dat bedrag kan
--     niemand anders aan tafel kiezen, en de kassa rekent die rekening even niet af. De Stripe-sessie
--     leeft 31 min. Komt het geld later binnen en klopt de rekening niet meer (een collega rekende
--     intussen af, een lijn werd geannuleerd), dan wordt de betaling teruggestort (status
--     refund_needed → de edge function stort terug → refunded). Geld verdwijnt nooit stil.
--   - Afsluiten gebeurt via horeca_pay zelf (zelfde code als de kassa), op een aparte kassa
--     "Online (QR)" (Akke 28-10). horeca_pay herkent dat pad aan een transactie-instelling die enkel
--     table_check_pay_settle (service_role) zet, plus auth.role() = service_role.
--   - Enkel voor zaken zonder geregistreerde kassa (GKS/FDM): daar moet elke afsluiting door de
--     kassa ondertekend worden. table_check_pay_start weigert dan.
--   - Fooi online: in check_online_payments.tip_cents, en in de X/Z-rapporten als fooi 'online'.
--   - Platformfee: dezelfde regel als online orders (overage boven de pakketlimiet), berekend in
--     storefront-api; hier enkel bewaard (fee_cents).
--
-- Handmatig terugdraaien (enkel als er nog geen online betalingen zijn):
--   drop function if exists public.table_check_view(uuid, uuid), public.table_check_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer),
--     public.table_check_pay_settle(uuid, bigint, text), public.table_check_pay_mark(uuid, text, text, text), public.horeca_online_terminal(uuid),
--     public.horeca_line_part_cents(public.check_lines, integer);
--   drop table if exists public.check_online_payments;
--   alter table public.dining_checks drop column if exists online_credit_cents;
--   alter table public.horeca_pay_settings drop column if exists online_pay, drop column if exists online_tip, drop column if exists online_split;
--   horeca_pay, horeca_check_json, horeca_apply_one, kassa_report_data: de definities van vóór deze migratie
--   staan in snapshots.sellqo_20261028_fn_rekening_online_1 (kolom def).

-- 0. Snapshot van de functies die gepatcht worden ---------------------------------------------------
create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_fn_rekening_online_1 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('horeca_pay', 'horeca_check_json', 'horeca_apply_one', 'kassa_report_data');
revoke all on snapshots.sellqo_20261028_fn_rekening_online_1 from anon, authenticated;

-- 1. Instellingen (Kassa › Betalen) en voorschot op de rekening ------------------------------------
alter table public.horeca_pay_settings add column if not exists online_pay boolean not null default false;
alter table public.horeca_pay_settings add column if not exists online_tip boolean not null default true;
alter table public.horeca_pay_settings add column if not exists online_split boolean not null default true;
comment on column public.horeca_pay_settings.online_pay is 'REKENING-ONLINE-1: gasten betalen de tafelrekening online via de QR (Stripe).';
alter table public.dining_checks add column if not exists online_credit_cents bigint not null default 0;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.dining_checks'::regclass and conname = 'dining_checks_online_credit_check') then
    alter table public.dining_checks add constraint dining_checks_online_credit_check check (online_credit_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.check_payments'::regclass and conname = 'check_payments_tip_method_check'
                   and pg_get_constraintdef(oid) like '%online%') then
    alter table public.check_payments drop constraint if exists check_payments_tip_method_check;
    alter table public.check_payments add constraint check_payments_tip_method_check
      check (tip_method is null or tip_method in ('cash', 'card', 'transfer', 'online'));
  end if;
end
$mig$;

-- 2. Online betalingen ----------------------------------------------------------------------------
create table if not exists public.check_online_payments (
  id uuid primary key,                                   -- van de gast (idempotent)
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  check_id uuid not null references public.dining_checks(id) on delete cascade,  -- hoofdrekening van de tafel
  table_label text,
  kind text not null check (kind in ('full', 'lines', 'share')),
  lines jsonb not null default '[]'::jsonb,              -- lines: [{line_id, qty}]
  share_n integer check (share_n is null or share_n between 2 and 30),
  share_k integer check (share_k is null or share_k between 1 and 30),
  amount_cents bigint not null check (amount_cents > 0),
  tip_cents integer not null default 0 check (tip_cents between 0 and 100000),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'refund_needed', 'refunded')),
  hold_until timestamptz not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  settled_check_id uuid,                                 -- lines: het afgesplitste deel
  reason text,
  refund_id text,
  refund_notified_at timestamptz,                        -- melding "teruggestort" verstuurd (één keer)
  refund_failed_notified_at timestamptz,                 -- melding "terugstorten mislukt" verstuurd (één keer)
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.check_online_payments add column if not exists refund_notified_at timestamptz;
alter table public.check_online_payments add column if not exists refund_failed_notified_at timestamptz;
comment on table public.check_online_payments is 'REKENING-ONLINE-1: online betalingen van tafelrekeningen via de QR (Stripe).';
create index if not exists check_online_payments_check_idx on public.check_online_payments (check_id, status);
create index if not exists check_online_payments_tenant_idx on public.check_online_payments (tenant_id, created_at);
revoke all on public.check_online_payments from anon, authenticated;
grant select on public.check_online_payments to authenticated;
alter table public.check_online_payments enable row level security;
drop policy if exists check_online_payments_select on public.check_online_payments;
create policy check_online_payments_select on public.check_online_payments for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- 3. Hulpfuncties ---------------------------------------------------------------------------------
-- Bedrag van q stuks van een lijn, exact zoals move_lines het deel berekent (extra's per stuk,
-- prijswijzigingen pro rata per regel afgerond).
create or replace function public.horeca_line_part_cents(l public.check_lines, q integer)
returns bigint
language sql
immutable
set search_path to ''
as $$
  select q::bigint * (l.unit_price_cents + coalesce((select sum((a ->> 'price_cents')::bigint) from jsonb_array_elements(l.addons) a), 0))
       + coalesce((select sum(round((e ->> 'amount_cents')::numeric * q / l.qty)) from jsonb_array_elements(l.price_changes) e), 0)::bigint;
$$;

-- De kassa "Online (QR)" van een zaak (aangemaakt bij de eerste online betaling). Niet zichtbaar
-- als toestel: settings.virtual = 'online'.
create or replace function public.horeca_online_terminal(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('online_terminal:' || p_tenant_id::text, 0));
  select t.id into v from public.pos_terminals t where t.tenant_id = p_tenant_id and t.settings ->> 'virtual' = 'online' limit 1;
  if v is null then
    insert into public.pos_terminals (tenant_id, name, status, settings)
    values (p_tenant_id, 'Online (QR)', 'active', jsonb_build_object('virtual', 'online'))
    returning id into v;
  end if;
  return v;
end;
$$;
revoke all on function public.horeca_online_terminal(uuid) from public, anon, authenticated;
grant execute on function public.horeca_online_terminal(uuid) to service_role;

-- 4. Rekening voor de gast ------------------------------------------------------------------------
create or replace function public.table_check_view(p_tenant_id uuid, p_table_id uuid)
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
begin
  select coalesce(h.online_pay, false) as online_pay, coalesce(h.online_tip, true) as online_tip, coalesce(h.online_split, true) as online_split
    into s from (select 1) x left join public.horeca_pay_settings h on h.tenant_id = p_tenant_id;
  select coalesce(t.stripe_charges_enabled, false) and t.stripe_account_id is not null into v_stripe from public.tenants t where t.id = p_tenant_id;
  v_fiscal := public.horeca_tenant_fiscal(p_tenant_id);
  select * into c from public.dining_checks x
   where x.tenant_id = p_tenant_id and x.table_id = p_table_id and x.status = 'open' and x.split_of is null
   order by x.opened_at limit 1;
  if c.id is null then
    return jsonb_build_object('check', null, 'settings', jsonb_build_object('online_pay', s.online_pay and v_stripe and not v_fiscal,
      'tip', s.online_tip, 'split', s.online_split));
  end if;
  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = 'sent';
  select coalesce(sum(o.amount_cents), 0) into v_held_share from public.check_online_payments o
   where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind in ('share', 'full');
  return jsonb_build_object(
    'check', jsonb_build_object(
      'id', c.id, 'opened_at', c.opened_at,
      'total_cents', v_total, 'credit_cents', c.online_credit_cents,
      'remaining_cents', greatest(v_total - c.online_credit_cents, 0),
      'held_cents', v_held_share,
      'has_drafts', exists (select 1 from public.check_lines x where x.check_id = c.id and x.state = 'draft'),
      'open_splits', (select count(*) from public.dining_checks y where y.split_of = c.id and y.status = 'open'),
      'pending_kinds', coalesce((select jsonb_agg(distinct o.kind) from public.check_online_payments o
                                  where o.check_id = c.id and o.status = 'pending' and o.hold_until > now()), '[]'::jsonb),
      'lines', coalesce((select jsonb_agg(jsonb_build_object(
          'id', q.id, 'name', q.name, 'addons', q.addons, 'open_qty', q.open_qty, 'held_qty', q.held_qty,
          'unit_cents', public.horeca_line_part_cents(q.l, 1),
          'open_cents', public.horeca_line_part_cents(q.l, q.open_qty),
          -- Exact bedrag voor 1..open_qty stuks (zoals splitsen het rekent), voor "mijn items".
          'part_cents', (select jsonb_agg(public.horeca_line_part_cents(q.l, g) order by g) from generate_series(1, q.open_qty) g)) order by q.seq)
        from (
          select x.id, x.seq, x.name, x as l,
                 coalesce((select jsonb_agg(a ->> 'name') from jsonb_array_elements(x.addons) a), '[]'::jsonb) as addons,
                 public.horeca_open_qty(x.id) as open_qty,
                 coalesce((select sum((e ->> 'qty')::integer) from public.check_online_payments o, jsonb_array_elements(o.lines) e
                            where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'lines'
                              and e ->> 'line_id' = x.id::text), 0) as held_qty
          from public.check_lines x
          where x.check_id = c.id and x.state = 'sent' and x.qty > 0 and x.corrects_line_id is null
        ) q where q.open_qty > 0), '[]'::jsonb)),
    'settings', jsonb_build_object('online_pay', s.online_pay and v_stripe and not v_fiscal, 'tip', s.online_tip, 'split', s.online_split));
end;
$$;
revoke all on function public.table_check_view(uuid, uuid) from public, anon, authenticated;
grant execute on function public.table_check_view(uuid, uuid) to service_role;

-- 5. Betaling starten (storefront-api, vóór de Stripe-sessie) ----------------------------------------
create or replace function public.table_check_pay_start(
  p_tenant_id uuid, p_table_id uuid, p_payment_id uuid, p_kind text, p_lines jsonb, p_share_n integer, p_share_k integer, p_tip_cents integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  prior public.check_online_payments%rowtype;
  s record;
  c public.dining_checks%rowtype;
  v_total bigint;
  v_remaining bigint;
  v_amount bigint := 0;
  v_pending_share bigint;
  e jsonb;
  l public.check_lines%rowtype;
  v_q integer;
  v_open integer;
  v_held integer;
  v_lines jsonb := '[]'::jsonb;
  v_label text;
begin
  if p_payment_id is null or p_kind not in ('full', 'lines', 'share') then
    raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
  end if;
  select * into prior from public.check_online_payments where id = p_payment_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id or prior.kind <> p_kind or prior.tip_cents <> coalesce(p_tip_cents, 0)
       or prior.share_n is distinct from (case when p_kind = 'share' then p_share_n end)
       or prior.share_k is distinct from (case when p_kind = 'share' then p_share_k end)
       or (p_kind = 'lines' and not (prior.lines @> coalesce(p_lines, '[]'::jsonb) and coalesce(p_lines, '[]'::jsonb) @> prior.lines)) then
      raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
    end if;
    return jsonb_build_object('payment_id', prior.id, 'status', prior.status, 'amount_cents', prior.amount_cents, 'tip_cents', prior.tip_cents,
      'check_id', prior.check_id, 'table_label', prior.table_label, 'stripe_session_id', prior.stripe_session_id, 'duplicate', true);
  end if;

  select coalesce(h.online_pay, false) as online_pay, coalesce(h.online_tip, true) as online_tip, coalesce(h.online_split, true) as online_split
    into s from (select 1) x left join public.horeca_pay_settings h on h.tenant_id = p_tenant_id;
  if not s.online_pay then raise exception 'CHECK_PAY_OFF' using errcode = '55000'; end if;
  if public.horeca_tenant_fiscal(p_tenant_id) then raise exception 'CHECK_PAY_FISCAL' using errcode = '55000'; end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant_id and t.stripe_account_id is not null and coalesce(t.stripe_charges_enabled, false)) then
    raise exception 'CHECK_PAY_OFF' using errcode = '55000';
  end if;
  if p_kind <> 'full' and not s.online_split then raise exception 'CHECK_PAY_NO_SPLIT' using errcode = '55000'; end if;
  if coalesce(p_tip_cents, 0) < 0 or coalesce(p_tip_cents, 0) > 100000 or (coalesce(p_tip_cents, 0) > 0 and not s.online_tip) then
    raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
  end if;

  select * into c from public.dining_checks x
   where x.tenant_id = p_tenant_id and x.table_id = p_table_id and x.status = 'open' and x.split_of is null
   order by x.opened_at limit 1 for update;
  if c.id is null then raise exception 'CHECK_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.paying_until is not null and c.paying_until > now() then raise exception 'CHECK_PAY_BUSY' using errcode = '55000'; end if;
  if (select count(*) from public.check_online_payments o where o.check_id = c.id and o.status = 'pending' and o.hold_until > now()) >= 12 then
    raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
  end if;
  select t.label into v_label from public.dining_tables t where t.id = c.table_id;

  select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = 'sent';
  v_remaining := v_total - c.online_credit_cents;
  if v_remaining <= 0 then raise exception 'CHECK_NOTHING_OPEN' using errcode = '55000'; end if;
  if exists (select 1 from public.check_online_payments o where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'full') then
    raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
  end if;

  if p_kind = 'full' then
    if exists (select 1 from public.check_online_payments o where o.check_id = c.id and o.status = 'pending' and o.hold_until > now()) then
      raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
    end if;
    v_amount := v_remaining;

  elsif p_kind = 'share' then
    if p_share_n is null or p_share_k is null or p_share_n < 2 or p_share_n > 30 or p_share_k < 1 or p_share_k >= p_share_n then
      raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
    end if;
    if exists (select 1 from public.check_online_payments o where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'lines') then
      raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
    end if;
    select coalesce(sum(o.amount_cents), 0) into v_pending_share from public.check_online_payments o
     where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'share';
    v_remaining := v_remaining - v_pending_share;
    if v_remaining <= 0 then raise exception 'CHECK_PAY_BUSY' using errcode = '55000'; end if;
    v_amount := round(v_total::numeric * p_share_k / p_share_n);
    -- De laatste betaalt de rest (en geen restje van een paar cent voor de kassa).
    if v_amount >= v_remaining or v_remaining - v_amount < 50 then v_amount := v_remaining; end if;

  else -- lines
    if c.online_credit_cents > 0 then raise exception 'CHECK_PAY_SHARES_STARTED' using errcode = '55000'; end if;
    if exists (select 1 from public.check_online_payments o where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'share') then
      raise exception 'CHECK_PAY_BUSY' using errcode = '55000';
    end if;
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 60 then
      raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
    end if;
    for e in select * from jsonb_array_elements(p_lines) loop
      select * into l from public.check_lines x where x.id = (e ->> 'line_id')::uuid and x.check_id = c.id;
      v_q := (e ->> 'qty')::integer;
      if l.id is null or l.state <> 'sent' or l.qty <= 0 or l.corrects_line_id is not null or v_q is null or v_q < 1 then
        raise exception 'CHECK_LINES_CHANGED' using errcode = '40001';
      end if;
      if v_lines @> jsonb_build_array(jsonb_build_object('line_id', l.id)) then raise exception 'CHECK_PAY_INVALID' using errcode = '22023'; end if;
      v_open := public.horeca_open_qty(l.id);
      select coalesce(sum((x ->> 'qty')::integer), 0) into v_held from public.check_online_payments o, jsonb_array_elements(o.lines) x
       where o.check_id = c.id and o.status = 'pending' and o.hold_until > now() and o.kind = 'lines' and x ->> 'line_id' = l.id::text;
      if v_q > v_open - v_held then raise exception 'CHECK_LINES_TAKEN' using errcode = '40001'; end if;
      v_amount := v_amount + public.horeca_line_part_cents(l, v_q);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('line_id', l.id, 'qty', v_q));
    end loop;
    if v_amount <= 0 then raise exception 'CHECK_PAY_INVALID' using errcode = '22023'; end if;
  end if;

  insert into public.check_online_payments (id, tenant_id, check_id, table_label, kind, lines, share_n, share_k, amount_cents, tip_cents, hold_until)
  values (p_payment_id, p_tenant_id, c.id, v_label, p_kind, v_lines,
          case when p_kind = 'share' then p_share_n end, case when p_kind = 'share' then p_share_k end,
          v_amount, coalesce(p_tip_cents, 0), now() + interval '10 minutes');
  perform public.horeca_bump(p_tenant_id);
  return jsonb_build_object('payment_id', p_payment_id, 'status', 'pending', 'amount_cents', v_amount, 'tip_cents', coalesce(p_tip_cents, 0),
    'check_id', c.id, 'table_label', v_label, 'duplicate', false);
end;
$$;
revoke all on function public.table_check_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.table_check_pay_start(uuid, uuid, uuid, text, jsonb, integer, integer, integer) to service_role;

-- 6. Betaling afronden (webhook of terugkeer van Stripe) ---------------------------------------------
-- Idempotent. Geeft {ok:true} of {refund:true, reason}; bij refund stort de edge function terug
-- en zet de status via table_check_pay_mark op refunded.
create or replace function public.table_check_pay_settle(p_payment_id uuid, p_amount_total_cents bigint, p_payment_intent text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.check_online_payments%rowtype;
  c public.dining_checks%rowtype;
  v_admin uuid;
  v_total bigint;
  v_terminal uuid;
  v_sub uuid;
  v_moves jsonb := '[]'::jsonb;
  e jsonb;
  v_res jsonb;
  v_target uuid;
  v_ids jsonb;
  v_reason text;
begin
  select * into r from public.check_online_payments where id = p_payment_id for update;
  if r.id is null then raise exception 'CHECK_PAY_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status = 'paid' then return jsonb_build_object('ok', true, 'duplicate', true, 'status', r.status); end if;
  if r.status in ('refund_needed', 'refunded') then
    return jsonb_build_object('ok', false, 'refund', r.status = 'refund_needed', 'status', r.status, 'reason', r.reason);
  end if;
  update public.check_online_payments set stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent), updated_at = now() where id = r.id;

  if p_amount_total_cents is distinct from (r.amount_cents + r.tip_cents) then
    v_reason := 'AMOUNT_MISMATCH';
  elsif public.horeca_tenant_fiscal(r.tenant_id) then
    v_reason := 'FISCAL';
  end if;

  if v_reason is null then
    select ur.user_id into v_admin from public.user_roles ur
     where ur.tenant_id = r.tenant_id and ur.role = 'tenant_admin' order by ur.created_at limit 1;
    if v_admin is null then v_reason := 'NO_ADMIN'; end if;
  end if;

  if v_reason is null then
    begin
      -- Afsluiten gebeurt door horeca_pay, als de beheerder van de zaak, op de kassa "Online (QR)".
      perform set_config('request.jwt.claim.sub', v_admin::text, true);
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'service_role')::text, true);
      perform set_config('sellqo.online_settle', r.tenant_id::text, true);
      v_terminal := public.horeca_online_terminal(r.tenant_id);

      select * into c from public.dining_checks where id = r.check_id and tenant_id = r.tenant_id for update;
      if c.id is null or c.status <> 'open' then raise exception 'CHECK_CLOSED'; end if;
      -- Review M1: de kassa rekent deze rekening net af (claim) → niet ook online; terugstorten.
      if c.paying_until is not null and c.paying_until > now() then raise exception 'CHECK_BUSY'; end if;
      select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = c.id and x.state = 'sent';

      if r.kind = 'full' then
        if v_total - c.online_credit_cents <> r.amount_cents then raise exception 'CHECK_CHANGED'; end if;
        v_target := c.id;
      elsif r.kind = 'share' then
        if r.amount_cents > v_total - c.online_credit_cents then raise exception 'CHECK_CHANGED'; end if;
        update public.dining_checks set online_credit_cents = online_credit_cents + r.amount_cents, version = version + 1, updated_at = now()
         where id = c.id returning * into c;
        if c.online_credit_cents = v_total then v_target := c.id; end if;
      else
        if c.online_credit_cents > 0 then raise exception 'CHECK_CHANGED'; end if;
        v_sub := gen_random_uuid();
        for e in select * from jsonb_array_elements(r.lines) loop
          v_moves := v_moves || jsonb_build_array(jsonb_build_object('line_id', e ->> 'line_id', 'qty', (e ->> 'qty')::integer,
            'from_line_id', gen_random_uuid(), 'to_line_id', gen_random_uuid()));
        end loop;
        v_res := public.horeca_apply_one(r.tenant_id, jsonb_build_object('id', gen_random_uuid(), 'kind', 'move_lines', 'check_id', c.id,
          'to_check_id', v_sub, 'split', true, 'to_name', 'Online (QR)', 'moves', v_moves));
        select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = v_sub and x.state = 'sent';
        if v_total <> r.amount_cents then raise exception 'CHECK_CHANGED'; end if;
        v_target := v_sub;
      end if;

      if v_target is not null then
        select coalesce(jsonb_agg(x.id), '[]'::jsonb) into v_ids from public.check_lines x where x.check_id = v_target and x.state = 'sent';
        select coalesce(sum(public.horeca_line_total(x)), 0) into v_total from public.check_lines x where x.check_id = v_target and x.state = 'sent';
        v_res := public.horeca_pay(r.tenant_id, 'online-qr', jsonb_build_object(
          -- Boek-id afgeleid van de betaling (niet het id dat de gast koos).
          'id', md5('table_check_pay:' || r.id::text)::uuid, 'check_id', v_target, 'terminal_id', v_terminal, 'line_ids', v_ids, 'expected_total_cents', v_total,
          'tenders', jsonb_build_array(jsonb_build_object('method', 'online', 'amount_cents', v_total)),
          'rounding_cents', 0, 'tip_cents', 0));
      end if;

      update public.check_online_payments set status = 'paid', paid_at = now(), settled_check_id = coalesce(v_sub, v_target), updated_at = now()
       where id = r.id;
      perform set_config('sellqo.online_settle', '', true);
      perform public.horeca_bump(r.tenant_id);
      return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'paid', 'closed', v_target is not null);
    exception when others then
      -- Alles van hierboven is teruggedraaid (subtransactie); het geld moet terug.
      v_reason := left(sqlerrm, 160);
    end;
  end if;

  perform set_config('sellqo.online_settle', '', true);
  update public.check_online_payments set status = 'refund_needed', reason = v_reason, updated_at = now() where id = r.id;
  perform public.horeca_bump(r.tenant_id);
  return jsonb_build_object('ok', false, 'refund', true, 'status', 'refund_needed', 'reason', v_reason);
end;
$$;
revoke all on function public.table_check_pay_settle(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.table_check_pay_settle(uuid, bigint, text) to service_role;

-- 7. Status zetten: sessie gekoppeld, vervallen, teruggestort -----------------------------------------
create or replace function public.table_check_pay_mark(p_payment_id uuid, p_status text, p_session_id text, p_refund_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.check_online_payments%rowtype;
begin
  select * into r from public.check_online_payments where id = p_payment_id for update;
  if r.id is null then raise exception 'CHECK_PAY_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_status = 'session' then
    if r.stripe_session_id is not null and r.stripe_session_id <> p_session_id then raise exception 'CHECK_PAY_INVALID' using errcode = '22023'; end if;
    update public.check_online_payments set stripe_session_id = p_session_id, updated_at = now() where id = r.id;
  elsif p_status = 'expired' then
    -- Enkel een openstaande betaling vervalt (de gast brak af of de sessie liep af).
    if r.status = 'pending' then
      update public.check_online_payments set status = 'expired', updated_at = now() where id = r.id;
      perform public.horeca_bump(r.tenant_id);
    end if;
  elsif p_status = 'refunded' then
    -- Idempotent: twee keer dezelfde terugstorting (webhook + gast tegelijk) = één keer.
    if r.status = 'refunded' then return jsonb_build_object('status', r.status, 'changed', false); end if;
    if r.status <> 'refund_needed' then raise exception 'CHECK_PAY_INVALID' using errcode = '22023'; end if;
    update public.check_online_payments set status = 'refunded', refund_id = p_refund_id, updated_at = now() where id = r.id;
  elsif p_status = 'notify_refunded' then
    -- Eén melding "teruggestort" per betaling (ook na een eerdere melding "mislukt": die wordt zo rechtgezet).
    if r.refund_notified_at is not null then return jsonb_build_object('status', r.status, 'changed', false); end if;
    update public.check_online_payments set refund_notified_at = now(), updated_at = now() where id = r.id;
  elsif p_status = 'notify_failed' then
    -- "Mislukt" enkel als er nog geen enkele melding ging.
    if r.refund_notified_at is not null or r.refund_failed_notified_at is not null then
      return jsonb_build_object('status', r.status, 'changed', false);
    end if;
    update public.check_online_payments set refund_failed_notified_at = now(), updated_at = now() where id = r.id;
  else
    raise exception 'CHECK_PAY_INVALID' using errcode = '22023';
  end if;
  select * into r from public.check_online_payments where id = p_payment_id;
  return jsonb_build_object('status', r.status, 'changed', true);
end;
$$;
revoke all on function public.table_check_pay_mark(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.table_check_pay_mark(uuid, text, text, text) to service_role;

-- 8. Patches op bestaande functies (md5-guard per functie, elke vervanging precies één keer) ----------
create or replace function pg_temp.patch_fn(p_sig text, p_md5 text, p_marker text, p_pairs text[])
returns void
language plpgsql
as $p$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
  n text;
  i integer;
begin
  if position(p_marker in d) > 0 then
    raise notice 'REKENING-ONLINE-1: % al gepatcht, overgeslagen', p_sig;
    return;
  end if;
  if md5(d) <> p_md5 then
    raise exception 'REKENING-ONLINE-1: % wijkt af (md5 %), patch niet toegepast', p_sig, md5(d);
  end if;
  n := d;
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if (length(n) - length(replace(n, p_pairs[2 * i - 1], ''))) / length(p_pairs[2 * i - 1]) <> 1 then
      raise exception 'REKENING-ONLINE-1: vervanging % in % raakt niet precies één keer', i, p_sig;
    end if;
    n := replace(n, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  execute n;
end;
$p$;

-- 8a. horeca_pay: pad "online afsluiten", betaalwijze 'online', voorschot en vasthoudingen.
select pg_temp.patch_fn('public.horeca_pay(uuid, text, jsonb)', 'b3d1d631b08c284d10e8f7207af316a7', 'REKENING-ONLINE-1', array[
  $a$  v_round_seq integer;
begin
$a$,
  $a$  v_round_seq integer;
  -- REKENING-ONLINE-1: online afsluiten (enkel via table_check_pay_settle, als service_role).
  v_online boolean := coalesce(current_setting('sellqo.online_settle', true), '') = p_tenant_id::text and coalesce(auth.role(), '') = 'service_role';
  v_online_sum bigint;
begin
$a$,
  $a$if v_staff is null or not exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id and s.is_active) then$a$,
  $a$if (v_staff is null and not v_online) or (v_staff is not null and not exists (select 1 from public.pos_cashiers s where s.id = v_staff and s.tenant_id = p_tenant_id and s.is_active)) then$a$,
  $a$    raise exception 'deze rekening wordt al afgerekend' using errcode = '55000';
  end if;
$a$,
  $a$    raise exception 'deze rekening wordt al afgerekend' using errcode = '55000';
  end if;
  if not v_online and exists (select 1 from public.check_online_payments o where o.check_id in (c.id, c.split_of)
                                and o.status = 'pending' and o.hold_until > now()) then
    raise exception 'een gast betaalt deze rekening nu online; probeer zo meteen opnieuw' using errcode = '55000';
  end if;
$a$,
  $a$'^(cash|card|transfer|cheque_meal|voucher|other)$'$a$,
  $a$'^(cash|card|transfer|cheque_meal|voucher|other|online)$'$a$,
  $a$  if v_total > 0 and jsonb_array_length(v_tenders) = 0 then raise exception 'geen betaalmiddel' using errcode = '22023'; end if;
$a$,
  $a$  if v_total > 0 and jsonb_array_length(v_tenders) = 0 then raise exception 'geen betaalmiddel' using errcode = '22023'; end if;
  -- REKENING-ONLINE-1: 'online' is geld dat via de QR binnenkwam. Aan de kassa = precies het voorschot.
  select coalesce(sum((x ->> 'amount_cents')::bigint) filter (where x ->> 'method' = 'online'), 0) into v_online_sum from jsonb_array_elements(v_tenders) x;
  if c.online_credit_cents > v_total then
    raise exception 'er is al meer online betaald (% cent) dan wat op de rekening staat: terugbetalen via Stripe', c.online_credit_cents using errcode = '22023';
  end if;
  if v_online then
    if v_online_sum <> v_total then raise exception 'online afsluiten: enkel online betaald' using errcode = '22023'; end if;
  elsif v_online_sum <> c.online_credit_cents then
    raise exception 'op deze rekening is % cent online betaald: dat bedrag hoort als ''online'' bij de betaling', c.online_credit_cents using errcode = '40001';
  end if;
$a$,
  $a$v_tip_method not in ('cash', 'card', 'transfer')$a$,
  $a$v_tip_method not in ('cash', 'card', 'transfer', 'online')$a$,
  $a$when x ->> 'method' = 'card' then 'card' else 'manual' end$a$,
  $a$when x ->> 'method' in ('card', 'online') then 'card' else 'manual' end$a$,
  $a$case when v_primary = 'card' then 'pos_card'$a$,
  $a$case when v_primary in ('card', 'online') then 'pos_card'$a$
]);

-- 8b. horeca_check_json: voorschot en lopende online betaling zichtbaar in de kassa.
select pg_temp.patch_fn('public.horeca_check_json(uuid)', '7d1233f45bb610642e7b4cca3322f0fe', 'online_credit_cents', array[
  $a$'kind', c.kind, 'service', c.service,$a$,
  $a$'kind', c.kind, 'service', c.service,
    'online_credit_cents', c.online_credit_cents,
    'online_pending_until', (select max(o.hold_until) from public.check_online_payments o
                             where o.check_id in (c.id, c.split_of) and o.status = 'pending' and o.hold_until > now()),$a$
]);

-- 8c. horeca_apply_one: niet verplaatsen/splitsen terwijl er online betaald wordt of al een voorschot is.
select pg_temp.patch_fn('public.horeca_apply_one(uuid, jsonb)', 'c779a03afcf406ee2d02cc50a0e04120', 'REKENING-ONLINE-1', array[
  $a$v_kind = 'move_lines' then
    select * into tgt$a$,
  $a$v_kind = 'move_lines' then
    -- REKENING-ONLINE-1: niet tijdens een online betaling en niet na een online voorschot (behalve online afsluiten zelf).
    if coalesce(current_setting('sellqo.online_settle', true), '') <> p_tenant_id::text then
      if c.online_credit_cents > 0 then
        raise exception 'op deze rekening is al online betaald: reken eerst de rest af' using errcode = '55000';
      end if;
      if exists (select 1 from public.check_online_payments o where o.check_id in (c.id, c.split_of) and o.status = 'pending' and o.hold_until > now()) then
        raise exception 'een gast betaalt deze rekening nu online; probeer zo meteen opnieuw' using errcode = '55000';
      end if;
    end if;
    select * into tgt$a$,
  -- Review M2 (ronde 2): na een online voorschot mag de rekening nooit lager worden dan wat gasten al
  -- betaalden, anders kan ze nooit meer afgesloten worden. Een annulering of korting is eerst een
  -- ontwerp-lijn: daarom tellen alle niet-geannuleerde lijnen mee (verwacht totaal), zodat de
  -- annulering zelf geweigerd wordt en niet pas de volgende ronde.
  $a$  return jsonb_build_object('id', v_id, 'ok', true, 'check', public.horeca_check_json(c.id));
end;$a$,
  $a$  if c.online_credit_cents > 0 and (select coalesce(sum(public.horeca_line_total(x)), 0) from public.check_lines x
                                      where x.check_id = c.id and x.state <> 'void') < c.online_credit_cents then
    raise exception 'gasten betaalden al % cent online: de rekening mag niet lager worden dan dat', c.online_credit_cents using errcode = '55000';
  end if;
  return jsonb_build_object('id', v_id, 'ok', true, 'check', public.horeca_check_json(c.id));
end;$a$
]);

-- 8d. kassa_report_data: fooi die online binnenkwam (check_online_payments) als fooi 'online'.
select pg_temp.patch_fn('public.kassa_report_data(uuid, timestamptz, timestamptz)', '57490c51771ff5754e49c8f19307d052', 'check_online_payments', array[
  $a$from (select tip_method, sum(tip_cents)::bigint as cents from cp where tip_cents > 0 group by tip_method) q)$a$,
  $a$from (select tip_method, sum(cents)::bigint as cents from (
                        select tip_method, tip_cents::bigint as cents from cp where tip_cents > 0
                        union all
                        -- REKENING-ONLINE-1: fooi bij een online betaling aan tafel.
                        select 'online', o.tip_cents::bigint from public.check_online_payments o
                         where o.tenant_id = p_tenant_id and o.status = 'paid' and o.tip_cents > 0 and o.paid_at >= p_from and o.paid_at < p_to
                      ) z group by tip_method) q)$a$
]);

-- LIMITS-1 — pakketlimieten afdwingen in de databank (Akke 17-10).
--  * Free: 10 producten, 20 orders per maand. Boven 20 orders gaat de checkout nooit dicht:
--    vanaf order 21 betaalt de winkel 2% per order (Stripe: meteen als applicatiefee;
--    overschrijving, afhalen, kassa: op de maandfactuur via platform_order_fees).
--  * Producten (tickets tellen niet mee) en gebruikers: hard limiet, nieuwe rijen geweigerd.
--  * Klantlimiet geschrapt (klanten ontstaan vanzelf uit orders en berichten).
--  * Vrijgestelde, interne en demowinkels: geen limieten, geen fees.
--  * Meldingen (met mail) op 80% en 100%, één keer per maand per drempel.
-- Snapshot vooraf: snapshots.platform_20261017c_pricing_plans.
-- Live gedraaid via query_database op 17-10-2026. Idempotent.

-- 1. Plannen ---------------------------------------------------------------
alter table public.pricing_plans add column if not exists overage_fee_percent numeric(5,2) not null default 0;
update public.pricing_plans set limit_products = 10, limit_orders = 20, overage_fee_percent = 2 where id = 'free';
update public.pricing_plans set limit_customers = null;

-- Vaste start van de telling (nooit now(): reproduceerbaar bij een herrun).
create or replace function public.platform_limits_start()
returns timestamptz language sql immutable as $$ select timestamptz '2026-10-18 00:00:00+02' $$;

create or replace function public.platform_tenant_unlimited(p_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(t.billing_exempt, false) or coalesce(t.is_internal_tenant, false) or coalesce(t.is_demo, false)
  from public.tenants t where t.id = p_tenant_id
$$;

-- 2. Harde limieten: producten (zonder tickets) en gebruikers ----------------
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_limit integer;
  v_count integer;
  v_kind text := tg_argv[0];
  v_row jsonb := to_jsonb(new);
begin
  if new.tenant_id is null or public.platform_tenant_unlimited(new.tenant_id) then return new; end if;
  -- Velden via jsonb: PL/pgSQL kortsluit AND niet, dus new.role op products (of omgekeerd)
  -- faalt met 42703. Dat brak op 17-10 drie minuten lang elk nieuw product (zie role-audit).
  if v_kind = 'products' then
    if coalesce(v_row->>'product_type', '') = 'ticket' then return new; end if;
  elsif v_kind = 'users' then
    if coalesce(v_row->>'role', '') = 'platform_admin' then return new; end if;
  end if;

  select case v_kind when 'products' then pp.limit_products when 'users' then pp.limit_users end
    into v_limit
  from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
  where s.tenant_id = new.tenant_id;
  if v_limit is null then return new; end if;

  -- Eén tegelijk per winkel, zodat twee gelijktijdige inserts het limiet niet samen overschrijden.
  perform pg_advisory_xact_lock(hashtext('plan_limit:' || v_kind || ':' || new.tenant_id::text));

  if v_kind = 'products' then
    select count(*) into v_count from public.products
     where tenant_id = new.tenant_id and coalesce(product_type::text, '') <> 'ticket';
  else
    -- Een extra rol voor iemand die al lid is, telt niet als nieuwe gebruiker.
    if exists (select 1 from public.user_roles where tenant_id = new.tenant_id and user_id = (v_row->>'user_id')::uuid) then
      return new;
    end if;
    select count(distinct user_id) into v_count from public.user_roles
     where tenant_id = new.tenant_id and role::text <> 'platform_admin';
  end if;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_%: limiet van % bereikt', upper(v_kind), v_limit
      using errcode = 'P0001', hint = 'upgrade', detail = json_build_object('kind', v_kind, 'limit', v_limit, 'count', v_count)::text;
  end if;
  return new;
end $$;

drop trigger if exists trg_plan_limit_products on public.products;
create trigger trg_plan_limit_products before insert on public.products
  for each row execute function public.enforce_plan_limit('products');
drop trigger if exists trg_plan_limit_users on public.user_roles;
create trigger trg_plan_limit_users before insert on public.user_roles
  for each row execute function public.enforce_plan_limit('users');

-- 3. Orders boven het limiet: 2% ------------------------------------------------
create index if not exists idx_orders_tenant_created on public.orders (tenant_id, created_at);

-- Betaalde orders zonder tickets van de kalendermaand (Brussel) die meetellen.
create or replace function public.platform_month_paid_orders(p_tenant_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int from public.orders o
  where o.tenant_id = p_tenant_id
    and o.payment_status in ('paid', 'partially_refunded', 'refunded')
    and o.created_at >= greatest(public.platform_limits_start(),
          (date_trunc('month', p_at at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'))
    and o.created_at < (date_trunc('month', p_at at time zone 'Europe/Brussels') + interval '1 month') at time zone 'Europe/Brussels'
    and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
$$;

-- Het percentage dat een NIEUWE order nu betaalt (0 = binnen het limiet, vrijgesteld of geen limiet).
-- Enige bron voor storefront-api; alleen service_role.
create or replace function public.platform_order_overage_rate(p_tenant_id uuid)
returns numeric
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when public.platform_tenant_unlimited(p_tenant_id) then 0
    when pp.limit_orders is null or coalesce(pp.overage_fee_percent, 0) <= 0 then 0
    when public.platform_month_paid_orders(p_tenant_id) >= pp.limit_orders then pp.overage_fee_percent
    else 0
  end
  from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
  where s.tenant_id = p_tenant_id
$$;
revoke all on function public.platform_order_overage_rate(uuid) from public, anon, authenticated;
grant execute on function public.platform_order_overage_rate(uuid) to service_role;
revoke all on function public.platform_month_paid_orders(uuid, timestamptz) from public, anon;
grant execute on function public.platform_month_paid_orders(uuid, timestamptz) to authenticated, service_role;

-- Wat storefront-api als applicatiefee op de Stripe-sessie zette (centen).
alter table public.storefront_carts add column if not exists platform_order_fee_cents integer;

create table if not exists public.platform_order_fees (
  order_id uuid primary key references public.orders(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  order_total numeric(12,2) not null,
  fee_percent numeric(5,2) not null,
  fee_cents integer not null,
  collected_via text not null check (collected_via in ('stripe_application_fee', 'invoice')),
  billing_cycle_id uuid references public.billing_cycles(id),
  invoiced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists platform_order_fees_unbilled_idx
  on public.platform_order_fees (tenant_id) where collected_via = 'invoice' and billing_cycle_id is null;
alter table public.platform_order_fees enable row level security;
drop policy if exists "Tenant leest eigen orderfees" on public.platform_order_fees;
create policy "Tenant leest eigen orderfees" on public.platform_order_fees for select to authenticated
  using (tenant_id in (select ur.tenant_id from public.user_roles ur where ur.user_id = auth.uid()) or public.is_platform_admin(auth.uid()));

-- Registratie: elke betaalde order boven het limiet krijgt één rij. Werd er via Stripe al
-- een fee geïnd (mandje), dan die; anders 2% op de maandfactuur.
create or replace function public.record_platform_order_fees()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare n integer;
begin
  with limited as (
    select s.tenant_id, pp.limit_orders, pp.overage_fee_percent
    from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
    where pp.limit_orders is not null and pp.overage_fee_percent > 0
      and not public.platform_tenant_unlimited(s.tenant_id)
  ),
  ranked as (
    select o.id, o.tenant_id, o.total, o.stripe_checkout_session_id, l.limit_orders, l.overage_fee_percent,
           row_number() over (
             partition by o.tenant_id, date_trunc('month', o.created_at at time zone 'Europe/Brussels')
             order by o.created_at, o.id) as rn
    from public.orders o join limited l on l.tenant_id = o.tenant_id
    where o.payment_status in ('paid', 'partially_refunded', 'refunded')
      and o.created_at >= public.platform_limits_start()
      and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
  ),
  candidates as (
    select r.*, c.platform_order_fee_cents as stripe_fee
    from ranked r
    left join lateral (
      select sc.platform_order_fee_cents from public.storefront_carts sc
      where r.stripe_checkout_session_id is not null and sc.stripe_session_id = r.stripe_checkout_session_id
      limit 1
    ) c on true
    where r.rn > r.limit_orders or coalesce(c.platform_order_fee_cents, 0) > 0
  )
  insert into public.platform_order_fees (order_id, tenant_id, order_total, fee_percent, fee_cents, collected_via)
  select id, tenant_id, total, overage_fee_percent,
         case when coalesce(stripe_fee, 0) > 0 then stripe_fee else round(total * overage_fee_percent)::int end,
         case when coalesce(stripe_fee, 0) > 0 then 'stripe_application_fee' else 'invoice' end
  from candidates
  where coalesce(total, 0) > 0
  on conflict (order_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.record_platform_order_fees() from public, anon, authenticated;

-- 4. Meldingen op 80% en 100% ------------------------------------------------------
create table if not exists public.plan_usage_notices (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('orders', 'products', 'users')),
  period text not null,          -- 'YYYY-MM' (Brussel)
  threshold integer not null check (threshold in (80, 100)),
  created_at timestamptz not null default now(),
  primary key (tenant_id, kind, period, threshold)
);
alter table public.plan_usage_notices enable row level security;

create or replace function public.notify_plan_usage()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  v_period text := to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM');
  v_starter numeric;
  v_break numeric;
  n integer := 0;
  v_thr integer;
  v_title text;
  v_msg text;
begin
  select monthly_price into v_starter from public.pricing_plans where id = 'starter';
  for r in
    select s.tenant_id, pp.limit_orders, pp.limit_products, pp.limit_users, pp.overage_fee_percent,
           public.platform_month_paid_orders(s.tenant_id) as orders_m,
           (select count(*) from public.products p where p.tenant_id = s.tenant_id and coalesce(p.product_type::text, '') <> 'ticket')::int as products_n,
           (select count(distinct ur.user_id) from public.user_roles ur where ur.tenant_id = s.tenant_id and ur.role::text <> 'platform_admin')::int as users_n
    from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
    join public.tenants t on t.id = s.tenant_id
    where not public.platform_tenant_unlimited(s.tenant_id)
      -- Winkels in afwachting (billing_on_hold, o.a. Sander) krijgen geen limietmails.
      and not coalesce(t.billing_on_hold, false)
      and (pp.limit_orders is not null or pp.limit_products is not null or pp.limit_users is not null)
  loop
    -- orders
    if r.limit_orders is not null and r.limit_orders > 0 then
      v_thr := case when r.orders_m >= r.limit_orders then 100 when r.orders_m * 100 >= r.limit_orders * 80 then 80 end;
      if v_thr is not null then
        insert into public.plan_usage_notices (tenant_id, kind, period, threshold) values (r.tenant_id, 'orders', v_period, v_thr)
        on conflict do nothing;
        if found then
          v_break := case when r.overage_fee_percent > 0 then round(v_starter * 100 / r.overage_fee_percent) end;
          if v_thr = 100 then
            v_title := 'Je gratis orders van deze maand zijn op';
            v_msg := format('Je hebt deze maand %s orders ontvangen, het maximum van je gratis plan. Je webshop blijft gewoon open: vanaf nu betaal je %s%% per order (bij kaartbetalingen meteen, anders op je maandfactuur). Met Starter (€%s per maand) betaal je niets per order; dat is voordeliger vanaf ongeveer €%s omzet per maand.',
              r.limit_orders, trim(to_char(r.overage_fee_percent, 'FM990.##')), trim(to_char(v_starter, 'FM9990')), trim(to_char(v_break, 'FM999990')));
          else
            v_title := 'Je nadert je gratis orders van deze maand';
            v_msg := format('Je zit aan %s van je %s gratis orders deze maand. Daarna blijft je webshop open, maar betaal je %s%% per order. Met Starter (€%s per maand) betaal je niets per order.',
              r.orders_m, r.limit_orders, trim(to_char(r.overage_fee_percent, 'FM990.##')), trim(to_char(v_starter, 'FM9990')));
          end if;
          insert into public.notifications (tenant_id, category, type, title, message, priority, action_url, data)
          values (r.tenant_id, 'subscriptions', 'plan_limit_orders_' || v_thr, v_title, v_msg,
                  case when v_thr = 100 then 'high' else 'medium' end::notification_priority, '/admin/billing',
                  jsonb_build_object('kind', 'orders', 'count', r.orders_m, 'limit', r.limit_orders, 'threshold', v_thr));
          n := n + 1;
        end if;
      end if;
    end if;
    -- producten
    if r.limit_products is not null and r.limit_products > 0 then
      v_thr := case when r.products_n >= r.limit_products then 100 when r.products_n * 100 >= r.limit_products * 80 then 80 end;
      if v_thr is not null then
        insert into public.plan_usage_notices (tenant_id, kind, period, threshold) values (r.tenant_id, 'products', v_period, v_thr)
        on conflict do nothing;
        if found then
          insert into public.notifications (tenant_id, category, type, title, message, priority, action_url, data)
          values (r.tenant_id, 'subscriptions', 'plan_limit_products_' || v_thr,
                  case when v_thr = 100 then 'Je hebt het maximum aantal producten bereikt' else 'Je nadert het maximum aantal producten' end,
                  case when v_thr = 100
                    then format('Je hebt %s producten, het maximum van je plan. Nieuwe producten toevoegen kan na een upgrade.', r.products_n)
                    else format('Je gebruikt %s van je %s producten. Upgrade op tijd om verder te kunnen toevoegen.', r.products_n, r.limit_products) end,
                  case when v_thr = 100 then 'high' else 'medium' end::notification_priority, '/admin/billing',
                  jsonb_build_object('kind', 'products', 'count', r.products_n, 'limit', r.limit_products, 'threshold', v_thr));
          n := n + 1;
        end if;
      end if;
    end if;
    -- gebruikers
    if r.limit_users is not null and r.limit_users > 0 then
      v_thr := case when r.users_n >= r.limit_users then 100 when r.users_n * 100 >= r.limit_users * 80 then 80 end;
      -- Een plan met 1 gebruiker zit altijd op 100%: daar geen melding over (de eigenaar zelf).
      if v_thr is not null and r.limit_users > 1 then
        insert into public.plan_usage_notices (tenant_id, kind, period, threshold) values (r.tenant_id, 'users', v_period, v_thr)
        on conflict do nothing;
        if found then
          insert into public.notifications (tenant_id, category, type, title, message, priority, action_url, data)
          values (r.tenant_id, 'subscriptions', 'plan_limit_users_' || v_thr,
                  case when v_thr = 100 then 'Je team zit op het maximum van je plan' else 'Je team nadert het maximum van je plan' end,
                  case when v_thr = 100
                    then format('Je team telt %s gebruikers, het maximum van je plan. Iemand extra uitnodigen kan na een upgrade.', r.users_n)
                    else format('Je team telt %s van %s gebruikers.', r.users_n, r.limit_users) end,
                  'medium'::notification_priority, '/admin/billing',
                  jsonb_build_object('kind', 'users', 'count', r.users_n, 'limit', r.limit_users, 'threshold', v_thr));
          n := n + 1;
        end if;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.notify_plan_usage() from public, anon, authenticated;

-- 5. Review-fixes (live gedraaid op 17-10, vóór de eerste geregistreerde orderfee).
-- Overschrijven de eerdere definities hierboven; de cron staat in drie aparte jobs.

-- Geen limieten, fees of meldingen voor: vrijgesteld, intern, demo, en winkels in afwachting
-- (billing_on_hold: o.a. Sander's winkels, gratis tot de overstap).
create or replace function public.platform_tenant_unlimited(p_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(t.billing_exempt, false) or coalesce(t.is_internal_tenant, false)
      or coalesce(t.is_demo, false) or coalesce(t.billing_on_hold, false)
  from public.tenants t where t.id = p_tenant_id
$$;
revoke all on function public.platform_tenant_unlimited(uuid) from public, anon, authenticated;

-- Harde limieten: niet tijdens een proefperiode (zelfde regel als de admin) en niet voor
-- een platformbeheerder die een winkel inricht.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_limit integer;
  v_status text;
  v_count integer;
  v_kind text := tg_argv[0];
  v_row jsonb := to_jsonb(new);
begin
  if new.tenant_id is null or public.platform_tenant_unlimited(new.tenant_id) then return new; end if;
  if auth.uid() is not null and public.is_platform_admin(auth.uid()) then return new; end if;
  -- Velden via jsonb: PL/pgSQL kortsluit AND niet, dus new.role op products (of omgekeerd)
  -- faalt met 42703. Dat brak op 17-10 drie minuten lang elk nieuw product (zie role-audit).
  if v_kind = 'products' then
    if coalesce(v_row->>'product_type', '') = 'ticket' then return new; end if;
  elsif v_kind = 'users' then
    if coalesce(v_row->>'role', '') = 'platform_admin' then return new; end if;
  end if;

  select case v_kind when 'products' then pp.limit_products when 'users' then pp.limit_users end, s.status::text
    into v_limit, v_status
  from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
  where s.tenant_id = new.tenant_id;
  if v_limit is null or v_status = 'trialing' then return new; end if;

  -- Eén tegelijk per winkel, zodat twee gelijktijdige inserts het limiet niet samen overschrijden.
  perform pg_advisory_xact_lock(hashtext('plan_limit:' || v_kind || ':' || new.tenant_id::text));

  if v_kind = 'products' then
    select count(*) into v_count from public.products
     where tenant_id = new.tenant_id and coalesce(product_type::text, '') <> 'ticket';
  else
    -- Een extra rol voor iemand die al lid is, telt niet als nieuwe gebruiker.
    if exists (select 1 from public.user_roles where tenant_id = new.tenant_id and user_id = (v_row->>'user_id')::uuid) then
      return new;
    end if;
    select count(distinct user_id) into v_count from public.user_roles
     where tenant_id = new.tenant_id and role::text <> 'platform_admin';
  end if;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_%: limiet van % bereikt', upper(v_kind), v_limit
      using errcode = 'P0001', hint = 'upgrade', detail = json_build_object('kind', v_kind, 'limit', v_limit, 'count', v_count)::text;
  end if;
  return new;
end $$;

-- Teller alleen voor de eigen winkel (of service_role, cron en platformbeheer).
create or replace function public.platform_month_paid_orders(p_tenant_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int from public.orders o
  where o.tenant_id = p_tenant_id
    and (auth.uid() is null
         or public.is_platform_admin(auth.uid())
         or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.tenant_id = p_tenant_id))
    and o.payment_status in ('paid', 'partially_refunded', 'refunded')
    and o.created_at >= greatest(public.platform_limits_start(),
          (date_trunc('month', p_at at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'))
    and o.created_at < (date_trunc('month', p_at at time zone 'Europe/Brussels') + interval '1 month') at time zone 'Europe/Brussels'
    and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
$$;

-- Wat Stripe als 2%-applicatiefee inhield, staat op de order zelf (uit de sessiemetadata),
-- niet op het mandje: een mandje kan meerdere sessies hebben.
alter table public.orders add column if not exists platform_order_fee_cents integer;
alter table public.storefront_carts drop column if exists platform_order_fee_cents;

-- Registratie per winkel per maand: nodig = max(0, meetellende orders − limiet); wat al in
-- het register staat (ook via Stripe geïnd) telt mee. Alleen het tekort komt op de factuur,
-- de nieuwste orders eerst. Nooit dubbel, ook niet als een oudere order later betaald wordt
-- of een kaartbetaling over de maandgrens valt. Alleen de lopende en de vorige maand (het
-- plan van vandaag geldt niet met terugwerkende kracht).
create or replace function public.record_platform_order_fees()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  m date;
  v_from timestamptz;
  v_to timestamptz;
  v_cnt integer;
  v_have integer;
  v_need integer;
  k integer;
  n integer := 0;
begin
  for r in
    select s.tenant_id, pp.limit_orders, pp.overage_fee_percent
    from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
    where pp.limit_orders is not null and pp.overage_fee_percent > 0
      and not public.platform_tenant_unlimited(s.tenant_id)
  loop
    foreach m in array array[
      (date_trunc('month', now() at time zone 'Europe/Brussels') - interval '1 month')::date,
      date_trunc('month', now() at time zone 'Europe/Brussels')::date]
    loop
      v_from := greatest(public.platform_limits_start(), m::timestamp at time zone 'Europe/Brussels');
      v_to := (m + interval '1 month')::timestamp at time zone 'Europe/Brussels';
      continue when v_to <= v_from;

      -- 1. Via Stripe al geïnd: altijd registreren (telt mee als "al betaald").
      insert into public.platform_order_fees (order_id, tenant_id, order_total, fee_percent, fee_cents, collected_via)
      select o.id, o.tenant_id, o.total, r.overage_fee_percent, o.platform_order_fee_cents, 'stripe_application_fee'
      from public.orders o
      where o.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to
        and o.payment_status in ('paid', 'partially_refunded', 'refunded')
        and coalesce(o.platform_order_fee_cents, 0) > 0
      on conflict (order_id) do nothing;
      get diagnostics k = row_count; n := n + k;

      -- 2. Tekort op de maandfactuur.
      select count(*) into v_cnt from public.orders o
      where o.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to
        and o.payment_status in ('paid', 'partially_refunded', 'refunded')
        and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null);
      select count(*) into v_have from public.platform_order_fees f join public.orders o on o.id = f.order_id
      where f.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to;
      v_need := greatest(0, v_cnt - r.limit_orders) - v_have;
      if v_need > 0 then
        insert into public.platform_order_fees (order_id, tenant_id, order_total, fee_percent, fee_cents, collected_via)
        select o.id, o.tenant_id, o.total, r.overage_fee_percent, round(o.total * r.overage_fee_percent)::int, 'invoice'
        from public.orders o
        where o.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to
          and o.payment_status in ('paid', 'partially_refunded', 'refunded')
          and coalesce(o.total, 0) > 0
          and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
          and not exists (select 1 from public.platform_order_fees f where f.order_id = o.id)
        order by o.created_at desc, o.id desc
        limit v_need
        on conflict (order_id) do nothing;
        get diagnostics k = row_count; n := n + k;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.record_platform_order_fees() from public, anon, authenticated;

-- Cron: drie aparte jobs, zodat een fout in de meldingen de feeregistratie niet terugdraait.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'record-platform-ticket-fees') then
    perform cron.alter_job((select jobid from cron.job where jobname = 'record-platform-ticket-fees'),
      command := 'select public.record_platform_ticket_fees()');
  end if;
  if not exists (select 1 from cron.job where jobname = 'record-platform-order-fees') then
    perform cron.schedule('record-platform-order-fees', '*/15 * * * *', 'select public.record_platform_order_fees()');
  end if;
  if not exists (select 1 from cron.job where jobname = 'notify-plan-usage') then
    perform cron.schedule('notify-plan-usage', '7 * * * *', 'select public.notify_plan_usage()');
  end if;
end $$;
-- 6. Tweede reviewronde (live gedraaid op 17-10).

-- Sinds wanneer staat de winkel op dit plan? Orders van vóór de overstap (proef op Pro, een
-- betaald plan vóór een downgrade) tellen nooit mee voor het limiet van het nieuwe plan.
alter table public.tenant_subscriptions add column if not exists plan_since timestamptz;
update public.tenant_subscriptions set plan_since = timestamptz '2026-10-17 00:00:00+02' where plan_since is null;
alter table public.tenant_subscriptions alter column plan_since set default now();
create or replace function public.tenant_subscriptions_plan_since()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  if tg_op = 'INSERT' then
    new.plan_since := coalesce(new.plan_since, now());
  elsif new.plan_id is distinct from old.plan_id then
    new.plan_since := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_tenant_subscriptions_plan_since on public.tenant_subscriptions;
create trigger trg_tenant_subscriptions_plan_since before insert or update of plan_id on public.tenant_subscriptions
  for each row execute function public.tenant_subscriptions_plan_since();

-- Teamgrootte: unieke personen, zonder platformbeheerders (ook niet als die een rol in de
-- winkel hebben). Eén bron voor trigger, meldingen, uitnodigingen en de admin.
create or replace function public.platform_team_size(p_tenant_id uuid)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(distinct ur.user_id)::int from public.user_roles ur
  where ur.tenant_id = p_tenant_id
    and ur.role::text <> 'platform_admin'
    and not public.is_platform_admin(ur.user_id)
    and (auth.uid() is null
         or public.is_platform_admin(auth.uid())
         or exists (select 1 from public.user_roles me where me.user_id = auth.uid() and me.tenant_id = p_tenant_id))
$$;
revoke all on function public.platform_team_size(uuid) from public, anon;
grant execute on function public.platform_team_size(uuid) to authenticated, service_role;

-- Meetellende orders: betaald, geen tickets, bedrag > 0, sinds de start van de maand, de
-- start van de telling én de overstap naar dit plan.
create or replace function public.platform_month_paid_orders(p_tenant_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int from public.orders o
  where o.tenant_id = p_tenant_id
    and (auth.uid() is null
         or public.is_platform_admin(auth.uid())
         or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.tenant_id = p_tenant_id))
    and o.payment_status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(o.total, 0) > 0
    and o.created_at >= greatest(public.platform_limits_start(),
          (date_trunc('month', p_at at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'),
          coalesce((select s.plan_since from public.tenant_subscriptions s where s.tenant_id = p_tenant_id), '-infinity'::timestamptz))
    and o.created_at < (date_trunc('month', p_at at time zone 'Europe/Brussels') + interval '1 month') at time zone 'Europe/Brussels'
    and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
$$;

-- Harde limieten: ook bij een producttype dat van ticket naar iets anders gaat; proef alleen
-- als die echt nog loopt; teamgrootte zonder platformbeheerders.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_limit integer;
  v_trial boolean;
  v_count integer;
  v_kind text := tg_argv[0];
  v_row jsonb := to_jsonb(new);
begin
  if new.tenant_id is null or public.platform_tenant_unlimited(new.tenant_id) then return new; end if;
  if auth.uid() is not null and public.is_platform_admin(auth.uid()) then return new; end if;
  -- Velden via jsonb: PL/pgSQL kortsluit AND niet, dus new.role op products (of omgekeerd)
  -- faalt met 42703. Dat brak op 17-10 drie minuten lang elk nieuw product (zie role-audit).
  if v_kind = 'products' then
    if coalesce(v_row->>'product_type', '') = 'ticket' then return new; end if;
    -- Een update telt alleen als een ticket een gewoon product wordt.
    if tg_op = 'UPDATE' and coalesce(to_jsonb(old)->>'product_type', '') <> 'ticket' then return new; end if;
  elsif v_kind = 'users' then
    if coalesce(v_row->>'role', '') = 'platform_admin' then return new; end if;
    if public.is_platform_admin((v_row->>'user_id')::uuid) then return new; end if;
  end if;

  select case v_kind when 'products' then pp.limit_products when 'users' then pp.limit_users end,
         s.status::text = 'trialing' and (s.trial_end is null or s.trial_end > now())
    into v_limit, v_trial
  from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
  where s.tenant_id = new.tenant_id;
  if v_limit is null or coalesce(v_trial, false) then return new; end if;

  -- Eén tegelijk per winkel, zodat twee gelijktijdige inserts het limiet niet samen overschrijden.
  perform pg_advisory_xact_lock(hashtext('plan_limit:' || v_kind || ':' || new.tenant_id::text));

  if v_kind = 'products' then
    select count(*) into v_count from public.products
     where tenant_id = new.tenant_id and coalesce(product_type::text, '') <> 'ticket'
       and (tg_op = 'INSERT' or id <> (v_row->>'id')::uuid);
  else
    -- Een extra rol voor iemand die al lid is, telt niet als nieuwe gebruiker.
    if exists (select 1 from public.user_roles where tenant_id = new.tenant_id and user_id = (v_row->>'user_id')::uuid) then
      return new;
    end if;
    v_count := public.platform_team_size(new.tenant_id);
  end if;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_%: limiet van % bereikt', upper(v_kind), v_limit
      using errcode = 'P0001', hint = 'upgrade', detail = json_build_object('kind', v_kind, 'limit', v_limit, 'count', v_count)::text;
  end if;
  return new;
end $$;
drop trigger if exists trg_plan_limit_products_type on public.products;
create trigger trg_plan_limit_products_type before update of product_type on public.products
  for each row execute function public.enforce_plan_limit('products');

-- Register: zelfde telling als hierboven (plan_since, bedrag > 0) en 10 minuten wachttijd, zodat
-- een order die net binnenkomt (Stripe-fee of orderregels nog onderweg) nooit half geteld wordt.
create or replace function public.record_platform_order_fees()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  m date;
  v_from timestamptz;
  v_to timestamptz;
  v_settled timestamptz := now() - interval '10 minutes';
  v_cnt integer;
  v_have integer;
  v_need integer;
  k integer;
  n integer := 0;
begin
  for r in
    select s.tenant_id, s.plan_since, pp.limit_orders, pp.overage_fee_percent
    from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
    where pp.limit_orders is not null and pp.overage_fee_percent > 0
      and not public.platform_tenant_unlimited(s.tenant_id)
  loop
    foreach m in array array[
      (date_trunc('month', now() at time zone 'Europe/Brussels') - interval '1 month')::date,
      date_trunc('month', now() at time zone 'Europe/Brussels')::date]
    loop
      -- Via Stripe al geïnd: altijd registreren, los van plan_since (het is betaald).
      insert into public.platform_order_fees (order_id, tenant_id, order_total, fee_percent, fee_cents, collected_via)
      select o.id, o.tenant_id, o.total, r.overage_fee_percent, o.platform_order_fee_cents, 'stripe_application_fee'
      from public.orders o
      where o.tenant_id = r.tenant_id
        and o.created_at >= greatest(public.platform_limits_start(), m::timestamp at time zone 'Europe/Brussels')
        and o.created_at < (m + interval '1 month')::timestamp at time zone 'Europe/Brussels'
        and o.payment_status in ('paid', 'partially_refunded', 'refunded')
        and coalesce(o.platform_order_fee_cents, 0) > 0
      on conflict (order_id) do nothing;
      get diagnostics k = row_count; n := n + k;

      v_from := greatest(public.platform_limits_start(), m::timestamp at time zone 'Europe/Brussels', coalesce(r.plan_since, '-infinity'::timestamptz));
      v_to := least((m + interval '1 month')::timestamp at time zone 'Europe/Brussels', v_settled);
      continue when v_to <= v_from;

      select count(*) into v_cnt from public.orders o
      where o.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to
        and o.payment_status in ('paid', 'partially_refunded', 'refunded')
        and coalesce(o.total, 0) > 0
        and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null);
      select count(*) into v_have from public.platform_order_fees f join public.orders o on o.id = f.order_id
      where f.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to;
      v_need := greatest(0, v_cnt - r.limit_orders) - v_have;
      if v_need > 0 then
        insert into public.platform_order_fees (order_id, tenant_id, order_total, fee_percent, fee_cents, collected_via)
        select o.id, o.tenant_id, o.total, r.overage_fee_percent, round(o.total * r.overage_fee_percent)::int, 'invoice'
        from public.orders o
        where o.tenant_id = r.tenant_id and o.created_at >= v_from and o.created_at < v_to
          and o.payment_status in ('paid', 'partially_refunded', 'refunded')
          and coalesce(o.total, 0) > 0
          and coalesce(o.platform_order_fee_cents, 0) = 0
          and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.event_detail_id is not null)
          and not exists (select 1 from public.platform_order_fees f where f.order_id = o.id)
        order by o.created_at desc, o.id desc
        limit v_need
        on conflict (order_id) do nothing;
        get diagnostics k = row_count; n := n + k;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.record_platform_order_fees() from public, anon, authenticated;

-- Meldingen: teamgrootte uit dezelfde functie.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.notify_plan_usage'::regproc);
  d := replace(d,
    '(select count(distinct ur.user_id) from public.user_roles ur where ur.tenant_id = s.tenant_id and ur.role::text <> ''platform_admin'')::int as users_n',
    'public.platform_team_size(s.tenant_id) as users_n');
  if position('platform_team_size' in d) = 0 then raise exception 'notify_plan_usage: vervanging niet gevonden'; end if;
  execute d;
end $$;

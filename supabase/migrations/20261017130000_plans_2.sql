-- PLANS-2 — vaste prijsstructuur (projectdoc claude/sellqo-prijsstructuur.md, go Akke 17-10-2026).
-- Live gedraaid via query_database op 17-10-2026; snapshots in snapshots.platform_20261017_*.
-- Idempotent. Vaste tijdstippen, nooit now() voor het bepalen van welke orders meetellen.

-- 1. Nieuwe kolommen
alter table public.pricing_plans add column if not exists min_term_months integer not null default 0;

-- 2. Webshopspoor: limieten op wat SellQo geld kost, niet op groei
update public.pricing_plans set limit_products = 25,   limit_orders = 50,   limit_users = 1,  ai_credits_monthly = 0    where id = 'free';
update public.pricing_plans set limit_products = 250,  limit_orders = null, limit_users = 2,  ai_credits_monthly = 50   where id = 'starter';
update public.pricing_plans set limit_products = 5000, limit_orders = null, limit_users = 5,  ai_credits_monthly = 300  where id = 'pro';
update public.pricing_plans set limit_products = null, limit_orders = null, limit_users = 25, ai_credits_monthly = 1500 where id = 'enterprise';

-- Pro → Enterprise: schaal en controle
update public.pricing_plans
   set features = features || '{"multi_warehouse": false, "multiCurrency": false, "ai_ab_testing": false, "advancedAnalytics": false, "prioritySupport": false}'::jsonb
 where id = 'pro';

-- Zaalplan met vaste plaatsen: alleen Events Vast en Enterprise
update public.pricing_plans set features = features || '{"event_seating": false}'::jsonb where id in ('free', 'starter', 'pro', 'horeca', 'events_flex');
update public.pricing_plans set features = features || '{"event_seating": true}'::jsonb  where id = 'enterprise';

-- 3. Horecaspoor
update public.pricing_plans set name = 'Horeca Small', limit_orders = null, limit_users = 3, ai_credits_monthly = 50 where id = 'horeca';
insert into public.pricing_plans (id, name, slug, monthly_price, yearly_price, currency, limit_products, limit_orders, limit_customers,
  limit_users, limit_storage_gb, limit_api_calls, features, highlighted, sort_order, active, ai_credits_monthly,
  included_transactions_monthly, transaction_overage_fee, ticket_fee, track, min_term_months)
select 'horeca_big', 'Horeca Big', 'horeca_big', 99, 990, currency, 2000, null, limit_customers,
  10, limit_storage_gb, limit_api_calls,
  features || '{"advancedAnalytics": true, "prioritySupport": true, "event_seating": false}'::jsonb,
  false, sort_order, true, 200, included_transactions_monthly, transaction_overage_fee, 0, 'horeca', 0
from public.pricing_plans where id = 'horeca'
on conflict (id) do nothing;

-- 4. Eventsspoor: altijd een ticketfee
update public.pricing_plans set ticket_fee = 0.69, limit_users = 2 where id = 'events_flex';
insert into public.pricing_plans (id, name, slug, monthly_price, yearly_price, currency, limit_products, limit_orders, limit_customers,
  limit_users, limit_storage_gb, limit_api_calls, features, highlighted, sort_order, active, ai_credits_monthly,
  included_transactions_monthly, transaction_overage_fee, ticket_fee, track, min_term_months)
select 'events_vast', 'Events Vast', 'events_vast', 49, 490, currency, 100, null, limit_customers,
  5, limit_storage_gb, limit_api_calls,
  features || '{"event_seating": true, "prioritySupport": true}'::jsonb,
  false, sort_order, true, 50, included_transactions_monthly, transaction_overage_fee, 0.29, 'events', 12
from public.pricing_plans where id = 'events_flex'
on conflict (id) do nothing;

-- 5. Add-ons: eigen tabel (nooit kiesbaar als hoofdplan)
create table if not exists public.platform_addons (
  id text primary key,
  name text not null,
  track text not null check (track in ('webshop', 'horeca', 'events')),
  monthly_price numeric not null default 0,
  yearly_price numeric not null default 0,
  ticket_fee numeric not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_addons enable row level security;
drop policy if exists "Iedereen leest add-ons" on public.platform_addons;
create policy "Iedereen leest add-ons" on public.platform_addons for select using (true);
drop policy if exists "Platformadmins beheren add-ons" on public.platform_addons;
create policy "Platformadmins beheren add-ons" on public.platform_addons for all
  using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
insert into public.platform_addons (id, name, track, monthly_price, yearly_price, ticket_fee, sort_order) values
  ('addon_webshop', 'Webshop-add-on', 'webshop', 19, 190, 0, 1),
  ('addon_horeca',  'Horeca-add-on',  'horeca',  29, 290, 0, 2),
  ('addon_events',  'Events-add-on',  'events',  0,   0,  0.69, 3)
on conflict (id) do nothing;

-- 6. Ticketfee: één bron voor storefront-api én het fee-register
create or replace function public.platform_ticket_fee_for(p_tenant_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    -- intern, demo of vrijgesteld (Fonske, VanXcel, Loveke, demo's): nooit een fee
    when coalesce(t.billing_exempt, false) or coalesce(t.is_demo, false) or coalesce(t.is_internal_tenant, false) then 0
    -- eventsplan: de fee van het plan (Flex 0,69 / Vast 0,29)
    when pp.track = 'events' then coalesce(pp.ticket_fee, 0)
    -- elk ander plan dat tickets verkoopt (add-on, ontgrendeld of oude eventproducten): de Flex-fee van de add-on
    else coalesce((select a.ticket_fee from public.platform_addons a where a.id = 'addon_events' and a.active), 0.69)
  end
  from public.tenants t
  left join public.tenant_subscriptions s on s.tenant_id = t.id
  left join public.pricing_plans pp on pp.id = s.plan_id
  where t.id = p_tenant_id
$$;
revoke all on function public.platform_ticket_fee_for(uuid) from public, anon, authenticated;
grant execute on function public.platform_ticket_fee_for(uuid) to service_role;

-- 7. Fee-register: elk betaald ticket wordt vastgelegd, ook buiten Stripe (kassa, handmatig)
create table if not exists public.platform_ticket_fees (
  order_id uuid primary key references public.orders(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  tickets integer not null,
  fee_per_ticket numeric not null,
  fee_cents integer not null,
  collected_via text not null check (collected_via in ('stripe_application_fee', 'invoice', 'exempt')),
  invoiced_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.platform_ticket_fees enable row level security;
drop policy if exists "Platformadmins lezen fees" on public.platform_ticket_fees;
create policy "Platformadmins lezen fees" on public.platform_ticket_fees for select using (public.is_platform_admin(auth.uid()));
create index if not exists platform_ticket_fees_tenant_idx on public.platform_ticket_fees (tenant_id, invoiced_at);

create or replace function public.record_platform_ticket_fees()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare n integer;
begin
  insert into public.platform_ticket_fees (order_id, tenant_id, tickets, fee_per_ticket, fee_cents, collected_via)
  select o.id, o.tenant_id, x.tickets, f.fee, round(f.fee * 100)::int * x.tickets,
         case when f.fee = 0 then 'exempt'
              when o.stripe_checkout_session_id is not null or o.stripe_payment_intent_id is not null then 'stripe_application_fee'
              else 'invoice' end
  from public.orders o
  join lateral (
    select sum(oi.quantity)::int as tickets from public.order_items oi
    where oi.order_id = o.id and oi.event_detail_id is not null and oi.unit_price > 0
  ) x on x.tickets > 0
  cross join lateral (select public.platform_ticket_fee_for(o.tenant_id) as fee) f
  where o.payment_status in ('paid', 'partially_refunded', 'refunded')
    and o.created_at >= timestamptz '2026-10-17 00:00:00+02'   -- vaste start van PLANS-2
  on conflict (order_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.record_platform_ticket_fees() from public, anon, authenticated;

-- Elk kwartier bijwerken (alleen SQL, geen net.http)
select cron.unschedule(jobid) from cron.job where jobname = 'record-platform-ticket-fees';
select cron.schedule('record-platform-ticket-fees', '*/15 * * * *', $$select public.record_platform_ticket_fees()$$);

-- 8. Vaste volgorde binnen elk spoor (sort_order mag niet gelijk zijn aan de kleinere broer)
update public.pricing_plans set sort_order = 6 where id = 'horeca_big';
update public.pricing_plans set sort_order = 7 where id = 'events_vast';

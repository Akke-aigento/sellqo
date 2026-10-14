-- PRICE-2 — plannen per sector.
--  - pricing_plans.ticket_fee: vaste kost per betaald ticket, geïnd als Stripe application
--    fee (FLEX-1). 0 voor alle bestaande plannen: niets verandert voor bestaande winkels.
--  - events_flex: €0 per maand, €0,49 per betaald ticket. Staat UIT tot de storefront-api-
--    en sync-tenant-plan-deploy bewezen is (aparte activatie, zie role-audit).
--  - Free: een kleine webshop op <slug>.sellqo.shop (webshop_builder aan).
--  - Transactie-overage: werd nooit aangerekend maar wel getoond; uitgezet (onbeperkt, €0).
-- Additief: nieuwe kolom met default 0, nieuw plan inactief, alleen feature-vlaggen/overage.

alter table public.pricing_plans add column if not exists ticket_fee numeric not null default 0;
comment on column public.pricing_plans.ticket_fee is
  'FLEX-1: vaste kost per betaald ticket (EUR), geïnd als Stripe application fee bij online betaling.';

insert into public.pricing_plans (id, name, slug, monthly_price, yearly_price, limit_products, limit_orders,
  limit_customers, limit_users, limit_storage_gb, limit_api_calls, features, highlighted, sort_order, active,
  ai_credits_monthly, included_transactions_monthly, transaction_overage_fee, ticket_fee)
select 'events_flex', 'Events Flex', 'events_flex', 0, 0, 25, null, 10000, 3, 5, 10000,
  s.features || jsonb_build_object('events', true, 'webshop_builder', true, 'customDomain', true, 'removeWatermark', false),
  false, 4, false, 0, -1, 0, 0.49
from public.pricing_plans s where s.id = 'free'
on conflict (id) do nothing;

update public.pricing_plans
  set features = features || jsonb_build_object('webshop_builder', true)
  where id = 'free';

update public.pricing_plans
  set included_transactions_monthly = -1, transaction_overage_fee = 0
  where included_transactions_monthly <> -1 or transaction_overage_fee <> 0;

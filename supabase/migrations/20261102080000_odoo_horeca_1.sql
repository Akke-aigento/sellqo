-- ODOO-HORECA-1 — de Odoo-boekhoudkoppeling (feature odoo_sync) ook in Horeca Big.
--
-- Bron: pricing_plans.features is jsonb; de gating leest het plan via checkFeature('odoo_sync')
-- (src/hooks/useUsageLimits.ts: features[key] === true) in OdooAccountingCard, en de prijzenpagina
-- en onboarding tonen de regel landing.pricing.feat_odoo via src/lib/planLines.ts zodra de vlag true is.
-- Live nagetrokken op 2-11-2026: horeca_big.features->'odoo_sync' = false, pro/enterprise = true,
-- geen databankfunctie leest features->'odoo_sync' (enkel watchtower_health_snapshot gebruikt de naam
-- als health-sleutel). Geen winkel staat vandaag op horeca_big: niemand verliest of krijgt iets ongemerkt.
--
-- Raakt enkel die ene sleutel van dat ene plan (jsonb_set), de rest van features blijft byte-gelijk.
-- Idempotent: tweede run vindt odoo_sync al op true en doet niets (ook updated_at blijft staan).
--
-- Handmatig terugdraaien:
--   update public.pricing_plans set features = jsonb_set(features, '{odoo_sync}', 'false'::jsonb)
--    where id = 'horeca_big';
--   (de vorige features staan in ops.odoo_horeca_1_prev_plan)

create schema if not exists ops;
create table if not exists ops.odoo_horeca_1_prev_plan as
  select id, features, now() as saved_at from public.pricing_plans where id = 'horeca_big';
revoke all on ops.odoo_horeca_1_prev_plan from anon, authenticated;

update public.pricing_plans
   set features = jsonb_set(coalesce(features, '{}'::jsonb), '{odoo_sync}', 'true'::jsonb, true)
 where id = 'horeca_big'
   and coalesce(features -> 'odoo_sync', 'null'::jsonb) is distinct from 'true'::jsonb;

-- CUSTAUTH-1 — bestaande storefront-klanten grandfatheren als geverifieerd.
--
-- WAAROM. De order-endpoints van storefront-customer-api (get_orders, get_order)
-- gaan weigeren zodra email_verified false is. Alle accounts die nu bestaan staan
-- op false, want er was tot deze batch geen verificatieflow. Zonder deze migratie
-- verliezen VanXcel (3) en Mancini (2) hun orderhistorie op het moment van deploy.
--
-- VOLGORDE — NIET VRIJ.
--   1. Tel eerst:  SELECT count(*) FROM public.storefront_customers WHERE email_verified = false;
--      Verwacht ~5. Wijkt het af, STOP en overleg: dan bestaan er accounts die we
--      niet kenden, en grandfathert deze migratie er meer dan bedoeld.
--   2. Draai deze migratie.
--   3. Natrek (zie onder).
--   4. PAS DAARNA de edge function deployen met de enforcement.
-- Nooit andersom.
--
-- WAAROM EEN VASTE TIMESTAMP EN GEEN now().
-- Met `created_at < now()` zou een tweede run óók accounts grandfatheren die ná de
-- invoering onverified zijn aangemaakt — precies de accounts die de enforcement
-- moet tegenhouden. De grens staat daarom hard op het moment van schrijven.
--
-- LET OP bij vertraagd draaien: accounts die tussen deze timestamp en de deploy
-- worden aangemaakt vallen buiten de grens. Die zijn niet stuk — zij kunnen
-- `resend_verification` gebruiken om alsnog een verificatiemail te krijgen. Duurt
-- het langer dan een dag voor je dit draait, overweeg dan de literal hieronder te
-- verhogen naar het werkelijke uitvoermoment; stap 1 laat het verschil zien.
--
-- Idempotent: een tweede run raakt niets meer, want alle rijen vóór de grens staan
-- dan al op true.
--
-- Handmatig terugdraaien: niet generiek mogelijk — er is geen kolom die vastlegt
-- welke rijen door DEZE migratie zijn omgezet. De geraakte id's worden vastgelegd
-- in de role-audit-entry CUSTAUTH-1; terugdraaien gaat via die lijst:
--   UPDATE public.storefront_customers SET email_verified = false WHERE id IN (...);

UPDATE public.storefront_customers
SET email_verified = true
WHERE email_verified = false
  AND created_at < TIMESTAMPTZ '2026-08-24 15:57:06+00';

-- Natrek na afloop (verwacht: 0 rijen):
--   SELECT sc.id, t.slug, sc.email_verified, sc.created_at
--   FROM public.storefront_customers sc JOIN public.tenants t ON t.id = sc.tenant_id
--   WHERE sc.email_verified = false
--     AND sc.created_at < TIMESTAMPTZ '2026-08-24 15:57:06+00';

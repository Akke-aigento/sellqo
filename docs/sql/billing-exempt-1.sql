-- BILLING-EXEMPT-1 — "geen SellQo-facturatie" los van "dit is SellQo zelf".
--
-- BEWUST GEEN MIGRATIE in supabase/migrations/: chat-Claude voert dit uit via de connector.
-- VOLGORDE: dit bestand vóór de deploy van de functies en de publish van de app. De code leest
-- billing_exempt; zonder kolom faalt elke select die hem noemt.
--
-- Additief op `tenants`: één nieuwe kolom met default false. Niets hernoemd of verwijderd.
-- `tenants` gaat via storefront-api `select('*')` naar get_config, maar get_config bouwt een eigen
-- object (geen spread van de rij): de kolom komt niet bij de custom frontends. Niet gevoelig.
--
-- Betekenis na deze batch:
--   is_internal_tenant = SellQo zelf: Stripe via het platformaccount (getStripeContext).
--                        Alleen nog via SQL te zetten, nooit voor een winkel met een eigen
--                        Stripe Connect-account (dan lopen haar factuurbetalingen via SellQo).
--   billing_exempt     = geen SellQo-facturatie en geen afdwinging, geen plan- en AI-limieten,
--                        niet in de platformstatistieken, "Mijn winkels" in de winkelkiezer.
--                        Via de schakelaar "Geen SellQo-facturatie" in het tenantformulier.
--
-- Terugdraaien: zie de snapshot onder (1); daarna
--   UPDATE public.tenants SET is_internal_tenant = true
--   WHERE id IN ('1671a91c-31fe-42ed-8a10-41f3117ceb50','54f6b480-280b-42e1-b843-d5beb2831acd','95f6685b-3474-42fe-81ad-a5e6ca3d6806');
--   (de kolom zelf laten staan — een kolom droppen is onomkeerbaar, sellqo-db-safety)

-- (1) SNAPSHOT — bewaar de uitvoer.
SELECT id, name, slug, is_internal_tenant, stripe_account_id IS NOT NULL AS heeft_connect
FROM public.tenants
WHERE is_internal_tenant OR slug = 'sellqo'
ORDER BY name;

-- (2) KOLOM
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;

-- (3) DATA — vaste ID-lijst (live geverifieerd 01-10).
--   Loveke           1671a91c-31fe-42ed-8a10-41f3117ceb50  (eigen Connect-account)
--   VanXcel          54f6b480-280b-42e1-b843-d5beb2831acd  (eigen Connect-account)
--   The Fonske Crawl 95f6685b-3474-42fe-81ad-a5e6ca3d6806  (eigen Connect-account)
--   Studio Akke      c96fb1b2-ddac-44d1-a638-72dd54efd31e  (GEEN Connect-account: int via het
--                    platformaccount voor Studio Akke Mail → blijft is_internal_tenant = true,
--                    keuze Akke 01-10; anders faalt mail-billing-api)
UPDATE public.tenants SET billing_exempt = true
WHERE id IN ('1671a91c-31fe-42ed-8a10-41f3117ceb50',
             '54f6b480-280b-42e1-b843-d5beb2831acd',
             '95f6685b-3474-42fe-81ad-a5e6ca3d6806',
             'c96fb1b2-ddac-44d1-a638-72dd54efd31e')
RETURNING id, name, billing_exempt;

UPDATE public.tenants SET is_internal_tenant = false
WHERE id IN ('1671a91c-31fe-42ed-8a10-41f3117ceb50',
             '54f6b480-280b-42e1-b843-d5beb2831acd',
             '95f6685b-3474-42fe-81ad-a5e6ca3d6806')
RETURNING id, name, is_internal_tenant;

-- (4) CONTROLE — verwacht: SellQo intern/niet-vrijgesteld, Studio Akke intern + vrijgesteld,
-- Loveke/VanXcel/Fonske niet intern + vrijgesteld. Geen enkele interne tenant met eigen Connect-account.
SELECT name, slug, is_internal_tenant, billing_exempt, stripe_account_id IS NOT NULL AS heeft_connect
FROM public.tenants
WHERE is_internal_tenant OR billing_exempt
ORDER BY name;
SELECT count(*) AS interne_tenants_met_connect_moet_0_zijn
FROM public.tenants WHERE is_internal_tenant AND stripe_account_id IS NOT NULL;

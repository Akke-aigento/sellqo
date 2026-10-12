-- APP-CLEAN-1 (12-10-2026) — "recent gekocht" op echte orders.
--
-- RecentPurchaseToast verzon tot nu toe stad, product en tijdstip
-- ("Iemand uit Gent kocht X 12 min geleden") met Math.random(). Nep-sociale
-- bewijskracht naar consumenten is een verboden handelspraktijk (EU-richtlijn
-- oneerlijke handelspraktijken). Deze functie levert de echte basis.
--
-- Wat ze teruggeeft: alleen productnaam + tijdstip van betaalde webshoporders
-- van de laatste 7 dagen. Geen klant, geen stad, geen bedrag. Alleen als de
-- winkel "recente aankopen tonen" zelf aan heeft staan; anders leeg.
-- Marketplace-orders (bol, ...) tellen niet: die zijn niet in deze winkel gekocht.

CREATE OR REPLACE FUNCTION public.storefront_recent_purchases(p_tenant_id uuid)
RETURNS TABLE (product_name text, purchased_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT oi.product_name, o.created_at
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.tenant_id = p_tenant_id
     AND o.payment_status = 'paid'
     AND o.created_at > now() - interval '7 days'
     AND coalesce(o.marketplace_source::text, '') = ''
     AND oi.product_name IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM tenant_theme_settings s
        WHERE s.tenant_id = p_tenant_id
          AND s.show_recent_purchases = true
     )
   ORDER BY o.created_at DESC
   LIMIT 10;
$function$;

REVOKE ALL ON FUNCTION public.storefront_recent_purchases(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.storefront_recent_purchases(uuid) TO anon, authenticated;

-- CATALOG-FILTERS-1 (13-10-2026) — verkochte stuks per product voor sortering
-- "bestverkocht" in de webshop-API (storefront-api, sort_by=best_selling).
-- Alleen lezen; alleen de service role (de edge function) mag het aanroepen.
-- Telt alle betaalde orders van de winkel, ook marketplace-orders: dat zijn echte
-- verkopen van het product. Er wordt niets naar bol of andere kanalen geschreven.
CREATE OR REPLACE FUNCTION public.storefront_product_sales(p_tenant_id uuid, p_days integer DEFAULT 365)
RETURNS TABLE(product_id uuid, qty bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT oi.product_id, sum(oi.quantity)::bigint AS qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE o.tenant_id = p_tenant_id
     AND o.payment_status::text = 'paid'
     AND o.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 365), 3650)))
     AND oi.product_id IS NOT NULL
   GROUP BY oi.product_id
$function$;

REVOKE ALL ON FUNCTION public.storefront_product_sales(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_product_sales(uuid, integer) TO service_role;

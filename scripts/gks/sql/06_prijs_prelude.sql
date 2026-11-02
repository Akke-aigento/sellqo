-- PRIJS-GATEN-1 — wat de migratie 20261102090000 live aantreft en de preludes niet kennen
-- (nagetrokken 2-11-2026 via information_schema / pg_proc). bulk_adjust_prices verbatim de live definitie
-- (prosrc-md5 9244c5fe…), zodat de drift-controle van de migratie hier hetzelfde ziet als live.
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.product_variants add column if not exists compare_at_price numeric;
alter table public.product_variants add column if not exists cost_price numeric;
alter table public.product_variants add column if not exists stock integer default 0;
alter table public.product_variants add column if not exists sku text;
alter table public.product_variants add column if not exists updated_at timestamptz default now();
grant select, update on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
CREATE OR REPLACE FUNCTION public.bulk_adjust_prices(p_product_ids uuid[], p_adjustment_type text, p_adjustment_value numeric, p_price_field text DEFAULT 'price'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND p.tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Producten buiten eigen tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_price_field = 'price' THEN
    IF p_adjustment_type = 'add' THEN
      UPDATE products SET price = price + p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'subtract' THEN
      UPDATE products SET price = GREATEST(0, price - p_adjustment_value), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_up' THEN
      UPDATE products SET price = ROUND((price * (1 + p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_down' THEN
      UPDATE products SET price = ROUND((price * (1 - p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'compare_at_price' THEN
    IF p_adjustment_type = 'remove' THEN
      UPDATE products SET compare_at_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'set_current' THEN
      UPDATE products SET compare_at_price = price, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET compare_at_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'cost_price' THEN
    IF p_adjustment_type = 'exact' THEN
      UPDATE products SET cost_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'remove' THEN
      UPDATE products SET cost_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  END IF;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
revoke execute on function public.bulk_adjust_prices(uuid[], text, numeric, text) from public, anon;
grant execute on function public.bulk_adjust_prices(uuid[], text, numeric, text) to authenticated, service_role;

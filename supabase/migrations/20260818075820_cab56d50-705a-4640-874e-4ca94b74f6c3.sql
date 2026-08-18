-- PROD-TRIGGER-1: marketing mag producten bewerken, kolomguard voor commerciële velden
DROP POLICY IF EXISTS "Users can update their tenant's products" ON public.products;
CREATE POLICY "Users can update their tenant's products"
ON public.products
FOR UPDATE
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'warehouse'::app_role, 'marketing'::app_role])
);

CREATE OR REPLACE FUNCTION public.guard_product_commercial_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_beperkt boolean;
BEGIN
  -- Server-to-server (edge functions, cron, imports) heeft geen auth.uid():
  -- die paden blijven ongemoeid, net als in de SEC-0b-conventie.
  IF auth.uid() IS NULL OR public.is_platform_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Ruim-naar-smal: wie tenant_admin of staff is, mag alles.
  IF public.has_tenant_role(NEW.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]) THEN
    RETURN NEW;
  END IF;

  v_beperkt := public.has_tenant_role(NEW.tenant_id, ARRAY['marketing'::app_role, 'warehouse'::app_role]);
  IF NOT v_beperkt THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.compare_at_price IS DISTINCT FROM OLD.compare_at_price
     OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
     OR NEW.vat_rate_id IS DISTINCT FROM OLD.vat_rate_id THEN
    RAISE EXCEPTION 'Prijsvelden mogen niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.sku IS DISTINCT FROM OLD.sku
     OR NEW.barcode IS DISTINCT FROM OLD.barcode THEN
    RAISE EXCEPTION 'Artikelnummer en barcode mogen niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.stock IS DISTINCT FROM OLD.stock
      OR NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold)
     AND NOT public.has_tenant_role(NEW.tenant_id, ARRAY['warehouse'::app_role]) THEN
    RAISE EXCEPTION 'Voorraad mag niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_commercial_fields ON public.products;
CREATE TRIGGER trg_guard_product_commercial_fields
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_commercial_fields();
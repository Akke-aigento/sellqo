-- TASK 1: stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('sale','return','purchase','sync','manual','opening','adjustment')),
  reference_type text NULL,
  reference_id uuid NULL,
  note text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product ON public.stock_movements (tenant_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_variant ON public.stock_movements (tenant_id, variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created ON public.stock_movements (tenant_id, created_at DESC);

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view their stock movements" ON public.stock_movements;
CREATE POLICY "Tenant members can view their stock movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- TASK 2: core ledger function
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_tenant_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_delta integer,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := p_tenant_id;
  v_product_id uuid := p_product_id;
  v_balance integer;
  v_require_tracking boolean := p_reason NOT IN ('manual','adjustment','opening');
BEGIN
  IF p_delta IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_product_id IS NULL AND p_variant_id IS NOT NULL THEN
    SELECT product_id, tenant_id INTO v_product_id, v_tenant_id
    FROM public.product_variants WHERE id = p_variant_id;
  END IF;

  IF v_tenant_id IS NULL AND v_product_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
  END IF;

  IF v_product_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin(auth.uid())
     AND v_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied for tenant %', v_tenant_id;
  END IF;

  IF p_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, COALESCE(stock, 0) + p_delta)
    WHERE id = p_variant_id
      AND (NOT v_require_tracking OR track_inventory = true)
    RETURNING stock INTO v_balance;
  ELSE
    UPDATE public.products
    SET stock = GREATEST(0, COALESCE(stock, 0) + p_delta)
    WHERE id = v_product_id
      AND (NOT v_require_tracking OR track_inventory = true)
    RETURNING stock INTO v_balance;
  END IF;

  IF v_balance IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.stock_movements (
    tenant_id, product_id, variant_id, delta, balance_after, reason,
    reference_type, reference_id, note, created_by
  ) VALUES (
    v_tenant_id, v_product_id, p_variant_id, p_delta, v_balance, p_reason,
    p_reference_type, p_reference_id, p_note, COALESCE(p_created_by, auth.uid())
  );

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.record_stock_movement(uuid,uuid,uuid,integer,text,text,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_stock_movement(uuid,uuid,uuid,integer,text,text,uuid,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid,uuid,uuid,integer,text,text,uuid,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, p_product_id, NULL, -ABS(COALESCE(p_quantity, 0)), 'sale', NULL, NULL, NULL, NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, NULL, p_variant_id, -ABS(COALESCE(p_quantity, 0)), 'sale', NULL, NULL, NULL, NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_stock(
  p_product_id uuid,
  p_quantity integer,
  p_reason text DEFAULT 'return',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, p_product_id, NULL, ABS(COALESCE(p_quantity, 0)), p_reason, p_reference_type, p_reference_id, p_note, NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_variant_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_reason text DEFAULT 'return',
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, NULL, p_variant_id, ABS(COALESCE(p_quantity, 0)), p_reason, p_reference_type, p_reference_id, p_note, NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_stock(uuid,integer,text,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_stock(uuid,integer,text,text,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_stock(uuid,integer,text,text,uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_variant_stock(uuid,integer,text,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_variant_stock(uuid,integer,text,text,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_variant_stock(uuid,integer,text,text,uuid,text) TO authenticated, service_role;

-- TASK 3: idempotent opening balances
INSERT INTO public.stock_movements (tenant_id, product_id, variant_id, delta, balance_after, reason, note)
SELECT p.tenant_id, p.id, NULL, COALESCE(p.stock, 0), COALESCE(p.stock, 0), 'opening',
       'Openingssaldo bij invoering voorraadgrootboek'
FROM public.products p
WHERE p.track_inventory = true
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.product_id = p.id AND sm.variant_id IS NULL AND sm.reason = 'opening'
  );

INSERT INTO public.stock_movements (tenant_id, product_id, variant_id, delta, balance_after, reason, note)
SELECT v.tenant_id, v.product_id, v.id, COALESCE(v.stock, 0), COALESCE(v.stock, 0), 'opening',
       'Openingssaldo bij invoering voorraadgrootboek'
FROM public.product_variants v
WHERE v.track_inventory = true
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.variant_id = v.id AND sm.reason = 'opening'
  );
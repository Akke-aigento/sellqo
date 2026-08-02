CREATE TABLE IF NOT EXISTS public.shipping_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_classes TO authenticated;
GRANT ALL ON public.shipping_classes TO service_role;

ALTER TABLE public.shipping_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_classes_tenant_read" ON public.shipping_classes;
CREATE POLICY "shipping_classes_tenant_read" ON public.shipping_classes
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "shipping_classes_tenant_write" ON public.shipping_classes;
CREATE POLICY "shipping_classes_tenant_write" ON public.shipping_classes
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    )
  );

DROP TRIGGER IF EXISTS update_shipping_classes_updated_at ON public.shipping_classes;
CREATE TRIGGER update_shipping_classes_updated_at
  BEFORE UPDATE ON public.shipping_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Foreign keys
ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS shipping_class_id uuid REFERENCES public.shipping_classes(id) ON DELETE SET NULL;

ALTER TABLE public.product_specifications
  ADD COLUMN IF NOT EXISTS shipping_class_id uuid REFERENCES public.shipping_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_class ON public.shipping_methods (tenant_id, shipping_class_id);
CREATE INDEX IF NOT EXISTS idx_product_specs_class ON public.product_specifications (shipping_class_id) WHERE shipping_class_id IS NOT NULL;

-- Migrate existing free-text classes
INSERT INTO public.shipping_classes (tenant_id, name)
SELECT DISTINCT tenant_id, shipping_class FROM public.shipping_methods WHERE shipping_class IS NOT NULL AND btrim(shipping_class) <> ''
UNION
SELECT DISTINCT tenant_id, shipping_class FROM public.product_specifications WHERE shipping_class IS NOT NULL AND btrim(shipping_class) <> ''
ON CONFLICT (tenant_id, name) DO NOTHING;

UPDATE public.shipping_methods sm SET shipping_class_id = sc.id
FROM public.shipping_classes sc
WHERE sc.tenant_id = sm.tenant_id AND sc.name = sm.shipping_class AND sm.shipping_class_id IS NULL;

UPDATE public.product_specifications ps SET shipping_class_id = sc.id
FROM public.shipping_classes sc
WHERE sc.tenant_id = ps.tenant_id AND sc.name = ps.shipping_class AND ps.shipping_class_id IS NULL;

COMMENT ON COLUMN public.shipping_methods.shipping_class IS 'DEPRECATED — vervangen door shipping_class_id (SHIP-CLASS-2). Niet meer gebruiken.';
COMMENT ON COLUMN public.product_specifications.shipping_class IS 'DEPRECATED — vervangen door shipping_class_id (SHIP-CLASS-2). Niet meer gebruiken.';

-- Tenant conflict rule
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS shipping_conflict_rule text NOT NULL DEFAULT 'highest_price';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_shipping_conflict_rule_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_shipping_conflict_rule_check
      CHECK (shipping_conflict_rule IN ('highest_price', 'sum'));
  END IF;
END $$;
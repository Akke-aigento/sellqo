CREATE TABLE IF NOT EXISTS public.printful_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  printful_order_id bigint,
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  last_error text,
  forwarded_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT printful_order_links_tenant_order_unique UNIQUE (tenant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_printful_order_links_tenant_pf_order
  ON public.printful_order_links (tenant_id, printful_order_id);

GRANT SELECT ON public.printful_order_links TO authenticated;
GRANT ALL ON public.printful_order_links TO service_role;

ALTER TABLE public.printful_order_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pol_select_tenant_members"
ON public.printful_order_links
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

DROP TRIGGER IF EXISTS set_printful_order_links_updated_at ON public.printful_order_links;
CREATE TRIGGER set_printful_order_links_updated_at
BEFORE UPDATE ON public.printful_order_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
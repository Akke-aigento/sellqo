-- Create product_bundle_items table
-- Links a bundle product (product_type = 'bundle') to its component products
CREATE TABLE public.product_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bundle_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bundle_product_id, child_product_id)
);

-- Indexes
CREATE INDEX idx_product_bundle_items_bundle ON public.product_bundle_items(bundle_product_id);
CREATE INDEX idx_product_bundle_items_tenant ON public.product_bundle_items(tenant_id);

-- RLS
ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bundle items for their tenant"
ON public.product_bundle_items FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage bundle items for their tenant"
ON public.product_bundle_items FOR ALL
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access to product_bundle_items"
ON public.product_bundle_items FOR ALL
USING (auth.role() = 'service_role');

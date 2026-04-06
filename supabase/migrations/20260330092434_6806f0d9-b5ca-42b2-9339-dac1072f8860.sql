CREATE TABLE public.product_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  customer_can_adjust boolean NOT NULL DEFAULT false,
  min_quantity integer DEFAULT NULL,
  max_quantity integer DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_bundle_items_product ON public.product_bundle_items(product_id);
CREATE INDEX idx_product_bundle_items_child ON public.product_bundle_items(child_product_id);

ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product bundle items" ON public.product_bundle_items
  FOR SELECT USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can insert product bundle items" ON public.product_bundle_items
  FOR INSERT WITH CHECK (
    product_id IN (
      SELECT id FROM public.products 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can update product bundle items" ON public.product_bundle_items
  FOR UPDATE USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete product bundle items" ON public.product_bundle_items
  FOR DELETE USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Anon can view product bundle items" ON public.product_bundle_items
  FOR SELECT TO anon USING (true);

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, category_id)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage product categories"
  ON public.product_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.user_roles ur ON ur.tenant_id = p.tenant_id
      WHERE p.id = product_categories.product_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Public read for active products"
  ON public.product_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
      AND p.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.promote_primary_category()
RETURNS TRIGGER AS $$
DECLARE v_next_id UUID;
BEGIN
  IF OLD.is_primary THEN
    SELECT id INTO v_next_id FROM public.product_categories
    WHERE product_id = OLD.product_id AND id != OLD.id
    ORDER BY sort_order LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE public.product_categories SET is_primary = true WHERE id = v_next_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER promote_primary_on_delete
  AFTER DELETE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION promote_primary_category();

INSERT INTO public.product_categories (product_id, category_id, is_primary, sort_order)
SELECT id, category_id, true, 0
FROM public.products
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

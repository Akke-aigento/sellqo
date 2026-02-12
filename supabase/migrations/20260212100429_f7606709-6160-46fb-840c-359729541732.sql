
-- Fase 3: Product Variants

-- 1. product_variant_options
CREATE TABLE public.product_variant_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "values" TEXT[] NOT NULL DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on product_variant_options" ON public.product_variant_options FOR ALL USING (true) WITH CHECK (true);

-- 2. product_variants
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price DECIMAL(10,2),
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  stock INT NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  attribute_values JSONB NOT NULL DEFAULT '{}',
  weight DECIMAL(10,3),
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_tenant ON public.product_variants(tenant_id);
CREATE INDEX idx_product_variants_sku ON public.product_variants(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_product_variant_options_product ON public.product_variant_options(product_id);

-- 3. Add variant_id to storefront_cart_items
ALTER TABLE public.storefront_cart_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- 4. Add variant_id to order_items (variant_title already exists)
ALTER TABLE public.order_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- 5. decrement_variant_stock function
CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.product_variants SET stock = GREATEST(0, stock - p_quantity) WHERE id = p_variant_id AND track_inventory = true;
END;
$$;

-- 6. Unique constraint for cart items per product+variant
CREATE UNIQUE INDEX idx_cart_items_product_variant ON public.storefront_cart_items(cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

-- Triggers
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_variant_options_updated_at BEFORE UPDATE ON public.product_variant_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

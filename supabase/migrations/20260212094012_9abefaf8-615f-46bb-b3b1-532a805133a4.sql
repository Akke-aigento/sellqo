
-- ============================================
-- FASE 2: storefront_favorites + password reset
-- ============================================

-- 1. Storefront Favorites table
CREATE TABLE public.storefront_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.storefront_customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id, product_id)
);

-- Index for fast lookups
CREATE INDEX idx_storefront_favorites_customer ON public.storefront_favorites(customer_id, tenant_id);
CREATE INDEX idx_storefront_favorites_product ON public.storefront_favorites(product_id, tenant_id);

-- Enable RLS
ALTER TABLE public.storefront_favorites ENABLE ROW LEVEL SECURITY;

-- RLS: service role only (accessed via edge functions)
CREATE POLICY "Service role full access on storefront_favorites"
  ON public.storefront_favorites
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Password reset columns on storefront_customers
ALTER TABLE public.storefront_customers
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- Create discount_codes table
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  minimum_order_amount DECIMAL(10,2),
  maximum_discount_amount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_limit_per_customer INTEGER,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
  product_ids UUID[],
  category_ids UUID[],
  first_order_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Create discount_code_usage table
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add discount fields to orders table (discount_amount already exists)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discount_code TEXT;

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for discount_codes
CREATE POLICY "Tenant users can view their discount codes"
ON public.discount_codes FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can create discount codes"
ON public.discount_codes FOR INSERT
WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can update their discount codes"
ON public.discount_codes FOR UPDATE
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can delete their discount codes"
ON public.discount_codes FOR DELETE
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS policies for discount_code_usage
CREATE POLICY "Tenant users can view usage of their discount codes"
ON public.discount_code_usage FOR SELECT
USING (discount_code_id IN (
  SELECT id FROM public.discount_codes 
  WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Tenant users can create usage records"
ON public.discount_code_usage FOR INSERT
WITH CHECK (discount_code_id IN (
  SELECT id FROM public.discount_codes 
  WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
));

-- Create updated_at trigger
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes
CREATE INDEX idx_discount_codes_tenant_id ON public.discount_codes(tenant_id);
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_is_active ON public.discount_codes(is_active);
CREATE INDEX idx_discount_code_usage_code_id ON public.discount_code_usage(discount_code_id);
CREATE INDEX idx_discount_code_usage_customer ON public.discount_code_usage(customer_email);
CREATE INDEX idx_orders_discount_code_id ON public.orders(discount_code_id);
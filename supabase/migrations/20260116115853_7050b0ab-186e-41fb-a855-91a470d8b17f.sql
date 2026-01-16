-- Create vat_validations table for logging VIES validations
CREATE TABLE public.vat_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vat_number VARCHAR(20) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  company_name VARCHAR(255),
  company_address TEXT,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  vies_request_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_vat_validations_customer ON public.vat_validations(customer_id);
CREATE INDEX idx_vat_validations_vat_number ON public.vat_validations(vat_number);
CREATE INDEX idx_vat_validations_tenant ON public.vat_validations(tenant_id);

-- Enable RLS
ALTER TABLE public.vat_validations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Platform admins can view all vat validations"
ON public.vat_validations FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert vat validations"
ON public.vat_validations FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's vat validations"
ON public.vat_validations FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert vat validations for their tenant"
ON public.vat_validations FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) 
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

-- Add VIES settings to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS require_vies_validation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS block_invalid_vat_orders BOOLEAN DEFAULT false;

-- Create vat_rates table for managing multiple VAT rates per country
CREATE TABLE public.vat_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('standard', 'reduced', 'super_reduced', 'zero', 'exempt')),
  name_nl VARCHAR(50),
  name_en VARCHAR(50),
  name_fr VARCHAR(50),
  name_de VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, country_code, rate, category)
);

-- Enable RLS
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vat_rates
CREATE POLICY "Platform admins can view all vat rates"
  ON public.vat_rates FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any vat rate"
  ON public.vat_rates FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any vat rate"
  ON public.vat_rates FOR UPDATE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any vat rate"
  ON public.vat_rates FOR DELETE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's vat rates or global rates"
  ON public.vat_rates FOR SELECT
  USING (
    tenant_id IS NULL OR 
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "Tenant admins can insert vat rates for their tenant"
  ON public.vat_rates FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND
    (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Tenant admins can update their tenant's vat rates"
  ON public.vat_rates FOR UPDATE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND
    has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Tenant admins can delete their tenant's vat rates"
  ON public.vat_rates FOR DELETE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND
    has_role(auth.uid(), 'tenant_admin')
  );

-- Add vat_rate_id to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vat_rate_id UUID REFERENCES public.vat_rates(id);

-- Add vat_rate_id to shipping_methods table
ALTER TABLE public.shipping_methods ADD COLUMN IF NOT EXISTS vat_rate_id UUID REFERENCES public.vat_rates(id);

-- Add multilingual name columns to shipping_methods
ALTER TABLE public.shipping_methods ADD COLUMN IF NOT EXISTS name_nl VARCHAR(100);
ALTER TABLE public.shipping_methods ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);
ALTER TABLE public.shipping_methods ADD COLUMN IF NOT EXISTS name_fr VARCHAR(100);
ALTER TABLE public.shipping_methods ADD COLUMN IF NOT EXISTS name_de VARCHAR(100);

-- Create invoice_lines table for detailed invoice breakdown
CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  line_type VARCHAR(20) DEFAULT 'product' CHECK (line_type IN ('product', 'shipping', 'discount')),
  product_id UUID REFERENCES public.products(id),
  shipping_method_id UUID REFERENCES public.shipping_methods(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  vat_category VARCHAR(20) DEFAULT 'standard',
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on invoice_lines
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_lines
CREATE POLICY "Platform admins can view all invoice lines"
  ON public.invoice_lines FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert any invoice line"
  ON public.invoice_lines FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update any invoice line"
  ON public.invoice_lines FOR UPDATE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete any invoice line"
  ON public.invoice_lines FOR DELETE
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's invoice lines"
  ON public.invoice_lines FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can insert invoice lines for their tenant"
  ON public.invoice_lines FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    ) AND
    (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can update their tenant's invoice lines"
  ON public.invoice_lines FOR UPDATE
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    ) AND
    (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can delete their tenant's invoice lines"
  ON public.invoice_lines FOR DELETE
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    ) AND
    has_role(auth.uid(), 'tenant_admin')
  );

-- Insert default VAT rates for Belgium (global, tenant_id = NULL)
INSERT INTO public.vat_rates (tenant_id, country_code, rate, category, name_nl, name_en, name_fr, name_de, is_default, sort_order) VALUES
(NULL, 'BE', 21.00, 'standard', 'Standaard', 'Standard', 'Standard', 'Standard', true, 1),
(NULL, 'BE', 12.00, 'reduced', 'Parking', 'Parking', 'Parking', 'Parking', false, 2),
(NULL, 'BE', 6.00, 'reduced', 'Verlaagd', 'Reduced', 'Réduit', 'Ermäßigt', false, 3),
(NULL, 'BE', 0.00, 'zero', 'Nultarief', 'Zero rate', 'Taux zéro', 'Nullsatz', false, 4),
(NULL, 'BE', 0.00, 'exempt', 'Vrijgesteld', 'Exempt', 'Exonéré', 'Befreit', false, 5);

-- Insert default VAT rates for Netherlands (global, tenant_id = NULL)
INSERT INTO public.vat_rates (tenant_id, country_code, rate, category, name_nl, name_en, name_fr, name_de, is_default, sort_order) VALUES
(NULL, 'NL', 21.00, 'standard', 'Standaard', 'Standard', 'Standard', 'Standard', true, 1),
(NULL, 'NL', 9.00, 'reduced', 'Verlaagd', 'Reduced', 'Réduit', 'Ermäßigt', false, 2),
(NULL, 'NL', 0.00, 'zero', 'Nultarief', 'Zero rate', 'Taux zéro', 'Nullsatz', false, 3);

-- Insert default VAT rates for Germany (global, tenant_id = NULL)
INSERT INTO public.vat_rates (tenant_id, country_code, rate, category, name_nl, name_en, name_fr, name_de, is_default, sort_order) VALUES
(NULL, 'DE', 19.00, 'standard', 'Standaard', 'Standard', 'Standard', 'Standard', true, 1),
(NULL, 'DE', 7.00, 'reduced', 'Verlaagd', 'Reduced', 'Réduit', 'Ermäßigt', false, 2),
(NULL, 'DE', 0.00, 'zero', 'Nultarief', 'Zero rate', 'Taux zéro', 'Nullsatz', false, 3);

-- Insert default VAT rates for France (global, tenant_id = NULL)
INSERT INTO public.vat_rates (tenant_id, country_code, rate, category, name_nl, name_en, name_fr, name_de, is_default, sort_order) VALUES
(NULL, 'FR', 20.00, 'standard', 'Standaard', 'Standard', 'Standard', 'Standard', true, 1),
(NULL, 'FR', 10.00, 'reduced', 'Verlaagd intermediair', 'Reduced intermediate', 'Réduit intermédiaire', 'Ermäßigt Zwischenstufe', false, 2),
(NULL, 'FR', 5.50, 'reduced', 'Verlaagd', 'Reduced', 'Réduit', 'Ermäßigt', false, 3),
(NULL, 'FR', 2.10, 'super_reduced', 'Super verlaagd', 'Super reduced', 'Super réduit', 'Stark ermäßigt', false, 4),
(NULL, 'FR', 0.00, 'zero', 'Nultarief', 'Zero rate', 'Taux zéro', 'Nullsatz', false, 5);

-- Update trigger for vat_rates
CREATE TRIGGER update_vat_rates_updated_at
  BEFORE UPDATE ON public.vat_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ODOO INTEGRATION: E-commerce + Accounting columns
-- =====================================================

-- Add Odoo e-commerce fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_product_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_variant_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_listing_status text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_listing_error text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_optimized_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_optimized_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS odoo_last_synced_at timestamptz;

-- Create Odoo accounting sync log table
CREATE TABLE IF NOT EXISTS public.odoo_invoice_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_connection_id uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  odoo_move_id text,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_direction text NOT NULL DEFAULT 'push',
  error_message text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create Odoo customer sync log table
CREATE TABLE IF NOT EXISTS public.odoo_customer_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_connection_id uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  odoo_partner_id text,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_direction text NOT NULL DEFAULT 'push',
  error_message text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create Odoo VAT mapping table
CREATE TABLE IF NOT EXISTS public.odoo_tax_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_connection_id uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  sellqo_vat_rate_id uuid REFERENCES public.vat_rates(id) ON DELETE CASCADE,
  sellqo_vat_percentage numeric(5,2),
  odoo_tax_id text NOT NULL,
  odoo_tax_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(marketplace_connection_id, sellqo_vat_rate_id)
);

-- Create Odoo journal mapping table
CREATE TABLE IF NOT EXISTS public.odoo_journal_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_connection_id uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  invoice_type text NOT NULL,
  odoo_journal_id text NOT NULL,
  odoo_journal_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(marketplace_connection_id, invoice_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_odoo_invoice_sync_tenant ON public.odoo_invoice_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_odoo_invoice_sync_connection ON public.odoo_invoice_sync_log(marketplace_connection_id);
CREATE INDEX IF NOT EXISTS idx_odoo_invoice_sync_status ON public.odoo_invoice_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_odoo_customer_sync_tenant ON public.odoo_customer_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_odoo_customer_sync_connection ON public.odoo_customer_sync_log(marketplace_connection_id);
CREATE INDEX IF NOT EXISTS idx_odoo_tax_mappings_connection ON public.odoo_tax_mappings(marketplace_connection_id);
CREATE INDEX IF NOT EXISTS idx_products_odoo_product_id ON public.products(odoo_product_id);

-- Enable RLS on new tables
ALTER TABLE public.odoo_invoice_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_customer_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_tax_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_journal_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for odoo_invoice_sync_log
CREATE POLICY "Users can view their tenant's Odoo invoice sync logs"
  ON public.odoo_invoice_sync_log FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert Odoo invoice sync logs"
  ON public.odoo_invoice_sync_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's Odoo invoice sync logs"
  ON public.odoo_invoice_sync_log FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for odoo_customer_sync_log
CREATE POLICY "Users can view their tenant's Odoo customer sync logs"
  ON public.odoo_customer_sync_log FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert Odoo customer sync logs"
  ON public.odoo_customer_sync_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's Odoo customer sync logs"
  ON public.odoo_customer_sync_log FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for odoo_tax_mappings
CREATE POLICY "Users can view their tenant's Odoo tax mappings"
  ON public.odoo_tax_mappings FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert Odoo tax mappings"
  ON public.odoo_tax_mappings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's Odoo tax mappings"
  ON public.odoo_tax_mappings FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant's Odoo tax mappings"
  ON public.odoo_tax_mappings FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for odoo_journal_mappings
CREATE POLICY "Users can view their tenant's Odoo journal mappings"
  ON public.odoo_journal_mappings FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert Odoo journal mappings"
  ON public.odoo_journal_mappings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's Odoo journal mappings"
  ON public.odoo_journal_mappings FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant's Odoo journal mappings"
  ON public.odoo_journal_mappings FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
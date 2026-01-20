-- Create enums for product types and digital delivery methods
CREATE TYPE public.product_type AS ENUM (
  'physical',
  'digital',
  'service',
  'subscription',
  'bundle'
);

CREATE TYPE public.digital_delivery_type AS ENUM (
  'download',
  'license_key',
  'access_url',
  'email_attachment',
  'qr_code',
  'external_service'
);

-- Add new columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS digital_delivery_type public.digital_delivery_type,
ADD COLUMN IF NOT EXISTS download_limit INTEGER,
ADD COLUMN IF NOT EXISTS download_expiry_hours INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS license_generator TEXT CHECK (license_generator IN ('manual', 'auto')),
ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Create product_files table for digital product files
CREATE TABLE public.product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  version TEXT DEFAULT '1.0',
  is_preview BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create license_keys table for software licenses
CREATE TABLE public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'revoked')),
  assigned_to_order_item_id UUID,
  assigned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create digital_deliveries table for tracking deliveries
CREATE TABLE public.digital_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_file_id UUID REFERENCES public.product_files(id),
  license_key_id UUID REFERENCES public.license_keys(id),
  download_token TEXT UNIQUE,
  download_url TEXT,
  access_url TEXT,
  download_count INTEGER DEFAULT 0,
  download_limit INTEGER,
  expires_at TIMESTAMPTZ,
  first_accessed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
  delivery_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_product_files_product ON public.product_files(product_id);
CREATE INDEX idx_product_files_tenant ON public.product_files(tenant_id);
CREATE INDEX idx_license_keys_product ON public.license_keys(product_id);
CREATE INDEX idx_license_keys_status ON public.license_keys(status);
CREATE INDEX idx_license_keys_tenant ON public.license_keys(tenant_id);
CREATE INDEX idx_digital_deliveries_order_item ON public.digital_deliveries(order_item_id);
CREATE INDEX idx_digital_deliveries_token ON public.digital_deliveries(download_token);
CREATE INDEX idx_digital_deliveries_tenant ON public.digital_deliveries(tenant_id);
CREATE INDEX idx_products_type ON public.products(product_type);

-- Enable RLS on new tables
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_files
CREATE POLICY "Users can view product files for their tenant"
ON public.product_files FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert product files for their tenant"
ON public.product_files FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update product files for their tenant"
ON public.product_files FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete product files for their tenant"
ON public.product_files FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for license_keys
CREATE POLICY "Users can view license keys for their tenant"
ON public.license_keys FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert license keys for their tenant"
ON public.license_keys FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update license keys for their tenant"
ON public.license_keys FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete license keys for their tenant"
ON public.license_keys FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for digital_deliveries
CREATE POLICY "Users can view digital deliveries for their tenant"
ON public.digital_deliveries FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert digital deliveries for their tenant"
ON public.digital_deliveries FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update digital deliveries for their tenant"
ON public.digital_deliveries FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete digital deliveries for their tenant"
ON public.digital_deliveries FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Create storage bucket for digital products (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-products', 'digital-products', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for digital-products bucket
CREATE POLICY "Tenant users can upload digital products"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'digital-products' 
  AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant users can view their digital products"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'digital-products' 
  AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant users can delete their digital products"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'digital-products' 
  AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Trigger for updated_at on product_files
CREATE TRIGGER update_product_files_updated_at
BEFORE UPDATE ON public.product_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
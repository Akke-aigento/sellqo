
-- Import jobs tracking
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_platform VARCHAR(50) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  total_rows INTEGER,
  success_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  categories_created INTEGER DEFAULT 0,
  categories_matched INTEGER DEFAULT 0,
  mapping JSONB,
  options JSONB,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON import_jobs(tenant_id, created_at DESC);

-- Import category mappings
CREATE TABLE IF NOT EXISTS import_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  original_value VARCHAR(500) NOT NULL,
  source_field VARCHAR(100),
  suggested_name VARCHAR(255) NOT NULL,
  suggested_slug VARCHAR(255),
  parent_category_id UUID REFERENCES categories(id),
  parent_mapping_id UUID,
  matched_existing_id UUID REFERENCES categories(id),
  confidence DECIMAL(3,2),
  is_approved BOOLEAN DEFAULT TRUE,
  user_modified_name VARCHAR(255),
  user_assigned_parent UUID REFERENCES categories(id),
  product_count INTEGER DEFAULT 0,
  created_category_id UUID REFERENCES categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_cat_job ON import_category_mappings(import_job_id);

-- Add external_id and import tracking to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_customers_external ON customers(tenant_id, external_id);

-- Add external_id and import tracking to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_category_value VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_products_external ON products(tenant_id, external_id);

-- Saved mappings for reuse
CREATE TABLE IF NOT EXISTS import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  source_platform VARCHAR(50) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  mapping JSONB NOT NULL,
  category_mappings JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS on all new tables
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_jobs
CREATE POLICY "Users can view their tenant import jobs"
  ON import_jobs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create import jobs for their tenant"
  ON import_jobs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant import jobs"
  ON import_jobs FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant import jobs"
  ON import_jobs FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS policies for import_category_mappings
CREATE POLICY "Users can view their import category mappings"
  ON import_category_mappings FOR SELECT
  USING (import_job_id IN (
    SELECT id FROM import_jobs WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can create import category mappings"
  ON import_category_mappings FOR INSERT
  WITH CHECK (import_job_id IN (
    SELECT id FROM import_jobs WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can update import category mappings"
  ON import_category_mappings FOR UPDATE
  USING (import_job_id IN (
    SELECT id FROM import_jobs WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete import category mappings"
  ON import_category_mappings FOR DELETE
  USING (import_job_id IN (
    SELECT id FROM import_jobs WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

-- RLS policies for import_mappings
CREATE POLICY "Users can view their tenant import mappings"
  ON import_mappings FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create import mappings for their tenant"
  ON import_mappings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant import mappings"
  ON import_mappings FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant import mappings"
  ON import_mappings FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

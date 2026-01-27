-- Add-on migratie tracking
ALTER TABLE tenant_addons 
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS migrated_to_plan TEXT;

-- Sync conflict queue
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES marketplace_connections(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  sellqo_data JSONB NOT NULL DEFAULT '{}',
  platform_data JSONB NOT NULL DEFAULT '{}',
  conflict_fields TEXT[] DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution TEXT CHECK (resolution IN ('sellqo', 'platform', 'merged', 'dismissed')),
  resolution_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on sync_conflicts
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_conflicts (using user_roles table)
CREATE POLICY "Users can view their tenant sync conflicts"
  ON sync_conflicts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their tenant sync conflicts"
  ON sync_conflicts FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  ));

-- Sync activity log
CREATE TABLE IF NOT EXISTS sync_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES marketplace_connections(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export', 'bidirectional')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on sync_activity_log
ALTER TABLE sync_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_activity_log
CREATE POLICY "Users can view their tenant sync activity"
  ON sync_activity_log FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert sync activity for their tenant"
  ON sync_activity_log FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  ));

-- Marketplace listing protection fields on products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS marketplace_lock_bol_com BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_lock_amazon BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_lock_ebay BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_lock_shopify BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_lock_woocommerce BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS marketplace_lock_reason TEXT,
ADD COLUMN IF NOT EXISTS marketplace_last_sync_hash TEXT;

-- Index for faster conflict lookups
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tenant_unresolved 
  ON sync_conflicts(tenant_id, connection_id) 
  WHERE resolved_at IS NULL;

-- Index for sync activity lookups
CREATE INDEX IF NOT EXISTS idx_sync_activity_tenant_connection 
  ON sync_activity_log(tenant_id, connection_id, started_at DESC);

-- Function to log sync activity start
CREATE OR REPLACE FUNCTION public.start_sync_activity(
  p_tenant_id UUID,
  p_connection_id UUID,
  p_data_type TEXT,
  p_direction TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO sync_activity_log (tenant_id, connection_id, data_type, direction, status, started_at)
  VALUES (p_tenant_id, p_connection_id, p_data_type, p_direction, 'running', now())
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- Function to complete sync activity
CREATE OR REPLACE FUNCTION public.complete_sync_activity(
  p_activity_id UUID,
  p_status TEXT,
  p_records_processed INT DEFAULT 0,
  p_records_created INT DEFAULT 0,
  p_records_updated INT DEFAULT 0,
  p_records_failed INT DEFAULT 0,
  p_error_details JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sync_activity_log
  SET 
    status = p_status,
    records_processed = p_records_processed,
    records_created = p_records_created,
    records_updated = p_records_updated,
    records_failed = p_records_failed,
    error_details = p_error_details,
    completed_at = now()
  WHERE id = p_activity_id;
END;
$$;

-- Function to create sync conflict
CREATE OR REPLACE FUNCTION public.create_sync_conflict(
  p_tenant_id UUID,
  p_connection_id UUID,
  p_data_type TEXT,
  p_record_id TEXT,
  p_sellqo_data JSONB,
  p_platform_data JSONB,
  p_conflict_fields TEXT[] DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_id UUID;
BEGIN
  -- Check if unresolved conflict already exists
  SELECT id INTO v_conflict_id
  FROM sync_conflicts
  WHERE connection_id = p_connection_id
    AND record_id = p_record_id
    AND resolved_at IS NULL;
  
  IF v_conflict_id IS NOT NULL THEN
    -- Update existing conflict
    UPDATE sync_conflicts
    SET 
      sellqo_data = p_sellqo_data,
      platform_data = p_platform_data,
      conflict_fields = p_conflict_fields,
      detected_at = now()
    WHERE id = v_conflict_id;
  ELSE
    -- Create new conflict
    INSERT INTO sync_conflicts (tenant_id, connection_id, data_type, record_id, sellqo_data, platform_data, conflict_fields)
    VALUES (p_tenant_id, p_connection_id, p_data_type, p_record_id, p_sellqo_data, p_platform_data, p_conflict_fields)
    RETURNING id INTO v_conflict_id;
  END IF;
  
  RETURN v_conflict_id;
END;
$$;

-- Function to resolve sync conflict
CREATE OR REPLACE FUNCTION public.resolve_sync_conflict(
  p_conflict_id UUID,
  p_resolution TEXT,
  p_resolution_data JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sync_conflicts
  SET 
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution = p_resolution,
    resolution_data = p_resolution_data
  WHERE id = p_conflict_id;
END;
$$;
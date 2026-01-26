-- Uitbreiding social_channel_connections voor echte shop integraties
ALTER TABLE social_channel_connections
ADD COLUMN IF NOT EXISTS catalog_id TEXT,
ADD COLUMN IF NOT EXISTS business_id TEXT,
ADD COLUMN IF NOT EXISTS page_id TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS products_in_catalog INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_errors JSONB DEFAULT '[]';

-- Index voor snelle sync status lookups
CREATE INDEX IF NOT EXISTS idx_social_channel_sync_status 
ON social_channel_connections(tenant_id, channel_type, sync_status);

-- Index voor catalog lookups
CREATE INDEX IF NOT EXISTS idx_social_channel_catalog
ON social_channel_connections(catalog_id) WHERE catalog_id IS NOT NULL;
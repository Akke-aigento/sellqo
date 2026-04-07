
-- Drop the existing unique constraint that doesn't handle NULL entity_id
ALTER TABLE seo_scores DROP CONSTRAINT IF EXISTS uq_seo_scores_tenant_entity;

-- Create partial unique index for tenant-level scores (entity_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_scores_tenant_no_entity 
ON seo_scores (tenant_id, entity_type) 
WHERE entity_id IS NULL;

-- Create partial unique index for entity-level scores (entity_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_scores_tenant_entity_id 
ON seo_scores (tenant_id, entity_type, entity_id) 
WHERE entity_id IS NOT NULL;

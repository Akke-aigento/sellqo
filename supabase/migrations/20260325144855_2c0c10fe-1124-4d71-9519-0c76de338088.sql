
-- Backfill NULL entity_ids to tenant_id
UPDATE public.seo_scores 
SET entity_id = tenant_id 
WHERE entity_id IS NULL;

-- Make entity_id NOT NULL
ALTER TABLE public.seo_scores 
ALTER COLUMN entity_id SET NOT NULL;

-- Drop the expression-based index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS public.idx_seo_scores_tenant_entity_unique;

-- Add a real unique constraint on the three columns
ALTER TABLE public.seo_scores 
ADD CONSTRAINT uq_seo_scores_tenant_entity UNIQUE (tenant_id, entity_type, entity_id);

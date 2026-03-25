
-- Create unique index using a text cast for the coalesce
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_scores_tenant_entity_unique 
ON public.seo_scores (tenant_id, entity_type, COALESCE(entity_id::text, '__tenant__'));

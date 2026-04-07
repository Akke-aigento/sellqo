-- 1. Make entity_id nullable
ALTER TABLE public.seo_scores ALTER COLUMN entity_id DROP NOT NULL;

-- 2. Deduplicate tenant-level rows (keep newest)
DELETE FROM public.seo_scores a
USING public.seo_scores b
WHERE a.entity_type = 'tenant'
  AND a.entity_id IS NULL
  AND b.entity_type = 'tenant'
  AND b.entity_id IS NULL
  AND a.tenant_id = b.tenant_id
  AND a.last_analyzed_at < b.last_analyzed_at;

-- 3. Recreate partial unique indexes (drop if exist from previous migration)
DROP INDEX IF EXISTS uq_seo_scores_tenant_no_entity;
DROP INDEX IF EXISTS uq_seo_scores_tenant_entity_id;

CREATE UNIQUE INDEX uq_seo_scores_tenant_no_entity 
ON public.seo_scores (tenant_id, entity_type) 
WHERE entity_id IS NULL;

CREATE UNIQUE INDEX uq_seo_scores_tenant_entity_id 
ON public.seo_scores (tenant_id, entity_type, entity_id) 
WHERE entity_id IS NOT NULL;

-- 4. Fix RLS policies on seo_scores
DROP POLICY IF EXISTS "Users can view their tenant's SEO scores" ON public.seo_scores;
DROP POLICY IF EXISTS "Users can update their tenant's SEO scores" ON public.seo_scores;
DROP POLICY IF EXISTS "Users can delete their tenant's SEO scores" ON public.seo_scores;
DROP POLICY IF EXISTS "Users can create SEO scores for their tenant" ON public.seo_scores;

CREATE POLICY "Users can view SEO scores"
ON public.seo_scores FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can manage SEO scores"
ON public.seo_scores FOR ALL TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- 5. Fix RLS policies on seo_analysis_history
DROP POLICY IF EXISTS "Users can view their tenant's SEO history" ON public.seo_analysis_history;
DROP POLICY IF EXISTS "Users can create SEO history for their tenant" ON public.seo_analysis_history;

CREATE POLICY "Users can view SEO history"
ON public.seo_analysis_history FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can create SEO history"
ON public.seo_analysis_history FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- 6. Fix RLS on seo_keywords too
DROP POLICY IF EXISTS "Users can view their tenant's SEO keywords" ON public.seo_keywords;
DROP POLICY IF EXISTS "Users can manage their tenant's SEO keywords" ON public.seo_keywords;

CREATE POLICY "Users can view SEO keywords"
ON public.seo_keywords FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can manage SEO keywords"
ON public.seo_keywords FOR ALL TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);
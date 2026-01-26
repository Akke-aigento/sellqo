-- Knowledge Index Cache Table (fixed - remove problematic unique constraint)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  source_type TEXT NOT NULL,
  source_id UUID,
  title TEXT NOT NULL,
  content_summary TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  keywords TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS if not already
ALTER TABLE public.ai_knowledge_index ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_knowledge_index
CREATE POLICY "Tenant isolation for ai_knowledge_index" ON public.ai_knowledge_index
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_index_tenant ON public.ai_knowledge_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_index_source ON public.ai_knowledge_index(tenant_id, source_type);

-- Unique index that handles NULL source_id properly
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_unique 
  ON public.ai_knowledge_index(tenant_id, source_type, source_id) 
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_unique_null 
  ON public.ai_knowledge_index(tenant_id, source_type) 
  WHERE source_id IS NULL;

-- Updated_at trigger for ai_knowledge_index
DROP TRIGGER IF EXISTS update_ai_knowledge_index_updated_at ON public.ai_knowledge_index;
CREATE TRIGGER update_ai_knowledge_index_updated_at
  BEFORE UPDATE ON public.ai_knowledge_index
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
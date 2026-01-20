-- Translation Hub: Centrale tabel voor alle vertalingen
-- Ondersteunt producten, categorieën, en uitbreidbaar voor andere entiteiten

-- Content translations tabel voor alle vertaalbare content
CREATE TABLE public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- 'product', 'category', 'email_template', 'page', etc.
  entity_id uuid NOT NULL,
  field_name text NOT NULL, -- 'name', 'description', 'meta_title', 'meta_description', etc.
  source_language text NOT NULL DEFAULT 'nl',
  target_language text NOT NULL,
  source_content text,
  translated_content text,
  is_auto_translated boolean DEFAULT true,
  is_locked boolean DEFAULT false, -- Locked = geen auto-update bij source wijziging
  auto_sync_enabled boolean DEFAULT true, -- Auto-sync wanneer source wijzigt
  translation_quality_score numeric(3,2), -- 0.00 - 1.00
  last_source_hash text, -- Hash van source voor change detection
  translated_at timestamptz,
  translated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity_type, entity_id, field_name, target_language)
);

-- Translation settings per tenant
CREATE TABLE public.translation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  source_language text NOT NULL DEFAULT 'nl',
  target_languages text[] NOT NULL DEFAULT ARRAY['en', 'de', 'fr'],
  auto_translate_products boolean DEFAULT true,
  auto_translate_categories boolean DEFAULT true,
  auto_translate_seo boolean DEFAULT true,
  auto_translate_marketing boolean DEFAULT true,
  excluded_fields text[] DEFAULT ARRAY[]::text[], -- Velden die nooit auto-vertaald worden
  ai_model_preference text DEFAULT 'google/gemini-3-flash-preview',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Translation jobs voor bulk operaties
CREATE TABLE public.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL, -- 'bulk_translate', 'sync_updates', 'export', 'import'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  entity_types text[] NOT NULL DEFAULT ARRAY['product', 'category'],
  target_languages text[] NOT NULL,
  total_items integer DEFAULT 0,
  processed_items integer DEFAULT 0,
  failed_items integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  error_log jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_roles table (existing pattern)
CREATE POLICY "Users can view translations for their tenant"
  ON public.content_translations FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage translations for their tenant"
  ON public.content_translations FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can view translation settings for their tenant"
  ON public.translation_settings FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage translation settings for their tenant"
  ON public.translation_settings FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can view translation jobs for their tenant"
  ON public.translation_jobs FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage translation jobs for their tenant"
  ON public.translation_jobs FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_content_translations_updated_at
  BEFORE UPDATE ON public.content_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_translation_settings_updated_at
  BEFORE UPDATE ON public.translation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index voor snelle lookups
CREATE INDEX idx_content_translations_entity ON public.content_translations(tenant_id, entity_type, entity_id);
CREATE INDEX idx_content_translations_language ON public.content_translations(tenant_id, target_language);
CREATE INDEX idx_content_translations_sync ON public.content_translations(tenant_id, auto_sync_enabled, is_locked) WHERE auto_sync_enabled = true AND is_locked = false;

-- Function om translation hash te genereren
CREATE OR REPLACE FUNCTION public.generate_content_hash(content text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(sha256(coalesce(content, '')::bytea), 'hex');
END;
$$;
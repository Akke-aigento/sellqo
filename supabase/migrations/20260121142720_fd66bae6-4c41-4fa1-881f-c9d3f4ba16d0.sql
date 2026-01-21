-- Add multilingual storefront settings to tenant_theme_settings
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS storefront_multilingual_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS storefront_languages jsonb DEFAULT '["nl"]'::jsonb,
ADD COLUMN IF NOT EXISTS storefront_default_language text DEFAULT 'nl',
ADD COLUMN IF NOT EXISTS storefront_language_selector_style text DEFAULT 'dropdown';

-- Create legal_pages table for juridical content
CREATE TABLE public.legal_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('privacy', 'terms', 'refund', 'shipping', 'contact', 'legal_notice', 'cookie')),
  
  -- Content per language
  title_nl TEXT,
  title_en TEXT,
  title_de TEXT,
  title_fr TEXT,
  content_nl TEXT,
  content_en TEXT,
  content_de TEXT,
  content_fr TEXT,
  
  -- Meta
  is_published BOOLEAN DEFAULT true,
  is_auto_generated BOOLEAN DEFAULT true,
  last_auto_generated_at TIMESTAMPTZ,
  
  -- SEO per language
  meta_title_nl TEXT,
  meta_title_en TEXT,
  meta_title_de TEXT,
  meta_title_fr TEXT,
  meta_description_nl TEXT,
  meta_description_en TEXT,
  meta_description_de TEXT,
  meta_description_fr TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, page_type)
);

-- Enable RLS
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for legal_pages (using user_roles like other tables)
CREATE POLICY "Tenants can view their own legal pages"
ON public.legal_pages FOR SELECT
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenants can insert their own legal pages"
ON public.legal_pages FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenants can update their own legal pages"
ON public.legal_pages FOR UPDATE
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenants can delete their own legal pages"
ON public.legal_pages FOR DELETE
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Create updated_at trigger
CREATE TRIGGER update_legal_pages_updated_at
BEFORE UPDATE ON public.legal_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX idx_legal_pages_tenant_id ON public.legal_pages(tenant_id);
CREATE INDEX idx_legal_pages_page_type ON public.legal_pages(page_type);
-- Add language column to seo_keywords table for multi-language SEO support
ALTER TABLE public.seo_keywords 
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'nl';

-- Add check constraint for supported languages
ALTER TABLE public.seo_keywords
ADD CONSTRAINT seo_keywords_language_check 
CHECK (language IN ('nl', 'en', 'de', 'fr'));

-- Create index for language filtering
CREATE INDEX IF NOT EXISTS idx_seo_keywords_language ON public.seo_keywords(language);

-- Create composite index for tenant + language queries
CREATE INDEX IF NOT EXISTS idx_seo_keywords_tenant_language ON public.seo_keywords(tenant_id, language);
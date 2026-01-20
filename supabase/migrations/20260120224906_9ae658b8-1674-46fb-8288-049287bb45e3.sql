-- Add multi-language SEO fields for categories
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS meta_title_nl text,
ADD COLUMN IF NOT EXISTS meta_title_en text,
ADD COLUMN IF NOT EXISTS meta_title_de text,
ADD COLUMN IF NOT EXISTS meta_title_fr text,
ADD COLUMN IF NOT EXISTS meta_description_nl text,
ADD COLUMN IF NOT EXISTS meta_description_en text,
ADD COLUMN IF NOT EXISTS meta_description_de text,
ADD COLUMN IF NOT EXISTS meta_description_fr text;

-- Add comments for documentation
COMMENT ON COLUMN public.categories.meta_title_nl IS 'SEO meta title in Dutch';
COMMENT ON COLUMN public.categories.meta_title_en IS 'SEO meta title in English';
COMMENT ON COLUMN public.categories.meta_title_de IS 'SEO meta title in German';
COMMENT ON COLUMN public.categories.meta_title_fr IS 'SEO meta title in French';
COMMENT ON COLUMN public.categories.meta_description_nl IS 'SEO meta description in Dutch';
COMMENT ON COLUMN public.categories.meta_description_en IS 'SEO meta description in English';
COMMENT ON COLUMN public.categories.meta_description_de IS 'SEO meta description in German';
COMMENT ON COLUMN public.categories.meta_description_fr IS 'SEO meta description in French';

-- Add category target fields for import
-- Update import types to include category fields
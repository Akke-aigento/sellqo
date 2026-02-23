-- Add intelligent theme palette columns to tenant_theme_settings
ALTER TABLE public.tenant_theme_settings
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
  ADD COLUMN IF NOT EXISTS theme_style TEXT DEFAULT 'modern' CHECK (theme_style IN ('modern', 'elegant', 'bold', 'playful'));

-- Backfill brand_color from primary_color for existing tenants
UPDATE public.tenant_theme_settings
SET brand_color = primary_color
WHERE brand_color IS NULL AND primary_color IS NOT NULL;

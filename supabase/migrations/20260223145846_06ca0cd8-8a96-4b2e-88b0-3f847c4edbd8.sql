-- Add intelligent theme palette columns to tenant_theme_settings
ALTER TABLE public.tenant_theme_settings
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS theme_style text DEFAULT 'modern';
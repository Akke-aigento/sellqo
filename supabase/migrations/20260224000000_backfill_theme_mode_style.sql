-- Backfill theme_mode for existing tenants based on background_color luminance.
-- Dark backgrounds (luminance < 0.179) → 'dark', otherwise 'light'.
-- Uses a rough luminance heuristic from hex: brighter average RGB channel → light.
-- Also ensures theme_style defaults to 'modern' for existing tenants.

-- Set theme_mode based on background_color brightness
UPDATE public.tenant_theme_settings
SET theme_mode = CASE
  -- Parse hex to R/G/B and check average brightness (< 128 = dark)
  WHEN background_color IS NOT NULL
    AND background_color LIKE '#%'
    AND length(background_color) = 7
    AND (
      (('x' || substring(background_color FROM 2 FOR 2))::bit(8)::int +
       ('x' || substring(background_color FROM 4 FOR 2))::bit(8)::int +
       ('x' || substring(background_color FROM 6 FOR 2))::bit(8)::int) / 3
    ) < 128
  THEN 'dark'
  ELSE 'light'
END
WHERE theme_mode IS NULL OR theme_mode = 'light';

-- Ensure theme_style is set for all existing tenants
UPDATE public.tenant_theme_settings
SET theme_style = 'modern'
WHERE theme_style IS NULL;

-- Ensure brand_color is set for all existing tenants (fallback to blue)
UPDATE public.tenant_theme_settings
SET brand_color = COALESCE(primary_color, '#3B82F6')
WHERE brand_color IS NULL;

-- Set heading/body fonts for tenants that don't have them
UPDATE public.tenant_theme_settings
SET heading_font = COALESCE(heading_font, 'Inter'),
    body_font = COALESCE(body_font, 'Inter')
WHERE heading_font IS NULL OR body_font IS NULL;

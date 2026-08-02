ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.product_variants.images IS
  'Extra foto''s voor deze variant, in volgorde. image_url blijft de hoofdfoto en hoeft hier niet in te staan.';
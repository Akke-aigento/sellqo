-- SOCIAL-4 — "Tekst in beeld aanpassen": het recept van elk beeld bij de post bewaren.
--
-- Strikt additief: social_posts.image_recipes jsonb, een array parallel aan image_urls.
-- Element i = recept van image_urls[i] ({"version":1,"width":1080,"height":1350,"html":"…"})
-- of null als dat beeld geen recept heeft. Het recept is een zelfstandig HTML-document met
-- de tekstvakken als data-slot; de Social planning tekent het in de browser opnieuw.
-- Geen nieuwe policies: lezen/schrijven via de bestaande RLS op social_posts; het nieuwe beeld
-- komt in de eigen tenantmap van marketing-assets (bestaande storage-policies).
-- Idempotent. Handmatig terugdraaien: ALTER TABLE public.social_posts DROP COLUMN image_recipes;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS image_recipes jsonb;

COMMENT ON COLUMN public.social_posts.image_recipes IS
  'SOCIAL-4: array parallel aan image_urls; per beeld een recept {version,width,height,html} met data-slot-tekstvakken, of null.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.social_posts'::regclass AND conname = 'social_posts_image_recipes_check') THEN
    ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_image_recipes_check
      CHECK (image_recipes IS NULL OR (jsonb_typeof(image_recipes) = 'array' AND length(image_recipes::text) < 200000));
  END IF;
END $$;

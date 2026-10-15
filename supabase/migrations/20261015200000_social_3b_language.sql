-- SOCIAL-3b — taal per social post, en "opnieuw maken in een andere taal".
--
-- Strikt additief op social_posts:
--   * language: taal van de tekst en het beeld (ISO 639-1, bv. 'nl', 'en'). NULL = niet opgegeven.
--   * regenerate_language: bij "Opnieuw maken" de gevraagde taal; NULL = dezelfde taal houden.
-- Idempotent (ADD COLUMN IF NOT EXISTS, constraints enkel als ze nog niet bestaan).
-- Handmatig terugdraaien:
--   ALTER TABLE public.social_posts DROP COLUMN language, DROP COLUMN regenerate_language;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS regenerate_language text;

COMMENT ON COLUMN public.social_posts.language IS
  'Taal van de post (ISO 639-1, bv. nl of en). NULL = niet opgegeven.';
COMMENT ON COLUMN public.social_posts.regenerate_language IS
  'Bij "Opnieuw maken": de gevraagde taal van de nieuwe versie. NULL = dezelfde taal.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.social_posts'::regclass AND conname = 'social_posts_language_check') THEN
    ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_language_check
      CHECK (language IS NULL OR language ~ '^[a-z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.social_posts'::regclass AND conname = 'social_posts_regenerate_language_check') THEN
    ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_regenerate_language_check
      CHECK (regenerate_language IS NULL OR regenerate_language ~ '^[a-z]{2}$');
  END IF;
END $$;

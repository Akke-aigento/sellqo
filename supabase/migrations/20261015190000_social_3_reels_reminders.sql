-- SOCIAL-3 — reels, muziekkeuze, herinneringen voor "zelf posten" en "opnieuw maken".
--
-- Strikt additief op social_posts:
--   * media_type: 'reel' bij de toegelaten waarden (de check wordt breder, nooit smaller).
--   * nieuwe kolommen voor reels (video met bibliotheekmuziek / stille versie, muziekvoorstel),
--     de reden van "zelf posten", de herinnering, "opnieuw maken" en het hervatten van een
--     reel-container die Instagram nog aan het verwerken is.
--   * nieuwe statuswaarde 'regenerate_requested' (status heeft geen check; de claim-functie
--     pakt enkel scheduled/approved, dus deze status wordt nooit gepubliceerd).
-- Cron social-publish-due-hourly: het WHERE EXISTS-filter krijgt er de herinneringen bij,
-- zodat de functie ook draait als er enkel iets te herinneren valt.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, constraint drop+add in één DO-blok, cron via
-- unschedule+schedule.
-- Handmatig terugdraaien:
--   ALTER TABLE public.social_posts DROP COLUMN video_url, DROP COLUMN video_silent_url,
--     DROP COLUMN music_hint, DROP COLUMN manual_reason, DROP COLUMN reminded_at,
--     DROP COLUMN regenerate_note, DROP COLUMN regenerate_requested_at, DROP COLUMN regenerate_from,
--     DROP COLUMN publish_container_id;
--   (eerst rijen met media_type 'reel' of status 'regenerate_requested' opruimen) en de
--   media_type-check terugzetten op ('image','carousel','story'); het cron-commando uit
--   20261015170000 opnieuw plannen.

-- 1. Kolommen ----------------------------------------------------------------------------

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_silent_url text,
  ADD COLUMN IF NOT EXISTS music_hint jsonb,
  ADD COLUMN IF NOT EXISTS manual_reason text,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS regenerate_note text,
  ADD COLUMN IF NOT EXISTS regenerate_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS regenerate_from text,
  ADD COLUMN IF NOT EXISTS publish_container_id text;

COMMENT ON COLUMN public.social_posts.video_url IS
  'Reel: de video die SellQo automatisch publiceert (met muziek uit de bibliotheek van de tenant). image_urls[0] is de cover.';
COMMENT ON COLUMN public.social_posts.video_silent_url IS
  'Reel: stille versie voor wie zelf muziek kiest in de Instagram-app (status manual, manual_reason music).';
COMMENT ON COLUMN public.social_posts.music_hint IS
  'Reel: muziekvoorstel, bv. {"mood":"warm, akoestisch","bpm":100,"search_terms":["acoustic love"],"tip":"refrein op 0:09","track":{"title":"…","license":"…"}}.';
COMMENT ON COLUMN public.social_posts.manual_reason IS
  'Waarom een post op manual staat: sticker (story met poll/link/vraag), music (reel met eigen muziek), other.';
COMMENT ON COLUMN public.social_posts.reminded_at IS
  'Wanneer de herinnering "zelf posten" verstuurd is (social-publish-due). Eén herinnering per post.';
COMMENT ON COLUMN public.social_posts.regenerate_from IS
  'Status van de post vóór "opnieuw maken"; de nieuwe versie keert terug naar pending_approval (of manual voor stickerstories).';
COMMENT ON COLUMN public.social_posts.publish_container_id IS
  'Instagram-container van een reel die nog verwerkt werd; de volgende run publiceert hem zonder opnieuw te uploaden.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass AND conname = 'social_posts_manual_reason_check'
  ) THEN
    ALTER TABLE public.social_posts
      ADD CONSTRAINT social_posts_manual_reason_check
      CHECK (manual_reason IS NULL OR manual_reason IN ('sticker', 'music', 'other'));
  END IF;

  -- Breder maken: 'reel' erbij. Drop + add in dezelfde transactie.
  ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_media_type_check;
  ALTER TABLE public.social_posts
    ADD CONSTRAINT social_posts_media_type_check
    CHECK (media_type IN ('image', 'carousel', 'story', 'reel'));
END $$;

CREATE INDEX IF NOT EXISTS social_posts_manual_due_idx
  ON public.social_posts (scheduled_for)
  WHERE status = 'manual' AND reminded_at IS NULL;

-- 2. Cron: publiceren én herinneren ------------------------------------------------------
-- Herinnering: een manual-post zonder herinnering die binnen 65 minuten gepland staat
-- (of hooguit 30 minuten geleden). De functie stuurt per post één melding.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ontbreekt — cron voor SOCIAL-3 overgeslagen';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-publish-due-hourly') THEN
    PERFORM cron.unschedule('social-publish-due-hourly');
  END IF;

  PERFORM cron.schedule(
    'social-publish-due-hourly',
    '1 * * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/social-publish-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := '{"mode":"publish"}'::jsonb,
      timeout_milliseconds := 150000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.social_posts
      WHERE (status IN ('scheduled', 'approved') AND scheduled_for <= now())
         OR (status = 'publishing' AND last_attempt_at < now() - interval '2 hours')
         OR (status = 'manual' AND reminded_at IS NULL
             AND scheduled_for BETWEEN now() - interval '30 minutes' AND now() + interval '65 minutes')
    );
    $cmd$
  );
END $$;

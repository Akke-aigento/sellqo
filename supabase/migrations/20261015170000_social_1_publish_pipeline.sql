-- SOCIAL-1 — social posts echt publiceren: statusflow, claim-functie en scheduler.
--
-- Wat er tot nu toe misging (recon 15 okt 2026):
--   * `social_posts` met status 'scheduled' werden door niets opgepikt: er bestond
--     geen cronjob en geen functie die ingeplande posts publiceert.
--   * Instagram ging via de Facebook-pagina (zie social-post-publish), dus er
--     verscheen nooit iets op Instagram.
--   * Bij meerdere Facebook-pagina's was niet vast te leggen op welke pagina een
--     tenant post.
--
-- Deze migratie is STRIKT ADDITIEF: alleen nieuwe kolommen (nullable of met een
-- default), een nieuwe index, nieuwe functies en twee nieuwe cronjobs. Er wordt
-- niets hernoemd, gedropt of van default veranderd. Op 15 okt 2026 bevatten
-- social_posts en social_connections 0 rijen.
--
-- Statusflow social_posts.status (text, geen check-constraint; bestaand gedrag blijft):
--   draft             concept, doet niets
--   pending_approval  wacht op goedkeuring (nieuw; gebruikt door geplande contenttaken)
--   approved          goedgekeurd, wordt op scheduled_for gepubliceerd (nieuw)
--   scheduled         door de tenant zelf ingepland (bestaand) — telt als goedgekeurd
--   publishing        wordt nu gepubliceerd (nieuw, tijdelijke claim)
--   posted / failed   eindstatus (bestaand)
--   manual            kan niet via de API (bv. story met sticker): enkel reminder (nieuw)
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE,
-- cron.schedule met een vaste jobnaam vervangt een bestaande job. Twee keer draaien
-- geeft hetzelfde resultaat.
--
-- TERUGDRAAIEN (geen DOWN):
--   select cron.unschedule('social-publish-due-hourly');
--   select cron.unschedule('social-token-refresh-daily');
--   drop function if exists public.social_claim_due_posts(integer);
--   De kolommen blijven staan (DB-safety: nooit droppen); ze zijn nullable of hebben
--   een default en hinderen niets.

-- 1. social_posts -------------------------------------------------------------------

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS publish_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_claimed_from text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.social_posts.media_type IS
  'image | carousel | story. Carousel = 2-10 beelden in image_urls. Story = 1 beeld, zonder stickers.';
COMMENT ON COLUMN public.social_posts.publish_claimed_from IS
  'Status vóór de claim (scheduled/approved), zodat een tijdelijke fout de post terugzet in plaats van hem te verliezen.';
COMMENT ON COLUMN public.social_posts.source IS
  'Herkomst van de post, vrij veld (bv. ui, ai_menu, content_task).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_posts_media_type_check'
      AND conrelid = 'public.social_posts'::regclass
  ) THEN
    ALTER TABLE public.social_posts
      ADD CONSTRAINT social_posts_media_type_check
      CHECK (media_type IN ('image', 'carousel', 'story'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_posts_due_idx
  ON public.social_posts (scheduled_for)
  WHERE status IN ('scheduled', 'approved', 'publishing');

-- 2. social_connections ----------------------------------------------------------------

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS api_kind text,
  ADD COLUMN IF NOT EXISTS target_page_id text;

COMMENT ON COLUMN public.social_connections.api_kind IS
  'Hoe deze koppeling praat: instagram_login = Instagram API met Instagram Login (graph.instagram.com). NULL = bestaande OAuth van het platform (bij Meta: Facebook Login).';
COMMENT ON COLUMN public.social_connections.target_page_id IS
  'Meta: de Facebook-pagina (page_id uit meta_messaging_connections) waarop deze tenant post. NULL = de enige gekoppelde pagina; bij meerdere pagina''s moet de tenant kiezen.';

-- 3. Claim-functie ----------------------------------------------------------------------
-- Eén atomische stap: zet maximaal p_limit verlopen posts op 'publishing' en geeft ze
-- terug. FOR UPDATE SKIP LOCKED zodat twee gelijktijdige runs nooit dezelfde post pakken.
-- Een post die al langer dan 2 uur op 'publishing' staat, is een afgebroken run. Die wordt
-- NIET opnieuw gepubliceerd (dat kan een dubbele post geven), maar op 'failed' gezet met
-- een uitleg.

CREATE OR REPLACE FUNCTION public.social_claim_due_posts(p_limit integer DEFAULT 20)
RETURNS SETOF public.social_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.social_posts
  SET status = 'failed',
      error_message = 'Publicatie werd onderbroken. Controleer of de post toch online staat voor je hem opnieuw inplant.',
      updated_at = now()
  WHERE status = 'publishing'
    AND last_attempt_at < now() - interval '2 hours';

  RETURN QUERY
  WITH due AS (
    SELECT sp.id FROM public.social_posts sp
    WHERE sp.status IN ('scheduled', 'approved')
      AND sp.scheduled_for IS NOT NULL
      AND sp.scheduled_for <= now()
      AND (sp.last_attempt_at IS NULL OR sp.last_attempt_at < now() - interval '50 minutes')
    ORDER BY sp.scheduled_for
    LIMIT greatest(1, least(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.social_posts p
    SET publish_claimed_from = p.status,
        status = 'publishing',
        publish_attempts = p.publish_attempts + 1,
        last_attempt_at = now(),
        updated_at = now()
    FROM due
    WHERE p.id = due.id
    RETURNING p.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.social_claim_due_posts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_claim_due_posts(integer) TO service_role;

-- 4. Cronjobs ----------------------------------------------------------------------------
-- Uurlijks (sub-hourly cron.schedule wordt door een platform-guard geblokkeerd, zie
-- 20260912140000). De WHERE EXISTS zorgt dat er enkel een HTTP-call vertrekt als er
-- effectief iets te doen is: zonder ingeplande posts kost dit niets.
-- Auth: x-cron-secret uit internal_config, net als 20260913170000.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ontbreekt — cronjobs voor SOCIAL-1 overgeslagen';
    RETURN;
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
      timeout_milliseconds := 120000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.social_posts
      WHERE (status IN ('scheduled', 'approved') AND scheduled_for <= now())
         OR (status = 'publishing' AND last_attempt_at < now() - interval '2 hours')
    );
    $cmd$
  );

  PERFORM cron.schedule(
    'social-token-refresh-daily',
    '23 4 * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/social-publish-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := '{"mode":"refresh"}'::jsonb,
      timeout_milliseconds := 120000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.social_connections
      WHERE api_kind = 'instagram_login'
        AND is_active
        AND token_expires_at IS NOT NULL
        AND token_expires_at > now()
        AND token_expires_at < now() + interval '10 days'
    );
    $cmd$
  );
END $$;

-- SOCIAL-6 — leren van de inhoud: labels per post, een eerlijke 48-uursmeting, één score,
-- en een logboek van wat de winkel met elke post doet (goedkeuren, aanpassen, opnieuw maken,
-- schrappen).
--
-- 1. social_posts.content_tags (jsonb): labels die de contentpijplijn meegeeft, bv.
--    {"pillar":"verhaal","format":"strip","hook":"vraag","caption_length":"kort","cta":"opslaan",
--     "product":"classic-tee","experiment":null,"bucket":"exploit"}. Vrij object, max 4000 tekens.
-- 2. social_posts.engagement_48h (jsonb): de meting ±48 uur na publicatie (social-insights-sync).
--    Zo vergelijk je posts op hetzelfde moment in hun leven, niet een oude met een nieuwe.
-- 3. social_post_score(metrics): (likes + 2·reacties + 2·antwoorden op een story + 3·bewaard + 3·gedeeld + 5·volgers) per
--    100 bereikte accounts. Bewaren, delen en volgen wegen zwaarder dan een like.
-- 4. social_post_events: logboek per post van content_task-posts (alleen lezen voor leden;
--    schrijven enkel via de trigger). Signaal voor de weektaak: wat Akke schrapt of herschrijft.
-- 5. social_post_performance: dezelfde view als SOCIAL-5, met kolommen achteraan erbij
--    (labels, score, 48-uurscijfers). Bestaande kolommen ongewijzigd.
--
-- Additief op social_posts (geen gedeelde storefront-tabel). Idempotent.
-- Terugdraaien:
--   drop trigger if exists trg_social_posts_events on public.social_posts;
--   drop function if exists public.social_posts_log_event();
--   drop table if exists public.social_post_events;
--   herdefinieer de view zonder de nieuwe kolommen (zie 20261016220000_social_5_insights.sql);
--   drop function if exists public.social_post_score(jsonb);
--   alter table public.social_posts drop column if exists content_tags, drop column if exists engagement_48h;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS content_tags jsonb,
  ADD COLUMN IF NOT EXISTS engagement_48h jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_posts_content_tags_shape') THEN
    ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_content_tags_shape
      CHECK (content_tags IS NULL OR (jsonb_typeof(content_tags) = 'object' AND length(content_tags::text) < 4000));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.social_post_score(m jsonb)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN coalesce((m->>'reach')::numeric, 0) > 0 THEN round(
      ( coalesce((m->>'likes')::numeric, 0)
      + 2 * coalesce((m->>'comments')::numeric, 0)
      + 2 * coalesce((m->>'replies')::numeric, 0)
      + 3 * coalesce((m->>'saved')::numeric, 0)
      + 3 * coalesce((m->>'shares')::numeric, 0)
      + 5 * coalesce((m->>'follows')::numeric, 0)
      ) / (m->>'reach')::numeric * 100, 2)
  END
$$;

CREATE TABLE IF NOT EXISTS public.social_post_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('approved', 'edited', 'rescheduled', 'regenerate_requested', 'removed', 'posted', 'failed', 'image_changed', 'language_changed')),
  note text,
  content_tags jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_post_events_tenant_idx ON public.social_post_events (tenant_id, created_at DESC);

ALTER TABLE public.social_post_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_post_events_select_members ON public.social_post_events;
CREATE POLICY social_post_events_select_members ON public.social_post_events
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) OR is_platform_admin(auth.uid()));
REVOKE ALL ON public.social_post_events FROM anon;
GRANT SELECT ON public.social_post_events TO authenticated;

CREATE OR REPLACE FUNCTION public.social_posts_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.source = 'content_task' AND OLD.status NOT IN ('posted', 'publishing') THEN
        INSERT INTO social_post_events (tenant_id, post_id, event, note, content_tags, actor)
        VALUES (OLD.tenant_id, OLD.id, 'removed', left(OLD.post_text, 300), OLD.content_tags, auth.uid());
      END IF;
      RETURN OLD;
    END IF;

    IF NEW.source IS DISTINCT FROM 'content_task' THEN
      RETURN NEW;
    END IF;

    FOR rec IN
      SELECT * FROM (VALUES
        ('approved', NEW.status = 'approved' AND OLD.status IN ('pending_approval', 'draft', 'failed'), NULL::text),
        ('regenerate_requested', NEW.status = 'regenerate_requested' AND OLD.status IS DISTINCT FROM 'regenerate_requested', NEW.regenerate_note),
        ('posted', NEW.status = 'posted' AND OLD.status IS DISTINCT FROM 'posted', NULL),
        ('failed', NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed', left(NEW.error_message, 300)),
        ('edited', NEW.post_text IS DISTINCT FROM OLD.post_text AND NEW.status <> 'regenerate_requested' AND OLD.status <> 'regenerate_requested', NULL),
        ('rescheduled', NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for AND OLD.status <> 'regenerate_requested', to_char(NEW.scheduled_for AT TIME ZONE 'Europe/Brussels', 'Dy HH24:MI')),
        ('image_changed', NEW.image_urls IS DISTINCT FROM OLD.image_urls AND OLD.status <> 'regenerate_requested' AND NEW.status <> 'posted', NULL),
        ('language_changed', NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'regenerate_requested', NEW.language)
      ) AS v(event, hit, note)
      WHERE v.hit
    LOOP
      INSERT INTO social_post_events (tenant_id, post_id, event, note, content_tags, actor)
      VALUES (NEW.tenant_id, NEW.id, rec.event, rec.note, NEW.content_tags, auth.uid());
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Het logboek mag een wijziging aan een post nooit tegenhouden.
    RAISE WARNING 'social_posts_log_event: %', SQLERRM;
  END;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.social_posts_log_event() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_social_posts_events ON public.social_posts;
CREATE TRIGGER trg_social_posts_events
  AFTER UPDATE OR DELETE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_posts_log_event();

CREATE OR REPLACE VIEW public.social_post_performance
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.tenant_id,
  p.platform,
  p.media_type,
  p.source,
  p.posted_at,
  (p.posted_at AT TIME ZONE 'Europe/Brussels') AS posted_local,
  extract(isodow FROM p.posted_at AT TIME ZONE 'Europe/Brussels')::int AS weekday,
  extract(hour FROM p.posted_at AT TIME ZONE 'Europe/Brussels')::int AS hour,
  p.engagement_data->>'source' AS data_source,
  p.engagement_data->>'permalink' AS permalink,
  (p.engagement_data->>'fetched_at')::timestamptz AS fetched_at,
  (p.engagement_data->'metrics'->>'reach')::int AS reach,
  (p.engagement_data->'metrics'->>'views')::int AS views,
  (p.engagement_data->'metrics'->>'likes')::int AS likes,
  (p.engagement_data->'metrics'->>'comments')::int AS comments,
  (p.engagement_data->'metrics'->>'saved')::int AS saved,
  (p.engagement_data->'metrics'->>'shares')::int AS shares,
  (p.engagement_data->'metrics'->>'total_interactions')::int AS total_interactions,
  (p.engagement_data->'metrics'->>'follows')::int AS follows,
  CASE
    WHEN (p.engagement_data->'metrics'->>'reach')::numeric > 0
    THEN round(
      coalesce((p.engagement_data->'metrics'->>'total_interactions')::numeric,
               coalesce((p.engagement_data->'metrics'->>'likes')::numeric, 0)
             + coalesce((p.engagement_data->'metrics'->>'comments')::numeric, 0)
             + coalesce((p.engagement_data->'metrics'->>'saved')::numeric, 0)
             + coalesce((p.engagement_data->'metrics'->>'shares')::numeric, 0))
      / (p.engagement_data->'metrics'->>'reach')::numeric * 100, 2)
  END AS engagement_rate,
  -- SOCIAL-6
  p.content_tags,
  p.content_tags->>'pillar' AS pillar,
  p.content_tags->>'format' AS format,
  p.content_tags->>'hook' AS hook,
  p.content_tags->>'caption_length' AS caption_length,
  p.content_tags->>'cta' AS cta,
  p.content_tags->>'bucket' AS bucket,
  p.content_tags->>'experiment' AS experiment,
  public.social_post_score(p.engagement_data->'metrics') AS score,
  public.social_post_score(p.engagement_48h->'metrics') AS score_48h,
  (p.engagement_48h->'metrics'->>'reach')::int AS reach_48h,
  (p.engagement_48h->'metrics'->>'saved')::int AS saved_48h,
  (p.engagement_48h->'metrics'->>'shares')::int AS shares_48h,
  (p.engagement_48h->'metrics'->>'follows')::int AS follows_48h,
  p.language
FROM public.social_posts p
WHERE p.status = 'posted'
  AND p.posted_at IS NOT NULL
  AND p.engagement_data ? 'metrics';

REVOKE ALL ON public.social_post_performance FROM anon;
GRANT SELECT ON public.social_post_performance TO authenticated;

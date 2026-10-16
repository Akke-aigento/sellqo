-- SOCIAL-5 — resultaten van social posts: volgers per dag, een prestatie-view en een cronjob.
--
-- 1. social_account_stats: volgers en aantal posts per winkel, per platform, per dag.
--    Schrijven doet enkel de edge functie social-insights-sync (service role); leden van de
--    winkel mogen lezen (zelfde regel als social_posts_select_members).
-- 2. social_post_performance: één rij per geposte post met de cijfers uit
--    social_posts.engagement_data (die kolom bestond al en werd nog nergens gevuld), plus
--    weekdag en uur in Brusselse tijd. security_invoker: de RLS van social_posts geldt.
--    De weektaken lezen deze view om de posttijden per merk te kiezen.
-- 3. cronjob social-insights-sync: elke 3 uur (stories zijn maar 24 u meetbaar), enkel als er
--    een actieve Instagram-koppeling is.
--
-- Additief: geen bestaande kolom of policy gewijzigd. Idempotent.
-- Terugdraaien:
--   select cron.unschedule('social-insights-sync');
--   drop view if exists public.social_post_performance;
--   drop table if exists public.social_account_stats;
--   (engagement_data op social_posts blijft; die kolom bestond al.)

CREATE TABLE IF NOT EXISTS public.social_account_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  captured_on date NOT NULL,
  followers_count integer,
  media_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_account_stats_unique UNIQUE (tenant_id, platform, captured_on)
);

ALTER TABLE public.social_account_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_account_stats_select_members ON public.social_account_stats;
CREATE POLICY social_account_stats_select_members ON public.social_account_stats
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) OR is_platform_admin(auth.uid()));

REVOKE ALL ON public.social_account_stats FROM anon;
GRANT SELECT ON public.social_account_stats TO authenticated;

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
  END AS engagement_rate
FROM public.social_posts p
WHERE p.status = 'posted'
  AND p.posted_at IS NOT NULL
  AND p.engagement_data ? 'metrics';

REVOKE ALL ON public.social_post_performance FROM anon;
GRANT SELECT ON public.social_post_performance TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-insights-sync') THEN
    PERFORM cron.unschedule('social-insights-sync');
  END IF;

  PERFORM cron.schedule(
    'social-insights-sync',
    '17 */3 * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/social-insights-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.social_connections
      WHERE platform = 'instagram' AND api_kind = 'instagram_login' AND is_active
    );
    $cmd$
  );
END $$;

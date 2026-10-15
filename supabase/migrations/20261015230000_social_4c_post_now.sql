-- SOCIAL-4c — "Nu posten": één post meteen publiceren vanuit de Social planning.
--
-- Atomische claim van één post door social-post-publish (service_role), net als
-- social_claim_due_posts voor de cron. Zet de post op 'publishing', telt de poging, en
-- registreert de goedkeuring door wie op "Nu posten" klikte. scheduled_for wordt nu: lukt
-- het niet meteen (tijdelijke fout, video nog in verwerking), dan pakt de uurlijkse cron
-- hem binnen het uur opnieuw op in plaats van op het oude geplande moment.
-- Niet voor: 'manual' (zelf posten), 'posted', 'publishing', 'regenerate_requested', en
-- reels zonder versie met muziek.
-- Additief en idempotent (CREATE OR REPLACE). Terugdraaien:
--   DROP FUNCTION public.social_claim_post_now(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.social_claim_post_now(p_post_id uuid, p_tenant_id uuid, p_user_id uuid)
RETURNS SETOF public.social_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.social_posts p
  SET publish_claimed_from = 'approved',
      status = 'publishing',
      approved_at = COALESCE(p.approved_at, now()),
      approved_by = COALESCE(p.approved_by, p_user_id),
      scheduled_for = now(),
      publish_attempts = p.publish_attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  WHERE p.id = p_post_id
    AND p.tenant_id = p_tenant_id
    AND p.status IN ('pending_approval', 'draft', 'approved', 'scheduled', 'failed')
    AND (p.media_type <> 'reel' OR p.video_url IS NOT NULL)
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.social_claim_post_now(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_claim_post_now(uuid, uuid, uuid) TO service_role;

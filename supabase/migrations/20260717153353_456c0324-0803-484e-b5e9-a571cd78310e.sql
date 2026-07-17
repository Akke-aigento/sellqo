ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS user_id uuid NULL;

CREATE INDEX IF NOT EXISTS ai_usage_log_help_lookup_idx
  ON public.ai_usage_log (tenant_id, user_id, feature, created_at)
  WHERE feature = 'help_assistant';

CREATE OR REPLACE FUNCTION public.check_help_rate_limit(
  p_tenant_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count int;
  v_tenant_count int;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_user_count
    FROM public.ai_usage_log
   WHERE feature = 'help_assistant'
     AND user_id = p_user_id
     AND created_at >= date_trunc('day', now());

  IF v_user_count >= 30 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_tenant_count
    FROM public.ai_usage_log
   WHERE feature = 'help_assistant'
     AND tenant_id = p_tenant_id
     AND created_at >= date_trunc('day', now());

  IF v_tenant_count >= 150 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_log (tenant_id, user_id, feature, credits_used)
    VALUES (p_tenant_id, p_user_id, 'help_assistant', 0);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_help_rate_limit(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_help_rate_limit(uuid, uuid) TO service_role;
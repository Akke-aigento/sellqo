-- AI-CRED-1 (12-10-2026) — één waarheid voor het verbruik van AI-credits.
--
-- Wat er mis was:
--   1. Twee versies van use_ai_credits. De korte (p_tenant_id, p_credits_needed)
--      logde niets in ai_usage_log, dus "waar gaan de credits naartoe" was niet te zien.
--   2. Alleen is_internal_tenant gold als vrijgesteld. Eigen winkels met
--      billing_exempt (VanXcel, Loveke, Fonske) betaalden hun AI gewoon af.
--      Dezelfde regel als _shared/billingExempt.ts: internal OF billing_exempt.
--
-- De korte versie blijft bestaan (edge functions roepen hem aan) maar delegeert
-- naar de lange, met feature 'unspecified'. Signaturen ongewijzigd: geen
-- aanroeper breekt. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id uuid,
  p_credits integer,
  p_feature text,
  p_model text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exempt BOOLEAN;
  v_available INTEGER;
BEGIN
  SELECT coalesce(is_internal_tenant, false) OR coalesce(billing_exempt, false)
    INTO v_exempt
    FROM tenants WHERE id = p_tenant_id;

  IF v_exempt THEN
    -- Vrijgesteld: niets aftrekken, wel loggen voor het verbruiksoverzicht.
    INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
    VALUES (p_tenant_id, coalesce(p_feature, 'unspecified'), 0, p_model,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('exempt', true, 'credits_requested', p_credits));
    RETURN TRUE;
  END IF;

  SELECT (credits_total + credits_purchased - credits_used)
    INTO v_available
    FROM tenant_ai_credits
   WHERE tenant_id = p_tenant_id
   FOR UPDATE;

  IF v_available IS NULL THEN
    INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_used)
    VALUES (p_tenant_id, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;
    v_available := 0;
  END IF;

  IF v_available < p_credits THEN
    RETURN FALSE;
  END IF;

  UPDATE tenant_ai_credits
     SET credits_used = credits_used + p_credits, updated_at = now()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
  VALUES (p_tenant_id, coalesce(p_feature, 'unspecified'), p_credits, p_model, coalesce(p_metadata, '{}'::jsonb));

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.use_ai_credits(p_tenant_id uuid, p_credits_needed integer DEFAULT 1)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.use_ai_credits(p_tenant_id, p_credits_needed, 'unspecified'::text, NULL::text, '{}'::jsonb);
$function$;

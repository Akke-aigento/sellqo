-- Update use_ai_credits function (simple version) to bypass credits for internal tenants
CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id uuid, 
  p_credits_needed integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_internal BOOLEAN;
  available_credits integer;
BEGIN
  -- Platform owner (is_internal_tenant) heeft onbeperkte credits
  SELECT is_internal_tenant INTO v_is_internal
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_is_internal = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Normale credit check voor andere tenants
  SELECT (credits_total + credits_purchased - credits_used)
  INTO available_credits FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  IF available_credits IS NULL OR available_credits < p_credits_needed THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits_needed, updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
  
  RETURN TRUE;
END;
$$;

-- Update use_ai_credits function (full version with logging) to bypass credits for internal tenants
CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id uuid, 
  p_credits integer, 
  p_feature text, 
  p_model text DEFAULT NULL, 
  p_metadata jsonb DEFAULT '{}'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_internal BOOLEAN;
  v_available INTEGER;
BEGIN
  -- Platform owner check
  SELECT is_internal_tenant INTO v_is_internal
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_is_internal = TRUE THEN
    -- Log voor analytics, geen credit aftrek
    INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
    VALUES (p_tenant_id, p_feature, 0, p_model, 
      p_metadata || '{"internal_unlimited": true}'::jsonb);
    RETURN TRUE;
  END IF;
  
  -- Normale flow
  SELECT (credits_total + credits_purchased - credits_used)
  INTO v_available FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  IF v_available IS NULL THEN
    INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_used)
    VALUES (p_tenant_id, 0, 0);
    v_available := 0;
  END IF;
  
  IF v_available < p_credits THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
  VALUES (p_tenant_id, p_feature, p_credits, p_model, p_metadata);
  
  RETURN TRUE;
END;
$$;
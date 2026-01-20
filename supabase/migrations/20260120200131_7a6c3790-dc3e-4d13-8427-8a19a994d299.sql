-- Fix admin_adjust_ai_credits to also update credits_total
CREATE OR REPLACE FUNCTION public.admin_adjust_ai_credits(p_tenant_id uuid, p_adjustment integer, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_current_purchased INTEGER;
  v_current_total INTEGER;
BEGIN
  -- Check if caller is platform admin
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admins can adjust credits';
  END IF;
  
  -- Get current credits
  SELECT credits_purchased, credits_total INTO v_current_purchased, v_current_total
  FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  -- Ensure we don't go negative
  IF v_current_purchased + p_adjustment < 0 THEN
    RAISE EXCEPTION 'Cannot reduce credits below zero';
  END IF;
  
  -- Update both credits_purchased AND credits_total
  UPDATE tenant_ai_credits
  SET credits_purchased = credits_purchased + p_adjustment,
      credits_total = credits_total + p_adjustment,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Log the action
  PERFORM public.log_admin_action(
    p_tenant_id,
    'credits_adjusted',
    jsonb_build_object(
      'adjustment', p_adjustment,
      'reason', p_reason,
      'new_purchased_total', v_current_purchased + p_adjustment,
      'new_credits_total', v_current_total + p_adjustment
    )
  );
  
  -- Log in AI usage log as well
  INSERT INTO ai_usage_log (tenant_id, feature, credits_used, metadata)
  VALUES (
    p_tenant_id, 
    'admin_adjustment', 
    -p_adjustment,  -- Negative because adjustment adds credits
    jsonb_build_object('reason', p_reason, 'adjusted_by', auth.uid())
  );
  
  RETURN TRUE;
END;
$$;
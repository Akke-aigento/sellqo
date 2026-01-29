-- Function to downgrade expired trials to free plan
CREATE OR REPLACE FUNCTION public.downgrade_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  downgraded_count integer;
BEGIN
  UPDATE tenant_subscriptions
  SET 
    plan_id = 'free',
    status = 'active',
    trial_end = NULL,
    updated_at = NOW()
  WHERE status = 'trialing'
    AND trial_end IS NOT NULL
    AND trial_end <= NOW()
    AND plan_id != 'free';  -- Don't touch free trials
  
  GET DIAGNOSTICS downgraded_count = ROW_COUNT;
  
  -- Log the action
  IF downgraded_count > 0 THEN
    RAISE NOTICE 'Downgraded % expired trial subscriptions to free plan', downgraded_count;
  END IF;
  
  RETURN downgraded_count;
END;
$$;
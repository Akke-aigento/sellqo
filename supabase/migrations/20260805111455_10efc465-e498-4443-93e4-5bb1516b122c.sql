CREATE OR REPLACE FUNCTION public.create_tenant_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    trial_end,
    billing_interval
  ) VALUES (
    NEW.id,
    'pro',
    'trialing',
    (NOW() + INTERVAL '14 days')::timestamptz,
    'monthly'
  );

  -- Keep the denormalized label on tenants in sync (header badge source)
  UPDATE tenants SET subscription_plan = 'pro' WHERE id = NEW.id AND COALESCE(subscription_plan, '') <> 'pro';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.downgrade_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  downgraded_count integer;
  affected uuid[];
BEGIN
  WITH upd AS (
    UPDATE tenant_subscriptions
    SET
      plan_id = 'free',
      status = 'active',
      trial_end = NULL,
      updated_at = NOW()
    WHERE status = 'trialing'
      AND trial_end IS NOT NULL
      AND trial_end <= NOW()
      AND plan_id != 'free'
    RETURNING tenant_id
  )
  SELECT array_agg(tenant_id), count(*) INTO affected, downgraded_count FROM upd;

  downgraded_count := COALESCE(downgraded_count, 0);

  IF downgraded_count > 0 THEN
    UPDATE tenants SET subscription_plan = 'free' WHERE id = ANY(affected);
    RAISE NOTICE 'Downgraded % expired trial subscriptions to free plan', downgraded_count;
  END IF;

  RETURN downgraded_count;
END;
$$;
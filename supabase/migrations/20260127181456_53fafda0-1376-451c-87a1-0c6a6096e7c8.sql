-- Trigger om automatisch subscription aan te maken bij nieuwe tenant
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
    'free',
    'trialing',
    (NOW() + INTERVAL '14 days')::timestamptz,
    'monthly'
  );
  RETURN NEW;
END;
$$;

-- Trigger koppelen aan tenants tabel
DROP TRIGGER IF EXISTS on_tenant_created_create_subscription ON tenants;
CREATE TRIGGER on_tenant_created_create_subscription
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_trial_subscription();
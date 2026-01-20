-- 1. Add ai_marketing feature to pricing_plans.features
-- First check if the column is JSONB and update Pro/Enterprise plans
UPDATE pricing_plans 
SET features = features || '{"ai_marketing": true}'::jsonb
WHERE slug IN ('pro', 'enterprise');

UPDATE pricing_plans 
SET features = features || '{"ai_marketing": false}'::jsonb
WHERE slug IN ('free', 'starter');

-- 2. Create function to initialize tenant AI credits
CREATE OR REPLACE FUNCTION initialize_tenant_ai_credits()
RETURNS TRIGGER AS $$
DECLARE
  plan_credits integer;
BEGIN
  -- Get the AI credits from the default plan (free plan has 10 credits)
  SELECT COALESCE(pp.ai_credits_monthly, 10) INTO plan_credits
  FROM tenant_subscriptions ts
  LEFT JOIN pricing_plans pp ON ts.plan_id = pp.id
  WHERE ts.tenant_id = NEW.id
  LIMIT 1;
  
  -- If no subscription found, use default
  IF plan_credits IS NULL THEN
    plan_credits := 10;
  END IF;
  
  -- Insert credits record for the new tenant
  INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_reset_at)
  VALUES (NEW.id, plan_credits, (NOW() + INTERVAL '1 month')::timestamptz)
  ON CONFLICT (tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create trigger for new tenants
DROP TRIGGER IF EXISTS on_tenant_create_init_ai_credits ON tenants;
CREATE TRIGGER on_tenant_create_init_ai_credits
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION initialize_tenant_ai_credits();

-- 4. Backfill existing tenants that don't have AI credits yet
INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_reset_at)
SELECT t.id, COALESCE(pp.ai_credits_monthly, 10), (NOW() + INTERVAL '1 month')::timestamptz
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
LEFT JOIN pricing_plans pp ON ts.plan_id = pp.id
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_ai_credits tac WHERE tac.tenant_id = t.id
);

-- 5. Create function to reset monthly credits (called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_ai_credits()
RETURNS integer AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE tenant_ai_credits tac
  SET 
    credits_used = 0,
    credits_total = COALESCE(
      (SELECT pp.ai_credits_monthly 
       FROM tenant_subscriptions ts 
       JOIN pricing_plans pp ON ts.plan_id = pp.id 
       WHERE ts.tenant_id = tac.tenant_id 
       AND ts.status = 'active'
       LIMIT 1),
      10
    ),
    credits_reset_at = (NOW() + INTERVAL '1 month')::timestamptz,
    updated_at = NOW()
  WHERE credits_reset_at <= NOW();
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create function to check and deduct AI credits
CREATE OR REPLACE FUNCTION use_ai_credits(
  p_tenant_id uuid,
  p_credits_needed integer DEFAULT 1
)
RETURNS boolean AS $$
DECLARE
  available_credits integer;
BEGIN
  -- Get available credits
  SELECT (credits_total + credits_purchased - credits_used)
  INTO available_credits
  FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  -- Check if enough credits
  IF available_credits IS NULL OR available_credits < p_credits_needed THEN
    RETURN false;
  END IF;
  
  -- Deduct credits
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits_needed,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Add stripe_ai_credits_product_id to pricing_plans if not exists
-- This will store the Stripe product ID for AI credit purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_ai_credits' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE tenant_ai_credits ADD COLUMN stripe_customer_id text;
  END IF;
END $$;

-- 8. Create ai_credit_purchases table for tracking credit purchases
CREATE TABLE IF NOT EXISTS ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  stripe_session_id text,
  stripe_payment_intent_id text,
  credits_amount integer NOT NULL,
  price_paid numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS on ai_credit_purchases
ALTER TABLE ai_credit_purchases ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for ai_credit_purchases
CREATE POLICY "Users can view their own credit purchases"
ON ai_credit_purchases FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_tenant_id ON ai_credit_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_stripe_session ON ai_credit_purchases(stripe_session_id);
-- Fase 1: Commissievrije Betalingen met Transactie-Model

-- 1. Pricing plans uitbreiden met transactie limieten
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS 
  included_transactions_monthly integer DEFAULT 0;

ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS 
  transaction_overage_fee decimal(5,2) DEFAULT 0.50;

-- 2. Tenant payment instellingen
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  payment_methods_enabled jsonb DEFAULT '["stripe", "bank_transfer"]';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  pass_transaction_fee_to_customer boolean DEFAULT false;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  transaction_fee_label text DEFAULT 'Transactiekosten';

-- 3. Orders uitbreiden met payment method tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS 
  payment_method text; -- 'stripe_ideal', 'stripe_card', 'bank_transfer', 'cash', 'pin'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS 
  transaction_fee_charged decimal(10,2) DEFAULT 0;

-- 4. Tenant transactie usage tracking tabel
CREATE TABLE IF NOT EXISTS tenant_transaction_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  month_year text NOT NULL, -- Format: '2026-01'
  stripe_transactions integer DEFAULT 0,
  bank_transfer_transactions integer DEFAULT 0,
  pos_cash_transactions integer DEFAULT 0,
  pos_card_transactions integer DEFAULT 0,
  overage_fee_total decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month_year)
);

-- 5. RLS voor tenant_transaction_usage
ALTER TABLE tenant_transaction_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own transaction usage"
  ON tenant_transaction_usage FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Platform admins can view all transaction usage"
  ON tenant_transaction_usage FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "System can insert/update transaction usage"
  ON tenant_transaction_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Update pricing plans met transactie limieten
UPDATE pricing_plans SET 
  included_transactions_monthly = 0,
  transaction_overage_fee = 2.50
WHERE slug = 'free';

UPDATE pricing_plans SET 
  included_transactions_monthly = 100,
  transaction_overage_fee = 0.50
WHERE slug = 'starter';

UPDATE pricing_plans SET 
  included_transactions_monthly = 500,
  transaction_overage_fee = 0.30
WHERE slug = 'professional';

UPDATE pricing_plans SET 
  included_transactions_monthly = -1, -- -1 = unlimited
  transaction_overage_fee = 0
WHERE slug = 'enterprise';

-- 7. Function om transactie te registreren en overage te berekenen
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_tenant_id uuid,
  p_transaction_type text, -- 'stripe', 'bank_transfer', 'pos_cash', 'pos_card'
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month_year text;
  v_usage_record tenant_transaction_usage%ROWTYPE;
  v_plan pricing_plans%ROWTYPE;
  v_subscription tenant_subscriptions%ROWTYPE;
  v_total_transactions integer;
  v_included_transactions integer;
  v_overage_fee decimal(10,2);
  v_is_overage boolean;
BEGIN
  v_month_year := to_char(now(), 'YYYY-MM');
  
  -- Get or create usage record for this month
  INSERT INTO tenant_transaction_usage (tenant_id, month_year)
  VALUES (p_tenant_id, v_month_year)
  ON CONFLICT (tenant_id, month_year) DO NOTHING;
  
  SELECT * INTO v_usage_record
  FROM tenant_transaction_usage
  WHERE tenant_id = p_tenant_id AND month_year = v_month_year;
  
  -- Increment the appropriate counter
  CASE p_transaction_type
    WHEN 'stripe' THEN
      UPDATE tenant_transaction_usage 
      SET stripe_transactions = stripe_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'bank_transfer' THEN
      UPDATE tenant_transaction_usage 
      SET bank_transfer_transactions = bank_transfer_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_cash' THEN
      UPDATE tenant_transaction_usage 
      SET pos_cash_transactions = pos_cash_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_card' THEN
      UPDATE tenant_transaction_usage 
      SET pos_card_transactions = pos_card_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
  END CASE;
  
  -- Get current subscription and plan
  SELECT * INTO v_subscription
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM pricing_plans
    WHERE id = v_subscription.plan_id;
  END IF;
  
  -- Calculate if this is an overage transaction
  v_included_transactions := COALESCE(v_plan.included_transactions_monthly, 0);
  v_overage_fee := COALESCE(v_plan.transaction_overage_fee, 0.50);
  
  -- -1 means unlimited
  IF v_included_transactions = -1 THEN
    v_is_overage := false;
    v_overage_fee := 0;
  ELSE
    -- Refresh usage record
    SELECT * INTO v_usage_record
    FROM tenant_transaction_usage
    WHERE tenant_id = p_tenant_id AND month_year = v_month_year;
    
    v_total_transactions := v_usage_record.stripe_transactions + 
                           v_usage_record.bank_transfer_transactions + 
                           v_usage_record.pos_cash_transactions + 
                           v_usage_record.pos_card_transactions;
    
    v_is_overage := v_total_transactions > v_included_transactions;
    
    IF v_is_overage THEN
      UPDATE tenant_transaction_usage 
      SET overage_fee_total = overage_fee_total + v_overage_fee, updated_at = now()
      WHERE id = v_usage_record.id;
    ELSE
      v_overage_fee := 0;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'is_overage', v_is_overage,
    'overage_fee', v_overage_fee,
    'total_transactions', v_total_transactions,
    'included_transactions', v_included_transactions
  );
END;
$$;
-- ==============================================================
-- AI BUSINESS COACH: DATABASE EXTENSION
-- ==============================================================

-- 1. Add 'ai_coach' to notification_category enum
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'ai_coach';

-- 2. Extend ai_action_suggestions for conversational coach
ALTER TABLE ai_action_suggestions 
  ADD COLUMN IF NOT EXISTS conversational_message TEXT,
  ADD COLUMN IF NOT EXISTS quick_actions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS analysis_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- 3. AI Coach personalization settings per tenant
CREATE TABLE IF NOT EXISTS ai_coach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coach_name TEXT DEFAULT 'Coach',
  personality TEXT DEFAULT 'friendly' CHECK (personality IN ('friendly', 'professional', 'casual')),
  proactive_level TEXT DEFAULT 'balanced' CHECK (proactive_level IN ('aggressive', 'balanced', 'minimal')),
  analysis_frequency_hours INTEGER DEFAULT 6,
  enabled_analyses TEXT[] DEFAULT ARRAY['stock', 'sales', 'customers', 'invoices', 'quotes', 'subscriptions'],
  muted_suggestion_types TEXT[] DEFAULT '{}',
  show_emoji BOOLEAN DEFAULT true,
  auto_dismiss_after_hours INTEGER DEFAULT 168, -- 7 days
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE ai_coach_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_coach_settings
CREATE POLICY "Users can view their tenant's coach settings"
  ON ai_coach_settings FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage coach settings"
  ON ai_coach_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = ai_coach_settings.tenant_id
        AND role IN ('tenant_admin', 'platform_admin')
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ai_coach_settings_tenant 
  ON ai_coach_settings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_action_suggestions_snoozed 
  ON ai_action_suggestions(snoozed_until) 
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_suggestions_related 
  ON ai_action_suggestions(related_entity_type, related_entity_id) 
  WHERE related_entity_id IS NOT NULL;

-- Updated_at trigger for ai_coach_settings
CREATE TRIGGER update_ai_coach_settings_updated_at
  BEFORE UPDATE ON ai_coach_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add more suggestion types to support new analyses
-- Using COMMENT to document the extended suggestion types:
COMMENT ON TABLE ai_action_suggestions IS 'Extended suggestion types: 
  stock_alert, purchase_order, customer_winback, marketing_campaign,
  sales_spike, sales_drop, invoice_overdue, quote_expiring, 
  subscription_expiring, abandoned_carts, vip_inactive, 
  review_negative, marketplace_alert, bulk_shipping';

-- 5. Function to initialize default coach settings for new tenants
CREATE OR REPLACE FUNCTION initialize_tenant_ai_coach_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_coach_settings (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create coach settings for new tenants
DROP TRIGGER IF EXISTS create_ai_coach_settings_on_tenant ON tenants;
CREATE TRIGGER create_ai_coach_settings_on_tenant
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION initialize_tenant_ai_coach_settings();
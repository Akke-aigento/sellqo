-- =============================================
-- EMAIL MARKETING SYSTEM ENHANCEMENT MIGRATION
-- =============================================

-- 1. Extend newsletter_subscribers for double opt-in
ALTER TABLE newsletter_subscribers 
ADD COLUMN IF NOT EXISTS confirmation_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"newsletter": true, "promotions": true, "transactional": true, "frequency": "normal"}',
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unsubscribe_reason TEXT;

-- 2. Add automation runs table for tracking automation executions
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES email_automations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  trigger_entity_id UUID,
  trigger_entity_type TEXT NOT NULL, -- 'customer', 'order', 'cart', 'subscriber'
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled, failed
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add automation steps table for multi-step flows
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES email_automations(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'send_email', 'wait', 'condition', 'update_customer'
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject_override TEXT,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,
  condition_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add step runs for tracking individual step executions
CREATE TABLE IF NOT EXISTS automation_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_run_id UUID REFERENCES automation_runs(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES automation_steps(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, scheduled, sent, skipped, failed
  scheduled_for TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add email template blocks for visual builder
CREATE TABLE IF NOT EXISTS email_template_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE NOT NULL,
  block_order INTEGER NOT NULL,
  block_type TEXT NOT NULL, -- 'header', 'text', 'image', 'button', 'divider', 'spacer', 'columns', 'product', 'social', 'footer'
  content JSONB DEFAULT '{}',
  style JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add email preferences table for preference center
CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  newsletter BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  transactional BOOLEAN DEFAULT true,
  product_updates BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'normal', -- 'daily', 'weekly', 'normal', 'minimal'
  preference_token UUID DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- 7. Extend email_automations with more fields
ALTER TABLE email_automations
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES customer_segments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_runs_per_customer INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_completed INTEGER DEFAULT 0;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_scheduled ON automation_runs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON automation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON automation_steps(automation_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_email ON email_preferences(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_token ON newsletter_subscribers(confirmation_token);

-- 9. Enable RLS on new tables
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for automation_runs
CREATE POLICY "Users can view automation runs for their tenant"
ON automation_runs FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert automation runs for their tenant"
ON automation_runs FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update automation runs for their tenant"
ON automation_runs FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete automation runs for their tenant"
ON automation_runs FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 11. RLS Policies for automation_steps (via automation_id -> email_automations -> tenant_id)
CREATE POLICY "Users can view automation steps for their tenant"
ON automation_steps FOR SELECT
USING (automation_id IN (
  SELECT id FROM email_automations WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can insert automation steps for their tenant"
ON automation_steps FOR INSERT
WITH CHECK (automation_id IN (
  SELECT id FROM email_automations WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can update automation steps for their tenant"
ON automation_steps FOR UPDATE
USING (automation_id IN (
  SELECT id FROM email_automations WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can delete automation steps for their tenant"
ON automation_steps FOR DELETE
USING (automation_id IN (
  SELECT id FROM email_automations WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

-- 12. RLS Policies for automation_step_runs
CREATE POLICY "Users can view automation step runs for their tenant"
ON automation_step_runs FOR SELECT
USING (automation_run_id IN (
  SELECT id FROM automation_runs WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

-- 13. RLS Policies for email_template_blocks
CREATE POLICY "Users can view template blocks for their tenant"
ON email_template_blocks FOR SELECT
USING (template_id IN (
  SELECT id FROM email_templates WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can insert template blocks for their tenant"
ON email_template_blocks FOR INSERT
WITH CHECK (template_id IN (
  SELECT id FROM email_templates WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can update template blocks for their tenant"
ON email_template_blocks FOR UPDATE
USING (template_id IN (
  SELECT id FROM email_templates WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can delete template blocks for their tenant"
ON email_template_blocks FOR DELETE
USING (template_id IN (
  SELECT id FROM email_templates WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
));

-- 14. RLS Policies for email_preferences
CREATE POLICY "Users can view email preferences for their tenant"
ON email_preferences FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert email preferences for their tenant"
ON email_preferences FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update email preferences for their tenant"
ON email_preferences FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 15. Create function to schedule automation run
CREATE OR REPLACE FUNCTION public.schedule_automation_run(
  p_automation_id UUID,
  p_trigger_entity_id UUID,
  p_trigger_entity_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_run_id UUID;
  v_automation RECORD;
  v_first_step RECORD;
  v_schedule_time TIMESTAMPTZ;
BEGIN
  -- Get automation details
  SELECT * INTO v_automation FROM email_automations WHERE id = p_automation_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Get first step
  SELECT * INTO v_first_step FROM automation_steps 
  WHERE automation_id = p_automation_id AND is_active = true 
  ORDER BY step_order LIMIT 1;
  
  -- Calculate schedule time based on first step delay
  v_schedule_time := now() + 
    (COALESCE(v_first_step.delay_hours, v_automation.delay_hours, 0) || ' hours')::INTERVAL +
    (COALESCE(v_first_step.delay_minutes, 0) || ' minutes')::INTERVAL;
  
  -- Create automation run
  INSERT INTO automation_runs (
    automation_id, tenant_id, trigger_entity_id, trigger_entity_type, 
    status, scheduled_for, metadata
  ) VALUES (
    p_automation_id, v_automation.tenant_id, p_trigger_entity_id, p_trigger_entity_type,
    'scheduled', v_schedule_time, p_metadata
  ) RETURNING id INTO v_run_id;
  
  -- Update automation stats
  UPDATE email_automations SET total_runs = total_runs + 1 WHERE id = p_automation_id;
  
  RETURN v_run_id;
END;
$$;

-- 16. Enable realtime for automation_runs
ALTER PUBLICATION supabase_realtime ADD TABLE automation_runs;

-- AI Feedback table - stores user feedback on AI generations
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.ai_generated_content(id) ON DELETE SET NULL,
  user_id UUID,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'edit')),
  original_content TEXT,
  edited_content TEXT,
  edit_reason TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  content_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Learning Patterns table - learned preferences per tenant
CREATE TABLE public.ai_learning_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  learned_value JSONB NOT NULL DEFAULT '{}',
  confidence_score DECIMAL(3,2) DEFAULT 0.3,
  sample_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, pattern_type)
);

-- AI Action Suggestions table - proactive AI suggestions
CREATE TABLE public.ai_action_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('purchase_order', 'marketing_campaign', 'price_change', 'stock_alert', 'customer_winback', 'supplier_order', 'promotion')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  reasoning TEXT,
  action_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'modified', 'rejected', 'executed', 'expired')),
  user_modifications JSONB,
  notification_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Content Edits table - track specific edits for learning
CREATE TABLE public.ai_content_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES public.ai_generated_content(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES public.ai_feedback(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  edit_type TEXT NOT NULL,
  field_changed TEXT,
  before_value TEXT,
  after_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_content_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_feedback
CREATE POLICY "Users can view their tenant's feedback" ON public.ai_feedback
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create feedback for their tenant" ON public.ai_feedback
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for ai_learning_patterns
CREATE POLICY "Users can view their tenant's patterns" ON public.ai_learning_patterns
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage their tenant's patterns" ON public.ai_learning_patterns
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for ai_action_suggestions
CREATE POLICY "Users can view their tenant's suggestions" ON public.ai_action_suggestions
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage their tenant's suggestions" ON public.ai_action_suggestions
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for ai_content_edits
CREATE POLICY "Users can view their tenant's edits" ON public.ai_content_edits
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create edits for their tenant" ON public.ai_content_edits
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Function to update learning patterns based on feedback
CREATE OR REPLACE FUNCTION public.update_ai_learning_pattern(
  p_tenant_id UUID,
  p_pattern_type TEXT,
  p_learned_value JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO ai_learning_patterns (tenant_id, pattern_type, learned_value, sample_count, confidence_score)
  VALUES (p_tenant_id, p_pattern_type, p_learned_value, 1, 0.3)
  ON CONFLICT (tenant_id, pattern_type) DO UPDATE
  SET 
    learned_value = ai_learning_patterns.learned_value || p_learned_value,
    sample_count = ai_learning_patterns.sample_count + 1,
    confidence_score = CASE 
      WHEN ai_learning_patterns.sample_count + 1 > 10 THEN 0.9
      WHEN ai_learning_patterns.sample_count + 1 > 5 THEN 0.7
      WHEN ai_learning_patterns.sample_count + 1 > 2 THEN 0.5
      ELSE 0.3
    END,
    last_updated_at = now();
END;
$$;

-- Indexes for performance
CREATE INDEX idx_ai_feedback_tenant ON public.ai_feedback(tenant_id);
CREATE INDEX idx_ai_feedback_content ON public.ai_feedback(content_id);
CREATE INDEX idx_ai_learning_patterns_tenant ON public.ai_learning_patterns(tenant_id);
CREATE INDEX idx_ai_action_suggestions_tenant_status ON public.ai_action_suggestions(tenant_id, status);
CREATE INDEX idx_ai_action_suggestions_priority ON public.ai_action_suggestions(priority, status);
CREATE INDEX idx_ai_content_edits_content ON public.ai_content_edits(content_id);

-- Trigger for updated_at on ai_action_suggestions
CREATE TRIGGER update_ai_action_suggestions_updated_at
  BEFORE UPDATE ON public.ai_action_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

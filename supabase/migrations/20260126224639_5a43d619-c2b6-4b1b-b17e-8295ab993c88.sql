-- First create ai_assistant_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Chatbot Settings
  chatbot_enabled BOOLEAN DEFAULT false,
  chatbot_name TEXT DEFAULT 'AI Assistent',
  chatbot_avatar_url TEXT,
  chatbot_welcome_message TEXT DEFAULT 'Hallo! Hoe kan ik je helpen?',
  chatbot_position TEXT DEFAULT 'bottom-right',
  chatbot_theme_color TEXT,
  
  -- Knowledge Base Settings
  knowledge_include_products BOOLEAN DEFAULT true,
  knowledge_include_categories BOOLEAN DEFAULT true,
  knowledge_include_pages BOOLEAN DEFAULT true,
  knowledge_include_legal BOOLEAN DEFAULT true,
  knowledge_include_shipping BOOLEAN DEFAULT true,
  knowledge_custom_instructions TEXT,
  knowledge_forbidden_topics TEXT,
  
  -- Reply Suggestions Settings
  reply_suggestions_enabled BOOLEAN DEFAULT true,
  reply_suggestions_auto_draft BOOLEAN DEFAULT false,
  reply_suggestions_tone TEXT DEFAULT 'professional',
  reply_suggestions_language TEXT DEFAULT 'nl',
  reply_suggestions_for_email BOOLEAN DEFAULT true,
  reply_suggestions_for_whatsapp BOOLEAN DEFAULT true,
  
  -- Web Research Settings (NEW)
  web_research_enabled BOOLEAN DEFAULT false,
  web_research_mode TEXT DEFAULT 'fallback',
  web_research_allowed_topics TEXT[] DEFAULT ARRAY['product_advice', 'general_knowledge'],
  chatbot_feedback_enabled BOOLEAN DEFAULT true,
  
  -- Usage & Limits
  daily_limit INTEGER DEFAULT 100,
  response_delay_ms INTEGER DEFAULT 500,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_knowledge_index table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_knowledge_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  content_summary TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  keywords TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-level learning patterns
CREATE TABLE IF NOT EXISTS public.ai_user_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  learned_value JSONB NOT NULL DEFAULT '{}',
  confidence_score DECIMAL(3,2) DEFAULT 0.30,
  sample_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pattern_type)
);

-- Track repeat behaviors for learning
CREATE TABLE IF NOT EXISTS public.ai_user_behavior_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  behavior_type TEXT NOT NULL,
  behavior_value TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, behavior_type, behavior_value)
);

-- Chatbot conversations with feedback
CREATE TABLE IF NOT EXISTS public.ai_chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 3),
  feedback_comment TEXT,
  feedback_submitted_at TIMESTAMPTZ,
  initial_question TEXT,
  topics_discussed TEXT[],
  web_research_used BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_behavior_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- RLS for ai_assistant_config
CREATE POLICY "Tenant users can view their config" ON public.ai_assistant_config
FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can update config" ON public.ai_assistant_config
FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')));

CREATE POLICY "Service role can manage config" ON public.ai_assistant_config
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS for ai_knowledge_index
CREATE POLICY "Tenant users can view knowledge" ON public.ai_knowledge_index
FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage knowledge" ON public.ai_knowledge_index
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS for ai_user_learning_patterns
CREATE POLICY "Users can view own patterns" ON public.ai_user_learning_patterns
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tenant admins can view tenant patterns" ON public.ai_user_learning_patterns
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('tenant_admin', 'platform_admin'))
  AND tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Service role can manage patterns" ON public.ai_user_learning_patterns
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS for ai_user_behavior_log
CREATE POLICY "Users can view own behavior" ON public.ai_user_behavior_log
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage behavior" ON public.ai_user_behavior_log
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS for ai_chatbot_conversations
CREATE POLICY "Anyone can insert conversations" ON public.ai_chatbot_conversations
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update conversations" ON public.ai_chatbot_conversations
FOR UPDATE USING (true);

CREATE POLICY "Tenant users can view conversations" ON public.ai_chatbot_conversations
FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_assistant_config_tenant ON public.ai_assistant_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tenant ON public.ai_knowledge_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_source ON public.ai_knowledge_index(tenant_id, source_type);
CREATE INDEX IF NOT EXISTS idx_ai_user_patterns_user ON public.ai_user_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_patterns_tenant ON public.ai_user_learning_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_behavior_user ON public.ai_user_behavior_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chatbot_tenant ON public.ai_chatbot_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_chatbot_session ON public.ai_chatbot_conversations(session_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_ai_assistant_config_updated_at ON public.ai_assistant_config;
CREATE TRIGGER update_ai_assistant_config_updated_at
  BEFORE UPDATE ON public.ai_assistant_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_knowledge_index_updated_at ON public.ai_knowledge_index;
CREATE TRIGGER update_ai_knowledge_index_updated_at
  BEFORE UPDATE ON public.ai_knowledge_index
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_user_learning_patterns_updated_at ON public.ai_user_learning_patterns;
CREATE TRIGGER update_ai_user_learning_patterns_updated_at
  BEFORE UPDATE ON public.ai_user_learning_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper functions
CREATE OR REPLACE FUNCTION public.track_user_behavior(
  p_user_id UUID,
  p_tenant_id UUID,
  p_behavior_type TEXT,
  p_behavior_value TEXT
)
RETURNS TABLE(occurrence_count INTEGER, should_learn BOOLEAN, should_auto_apply BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_user_behavior_log (user_id, tenant_id, behavior_type, behavior_value)
  VALUES (p_user_id, p_tenant_id, p_behavior_type, p_behavior_value)
  ON CONFLICT (user_id, behavior_type, behavior_value) DO UPDATE
  SET occurrence_count = ai_user_behavior_log.occurrence_count + 1, last_seen_at = now()
  RETURNING ai_user_behavior_log.occurrence_count INTO v_count;
  
  RETURN QUERY SELECT v_count, v_count >= 3, v_count >= 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_learning_pattern(
  p_user_id UUID,
  p_tenant_id UUID,
  p_pattern_type TEXT,
  p_learned_value JSONB,
  p_sample_count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_user_learning_patterns (user_id, tenant_id, pattern_type, learned_value, sample_count, confidence_score)
  VALUES (p_user_id, p_tenant_id, p_pattern_type, p_learned_value, p_sample_count, 
    CASE WHEN p_sample_count >= 5 THEN 0.9 WHEN p_sample_count >= 3 THEN 0.7 ELSE 0.3 END)
  ON CONFLICT (user_id, pattern_type) DO UPDATE
  SET learned_value = ai_user_learning_patterns.learned_value || p_learned_value,
      sample_count = ai_user_learning_patterns.sample_count + p_sample_count,
      confidence_score = CASE 
        WHEN ai_user_learning_patterns.sample_count + p_sample_count >= 5 THEN 0.9
        WHEN ai_user_learning_patterns.sample_count + p_sample_count >= 3 THEN 0.7
        ELSE LEAST(ai_user_learning_patterns.confidence_score + 0.1, 1.0) END,
      last_updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_ai_assistant_config(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config_id UUID;
BEGIN
  INSERT INTO public.ai_assistant_config (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING
  RETURNING id INTO v_config_id;
  
  IF v_config_id IS NULL THEN
    SELECT id INTO v_config_id FROM public.ai_assistant_config WHERE tenant_id = p_tenant_id;
  END IF;
  
  RETURN v_config_id;
END;
$$;
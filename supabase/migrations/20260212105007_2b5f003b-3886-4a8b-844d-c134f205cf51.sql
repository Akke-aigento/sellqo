
-- AI Help Conversations
CREATE TABLE public.ai_help_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_route TEXT,
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_help_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own help conversations"
  ON public.ai_help_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own help conversations"
  ON public.ai_help_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own help conversations"
  ON public.ai_help_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Help Unanswered Questions
CREATE TABLE public.ai_help_unanswered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  current_route TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.ai_help_unanswered ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert unanswered questions"
  ON public.ai_help_unanswered FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Platform admins can read unanswered questions"
  ON public.ai_help_unanswered FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update unanswered questions"
  ON public.ai_help_unanswered FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Use AI credits function for help assistant
CREATE OR REPLACE FUNCTION public.use_ai_help_credit(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INT;
BEGIN
  SELECT (credits_total + credits_purchased - credits_used) INTO v_available
  FROM tenant_ai_credits WHERE tenant_id = p_tenant_id;
  
  IF v_available IS NULL OR v_available < 1 THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + 1, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  INSERT INTO ai_usage_log (tenant_id, feature, credits_used)
  VALUES (p_tenant_id, 'help_assistant', 1);
  
  RETURN TRUE;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_ai_help_conversations_updated_at
  BEFORE UPDATE ON public.ai_help_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

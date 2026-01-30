-- Create table for caching AI reply suggestions
CREATE TABLE public.ai_reply_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  message_id UUID REFERENCES public.customer_messages(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  regenerated_at TIMESTAMP WITH TIME ZONE,
  
  -- Only one suggestion per message
  CONSTRAINT unique_suggestion_per_message UNIQUE (tenant_id, conversation_id, message_id)
);

-- Enable RLS
ALTER TABLE public.ai_reply_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their tenant's suggestions
CREATE POLICY "Users can view their tenant's suggestions"
ON public.ai_reply_suggestions
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert suggestions for their tenant"
ON public.ai_reply_suggestions
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their tenant's suggestions"
ON public.ai_reply_suggestions
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their tenant's suggestions"
ON public.ai_reply_suggestions
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Service role policy for edge functions
CREATE POLICY "Service role can manage all suggestions"
ON public.ai_reply_suggestions
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_ai_reply_suggestions_lookup 
ON public.ai_reply_suggestions(tenant_id, conversation_id, message_id);
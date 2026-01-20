-- AI Credits tracking per tenant
CREATE TABLE public.tenant_ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credits_total INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_purchased INTEGER NOT NULL DEFAULT 0,
  credits_reset_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_ai_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_roles table
CREATE POLICY "Users can view their tenant AI credits"
ON public.tenant_ai_credits FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant AI credits"
ON public.tenant_ai_credits FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- AI Usage log for analytics and billing
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  prompt_summary TEXT,
  result_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant AI usage"
ON public.ai_usage_log FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "System can insert AI usage logs"
ON public.ai_usage_log FOR INSERT
WITH CHECK (true);

-- AI Generated content storage
CREATE TABLE public.ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  platform TEXT,
  title TEXT,
  content_text TEXT,
  html_content TEXT,
  image_urls TEXT[] DEFAULT '{}',
  product_ids UUID[] DEFAULT '{}',
  segment_id UUID REFERENCES public.customer_segments(id),
  metadata JSONB DEFAULT '{}',
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant AI content"
ON public.ai_generated_content FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert AI content for their tenant"
ON public.ai_generated_content FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant AI content"
ON public.ai_generated_content FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant AI content"
ON public.ai_generated_content FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Add AI credits to pricing plans
ALTER TABLE public.pricing_plans 
ADD COLUMN IF NOT EXISTS ai_credits_monthly INTEGER DEFAULT 0;

-- Function to check and deduct AI credits
CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id UUID,
  p_credits INTEGER,
  p_feature TEXT,
  p_model TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT (credits_total + credits_purchased - credits_used)
  INTO v_available
  FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  IF v_available IS NULL THEN
    INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_used)
    VALUES (p_tenant_id, 0, 0);
    v_available := 0;
  END IF;
  
  IF v_available < p_credits THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
  VALUES (p_tenant_id, p_feature, p_credits, p_model, p_metadata);
  
  RETURN TRUE;
END;
$$;

-- Function to add purchased credits
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  p_tenant_id UUID,
  p_credits INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_ai_credits (tenant_id, credits_purchased, last_purchase_at)
  VALUES (p_tenant_id, p_credits, now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET credits_purchased = tenant_ai_credits.credits_purchased + p_credits,
      last_purchase_at = now(),
      updated_at = now();
END;
$$;

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION public.reset_monthly_ai_credits(
  p_tenant_id UUID,
  p_monthly_credits INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_used, credits_reset_at)
  VALUES (p_tenant_id, p_monthly_credits, 0, now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET credits_total = p_monthly_credits,
      credits_used = 0,
      credits_reset_at = now(),
      updated_at = now();
END;
$$;

-- Trigger for updated_at using existing function
CREATE TRIGGER update_tenant_ai_credits_updated_at
BEFORE UPDATE ON public.tenant_ai_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_ai_generated_content_updated_at
BEFORE UPDATE ON public.ai_generated_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
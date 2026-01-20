-- Fix the overly permissive INSERT policy on ai_usage_log
-- This policy was intentionally permissive because inserts happen from edge functions
-- We'll restrict it to authenticated users only

DROP POLICY IF EXISTS "System can insert AI usage logs" ON public.ai_usage_log;

CREATE POLICY "Authenticated users can insert AI usage logs"
ON public.ai_usage_log FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Also add service role access for edge functions
CREATE POLICY "Service role can insert AI usage logs"
ON public.ai_usage_log FOR INSERT
TO service_role
WITH CHECK (true);
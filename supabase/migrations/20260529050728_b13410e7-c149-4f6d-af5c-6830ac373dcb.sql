-- Phase 1, Batch 1A: high-risk + zero-impact RLS hardening

-- #17 tenant_transaction_usage: drop the public USING(true) ALL policy.
-- service_role bypasses RLS by default; legitimate writers (edge functions) use service_role.
-- Existing tenant-admin SELECT and platform-admin SELECT policies stay intact.
DROP POLICY IF EXISTS "System can insert/update transaction usage" ON public.tenant_transaction_usage;

-- RLS-disabled tables: enable RLS, no policies => only service_role can access.
ALTER TABLE public.shopify_dates_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_snapshot_pre_reconcile_20260430 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_snapshot_pre_reconcile_final ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shopify_dates_staging FROM anon, authenticated;
REVOKE ALL ON public.stock_snapshot_pre_reconcile_20260430 FROM anon, authenticated;
REVOKE ALL ON public.stock_snapshot_pre_reconcile_final FROM anon, authenticated;
GRANT ALL ON public.shopify_dates_staging TO service_role;
GRANT ALL ON public.stock_snapshot_pre_reconcile_20260430 TO service_role;
GRANT ALL ON public.stock_snapshot_pre_reconcile_final TO service_role;

-- Twijfel case 1: ai_chatbot_conversations UPDATE -> authenticated tenant-scoped only.
-- Bot-driven updates go via edge function + service_role (bypasses RLS).
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.ai_chatbot_conversations;

CREATE POLICY "Tenant users can update conversations"
ON public.ai_chatbot_conversations
FOR UPDATE
TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
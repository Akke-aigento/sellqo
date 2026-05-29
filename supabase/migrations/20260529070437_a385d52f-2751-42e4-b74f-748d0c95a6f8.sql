-- Batch 1B: anon-bounding & gateway-only writes
-- ============================================================

-- 1) ai_chatbot_conversations.INSERT
-- Behoud anon-INSERT maar bound op actieve tenants + verplicht session_id
DROP POLICY IF EXISTS "Anyone can insert conversations" ON public.ai_chatbot_conversations;

CREATE POLICY "Anon can insert conversations for active tenants"
ON public.ai_chatbot_conversations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id IS NOT NULL
  AND tenant_id IN (
    SELECT id FROM public.tenants
    WHERE subscription_status IN ('active', 'trial')
  )
);

-- 2) customer_events.INSERT
-- Drop anon-INSERT volledig; alle tracking loopt via track-storefront-event edge function (service_role).
DROP POLICY IF EXISTS "Anon can insert events" ON public.customer_events;
DROP POLICY IF EXISTS "Service role can insert events" ON public.customer_events;
REVOKE INSERT ON public.customer_events FROM anon;

-- service_role bypasst RLS, geen expliciete policy nodig. Authenticated/admin lezen via bestaande SELECT-policy.

-- 3) customer_message_attachments.INSERT
-- Drop open INSERT-policy; gateway (handle-inbound-email) gebruikt service_role.
DROP POLICY IF EXISTS "Service can insert attachments" ON public.customer_message_attachments;
REVOKE INSERT ON public.customer_message_attachments FROM anon;
REVOKE INSERT ON public.customer_message_attachments FROM authenticated;

-- 4) storefront_favorites
-- Drop overbodige USING(true) ALL-policy; service_role bypasst RLS. Tabel heeft 0 rows in productie.
-- Edge function bestaat al voor toekomstige reads/writes.
DROP POLICY IF EXISTS "Service role full access on storefront_favorites" ON public.storefront_favorites;
REVOKE ALL ON public.storefront_favorites FROM anon;
REVOKE ALL ON public.storefront_favorites FROM authenticated;
GRANT ALL ON public.storefront_favorites TO service_role;

-- 5) channel_field_mappings - cosmetisch: SELECT true blijft (globale reference data),
-- maar zorg dat anon geen toegang heeft (auth-only ref data).
REVOKE ALL ON public.channel_field_mappings FROM anon;

-- 1. Add is_pinned and snoozed_until to customer_messages
ALTER TABLE public.customer_messages 
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz DEFAULT NULL;

-- Index for pinned messages
CREATE INDEX IF NOT EXISTS idx_customer_messages_pinned ON public.customer_messages (tenant_id, is_pinned) WHERE is_pinned = true;

-- Index for snoozed messages
CREATE INDEX IF NOT EXISTS idx_customer_messages_snoozed ON public.customer_messages (tenant_id, snoozed_until) WHERE snoozed_until IS NOT NULL;

-- 2. Create message_templates table for canned responses
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  channel text DEFAULT 'all',
  shortcut text DEFAULT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view message templates for their tenants"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can create message templates for their tenants"
  ON public.message_templates FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can update message templates for their tenants"
  ON public.message_templates FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can delete message templates for their tenants"
  ON public.message_templates FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

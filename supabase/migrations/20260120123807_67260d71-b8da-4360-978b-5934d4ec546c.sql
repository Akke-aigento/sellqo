-- Create customer_messages table for tracking all communication with customers
CREATE TABLE public.customer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  reply_to_email TEXT,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'delivered', 'opened', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  context_type TEXT CHECK (context_type IN ('order', 'quote', 'general')),
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_customer_messages_tenant_id ON public.customer_messages(tenant_id);
CREATE INDEX idx_customer_messages_customer_id ON public.customer_messages(customer_id);
CREATE INDEX idx_customer_messages_order_id ON public.customer_messages(order_id);
CREATE INDEX idx_customer_messages_quote_id ON public.customer_messages(quote_id);
CREATE INDEX idx_customer_messages_status ON public.customer_messages(status);
CREATE INDEX idx_customer_messages_created_at ON public.customer_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view messages for their tenant"
  ON public.customer_messages
  FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create messages for their tenant"
  ON public.customer_messages
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update messages for their tenant"
  ON public.customer_messages
  FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete messages for their tenant"
  ON public.customer_messages
  FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_customer_messages_updated_at
  BEFORE UPDATE ON public.customer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
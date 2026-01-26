-- Track wanneer merchant een bericht heeft gelezen
ALTER TABLE public.customer_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_by UUID REFERENCES auth.users(id);

-- Track of bericht beantwoord is (voor inbound berichten)
ALTER TABLE public.customer_messages
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_message_id UUID REFERENCES public.customer_messages(id);

-- Index voor snelle queries op ongelezen berichten
CREATE INDEX IF NOT EXISTS idx_customer_messages_unread 
  ON public.customer_messages(tenant_id, direction, read_at) 
  WHERE direction = 'inbound' AND read_at IS NULL;

-- Index voor channel filtering
CREATE INDEX IF NOT EXISTS idx_customer_messages_channel 
  ON public.customer_messages(tenant_id, channel);

-- Index voor conversatie groepering
CREATE INDEX IF NOT EXISTS idx_customer_messages_conversation 
  ON public.customer_messages(tenant_id, customer_id, created_at DESC);

-- Enable realtime voor customer_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_messages;
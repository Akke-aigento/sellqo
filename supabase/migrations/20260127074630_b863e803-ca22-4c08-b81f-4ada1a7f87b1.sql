-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create attachments table
CREATE TABLE IF NOT EXISTS public.customer_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.customer_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policy: Tenant members can view attachments
CREATE POLICY "Tenant members can view attachments"
  ON public.customer_message_attachments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS policy: Service role can insert attachments (for edge functions)
CREATE POLICY "Service can insert attachments"
  ON public.customer_message_attachments FOR INSERT
  WITH CHECK (true);

-- Storage policies for message-attachments bucket
CREATE POLICY "Tenant members can read attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'message-attachments');

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_message_attachments_message_id 
  ON public.customer_message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_customer_message_attachments_tenant_id 
  ON public.customer_message_attachments(tenant_id);
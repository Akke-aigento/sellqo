-- Extend allowed values for customer_messages.context_type to include 'contact_form'
ALTER TABLE public.customer_messages
  DROP CONSTRAINT IF EXISTS customer_messages_context_type_check;

ALTER TABLE public.customer_messages
  ADD CONSTRAINT customer_messages_context_type_check
  CHECK (context_type = ANY (ARRAY['order'::text, 'quote'::text, 'general'::text, 'contact_form'::text]));
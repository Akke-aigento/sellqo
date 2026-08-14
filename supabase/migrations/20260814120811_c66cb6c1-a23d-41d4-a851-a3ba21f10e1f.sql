-- TICKET-1 fase 4b: trigger_type 'ticket_delivery' toevoegen (idempotent).
-- Terugdraaien: DELETE FROM public.customer_communication_settings WHERE trigger_type = 'ticket_delivery';
INSERT INTO public.customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours, delay_days)
SELECT t.id, 'ticket_delivery', 'orders', true, false, 0, 0
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_communication_settings s
  WHERE s.tenant_id = t.id AND s.trigger_type = 'ticket_delivery'
);
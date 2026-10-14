-- TICKET-MAIL-1 — ticketmail ook na handmatig "betaald" (overschrijving, bankafstemming,
-- bulkactie) en een knop om tickets opnieuw te mailen. Strikt additief.
--
-- ticket_mail_log is de claim: wie de rij als eerste aanmaakt, verstuurt. Zo krijgt een
-- klant nooit twee keer dezelfde mail, ook niet als de Stripe-webhook en deze trigger
-- tegelijk vuren. Opnieuw mailen (admin) werkt de rij bij in plaats van te claimen.

CREATE TABLE IF NOT EXISTS public.ticket_mail_log (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_sent_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1,
  last_source text NOT NULL DEFAULT 'auto'
);
CREATE INDEX IF NOT EXISTS idx_ticket_mail_log_tenant ON public.ticket_mail_log (tenant_id);

ALTER TABLE public.ticket_mail_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ticket_mail_log TO authenticated;
GRANT ALL ON public.ticket_mail_log TO service_role;
DROP POLICY IF EXISTS ticket_mail_log_select_tenant ON public.ticket_mail_log;
CREATE POLICY ticket_mail_log_select_tenant ON public.ticket_mail_log FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

-- Bestaande ticketbestellingen: als verstuurd markeren op hun eigen besteldatum
-- (vaste waarde, geen now()), zodat de admin geen "nog niet verstuurd" toont voor oude mails.
INSERT INTO public.ticket_mail_log (order_id, tenant_id, first_sent_at, last_sent_at, send_count, last_source)
SELECT o.id, o.tenant_id, o.created_at, o.created_at, 1, 'backfill'
FROM public.orders o
WHERE o.created_at < '2026-10-14 17:00:00+00'
  AND (EXISTS (SELECT 1 FROM public.ticket_instances ti WHERE ti.order_id = o.id)
       OR EXISTS (SELECT 1 FROM public.token_wallets w WHERE w.order_id = o.id))
ON CONFLICT (order_id) DO NOTHING;

-- Na "betaald": ticketmail versturen als de bestelling tickets of munten heeft en er nog
-- geen mail ging. Draait na trg_issue_tickets_on_paid (triggers lopen alfabetisch), dus de
-- tickets en de muntenkaart bestaan al. pg_net vertrekt pas na de commit.
CREATE OR REPLACE FUNCTION public.ticket_mail_on_paid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_anon text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticket_mail_log WHERE order_id = NEW.id) THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ticket_instances WHERE order_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM public.token_wallets WHERE order_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  SELECT value INTO v_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_anon FROM public.internal_config WHERE key = 'supabase_anon_key';
  IF v_url IS NULL OR v_anon IS NULL THEN RETURN NULL; END IF;
  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-ticket-confirmation',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
    body := jsonb_build_object('order_id', NEW.id, 'auto', true),
    timeout_milliseconds := 30000
  );
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'ticket_mail_on_paid failed for order %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_mail_on_paid ON public.orders;
CREATE TRIGGER trg_ticket_mail_on_paid AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid'::payment_status AND OLD.payment_status IS DISTINCT FROM 'paid'::payment_status)
  EXECUTE FUNCTION public.ticket_mail_on_paid();

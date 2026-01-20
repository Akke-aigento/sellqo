-- =============================================
-- FASE 4: FACTUUR & ABONNEMENT NOTIFICATIES
-- =============================================

-- =============================================
-- DEEL A: FACTUUR NOTIFICATIES
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_action_url := '/admin/invoices?invoice=' || NEW.id;
  
  -- Haal klantnaam op indien beschikbaar
  IF NEW.customer_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
      company_name,
      email
    ) INTO v_customer_name
    FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  v_customer_name := COALESCE(v_customer_name, 'Onbekende klant');
  
  -- NIEUWE FACTUUR
  IF TG_OP = 'INSERT' THEN
    v_type := 'invoice_created';
    v_title := 'Nieuwe factuur: ' || NEW.invoice_number;
    v_message := 'Factuur ' || NEW.invoice_number || ' voor ' || v_customer_name || ' (€' || ROUND(NEW.total::numeric, 2) || ')';
    v_priority := 'low';
    
  -- FACTUUR VERZONDEN
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.sent_at IS NOT NULL 
        AND OLD.sent_at IS NULL THEN
    v_type := 'invoice_sent';
    v_title := 'Factuur verzonden: ' || NEW.invoice_number;
    v_message := 'Factuur ' || NEW.invoice_number || ' is verzonden naar ' || v_customer_name;
    v_priority := 'low';
    
  -- FACTUUR BETAALD
  ELSIF TG_OP = 'UPDATE' 
        AND ((NEW.status = 'paid' AND OLD.status != 'paid')
            OR (NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL)) THEN
    v_type := 'invoice_paid';
    v_title := 'Factuur betaald: ' || NEW.invoice_number;
    v_message := 'Factuur ' || NEW.invoice_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is betaald door ' || v_customer_name;
    v_priority := 'medium';
    
  -- PEPPOL GEACCEPTEERD
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.peppol_status = 'accepted' 
        AND (OLD.peppol_status IS NULL OR OLD.peppol_status != 'accepted') THEN
    v_type := 'peppol_invoice_accepted';
    v_title := 'Peppol geaccepteerd: ' || NEW.invoice_number;
    v_message := 'Peppol factuur ' || NEW.invoice_number || ' is succesvol geaccepteerd';
    v_priority := 'low';
    
  -- PEPPOL AFGEWEZEN
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.peppol_status = 'rejected' 
        AND (OLD.peppol_status IS NULL OR OLD.peppol_status != 'rejected') THEN
    v_type := 'peppol_invoice_rejected';
    v_title := 'Peppol afgewezen: ' || NEW.invoice_number;
    v_message := 'Peppol factuur ' || NEW.invoice_number || ' is afgewezen - actie vereist';
    v_priority := 'high';
    
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.send_notification(
    NEW.tenant_id,
    'invoices',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'customer_name', v_customer_name,
      'total', NEW.total,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger voor facturen
CREATE TRIGGER trigger_invoice_notification
  AFTER INSERT OR UPDATE OF status, sent_at, paid_at, peppol_status
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_notification();

-- =============================================
-- DEEL B: ABONNEMENT NOTIFICATIES
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_subscription_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_action_url := '/admin/subscriptions';
  
  -- Haal klantnaam op
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    company_name,
    email
  ) INTO v_customer_name
  FROM public.customers WHERE id = NEW.customer_id;
  v_customer_name := COALESCE(v_customer_name, 'Onbekende klant');
  
  -- NIEUW ABONNEMENT
  IF TG_OP = 'INSERT' THEN
    v_type := 'subscription_new';
    v_title := 'Nieuw abonnement: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" voor ' || v_customer_name || ' (€' || ROUND(NEW.total::numeric, 2) || '/' || NEW.interval || ')';
    v_priority := 'medium';
    
  -- ABONNEMENT OPGEZEGD
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.status = 'cancelled' 
        AND OLD.status != 'cancelled' THEN
    v_type := 'subscription_cancelled';
    v_title := 'Abonnement opgezegd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is opgezegd';
    v_priority := 'high';
    
  -- ABONNEMENT GEPAUZEERD
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.status = 'paused' 
        AND OLD.status != 'paused' THEN
    v_type := 'subscription_paused';
    v_title := 'Abonnement gepauzeerd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is gepauzeerd';
    v_priority := 'medium';
    
  -- ABONNEMENT VERLENGD (next_invoice_date schuift op na facturatie)
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.next_invoice_date > OLD.next_invoice_date 
        AND NEW.status = 'active' THEN
    v_type := 'subscription_renewed';
    v_title := 'Abonnement verlengd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is verlengd tot ' || to_char(NEW.next_invoice_date, 'DD-MM-YYYY');
    v_priority := 'low';
    
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.send_notification(
    NEW.tenant_id,
    'subscriptions',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'subscription_id', NEW.id,
      'subscription_name', NEW.name,
      'customer_name', v_customer_name,
      'total', NEW.total,
      'interval', NEW.interval,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger voor abonnementen
CREATE TRIGGER trigger_subscription_notification
  AFTER INSERT OR UPDATE OF status, next_invoice_date
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_notification();
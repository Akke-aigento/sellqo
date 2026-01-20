-- =====================================================
-- FASE 3: KLANT & QUOTE NOTIFICATIES
-- Automatische triggers voor customers en quotes
-- =====================================================

-- =====================================================
-- KLANT NOTIFICATIES
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_customer_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_customer_name := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''),
    NEW.company_name,
    NEW.email
  );
  v_action_url := '/admin/customers/' || NEW.id;
  
  -- NIEUWE KLANT
  IF TG_OP = 'INSERT' THEN
    v_type := 'customer_new';
    v_title := 'Nieuwe klant: ' || v_customer_name;
    v_message := 'Klant ' || v_customer_name || ' (' || NEW.email || ') is geregistreerd';
    v_priority := 'low';
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'customers',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object(
        'customer_id', NEW.id,
        'customer_name', v_customer_name,
        'email', NEW.email,
        'customer_type', NEW.customer_type
      )
    );
    
  -- VIP KLANT: total_spent overschrijdt €1000
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.total_spent >= 1000 
        AND (OLD.total_spent IS NULL OR OLD.total_spent < 1000) THEN
    v_type := 'customer_vip';
    v_title := 'VIP klant: ' || v_customer_name;
    v_message := 'Klant ' || v_customer_name || ' heeft €' || ROUND(NEW.total_spent::numeric, 2) || ' besteed en is nu VIP';
    v_priority := 'medium';
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'customers',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object(
        'customer_id', NEW.id,
        'customer_name', v_customer_name,
        'total_spent', NEW.total_spent,
        'total_orders', NEW.total_orders
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger op customers tabel
DROP TRIGGER IF EXISTS trigger_customer_notification ON public.customers;
CREATE TRIGGER trigger_customer_notification
  AFTER INSERT OR UPDATE OF total_spent ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_notification();

-- =====================================================
-- QUOTE NOTIFICATIES
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_quote_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_action_url := '/admin/quotes/' || NEW.id;
  
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
  
  -- NIEUWE OFFERTE
  IF TG_OP = 'INSERT' THEN
    v_type := 'quote_new';
    v_title := 'Nieuwe offerte: ' || NEW.quote_number;
    v_message := 'Offerte ' || NEW.quote_number || ' voor ' || v_customer_name || ' (€' || ROUND(NEW.total::numeric, 2) || ')';
    v_priority := 'low';
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'quotes',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object(
        'quote_id', NEW.id,
        'quote_number', NEW.quote_number,
        'customer_name', v_customer_name,
        'total', NEW.total
      )
    );
    
  -- STATUS WIJZIGINGEN
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'accepted' THEN
        v_type := 'quote_accepted';
        v_title := 'Offerte geaccepteerd: ' || NEW.quote_number;
        v_message := 'Offerte ' || NEW.quote_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is geaccepteerd door ' || v_customer_name;
        v_priority := 'high';
        
      WHEN 'rejected' THEN
        v_type := 'quote_rejected';
        v_title := 'Offerte afgewezen: ' || NEW.quote_number;
        v_message := 'Offerte ' || NEW.quote_number || ' is afgewezen door ' || v_customer_name;
        v_priority := 'medium';
        
      WHEN 'expired' THEN
        v_type := 'quote_expired';
        v_title := 'Offerte verlopen: ' || NEW.quote_number;
        v_message := 'Offerte ' || NEW.quote_number || ' voor ' || v_customer_name || ' is verlopen';
        v_priority := 'medium';
        
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'quotes',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object(
        'quote_id', NEW.id,
        'quote_number', NEW.quote_number,
        'customer_name', v_customer_name,
        'total', NEW.total,
        'previous_status', OLD.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger op quotes tabel
DROP TRIGGER IF EXISTS trigger_quote_notification ON public.quotes;
CREATE TRIGGER trigger_quote_notification
  AFTER INSERT OR UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_quote_notification();
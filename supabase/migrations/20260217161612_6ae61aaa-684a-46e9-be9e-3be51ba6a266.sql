
CREATE OR REPLACE FUNCTION public.handle_quote_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_action_url := '/admin/quotes/' || NEW.id;
  
  IF NEW.customer_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
      company_name,
      email
    ) INTO v_customer_name
    FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  v_customer_name := COALESCE(v_customer_name, 'Onbekende klant');
  
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
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'accepted' THEN
        v_type := 'quote_accepted';
        v_title := 'Offerte geaccepteerd: ' || NEW.quote_number;
        v_message := 'Offerte ' || NEW.quote_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is geaccepteerd door ' || v_customer_name;
        v_priority := 'high';
        
      WHEN 'declined' THEN
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
$function$;

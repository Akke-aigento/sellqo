
-- Stap 1: Functie vervangen - notificaties alleen bij betaalde bestellingen
CREATE OR REPLACE FUNCTION public.handle_order_notification()
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
BEGIN
  v_action_url := '/admin/orders/' || NEW.id;

  -- Nieuwe bestelling: alleen notificatie als payment_status = 'paid'
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'paid')
     OR (TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid') THEN
    
    v_type := 'order_new';
    v_title := 'Nieuwe bestelling: ' || NEW.order_number;
    v_message := 'Bestelling ' || NEW.order_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is ontvangen';
    v_priority := 'medium';
    
    -- High value order (> €500)
    IF NEW.total > 500 THEN
      PERFORM public.send_notification(
        NEW.tenant_id,
        'orders',
        'order_high_value',
        'Grote bestelling ontvangen: ' || NEW.order_number,
        'Bestelling ' || NEW.order_number || ' heeft een waarde van €' || ROUND(NEW.total::numeric, 2),
        'high',
        v_action_url,
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total)
      );
    END IF;
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'orders',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total)
    );
    
  -- Order status updates (cancelled, shipped, delivered) blijven werken zoals voorheen
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'cancelled' THEN
        v_type := 'order_cancelled';
        v_title := 'Bestelling geannuleerd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is geannuleerd';
        v_priority := 'high';
        
      WHEN 'shipped' THEN
        v_type := 'order_shipped';
        v_title := 'Bestelling verzonden: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is verzonden';
        v_priority := 'low';
        
      WHEN 'delivered' THEN
        v_type := 'order_delivered';
        v_title := 'Bestelling afgeleverd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is succesvol afgeleverd';
        v_priority := 'low';
        
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM public.send_notification(
      NEW.tenant_id,
      'orders',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status, 'previous_status', OLD.status)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Stap 2: Trigger opnieuw aanmaken voor INSERT OR UPDATE
DROP TRIGGER IF EXISTS on_order_notification ON public.orders;
CREATE TRIGGER on_order_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_notification();

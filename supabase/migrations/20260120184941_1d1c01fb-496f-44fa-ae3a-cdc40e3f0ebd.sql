-- Enable pg_net extension for HTTP calls from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper function to send notifications from database triggers
CREATE OR REPLACE FUNCTION public.send_notification(
  p_tenant_id UUID,
  p_category TEXT,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_action_url TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get environment variables (these are set in vault)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, try direct insert to notifications table
  INSERT INTO public.notifications (
    tenant_id,
    category,
    type,
    title,
    message,
    priority,
    action_url,
    data
  ) VALUES (
    p_tenant_id,
    p_category,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_action_url,
    p_data
  );
END;
$$;

-- Trigger function for order status changes
CREATE OR REPLACE FUNCTION public.handle_order_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
BEGIN
  v_action_url := '/admin/orders/' || NEW.id;

  -- New order created
  IF TG_OP = 'INSERT' THEN
    v_type := 'order_new';
    v_title := 'Nieuwe bestelling: ' || NEW.order_number;
    v_message := 'Bestelling ' || NEW.order_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is ontvangen';
    v_priority := 'medium';
    
    -- Check for high value order (> €500)
    IF NEW.total > 500 THEN
      -- Also send high value notification
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
    
  -- Order status updated
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
        -- Don't send notification for other status changes
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
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_order_notification ON public.orders;
CREATE TRIGGER trigger_order_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_notification();

-- Trigger function for payment status changes
CREATE OR REPLACE FUNCTION public.handle_payment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger on payment_status changes
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    CASE NEW.payment_status
      WHEN 'paid' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'payments',
          'order_paid',
          'Betaling ontvangen: ' || NEW.order_number,
          'Betaling van €' || ROUND(NEW.total::numeric, 2) || ' voor bestelling ' || NEW.order_number || ' is ontvangen',
          'medium',
          '/admin/orders/' || NEW.id,
          jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total)
        );
        
      WHEN 'failed' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'payments',
          'order_payment_failed',
          'Betaling mislukt: ' || NEW.order_number,
          'De betaling voor bestelling ' || NEW.order_number || ' is mislukt',
          'urgent',
          '/admin/orders/' || NEW.id,
          jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total)
        );
        
      WHEN 'refunded' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'payments',
          'order_refunded',
          'Terugbetaling verwerkt: ' || NEW.order_number,
          'Terugbetaling van €' || ROUND(NEW.total::numeric, 2) || ' voor bestelling ' || NEW.order_number || ' is verwerkt',
          'medium',
          '/admin/orders/' || NEW.id,
          jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total)
        );
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payment status changes
DROP TRIGGER IF EXISTS trigger_payment_notification ON public.orders;
CREATE TRIGGER trigger_payment_notification
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_notification();
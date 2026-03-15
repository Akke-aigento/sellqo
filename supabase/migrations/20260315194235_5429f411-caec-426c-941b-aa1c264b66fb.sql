
-- Fix 1: Remove 'paid' case from handle_payment_notification to prevent duplicate emails
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
      -- 'paid' case REMOVED: handle_order_notification already covers this
        
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
      ELSE
        -- Do nothing for other statuses (including 'paid')
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 2: Auto send tracking email to customer when tracking_number is added
CREATE OR REPLACE FUNCTION public.auto_send_tracking_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_carrier_name TEXT;
  v_tracking_url TEXT;
  v_shipping_enabled BOOLEAN;
BEGIN
  -- Only when tracking_number changes from NULL to a value AND customer_email exists
  IF OLD.tracking_number IS NOT NULL OR NEW.tracking_number IS NULL OR NEW.customer_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check customer_communication_settings for shipping_update opt-out
  SELECT email_enabled INTO v_shipping_enabled
  FROM public.customer_communication_settings
  WHERE tenant_id = NEW.tenant_id AND trigger_type = 'shipping_update'
  LIMIT 1;

  -- Default to true if no settings exist
  IF v_shipping_enabled IS NULL THEN
    v_shipping_enabled := true;
  END IF;

  IF NOT v_shipping_enabled THEN
    RETURN NEW;
  END IF;

  -- Get config values for pg_net call
  SELECT value INTO v_supabase_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_anon_key FROM public.internal_config WHERE key = 'supabase_anon_key';

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Normalize carrier name for display
  v_carrier_name := COALESCE(NEW.carrier, 'Vervoerder');
  v_carrier_name := REPLACE(REPLACE(LOWER(v_carrier_name), '_', ' '), 'be', '');
  v_carrier_name := INITCAP(TRIM(v_carrier_name));
  
  v_tracking_url := COALESCE(NEW.tracking_url, '');

  -- Call send-customer-message via pg_net
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-customer-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'tenant_id', NEW.tenant_id,
      'customer_email', NEW.customer_email,
      'customer_name', COALESCE(NEW.customer_name, 'klant'),
      'subject', 'Je bestelling ' || COALESCE(NEW.order_number, '') || ' is onderweg! 📦',
      'body_html', '<p>Goed nieuws! Je bestelling <strong>' || COALESCE(NEW.order_number, '') || '</strong> is verzonden.</p>'
        || '<table style="margin: 24px 0; border-collapse: collapse;">'
        || '<tr><td style="padding: 8px 16px 8px 0; color: #6b7280;">Vervoerder:</td><td style="padding: 8px 0; font-weight: 500;">' || v_carrier_name || '</td></tr>'
        || '<tr><td style="padding: 8px 16px 8px 0; color: #6b7280;">Tracknummer:</td><td style="padding: 8px 0; font-weight: 500;">' || NEW.tracking_number || '</td></tr>'
        || '</table>'
        || CASE WHEN v_tracking_url != '' THEN
          '<p><a href="' || v_tracking_url || '" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">📦 Volg je pakket</a></p>'
          ELSE '' END
        || '<p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Je ontvangt automatisch updates over de status van je zending.</p>',
      'body_text', 'Goed nieuws! Je bestelling ' || COALESCE(NEW.order_number, '') || ' is verzonden via ' || v_carrier_name || '. Tracknummer: ' || NEW.tracking_number || '. ' || CASE WHEN v_tracking_url != '' THEN 'Volg je pakket: ' || v_tracking_url ELSE '' END,
      'context_type', 'order',
      'order_id', NEW.id,
      'context_data', jsonb_build_object(
        'order_number', NEW.order_number,
        'carrier', v_carrier_name,
        'tracking_number', NEW.tracking_number,
        'tracking_url', v_tracking_url
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for auto tracking email
DROP TRIGGER IF EXISTS trigger_auto_tracking_email ON public.orders;
CREATE TRIGGER trigger_auto_tracking_email
  AFTER UPDATE OF tracking_number ON public.orders
  FOR EACH ROW
  WHEN (OLD.tracking_number IS NULL AND NEW.tracking_number IS NOT NULL)
  EXECUTE FUNCTION public.auto_send_tracking_email();


-- NOTIF-FIX-1: internal webhook secret + trigger update + import-guard on customer_new

-- 1) Ensure internal webhook secret exists (idempotent)
INSERT INTO public.internal_config (key, value)
VALUES ('internal_webhook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 2) Update notify_email_on_notification to include X-Internal-Secret header
CREATE OR REPLACE FUNCTION public.notify_email_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_secret TEXT;
BEGIN
  SELECT value INTO v_supabase_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_anon_key FROM public.internal_config WHERE key = 'supabase_anon_key';
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_webhook_secret';

  IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'X-Internal-Secret', v_secret
      ),
      body := jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'category', NEW.category,
        'type', NEW.type,
        'title', NEW.title,
        'message', NEW.message,
        'priority', NEW.priority,
        'action_url', NEW.action_url,
        'data', COALESCE(NEW.data, '{}'::jsonb),
        'notification_id', NEW.id,
        'skip_in_app', true
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Skip customer_new notification for bulk-import customers
CREATE OR REPLACE FUNCTION public.handle_customer_notification()
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
  -- NOTIF-FIX-1: import-klanten (bol.com, shopify, csv) veroorzaken geen notificatiestorm
  IF TG_OP = 'INSERT' AND NEW.acquisition_source IN ('bol_com','shopify_import','csv_import') THEN
    RETURN NEW;
  END IF;

  v_customer_name := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''),
    NEW.company_name,
    NEW.email
  );
  v_action_url := '/admin/customers/' || NEW.id;

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
$function$;

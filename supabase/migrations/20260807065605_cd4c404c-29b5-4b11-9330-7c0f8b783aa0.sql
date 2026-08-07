CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      url := v_supabase_url || '/functions/v1/send-push-notification',
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
        'user_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_push_on_notification ON public.notifications;
CREATE TRIGGER notify_push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_notification();
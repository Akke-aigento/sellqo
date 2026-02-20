
-- Enable pg_net extension for HTTP requests from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create internal config table for storing Supabase URL/key
CREATE TABLE IF NOT EXISTS public.internal_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed - only accessed by SECURITY DEFINER functions
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role / SECURITY DEFINER functions can access

-- Insert Supabase URL and anon key
INSERT INTO public.internal_config (key, value) VALUES
  ('supabase_url', 'https://gczmfcabnoofnmfpzeop.supabase.co'),
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjem1mY2Fibm9vZm5tZnB6ZW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjI3MDYsImV4cCI6MjA4Mzg5ODcwNn0.QBzjHufd95y2kJF3ii7LZS_77nh7BPyVxhOMEGXm8PQ')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create trigger function that calls the edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_email_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Get config values
  SELECT value INTO v_supabase_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_anon_key FROM public.internal_config WHERE key = 'supabase_anon_key';

  -- Only proceed if we have config
  IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
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
$$;

-- Create the AFTER INSERT trigger on notifications
DROP TRIGGER IF EXISTS trigger_notification_email ON public.notifications;
CREATE TRIGGER trigger_notification_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_email_on_notification();

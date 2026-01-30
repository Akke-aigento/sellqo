-- 1. Drop de oude functie met enum parameter type (die de verkeerde 'metadata' kolom gebruikt)
DROP FUNCTION IF EXISTS public.send_notification(
  uuid, notification_category, text, text, text, text, text, jsonb
);

-- 2. Recreate de correcte functie met text parameter (zekerheidshalve)
CREATE OR REPLACE FUNCTION public.send_notification(
  p_tenant_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_priority text DEFAULT 'medium',
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
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
    p_category::notification_category,
    p_type,
    p_title,
    p_message,
    p_priority::notification_priority,
    p_action_url,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;
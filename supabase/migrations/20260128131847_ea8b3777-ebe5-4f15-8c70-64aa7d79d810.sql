-- Drop and recreate send_notification function with explicit enum casts
DROP FUNCTION IF EXISTS public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.send_notification(
  p_tenant_id UUID,
  p_category TEXT,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'low',
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    metadata
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
$function$;
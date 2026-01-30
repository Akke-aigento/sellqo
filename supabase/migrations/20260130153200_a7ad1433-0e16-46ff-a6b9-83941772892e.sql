-- Step 1: Add 'integrations' category to enum
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'integrations';

-- Step 2: Fix send_notification function (metadata → data)
CREATE OR REPLACE FUNCTION public.send_notification(
  p_tenant_id UUID,
  p_category notification_category,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
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
    p_category,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_action_url,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Step 3: Rewrite handle_shopify_request_notification trigger with platform admin notifications
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_name TEXT;
  v_platform_admin RECORD;
BEGIN
  -- Get tenant name for context
  SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
  v_tenant_name := COALESCE(v_tenant_name, 'Onbekende tenant');

  -- NEW REQUEST
  IF TG_OP = 'INSERT' THEN
    -- 1. Notify the merchant (tenant)
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_submitted',
      'Shopify koppelverzoek ingediend',
      'Je verzoek voor ' || NEW.store_name || '.myshopify.com is ontvangen. We nemen binnen 1-2 werkdagen contact op.',
      'medium',
      '/admin/connect',
      jsonb_build_object(
        'request_id', NEW.id, 
        'store_name', NEW.store_name,
        'store_url', NEW.store_url
      )
    );
    
    -- 2. Notify all platform admins (in-app + email via high priority)
    FOR v_platform_admin IN 
      SELECT ur.user_id, ur.tenant_id 
      FROM user_roles ur 
      WHERE ur.role = 'platform_admin'
        AND ur.tenant_id IS NOT NULL
    LOOP
      PERFORM public.send_notification(
        v_platform_admin.tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        'Tenant "' || v_tenant_name || '" heeft een verzoek ingediend voor ' || NEW.store_name || '.myshopify.com',
        'high',
        '/admin/platform/shopify-requests',
        jsonb_build_object(
          'request_id', NEW.id, 
          'store_name', NEW.store_name,
          'store_url', NEW.store_url,
          'tenant_id', NEW.tenant_id,
          'tenant_name', v_tenant_name
        )
      );
    END LOOP;
    
  -- STATUS CHANGES
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'integrations',
          'shopify_request_approved',
          'Shopify koppelverzoek goedgekeurd',
          'Je verzoek voor ' || NEW.store_name || '.myshopify.com is goedgekeurd! Klik om de koppeling te activeren.',
          'high',
          '/admin/connect',
          jsonb_build_object(
            'request_id', NEW.id, 
            'store_name', NEW.store_name,
            'install_link', NEW.install_link
          )
        );
        
      WHEN 'completed' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'integrations',
          'shopify_request_completed',
          'Shopify koppeling actief',
          'Je Shopify webshop ' || NEW.store_name || '.myshopify.com is nu gekoppeld!',
          'medium',
          '/admin/connect',
          jsonb_build_object(
            'request_id', NEW.id, 
            'store_name', NEW.store_name
          )
        );
        
      WHEN 'rejected' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'integrations',
          'shopify_request_rejected',
          'Shopify koppelverzoek afgewezen',
          'Je verzoek voor ' || NEW.store_name || '.myshopify.com kon niet worden goedgekeurd.' || 
            CASE WHEN NEW.admin_notes IS NOT NULL THEN ' Reden: ' || NEW.admin_notes ELSE '' END,
          'high',
          '/admin/connect',
          jsonb_build_object(
            'request_id', NEW.id, 
            'store_name', NEW.store_name,
            'admin_notes', NEW.admin_notes
          )
        );
        
      ELSE
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_shopify_request_change ON shopify_connection_requests;
CREATE TRIGGER on_shopify_request_change
  AFTER INSERT OR UPDATE ON shopify_connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_shopify_request_notification();
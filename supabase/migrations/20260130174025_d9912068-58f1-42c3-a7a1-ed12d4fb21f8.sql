-- Fix: handle_shopify_request_notification function
-- Problem: was using non-existent 'contact_email' column from tenants table
-- Solution: use COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')

CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_ticket_id UUID;
  v_message_id UUID;
BEGIN
  -- Only process INSERT operations (prevent duplicate tickets on UPDATE)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Fetch tenant info with correct email field fallback
  SELECT 
    name, 
    COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')
  INTO v_tenant_name, v_tenant_email
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Create support ticket for platform team
  INSERT INTO public.support_tickets (
    tenant_id,
    subject,
    category,
    priority,
    status,
    requester_email,
    requester_name,
    metadata
  ) VALUES (
    NEW.tenant_id,
    'Shopify Koppelverzoek: ' || NEW.store_url,
    'integration',
    'normal',
    'open',
    v_tenant_email,
    COALESCE(v_tenant_name, 'Onbekend'),
    jsonb_build_object(
      'type', 'shopify_connection_request',
      'request_id', NEW.id,
      'store_url', NEW.store_url,
      'tenant_email', v_tenant_email
    )
  ) RETURNING id INTO v_ticket_id;

  -- Create initial message with request details
  INSERT INTO public.support_messages (
    ticket_id,
    sender_type,
    sender_name,
    content
  ) VALUES (
    v_ticket_id,
    'customer',
    COALESCE(v_tenant_name, 'Merchant'),
    'Nieuw Shopify koppelverzoek ingediend.' || E'\n\n' ||
    'Store URL: ' || NEW.store_url || E'\n' ||
    CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
      THEN 'Opmerkingen: ' || NEW.notes 
      ELSE '' 
    END
  ) RETURNING id INTO v_message_id;

  -- Send notification
  PERFORM public.send_notification(
    NEW.tenant_id,
    'integrations',
    'shopify_request_new',
    'Shopify Koppelverzoek Ingediend',
    'Je verzoek voor ' || NEW.store_url || ' is ontvangen en wordt verwerkt.',
    'low',
    '/admin/integrations/shopify',
    jsonb_build_object(
      'request_id', NEW.id,
      'store_url', NEW.store_url,
      'ticket_id', v_ticket_id
    )
  );

  RETURN NEW;
END;
$function$;

-- Drop existing trigger (may be on INSERT OR UPDATE)
DROP TRIGGER IF EXISTS shopify_request_notification_trigger ON public.shopify_connection_requests;

-- Recreate trigger - ONLY on INSERT to prevent duplicate tickets
CREATE TRIGGER shopify_request_notification_trigger
  AFTER INSERT ON public.shopify_connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shopify_request_notification();
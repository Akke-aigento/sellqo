-- Fix the priority enum value in handle_shopify_request_notification function
-- Change 'normal' (invalid) to 'medium' (valid enum value)

CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_ticket_id UUID;
  v_message_id UUID;
BEGIN
  -- Only process on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get tenant info with correct email field
  SELECT name, COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')
  INTO v_tenant_name, v_tenant_email
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Create support ticket for platform admins
  INSERT INTO public.support_tickets (
    tenant_id,
    subject,
    status,
    priority,
    category,
    metadata
  ) VALUES (
    NEW.tenant_id,
    'Shopify Koppelverzoek: ' || COALESCE(NEW.store_url, 'Onbekende winkel'),
    'open',
    'medium',
    'integration',
    jsonb_build_object(
      'type', 'shopify_connection_request',
      'request_id', NEW.id,
      'store_url', NEW.store_url,
      'tenant_name', v_tenant_name,
      'tenant_email', v_tenant_email,
      'contact_name', NEW.contact_name,
      'contact_email', NEW.contact_email,
      'notes', NEW.notes
    )
  ) RETURNING id INTO v_ticket_id;

  -- Create first message with request details
  INSERT INTO public.support_messages (
    ticket_id,
    sender_type,
    sender_name,
    content
  ) VALUES (
    v_ticket_id,
    'customer',
    COALESCE(NEW.contact_name, v_tenant_name, 'Klant'),
    'Shopify koppelverzoek ingediend.' || E'\n\n' ||
    '**Winkel URL:** ' || COALESCE(NEW.store_url, 'Niet opgegeven') || E'\n' ||
    '**Contact:** ' || COALESCE(NEW.contact_name, 'Niet opgegeven') || ' (' || COALESCE(NEW.contact_email, v_tenant_email) || ')' || E'\n' ||
    CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
      THEN E'\n**Opmerkingen:**\n' || NEW.notes 
      ELSE '' 
    END
  ) RETURNING id INTO v_message_id;

  -- Send notification
  PERFORM public.send_notification(
    NEW.tenant_id,
    'integrations',
    'shopify_request_received',
    'Shopify koppelverzoek ontvangen',
    'We hebben je verzoek ontvangen om ' || COALESCE(NEW.store_url, 'je Shopify winkel') || ' te koppelen. We nemen binnen 1-2 werkdagen contact op.',
    'low',
    '/admin/support/tickets/' || v_ticket_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'ticket_id', v_ticket_id,
      'store_url', NEW.store_url
    )
  );

  RETURN NEW;
END;
$$;
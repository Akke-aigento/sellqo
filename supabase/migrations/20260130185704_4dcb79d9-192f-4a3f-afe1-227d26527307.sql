-- Fix handle_shopify_request_notification: remove non-existent NEW.contact_* fields
-- Use tenant-derived variables instead

CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_store_url TEXT;
  v_ticket_id UUID;
BEGIN
  -- Only process INSERT operations
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Build store URL from store_name if not provided
  v_store_url := COALESCE(
    NULLIF(NEW.store_url, ''), 
    NEW.store_name || '.myshopify.com'
  );

  -- Get tenant info with fallback emails
  SELECT 
    COALESCE(name, 'Onbekende tenant'),
    COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')
  INTO v_tenant_name, v_tenant_email
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Create support ticket using tenant-derived variables (NOT NEW.contact_*)
  INSERT INTO public.support_tickets (
    tenant_id, subject, status, priority, category, metadata
  ) VALUES (
    NEW.tenant_id,
    'Shopify Koppelverzoek: ' || v_store_url,
    'open', 
    'medium',  -- Valid enum value
    'integration',
    jsonb_build_object(
      'type', 'shopify_connection_request',
      'request_id', NEW.id,
      'store_name', NEW.store_name,
      'store_url', v_store_url,
      'tenant_name', v_tenant_name,
      'tenant_email', v_tenant_email,
      'notes', NEW.notes
    )
  ) RETURNING id INTO v_ticket_id;

  -- Create message using tenant info (NOT NEW.contact_*)
  INSERT INTO public.support_messages (
    ticket_id, sender_type, sender_name, content
  ) VALUES (
    v_ticket_id,
    'customer',
    v_tenant_name,
    'Shopify koppelverzoek ingediend.' || E'\n\n' ||
    '**Winkel URL:** ' || v_store_url || E'\n' ||
    '**Contact:** ' || v_tenant_name || ' (' || v_tenant_email || ')' ||
    CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
      THEN E'\n\n**Opmerkingen:**\n' || NEW.notes 
      ELSE '' 
    END
  );

  -- Send notification
  PERFORM public.send_notification(
    NEW.tenant_id, 
    'integrations', 
    'shopify_request_received',
    'Shopify koppelverzoek ontvangen',
    'We hebben je verzoek ontvangen om ' || v_store_url || 
    ' te koppelen. We nemen binnen 1-2 werkdagen contact op.',
    'low',
    '/admin/support/tickets/' || v_ticket_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'ticket_id', v_ticket_id,
      'store_url', v_store_url
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
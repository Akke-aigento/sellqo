-- Fix handle_shopify_request_notification trigger function
-- Replace non-existent NEW.contact_email and NEW.request_type with tenant lookup and NEW.notes

CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_platform_tenant_id UUID;
BEGIN
  -- Get platform tenant (SellQo)
  SELECT id INTO v_platform_tenant_id FROM tenants WHERE slug = 'sellqo' LIMIT 1;
  
  IF v_platform_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant name and contact email from tenants table (instead of non-existent NEW.contact_email)
  SELECT name, contact_email INTO v_tenant_name, v_tenant_email 
  FROM tenants WHERE id = NEW.tenant_id;
  
  -- Create support ticket for the request
  INSERT INTO support_tickets (
    tenant_id,
    requester_email,
    requester_name,
    subject,
    status,
    priority,
    category,
    related_resource_type,
    related_resource_id,
    metadata
  ) VALUES (
    v_platform_tenant_id,
    COALESCE(v_tenant_email, 'no-email@sellqo.nl'),
    COALESCE(v_tenant_name, 'Onbekende tenant'),
    'Shopify koppeling aanvraag: ' || NEW.store_name || '.myshopify.com',
    'open',
    'medium',
    'integration',
    'shopify_connection_request',
    NEW.id,
    jsonb_build_object(
      'store_name', NEW.store_name,
      'tenant_id', NEW.tenant_id,
      'tenant_name', v_tenant_name,
      'notes', NEW.notes
    )
  ) RETURNING id INTO v_ticket_id;
  
  -- Create initial system message
  INSERT INTO support_messages (
    ticket_id,
    sender_type,
    message,
    is_internal_note
  ) VALUES (
    v_ticket_id,
    'system',
    'Nieuwe Shopify koppelingsaanvraag ontvangen van ' || COALESCE(v_tenant_name, 'onbekende tenant') || 
    ' voor store: ' || NEW.store_name || '.myshopify.com' ||
    CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nOpmerkingen: ' || NEW.notes ELSE '' END,
    false
  );
  
  -- Send notification to platform admins
  PERFORM public.send_notification(
    v_platform_tenant_id,
    'integrations',
    'shopify_request_new',
    'Nieuwe Shopify aanvraag',
    'Nieuwe koppelingsaanvraag van ' || COALESCE(v_tenant_name, 'onbekende tenant') || ' voor ' || NEW.store_name || '.myshopify.com',
    'high',
    '/platform/support?ticket=' || v_ticket_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'ticket_id', v_ticket_id,
      'store_name', NEW.store_name,
      'tenant_name', v_tenant_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Fix sync_ticket_to_shopify_request function with tenant notifications + waiting mapping
CREATE OR REPLACE FUNCTION public.sync_ticket_to_shopify_request()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_store_name TEXT;
  v_status_label TEXT;
BEGIN
  -- Alleen bij shopify requests
  IF NEW.related_resource_type = 'shopify_connection_request' 
     AND NEW.related_resource_id IS NOT NULL
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
     
    -- Haal tenant info op
    SELECT tenant_id, store_name INTO v_tenant_id, v_store_name
    FROM shopify_connection_requests
    WHERE id = NEW.related_resource_id;
    
    -- Bepaal status label voor notificatie
    v_status_label := CASE NEW.status
      WHEN 'open' THEN 'Open'
      WHEN 'in_progress' THEN 'In behandeling'
      WHEN 'waiting' THEN 'Wachtend op antwoord'
      WHEN 'resolved' THEN 'Opgelost'
      WHEN 'closed' THEN 'Gesloten'
      ELSE NEW.status
    END;
    
    -- Update shopify request status
    UPDATE shopify_connection_requests
    SET status = CASE NEW.status
      WHEN 'open' THEN 'pending'::text
      WHEN 'in_progress' THEN 'in_review'::text
      WHEN 'waiting' THEN 'in_review'::text
      WHEN 'resolved' THEN 'approved'::text
      WHEN 'closed' THEN 'completed'::text
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.related_resource_id;
    
    -- Stuur notificatie naar tenant
    IF v_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_tenant_id,
        'integrations',
        'shopify_request_updated',
        'Shopify verzoek bijgewerkt',
        'De status van je verzoek voor ' || COALESCE(v_store_name, 'je store') || 
          '.myshopify.com is gewijzigd naar: ' || v_status_label,
        'medium',
        '/admin/marketplace',
        jsonb_build_object(
          'request_id', NEW.related_resource_id,
          'ticket_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'store_name', v_store_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix handle_shopify_request_notification to use correct table name
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_tenant_name TEXT;
  v_platform_tenant_id UUID;
BEGIN
  -- Get platform tenant (SellQo)
  SELECT id INTO v_platform_tenant_id FROM tenants WHERE slug = 'sellqo' LIMIT 1;
  
  IF v_platform_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant name
  SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
  
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
    COALESCE(NEW.contact_email, 'no-email@sellqo.nl'),
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
      'request_type', NEW.request_type
    )
  ) RETURNING id INTO v_ticket_id;
  
  -- Create initial system message - FIXED: use support_messages instead of support_ticket_messages
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
    CASE WHEN NEW.request_type = 'managed' THEN ' (Beheerde koppeling)' ELSE ' (OAuth flow)' END,
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
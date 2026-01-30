-- ============================================
-- Fix Duplicate Notifications & Add Email Support
-- ============================================

-- 1. Cleanup duplicate test data
DELETE FROM support_tickets 
WHERE related_resource_type = 'shopify_connection_request'
AND id NOT IN (
  SELECT DISTINCT ON (related_resource_id) id 
  FROM support_tickets 
  WHERE related_resource_type = 'shopify_connection_request'
  ORDER BY related_resource_id, created_at DESC
);

DELETE FROM notifications 
WHERE type LIKE 'shopify_%'
AND id NOT IN (
  SELECT DISTINCT ON (tenant_id, type, data->>'request_id') id 
  FROM notifications 
  WHERE type LIKE 'shopify_%'
  ORDER BY tenant_id, type, data->>'request_id', created_at DESC
);

-- 2. Drop ALL existing triggers on shopify_connection_requests to ensure clean state
DROP TRIGGER IF EXISTS shopify_request_notification_trigger ON shopify_connection_requests;
DROP TRIGGER IF EXISTS on_shopify_request_change ON shopify_connection_requests;
DROP TRIGGER IF EXISTS trigger_shopify_request_notification ON shopify_connection_requests;

-- 3. Recreate the trigger function with duplicate check
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_ticket UUID;
  v_ticket_id UUID;
  v_platform_tenant_id UUID;
  v_tenant_name TEXT;
  v_requester_email TEXT;
BEGIN
  -- NIEUWE AANVRAAG (INSERT)
  IF TG_OP = 'INSERT' THEN
    -- Check of er al een ticket bestaat voor dit request (voorkom duplicates)
    SELECT id INTO v_existing_ticket 
    FROM support_tickets 
    WHERE related_resource_id = NEW.id 
    AND related_resource_type = 'shopify_connection_request'
    LIMIT 1;
    
    IF v_existing_ticket IS NOT NULL THEN
      RETURN NEW; -- Skip, ticket bestaat al
    END IF;
    
    -- Haal platform tenant op (voor routing naar platform admin)
    SELECT id INTO v_platform_tenant_id FROM tenants WHERE slug = 'sellqo' LIMIT 1;
    
    -- Haal tenant naam en email op
    SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
    SELECT email INTO v_requester_email FROM auth.users 
    WHERE id = NEW.requested_by LIMIT 1;
    
    -- Maak support ticket aan voor platform admin
    INSERT INTO support_tickets (
      tenant_id,
      category,
      subject,
      status,
      priority,
      created_by_tenant_id,
      related_resource_type,
      related_resource_id
    ) VALUES (
      v_platform_tenant_id,
      'integration',
      'Shopify koppelverzoek: ' || NEW.store_name,
      'open',
      'medium',
      NEW.tenant_id,
      'shopify_connection_request',
      NEW.id
    ) RETURNING id INTO v_ticket_id;
    
    -- Voeg systeem-bericht toe met context
    INSERT INTO support_ticket_messages (
      ticket_id,
      sender_type,
      message,
      metadata
    ) VALUES (
      v_ticket_id,
      'system',
      'Nieuw Shopify koppelverzoek ontvangen van ' || COALESCE(v_tenant_name, 'onbekend') || ' (' || COALESCE(v_requester_email, 'geen email') || ').

Store URL: ' || NEW.store_name || '.myshopify.com
Opmerkingen: ' || COALESCE(NEW.notes, 'Geen'),
      jsonb_build_object(
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'tenant_id', NEW.tenant_id,
        'tenant_name', v_tenant_name,
        'requester_email', v_requester_email
      )
    );
    
    -- Notificatie naar PLATFORM (admin)
    PERFORM public.send_notification(
      v_platform_tenant_id,
      'integrations',
      'shopify_request_new',
      'Nieuw Shopify verzoek: ' || NEW.store_name,
      'Koppelverzoek van ' || COALESCE(v_tenant_name, 'onbekend') || ' voor ' || NEW.store_name || '.myshopify.com',
      'high',
      '/platform/support?ticket=' || v_ticket_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'tenant_id', NEW.tenant_id,
        'tenant_name', v_tenant_name,
        'ticket_id', v_ticket_id
      )
    );
    
    -- Notificatie naar TENANT (bevestiging)
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_pending',
      'Shopify koppelverzoek ingediend',
      'Je verzoek voor ' || NEW.store_name || '.myshopify.com is ontvangen. We nemen binnen 1-2 werkdagen contact op.',
      'medium',
      '/admin/support?ticket=' || v_ticket_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'ticket_id', v_ticket_id
      )
    );
  END IF;
  
  -- STATUS WIJZIGING (UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Approved
    IF NEW.status = 'approved' THEN
      PERFORM public.send_notification(
        NEW.tenant_id,
        'integrations',
        'shopify_request_approved',
        'Shopify koppeling goedgekeurd!',
        'Je verzoek voor ' || NEW.store_name || '.myshopify.com is goedgekeurd. Klik hier om te activeren.',
        'high',
        '/admin/marketplace',
        jsonb_build_object(
          'request_id', NEW.id,
          'store_name', NEW.store_name,
          'install_link', NEW.install_link
        )
      );
    -- Rejected
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.send_notification(
        NEW.tenant_id,
        'integrations',
        'shopify_request_rejected',
        'Shopify koppeling afgewezen',
        'Je verzoek voor ' || NEW.store_name || '.myshopify.com kon niet worden goedgekeurd.' || 
          CASE WHEN NEW.admin_notes IS NOT NULL THEN ' Reden: ' || NEW.admin_notes ELSE '' END,
        'medium',
        '/admin/marketplace',
        jsonb_build_object(
          'request_id', NEW.id,
          'store_name', NEW.store_name,
          'admin_notes', NEW.admin_notes
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create single trigger for INSERT and UPDATE
CREATE TRIGGER shopify_request_notification_trigger
  AFTER INSERT OR UPDATE ON shopify_connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_shopify_request_notification();
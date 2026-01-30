-- 1. Add new category values to the enum
ALTER TYPE public.support_ticket_category ADD VALUE IF NOT EXISTS 'integration';
ALTER TYPE public.support_ticket_category ADD VALUE IF NOT EXISTS 'feedback';

-- 2. Add related resource columns to support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS related_resource_type TEXT,
ADD COLUMN IF NOT EXISTS related_resource_id UUID;

-- 3. Create index for faster lookups on related resources
CREATE INDEX IF NOT EXISTS idx_support_tickets_related_resource 
ON public.support_tickets(related_resource_type, related_resource_id) 
WHERE related_resource_id IS NOT NULL;

-- 4. Update the shopify request notification trigger to create support tickets
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_internal_tenant_id UUID;
  v_ticket_id UUID;
BEGIN
  -- Get tenant info
  SELECT name, owner_email INTO v_tenant_name, v_tenant_email 
  FROM tenants WHERE id = NEW.tenant_id;
  v_tenant_name := COALESCE(v_tenant_name, 'Onbekende tenant');

  -- Get internal tenant (SellQo platform)
  SELECT id INTO v_internal_tenant_id 
  FROM tenants WHERE is_internal_tenant = true LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    -- Create support ticket automatically
    INSERT INTO support_tickets (
      tenant_id,
      requester_email,
      requester_name,
      subject,
      category,
      priority,
      status,
      metadata,
      related_resource_type,
      related_resource_id
    ) VALUES (
      NEW.tenant_id,
      COALESCE(v_tenant_email, 'unknown@tenant.com'),
      v_tenant_name,
      'Shopify koppelverzoek: ' || COALESCE(NEW.store_name, 'Onbekende store'),
      'integration',
      'high',
      'open',
      jsonb_build_object(
        'type', 'shopify_connection_request',
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'store_url', NEW.store_url
      ),
      'shopify_connection_request',
      NEW.id
    ) RETURNING id INTO v_ticket_id;
    
    -- Add system message with request details
    INSERT INTO support_messages (ticket_id, sender_type, message)
    VALUES (
      v_ticket_id,
      'system',
      'Nieuw Shopify koppelverzoek ingediend.' || chr(10) || chr(10) ||
      'Store naam: ' || COALESCE(NEW.store_name, '-') || chr(10) ||
      'Store URL: ' || COALESCE(NEW.store_url, '-') || chr(10) ||
      'Opmerkingen merchant: ' || COALESCE(NEW.notes, 'Geen')
    );
    
    -- Notify internal tenant (platform team) with link to ticket
    IF v_internal_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_internal_tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        v_tenant_name || ' vraagt koppeling aan voor ' || COALESCE(NEW.store_name, 'onbekende store'),
        'high',
        '/admin/platform/support?ticket=' || v_ticket_id,
        jsonb_build_object(
          'ticket_id', v_ticket_id,
          'request_id', NEW.id,
          'tenant_name', v_tenant_name,
          'store_name', NEW.store_name
        )
      );
    END IF;
    
    -- Notify merchant that request was submitted
    PERFORM public.send_notification(
      NEW.tenant_id,
      'system',
      'shopify_request_pending',
      'Shopify koppelverzoek ingediend',
      'Je verzoek voor ' || COALESCE(NEW.store_name, 'je store') || ' is ingediend. We nemen contact op via je support inbox.',
      'medium',
      '/admin/support?ticket=' || v_ticket_id,
      jsonb_build_object(
        'ticket_id', v_ticket_id,
        'request_id', NEW.id
      )
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Status change notifications to merchant
    CASE NEW.status
      WHEN 'approved' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_approved',
          'Shopify koppeling goedgekeurd',
          'Je aanvraag voor ' || COALESCE(NEW.store_name, 'je store') || ' is goedgekeurd! Bekijk de installatie instructies.',
          'high',
          '/admin/integrations/shopify',
          jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
        );
      WHEN 'rejected' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_rejected',
          'Shopify koppeling afgewezen',
          'Je aanvraag voor ' || COALESCE(NEW.store_name, 'je store') || ' kon niet worden goedgekeurd. Bekijk de details voor meer informatie.',
          'medium',
          '/admin/integrations/shopify',
          jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
        );
      WHEN 'completed' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_completed',
          'Shopify koppeling voltooid',
          'Je ' || COALESCE(NEW.store_name, 'Shopify store') || ' is succesvol gekoppeld!',
          'high',
          '/admin/integrations/shopify',
          jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
        );
      ELSE
        -- No notification for other status changes
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;
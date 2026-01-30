-- 1. Voeg notification_email kolom toe aan tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

COMMENT ON COLUMN public.tenants.notification_email IS 'Alternatief email adres voor systeem notificaties. Indien ingesteld, worden notificaties naar dit adres gestuurd i.p.v. owner_email.';

-- 2. Fix de platform admin notificatie trigger - route naar interne tenant
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_name TEXT;
  v_internal_tenant_id UUID;
BEGIN
  -- Get tenant name
  SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
  v_tenant_name := COALESCE(v_tenant_name, 'Onbekende tenant');

  IF TG_OP = 'INSERT' THEN
    -- Notify the requesting merchant
    PERFORM public.send_notification(
      NEW.tenant_id,
      'system',
      'shopify_request_pending',
      'Shopify koppelverzoek ingediend',
      'Je koppelverzoek voor ' || COALESCE(NEW.store_name, 'je Shopify store') || ' is ingediend en wordt beoordeeld.',
      'medium',
      '/admin/settings/integrations',
      jsonb_build_object(
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'store_url', NEW.store_url
      )
    );

    -- Notify internal tenant (SellQo platform team) instead of searching for platform_admin roles
    SELECT id INTO v_internal_tenant_id 
    FROM tenants 
    WHERE is_internal_tenant = true 
    LIMIT 1;

    IF v_internal_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_internal_tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        'Tenant "' || v_tenant_name || '" vraagt koppeling aan voor ' || COALESCE(NEW.store_name, 'onbekende store'),
        'high',
        '/admin/platform/shopify-requests',
        jsonb_build_object(
          'request_id', NEW.id,
          'tenant_id', NEW.tenant_id,
          'tenant_name', v_tenant_name,
          'store_name', NEW.store_name,
          'store_url', NEW.store_url
        )
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Status change notifications to the merchant
    CASE NEW.status
      WHEN 'approved' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_approved',
          'Shopify koppelverzoek goedgekeurd',
          'Je koppelverzoek voor ' || COALESCE(NEW.store_name, 'je Shopify store') || ' is goedgekeurd! Onze medewerkers zullen contact met je opnemen.',
          'high',
          '/admin/settings/integrations',
          jsonb_build_object(
            'request_id', NEW.id,
            'store_name', NEW.store_name
          )
        );

      WHEN 'rejected' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_rejected',
          'Shopify koppelverzoek afgewezen',
          'Je koppelverzoek voor ' || COALESCE(NEW.store_name, 'je Shopify store') || ' kon helaas niet worden goedgekeurd.' || 
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' Reden: ' || NEW.rejection_reason ELSE '' END,
          'high',
          '/admin/settings/integrations',
          jsonb_build_object(
            'request_id', NEW.id,
            'store_name', NEW.store_name,
            'rejection_reason', NEW.rejection_reason
          )
        );

      WHEN 'completed' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'system',
          'shopify_request_completed',
          'Shopify koppeling voltooid',
          'De koppeling met ' || COALESCE(NEW.store_name, 'je Shopify store') || ' is succesvol afgerond. Je kunt nu beginnen met synchroniseren!',
          'high',
          '/admin/settings/integrations',
          jsonb_build_object(
            'request_id', NEW.id,
            'store_name', NEW.store_name
          )
        );

      ELSE
        -- Other status changes don't trigger notifications
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;
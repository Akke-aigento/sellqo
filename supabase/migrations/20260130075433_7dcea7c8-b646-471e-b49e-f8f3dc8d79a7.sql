-- Create shopify_connection_requests table
CREATE TABLE public.shopify_connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,
  store_url TEXT GENERATED ALWAYS AS (store_name || '.myshopify.com') STORED,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_review', 'approved', 'completed', 'rejected')),
  notes TEXT,
  admin_notes TEXT,
  install_link TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add connection_type column to marketplace_connections
ALTER TABLE public.marketplace_connections 
ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'oauth' 
  CHECK (connection_type IN ('oauth', 'custom_app', 'manual_import', 'request'));

-- Enable RLS
ALTER TABLE public.shopify_connection_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants
CREATE POLICY "Tenants can view their own requests"
ON public.shopify_connection_requests
FOR SELECT
TO authenticated
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Tenants can insert their own requests"
ON public.shopify_connection_requests
FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- Platform admins can do everything
CREATE POLICY "Platform admins can manage all requests"
ON public.shopify_connection_requests
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Updated at trigger
CREATE TRIGGER update_shopify_connection_requests_updated_at
BEFORE UPDATE ON public.shopify_connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger for new requests
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify on new request
  IF TG_OP = 'INSERT' THEN
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_submitted',
      'Shopify koppelverzoek ingediend',
      'Je verzoek voor ' || NEW.store_name || '.myshopify.com is ontvangen. We nemen binnen 1-2 werkdagen contact op.',
      'medium',
      '/admin/connect',
      jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
    );
  
  -- Notify when approved
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_approved',
      'Shopify koppeling goedgekeurd!',
      'Je Shopify koppeling voor ' || NEW.store_name || '.myshopify.com is klaar om te activeren.',
      'high',
      '/admin/connect',
      jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name, 'install_link', NEW.install_link)
    );
  
  -- Notify when completed
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_completed',
      'Shopify koppeling actief!',
      'Je Shopify winkel ' || NEW.store_name || '.myshopify.com is succesvol gekoppeld.',
      'medium',
      '/admin/connect',
      jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER shopify_request_notification_trigger
AFTER INSERT OR UPDATE ON public.shopify_connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_shopify_request_notification();
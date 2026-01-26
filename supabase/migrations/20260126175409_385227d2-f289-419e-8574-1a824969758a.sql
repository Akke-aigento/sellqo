-- =============================================
-- DEEL 1: Security Definer Functies voor Rol Controle
-- =============================================

-- Check of gebruiker warehouse rol heeft
CREATE OR REPLACE FUNCTION public.is_warehouse_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'warehouse'
  )
$$;

-- Get user's highest role (voor UI filtering)
CREATE OR REPLACE FUNCTION public.get_user_highest_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'platform_admin' THEN 1 
      WHEN 'tenant_admin' THEN 2 
      WHEN 'accountant' THEN 3
      WHEN 'staff' THEN 4 
      WHEN 'warehouse' THEN 5
      WHEN 'viewer' THEN 6
    END
  LIMIT 1
$$;

-- =============================================
-- DEEL 2: Views voor Warehouse (zonder financiële data)
-- =============================================

-- Orders view voor warehouse users (exclusief financiële data)
CREATE OR REPLACE VIEW public.orders_warehouse
WITH (security_invoker=on) AS
SELECT 
  id,
  tenant_id,
  order_number,
  status,
  fulfillment_status,
  customer_name,
  shipping_address,
  carrier,
  tracking_number,
  tracking_url,
  shipped_at,
  delivered_at,
  delivery_type,
  service_point_id,
  service_point_data,
  marketplace_source,
  marketplace_order_id,
  created_at,
  updated_at
FROM public.orders;

-- Order items view voor warehouse (exclusief prijzen)
CREATE OR REPLACE VIEW public.order_items_warehouse
WITH (security_invoker=on) AS
SELECT 
  id,
  order_id,
  product_id,
  product_name,
  product_sku,
  product_image,
  quantity
FROM public.order_items;

-- =============================================
-- DEEL 3: Fulfillment API Keys Tabel
-- =============================================

CREATE TABLE IF NOT EXISTS public.fulfillment_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  api_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"read_orders": true, "update_tracking": true}'::jsonb,
  ip_whitelist TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index voor snelle lookup op api_key
CREATE INDEX IF NOT EXISTS idx_fulfillment_api_keys_api_key ON public.fulfillment_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_fulfillment_api_keys_tenant ON public.fulfillment_api_keys(tenant_id);

-- Enable RLS
ALTER TABLE public.fulfillment_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies voor fulfillment_api_keys
CREATE POLICY "Tenant admins can manage their API keys"
  ON public.fulfillment_api_keys
  FOR ALL
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (
      public.is_platform_admin(auth.uid()) 
      OR public.has_role(auth.uid(), 'tenant_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (
      public.is_platform_admin(auth.uid()) 
      OR public.has_role(auth.uid(), 'tenant_admin')
    )
  );

-- Trigger voor updated_at
CREATE TRIGGER update_fulfillment_api_keys_updated_at
  BEFORE UPDATE ON public.fulfillment_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DEEL 4: Helper functie voor API key generatie
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_fulfillment_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  result TEXT := 'fk_live_';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;
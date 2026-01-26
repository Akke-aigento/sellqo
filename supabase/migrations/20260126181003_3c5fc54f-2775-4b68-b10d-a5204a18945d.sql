-- Add external_reference column to orders for external system integration
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_reference TEXT;

-- Create index for efficient order lookup by external reference
CREATE INDEX IF NOT EXISTS idx_orders_external_reference ON public.orders(tenant_id, external_reference);

-- Create composite index for multi-field order matching
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(tenant_id, order_number);

-- Add tracking status tracking columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_tracking_check TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_status TEXT;

-- Create tenant tracking settings table
CREATE TABLE IF NOT EXISTS public.tenant_tracking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notify_on_shipped BOOLEAN DEFAULT true,
  notify_on_delivered BOOLEAN DEFAULT false,
  notify_on_exception BOOLEAN DEFAULT true,
  notify_on_out_for_delivery BOOLEAN DEFAULT false,
  auto_poll_17track BOOLEAN DEFAULT false,
  poll_interval_hours INTEGER DEFAULT 4,
  api_key_17track TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tracking settings
ALTER TABLE public.tenant_tracking_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for tracking settings
CREATE POLICY "Users can view their tenant tracking settings"
  ON public.tenant_tracking_settings FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admins can manage tracking settings"
  ON public.tenant_tracking_settings FOR ALL
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'tenant_admin')
  );

-- Create tracking import log table for audit trail
CREATE TABLE IF NOT EXISTS public.tracking_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  import_source TEXT NOT NULL, -- 'csv', 'webhook', 'api', 'email'
  total_records INTEGER DEFAULT 0,
  matched_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  import_data JSONB,
  error_details JSONB,
  imported_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on import log
ALTER TABLE public.tracking_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant import logs"
  ON public.tracking_import_log FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "System can insert import logs"
  ON public.tracking_import_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Function to find order by multiple reference types
CREATE OR REPLACE FUNCTION public.find_order_by_reference(
  p_tenant_id UUID,
  p_reference TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Try exact UUID match first
  BEGIN
    v_order_id := p_reference::UUID;
    IF EXISTS (SELECT 1 FROM orders WHERE id = v_order_id AND tenant_id = p_tenant_id) THEN
      RETURN v_order_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid UUID, continue with other checks
  END;
  
  -- Try order_number match (with or without #)
  SELECT id INTO v_order_id FROM orders 
  WHERE tenant_id = p_tenant_id 
  AND (order_number = p_reference OR order_number = '#' || LTRIM(p_reference, '#'))
  LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;
  
  -- Try external_reference match
  SELECT id INTO v_order_id FROM orders 
  WHERE tenant_id = p_tenant_id AND external_reference = p_reference
  LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;
  
  -- Try marketplace_order_id match
  SELECT id INTO v_order_id FROM orders 
  WHERE tenant_id = p_tenant_id AND marketplace_order_id = p_reference
  LIMIT 1;
  
  RETURN v_order_id;
END;
$$;

-- Extend return_status enum with new values
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'shipped_by_customer';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'inspecting';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'awaiting_refund';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Extend returns table
ALTER TABLE public.returns 
  ADD COLUMN IF NOT EXISTS rma_number TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS restocking_fees_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_refund NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_arrival_date DATE,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create return_items table
CREATE TABLE public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id UUID,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID,
  product_name TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  reason_code TEXT NOT NULL,
  reason_notes TEXT,
  condition TEXT,
  restock BOOLEAN DEFAULT true,
  restocking_fee NUMERIC(12,2) DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL,
  received_quantity INTEGER,
  inspection_notes TEXT,
  inspected_at TIMESTAMPTZ,
  inspected_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX idx_return_items_product_id ON public.return_items(product_id);

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage return items"
  ON public.return_items FOR ALL
  USING (return_id IN (
    SELECT id FROM public.returns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ))
  WITH CHECK (return_id IN (
    SELECT id FROM public.returns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- Create return_status_history table
CREATE TABLE public.return_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_return_status_history_return_id ON public.return_status_history(return_id);

ALTER TABLE public.return_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage return status history"
  ON public.return_status_history FOR ALL
  USING (return_id IN (
    SELECT id FROM public.returns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ))
  WITH CHECK (return_id IN (
    SELECT id FROM public.returns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- Create tenant_return_settings table
CREATE TABLE public.tenant_return_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  returns_enabled BOOLEAN DEFAULT true,
  return_window_days INTEGER DEFAULT 14,
  default_restocking_fee_percent NUMERIC(5,2) DEFAULT 0,
  credit_note_policy TEXT DEFAULT 'b2b_only',
  credit_note_prefix TEXT DEFAULT 'CN',
  credit_note_auto_email BOOLEAN DEFAULT true,
  customer_portal_enabled BOOLEAN DEFAULT false,
  customer_portal_auth TEXT DEFAULT 'email_order_lookup',
  auto_approve_within_window BOOLEAN DEFAULT true,
  manual_approval_outside_window BOOLEAN DEFAULT true,
  default_refund_method TEXT DEFAULT 'auto_stripe',
  refund_shipping_by_default BOOLEAN DEFAULT true,
  allow_partial_refunds BOOLEAN DEFAULT true,
  marketplace_refund_mode TEXT DEFAULT 'manual_redirect',
  marketplace_auto_accept_within_window BOOLEAN DEFAULT false,
  return_shipping_paid_by TEXT DEFAULT 'customer',
  conditional_free_reasons TEXT[] DEFAULT ARRAY['defect', 'damaged_in_transit', 'wrong_product'],
  return_shipping_provider TEXT DEFAULT 'none',
  auto_generate_return_label BOOLEAN DEFAULT false,
  auto_restock_new_condition BOOLEAN DEFAULT true,
  auto_no_restock_damaged BOOLEAN DEFAULT true,
  stock_impact_notification_threshold INTEGER DEFAULT 10,
  notify_customer_request_received BOOLEAN DEFAULT true,
  notify_customer_approved BOOLEAN DEFAULT true,
  notify_customer_package_received BOOLEAN DEFAULT true,
  notify_customer_refund_processed BOOLEAN DEFAULT true,
  notify_admin_new_request BOOLEAN DEFAULT true,
  enabled_reason_codes TEXT[] DEFAULT ARRAY[
    'defect', 'damaged_in_transit', 'wrong_product', 'wrong_size',
    'not_as_described', 'changed_mind', 'late_delivery', 'duplicate_order', 'other'
  ],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_return_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their return settings"
  ON public.tenant_return_settings FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Insert defaults for existing tenants
INSERT INTO public.tenant_return_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger: auto-create settings row for new tenants
CREATE OR REPLACE FUNCTION public.create_default_return_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.tenant_return_settings (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_return_settings_default
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.create_default_return_settings();

-- RMA number generator
CREATE OR REPLACE FUNCTION public.generate_rma_number(_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(rma_number FROM 'RMA-' || year_prefix || '-(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.returns
  WHERE tenant_id = _tenant_id AND rma_number LIKE 'RMA-' || year_prefix || '-%';
  RETURN 'RMA-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Updated_at triggers
CREATE TRIGGER update_return_items_updated_at
BEFORE UPDATE ON public.return_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_return_settings_updated_at
BEFORE UPDATE ON public.tenant_return_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

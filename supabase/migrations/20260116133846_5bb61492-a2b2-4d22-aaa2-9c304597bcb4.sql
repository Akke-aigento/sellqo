
-- Taak 2: Kortingen op factuur
CREATE TABLE IF NOT EXISTS public.invoice_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'volume', 'coupon', 'commercial')),
  description TEXT,
  value DECIMAL(10,2) NOT NULL,
  applies_to VARCHAR(20) NOT NULL CHECK (applies_to IN ('line', 'subtotal')),
  coupon_code VARCHAR(50),
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.invoice_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice discounts for their tenant" ON public.invoice_discounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_roles ur ON ur.tenant_id = i.tenant_id
      WHERE i.id = invoice_discounts.invoice_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage invoice discounts for their tenant" ON public.invoice_discounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_roles ur ON ur.tenant_id = i.tenant_id
      WHERE i.id = invoice_discounts.invoice_id AND ur.user_id = auth.uid()
    )
  );

-- Lijnkorting kolommen
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12,2);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12,2);

-- Taak 3: Betalingsherinneringen
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminder_level1_days INTEGER DEFAULT 7;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminder_level2_days INTEGER DEFAULT 21;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminder_level3_days INTEGER DEFAULT 35;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminder_late_fee_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS reminder_late_fee_percentage DECIMAL(5,2) DEFAULT 10.00;

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  late_fee_amount DECIMAL(12,2) DEFAULT 0,
  total_due_amount DECIMAL(12,2),
  email_sent_to VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON public.payment_reminders(invoice_id);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment reminders for their tenant" ON public.payment_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_roles ur ON ur.tenant_id = i.tenant_id
      WHERE i.id = payment_reminders.invoice_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage payment reminders for their tenant" ON public.payment_reminders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_roles ur ON ur.tenant_id = i.tenant_id
      WHERE i.id = payment_reminders.invoice_id AND ur.user_id = auth.uid()
    )
  );

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reminder_level INTEGER DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;

-- Taak 4: Pro-forma facturen
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS proforma_prefix VARCHAR(20) DEFAULT 'PF-';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS proforma_start_number INTEGER DEFAULT 1;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS proforma_validity_days INTEGER DEFAULT 30;

CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proforma_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  shipping_method_id UUID REFERENCES public.shipping_methods(id),
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_total DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'converted', 'expired')),
  converted_to_invoice_id UUID REFERENCES public.invoices(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_tenant ON public.proforma_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proforma_customer ON public.proforma_invoices(customer_id);

ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proforma invoices for their tenant" ON public.proforma_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = proforma_invoices.tenant_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage proforma invoices for their tenant" ON public.proforma_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = proforma_invoices.tenant_id AND ur.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.proforma_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  line_type VARCHAR(20) DEFAULT 'product',
  discount_percentage DECIMAL(5,2),
  discount_amount DECIMAL(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.proforma_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proforma lines for their tenant" ON public.proforma_invoice_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.proforma_invoices pi
      JOIN public.user_roles ur ON ur.tenant_id = pi.tenant_id
      WHERE pi.id = proforma_invoice_lines.proforma_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage proforma lines for their tenant" ON public.proforma_invoice_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.proforma_invoices pi
      JOIN public.user_roles ur ON ur.tenant_id = pi.tenant_id
      WHERE pi.id = proforma_invoice_lines.proforma_id AND ur.user_id = auth.uid()
    )
  );

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS proforma_reference VARCHAR(50);

-- Taak 5: Pakbonnen
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS packing_slip_prefix VARCHAR(20) DEFAULT 'PS-';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS packing_slip_start_number INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.packing_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  packing_slip_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  invoice_id UUID REFERENCES public.invoices(id),
  ship_from_address JSONB,
  ship_to_address JSONB,
  total_packages INTEGER DEFAULT 1,
  total_weight DECIMAL(10,3),
  weight_unit VARCHAR(5) DEFAULT 'kg',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_packing_slip_tenant ON public.packing_slips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packing_slip_order ON public.packing_slips(order_id);

ALTER TABLE public.packing_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packing slips for their tenant" ON public.packing_slips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = packing_slips.tenant_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage packing slips for their tenant" ON public.packing_slips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = packing_slips.tenant_id AND ur.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.packing_slip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_slip_id UUID REFERENCES public.packing_slips(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.packing_slip_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packing slip lines for their tenant" ON public.packing_slip_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.packing_slips ps
      JOIN public.user_roles ur ON ur.tenant_id = ps.tenant_id
      WHERE ps.id = packing_slip_lines.packing_slip_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage packing slip lines for their tenant" ON public.packing_slip_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.packing_slips ps
      JOIN public.user_roles ur ON ur.tenant_id = ps.tenant_id
      WHERE ps.id = packing_slip_lines.packing_slip_id AND ur.user_id = auth.uid()
    )
  );

-- Number generators
CREATE OR REPLACE FUNCTION public.generate_proforma_number(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(proforma_prefix, 'PF-'), COALESCE(proforma_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(proforma_number FROM prefix || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.proforma_invoices
  WHERE tenant_id = _tenant_id
    AND proforma_number LIKE prefix || current_year || '-%';
  
  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_packing_slip_number(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(packing_slip_prefix, 'PS-'), COALESCE(packing_slip_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(packing_slip_number FROM prefix || current_year || '-(\d+)') 
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.packing_slips
  WHERE tenant_id = _tenant_id
    AND packing_slip_number LIKE prefix || current_year || '-%';
  
  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Update triggers for proforma
CREATE TRIGGER update_proforma_updated_at
  BEFORE UPDATE ON public.proforma_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

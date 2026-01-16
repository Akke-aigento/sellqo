-- Taak 1: Subscriptions (Terugkerende facturen)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  
  -- Cyclus
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  interval_count INTEGER DEFAULT 1,
  
  -- Bedragen (cache)
  subtotal DECIMAL(12,2) DEFAULT 0,
  vat_total DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  
  -- Timing
  start_date DATE NOT NULL,
  end_date DATE,
  next_invoice_date DATE NOT NULL,
  last_invoice_date DATE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'ended')),
  
  -- Instellingen
  auto_send BOOLEAN DEFAULT TRUE,
  payment_term_days INTEGER DEFAULT 30,
  generate_days_before INTEGER DEFAULT 5,
  
  -- Notificaties
  notify_before_renewal BOOLEAN DEFAULT FALSE,
  notify_days_before INTEGER DEFAULT 7,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_next ON public.subscriptions(next_invoice_date, status);
CREATE INDEX idx_subscriptions_customer ON public.subscriptions(customer_id);
CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);

CREATE TABLE public.subscription_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate_id UUID REFERENCES public.vat_rates(id),
  vat_rate DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_lines_sub ON public.subscription_lines(subscription_id);

-- Link tussen subscription en gegenereerde facturen
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sub_invoices ON public.subscription_invoices(subscription_id);

-- Notificatie log
CREATE TABLE public.subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  next_invoice_date DATE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referentie op factuur
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id);

-- Taak 2: Duplicaat facturen
CREATE TABLE public.invoice_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID,
  reason VARCHAR(50) DEFAULT 'customer_request',
  sent_to_email VARCHAR(255)
);

CREATE INDEX idx_duplicates_invoice ON public.invoice_duplicates(invoice_id);

-- Taak 3: BTW-aangifte export
CREATE TABLE public.vat_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year INTEGER NOT NULL,
  period INTEGER NOT NULL,
  
  -- Berekende waarden
  domestic_taxable DECIMAL(12,2) DEFAULT 0,
  domestic_vat DECIMAL(12,2) DEFAULT 0,
  intra_community DECIMAL(12,2) DEFAULT 0,
  exports DECIMAL(12,2) DEFAULT 0,
  vat_due DECIMAL(12,2) DEFAULT 0,
  
  -- Meta
  invoice_count INTEGER DEFAULT 0,
  credit_note_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'exported', 'submitted')),
  exported_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, year, period)
);

CREATE INDEX idx_vat_returns_tenant ON public.vat_returns(tenant_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Tenant users can view subscriptions"
  ON public.subscriptions FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can create subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for subscription_lines
CREATE POLICY "Tenant users can manage subscription lines"
  ON public.subscription_lines FOR ALL
  USING (subscription_id IN (
    SELECT id FROM public.subscriptions 
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- RLS Policies for subscription_invoices
CREATE POLICY "Tenant users can manage subscription invoices"
  ON public.subscription_invoices FOR ALL
  USING (subscription_id IN (
    SELECT id FROM public.subscriptions 
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- RLS Policies for subscription_notifications
CREATE POLICY "Tenant users can manage subscription notifications"
  ON public.subscription_notifications FOR ALL
  USING (subscription_id IN (
    SELECT id FROM public.subscriptions 
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- RLS Policies for invoice_duplicates
CREATE POLICY "Tenant users can manage invoice duplicates"
  ON public.invoice_duplicates FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for vat_returns
CREATE POLICY "Tenant users can manage VAT returns"
  ON public.vat_returns FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Trigger for subscriptions updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
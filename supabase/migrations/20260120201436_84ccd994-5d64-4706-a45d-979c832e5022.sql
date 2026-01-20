-- POS Terminals - Kassa Registratie
CREATE TABLE public.pos_terminals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  device_id TEXT,
  stripe_reader_id TEXT,
  stripe_location_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB DEFAULT '{"printer": false, "scanner": false, "cash_drawer": false}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Sessions - Dagopening/Sluiting
CREATE TABLE public.pos_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  closed_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  cash_difference DECIMAL(10,2),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Transactions - Verkoop Registratie
CREATE TABLE public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.pos_sessions(id) ON DELETE SET NULL,
  terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Betaalgegevens
  payments JSONB NOT NULL DEFAULT '[]'::jsonb,
  cash_received DECIMAL(10,2),
  cash_change DECIMAL(10,2),
  
  -- Stripe Terminal specifiek
  stripe_payment_intent_id TEXT,
  stripe_reader_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  
  -- Bedragen
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Items snapshot
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
  voided_at TIMESTAMPTZ,
  voided_by UUID,
  voided_reason TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID,
  
  -- Receipt
  receipt_number TEXT,
  receipt_printed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Cash Movements - Kas In/Uit
CREATE TABLE public.pos_cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Offline Queue - Offline Transactie Sync
CREATE TABLE public.pos_offline_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  transaction_data JSONB NOT NULL,
  created_offline_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Quick Buttons - Snelknoppen
CREATE TABLE public.pos_quick_buttons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id UUID REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS Parked Carts - Geparkeerde Winkelwagens
CREATE TABLE public.pos_parked_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.pos_sessions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  parked_by UUID NOT NULL,
  parked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at TIMESTAMPTZ,
  resumed_by UUID,
  status TEXT NOT NULL DEFAULT 'parked' CHECK (status IN ('parked', 'resumed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_offline_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_quick_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_parked_carts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_terminals (using user_roles table)
CREATE POLICY "Users can view terminals in their tenant"
  ON public.pos_terminals FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create terminals in their tenant"
  ON public.pos_terminals FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update terminals in their tenant"
  ON public.pos_terminals FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete terminals in their tenant"
  ON public.pos_terminals FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_sessions
CREATE POLICY "Users can view sessions in their tenant"
  ON public.pos_sessions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create sessions in their tenant"
  ON public.pos_sessions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update sessions in their tenant"
  ON public.pos_sessions FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_transactions
CREATE POLICY "Users can view transactions in their tenant"
  ON public.pos_transactions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create transactions in their tenant"
  ON public.pos_transactions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update transactions in their tenant"
  ON public.pos_transactions FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_cash_movements
CREATE POLICY "Users can view cash movements in their tenant"
  ON public.pos_cash_movements FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create cash movements in their tenant"
  ON public.pos_cash_movements FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_offline_queue
CREATE POLICY "Users can view offline queue in their tenant"
  ON public.pos_offline_queue FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create offline queue items in their tenant"
  ON public.pos_offline_queue FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update offline queue in their tenant"
  ON public.pos_offline_queue FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete offline queue items in their tenant"
  ON public.pos_offline_queue FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_quick_buttons
CREATE POLICY "Users can view quick buttons in their tenant"
  ON public.pos_quick_buttons FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create quick buttons in their tenant"
  ON public.pos_quick_buttons FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update quick buttons in their tenant"
  ON public.pos_quick_buttons FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete quick buttons in their tenant"
  ON public.pos_quick_buttons FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for pos_parked_carts
CREATE POLICY "Users can view parked carts in their tenant"
  ON public.pos_parked_carts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create parked carts in their tenant"
  ON public.pos_parked_carts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update parked carts in their tenant"
  ON public.pos_parked_carts FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete parked carts in their tenant"
  ON public.pos_parked_carts FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_pos_terminals_tenant ON public.pos_terminals(tenant_id);
CREATE INDEX idx_pos_sessions_tenant ON public.pos_sessions(tenant_id);
CREATE INDEX idx_pos_sessions_terminal ON public.pos_sessions(terminal_id);
CREATE INDEX idx_pos_sessions_status ON public.pos_sessions(status);
CREATE INDEX idx_pos_transactions_tenant ON public.pos_transactions(tenant_id);
CREATE INDEX idx_pos_transactions_session ON public.pos_transactions(session_id);
CREATE INDEX idx_pos_transactions_terminal ON public.pos_transactions(terminal_id);
CREATE INDEX idx_pos_transactions_created ON public.pos_transactions(created_at DESC);
CREATE INDEX idx_pos_cash_movements_session ON public.pos_cash_movements(session_id);
CREATE INDEX idx_pos_offline_queue_status ON public.pos_offline_queue(sync_status);
CREATE INDEX idx_pos_quick_buttons_terminal ON public.pos_quick_buttons(terminal_id);
CREATE INDEX idx_pos_parked_carts_status ON public.pos_parked_carts(status);

-- Triggers for updated_at
CREATE TRIGGER update_pos_terminals_updated_at
  BEFORE UPDATE ON public.pos_terminals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_sessions_updated_at
  BEFORE UPDATE ON public.pos_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_transactions_updated_at
  BEFORE UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_quick_buttons_updated_at
  BEFORE UPDATE ON public.pos_quick_buttons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate receipt numbers
CREATE OR REPLACE FUNCTION public.generate_pos_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  receipt_prefix TEXT;
  receipt_seq INTEGER;
BEGIN
  -- Get today's date as prefix
  receipt_prefix := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get next sequence for this tenant today
  SELECT COALESCE(MAX(
    CASE 
      WHEN receipt_number LIKE receipt_prefix || '-%' 
      THEN CAST(SUBSTRING(receipt_number FROM LENGTH(receipt_prefix) + 2) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO receipt_seq
  FROM public.pos_transactions
  WHERE tenant_id = NEW.tenant_id
    AND receipt_number LIKE receipt_prefix || '-%';
  
  NEW.receipt_number := receipt_prefix || '-' || LPAD(receipt_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_receipt_number
  BEFORE INSERT ON public.pos_transactions
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL)
  EXECUTE FUNCTION public.generate_pos_receipt_number();

-- Function to calculate expected cash for session
CREATE OR REPLACE FUNCTION public.calculate_session_expected_cash(p_session_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_opening_cash DECIMAL(10,2);
  v_cash_sales DECIMAL(10,2);
  v_cash_movements DECIMAL(10,2);
BEGIN
  -- Get opening cash
  SELECT opening_cash INTO v_opening_cash
  FROM public.pos_sessions WHERE id = p_session_id;
  
  -- Calculate cash from sales
  SELECT COALESCE(SUM(
    (SELECT COALESCE(SUM((p->>'amount')::DECIMAL), 0)
     FROM jsonb_array_elements(payments) AS p
     WHERE p->>'method' = 'cash')
  ), 0) - COALESCE(SUM(cash_change), 0)
  INTO v_cash_sales
  FROM public.pos_transactions
  WHERE session_id = p_session_id AND status = 'completed';
  
  -- Calculate cash movements
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'in' THEN amount
      WHEN movement_type = 'out' THEN -amount
      ELSE 0
    END
  ), 0)
  INTO v_cash_movements
  FROM public.pos_cash_movements
  WHERE session_id = p_session_id;
  
  RETURN v_opening_cash + v_cash_sales + v_cash_movements;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
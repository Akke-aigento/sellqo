-- Payment confirmations audit log voor handmatige betalingsbevestigingen
CREATE TABLE public.payment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  confirmed_by UUID REFERENCES auth.users(id),
  payment_method TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;

-- Users can view confirmations for their tenant
CREATE POLICY "Users can view own tenant confirmations"
  ON public.payment_confirmations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Staff, accountant, and admins can insert confirmations
CREATE POLICY "Staff+ can insert confirmations"
  ON public.payment_confirmations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'staff', 'accountant')
  ));

-- Index for faster lookups by order
CREATE INDEX idx_payment_confirmations_order_id ON public.payment_confirmations(order_id);
CREATE INDEX idx_payment_confirmations_tenant_id ON public.payment_confirmations(tenant_id);
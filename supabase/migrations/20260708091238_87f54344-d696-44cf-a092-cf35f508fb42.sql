
-- SUB-2: Automatic payment collection for subscription invoices

-- Extend invoice status enum with 'processing' and 'unpaid'
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'unpaid';

-- Add charge_attempts to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS charge_attempts integer NOT NULL DEFAULT 0;

-- Mandates table
CREATE TABLE IF NOT EXISTS public.customer_payment_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL,
  method_type text NOT NULL CHECK (method_type IN ('sepa_debit','card')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','revoked','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_mandates TO authenticated;
GRANT ALL ON public.customer_payment_mandates TO service_role;

ALTER TABLE public.customer_payment_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandates_select" ON public.customer_payment_mandates
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  );

CREATE POLICY "mandates_insert" ON public.customer_payment_mandates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
  );

CREATE POLICY "mandates_update" ON public.customer_payment_mandates
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
  );

CREATE POLICY "mandates_delete" ON public.customer_payment_mandates
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE TRIGGER update_customer_payment_mandates_updated_at
  BEFORE UPDATE ON public.customer_payment_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mandates_tenant_customer ON public.customer_payment_mandates(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON public.customer_payment_mandates(status);

-- Mandate setup tokens
CREATE TABLE IF NOT EXISTS public.mandate_setup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mandate_setup_tokens TO authenticated;
GRANT ALL ON public.mandate_setup_tokens TO service_role;

ALTER TABLE public.mandate_setup_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandate_tokens_select" ON public.mandate_setup_tokens
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  );

CREATE POLICY "mandate_tokens_insert" ON public.mandate_setup_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
  );

CREATE INDEX IF NOT EXISTS idx_mandate_tokens_token ON public.mandate_setup_tokens(token);

-- Enums
DO $$ BEGIN
  CREATE TYPE public.billing_payment_mode AS ENUM ('mandate','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_model AS ENUM ('pay_first','invoice_first');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle_status AS ENUM ('pending','awaiting_payment','processing','settled','expired','reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions: new columns.
-- Added with DEFAULT 'invoice_first' so every EXISTING row keeps current behaviour
-- byte-for-byte; the default is then flipped to 'pay_first' for future rows.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_mode public.billing_payment_mode NOT NULL DEFAULT 'mandate',
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model NOT NULL DEFAULT 'invoice_first';

ALTER TABLE public.subscriptions
  ALTER COLUMN billing_model SET DEFAULT 'pay_first';

-- billing_cycles
CREATE TABLE IF NOT EXISTS public.billing_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  customer_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  mode public.billing_payment_mode NOT NULL,
  model public.billing_model NOT NULL DEFAULT 'pay_first',
  status public.billing_cycle_status NOT NULL DEFAULT 'pending',
  payment_request_number text,
  due_date date,
  grace_until date,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  reminder_level integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_cycles_sub_period_key
  ON public.billing_cycles (subscription_id, period_start);
CREATE UNIQUE INDEX IF NOT EXISTS billing_cycles_pr_number_key
  ON public.billing_cycles (tenant_id, payment_request_number)
  WHERE payment_request_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_cycles_status_due_idx
  ON public.billing_cycles (status, due_date);
CREATE INDEX IF NOT EXISTS billing_cycles_tenant_status_idx
  ON public.billing_cycles (tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_cycles TO authenticated;
GRANT ALL ON public.billing_cycles TO service_role;

ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view billing cycles" ON public.billing_cycles;
CREATE POLICY "Tenant members can view billing cycles"
  ON public.billing_cycles FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Tenant members can insert billing cycles" ON public.billing_cycles;
CREATE POLICY "Tenant members can insert billing cycles"
  ON public.billing_cycles FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Tenant members can update billing cycles" ON public.billing_cycles;
CREATE POLICY "Tenant members can update billing cycles"
  ON public.billing_cycles FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Tenant members can delete billing cycles" ON public.billing_cycles;
CREATE POLICY "Tenant members can delete billing cycles"
  ON public.billing_cycles FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP TRIGGER IF EXISTS update_billing_cycles_updated_at ON public.billing_cycles;
CREATE TRIGGER update_billing_cycles_updated_at
  BEFORE UPDATE ON public.billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment request number sequence (PR-YYYY-0001), mirrors generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_payment_request_number(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(payment_request_number FROM 'PR-' || current_year || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.billing_cycles
  WHERE tenant_id = _tenant_id
    AND payment_request_number LIKE 'PR-' || current_year || '-%';

  RETURN 'PR-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_payment_request_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_payment_request_number(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_payment_request_number(uuid) TO authenticated, service_role;
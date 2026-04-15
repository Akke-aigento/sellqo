
-- A) Nieuwe enum refund_status
CREATE TYPE public.refund_status_enum AS ENUM (
  'pending',
  'approved_for_refund',
  'initiated',
  'completed',
  'failed',
  'denied',
  'not_applicable'
);

-- B) Migreer returns.refund_status van TEXT naar de nieuwe enum
ALTER TABLE public.returns 
  ALTER COLUMN refund_status DROP DEFAULT,
  ALTER COLUMN refund_status TYPE public.refund_status_enum USING (
    CASE 
      WHEN refund_status IS NULL THEN 'pending'::refund_status_enum
      WHEN refund_status = 'completed' THEN 'completed'::refund_status_enum
      WHEN refund_status = 'failed' THEN 'failed'::refund_status_enum
      WHEN refund_status = 'pending' THEN 'pending'::refund_status_enum
      ELSE 'pending'::refund_status_enum
    END
  ),
  ALTER COLUMN refund_status SET DEFAULT 'pending';

-- C) Logistieke status enum uitbreiden
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'label_sent';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'inspected';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'closed';

-- D) Financiële audit timestamps + label tracking velden
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS refund_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_initiated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS label_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS label_carrier TEXT,
  ADD COLUMN IF NOT EXISTS label_sent_at TIMESTAMPTZ;

-- E) Status history krijgt flow_type
ALTER TABLE public.return_status_history
  ADD COLUMN IF NOT EXISTS flow_type TEXT DEFAULT 'logistics' 
    CHECK (flow_type IN ('logistics', 'financial', 'system'));

-- F) Tenant setting
ALTER TABLE public.tenant_return_settings
  ADD COLUMN IF NOT EXISTS refund_requires_inspection BOOLEAN DEFAULT true;

-- G) Order tag SQL functie
CREATE OR REPLACE FUNCTION public.get_order_return_tag(_order_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_returns BOOLEAN;
  all_completed BOOLEAN;
  any_awaiting_refund BOOLEAN;
  any_denied BOOLEAN;
  any_partial BOOLEAN;
  total_items INTEGER;
  returned_items INTEGER;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.returns WHERE order_id = _order_id) INTO has_returns;
  IF NOT has_returns THEN RETURN NULL; END IF;
  
  SELECT NOT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND (status NOT IN ('closed') OR refund_status NOT IN ('completed', 'not_applicable', 'denied'))
  ) INTO all_completed;
  
  SELECT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND status IN ('inspected', 'closed') 
      AND refund_status IN ('pending', 'approved_for_refund', 'initiated')
  ) INTO any_awaiting_refund;
  
  SELECT EXISTS (
    SELECT 1 FROM public.returns 
    WHERE order_id = _order_id 
      AND (status IN ('rejected', 'cancelled') OR refund_status = 'denied')
  ) INTO any_denied;

  SELECT 
    (SELECT COALESCE(SUM(quantity), 0) FROM public.order_items WHERE order_id = _order_id),
    (SELECT COALESCE(SUM(ri.quantity), 0) FROM public.return_items ri 
     JOIN public.returns r ON ri.return_id = r.id 
     WHERE r.order_id = _order_id AND r.status NOT IN ('rejected', 'cancelled'))
  INTO total_items, returned_items;
  any_partial := returned_items < total_items;
  
  RETURN CASE
    WHEN all_completed THEN 'retour_ok'
    WHEN any_awaiting_refund THEN 'retour_wacht_op_refund'
    WHEN any_denied THEN 'retour_afgewezen'
    WHEN any_partial THEN 'retour_deels_lopend'
    ELSE 'retour_lopend'
  END;
END;
$$;

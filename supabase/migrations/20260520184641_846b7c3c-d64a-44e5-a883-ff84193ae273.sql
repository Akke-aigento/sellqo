-- ============================================================
-- ACCOUNTING REPORTS — PHASE 1: DATABASE FOUNDATION
-- ============================================================

-- 1) vat_regimes lookup table
CREATE TABLE IF NOT EXISTS public.vat_regimes (
  code VARCHAR(40) PRIMARY KEY,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT,
  applies_vat BOOLEAN NOT NULL DEFAULT true,
  reverse_charge BOOLEAN NOT NULL DEFAULT false,
  output_vat_box VARCHAR(3),
  invoice_text_nl TEXT,
  invoice_text_fr TEXT,
  invoice_text_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the 12 default regimes
INSERT INTO public.vat_regimes (code, description_nl, output_vat_box, applies_vat, reverse_charge, invoice_text_nl) VALUES
  ('domestic_standard', 'Binnenland standaardtarief 21%', '03', true, false, NULL),
  ('domestic_reduced_6', 'Binnenland verlaagd tarief 6%', '01', true, false, NULL),
  ('domestic_reduced_12', 'Binnenland verlaagd tarief 12%', '02', true, false, NULL),
  ('domestic_zero', 'Binnenland 0%', '00', true, false, NULL),
  ('ic_supply_goods', 'Intracommunautaire levering goederen', '46', false, true, 'Vrijgesteld van btw - Intracommunautaire levering - artikel 39bis WBTW'),
  ('ic_supply_services', 'Intracommunautaire dienst (verlegging)', '44', false, true, 'Btw verlegd - artikel 21 §2 WBTW'),
  ('ic_triangulation', 'Driehoekshandel', '46', false, true, 'Driehoekshandel - artikel 25ter WBTW'),
  ('oss_b2c_eu', 'OSS B2C EU (één-loket)', NULL, true, false, NULL),
  ('export_outside_eu', 'Export buiten EU', '47', false, false, 'Vrijgesteld van btw - Uitvoer - artikel 39 WBTW'),
  ('reverse_charge_construction', 'Werk in onroerend goed met verlegging', '45', false, true, 'Btw verlegd - artikel 20 KB1'),
  ('marketplace_deemed_supplier', 'Marketplace deemed supplier', '47', false, false, 'Vrijgesteld - marketplace deemed supplier - art. 13bis WBTW'),
  ('exempt_article_44', 'Vrijgesteld onder artikel 44 WBTW', NULL, false, false, 'Vrijgesteld van btw - artikel 44 WBTW')
ON CONFLICT (code) DO NOTHING;

-- 2) Extend invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_regime VARCHAR(40) REFERENCES public.vat_regimes(code) DEFAULT 'domestic_standard';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_point_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reporting_country CHAR(2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_number_validated_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_number_validated_value VARCHAR(20);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_rounding_strategy VARCHAR(20) DEFAULT 'per_rate';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS peppol_message_id VARCHAR(100);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS peppol_delivered_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS peppol_error TEXT;

-- Add CHECK constraint for vat_rounding_strategy (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_vat_rounding_strategy_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_vat_rounding_strategy_check
      CHECK (vat_rounding_strategy IN ('per_rate','per_line','document_total'));
  END IF;
END$$;

-- 3) Backfill in correct order
UPDATE public.invoices
SET issue_date = COALESCE(sent_at::date, created_at::date)
WHERE issue_date IS NULL;

UPDATE public.invoices
SET vat_point_date = issue_date
WHERE vat_point_date IS NULL;

UPDATE public.invoices i
SET reporting_country = c.billing_country
FROM public.customers c
WHERE i.customer_id = c.id
  AND i.reporting_country IS NULL
  AND c.billing_country IS NOT NULL;

-- Lock issue_date down
ALTER TABLE public.invoices ALTER COLUMN issue_date SET DEFAULT CURRENT_DATE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE issue_date IS NULL) THEN
    RAISE EXCEPTION 'Cannot set issue_date NOT NULL: % rows still NULL',
      (SELECT COUNT(*) FROM public.invoices WHERE issue_date IS NULL);
  END IF;
END$$;

ALTER TABLE public.invoices ALTER COLUMN issue_date SET NOT NULL;

-- 4) Reporting indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date
  ON public.invoices (tenant_id, issue_date);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date_status
  ON public.invoices (tenant_id, issue_date, status);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_regime
  ON public.invoices (tenant_id, vat_regime);

-- 5) Extend invoice_lines
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(10);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS vat_box_code VARCHAR(3);

-- 6) vat_report_cache table
CREATE TABLE IF NOT EXISTS public.vat_report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, period_start, period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_vat_report_cache_lookup
  ON public.vat_report_cache (tenant_id, period_start, period_end)
  WHERE invalidated_at IS NULL;

-- 7) RLS on vat_report_cache
ALTER TABLE public.vat_report_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vat_report_cache'
      AND policyname = 'Users can view their tenant''s cache'
  ) THEN
    CREATE POLICY "Users can view their tenant's cache"
      ON public.vat_report_cache
      FOR SELECT
      USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
  END IF;
END$$;

-- 8) Cache invalidation trigger
CREATE OR REPLACE FUNCTION public.invalidate_vat_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _check_date DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant_id := OLD.tenant_id;
    _check_date := OLD.issue_date;
  ELSE
    _tenant_id := NEW.tenant_id;
    _check_date := NEW.issue_date;
  END IF;

  IF _tenant_id IS NOT NULL AND _check_date IS NOT NULL THEN
    UPDATE public.vat_report_cache
    SET invalidated_at = now()
    WHERE tenant_id = _tenant_id
      AND _check_date BETWEEN period_start AND period_end
      AND invalidated_at IS NULL;
  END IF;

  -- On UPDATE, also invalidate the OLD period if issue_date changed
  IF TG_OP = 'UPDATE' AND OLD.issue_date IS DISTINCT FROM NEW.issue_date AND OLD.issue_date IS NOT NULL THEN
    UPDATE public.vat_report_cache
    SET invalidated_at = now()
    WHERE tenant_id = OLD.tenant_id
      AND OLD.issue_date BETWEEN period_start AND period_end
      AND invalidated_at IS NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_invalidate_cache ON public.invoices;
CREATE TRIGGER trg_invoices_invalidate_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_vat_cache();
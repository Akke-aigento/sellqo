-- DISCOUNT-CASE-1 — kortingscodes canoniek in hoofdletters + case-insensitieve uniciteit.
-- Idempotent. Handmatig terugdraaien: DROP INDEX IF EXISTS public.discount_codes_tenant_upper_code_key;
DO $$
DECLARE v_conflicts text;
BEGIN
  SELECT string_agg(format('tenant %s: %s', tenant_id, c), '; ')
  INTO v_conflicts
  FROM (
    SELECT tenant_id, upper(btrim(code)) AS c
    FROM public.discount_codes
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) x;

  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'DISCOUNT-CASE-1: conflicterende kortingscodes (verschillende casing) — handmatig oplossen: %', v_conflicts;
  END IF;
END $$;

UPDATE public.discount_codes
SET code = upper(btrim(code))
WHERE code <> upper(btrim(code));

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_tenant_upper_code_key
  ON public.discount_codes (tenant_id, upper(code));
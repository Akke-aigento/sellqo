-- INVOICE-INTEGRITY-1 — de databank weigert een factuur die niet klopt.
--
-- 1. create_invoice_with_lines(p_invoice jsonb, p_lines jsonb, p_cancel_existing_for_order boolean) → uuid
--    Maakt factuur en regels in ÉÉN transactie, en weigert (RAISE, niets geschreven) als:
--      - er geen regels zijn;
--      - een regel geen net_amount/vat_amount/gross_amount heeft, of een bedrag niet op de
--        cent staat, of netto + btw ≠ bruto;
--      - subtotal ≠ Σ netto, tax_amount ≠ Σ btw of total ≠ Σ bruto van de regels;
--      - de factuur of een regel een onbekende kolom meekrijgt.
--    Tot 27-10 schreef generate-invoice header en regels los, en zat een kortingscode
--    enkel in het totaal (15 Fonske-facturen van €0 met regels van €19/€25).
--    Met p_cancel_existing_for_order (generate-invoice force_new) worden de bestaande facturen
--    van dezelfde order in DEZELFDE transactie geannuleerd, dus enkel als de nieuwe klopt.
--    Alleen service_role mag de functie uitvoeren.
--
-- 2. Hoogstens één niet-geannuleerde factuur per order (unieke partiële index).
--    Tot nu toe kon een tweede aanroep 2,4 s later een tweede factuur maken (INV-2026-0008 en
--    INV-2026-0009, Fonske-order #0009). Die bestaande dubbele staat apart in de index
--    uitgezonderd (vaste id): de rechtzetting gebeurt via een creditnota, met akkoord van de
--    boekhouder, niet in deze migratie.
--
-- 3. invoice_lines.unit_price en credit_note_lines.unit_price: numeric(12,2) → numeric(14,4).
--    Netto-eenheidsprijzen uit inclusieve prijzen hebben meer dan 2 decimalen (19,95 / 1,21 =
--    16,4876). Op 2 decimalen gaf 7 × 16,49 = 115,43 in Odoo tegen 115,41 netto op de factuur.
--
-- DOWN (handmatig):
--   drop function if exists public.create_invoice_with_lines(jsonb, jsonb, boolean);
--   (unit_price terug naar numeric(12,2) enkel als geen enkele waarde meer dan 2 decimalen heeft)
--   drop index if exists public.invoices_order_active_uniq;

ALTER TABLE public.invoice_lines ALTER COLUMN unit_price TYPE numeric(14,4);
ALTER TABLE public.credit_note_lines ALTER COLUMN unit_price TYPE numeric(14,4);

-- Nooit twee overloads (een 2-argumentenversie maakt een aanroep zonder 3de argument dubbelzinnig).
DROP FUNCTION IF EXISTS public.create_invoice_with_lines(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_invoice_with_lines(
  p_invoice jsonb,
  p_lines jsonb,
  p_cancel_existing_for_order boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_cols text;
  v_bad text;
  v_line jsonb;
  v_n int := 0;
  v_net numeric := 0;
  v_vat numeric := 0;
  v_gross numeric := 0;
  v_ln numeric; v_lv numeric; v_lg numeric;
BEGIN
  IF jsonb_typeof(p_invoice) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVOICE_INTEGRITY: factuur ontbreekt';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'INVOICE_INTEGRITY: een factuur zonder regels';
  END IF;

  -- Onbekende kolommen = programmeerfout; nooit stil negeren.
  SELECT string_agg(k, ', ') INTO v_bad
  FROM jsonb_object_keys(p_invoice) k
  WHERE k NOT IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'INVOICE_INTEGRITY: onbekende factuurkolom(men): %', v_bad;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_n := v_n + 1;
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'INVOICE_INTEGRITY: regel % is geen object', v_n;
    END IF;
    SELECT string_agg(k, ', ') INTO v_bad
    FROM jsonb_object_keys(v_line) k
    WHERE k = 'invoice_id'
       OR k NOT IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice_lines');
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'INVOICE_INTEGRITY: regel %: onbekende of verboden kolom(men): %', v_n, v_bad;
    END IF;
    IF v_line->>'net_amount' IS NULL OR v_line->>'vat_amount' IS NULL OR v_line->>'gross_amount' IS NULL THEN
      RAISE EXCEPTION 'INVOICE_INTEGRITY: regel % mist net_amount, vat_amount of gross_amount', v_n;
    END IF;
    v_ln := (v_line->>'net_amount')::numeric;
    v_lv := (v_line->>'vat_amount')::numeric;
    v_lg := (v_line->>'gross_amount')::numeric;
    IF v_ln <> round(v_ln, 2) OR v_lv <> round(v_lv, 2) OR v_lg <> round(v_lg, 2) THEN
      RAISE EXCEPTION 'INVOICE_INTEGRITY: regel % staat niet op de cent (% / % / %)', v_n, v_ln, v_lv, v_lg;
    END IF;
    IF v_ln + v_lv <> v_lg THEN
      RAISE EXCEPTION 'INVOICE_INTEGRITY: regel %: netto % + btw % ≠ bruto %', v_n, v_ln, v_lv, v_lg;
    END IF;
    v_net := v_net + v_ln;
    v_vat := v_vat + v_lv;
    v_gross := v_gross + v_lg;
  END LOOP;

  IF (p_invoice->>'subtotal')::numeric IS DISTINCT FROM v_net
     OR (p_invoice->>'tax_amount')::numeric IS DISTINCT FROM v_vat
     OR (p_invoice->>'total')::numeric IS DISTINCT FROM v_gross THEN
    RAISE EXCEPTION 'INVOICE_INTEGRITY: factuur % / % / % ≠ regels % / % / %',
      p_invoice->>'subtotal', p_invoice->>'tax_amount', p_invoice->>'total', v_net, v_vat, v_gross;
  END IF;

  IF p_cancel_existing_for_order AND p_invoice->>'order_id' IS NOT NULL THEN
    UPDATE public.invoices SET status = 'cancelled'
    WHERE order_id = (p_invoice->>'order_id')::uuid AND status <> 'cancelled';
  END IF;

  SELECT string_agg(quote_ident(k), ', ') INTO v_cols FROM jsonb_object_keys(p_invoice) k;
  EXECUTE format(
    'INSERT INTO public.invoices (%s) SELECT %s FROM jsonb_populate_record(NULL::public.invoices, $1) RETURNING id',
    v_cols, v_cols
  ) USING p_invoice INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_line := v_line || jsonb_build_object('invoice_id', v_id);
    SELECT string_agg(quote_ident(k), ', ') INTO v_cols FROM jsonb_object_keys(v_line) k;
    EXECUTE format(
      'INSERT INTO public.invoice_lines (%s) SELECT %s FROM jsonb_populate_record(NULL::public.invoice_lines, $1)',
      v_cols, v_cols
    ) USING v_line;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_with_lines(jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines(jsonb, jsonb, boolean) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_active_uniq
  ON public.invoices (order_id)
  WHERE order_id IS NOT NULL
    AND status <> 'cancelled'
    AND id <> '0f3826ec-d4bb-4612-b630-7688608a8eac'; -- INV-2026-0009 (dubbel van INV-2026-0008, Fonske #0009)

-- Controle na uitrol:
--   select has_function_privilege('authenticated', 'public.create_invoice_with_lines(jsonb,jsonb,boolean)', 'execute'); -- false
--   select indexdef from pg_indexes where indexname = 'invoices_order_active_uniq';

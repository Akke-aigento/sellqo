CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_credit_note_from_return(_return_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_return RECORD;
  v_invoice RECORD;
  v_cn_number text;
  v_cn_id uuid;
  v_reason text;
  v_refund numeric;
  v_subtotal numeric;
  v_tax numeric;
  v_vat_rate numeric := 0;
  v_supabase_url text;
  v_anon_key text;
  v_language text;
BEGIN
  SELECT * INTO v_return FROM public.returns WHERE id = _return_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'Return % not found', _return_id;
    RETURN NULL;
  END IF;

  IF COALESCE(v_return.refund_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE order_id = v_return.order_id
    AND tenant_id = v_return.tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE 'No invoice found for return % (order %)', _return_id, v_return.order_id;
    RETURN NULL;
  END IF;

  v_reason := 'Automatisch gegenereerd voor retour ' || COALESCE(v_return.rma_number, _return_id::text);

  SELECT id INTO v_cn_id
  FROM public.credit_notes
  WHERE original_invoice_id = v_invoice.id
    AND tenant_id = v_return.tenant_id
    AND reason ILIKE 'Automatisch%' || COALESCE(v_return.rma_number, '') || '%'
  LIMIT 1;

  IF v_cn_id IS NOT NULL THEN
    RETURN v_cn_id;
  END IF;

  v_refund := v_return.refund_amount;
  IF COALESCE(v_invoice.total, 0) > 0 AND COALESCE(v_invoice.subtotal, 0) > 0 THEN
    v_subtotal := round((v_refund * (v_invoice.subtotal / v_invoice.total))::numeric, 2);
    v_tax := round((v_refund - v_subtotal)::numeric, 2);
    IF v_invoice.subtotal > 0 THEN
      v_vat_rate := round(((v_invoice.tax_amount / v_invoice.subtotal) * 100)::numeric, 2);
    END IF;
  ELSE
    v_subtotal := v_refund;
    v_tax := 0;
  END IF;

  v_cn_number := public.generate_credit_note_number(v_return.tenant_id);

  INSERT INTO public.credit_notes (
    tenant_id, credit_note_number, original_invoice_id, customer_id,
    type, reason, subtotal, tax_amount, total, status, issue_date
  ) VALUES (
    v_return.tenant_id, v_cn_number, v_invoice.id, v_invoice.customer_id,
    'partial', v_reason, v_subtotal, v_tax, v_refund, 'draft', CURRENT_DATE
  ) RETURNING id INTO v_cn_id;

  INSERT INTO public.credit_note_lines (
    credit_note_id, description, quantity, unit_price, vat_rate, vat_amount, line_total, line_type
  ) VALUES (
    v_cn_id,
    'Terugbetaling retour ' || COALESCE(v_return.rma_number, _return_id::text),
    1, v_subtotal, v_vat_rate, v_tax, v_subtotal, 'product'
  );

  -- Async worker: trigger PDF generation + customer email via pg_net.
  -- Non-blocking; failures land in net._http_response. Status stays 'draft' on failure,
  -- admin can manually "Email opnieuw versturen" via UI.
  BEGIN
    SELECT value INTO v_supabase_url FROM public.internal_config WHERE key = 'supabase_url';
    SELECT value INTO v_anon_key    FROM public.internal_config WHERE key = 'supabase_anon_key';
    v_language := COALESCE(NULLIF(v_invoice.language, ''), 'nl');

    IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url     := v_supabase_url || '/functions/v1/generate-credit-note',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body    := jsonb_build_object(
          'credit_note_id', v_cn_id,
          'language', v_language,
          'auto_send_email', true
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net dispatch failed for credit_note %: %', v_cn_id, SQLERRM;
  END;

  RETURN v_cn_id;
END;
$function$;
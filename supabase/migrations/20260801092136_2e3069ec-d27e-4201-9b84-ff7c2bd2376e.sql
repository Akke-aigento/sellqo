-- SEC-0b: autorisatiechecks in bucket-B SECURITY DEFINER functies

-- ============ GROEP 1: dood — volledig intrekken (alleen service_role) ============
REVOKE EXECUTE ON FUNCTION public.generate_content_hash(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_content_hash(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_invitation_effective_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_invitation_effective_status(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.initialize_ai_assistant_config(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.initialize_ai_assistant_config(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.initialize_customer_communication_settings(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.initialize_customer_communication_settings(uuid) TO service_role;

-- ============ GROEP 2: enkel anon intrekken ============
REVOKE EXECUTE ON FUNCTION public.generate_gift_card_code() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_gift_card_code() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_fulfillment_api_key() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_fulfillment_api_key() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_platform_ogm() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_platform_ogm() TO authenticated, service_role;

-- ============ GROEP 3a: tenant-guard ============

-- generate_invoice_number (ook via edge functions op service-role)
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(invoice_prefix, 'INV'), COALESCE(invoice_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM prefix || '-' || current_year || '-(\d+)')
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.invoices
  WHERE tenant_id = _tenant_id
    AND invoice_number LIKE prefix || '-' || current_year || '-%';

  RETURN prefix || '-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon;

-- generate_order_number (ook via edge functions op service-role)
CREATE OR REPLACE FUNCTION public.generate_order_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders
  WHERE tenant_id = _tenant_id;

  RETURN '#' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(uuid) FROM PUBLIC, anon;

-- generate_credit_note_number (ook via edge function + interne functie create_credit_note_from_return)
CREATE OR REPLACE FUNCTION public.generate_credit_note_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(credit_note_prefix, 'CN-'), COALESCE(credit_note_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(credit_note_number FROM prefix || current_year || '-(\d+)')
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.credit_notes
  WHERE tenant_id = _tenant_id
    AND credit_note_number LIKE prefix || current_year || '-%';

  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_credit_note_number(uuid) FROM PUBLIC, anon;

-- generate_quote_number
CREATE OR REPLACE FUNCTION public.generate_quote_number(_tenant_id uuid)
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
    CAST(
      SUBSTRING(quote_number FROM 'Q-' || current_year || '-(\d+)')
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE tenant_id = _tenant_id
    AND quote_number LIKE 'Q-' || current_year || '-%';

  RETURN 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_quote_number(uuid) FROM PUBLIC, anon;

-- generate_rma_number
CREATE OR REPLACE FUNCTION public.generate_rma_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(rma_number FROM 'RMA-' || year_prefix || '-(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.returns
  WHERE tenant_id = _tenant_id AND rma_number LIKE 'RMA-' || year_prefix || '-%';
  RETURN 'RMA-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_rma_number(uuid) FROM PUBLIC, anon;

-- generate_po_number
CREATE OR REPLACE FUNCTION public.generate_po_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM purchase_orders WHERE tenant_id = p_tenant_id AND order_number LIKE 'PO-' || v_year || '-%';
  RETURN 'PO-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_po_number(uuid) FROM PUBLIC, anon;

-- generate_proforma_number
CREATE OR REPLACE FUNCTION public.generate_proforma_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(proforma_prefix, 'PF-'), COALESCE(proforma_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(proforma_number FROM prefix || current_year || '-(\d+)')
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.proforma_invoices
  WHERE tenant_id = _tenant_id
    AND proforma_number LIKE prefix || current_year || '-%';

  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_proforma_number(uuid) FROM PUBLIC, anon;

-- generate_packing_slip_number
CREATE OR REPLACE FUNCTION public.generate_packing_slip_number(_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  prefix TEXT;
  start_number INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(packing_slip_prefix, 'PS-'), COALESCE(packing_slip_start_number, 1)
  INTO prefix, start_number
  FROM public.tenants WHERE id = _tenant_id;

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(packing_slip_number FROM prefix || current_year || '-(\d+)')
      AS INTEGER
    )
  ), start_number - 1) + 1
  INTO next_number
  FROM public.packing_slips
  WHERE tenant_id = _tenant_id
    AND packing_slip_number LIKE prefix || current_year || '-%';

  RETURN prefix || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_packing_slip_number(uuid) FROM PUBLIC, anon;

-- get_tenant_storage_bytes (was LANGUAGE sql; plpgsql nodig voor de guard, STABLE behouden)
CREATE OR REPLACE FUNCTION public.get_tenant_storage_bytes(p_tenant_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bytes bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  INTO v_bytes
  FROM storage.objects
  WHERE name LIKE p_tenant_id::text || '/%';

  RETURN v_bytes;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_tenant_storage_bytes(uuid) FROM PUBLIC, anon;

-- find_order_by_reference (ook via tracking-webhook op service-role)
CREATE OR REPLACE FUNCTION public.find_order_by_reference(p_tenant_id uuid, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_order_id := p_reference::UUID;
    IF EXISTS (SELECT 1 FROM orders WHERE id = v_order_id AND tenant_id = p_tenant_id) THEN
      RETURN v_order_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid UUID, continue with other checks
  END;

  SELECT id INTO v_order_id FROM orders
  WHERE tenant_id = p_tenant_id
  AND (order_number = p_reference OR order_number = '#' || LTRIM(p_reference, '#'))
  LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  SELECT id INTO v_order_id FROM orders
  WHERE tenant_id = p_tenant_id AND external_reference = p_reference
  LIMIT 1;
  IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;

  SELECT id INTO v_order_id FROM orders
  WHERE tenant_id = p_tenant_id AND marketplace_order_id = p_reference
  LIMIT 1;

  RETURN v_order_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.find_order_by_reference(uuid, text) FROM PUBLIC, anon;

-- update_ai_learning_pattern (ook via edge function op service-role)
CREATE OR REPLACE FUNCTION public.update_ai_learning_pattern(p_tenant_id uuid, p_pattern_type text, p_learned_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  INSERT INTO ai_learning_patterns (tenant_id, pattern_type, learned_value, sample_count, confidence_score)
  VALUES (p_tenant_id, p_pattern_type, p_learned_value, 1, 0.3)
  ON CONFLICT (tenant_id, pattern_type) DO UPDATE
  SET
    learned_value = ai_learning_patterns.learned_value || p_learned_value,
    sample_count = ai_learning_patterns.sample_count + 1,
    confidence_score = CASE
      WHEN ai_learning_patterns.sample_count + 1 > 10 THEN 0.9
      WHEN ai_learning_patterns.sample_count + 1 > 5 THEN 0.7
      WHEN ai_learning_patterns.sample_count + 1 > 2 THEN 0.5
      ELSE 0.3
    END,
    last_updated_at = now();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_ai_learning_pattern(uuid, text, jsonb) FROM PUBLIC, anon;

-- add_ai_credits: platformhandeling
CREATE OR REPLACE FUNCTION public.add_ai_credits(p_tenant_id uuid, p_credits integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Alleen platform-admin' USING ERRCODE = '42501';
  END IF;

  INSERT INTO tenant_ai_credits (tenant_id, credits_purchased, last_purchase_at)
  VALUES (p_tenant_id, p_credits, now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET credits_purchased = tenant_ai_credits.credits_purchased + p_credits,
      last_purchase_at = now(),
      updated_at = now();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_ai_credits(uuid, integer) FROM PUBLIC, anon;

-- record_transaction (frontend + edge functions op service-role + interne functie redeem_gift_card)
CREATE OR REPLACE FUNCTION public.record_transaction(p_tenant_id uuid, p_transaction_type text, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month_year text;
  v_usage_record tenant_transaction_usage%ROWTYPE;
  v_plan pricing_plans%ROWTYPE;
  v_subscription tenant_subscriptions%ROWTYPE;
  v_total_transactions integer;
  v_included_transactions integer;
  v_overage_fee decimal(10,2);
  v_is_overage boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  v_month_year := to_char(now(), 'YYYY-MM');

  INSERT INTO tenant_transaction_usage (tenant_id, month_year)
  VALUES (p_tenant_id, v_month_year)
  ON CONFLICT (tenant_id, month_year) DO NOTHING;

  SELECT * INTO v_usage_record
  FROM tenant_transaction_usage
  WHERE tenant_id = p_tenant_id AND month_year = v_month_year;

  CASE p_transaction_type
    WHEN 'stripe' THEN
      UPDATE tenant_transaction_usage
      SET stripe_transactions = stripe_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'bank_transfer' THEN
      UPDATE tenant_transaction_usage
      SET bank_transfer_transactions = bank_transfer_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_cash' THEN
      UPDATE tenant_transaction_usage
      SET pos_cash_transactions = pos_cash_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_card' THEN
      UPDATE tenant_transaction_usage
      SET pos_card_transactions = pos_card_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
  END CASE;

  SELECT * INTO v_subscription
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM pricing_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  v_included_transactions := COALESCE(v_plan.included_transactions_monthly, 0);
  v_overage_fee := COALESCE(v_plan.transaction_overage_fee, 0.50);

  IF v_included_transactions = -1 THEN
    v_is_overage := false;
    v_overage_fee := 0;
  ELSE
    SELECT * INTO v_usage_record
    FROM tenant_transaction_usage
    WHERE tenant_id = p_tenant_id AND month_year = v_month_year;

    v_total_transactions := v_usage_record.stripe_transactions +
                           v_usage_record.bank_transfer_transactions +
                           v_usage_record.pos_cash_transactions +
                           v_usage_record.pos_card_transactions;

    v_is_overage := v_total_transactions > v_included_transactions;

    IF v_is_overage THEN
      UPDATE tenant_transaction_usage
      SET overage_fee_total = overage_fee_total + v_overage_fee, updated_at = now()
      WHERE id = v_usage_record.id;
    ELSE
      v_overage_fee := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_overage', v_is_overage,
    'overage_fee', v_overage_fee,
    'total_transactions', v_total_transactions,
    'included_transactions', v_included_transactions
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.record_transaction(uuid, text, uuid) FROM PUBLIC, anon;

-- ============ GROEP 3b: gebruikersparameter ============

CREATE OR REPLACE FUNCTION public.track_user_behavior(p_user_id uuid, p_tenant_id uuid, p_behavior_type text, p_behavior_value text)
 RETURNS TABLE(occurrence_count integer, should_learn boolean, should_auto_apply boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF p_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid())) THEN
      RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
    END IF;
    IF p_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Geen toegang tot deze gebruiker' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.ai_user_behavior_log (user_id, tenant_id, behavior_type, behavior_value)
  VALUES (p_user_id, p_tenant_id, p_behavior_type, p_behavior_value)
  ON CONFLICT (user_id, behavior_type, behavior_value) DO UPDATE
  SET occurrence_count = ai_user_behavior_log.occurrence_count + 1, last_seen_at = now()
  RETURNING ai_user_behavior_log.occurrence_count INTO v_count;

  RETURN QUERY SELECT v_count, v_count >= 3, v_count >= 5;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.track_user_behavior(uuid, uuid, text, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.update_user_learning_pattern(p_user_id uuid, p_tenant_id uuid, p_pattern_type text, p_learned_value jsonb, p_sample_count integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF p_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid())) THEN
      RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
    END IF;
    IF p_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Geen toegang tot deze gebruiker' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.ai_user_learning_patterns (user_id, tenant_id, pattern_type, learned_value, sample_count, confidence_score)
  VALUES (p_user_id, p_tenant_id, p_pattern_type, p_learned_value, p_sample_count,
    CASE WHEN p_sample_count >= 5 THEN 0.9 WHEN p_sample_count >= 3 THEN 0.7 ELSE 0.3 END)
  ON CONFLICT (user_id, pattern_type) DO UPDATE
  SET learned_value = ai_user_learning_patterns.learned_value || p_learned_value,
      sample_count = ai_user_learning_patterns.sample_count + p_sample_count,
      confidence_score = CASE
        WHEN ai_user_learning_patterns.sample_count + p_sample_count >= 5 THEN 0.9
        WHEN ai_user_learning_patterns.sample_count + p_sample_count >= 3 THEN 0.7
        ELSE LEAST(ai_user_learning_patterns.confidence_score + 0.1, 1.0) END,
      last_updated_at = now();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_user_learning_pattern(uuid, uuid, text, jsonb, integer) FROM PUBLIC, anon;

-- ============ GROEP 3c: tenant afleiden uit de entiteit ============

CREATE OR REPLACE FUNCTION public.get_order_return_tag(_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  has_returns BOOLEAN;
  all_completed BOOLEAN;
  any_awaiting_refund BOOLEAN;
  any_denied BOOLEAN;
  any_partial BOOLEAN;
  total_items INTEGER;
  returned_items INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = _order_id
        AND o.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.returns WHERE order_id = _order_id AND status != 'cancelled') INTO has_returns;
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
$function$;
REVOKE EXECUTE ON FUNCTION public.get_order_return_tag(uuid) FROM PUBLIC, anon;

-- get_order_returnable_items (was LANGUAGE sql; plpgsql nodig voor de guard, STABLE behouden)
CREATE OR REPLACE FUNCTION public.get_order_returnable_items(_order_id uuid)
 RETURNS TABLE(order_item_id uuid, ordered_quantity integer, already_returned integer, returnable_quantity integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = _order_id
        AND o.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    oi.id,
    oi.quantity,
    public.get_already_returned_quantity(oi.id) AS already_returned,
    GREATEST(0, oi.quantity - public.get_already_returned_quantity(oi.id)) AS returnable_quantity
  FROM public.order_items oi
  WHERE oi.order_id = _order_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_order_returnable_items(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.calculate_session_expected_cash(p_session_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opening_cash DECIMAL(10,2);
  v_cash_sales DECIMAL(10,2);
  v_cash_movements DECIMAL(10,2);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pos_sessions s
      WHERE s.id = p_session_id
        AND s.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT opening_cash INTO v_opening_cash
  FROM public.pos_sessions WHERE id = p_session_id;

  SELECT COALESCE(SUM(
    (SELECT COALESCE(SUM((p->>'amount')::DECIMAL), 0)
     FROM jsonb_array_elements(payments) AS p
     WHERE p->>'method' = 'cash')
  ), 0) - COALESCE(SUM(cash_change), 0)
  INTO v_cash_sales
  FROM public.pos_transactions
  WHERE session_id = p_session_id AND status = 'completed';

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
$function$;
REVOKE EXECUTE ON FUNCTION public.calculate_session_expected_cash(uuid) FROM PUBLIC, anon;

-- Bulk product-functies: alles-of-niets
CREATE OR REPLACE FUNCTION public.bulk_adjust_prices(p_product_ids uuid[], p_adjustment_type text, p_adjustment_value numeric, p_price_field text DEFAULT 'price'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND p.tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Producten buiten eigen tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_price_field = 'price' THEN
    IF p_adjustment_type = 'add' THEN
      UPDATE products SET price = price + p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'subtract' THEN
      UPDATE products SET price = GREATEST(0, price - p_adjustment_value), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_up' THEN
      UPDATE products SET price = ROUND((price * (1 + p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'percentage_down' THEN
      UPDATE products SET price = ROUND((price * (1 - p_adjustment_value / 100))::numeric, 2), updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'compare_at_price' THEN
    IF p_adjustment_type = 'remove' THEN
      UPDATE products SET compare_at_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'set_current' THEN
      UPDATE products SET compare_at_price = price, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'exact' THEN
      UPDATE products SET compare_at_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  ELSIF p_price_field = 'cost_price' THEN
    IF p_adjustment_type = 'exact' THEN
      UPDATE products SET cost_price = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
    ELSIF p_adjustment_type = 'remove' THEN
      UPDATE products SET cost_price = NULL, updated_at = now() WHERE id = ANY(p_product_ids);
    END IF;
  END IF;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.bulk_adjust_prices(uuid[], text, numeric, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bulk_adjust_stock(p_product_ids uuid[], p_adjustment_type text, p_adjustment_value integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND p.tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Producten buiten eigen tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_adjustment_type = 'add' THEN
    UPDATE products SET stock = stock + p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'subtract' THEN
    UPDATE products SET stock = GREATEST(0, stock - p_adjustment_value), updated_at = now() WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'exact' THEN
    UPDATE products SET stock = p_adjustment_value, updated_at = now() WHERE id = ANY(p_product_ids);
  END IF;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.bulk_adjust_stock(uuid[], text, integer) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bulk_update_tags(p_product_ids uuid[], p_tags_to_add text[] DEFAULT '{}'::text[], p_tags_to_remove text[] DEFAULT '{}'::text[], p_replace_all boolean DEFAULT false, p_replacement_tags text[] DEFAULT '{}'::text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND p.tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Producten buiten eigen tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_replace_all THEN
    UPDATE products SET tags = p_replacement_tags, updated_at = now() WHERE id = ANY(p_product_ids);
  ELSE
    IF array_length(p_tags_to_add, 1) > 0 THEN
      UPDATE products
      SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(tags || p_tags_to_add) t),
          updated_at = now()
      WHERE id = ANY(p_product_ids);
    END IF;

    IF array_length(p_tags_to_remove, 1) > 0 THEN
      UPDATE products
      SET tags = (SELECT COALESCE(array_agg(t), '{}') FROM unnest(tags) t WHERE t != ALL(p_tags_to_remove)),
          updated_at = now()
      WHERE id = ANY(p_product_ids);
    END IF;
  END IF;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.bulk_update_tags(uuid[], text[], text[], boolean, text[]) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bulk_update_social_channels(p_product_ids uuid[], p_social_channels jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND p.tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Producten buiten eigen tenant' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE products
  SET social_channels = p_social_channels,
      updated_at = now()
  WHERE id = ANY(p_product_ids);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.bulk_update_social_channels(uuid[], jsonb) FROM PUBLIC, anon;
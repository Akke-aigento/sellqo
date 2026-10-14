-- FEST-1 + FEST-2 — combitickets en munten (drank/eten) voor festivals en events.
-- Strikt additief. Het enige wat aan een bestaand pad raakt: issue_tickets_for_order wordt
-- hernoemd naar issue_tickets_for_order_core (inhoud byte-identiek) en een wrapper met de
-- oude naam roept eerst de kern aan en daarna, in een EXCEPTION-blok, de combi's en munten.
-- Een fout in de nieuwe code kan zo nooit de uitgifte van gewone tickets tegenhouden.

-- ── FEST-1: combitickets ──────────────────────────────────────────────────────
-- Een combiticket is een ticketproduct zonder eigen datum. Per onderdeel: een datum
-- (event_details) en het tickettype (product) waaronder het meetelt voor de capaciteit.
-- Bij betaling krijgt de koper per onderdeel een gewoon ticket met eigen QR.
CREATE TABLE IF NOT EXISTS public.ticket_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bundle_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT ticket_bundle_items_unique UNIQUE (bundle_product_id, event_detail_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_bundle_items_bundle ON public.ticket_bundle_items (bundle_product_id);
CREATE INDEX IF NOT EXISTS idx_ticket_bundle_items_event ON public.ticket_bundle_items (event_detail_id);

-- ── FEST-2: munten ────────────────────────────────────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS token_amount integer CHECK (token_amount IS NULL OR token_amount > 0);

CREATE TABLE IF NOT EXISTS public.token_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_name text NOT NULL DEFAULT 'munt',
  token_name_plural text NOT NULL DEFAULT 'munten',
  refund_enabled boolean NOT NULL DEFAULT false,
  refund_until timestamptz,
  refund_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (refund_fee >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.token_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  purchased integer NOT NULL DEFAULT 0 CHECK (purchased >= 0),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refund_requested', 'refunded', 'blocked')),
  return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_wallets_order ON public.token_wallets (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_wallets_tenant ON public.token_wallets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_wallets_return ON public.token_wallets (return_id) WHERE return_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.token_scanner_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  access_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_token_scanner_access_tenant ON public.token_scanner_access (tenant_id);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.token_wallets(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase', 'spend', 'undo', 'refund', 'adjust')),
  balance_after integer NOT NULL,
  scanner_id uuid REFERENCES public.token_scanner_access(id) ON DELETE SET NULL,
  user_id uuid,
  idempotency_key text UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_tx_wallet ON public.token_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_tenant ON public.token_transactions (tenant_id, created_at DESC);

-- ── RLS: admin (tenant_admin of staff) leest; tenant_admin beheert ───────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_bundle_items, public.token_settings, public.token_scanner_access TO authenticated;
GRANT SELECT, UPDATE ON public.token_wallets TO authenticated;
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT ALL ON public.ticket_bundle_items, public.token_settings, public.token_wallets, public.token_scanner_access, public.token_transactions TO service_role;

DO $$
DECLARE
  t text;
  rd text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role]))';
  wr text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['ticket_bundle_items','token_settings','token_wallets','token_scanner_access','token_transactions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_tenant', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING %s', t || '_select_tenant', t, rd);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ticket_bundle_items','token_settings','token_scanner_access']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_tenant', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t || '_insert_tenant', t, wr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s', t || '_update_tenant', t, wr, wr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING %s', t || '_delete_tenant', t, wr);
  END LOOP;
  -- Wallets: enkel blokkeren/deblokkeren door tenant_admin (saldo wijzigt via functies).
  DROP POLICY IF EXISTS token_wallets_update_tenant ON public.token_wallets;
  EXECUTE format('CREATE POLICY token_wallets_update_tenant ON public.token_wallets FOR UPDATE TO authenticated USING %s WITH CHECK %s', wr, wr);
END $$;

-- ── Capaciteit van een combiticket ──────────────────────────────────────────
-- p_qty extra stuks bovenop wat al verkocht is; geeft het eerste onderdeel dat vol is terug.
CREATE OR REPLACE FUNCTION public.check_bundle_capacity(p_bundle_product_id uuid, p_qty integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  c record;
  v_cap jsonb;
  v_min int := NULL;
  v_left int;
BEGIN
  FOR c IN SELECT b.event_detail_id, b.component_product_id, e.status FROM public.ticket_bundle_items b
           JOIN public.event_details e ON e.id = b.event_detail_id
           WHERE b.bundle_product_id = p_bundle_product_id ORDER BY b.sort_order
  LOOP
    IF c.status NOT IN ('scheduled', 'confirmed') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'date_unavailable', 'event_detail_id', c.event_detail_id);
    END IF;
    v_cap := public.check_event_capacity(c.event_detail_id, c.component_product_id, GREATEST(p_qty, 0));
    v_left := LEAST(COALESCE((v_cap->>'event_spots_left')::int, 2147483647), COALESCE((v_cap->>'type_spots_left')::int, 2147483647));
    v_min := LEAST(COALESCE(v_min, v_left), v_left);
    IF NOT COALESCE((v_cap->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'component_full', 'event_detail_id', c.event_detail_id, 'spots_left', v_left);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'spots_left', CASE WHEN v_min = 2147483647 THEN NULL ELSE v_min END);
END;
$$;

-- ── Uitgifte: combi's ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_bundle_tickets_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_item record;
  c record;
  v_n int;
  v_j int;
  u int;
  v_seq int;
  v_cap jsonb;
  v_admin uuid;
BEGIN
  SELECT id, tenant_id, payment_status, customer_name, customer_email INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.id, oi.product_id, COALESCE(oi.quantity, 0) AS quantity FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.event_detail_id IS NULL
      AND EXISTS (SELECT 1 FROM public.ticket_bundle_items b WHERE b.bundle_product_id = oi.product_id)
  LOOP
    SELECT count(*) INTO v_n FROM public.ticket_bundle_items WHERE bundle_product_id = v_item.product_id;
    FOR u IN 1..v_item.quantity LOOP
      v_j := 0;
      FOR c IN SELECT * FROM public.ticket_bundle_items WHERE bundle_product_id = v_item.product_id ORDER BY sort_order, event_detail_id LOOP
        v_j := v_j + 1;
        v_seq := (u - 1) * v_n + v_j;
        IF EXISTS (SELECT 1 FROM public.ticket_instances WHERE order_item_id = v_item.id AND seq = v_seq) THEN CONTINUE; END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(c.event_detail_id::text, 0));
        v_cap := public.check_event_capacity(c.event_detail_id, c.component_product_id, 1);
        IF NOT COALESCE((v_cap->>'ok')::boolean, false) THEN
          SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.tenant_id = v_order.tenant_id AND ur.role = 'tenant_admin' LIMIT 1;
          IF v_admin IS NULL THEN SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role = 'platform_admin' LIMIT 1; END IF;
          IF v_admin IS NOT NULL THEN
            INSERT INTO public.admin_actions_log (admin_user_id, target_tenant_id, action_type, action_details)
            VALUES (v_admin, v_order.tenant_id, 'bundle_overbooking_prevented',
                    jsonb_build_object('order_id', p_order_id, 'order_item_id', v_item.id, 'event_detail_id', c.event_detail_id, 'reason', v_cap->>'reason'));
          END IF;
          CONTINUE;
        END IF;
        INSERT INTO public.ticket_instances (tenant_id, event_detail_id, product_id, order_id, order_item_id, seq, qr_token, status, attendee_name, attendee_email)
        VALUES (v_order.tenant_id, c.event_detail_id, c.component_product_id, p_order_id, v_item.id, v_seq,
                replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                'valid', v_order.customer_name, v_order.customer_email)
        ON CONFLICT (order_item_id, seq) WHERE seq IS NOT NULL DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- ── Uitgifte: munten ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_wallet_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_tokens int;
  v_paid numeric;
  v_wallet uuid;
BEGIN
  SELECT id, tenant_id, payment_status, customer_name, customer_email INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.token_wallets WHERE order_id = p_order_id) THEN RETURN; END IF;

  SELECT COALESCE(sum(COALESCE(oi.quantity, 0) * p.token_amount), 0), COALESCE(sum(oi.total_price), 0)
    INTO v_tokens, v_paid
  FROM public.order_items oi JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id AND p.token_amount IS NOT NULL;
  IF v_tokens <= 0 THEN RETURN; END IF;

  INSERT INTO public.token_wallets (tenant_id, code, order_id, customer_name, customer_email, purchased, balance, paid_amount)
  VALUES (v_order.tenant_id, replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
          p_order_id, v_order.customer_name, v_order.customer_email, v_tokens, v_tokens, v_paid)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_wallet;
  IF v_wallet IS NOT NULL THEN
    INSERT INTO public.token_transactions (tenant_id, wallet_id, delta, kind, balance_after, note)
    VALUES (v_order.tenant_id, v_wallet, v_tokens, 'purchase', v_tokens, 'order ' || p_order_id);
  END IF;
END;
$$;

-- ── Wrapper rond de bestaande uitgifte ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'issue_tickets_for_order_core') THEN
    ALTER FUNCTION public.issue_tickets_for_order(uuid) RENAME TO issue_tickets_for_order_core;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.issue_tickets_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- 1. De bestaande uitgifte, ongewijzigd.
  PERFORM public.issue_tickets_for_order_core(p_order_id);
  -- 2. FEST-1/2: combi's en munten. Mag nooit de gewone tickets tegenhouden.
  BEGIN
    PERFORM public.issue_bundle_tickets_for_order(p_order_id);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'issue_bundle_tickets_for_order failed for order %: %', p_order_id, SQLERRM;
  END;
  BEGIN
    PERFORM public.issue_wallet_for_order(p_order_id);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'issue_wallet_for_order failed for order %: %', p_order_id, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_tickets_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_tickets_for_order_core(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_bundle_tickets_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_wallet_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_tickets_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_tickets_for_order_core(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_bundle_tickets_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_wallet_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_bundle_capacity(uuid, integer) TO anon, authenticated, service_role;

-- ── Munten uitgeven aan de bar (service_role, via edge function token-bar) ───
CREATE OR REPLACE FUNCTION public.spend_tokens(p_tenant_id uuid, p_code text, p_amount integer, p_key text, p_scanner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  w record;
  v_prev record;
  v_tx uuid;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;
  IF p_key IS NOT NULL THEN
    SELECT t.id, t.balance_after INTO v_prev FROM public.token_transactions t WHERE t.idempotency_key = p_key;
    IF FOUND THEN RETURN jsonb_build_object('ok', true, 'balance', v_prev.balance_after, 'transaction_id', v_prev.id, 'repeat', true); END IF;
  END IF;
  SELECT * INTO w FROM public.token_wallets WHERE tenant_id = p_tenant_id AND code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_wallet'); END IF;
  IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'wallet_' || w.status, 'balance', w.balance); END IF;
  IF w.balance < p_amount THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', w.balance); END IF;
  UPDATE public.token_wallets SET balance = balance - p_amount, updated_at = now() WHERE id = w.id;
  INSERT INTO public.token_transactions (tenant_id, wallet_id, delta, kind, balance_after, scanner_id, idempotency_key)
  VALUES (w.tenant_id, w.id, -p_amount, 'spend', w.balance - p_amount, p_scanner_id, p_key)
  RETURNING id INTO v_tx;
  UPDATE public.token_scanner_access SET last_used_at = now(), use_count = use_count + 1 WHERE id = p_scanner_id;
  RETURN jsonb_build_object('ok', true, 'balance', w.balance - p_amount, 'transaction_id', v_tx);
END;
$$;

-- Een uitgave terugdraaien: enkel door dezelfde scanner, binnen 10 minuten, één keer.
CREATE OR REPLACE FUNCTION public.undo_token_spend(p_tenant_id uuid, p_transaction_id uuid, p_scanner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  t record;
  w record;
BEGIN
  SELECT * INTO t FROM public.token_transactions WHERE id = p_transaction_id AND tenant_id = p_tenant_id AND kind = 'spend';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_transaction'); END IF;
  IF t.scanner_id IS DISTINCT FROM p_scanner_id OR t.created_at < now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late');
  END IF;
  IF EXISTS (SELECT 1 FROM public.token_transactions WHERE idempotency_key = 'undo:' || p_transaction_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_undone');
  END IF;
  SELECT * INTO w FROM public.token_wallets WHERE id = t.wallet_id FOR UPDATE;
  IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'wallet_' || w.status); END IF;
  UPDATE public.token_wallets SET balance = balance - t.delta, updated_at = now() WHERE id = w.id;
  INSERT INTO public.token_transactions (tenant_id, wallet_id, delta, kind, balance_after, scanner_id, idempotency_key)
  VALUES (w.tenant_id, w.id, -t.delta, 'undo', w.balance - t.delta, p_scanner_id, 'undo:' || p_transaction_id);
  RETURN jsonb_build_object('ok', true, 'balance', w.balance - t.delta);
END;
$$;

-- Saldo bijsturen door de winkel (admin, met reden). Positief of negatief.
CREATE OR REPLACE FUNCTION public.adjust_wallet(p_wallet_id uuid, p_delta integer, p_note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  w record;
BEGIN
  SELECT * INTO w FROM public.token_wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF NOT (w.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(w.tenant_id, ARRAY['tenant_admin'::app_role])) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet_not_active'; END IF;
  IF p_delta = 0 OR w.balance + p_delta < 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF coalesce(trim(p_note), '') = '' THEN RAISE EXCEPTION 'note_required'; END IF;
  UPDATE public.token_wallets SET balance = balance + p_delta, updated_at = now() WHERE id = w.id;
  INSERT INTO public.token_transactions (tenant_id, wallet_id, delta, kind, balance_after, user_id, note)
  VALUES (w.tenant_id, w.id, p_delta, 'adjust', w.balance + p_delta, auth.uid(), p_note);
  RETURN jsonb_build_object('ok', true, 'balance', w.balance + p_delta);
END;
$$;

-- ── Terugbetaling van ongebruikte munten (service_role, via token-wallet) ────
-- Maakt een gewone retour aan (returns + return_items), zodat de winkel hem in
-- Retouren goedkeurt en process-refund de Stripe-deelterugbetaling of manuele
-- overschrijving en de creditnota doet. Waarde per munt = betaald / gekocht.
CREATE OR REPLACE FUNCTION public.request_token_refund(p_code text, p_iban text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  w record;
  s record;
  o record;
  v_unit numeric;
  v_amount numeric;
  v_return uuid;
  v_method text;
BEGIN
  SELECT * INTO w FROM public.token_wallets WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_wallet'); END IF;
  SELECT * INTO s FROM public.token_settings WHERE tenant_id = w.tenant_id;
  IF NOT FOUND OR NOT s.refund_enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'refund_disabled'); END IF;
  IF s.refund_until IS NOT NULL AND now() > s.refund_until THEN RETURN jsonb_build_object('ok', false, 'reason', 'refund_closed'); END IF;
  IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'wallet_' || w.status); END IF;
  IF w.balance <= 0 OR w.purchased <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'nothing_left'); END IF;
  SELECT id, order_number, customer_name, customer_id, stripe_payment_intent_id INTO o FROM public.orders WHERE id = w.order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_missing'); END IF;
  v_unit := round(w.paid_amount / w.purchased, 4);
  v_amount := round(w.balance * v_unit - s.refund_fee, 2);
  IF v_amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'below_fee'); END IF;
  v_method := CASE WHEN o.stripe_payment_intent_id IS NOT NULL THEN 'stripe' ELSE 'manual' END;
  IF v_method = 'manual' AND coalesce(trim(p_iban), '') = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'iban_required'); END IF;

  INSERT INTO public.returns (tenant_id, order_id, status, return_reason, return_reason_code, customer_name, customer_id, items,
                              refund_amount, refund_status, refund_method, source, refund_notes, internal_notes, subtotal)
  VALUES (w.tenant_id, o.id, 'requested', 'Niet gebruikte munten', 'unused_tokens', o.customer_name, o.customer_id,
          jsonb_build_array(jsonb_build_object('product_name', s.token_name_plural, 'quantity', w.balance, 'unit_price', v_unit)),
          v_amount, 'pending', v_method, 'manual',
          CASE WHEN v_method = 'manual' THEN 'Terugstorten op IBAN ' || upper(replace(p_iban, ' ', '')) ELSE 'Terugbetaling op de originele betaling (Stripe)' END,
          format('Muntenkaart %s: %s %s over à €%s, kost €%s', left(w.code, 8), w.balance, s.token_name_plural, v_unit, s.refund_fee),
          round(w.balance * v_unit, 2))
  RETURNING id INTO v_return;
  INSERT INTO public.return_items (return_id, product_name, quantity, unit_price, line_total, reason_code, refund_amount, restock)
  VALUES (v_return, initcap(s.token_name_plural), w.balance, v_unit, round(w.balance * v_unit, 2), 'unused_tokens', v_amount, false);

  UPDATE public.token_wallets SET status = 'refund_requested', return_id = v_return, updated_at = now() WHERE id = w.id;

  INSERT INTO public.notifications (tenant_id, category, type, title, message, data, priority, action_url)
  VALUES (w.tenant_id, 'orders', 'token_refund_requested', 'Terugbetaling munten gevraagd',
          format('Bestelling %s: %s %s terug, €%s', o.order_number, w.balance, s.token_name_plural, v_amount),
          jsonb_build_object('return_id', v_return, 'wallet_id', w.id), 'medium', '/admin/returns/' || v_return);

  RETURN jsonb_build_object('ok', true, 'amount', v_amount, 'tokens', w.balance, 'method', v_method, 'return_id', v_return);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_tokens(uuid, text, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_token_spend(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_token_refund(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_wallet(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_tokens(uuid, text, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_token_spend(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_token_refund(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_wallet(uuid, integer, text) TO authenticated, service_role;

-- ── Wallet volgt de retour ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_wallet_from_return()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  w record;
BEGIN
  SELECT * INTO w FROM public.token_wallets WHERE return_id = NEW.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NEW.refund_status::text = 'completed' AND w.status = 'refund_requested' THEN
    UPDATE public.token_wallets SET status = 'refunded', balance = 0, updated_at = now() WHERE id = w.id;
    INSERT INTO public.token_transactions (tenant_id, wallet_id, delta, kind, balance_after, note)
    VALUES (w.tenant_id, w.id, -w.balance, 'refund', 0, 'retour ' || NEW.id);
  ELSIF NEW.status::text IN ('rejected', 'cancelled') AND w.status = 'refund_requested' THEN
    UPDATE public.token_wallets SET status = 'active', return_id = NULL, updated_at = now() WHERE id = w.id;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'sync_wallet_from_return failed for return %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS returns_sync_token_wallet ON public.returns;
CREATE TRIGGER returns_sync_token_wallet AFTER UPDATE OF status, refund_status ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_from_return();

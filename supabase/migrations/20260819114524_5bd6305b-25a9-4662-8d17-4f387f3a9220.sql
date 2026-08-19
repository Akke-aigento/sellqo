-- EVENT-SYSTEEM FASE 3a — capaciteitshandhaving (additief)
-- DOWN (handmatig): herstel issue_tickets_for_order naar de vorige definitie
-- (zonder product_id, lock en cap-check) en DROP FUNCTION public.check_event_capacity(uuid,uuid,integer);

CREATE OR REPLACE FUNCTION public.check_event_capacity(
  p_event_detail_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_capacity int;
  v_sold int;
  v_sub_capacity int;
  v_type_sold int;
  v_event_left int := NULL;
  v_type_left int := NULL;
  v_qty int := GREATEST(COALESCE(p_quantity, 1), 0);
BEGIN
  SELECT capacity INTO v_capacity
  FROM public.event_details WHERE id = p_event_detail_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  -- Event-cap (null = ongelimiteerd)
  IF v_capacity IS NOT NULL THEN
    v_sold := public.get_event_signup_count(p_event_detail_id);
    v_event_left := GREATEST(v_capacity - v_sold, 0);
  END IF;

  -- Sub-cap per tickettype (alleen als er een rij met sub_capacity bestaat)
  IF p_product_id IS NOT NULL THEN
    SELECT t.sub_capacity INTO v_sub_capacity
    FROM public.event_ticket_types t
    WHERE t.event_detail_id = p_event_detail_id
      AND t.product_id = p_product_id
    LIMIT 1;

    IF v_sub_capacity IS NOT NULL THEN
      v_type_sold := public.get_event_ticket_type_count(p_event_detail_id, p_product_id);
      v_type_left := GREATEST(v_sub_capacity - v_type_sold, 0);
    END IF;
  END IF;

  IF v_event_left IS NOT NULL AND v_qty > v_event_left THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_full',
      'event_spots_left', v_event_left, 'type_spots_left', v_type_left);
  END IF;

  IF v_type_left IS NOT NULL AND v_qty > v_type_left THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ticket_type_full',
      'event_spots_left', v_event_left, 'type_spots_left', v_type_left);
  END IF;

  RETURN jsonb_build_object('ok', true,
    'event_spots_left', v_event_left, 'type_spots_left', v_type_left);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_event_capacity(uuid, uuid, integer) TO authenticated, anon, service_role;

-- Ticketuitgifte: product_id meeschrijven + atomaire cap-handhaving
CREATE OR REPLACE FUNCTION public.issue_tickets_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  i int;
  v_cap jsonb;
  v_already int;
  v_needed int;
  v_admin uuid;
BEGIN
  SELECT id, tenant_id, payment_status, customer_name, customer_email, total
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT id, event_detail_id, product_id, COALESCE(quantity, 0) AS quantity
    FROM public.order_items
    WHERE order_id = p_order_id
      AND event_detail_id IS NOT NULL
  LOOP
    -- Race-safe: serialiseer alle issuance voor dit event binnen deze transactie.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.event_detail_id::text, 0));

    -- Idempotentie: al uitgegeven tickets voor dit order_item niet dubbel tellen.
    SELECT COUNT(*)::int INTO v_already
    FROM public.ticket_instances
    WHERE order_item_id = v_item.id;

    v_needed := v_item.quantity - v_already;
    IF v_needed <= 0 THEN
      CONTINUE;
    END IF;

    v_cap := public.check_event_capacity(v_item.event_detail_id, v_item.product_id, v_needed);

    IF NOT COALESCE((v_cap->>'ok')::boolean, false) THEN
      -- Verloren race ná betaling: geen tickets, glashelder loggen. Geen auto-refund.
      SELECT u.id INTO v_admin
      FROM auth.users u
      JOIN public.tenants t ON lower(t.owner_email) = lower(u.email)
      WHERE t.id = v_order.tenant_id
      LIMIT 1;

      IF v_admin IS NULL THEN
        SELECT ur.user_id INTO v_admin
        FROM public.user_roles ur
        WHERE ur.role = 'platform_admin'
        LIMIT 1;
      END IF;

      IF v_admin IS NOT NULL THEN
        INSERT INTO public.admin_actions_log (
          admin_user_id, target_tenant_id, action_type, action_details
        ) VALUES (
          v_admin, v_order.tenant_id, 'ticket_issuance_overbooking_prevented',
          jsonb_build_object(
            'order_id', v_order.id,
            'order_item_id', v_item.id,
            'event_detail_id', v_item.event_detail_id,
            'product_id', v_item.product_id,
            'quantity', v_needed,
            'reason', v_cap->>'reason',
            'paid_amount', v_order.total
          )
        );
      ELSE
        RAISE WARNING 'overbooking prevented but no admin user found (order %)', v_order.id;
      END IF;

      CONTINUE;
    END IF;

    FOR i IN (v_already + 1)..v_item.quantity LOOP
      INSERT INTO public.ticket_instances (
        tenant_id, event_detail_id, product_id, order_id, order_item_id, seq,
        qr_token, status, attendee_name, attendee_email
      ) VALUES (
        v_order.tenant_id, v_item.event_detail_id, v_item.product_id, v_order.id, v_item.id, i,
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        'valid',
        v_order.customer_name, v_order.customer_email
      )
      ON CONFLICT (order_item_id, seq) WHERE seq IS NOT NULL DO NOTHING;
    END LOOP;
  END LOOP;
END;
$function$;
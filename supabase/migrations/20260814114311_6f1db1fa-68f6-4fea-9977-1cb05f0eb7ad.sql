ALTER TABLE public.ticket_instances ADD COLUMN IF NOT EXISTS seq int;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ticket_instances_orderitem_seq
  ON public.ticket_instances(order_item_id, seq)
  WHERE seq IS NOT NULL;

CREATE OR REPLACE FUNCTION public.issue_tickets_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  i int;
BEGIN
  SELECT id, tenant_id, payment_status, customer_name, customer_email
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT id, event_detail_id, COALESCE(quantity, 0) AS quantity
    FROM public.order_items
    WHERE order_id = p_order_id
      AND event_detail_id IS NOT NULL
  LOOP
    FOR i IN 1..v_item.quantity LOOP
      INSERT INTO public.ticket_instances (
        tenant_id, event_detail_id, order_id, order_item_id, seq,
        qr_token, status, attendee_name, attendee_email
      ) VALUES (
        v_order.tenant_id, v_item.event_detail_id, v_order.id, v_item.id, i,
        encode(gen_random_bytes(16), 'hex'), 'valid',
        v_order.customer_name, v_order.customer_email
      )
      ON CONFLICT (order_item_id, seq) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_issue_tickets_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.issue_tickets_for_order(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_tickets_on_paid ON public.orders;
CREATE TRIGGER trg_issue_tickets_on_paid
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (NEW.payment_status = 'paid')
EXECUTE FUNCTION public.trg_issue_tickets_for_order();
DO $$
DECLARE
  v_order uuid := '00000000-0000-4000-8000-0000000004dd';
  c0 int; c1 int; c2 int; c3 int;
BEGIN
  DELETE FROM public.orders WHERE id = v_order;

  INSERT INTO public.orders (id, tenant_id, order_number, status, payment_status, subtotal, total, customer_email)
  VALUES (v_order, '95f6685b-3474-42fe-81ad-a5e6ca3d6806', 'TEST-4D-SELFCHECK', 'processing', 'paid', 10, 10, 'test4d@example.com');

  SELECT count(*) INTO c0 FROM public.ticket_instances ti
    JOIN public.order_items oi ON oi.id = ti.order_item_id WHERE oi.order_id = v_order;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price, event_detail_id)
  VALUES (v_order, '1daee896-a794-4076-b41e-8f511305f2a6', 'Test ticket', 2, 5, 10, '17efe0cc-e8ec-45b8-b2c6-6d72122249bd');

  SELECT count(*) INTO c1 FROM public.ticket_instances ti
    JOIN public.order_items oi ON oi.id = ti.order_item_id WHERE oi.order_id = v_order;

  PERFORM public.issue_tickets_for_order(v_order);
  SELECT count(*) INTO c2 FROM public.ticket_instances ti
    JOIN public.order_items oi ON oi.id = ti.order_item_id WHERE oi.order_id = v_order;

  PERFORM public.issue_tickets_for_order(v_order);
  SELECT count(*) INTO c3 FROM public.ticket_instances ti
    JOIN public.order_items oi ON oi.id = ti.order_item_id WHERE oi.order_id = v_order;

  DELETE FROM public.ticket_instances WHERE order_item_id IN (SELECT id FROM public.order_items WHERE order_id = v_order);
  DELETE FROM public.order_items WHERE order_id = v_order;
  DELETE FROM public.orders WHERE id = v_order;

  IF NOT (c0 = 0 AND c1 = 0 AND c2 = 2 AND c3 = 2) THEN
    RAISE EXCEPTION 'TICKET-4D selfcheck FAILED: na_paid_insert=%, na_items=%, na_rpc1=%, na_rpc2=%', c0, c1, c2, c3;
  END IF;
  RAISE NOTICE 'TICKET-4D selfcheck OK: 0 -> 0 -> 2 -> 2';
END $$;
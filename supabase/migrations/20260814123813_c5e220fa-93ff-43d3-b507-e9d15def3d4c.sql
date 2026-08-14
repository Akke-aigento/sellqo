DO $$
DECLARE
  v_order uuid;
  v_item uuid;
  v_after_trigger int;
  v_after_rpc int;
  v_after_rpc2 int;
BEGIN
  INSERT INTO public.orders (tenant_id, order_number, status, payment_status, payment_method,
    subtotal, tax_amount, shipping_cost, discount_amount, total, customer_email, customer_name)
  VALUES ('95f6685b-3474-42fe-81ad-a5e6ca3d6806','TEST-4C-FREE-TMP','processing','paid','free',
    0,0,0,0,0,'test4c@example.com','Test 4c')
  RETURNING id INTO v_order;

  SELECT count(*) INTO v_after_trigger FROM public.ticket_instances WHERE order_id = v_order;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price, event_detail_id)
  VALUES (v_order,'1daee896-a794-4076-b41e-8f511305f2a6','Early bird ticket',2,0,0,'17efe0cc-e8ec-45b8-b2c6-6d72122249bd')
  RETURNING id INTO v_item;

  PERFORM public.issue_tickets_for_order(v_order);
  SELECT count(*) INTO v_after_rpc FROM public.ticket_instances WHERE order_id = v_order;

  PERFORM public.issue_tickets_for_order(v_order);
  SELECT count(*) INTO v_after_rpc2 FROM public.ticket_instances WHERE order_id = v_order;

  RAISE NOTICE 'TICKET-4C-TEST tickets_na_insert_trigger=% tickets_na_rpc=% tickets_na_2e_rpc=%',
    v_after_trigger, v_after_rpc, v_after_rpc2;

  -- opruimen
  DELETE FROM public.ticket_instances WHERE order_id = v_order;
  DELETE FROM public.order_items WHERE order_id = v_order;
  DELETE FROM public.orders WHERE id = v_order;

  IF v_after_rpc <> 2 OR v_after_rpc2 <> 2 THEN
    RAISE EXCEPTION 'TICKET-4C-TEST FAALT: verwacht 2 tickets, kreeg % / %', v_after_rpc, v_after_rpc2;
  END IF;
END $$;
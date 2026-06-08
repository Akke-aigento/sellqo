DO $$
DECLARE
  o RECORD;
  v_customer_id uuid;
  v_first text;
  v_last text;
  v_phone text;
  v_vat_number text;
  v_company text;
  v_is_b2b boolean;
  v_created_customers int := 0;
  v_linked_orders int := 0;
BEGIN
  FOR o IN
    SELECT id, tenant_id, customer_email,
           shipping_address, billing_address,
           created_at
    FROM public.orders
    WHERE customer_id IS NULL
      AND customer_email IS NOT NULL
      AND customer_email <> ''
    ORDER BY created_at ASC
  LOOP
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE tenant_id = o.tenant_id AND email = o.customer_email
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      v_first := COALESCE(NULLIF(o.shipping_address->>'first_name',''), NULLIF(o.billing_address->>'first_name',''), '');
      v_last := COALESCE(NULLIF(o.shipping_address->>'last_name',''), NULLIF(o.billing_address->>'last_name',''), '');
      v_phone := COALESCE(NULLIF(o.shipping_address->>'phone',''), NULLIF(o.billing_address->>'phone',''));
      v_vat_number := COALESCE(NULLIF(o.billing_address->>'btw_number',''), NULLIF(o.billing_address->>'vat_number',''));
      v_company := COALESCE(NULLIF(o.billing_address->>'company',''), NULLIF(o.shipping_address->>'company',''));
      v_is_b2b := (v_vat_number IS NOT NULL AND v_vat_number <> '');

      INSERT INTO public.customers (
        tenant_id, email, first_name, last_name, phone, company_name,
        vat_number, customer_type, created_at
      ) VALUES (
        o.tenant_id, o.customer_email, v_first, v_last, v_phone, v_company,
        v_vat_number, CASE WHEN v_is_b2b THEN 'b2b' ELSE 'b2c' END,
        o.created_at
      )
      RETURNING id INTO v_customer_id;
      v_created_customers := v_created_customers + 1;
    ELSE
      UPDATE public.customers
      SET first_name = CASE WHEN first_name IS NULL OR first_name = ''
                            THEN COALESCE(o.shipping_address->>'first_name', first_name)
                            ELSE first_name END,
          last_name = CASE WHEN last_name IS NULL OR last_name = ''
                           THEN COALESCE(o.shipping_address->>'last_name', last_name)
                           ELSE last_name END,
          phone = COALESCE(phone, NULLIF(o.shipping_address->>'phone',''))
      WHERE id = v_customer_id;
    END IF;

    UPDATE public.orders SET customer_id = v_customer_id WHERE id = o.id;
    v_linked_orders := v_linked_orders + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % customers created, % orders linked', v_created_customers, v_linked_orders;
END $$;
-- PRIJS-GATEN-2 — wat de migratie 20261102091000 live aantreft (nagetrokken 2-11-2026 via pg_proc /
-- information_schema). record_stock_movement en bulk_adjust_stock verbatim live (prosrc-md5 221c8d54… / 95f3b165…),
-- plus de live paden die erop leunen: increment_stock (authenticated), decrement_stock (service role + POS-trigger)
-- en handle_pos_transaction_stock op pos_transactions (RLS: tenant_admin/staff schrijven).
alter table public.product_variants add column if not exists track_inventory boolean default true;
create table if not exists public.stock_movements (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, product_id uuid not null,
  variant_id uuid, delta integer not null, balance_after integer not null, reason text not null, reference_type text, reference_id uuid,
  note text, created_by uuid, created_at timestamptz not null default now());
-- pos_transactions bestaat al (04_pos_prelude); live RLS = insert/update enkel tenant_admin/staff.
grant all on public.stock_movements to service_role;
grant select, insert on public.pos_transactions to authenticated;
CREATE OR REPLACE FUNCTION public.record_stock_movement(p_tenant_id uuid, p_product_id uuid, p_variant_id uuid, p_delta integer, p_reason text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid := p_tenant_id;
  v_product_id uuid := p_product_id;
  v_balance integer;
  v_require_tracking boolean := p_reason NOT IN ('manual','adjustment','opening');
BEGIN
  IF p_delta IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_product_id IS NULL AND p_variant_id IS NOT NULL THEN
    SELECT product_id, tenant_id INTO v_product_id, v_tenant_id
    FROM public.product_variants WHERE id = p_variant_id;
  END IF;

  IF v_tenant_id IS NULL AND v_product_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
  END IF;

  IF v_product_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin(auth.uid())
     AND v_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied for tenant %', v_tenant_id;
  END IF;

  IF p_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = GREATEST(0, COALESCE(stock, 0) + p_delta)
    WHERE id = p_variant_id
      AND (NOT v_require_tracking OR track_inventory = true)
    RETURNING stock INTO v_balance;
  ELSE
    UPDATE public.products
    SET stock = GREATEST(0, COALESCE(stock, 0) + p_delta)
    WHERE id = v_product_id
      AND (NOT v_require_tracking OR track_inventory = true)
    RETURNING stock INTO v_balance;
  END IF;

  IF v_balance IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.stock_movements (
    tenant_id, product_id, variant_id, delta, balance_after, reason,
    reference_type, reference_id, note, created_by
  ) VALUES (
    v_tenant_id, v_product_id, p_variant_id, p_delta, v_balance, p_reason,
    p_reference_type, p_reference_id, p_note, COALESCE(p_created_by, auth.uid())
  );

  RETURN v_balance;
END;
$function$;
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
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, p_product_id, NULL, -ABS(COALESCE(p_quantity, 0)), 'sale', NULL, NULL, NULL, NULL
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.increment_stock(p_product_id uuid, p_quantity integer, p_reason text DEFAULT 'return'::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.record_stock_movement(
    NULL, p_product_id, NULL, ABS(COALESCE(p_quantity, 0)), p_reason, p_reference_type, p_reference_id, p_note, NULL
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_pos_transaction_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Loop through all items in the transaction
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) AS i
    LOOP
      -- Decrement stock for each product
      PERFORM public.decrement_stock(
        (item.value->>'product_id')::UUID,
        (item.value->>'quantity')::INTEGER
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;
revoke execute on function public.record_stock_movement(uuid,uuid,uuid,integer,text,text,uuid,text,uuid) from public, anon;
grant execute on function public.record_stock_movement(uuid,uuid,uuid,integer,text,text,uuid,text,uuid) to authenticated, service_role;
revoke execute on function public.bulk_adjust_stock(uuid[],text,integer) from public, anon;
grant execute on function public.bulk_adjust_stock(uuid[],text,integer) to authenticated, service_role;
revoke execute on function public.decrement_stock(uuid,integer) from public, anon, authenticated;
grant execute on function public.decrement_stock(uuid,integer) to service_role;
revoke execute on function public.increment_stock(uuid,integer,text,text,uuid,text) from public, anon;
grant execute on function public.increment_stock(uuid,integer,text,text,uuid,text) to authenticated, service_role;
drop trigger if exists pos_transaction_stock_trigger on public.pos_transactions;
create trigger pos_transaction_stock_trigger after insert or update on public.pos_transactions for each row execute function public.handle_pos_transaction_stock();

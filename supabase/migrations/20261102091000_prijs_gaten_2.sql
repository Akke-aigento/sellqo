-- PRIJS-GATEN-2 — voorraad bijstellen via RPC enkel nog voor tenant_admin, staff of warehouse
-- (zoals de UI-rechten sinds PRIJS-GATEN-1), plus een tenantlek in record_stock_movement. 2-11-2026.
--
-- Recon (live, read-only, 2-11-2026):
-- - record_stock_movement (SECURITY DEFINER, execute: authenticated/service_role) controleerde enkel
--   "lid van de winkel" (get_user_tenant_ids). Elk lid (viewer, accountant, marketing) kon voorraad bijstellen.
--   Bovendien nam de functie p_tenant_id van de beller over zonder hem te toetsen aan het product: met
--   p_tenant_id = eigen winkel en een product-/variant-id van een andere winkel slaagde de lidmaatschapscheck
--   en werd de voorraad van die andere winkel gewijzigd (skill db-safety: "SECURITY DEFINER die op een FK
--   opzoekt"). Idem met p_product_id + een variant van een ander product. Geen enkele caller geeft vandaag
--   p_tenant_id of beide id's mee (src/, supabase/functions, pg_proc nagetrokken), dus dichtzetten breekt niets.
-- - bulk_adjust_stock (SECURITY DEFINER, execute: authenticated) idem: enkel lidmaatschap.
-- - increment_stock / increment_variant_stock (authenticated) en decrement_stock / decrement_variant_stock
--   (enkel service_role, en via de trigger handle_pos_transaction_stock) lopen allemaal via
--   record_stock_movement en krijgen de check dus mee.
-- - handle_pos_refund_stock is een triggerfunctie op pos_transactions (niet aanroepbaar als RPC); wie die
--   UPDATE mag doen, bepaalt de RLS (tenant_admin/staff). Ongemoeid.
--
-- Nieuwe regel: met een gebruikers-JWT (auth.uid() niet null) moet de beller tenant_admin, staff of warehouse
-- zijn van de winkel van het product (has_tenant_role laat platformadmin ook door). Zonder auth.uid() (service
-- role: storefront-api, stripe-connect-webhook, sync-bol-orders, cron) ongewijzigd.
--
-- Drift-controle: stopt als de live body afwijkt van 2-11-2026 (prosrc-md5) en de marker 'PRIJS-GATEN-2'
-- mist. Snapshot vóór de wijziging. Idempotent.
--
-- Handmatig terugdraaien: de definities van vóór deze migratie staan in
-- snapshots.sellqo_20261102_fn_prijs_gaten_2 (kolom def); `execute def` per rij (enkel als er sindsdien geen
-- andere patch op deze functies kwam).

do $drift$
declare r record;
begin
  for r in
    select p.proname::text as name, p.prosrc
      from pg_proc p where p.pronamespace = 'public'::regnamespace
       and p.proname in ('record_stock_movement', 'bulk_adjust_stock')
  loop
    if position('PRIJS-GATEN-2' in r.prosrc) > 0 then
      continue;
    end if;
    if (r.name = 'record_stock_movement' and md5(r.prosrc) <> '221c8d54df7e9ed33d1f8c2fcffef564')
       or (r.name = 'bulk_adjust_stock' and md5(r.prosrc) <> '95f3b165522741c6755efba84769842d') then
      raise exception 'PRIJS-GATEN-2: % wijkt af van de live versie van 2-11-2026 (md5 %); eerst nalezen',
        r.name, md5(r.prosrc);
    end if;
  end loop;
end
$drift$;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_fn_prijs_gaten_2 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(p.prosrc) as src_md5
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('record_stock_movement', 'bulk_adjust_stock');
revoke all on snapshots.sellqo_20261102_fn_prijs_gaten_2 from anon, authenticated;

-- 1. record_stock_movement ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stock_movement(p_tenant_id uuid, p_product_id uuid, p_variant_id uuid, p_delta integer, p_reason text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_product_id uuid;
  v_balance integer;
  v_require_tracking boolean := p_reason NOT IN ('manual','adjustment','opening');
BEGIN
  IF p_delta IS NULL THEN
    RETURN NULL;
  END IF;

  -- PRIJS-GATEN-2: product en winkel altijd uit de eigen rijen afleiden, nooit van de beller overnemen.
  IF p_variant_id IS NOT NULL THEN
    SELECT v.product_id, p.tenant_id INTO v_product_id, v_tenant_id
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.id = p_variant_id;
    IF v_product_id IS NOT NULL AND p_product_id IS NOT NULL AND p_product_id <> v_product_id THEN
      RAISE EXCEPTION 'Variant hoort niet bij dit product' USING ERRCODE = '22023';
    END IF;
  ELSIF p_product_id IS NOT NULL THEN
    SELECT p.id, p.tenant_id INTO v_product_id, v_tenant_id FROM public.products p WHERE p.id = p_product_id;
  END IF;

  IF v_product_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Product hoort niet bij deze winkel' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin(auth.uid())
     AND v_tenant_id NOT IN (SELECT public.get_user_tenant_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied for tenant %', v_tenant_id;
  END IF;

  -- PRIJS-GATEN-2: enkel beheerder, medewerker of magazijn (platformadmin via has_tenant_role).
  IF auth.uid() IS NOT NULL
     AND NOT public.has_tenant_role(v_tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'warehouse'::app_role]) THEN
    RAISE EXCEPTION 'Voorraad aanpassen mag enkel een beheerder, medewerker of magazijnmedewerker'
      USING ERRCODE = '42501';
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

-- 2. bulk_adjust_stock ---------------------------------------------------------------------------------
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
    -- PRIJS-GATEN-2: voorraad in bulk enkel als beheerder, medewerker of magazijn van elke betrokken winkel.
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND NOT public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'warehouse'::app_role])
    ) THEN
      RAISE EXCEPTION 'Voorraad aanpassen mag enkel een beheerder, medewerker of magazijnmedewerker' USING ERRCODE = '42501';
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

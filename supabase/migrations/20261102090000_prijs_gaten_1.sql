-- PRIJS-GATEN-1 — drie losse gaten rond prijswijzigingen dicht (kassa-account-1-plan §1.3,
-- docs/nachtrun/PRIJS-REST-RECON.md). Security-batch, 2-11-2026.
--
-- 1. bulk_adjust_prices (SECURITY DEFINER) controleerde enkel "producten van de eigen winkel"
--    (get_user_tenant_ids), geen rol. Nu: elke winkel van de geselecteerde producten vraagt
--    has_tenant_role(tenant, {tenant_admin, staff}). Service role / postgres (auth.uid() null) en
--    platformadmin: ongewijzigd.
-- 2. product_variants had geen guard: de UPDATE-policy laat ook `warehouse` schrijven, dus een
--    magazijnaccount kon product_variants.price (en compare_at_price, cost_price) wijzigen, en add_line
--    rekent die prijs. Nieuw: trigger trg_guard_product_variant_price_fields (BEFORE UPDATE OF de drie
--    prijsvelden) met dezelfde regel als op products: enkel tenant_admin/staff (van de winkel van het
--    product), platformadmin en de server (auth.uid() null, geen anon-JWT).
--    product_addon_options: GEEN gat (policy product_addon_options_write = tenant_admin of
--    platformadmin, nagetrokken 2-11-2026), dus geen trigger.
-- 3. guard_product_commercial_fields was default-allow: een rol die niet admin/staff én niet
--    marketing/warehouse was (viewer, accountant, elke toekomstige rol), mocht alles. Nu default-deny
--    op de prijsvelden (price, compare_at_price, cost_price, vat_rate_id, takeaway_vat_rate_id): enkel
--    tenant_admin/staff, platformadmin en de server mogen ze wijzigen, elke andere rol (ook een
--    anon-JWT) krijgt 42501. sku/barcode/voorraad: regels ongewijzigd (enkel marketing/warehouse
--    beperkt), om pos-retour (handle_pos_refund_stock) en stock-RPC's voor andere rollen niet te breken.
--
-- Waarom auth.uid() en niet current_user: de guard is zelf SECURITY DEFINER, dus current_user is daarin
-- altijd de eigenaar (postgres). auth.uid() blijft in een definer-RPC de beller; daardoor houdt de guard
-- ook marketing/warehouse tegen die via een definer-RPC (bv. bulk_adjust_prices) prijzen zouden wijzigen.
-- De definer-RPC's die prijzen wijzigen (kassa_product_quick_edit, kaart_bulk_update, bulk_adjust_prices)
-- eisen zelf tenant_admin/staff, dus hun bellers passeren de guard (zie docs/nachtrun/PRIJS-GATEN-1.md).
--
-- Drift-controle: de definities hieronder vertrekken van de LIVE versie (pg_proc.prosrc, md5 nagetrokken
-- 2-11-2026). Wijkt de live body af (een andere batch wijzigde ze intussen) en draagt ze de marker
-- 'PRIJS-GATEN-1' nog niet, dan stopt de migratie in plaats van die wijziging te overschrijven.
-- Idempotent: tweede keer draaien = marker aanwezig, CREATE OR REPLACE met dezelfde inhoud.
--
-- Handmatig terugdraaien:
--   1. drop trigger if exists trg_guard_product_variant_price_fields on public.product_variants;
--      drop function if exists public.guard_product_variant_price_fields();
--   2. guard_product_commercial_fields en bulk_adjust_prices: de definitie van vóór deze migratie staat
--      in snapshots.sellqo_20261102_fn_prijs_gaten_1 (kolom def); `execute def` per rij herstelt ze.
--      (Enkel doen als er sindsdien geen andere patch op deze twee functies kwam.)

-- 0. Drift-controle (vóór de snapshot, zodat een afgebroken run geen snapshot van een vreemde versie achterlaat) + snapshot
do $drift$
declare r record;
begin
  for r in
    select p.proname::text as name, p.prosrc
      from pg_proc p where p.pronamespace = 'public'::regnamespace
       and p.proname in ('guard_product_commercial_fields', 'bulk_adjust_prices')
  loop
    if position('PRIJS-GATEN-1' in r.prosrc) > 0 then
      continue;
    end if;
    if (r.name = 'guard_product_commercial_fields' and md5(r.prosrc) <> '1b7c7feeb5a73d9f2703d90dd5ebcc2b')
       or (r.name = 'bulk_adjust_prices' and md5(r.prosrc) <> '9244c5fe20c59d71f683def7adde0a0b') then
      raise exception 'PRIJS-GATEN-1: % wijkt af van de live versie van 2-11-2026 (md5 %); eerst nalezen',
        r.name, md5(r.prosrc);
    end if;
  end loop;
end
$drift$;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_fn_prijs_gaten_1 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, md5(p.prosrc) as src_md5
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('guard_product_commercial_fields', 'bulk_adjust_prices');
revoke all on snapshots.sellqo_20261102_fn_prijs_gaten_1 from anon, authenticated;

-- 1. bulk_adjust_prices: rolcheck tenant_admin/staff ----------------------------------------------------
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
    -- PRIJS-GATEN-1: prijzen in bulk aanpassen enkel als beheerder of medewerker van elke betrokken winkel.
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = ANY(p_product_ids)
        AND NOT public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    ) THEN
      RAISE EXCEPTION 'Prijzen aanpassen mag enkel een beheerder of medewerker' USING ERRCODE = '42501';
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

-- 3. guard_product_commercial_fields: default-deny op prijsvelden ---------------------------------------
CREATE OR REPLACE FUNCTION public.guard_product_commercial_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_beperkt boolean;
BEGIN
  -- Server-to-server (edge functions met service role, cron, imports, migraties) heeft geen
  -- auth.uid(): die paden blijven ongemoeid, net als in de SEC-0b-conventie.
  -- PRIJS-GATEN-1: behalve een anon-JWT (ook geen auth.uid()); die valt door naar de prijscontrole.
  IF auth.uid() IS NULL THEN
    IF coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))
       IS DISTINCT FROM 'anon' THEN
      RETURN NEW;
    END IF;
  ELSIF public.is_platform_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Ruim-naar-smal: wie tenant_admin of staff is, mag alles.
  IF public.has_tenant_role(NEW.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]) THEN
    RETURN NEW;
  END IF;

  -- PRIJS-GATEN-1: default-deny. Elke andere rol (marketing, warehouse, viewer, accountant, een
  -- toekomstige rol, anon) mag geen prijs- of btw-veld wijzigen.
  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.compare_at_price IS DISTINCT FROM OLD.compare_at_price
     OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
     OR NEW.vat_rate_id IS DISTINCT FROM OLD.vat_rate_id
     OR NEW.takeaway_vat_rate_id IS DISTINCT FROM OLD.takeaway_vat_rate_id THEN
    RAISE EXCEPTION 'Prijsvelden mogen niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  v_beperkt := public.has_tenant_role(NEW.tenant_id, ARRAY['marketing'::app_role, 'warehouse'::app_role]);
  IF NOT v_beperkt THEN
    RETURN NEW;
  END IF;

  IF NEW.sku IS DISTINCT FROM OLD.sku
     OR NEW.barcode IS DISTINCT FROM OLD.barcode THEN
    RAISE EXCEPTION 'Artikelnummer en barcode mogen niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.stock IS DISTINCT FROM OLD.stock
      OR NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold)
     AND NOT public.has_tenant_role(NEW.tenant_id, ARRAY['warehouse'::app_role]) THEN
    RAISE EXCEPTION 'Voorraad mag niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. product_variants: guard op de prijsvelden --------------------------------------------------------
-- De winkel komt van het product (zoals de RLS-policies op product_variants), voor de oude én de nieuwe
-- product_id. De lookup geeft enkel een tenant-id terug voor de rolcheck, geen data.
create or replace function public.guard_product_variant_price_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_old_tenant uuid;
  v_new_tenant uuid;
begin
  -- PRIJS-GATEN-1
  if NEW.price is not distinct from OLD.price
     and NEW.compare_at_price is not distinct from OLD.compare_at_price
     and NEW.cost_price is not distinct from OLD.cost_price then
    return NEW;
  end if;

  if auth.uid() is null then
    if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))
       is distinct from 'anon' then
      return NEW;  -- server: service role, cron, imports, migraties
    end if;
  elsif public.is_platform_admin(auth.uid()) then
    return NEW;
  end if;

  select p.tenant_id into v_old_tenant from public.products p where p.id = OLD.product_id;
  select p.tenant_id into v_new_tenant from public.products p where p.id = NEW.product_id;
  if v_old_tenant is not null and v_new_tenant is not null
     and public.has_tenant_role(v_old_tenant, array['tenant_admin'::app_role, 'staff'::app_role])
     and public.has_tenant_role(v_new_tenant, array['tenant_admin'::app_role, 'staff'::app_role]) then
    return NEW;
  end if;

  raise exception 'Prijsvelden mogen niet met deze rol gewijzigd worden'
    using errcode = '42501';
end;
$function$;

revoke all on function public.guard_product_variant_price_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_product_variant_price_fields on public.product_variants;
create trigger trg_guard_product_variant_price_fields
  before update of price, compare_at_price, cost_price on public.product_variants
  for each row execute function public.guard_product_variant_price_fields();

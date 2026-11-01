-- ALLERGEEN-ADMIN-1 — kaart_duplicate_product neemt allergens_declared mee.
--
-- Een kopie of nieuwe maat ("Maat of kopie toevoegen" op de Kaart) kopieerde allergens en dietary al,
-- maar niet de verklaring "bevat geen van de 14 allergenen" (ALLERGEEN-VERKLAARD-1). Zonder deze
-- wijziging zou een kopie van een "geen allergenen"-product als "niet ingevuld" verschijnen.
--
-- Vereist 20261101230340_allergeen_verklaard_1.sql (kolom products.allergens_declared). Draai die eerst.
--
-- Basis = de LIVE definitie (pg_get_functiondef, gelezen 01-11-2026), gelijk aan
-- 20261024210000_kaart_3_menu_order.sql. Enige wijziging: allergens_declared in de insert-kolommen en
-- -waarden. Signatuur, security definer, search_path, rolcontrole en grants ongewijzigd.
-- Idempotent (create or replace).
--
-- Handmatig terugdraaien: de definitie uit 20261024210000_kaart_3_menu_order.sql opnieuw uitvoeren
-- (of deze zonder de twee "allergens_declared"-regels).

create or replace function public.kaart_duplicate_product(p_tenant_id uuid, p_product_id uuid, p_name text, p_price text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  src public.products%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_price numeric;
  v_base text;
  v_slug text;
  v_n int := 1;
  v_pos int;
  v_id uuid;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if length(v_name) < 1 or length(v_name) > 150 then
    raise exception 'productnaam: 1 tot 150 tekens' using errcode = '22023';
  end if;
  if coalesce(p_price, '') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' then
    raise exception 'prijs tussen 0 en 99999,99' using errcode = '22023';
  end if;
  v_price := p_price::numeric;
  select * into src from public.products pr where pr.id = p_product_id and pr.tenant_id = p_tenant_id;
  if src.id is null then raise exception 'onbekend product' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('kaart_products|' || p_tenant_id::text, 0));
  v_base := public.kaart_slug(v_name);
  v_slug := v_base;
  while exists (select 1 from public.products pr where pr.tenant_id = p_tenant_id and pr.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- Net onder het origineel: eerst de volgorde van die categorie vastzetten, dan wat erna
  -- komt één plaats opschuiven.
  perform public.kaart_fill_positions(p_tenant_id, src.category_id);
  select pr.menu_position into v_pos from public.products pr where pr.id = src.id;
  v_pos := v_pos + 1;
  update public.products pr set menu_position = pr.menu_position + 1
    where pr.tenant_id = p_tenant_id and pr.category_id is not distinct from src.category_id
      and pr.menu_position >= v_pos and pr.id <> src.id;

  insert into public.products (tenant_id, name, slug, price, category_id, vat_rate_id, takeaway_vat_rate_id,
      is_active, track_inventory, requires_shipping, channels, allergens, dietary, description, short_description,
      images, featured_image, product_type, hide_from_storefront, menu_position,
      allergens_declared)
    values (p_tenant_id, v_name, v_slug, v_price, src.category_id, src.vat_rate_id, src.takeaway_vat_rate_id,
      true, false, false, src.channels, src.allergens, src.dietary, src.description, src.short_description,
      src.images, src.featured_image, src.product_type, src.hide_from_storefront, v_pos,
      src.allergens_declared)
    returning id into v_id;
  insert into public.product_categories (product_id, category_id, is_primary, sort_order)
    select v_id, pc.category_id, pc.is_primary, pc.sort_order from public.product_categories pc where pc.product_id = src.id
    on conflict (product_id, category_id) do nothing;
  update public.product_addon_groups g set product_ids = g.product_ids || v_id
    where g.tenant_id = p_tenant_id and src.id = any(g.product_ids) and not (v_id = any(g.product_ids));
  insert into public.prep_station_routes (tenant_id, station_id, product_id)
    select p_tenant_id, r.station_id, v_id from public.prep_station_routes r where r.tenant_id = p_tenant_id and r.product_id = src.id
    on conflict do nothing;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$function$;

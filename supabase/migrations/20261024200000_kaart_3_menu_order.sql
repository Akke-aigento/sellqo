-- KAART-3 — de Kaart als volgorde van de kassa, en product dupliceren / maat toevoegen.
--
-- * products.menu_position (nullable int): volgorde binnen de categorie op de Kaart en de
--   kassa (kassa 0.6.1 sorteert erop, dan op naam). Leeg = achteraan, alfabetisch (zoals nu).
-- * kaart_reorder: volgorde van producten (binnen hun categorie) of van categorieën zetten.
-- * kaart_duplicate_product: een product kopiëren, bv. als nieuwe maat ("Pils 33cl"), met
--   dezelfde categorie, btw, kanalen, allergenen, foto, beschrijving, extra's en post.
-- * kaart_add_products: nieuwe producten komen achteraan in hun categorie.
--
-- Strikt additief: één nullable kolom (niets gevoeligs; storefront-api leest products met
-- een vaste kolomlijst of select('*'), een extra getal verandert geen bestaand contract),
-- twee nieuwe functies en kaart_add_products opnieuw gedefinieerd (zelfde signatuur).
--
-- Handmatig terugdraaien:
--   drop function if exists public.kaart_reorder(uuid, text, uuid[]);
--   drop function if exists public.kaart_duplicate_product(uuid, uuid, text, text);
--   kaart_add_products: de versie uit 20261024180000 opnieuw draaien.
--   (kolom products.menu_position laten staan: droppen is onomkeerbaar en niet nodig)

alter table public.products add column if not exists menu_position integer;
comment on column public.products.menu_position is 'KAART-3: volgorde binnen de categorie op de Kaart en de kassa; null = achteraan, op naam.';
create index if not exists products_tenant_menu_position on public.products (tenant_id, category_id, menu_position);

-- ── Volgorde zetten ─────────────────────────────────────────────────────────────────────
-- p_kind 'products': p_ids in de gewenste volgorde (één categorie tegelijk, zoals de Kaart
-- het stuurt); 'categories': de categorieën van de zaak in de gewenste volgorde.
-- Enkel rijen van deze zaak; vreemde id's worden genegeerd. Geeft het aantal terug.
create or replace function public.kaart_reorder(p_tenant_id uuid, p_kind text, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_rows int;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) < 1 or cardinality(p_ids) > 1000 then
    raise exception 'volgorde: 1 tot 1000 id''s' using errcode = '22023';
  end if;
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'volgorde: dubbele id''s' using errcode = '22023';
  end if;
  if p_kind = 'products' then
    update public.products pr set menu_position = o.pos - 1
      from unnest(p_ids) with ordinality as o(id, pos)
      where pr.id = o.id and pr.tenant_id = p_tenant_id and pr.menu_position is distinct from (o.pos - 1)::int;
  elsif p_kind = 'categories' then
    update public.categories c set sort_order = o.pos - 1
      from unnest(p_ids) with ordinality as o(id, pos)
      where c.id = o.id and c.tenant_id = p_tenant_id and c.sort_order is distinct from (o.pos - 1)::int;
  else
    raise exception 'onbekende soort' using errcode = '22023';
  end if;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke all on function public.kaart_reorder(uuid, text, uuid[]) from public, anon;
grant execute on function public.kaart_reorder(uuid, text, uuid[]) to authenticated;

-- ── Product dupliceren (nieuwe maat) ────────────────────────────────────────────────────
-- Kopieert de horeca-velden; het nieuwe product komt net onder het origineel. Extra's die
-- rechtstreeks aan het origineel hangen (product_addon_groups.product_ids) en een eigen
-- post (prep_station_routes per product) gaan mee. Geeft {id, slug} terug.
create or replace function public.kaart_duplicate_product(p_tenant_id uuid, p_product_id uuid, p_name text, p_price text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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

  -- Net onder het origineel: wat erna komt, schuift één plaats op.
  if src.menu_position is null then
    select coalesce(max(pr.menu_position), -1) + 1 into v_pos from public.products pr
      where pr.tenant_id = p_tenant_id and pr.category_id is not distinct from src.category_id;
    update public.products set menu_position = v_pos where id = src.id;
    v_pos := v_pos + 1;
  else
    v_pos := src.menu_position + 1;
    update public.products pr set menu_position = pr.menu_position + 1
      where pr.tenant_id = p_tenant_id and pr.category_id is not distinct from src.category_id
        and pr.menu_position >= v_pos and pr.id <> src.id;
  end if;

  insert into public.products (tenant_id, name, slug, price, category_id, vat_rate_id, takeaway_vat_rate_id,
      is_active, track_inventory, requires_shipping, channels, allergens, dietary, description, short_description,
      images, featured_image, product_type, hide_from_storefront, menu_position)
    values (p_tenant_id, v_name, v_slug, v_price, src.category_id, src.vat_rate_id, src.takeaway_vat_rate_id,
      true, false, false, src.channels, src.allergens, src.dietary, src.description, src.short_description,
      src.images, src.featured_image, src.product_type, src.hide_from_storefront, v_pos)
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
$$;
revoke all on function public.kaart_duplicate_product(uuid, uuid, text, text) from public, anon;
grant execute on function public.kaart_duplicate_product(uuid, uuid, text, text) to authenticated;

-- ── Nieuwe producten achteraan in hun categorie ─────────────────────────────────────────
create or replace function public.kaart_add_products(p_tenant_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  it jsonb;
  v_name text;
  v_price numeric;
  v_cat uuid;
  v_vat uuid;
  v_take uuid;
  v_base text;
  v_slug text;
  v_n int;
  v_id uuid;
  v_out jsonb := '[]'::jsonb;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 300 then
    raise exception 'producten: lijst van 1 tot 300' using errcode = '22023';
  end if;
  -- Slugs zijn uniek per zaak: gelijktijdige imports in dezelfde zaak na elkaar.
  perform pg_advisory_xact_lock(hashtextextended('kaart_products|' || p_tenant_id::text, 0));
  for it in select * from jsonb_array_elements(p_items) loop
    v_name := btrim(coalesce(it ->> 'name', ''));
    if length(v_name) < 1 or length(v_name) > 150 then
      raise exception 'productnaam: 1 tot 150 tekens' using errcode = '22023';
    end if;
    if coalesce(it ->> 'price', '') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' then
      raise exception 'prijs voor "%": tussen 0 en 99999,99', v_name using errcode = '22023';
    end if;
    v_price := (it ->> 'price')::numeric;
    v_cat := null; v_vat := null; v_take := null;
    if coalesce(it ->> 'category_id', '') <> '' then
      if (it ->> 'category_id') !~ '^[0-9a-f-]{36}$' then
        raise exception 'ongeldige categorie' using errcode = '22023';
      end if;
      select c.id, c.default_vat_rate_id, c.default_takeaway_vat_rate_id into v_cat, v_vat, v_take
        from public.categories c where c.id = (it ->> 'category_id')::uuid and c.tenant_id = p_tenant_id;
      if v_cat is null then
        raise exception 'onbekende categorie' using errcode = '22023';
      end if;
    end if;
    v_base := public.kaart_slug(v_name);
    v_slug := v_base;
    v_n := 1;
    while exists (select 1 from public.products pr where pr.tenant_id = p_tenant_id and pr.slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    -- Zoals de bestaande horecaproducten: geen voorraad, geen verzending.
    -- KAART-3: achteraan in de eigen categorie (volgorde van de Kaart = volgorde op de kassa).
    insert into public.products (tenant_id, name, slug, price, category_id, vat_rate_id, takeaway_vat_rate_id, is_active, track_inventory, requires_shipping, menu_position)
      values (p_tenant_id, v_name, v_slug, v_price, v_cat, v_vat, v_take, true, false, false,
        (select coalesce(max(pr.menu_position), -1) + 1 from public.products pr where pr.tenant_id = p_tenant_id and pr.category_id is not distinct from v_cat))
      returning id into v_id;
    if v_cat is not null then
      insert into public.product_categories (product_id, category_id, is_primary, sort_order)
        values (v_id, v_cat, true, 0)
        on conflict (product_id, category_id) do nothing;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'name', v_name, 'slug', v_slug));
  end loop;
  return v_out;
end;
$$;
revoke all on function public.kaart_add_products(uuid, jsonb) from public, anon;
grant execute on function public.kaart_add_products(uuid, jsonb) to authenticated;

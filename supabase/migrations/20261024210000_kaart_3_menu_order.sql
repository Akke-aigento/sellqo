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
-- Ook: kaart_fill_positions (intern), kaart_bulk_update opnieuw (verplaatsen = achteraan) en
-- guard_product_commercial_fields met takeaway_vat_rate_id erbij.
--
-- Handmatig terugdraaien:
--   drop function if exists public.kaart_fill_positions(uuid, uuid);
--   kaart_bulk_update: de versie uit 20261024180000 opnieuw draaien;
--   guard_product_commercial_fields: de regel met takeaway_vat_rate_id weghalen;
--   drop function if exists public.kaart_reorder(uuid, text, uuid[]);
--   drop function if exists public.kaart_duplicate_product(uuid, uuid, text, text);
--   kaart_add_products: de versie uit 20261024180000 opnieuw draaien.
--   (kolom products.menu_position laten staan: droppen is onomkeerbaar en niet nodig)

alter table public.products add column if not exists menu_position integer;
comment on column public.products.menu_position is 'KAART-3: volgorde binnen de categorie op de Kaart en de kassa; null = achteraan, op naam.';
create index if not exists products_tenant_menu_position on public.products (tenant_id, category_id, menu_position);

-- ── Posities vastzetten (intern) ────────────────────────────────────────────────────────
-- Producten van vóór KAART-3 hebben geen positie (null = achteraan, op naam). Vóór we iets
-- toevoegen, dupliceren of verplaatsen, zetten we die volgorde in die ene categorie vast:
-- na de bestaande posities, op naam. Zo verandert er niets aan wat de uitbater ziet, en komt
-- een nieuw product echt achteraan. Enkel aanroepbaar vanuit de kaart_*-functies.
-- Producten zonder categorie laten we met rust: dat zijn vaak webshopproducten, en een
-- extra update zou hun updated_at (en marketplace-syncs) raken.
create or replace function public.kaart_fill_positions(p_tenant_id uuid, p_category_id uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  with base as (
    select coalesce(max(pr.menu_position), -1) as m from public.products pr
      where pr.tenant_id = p_tenant_id and pr.category_id is not distinct from p_category_id
  ), todo as (
    select pr.id, row_number() over (order by pr.name, pr.id) as rn from public.products pr
      where p_category_id is not null and pr.tenant_id = p_tenant_id and pr.category_id = p_category_id and pr.menu_position is null
  )
  update public.products pr set menu_position = base.m + todo.rn
    from todo, base where pr.id = todo.id;
$$;
revoke all on function public.kaart_fill_positions(uuid, uuid) from public, anon, authenticated;

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
  -- Zelfde lock als toevoegen/dupliceren: geen twee gelijke posities door gelijktijdig werk.
  perform pg_advisory_xact_lock(hashtextextended('kaart_products|' || p_tenant_id::text, 0));
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
    -- KAART-3: achteraan in de eigen categorie (volgorde van de Kaart = volgorde op de kassa);
    -- producten zonder positie krijgen eerst hun huidige plaats (op naam).
    perform public.kaart_fill_positions(p_tenant_id, v_cat);
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

-- ── Bulk: verplaatsen zet het product achteraan in de nieuwe categorie ─────────────────
create or replace function public.kaart_bulk_update(p_tenant_id uuid, p_ids uuid[], p jsonb)
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ids uuid[];
  v_mode text;
  v_value numeric;
  v_cat uuid;
  v_count int := 0;
  v_rows int;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) < 1 or cardinality(p_ids) > 500 then
    raise exception 'selectie: 1 tot 500 producten' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p, 'null'::jsonb)) <> 'object' then
    raise exception 'geen wijziging' using errcode = '22023';
  end if;
  -- Enkel producten van deze zaak; de rest wordt stil genegeerd.
  select array_agg(pr.id) into v_ids from public.products pr where pr.id = any(p_ids) and pr.tenant_id = p_tenant_id;
  if v_ids is null then return 0; end if;

  if p ? 'price' then
    v_mode := p -> 'price' ->> 'mode';
    if coalesce(p -> 'price' ->> 'value', '') !~ '^-?[0-9]{1,5}(\.[0-9]{1,4})?$' then
      raise exception 'ongeldige prijswijziging' using errcode = '22023';
    end if;
    v_value := (p -> 'price' ->> 'value')::numeric;
    if v_mode = 'set' then
      if v_value < 0 then raise exception 'prijs mag niet negatief zijn' using errcode = '22023'; end if;
      update public.products set price = round(v_value, 2) where id = any(v_ids) and price is distinct from round(v_value, 2);
    elsif v_mode = 'add' then
      -- Nooit stil op € 0 zetten: dan liever niets wijzigen en het zeggen.
      if exists (select 1 from public.products where id = any(v_ids) and price + v_value < 0) then
        raise exception 'een of meer producten zouden onder € 0 gaan' using errcode = '22023';
      end if;
      update public.products set price = round(price + v_value, 2) where id = any(v_ids) and v_value <> 0;
    elsif v_mode = 'percent' then
      if v_value <= -100 or v_value > 1000 then raise exception 'percentage tussen -99 en 1000' using errcode = '22023'; end if;
      update public.products set price = round(price * (1 + v_value / 100), 2) where id = any(v_ids) and v_value <> 0;
    else
      raise exception 'onbekende prijswijziging' using errcode = '22023';
    end if;
    get diagnostics v_rows = row_count; v_count := greatest(v_count, v_rows);
  end if;

  if p ? 'is_active' then
    if jsonb_typeof(p -> 'is_active') <> 'boolean' then raise exception 'is_active: waar of onwaar' using errcode = '22023'; end if;
    update public.products set is_active = (p ->> 'is_active')::boolean where id = any(v_ids) and is_active is distinct from (p ->> 'is_active')::boolean;
    get diagnostics v_rows = row_count; v_count := greatest(v_count, v_rows);
  end if;

  if p ? 'category_id' then
    if coalesce(p ->> 'category_id', '') !~ '^[0-9a-f-]{36}$' then raise exception 'ongeldige categorie' using errcode = '22023'; end if;
    select c.id into v_cat from public.categories c where c.id = (p ->> 'category_id')::uuid and c.tenant_id = p_tenant_id;
    if v_cat is null then raise exception 'onbekende categorie' using errcode = '22023'; end if;
    -- KAART-3: een verplaatst product komt achteraan in zijn nieuwe categorie.
    perform pg_advisory_xact_lock(hashtextextended('kaart_products|' || p_tenant_id::text, 0));
    perform public.kaart_fill_positions(p_tenant_id, v_cat);
    with moved as (
      select pr.id, row_number() over (order by pr.menu_position nulls last, pr.name) as rn
        from public.products pr where pr.id = any(v_ids) and pr.category_id is distinct from v_cat
    ), base as (
      select coalesce(max(x.menu_position), -1) as m from public.products x where x.tenant_id = p_tenant_id and x.category_id = v_cat
    )
    update public.products pr set category_id = v_cat, menu_position = base.m + moved.rn
      from moved, base where pr.id = moved.id;
    get diagnostics v_rows = row_count; v_count := greatest(v_count, v_rows);
    -- Koppeltabel: de oude primaire categorie eruit, de nieuwe als primaire erin.
    delete from public.product_categories pc where pc.product_id = any(v_ids) and (pc.is_primary or pc.category_id = v_cat);
    insert into public.product_categories (product_id, category_id, is_primary, sort_order)
      select x, v_cat, true, 0 from unnest(v_ids) x
      on conflict (product_id, category_id) do update set is_primary = true;
  end if;

  if coalesce((p ->> 'apply_category_vat')::boolean, false) then
    -- Enkel waar de categorie een standaard heeft; een lege standaard wist niets.
    update public.products pr set
        vat_rate_id = coalesce(c.default_vat_rate_id, pr.vat_rate_id),
        takeaway_vat_rate_id = coalesce(c.default_takeaway_vat_rate_id, pr.takeaway_vat_rate_id)
      from public.categories c
      where pr.id = any(v_ids) and c.id = pr.category_id and c.tenant_id = p_tenant_id
        and (pr.vat_rate_id is distinct from coalesce(c.default_vat_rate_id, pr.vat_rate_id)
          or pr.takeaway_vat_rate_id is distinct from coalesce(c.default_takeaway_vat_rate_id, pr.takeaway_vat_rate_id));
    get diagnostics v_rows = row_count; v_count := greatest(v_count, v_rows);
  end if;

  return v_count;
end;
$$;
revoke all on function public.kaart_bulk_update(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.kaart_bulk_update(uuid, uuid[], jsonb) to authenticated;

-- ── Guard: ook de afhaal-btw is een commercieel veld ────────────────────────────────────
-- Zelfde functie als live (md5 6295917d… op 24-10 nagetrokken), met takeaway_vat_rate_id
-- erbij: marketing/warehouse mochten die tot nu via de API wijzigen, en horeca_apply rekent
-- ermee. De trigger trg_guard_product_commercial_fields blijft dezelfde.
create or replace function public.guard_product_commercial_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_beperkt boolean;
BEGIN
  -- Server-to-server (edge functions, cron, imports) heeft geen auth.uid():
  -- die paden blijven ongemoeid, net als in de SEC-0b-conventie.
  IF auth.uid() IS NULL OR public.is_platform_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Ruim-naar-smal: wie tenant_admin of staff is, mag alles.
  IF public.has_tenant_role(NEW.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]) THEN
    RETURN NEW;
  END IF;

  v_beperkt := public.has_tenant_role(NEW.tenant_id, ARRAY['marketing'::app_role, 'warehouse'::app_role]);
  IF NOT v_beperkt THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.compare_at_price IS DISTINCT FROM OLD.compare_at_price
     OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
     OR NEW.vat_rate_id IS DISTINCT FROM OLD.vat_rate_id
     OR NEW.takeaway_vat_rate_id IS DISTINCT FROM OLD.takeaway_vat_rate_id THEN
    RAISE EXCEPTION 'Prijsvelden mogen niet met deze rol gewijzigd worden'
      USING ERRCODE = '42501';
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

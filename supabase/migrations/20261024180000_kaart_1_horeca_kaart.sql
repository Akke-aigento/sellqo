-- KAART-1 — de horeca-kaart: snel producten aanmaken en bewerken (tab Kaart onder Bestellen).
--
-- Een product is voor een horecazaak een naam en een prijs; de rest komt van de categorie.
-- Daarom krijgt een categorie een standaard-btw (ter plaatse en bij meenemen). Een nieuw
-- product via de Kaart neemt die over (gestempeld op het product, zodat kassa, webshop en
-- QR-menu niets nieuws moeten lezen: zij blijven products.vat_rate_id gebruiken).
--
-- Strikt additief:
--   * categories: twee nieuwe, nullable kolommen (geen bestaande kolom geraakt).
--   * drie nieuwe functies: kaart_add_products, kaart_ensure_category, kaart_bulk_update.
-- Niets gevoeligs: de kolommen bevatten enkel een verwijzing naar een (globaal) btw-tarief.
--
-- Handmatig terugdraaien (geen DOWN):
--   drop function if exists public.kaart_bulk_update(uuid, uuid[], jsonb);
--   drop function if exists public.kaart_add_products(uuid, jsonb);
--   drop function if exists public.kaart_ensure_category(uuid, text, uuid, uuid);
--   drop function if exists public.kaart_slug(text);
--   -- De kolommen laten staan (droppen is onomkeerbaar en niet nodig):
--   -- categories.default_vat_rate_id, categories.default_takeaway_vat_rate_id

alter table public.categories add column if not exists default_vat_rate_id uuid references public.vat_rates(id) on delete set null;
alter table public.categories add column if not exists default_takeaway_vat_rate_id uuid references public.vat_rates(id) on delete set null;

comment on column public.categories.default_vat_rate_id is 'KAART-1: standaard-btw voor nieuwe producten in deze categorie (ter plaatse / gewoon).';
comment on column public.categories.default_takeaway_vat_rate_id is 'KAART-1: standaard-btw bij meenemen voor nieuwe producten in deze categorie.';

-- ── Slug zonder extensies (unaccent staat niet aan) ──────────────────────────────────────
create or replace function public.kaart_slug(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_name, '')),
      'àáâãäåāçćčèéêëēėęìíîïīįłñńòóôõöøōùúûüūÿýžźż',
      'aaaaaaaccceeeeeeeiiiiiilnnoooooooouuuuuyyzzz'),
    '[^a-z0-9]+', '-', 'g')), ''), 'product');
$$;
revoke all on function public.kaart_slug(text) from public, anon;
grant execute on function public.kaart_slug(text) to authenticated;

-- ── Categorie opzoeken of aanmaken (startkaart, plakken, foto-import) ───────────────────
-- Zelfde naam (hoofdletterongevoelig) = dezelfde categorie. Bij een nieuwe categorie worden de
-- meegegeven standaard-tarieven gezet; een bestaande categorie houdt haar eigen instellingen.
create or replace function public.kaart_ensure_category(p_tenant_id uuid, p_name text, p_vat_rate_id uuid default null, p_takeaway_vat_rate_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_sort int;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'categorienaam: 1 tot 80 tekens' using errcode = '22023';
  end if;
  for v_id in select unnest(array[p_vat_rate_id, p_takeaway_vat_rate_id]) loop
    if v_id is not null and not exists (select 1 from public.vat_rates vr where vr.id = v_id and (vr.tenant_id is null or vr.tenant_id = p_tenant_id)) then
      raise exception 'onbekend btw-tarief' using errcode = '22023';
    end if;
  end loop;
  -- Gelijktijdige imports na elkaar (per zaak): geen dubbele categorie en geen slug-botsing.
  perform pg_advisory_xact_lock(hashtextextended('kaart_category|' || p_tenant_id::text, 0));
  select c.id into v_id from public.categories c
    where c.tenant_id = p_tenant_id and lower(btrim(c.name)) = lower(v_name)
    order by c.is_active desc nulls last, c.created_at limit 1;
  if v_id is not null then
    -- Een verborgen (inactieve) categorie met die naam komt terug.
    update public.categories set is_active = true where id = v_id and is_active is not true;
    return v_id;
  end if;
  v_base := public.kaart_slug(v_name);
  v_slug := v_base;
  while exists (select 1 from public.categories c where c.tenant_id = p_tenant_id and c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  select coalesce(max(c.sort_order), -1) + 1 into v_sort from public.categories c where c.tenant_id = p_tenant_id;
  insert into public.categories (tenant_id, name, slug, sort_order, is_active, default_vat_rate_id, default_takeaway_vat_rate_id)
    values (p_tenant_id, v_name, v_slug, v_sort, true, p_vat_rate_id, p_takeaway_vat_rate_id)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.kaart_ensure_category(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.kaart_ensure_category(uuid, text, uuid, uuid) to authenticated;

-- ── Producten toevoegen (één of een hele lijst) ──────────────────────────────────────────
-- p_items: [{ "name": "Duvel", "price": 4.5, "category_id": "…" }, …] — max. 300 per keer.
-- Geeft [{ "id", "name", "slug" }] terug, in dezelfde volgorde.
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
    insert into public.products (tenant_id, name, slug, price, category_id, vat_rate_id, takeaway_vat_rate_id, is_active, track_inventory, requires_shipping)
      values (p_tenant_id, v_name, v_slug, v_price, v_cat, v_vat, v_take, true, false, false)
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

-- ── Bulk aanpassen ───────────────────────────────────────────────────────────────────────
-- p: { "price": { "mode": "set"|"add"|"percent", "value": 0.1 },
--      "is_active": true|false,
--      "category_id": "…",          -- verplaatsen (primaire categorie)
--      "apply_category_vat": true } -- btw van de (eigen) categorie overnemen
-- Max. 500 producten. Prijzen worden afgerond op de cent; een verlaging die een product onder
-- € 0 zou brengen, wordt geweigerd (22023) en verandert niets.
-- Geeft het aantal gewijzigde producten terug.
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
    update public.products set category_id = v_cat where id = any(v_ids) and category_id is distinct from v_cat;
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

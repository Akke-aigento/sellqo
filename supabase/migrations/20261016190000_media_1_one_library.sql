-- MEDIA-1 (16-10-2026) — één mediabibliotheek.
--
-- Probleem: foto's die je rechtstreeks in een product (of variant/categorie) oplaadt,
-- kwamen nooit in media_assets. De bibliotheekkiezers lezen alleen media_assets, dus
-- die foto's waren daar onvindbaar (Mancini: 4 van 144 productfoto's).
--
-- Oplossing, strikt additief:
--   1. Unieke sleutel (tenant_id, file_url) op media_assets, zodat registreren
--      idempotent kan (ON CONFLICT DO NOTHING). Op 16-10 live: 0 dubbels.
--   2. Hulpfuncties voor bestandsnaam en MIME-type uit een URL.
--   3. Triggers (AFTER) op products.images/featured_image, product_variants.image_url/
--      images en categories.image_url: elke nieuwe URL krijgt een media_assets-rij.
--      Ze verwijderen NOOIT iets en kunnen een product-save NOOIT breken: een fout
--      wordt als WARNING gelogd en de trigger geeft NEW gewoon terug.
--   4. Backfill van de bestaande foto's, met de created_at van het product/de categorie
--      (deterministisch, geen now()), idempotent via ON CONFLICT.
--
-- Eerste wet: geen gedeelde storefront-tabel geraakt; media_assets wordt door geen
-- storefront-functie gelezen. products/product_variants/categories krijgen enkel een
-- AFTER-trigger die er niets in wijzigt.
--
-- Terugdraaien (handmatig):
--   drop trigger if exists trg_products_media_register on public.products;
--   drop trigger if exists trg_product_variants_media_register on public.product_variants;
--   drop trigger if exists trg_categories_media_register on public.categories;
--   drop function if exists public.media_register_from_products();
--   drop function if exists public.media_register_from_variants();
--   drop function if exists public.media_register_from_categories();
--   drop function if exists public.media_register_urls(uuid, text[], text, text, text, timestamptz);
--   drop function if exists public.media_file_name_from_url(text);
--   drop function if exists public.media_mime_from_url(text);
--   -- de backfill-rijen: delete from public.media_assets where source in ('product','variant','category');
--   drop index if exists public.media_assets_tenant_url_uniq;

-- 1. Unieke sleutel ---------------------------------------------------------------
create unique index if not exists media_assets_tenant_url_uniq
  on public.media_assets (tenant_id, file_url);

-- 2. Hulpfuncties -----------------------------------------------------------------
create or replace function public.media_file_name_from_url(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(regexp_replace(split_part(split_part(p_url, '?', 1), '#', 1), '^.*/', ''), ''),
    'afbeelding'
  );
$$;

create or replace function public.media_mime_from_url(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(substring(split_part(split_part(p_url, '?', 1), '#', 1) from '\.([A-Za-z0-9]+)$'))
    when 'png'  then 'image/png'
    when 'webp' then 'image/webp'
    when 'gif'  then 'image/gif'
    when 'avif' then 'image/avif'
    when 'svg'  then 'image/svg+xml'
    when 'heic' then 'image/heic'
    when 'heif' then 'image/heif'
    else 'image/jpeg'
  end;
$$;

-- Registreert een lijst URL's voor één tenant. Bestaande rijen blijven onaangeroerd.
create or replace function public.media_register_urls(
  p_tenant uuid,
  p_urls text[],
  p_folder text,
  p_source text,
  p_title text,
  p_created timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if p_tenant is null or p_urls is null then
    return 0;
  end if;

  insert into public.media_assets (tenant_id, file_name, file_url, file_type, title, source, folder, tags, created_at, updated_at)
  select p_tenant,
         public.media_file_name_from_url(u),
         u,
         public.media_mime_from_url(u),
         p_title,
         p_source,
         p_folder,
         '{}'::text[],
         coalesce(p_created, now()),
         coalesce(p_created, now())
  from (select distinct trim(x) as u from unnest(p_urls) as x) s
  where u is not null and u <> '' and u ~* '^https?://'
  on conflict (tenant_id, file_url) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Alleen de triggers en de migratie roepen dit aan; geen client-toegang.
revoke all on function public.media_register_urls(uuid, text[], text, text, text, timestamptz) from public, anon, authenticated;

-- 3. Triggers ---------------------------------------------------------------------
create or replace function public.media_register_from_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.images is not distinct from old.images
     and new.featured_image is not distinct from old.featured_image then
    return new;
  end if;
  begin
    perform public.media_register_urls(
      new.tenant_id,
      coalesce(new.images, '{}'::text[]) || coalesce(array[new.featured_image], '{}'::text[]),
      'products', 'product', new.name, now());
  exception when others then
    raise warning 'MEDIA-1: registreren productfoto''s mislukt voor product %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.media_register_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.images is not distinct from old.images
     and new.image_url is not distinct from old.image_url then
    return new;
  end if;
  begin
    perform public.media_register_urls(
      new.tenant_id,
      coalesce(new.images, '{}'::text[]) || coalesce(array[new.image_url], '{}'::text[]),
      'products', 'variant', new.title, now());
  exception when others then
    raise warning 'MEDIA-1: registreren variantfoto''s mislukt voor variant %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.media_register_from_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.image_url is not distinct from old.image_url then
    return new;
  end if;
  begin
    perform public.media_register_urls(
      new.tenant_id, array[new.image_url], 'categories', 'category', new.name, now());
  exception when others then
    raise warning 'MEDIA-1: registreren categoriefoto mislukt voor categorie %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_products_media_register on public.products;
create trigger trg_products_media_register
  after insert or update of images, featured_image on public.products
  for each row execute function public.media_register_from_products();

drop trigger if exists trg_product_variants_media_register on public.product_variants;
create trigger trg_product_variants_media_register
  after insert or update of images, image_url on public.product_variants
  for each row execute function public.media_register_from_variants();

drop trigger if exists trg_categories_media_register on public.categories;
create trigger trg_categories_media_register
  after insert or update of image_url on public.categories
  for each row execute function public.media_register_from_categories();

-- 4. Backfill (deterministisch: created_at van de bron, geen now()) -----------------
select public.media_register_urls(
  p.tenant_id,
  coalesce(p.images, '{}'::text[]) || coalesce(array[p.featured_image], '{}'::text[]),
  'products', 'product', p.name, p.created_at)
from public.products p
where p.images is not null or p.featured_image is not null;

select public.media_register_urls(
  v.tenant_id,
  coalesce(v.images, '{}'::text[]) || coalesce(array[v.image_url], '{}'::text[]),
  'products', 'variant', v.title, v.created_at)
from public.product_variants v
where v.images is not null or v.image_url is not null;

select public.media_register_urls(
  c.tenant_id, array[c.image_url], 'categories', 'category', c.name, c.created_at)
from public.categories c
where c.image_url is not null and c.image_url <> '';

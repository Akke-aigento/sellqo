-- MEDIA-2 (16-10-2026) — AI-beelden en social-beelden ook in de ene mediabibliotheek.
--
-- Aanleiding (recon 16-10 via query_database):
--   * ai_generated_images: 198 beelden, waarvan 80 niet in media_assets (alleen beelden die op
--     een product kwamen, zaten erin via de product-trigger, en dan met is_ai_generated = false).
--   * social_posts.image_urls: 15 beelden, geen enkel in media_assets.
--   * De tabs "Campagnes" en "Social" in Assets waren leeg: geen enkele rij had die map.
--
-- Wat dit doet (strikt additief; geen kolom of bestaande rij verwijderd):
--   1. Trigger op ai_generated_images (na insert): beeld in de bibliotheek, map 'products' als het
--      bij een product hoort, anders 'ai'; is_ai_generated = true. Bestaat de rij al (bv. via de
--      product-trigger), dan alleen is_ai_generated op true.
--   2. Trigger op social_posts (na insert of wijziging van image_urls): elk beeld in map 'social'.
--   3. Backfill van beide, met de created_at van de bronrij (geen now(): een herhaling raakt
--      geen latere rijen en geeft hetzelfde resultaat).
--   Beide triggerfuncties vangen elke fout af met een WARNING: een AI-generatie of social post
--   mag nooit mislukken omdat de bibliotheek iets niet kan registreren.
--
-- Geen gedeeld pad: storefront-api, storefront-customer-api en storefront-resolve lezen
-- media_assets, ai_generated_images en social_posts niet (grep 16-10).
--
-- Handmatig terugdraaien (de bibliotheekrijen zelf mogen blijven staan; het zijn verwijzingen,
-- geen bestanden):
--   drop trigger if exists trg_ai_generated_images_media_register on public.ai_generated_images;
--   drop trigger if exists trg_social_posts_media_register on public.social_posts;
--   drop function if exists public.media_register_from_ai_images();
--   drop function if exists public.media_register_from_social_posts();
--   -- optioneel de backfill: delete from public.media_assets where source in ('ai', 'social');

-- 1. AI-beelden ---------------------------------------------------------------------------

create or replace function public.media_register_from_ai_images()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.tenant_id is null or new.image_url is null or new.image_url !~* '^https?://' then
      return new;
    end if;
    insert into public.media_assets (tenant_id, file_name, file_url, file_type, width, height, title,
                                     source, folder, is_ai_generated, tags, created_at, updated_at)
    values (new.tenant_id,
            public.media_file_name_from_url(new.image_url),
            new.image_url,
            public.media_mime_from_url(new.image_url),
            new.width,
            new.height,
            nullif(left(coalesce(new.prompt, ''), 120), ''),
            'ai',
            case when new.source_product_id is not null then 'products' else 'ai' end,
            true,
            '{}'::text[],
            coalesce(new.created_at, now()),
            coalesce(new.created_at, now()))
    on conflict (tenant_id, file_url) do update
      set is_ai_generated = true
      where media_assets.is_ai_generated is distinct from true;
  exception when others then
    raise warning '[media] AI-beeld niet in bibliotheek gezet (%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.media_register_from_ai_images() from public, anon, authenticated;

drop trigger if exists trg_ai_generated_images_media_register on public.ai_generated_images;
create trigger trg_ai_generated_images_media_register
  after insert on public.ai_generated_images
  for each row execute function public.media_register_from_ai_images();

-- 2. Social-beelden -----------------------------------------------------------------------

create or replace function public.media_register_from_social_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.tenant_id is not null and new.image_urls is not null then
      perform public.media_register_urls(new.tenant_id, new.image_urls, 'social', 'social', null, now());
    end if;
  exception when others then
    raise warning '[media] social-beelden niet in bibliotheek gezet (%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.media_register_from_social_posts() from public, anon, authenticated;

drop trigger if exists trg_social_posts_media_register on public.social_posts;
create trigger trg_social_posts_media_register
  after insert or update of image_urls on public.social_posts
  for each row execute function public.media_register_from_social_posts();

-- 3. Backfill -----------------------------------------------------------------------------

-- 3a. AI-beelden die er nog niet in staan.
insert into public.media_assets (tenant_id, file_name, file_url, file_type, width, height, title,
                                 source, folder, is_ai_generated, tags, created_at, updated_at)
select distinct on (a.tenant_id, a.image_url)
       a.tenant_id,
       public.media_file_name_from_url(a.image_url),
       a.image_url,
       public.media_mime_from_url(a.image_url),
       a.width,
       a.height,
       nullif(left(coalesce(a.prompt, ''), 120), ''),
       'ai',
       case when a.source_product_id is not null then 'products' else 'ai' end,
       true,
       '{}'::text[],
       a.created_at,
       a.created_at
from public.ai_generated_images a
where a.tenant_id is not null and a.image_url ~* '^https?://'
order by a.tenant_id, a.image_url, a.created_at
on conflict (tenant_id, file_url) do nothing;

-- 3b. AI-beelden die er al in stonden (via de product-trigger): als AI-beeld markeren.
update public.media_assets m
set is_ai_generated = true
from public.ai_generated_images a
where a.tenant_id = m.tenant_id
  and a.image_url = m.file_url
  and m.is_ai_generated is distinct from true;

-- 3c. Social-beelden, per post met de created_at van die post.
select public.media_register_urls(s.tenant_id, s.image_urls, 'social', 'social', null, s.created_at)
from public.social_posts s
where s.tenant_id is not null and s.image_urls is not null and cardinality(s.image_urls) > 0
order by s.created_at;

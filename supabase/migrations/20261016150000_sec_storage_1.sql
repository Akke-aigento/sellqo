-- SEC-STORAGE-1 — 16 oktober 2026 — GEDRAAID op 16-10-2026 na Akke's go
--
-- Probleem (EDITOR-MEDIA-1, docs/prepared/2026-10-16-rls-escalatie-audit.md):
--   storage.objects had twee SELECT-policies zonder tenantcheck, voor rol public:
--     "Public read access for tenant assets"  (bucket_id = 'tenant-assets')
--     "Anyone can view product images"        (bucket_id = 'product-images')
--   storage.search / search_v2 / list_objects_with_delimiter zijn SECURITY INVOKER,
--   dus iedereen (ook anon) kon via storage.list() alle mappen en bestandsnamen van
--   alle winkels opsommen.
--
-- Fix (additief vóór destructief):
--   1. Snapshot van de twee oude policies in ops.sec_storage_1_prev_policies.
--   2. Nieuwe SELECT-policies voor authenticated, eigen tenantmap of platform-admin —
--      identiek aan het bestaande model marketing-assets_select_own_tenant en aan de
--      INSERT/UPDATE/DELETE-policies op deze buckets. Tekstvergelijking (geen ::uuid-cast),
--      dus een mapnaam die geen uuid is geeft geen cast-fout maar gewoon geen toegang.
--   3. Pas daarna de twee publieke policies weg.
--
-- Niet geraakt:
--   * Publieke object-URL's (/storage/v1/object/public/... en /storage/v1/render/image/public/...)
--     lopen voor public buckets (storage.buckets.public = true) buiten RLS om en blijven werken.
--   * service_role (edge functions delete-tenant, apply-printful-import) omzeilt RLS.
--   * Live staan alle objecten in beide buckets onder een <tenant_id>/-map van een bestaande
--     winkel (recon 16-10: 0 objecten daarbuiten), dus geen platformuitzondering nodig.
--
-- Idempotent: twee keer draaien geeft hetzelfde resultaat.
--
-- Terugdraaien (handmatig):
--   create policy "Public read access for tenant assets" on storage.objects
--     as permissive for select to public using (bucket_id = 'tenant-assets'::text);
--   create policy "Anyone can view product images" on storage.objects
--     as permissive for select to public using (bucket_id = 'product-images'::text);
--   -- optioneel ook de nieuwe weer weg:
--   drop policy if exists "tenant-assets_select_own_tenant" on storage.objects;
--   drop policy if exists "product-images_select_own_tenant" on storage.objects;
--   De exacte oude definities staan in ops.sec_storage_1_prev_policies.

create schema if not exists ops;
create table if not exists ops.sec_storage_1_prev_policies (
  schemaname text, tablename text, policyname text, permissive text, cmd text,
  roles text, qual text, with_check text,
  saved_at timestamptz not null default now(),
  primary key (schemaname, tablename, policyname)
);
insert into ops.sec_storage_1_prev_policies (schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check)
select schemaname, tablename, policyname, permissive, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('Public read access for tenant assets', 'Anyone can view product images')
on conflict do nothing;

-- 1. Nieuwe plek eerst
drop policy if exists "tenant-assets_select_own_tenant" on storage.objects;
create policy "tenant-assets_select_own_tenant" on storage.objects
  as permissive for select to authenticated
  using (
    bucket_id = 'tenant-assets'::text
    and (
      public.is_platform_admin(auth.uid())
      or (storage.foldername(name))[1] in (
        select tid::text from public.get_user_tenant_ids(auth.uid()) as tid(tid)
      )
    )
  );

drop policy if exists "product-images_select_own_tenant" on storage.objects;
create policy "product-images_select_own_tenant" on storage.objects
  as permissive for select to authenticated
  using (
    bucket_id = 'product-images'::text
    and (
      public.is_platform_admin(auth.uid())
      or (storage.foldername(name))[1] in (
        select tid::text from public.get_user_tenant_ids(auth.uid()) as tid(tid)
      )
    )
  );

-- 2. Dan pas de oude, open policies weg
drop policy if exists "Public read access for tenant assets" on storage.objects;
drop policy if exists "Anyone can view product images" on storage.objects;

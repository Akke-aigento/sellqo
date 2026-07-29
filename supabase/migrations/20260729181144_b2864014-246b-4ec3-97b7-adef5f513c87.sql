-- SEC-1: tenant-scope write policies on public storage buckets

-- product-images
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their uploaded images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "product-images_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "product-images_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)))
WITH CHECK (bucket_id = 'product-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "product-images_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

-- tenant-logos
DROP POLICY IF EXISTS "Authenticated users can upload tenant logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tenant logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tenant logos" ON storage.objects;

CREATE POLICY "tenant-logos_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-logos' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "tenant-logos_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-logos' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)))
WITH CHECK (bucket_id = 'tenant-logos' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "tenant-logos_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tenant-logos' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

-- ai-images
DROP POLICY IF EXISTS "Authenticated users can upload AI images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own AI images" ON storage.objects;

CREATE POLICY "ai-images_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "ai-images_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'ai-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)))
WITH CHECK (bucket_id = 'ai-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "ai-images_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'ai-images' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

-- tenant-assets
DROP POLICY IF EXISTS "Authenticated users can upload tenant assets" ON storage.objects;

CREATE POLICY "tenant-assets_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "tenant-assets_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)))
WITH CHECK (bucket_id = 'tenant-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "tenant-assets_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tenant-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

-- marketing-assets (incl. SELECT scoping to prevent enumeration)
DROP POLICY IF EXISTS "Users can upload to their tenant folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their tenant's marketing assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their tenant's marketing assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view marketing assets" ON storage.objects;

CREATE POLICY "marketing-assets_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'marketing-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "marketing-assets_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'marketing-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)))
WITH CHECK (bucket_id = 'marketing-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "marketing-assets_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'marketing-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));

CREATE POLICY "marketing-assets_select_own_tenant" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'marketing-assets' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid)));
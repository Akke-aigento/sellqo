-- media_assets: platform admins moeten ook toegang hebben (additief: nieuwe v2-policies)
CREATE POLICY "media_assets_select_v2" ON public.media_assets
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "media_assets_insert_v2" ON public.media_assets
FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "media_assets_update_v2" ON public.media_assets
FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
WITH CHECK (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "media_assets_delete_v2" ON public.media_assets
FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- oude policies (zonder platform-admin uitzondering, rol public) vervangen
DROP POLICY IF EXISTS "Users can view their tenant's media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Users can insert media assets for their tenant" ON public.media_assets;
DROP POLICY IF EXISTS "Users can update their tenant's media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Users can delete their tenant's media assets" ON public.media_assets;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
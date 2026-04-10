-- Fix user_roles SELECT: use SECURITY DEFINER function instead of self-reference
DROP POLICY IF EXISTS "Tenant members can view roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant members can view roles in their tenant"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  OR is_platform_admin(auth.uid())
);

-- Fix profiles SELECT: same approach
DROP POLICY IF EXISTS "Team members can view profiles of same tenant" ON public.profiles;
CREATE POLICY "Team members can view profiles of same tenant"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  OR is_platform_admin(auth.uid())
);

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Tenant admins can update roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant admins can update roles in their tenant"
ON public.user_roles FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_role(auth.uid(), 'tenant_admin'))
);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Tenant admins can delete roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant admins can delete roles in their tenant"
ON public.user_roles FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_role(auth.uid(), 'tenant_admin'))
);
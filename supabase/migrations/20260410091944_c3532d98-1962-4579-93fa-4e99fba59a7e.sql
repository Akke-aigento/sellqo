
-- 1. Profiles: replace SELECT policy to allow same-tenant visibility
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Team members can view profiles of same tenant" ON public.profiles;

CREATE POLICY "Team members can view profiles of same tenant"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.tenant_id IN (
      SELECT ur2.tenant_id FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid()
    )
  )
  OR is_platform_admin(auth.uid())
);

-- 2. User_roles: replace SELECT policies with combined policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant members can view roles in their tenant" ON public.user_roles;

CREATE POLICY "Tenant members can view roles in their tenant"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  OR is_platform_admin(auth.uid())
);

-- 3. User_roles: allow tenant_admins to UPDATE roles in their tenant
DROP POLICY IF EXISTS "Platform admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can update roles in their tenant" ON public.user_roles;

CREATE POLICY "Tenant admins can update roles in their tenant"
ON public.user_roles FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
  )
);

-- 4. User_roles: allow tenant_admins to DELETE roles in their tenant
DROP POLICY IF EXISTS "Platform admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can delete roles in their tenant" ON public.user_roles;

CREATE POLICY "Tenant admins can delete roles in their tenant"
ON public.user_roles FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
  )
);

-- Create a security definer function to check if user can create first tenant
CREATE OR REPLACE FUNCTION public.can_create_first_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Email moet overeenkomen met de ingelogde gebruiker
    _owner_email = (SELECT auth.jwt() ->> 'email')
    AND
    -- Gebruiker mag nog geen tenant_admin rol hebben (= eerste tenant)
    NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
      AND role = 'tenant_admin'::app_role
    )
$$;

-- Drop the old policy that causes the permission denied error
DROP POLICY IF EXISTS "Authenticated users can insert their own tenant" ON public.tenants;

-- Create new policy using the security definer function
CREATE POLICY "Authenticated users can insert their own tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_create_first_tenant(auth.uid(), owner_email)
  OR public.is_platform_admin(auth.uid())
);
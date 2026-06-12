CREATE OR REPLACE FUNCTION public.can_create_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (
      lower(trim(coalesce(_owner_email, ''))) =
        lower(trim(coalesce((SELECT email FROM public.profiles WHERE id = _user_id), '')))
      OR
      lower(trim(coalesce(_owner_email, ''))) =
        lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      OR
      (_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id))
    )
    AND
    (
      SELECT count(DISTINCT tenant_id)
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'tenant_admin'::app_role
        AND tenant_id IS NOT NULL
    ) < 10;
$$;

DROP POLICY IF EXISTS "Authenticated users can insert their own tenant" ON public.tenants;
CREATE POLICY "Authenticated users can insert their own tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_create_tenant(auth.uid(), owner_email)
  OR public.is_platform_admin(auth.uid())
);
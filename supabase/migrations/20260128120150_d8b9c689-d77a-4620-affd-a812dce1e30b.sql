-- Update get_user_tenant_ids to give platform admins access to ALL tenants
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Platform admins get access to ALL tenants
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = 'platform_admin'
  ) THEN
    RETURN QUERY SELECT id FROM public.tenants;
  ELSE
    -- Normal users: only their assigned tenants
    RETURN QUERY 
    SELECT tenant_id
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id IS NOT NULL;
  END IF;
END;
$$;
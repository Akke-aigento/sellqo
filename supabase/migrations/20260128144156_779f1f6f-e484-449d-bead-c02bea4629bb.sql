-- 1) Update can_create_first_tenant() to be more robust (case-insensitive, profiles fallback)
CREATE OR REPLACE FUNCTION public.can_create_first_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Email moet overeenkomen met de ingelogde gebruiker (case-insensitive, met profiles fallback)
    lower(trim(_owner_email)) = lower(trim(coalesce(
      (SELECT email FROM public.profiles WHERE id = _user_id),
      (SELECT auth.jwt() ->> 'email')
    )))
    AND
    -- Gebruiker mag nog geen tenant_admin rol hebben (= eerste tenant)
    NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
      AND role = 'tenant_admin'::app_role
    )
$$;

-- 2) Create trigger function to automatically assign tenant_admin role
CREATE OR REPLACE FUNCTION public.assign_tenant_admin_role_on_tenant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_user_id uuid;
BEGIN
  _current_user_id := auth.uid();
  
  -- Skip if no authenticated user
  IF _current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip if platform admin (they create tenants for others)
  IF public.is_platform_admin(_current_user_id) THEN
    RETURN NEW;
  END IF;
  
  -- Auto-assign tenant_admin role for users creating their first tenant
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (_current_user_id, NEW.id, 'tenant_admin'::app_role)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 3) Create trigger on tenants table
DROP TRIGGER IF EXISTS trigger_assign_tenant_admin_on_insert ON public.tenants;
CREATE TRIGGER trigger_assign_tenant_admin_on_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_tenant_admin_role_on_tenant_insert();
-- Stap 1: Update can_create_first_tenant met robuustere email check
CREATE OR REPLACE FUNCTION public.can_create_first_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (
      -- Check 1: Profile email match (most reliable)
      lower(trim(coalesce(_owner_email, ''))) = 
        lower(trim(coalesce((SELECT email FROM public.profiles WHERE id = _user_id), '')))
      OR
      -- Check 2: JWT email match (backup)
      lower(trim(coalesce(_owner_email, ''))) = 
        lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      OR
      -- Check 3: If user has verified profile, allow if _user_id matches auth.uid()
      (_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id))
    )
    AND
    NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'tenant_admin'::app_role
        AND tenant_id IS NOT NULL
    );
$$;
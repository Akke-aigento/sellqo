-- 1) Create a safe self-service repair function for the currently authenticated user
CREATE OR REPLACE FUNCTION public.repair_orphaned_user_roles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_fixed integer := 0;
  v_deleted integer := 0;
  v_login_email text;
  v_tenant_id uuid;
  v_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prefer JWT email (source of truth), fall back to profiles.email
  v_login_email := lower(trim(coalesce(
    (auth.jwt() ->> 'email'),
    (SELECT email FROM public.profiles WHERE id = v_user_id)
  )));

  -- If still unknown, nothing to do
  IF v_login_email IS NULL OR v_login_email = '' THEN
    RETURN jsonb_build_object('fixed', 0, 'deleted', 0, 'reason', 'missing_email');
  END IF;

  -- Find a tenant that matches the login email (owner_email)
  SELECT t.id
    INTO v_tenant_id
  FROM public.tenants t
  WHERE lower(trim(t.owner_email)) = v_login_email
  ORDER BY t.created_at DESC
  LIMIT 1;

  -- If there is an orphan tenant_admin role, try to attach it to the matching tenant
  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.user_roles
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user_id
      AND role = 'tenant_admin'::app_role
      AND tenant_id IS NULL;

    GET DIAGNOSTICS v_fixed = ROW_COUNT;
  END IF;

  -- Delete any non-platform roles without tenant_id (invalid state)
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND role <> 'platform_admin'::app_role
    AND tenant_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  -- Delete roles that reference a tenant that no longer exists
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  RETURN jsonb_build_object('fixed', v_fixed, 'deleted', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_orphaned_user_roles() TO authenticated;


-- 2) Harden tenant creation eligibility to avoid getting stuck due to stale profiles.email
--    Accept match against BOTH JWT email and profiles.email.
CREATE OR REPLACE FUNCTION public.can_create_first_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (
      lower(trim(coalesce(_owner_email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      OR
      lower(trim(coalesce(_owner_email, ''))) = lower(trim(coalesce((SELECT email FROM public.profiles WHERE id = _user_id), '')))
    )
    AND
    -- Only block if the user already has a REAL tenant_admin assignment
    NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'tenant_admin'::app_role
        AND tenant_id IS NOT NULL
    );
$$;


-- 3) Prevent creating new orphan role rows going forward
--    (Current dataset has 0 orphans; we clean any just in case.)
DELETE FROM public.user_roles
WHERE role <> 'platform_admin'::app_role
  AND tenant_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_tenant_id_required'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_tenant_id_required
      CHECK (role = 'platform_admin'::app_role OR tenant_id IS NOT NULL);
  END IF;
END;
$$;
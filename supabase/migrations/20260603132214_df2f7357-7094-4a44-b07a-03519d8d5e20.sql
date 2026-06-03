CREATE OR REPLACE FUNCTION public.test_has_tenant_role(
  _user_a uuid,
  _user_b uuid,
  _user_admin uuid
)
RETURNS TABLE(scenario text, expected boolean, actual boolean, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant_x uuid := gen_random_uuid();
  v_tenant_y uuid := gen_random_uuid();
  v_res boolean;
  v_no_role_user uuid;
BEGIN
  -- Pick a 4th real auth.users id distinct from the 3 input users, for "user zonder rol".
  SELECT u.id INTO v_no_role_user
  FROM auth.users u
  WHERE u.id NOT IN (_user_a, _user_b, _user_admin)
  LIMIT 1;

  IF v_no_role_user IS NULL THEN
    RAISE EXCEPTION 'Need at least 4 auth.users rows for this test';
  END IF;

  -- Make sure no leftover roles on these test users for these tenants.
  DELETE FROM public.user_roles
  WHERE user_id IN (_user_a, _user_b, _user_admin, v_no_role_user)
    AND (tenant_id IN (v_tenant_x, v_tenant_y) OR tenant_id IS NULL);

  -- Seed roles.
  INSERT INTO public.user_roles(user_id, tenant_id, role) VALUES
    (_user_a, v_tenant_x, 'staff'::public.app_role),
    (_user_b, v_tenant_x, 'viewer'::public.app_role),
    (_user_admin, NULL, 'platform_admin'::public.app_role);

  -- (a) user zonder rol → false
  PERFORM set_config('request.jwt.claim.sub', v_no_role_user::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff']::public.app_role[]);
  scenario := 'a) user zonder rol'; expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (b) user met juiste rol → true
  PERFORM set_config('request.jwt.claim.sub', _user_a::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'b) user met juiste rol'; expected := true; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (c) user met andere rol → false
  PERFORM set_config('request.jwt.claim.sub', _user_b::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'c) user met andere rol'; expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (d) platform_admin bypass → true
  PERFORM set_config('request.jwt.claim.sub', _user_admin::text, true);
  v_res := public.has_tenant_role(v_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'd) platform_admin bypass'; expected := true; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (e) verkeerd tenant_id → false
  PERFORM set_config('request.jwt.claim.sub', _user_a::text, true);
  v_res := public.has_tenant_role(v_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'e) verkeerd tenant_id'; expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- Cleanup.
  DELETE FROM public.user_roles
  WHERE user_id IN (_user_a, _user_b, _user_admin)
    AND (tenant_id IN (v_tenant_x, v_tenant_y) OR tenant_id IS NULL)
    AND role IN ('staff','viewer','platform_admin');
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$function$;

-- Drop the old parameterless version that crashes on FK violation.
DROP FUNCTION IF EXISTS public.test_has_tenant_role();

REVOKE ALL ON FUNCTION public.test_has_tenant_role(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_has_tenant_role(uuid, uuid, uuid) TO service_role;
-- Drop any lingering signatures.
DROP FUNCTION IF EXISTS public.test_has_tenant_role();
DROP FUNCTION IF EXISTS public.test_has_tenant_role(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.test_has_tenant_role(uuid, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.test_has_tenant_role(
  _user_a uuid,
  _user_b uuid,
  _user_admin uuid,
  _tenant_x uuid,
  _tenant_y uuid
)
RETURNS TABLE(scenario text, expected boolean, actual boolean, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_res boolean;
  v_no_role_user uuid;
BEGIN
  SELECT u.id INTO v_no_role_user
  FROM auth.users u
  WHERE u.id NOT IN (_user_a, _user_b, _user_admin)
  LIMIT 1;

  IF v_no_role_user IS NULL THEN
    RAISE EXCEPTION 'Need at least 4 auth.users rows for this test';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id IN (_user_a, _user_b, _user_admin, v_no_role_user)
    AND (tenant_id IN (_tenant_x, _tenant_y) OR (tenant_id IS NULL AND role = 'platform_admin'::public.app_role));

  INSERT INTO public.user_roles(user_id, tenant_id, role) VALUES
    (_user_a,     _tenant_x, 'staff'::public.app_role),
    (_user_b,     _tenant_x, 'viewer'::public.app_role),
    (_user_admin, NULL,      'platform_admin'::public.app_role);

  PERFORM set_config('request.jwt.claim.sub', v_no_role_user::text, true);
  v_res := public.has_tenant_role(_tenant_x, ARRAY['staff']::public.app_role[]);
  scenario := 'a) user zonder rol'; expected := false; actual := v_res; passed := (actual = expected); RETURN NEXT;

  PERFORM set_config('request.jwt.claim.sub', _user_a::text, true);
  v_res := public.has_tenant_role(_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'b) user met juiste rol'; expected := true; actual := v_res; passed := (actual = expected); RETURN NEXT;

  PERFORM set_config('request.jwt.claim.sub', _user_b::text, true);
  v_res := public.has_tenant_role(_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'c) user met andere rol'; expected := false; actual := v_res; passed := (actual = expected); RETURN NEXT;

  PERFORM set_config('request.jwt.claim.sub', _user_admin::text, true);
  v_res := public.has_tenant_role(_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'd) platform_admin bypass'; expected := true; actual := v_res; passed := (actual = expected); RETURN NEXT;

  PERFORM set_config('request.jwt.claim.sub', _user_a::text, true);
  v_res := public.has_tenant_role(_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'e) verkeerd tenant_id'; expected := false; actual := v_res; passed := (actual = expected); RETURN NEXT;

  DELETE FROM public.user_roles
  WHERE user_id IN (_user_a, _user_b, _user_admin)
    AND (tenant_id IN (_tenant_x, _tenant_y) OR (tenant_id IS NULL AND role = 'platform_admin'::public.app_role));
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.test_has_tenant_role(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_has_tenant_role(uuid, uuid, uuid, uuid, uuid) TO service_role, authenticated, postgres;

CREATE TABLE IF NOT EXISTS public._test_has_tenant_role_results(
  run_at timestamptz NOT NULL DEFAULT now(),
  scenario text,
  expected boolean,
  actual boolean,
  passed boolean
);
GRANT SELECT ON public._test_has_tenant_role_results TO authenticated, service_role;

TRUNCATE public._test_has_tenant_role_results;
INSERT INTO public._test_has_tenant_role_results(scenario, expected, actual, passed)
SELECT scenario, expected, actual, passed
FROM public.test_has_tenant_role(
  'b999f17d-0f67-4809-8112-6d012f27b49e'::uuid,
  'be6f2a43-0002-47d1-b066-061c5181c70a'::uuid,
  'f4f9bb09-3a87-4150-8176-ae9483453d98'::uuid,
  'c11441ef-52d8-406a-b0df-800d09b027b2'::uuid,
  '2606c5b9-caf8-4a42-94cd-80e3f3f31988'::uuid
);
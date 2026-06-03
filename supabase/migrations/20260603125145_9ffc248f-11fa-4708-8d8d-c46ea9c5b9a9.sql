-- Fase 2 Foundation: has_tenant_role helper + smoke-test function

CREATE OR REPLACE FUNCTION public.has_tenant_role(
  _tenant_id uuid,
  _allowed_roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (ur.tenant_id = _tenant_id OR ur.role = 'platform_admin'::public.app_role)
      AND ur.role = ANY(_allowed_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_tenant_role(uuid, public.app_role[]) IS
  'Fase 2 Foundation: tenant-scoped role check with platform_admin bypass. Uses auth.uid().';

-- Smoke-test helper: runs the 5 Fase 2 Foundation scenarios in-process and
-- returns one row per scenario with expected vs actual. Intended for
-- one-off verification by a platform_admin from the SQL editor.
-- Safe to ship: does not mutate persistent data (uses txn-scoped temp role rows).
CREATE OR REPLACE FUNCTION public.test_has_tenant_role()
RETURNS TABLE(scenario text, expected boolean, actual boolean, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_admin uuid := gen_random_uuid();
  v_tenant_x uuid := gen_random_uuid();
  v_tenant_y uuid := gen_random_uuid();
  v_res boolean;
BEGIN
  -- Seed roles for the duration of this function call.
  -- We delete at the end (also inside the same function) — no commit needed.
  INSERT INTO public.user_roles(user_id, tenant_id, role) VALUES
    (v_user_a, v_tenant_x, 'staff'::public.app_role),
    (v_user_b, v_tenant_x, 'viewer'::public.app_role),
    (v_user_admin, NULL, 'platform_admin'::public.app_role);

  -- (a) user zonder rol → false
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff']::public.app_role[]);
  scenario := 'a) user zonder rol';
  expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (b) user met juiste rol → true
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'b) user met juiste rol';
  expected := true; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (c) user met andere rol → false
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  v_res := public.has_tenant_role(v_tenant_x, ARRAY['staff','tenant_admin']::public.app_role[]);
  scenario := 'c) user met andere rol';
  expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (d) platform_admin ongeacht _allowed_roles → true
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);
  v_res := public.has_tenant_role(v_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'd) platform_admin bypass';
  expected := true; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- (e) ongeldig tenant_id voor user → false
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_res := public.has_tenant_role(v_tenant_y, ARRAY['staff']::public.app_role[]);
  scenario := 'e) verkeerd tenant_id';
  expected := false; actual := v_res; passed := (actual = expected);
  RETURN NEXT;

  -- Cleanup seeded roles.
  DELETE FROM public.user_roles WHERE user_id IN (v_user_a, v_user_b, v_user_admin);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.test_has_tenant_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_has_tenant_role() TO service_role;
COMMENT ON FUNCTION public.test_has_tenant_role() IS
  'Fase 2 Foundation smoke-test: runs 5 scenarios for has_tenant_role.';

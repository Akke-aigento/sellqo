CREATE TABLE IF NOT EXISTS public.user_permission_grants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  resource    text NOT NULL,
  granted_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, resource)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_grants TO authenticated;
GRANT ALL ON public.user_permission_grants TO service_role;

ALTER TABLE public.user_permission_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grants, admins all tenant grants"
ON public.user_permission_grants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
  OR is_platform_admin(auth.uid())
);

CREATE POLICY "Tenant admins can insert grants"
ON public.user_permission_grants FOR INSERT TO authenticated
WITH CHECK (
  granted_by = auth.uid()
  AND (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  )
);

CREATE POLICY "Tenant admins can update grants"
ON public.user_permission_grants FOR UPDATE TO authenticated
USING (
  has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
  OR is_platform_admin(auth.uid())
)
WITH CHECK (
  has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
  OR is_platform_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete grants"
ON public.user_permission_grants FOR DELETE TO authenticated
USING (
  has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
  OR is_platform_admin(auth.uid())
);

CREATE OR REPLACE FUNCTION public.has_permission_grant(_user_id uuid, _tenant_id uuid, _resource text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permission_grants g
    WHERE g.user_id = _user_id AND g.tenant_id = _tenant_id AND g.resource = _resource
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission_grant(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission_grant(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission_grant(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Marketing roles can insert discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can insert discount codes"
ON public.discount_codes FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  AND (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    OR (
      has_tenant_role(tenant_id, ARRAY['marketing'::app_role])
      AND has_permission_grant(auth.uid(), tenant_id, 'discount_codes')
    )
  )
);

DROP POLICY IF EXISTS "Marketing roles can update discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can update discount codes"
ON public.discount_codes FOR UPDATE TO authenticated
USING (
  (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  AND (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    OR (
      has_tenant_role(tenant_id, ARRAY['marketing'::app_role])
      AND has_permission_grant(auth.uid(), tenant_id, 'discount_codes')
    )
  )
)
WITH CHECK (
  (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  AND (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    OR (
      has_tenant_role(tenant_id, ARRAY['marketing'::app_role])
      AND has_permission_grant(auth.uid(), tenant_id, 'discount_codes')
    )
  )
);

DROP POLICY IF EXISTS "Marketing roles can delete discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can delete discount codes"
ON public.discount_codes FOR DELETE TO authenticated
USING (
  (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  AND (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
    OR (
      has_tenant_role(tenant_id, ARRAY['marketing'::app_role])
      AND has_permission_grant(auth.uid(), tenant_id, 'discount_codes')
    )
  )
);
CREATE TABLE IF NOT EXISTS public.tenant_access_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_access_revocations_tenant_email_uniq
  ON public.tenant_access_revocations (tenant_id, lower(email));
GRANT SELECT ON public.tenant_access_revocations TO authenticated;
GRANT ALL    ON public.tenant_access_revocations TO service_role;
ALTER TABLE public.tenant_access_revocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins view revocations"
  ON public.tenant_access_revocations FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = tenant_access_revocations.tenant_id
    )
  );
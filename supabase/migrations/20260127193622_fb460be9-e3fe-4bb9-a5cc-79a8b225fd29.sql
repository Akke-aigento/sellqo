-- Authenticated users can create their own tenant (for onboarding)
-- This allows new users to create their first tenant without being platform_admin
CREATE POLICY "Authenticated users can insert their own tenant"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User email matches owner_email
    owner_email = auth.jwt()->>'email'
    -- AND user doesn't already have a tenant (prevents abuse)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'tenant_admin'
    )
  );
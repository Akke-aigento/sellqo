CREATE POLICY pc_insert_members ON public.payment_confirmations
FOR INSERT TO authenticated
WITH CHECK (
  is_platform_admin(auth.uid())
  OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role])
);
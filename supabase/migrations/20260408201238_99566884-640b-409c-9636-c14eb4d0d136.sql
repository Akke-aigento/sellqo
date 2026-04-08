
DROP POLICY IF EXISTS "Tenant users can view their ad connections" ON ad_platform_connections;
DROP POLICY IF EXISTS "Tenant admins can manage ad connections" ON ad_platform_connections;

CREATE POLICY "Tenant users can view their ad connections"
  ON ad_platform_connections FOR SELECT
  USING (
    is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "Tenant admins can manage ad connections"
  ON ad_platform_connections FOR ALL
  USING (
    is_platform_admin(auth.uid())
    OR tenant_id IN (
      SELECT user_roles.tenant_id FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'tenant_admin'
    )
  );

-- ============================================================
-- Batch 2B1a — Integrations RLS tightening
-- See docs/fase2-batch-2b1-recon.md §6
-- ============================================================

-- Helper signature reminder:
--   public.has_tenant_role(_tenant_id uuid, _roles app_role[]) returns boolean
--   public.get_user_tenant_ids(_user_id uuid) returns setof uuid
--   public.is_platform_admin(_user_id uuid) returns boolean

-- ============================================================
-- 1. marketplace_connections
-- ============================================================
DROP POLICY IF EXISTS "Users can view their tenant's marketplace connections" ON public.marketplace_connections;
DROP POLICY IF EXISTS "Users can insert marketplace connections for their tenant" ON public.marketplace_connections;
DROP POLICY IF EXISTS "Users can update their tenant's marketplace connections" ON public.marketplace_connections;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's marketplace connections" ON public.marketplace_connections;

CREATE POLICY "mc_select_tenant_members" ON public.marketplace_connections
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "mc_insert_tenant_admin" ON public.marketplace_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "mc_update_tenant_admin" ON public.marketplace_connections
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "mc_delete_tenant_admin" ON public.marketplace_connections
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 2. shopify_connection_requests
-- ============================================================
DROP POLICY IF EXISTS "Tenants can view their own requests" ON public.shopify_connection_requests;
DROP POLICY IF EXISTS "Tenants can insert their own requests" ON public.shopify_connection_requests;
-- Keep: "Platform admins can manage all requests" (already platform_admin-scoped)

CREATE POLICY "scr_select_tenant_members" ON public.shopify_connection_requests
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "scr_insert_tenant_admin" ON public.shopify_connection_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "scr_update_tenant_admin" ON public.shopify_connection_requests
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "scr_delete_tenant_admin" ON public.shopify_connection_requests
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 3. ad_platform_connections
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can view their ad connections" ON public.ad_platform_connections;
DROP POLICY IF EXISTS "Tenant admins can manage ad connections" ON public.ad_platform_connections;

CREATE POLICY "apc_select_tenant_members" ON public.ad_platform_connections
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "apc_insert_tenant_admin" ON public.ad_platform_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "apc_update_tenant_admin" ON public.ad_platform_connections
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "apc_delete_tenant_admin" ON public.ad_platform_connections
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 4. tenant_oauth_credentials (stricter: SELECT also admin-only)
-- ============================================================
DROP POLICY IF EXISTS "Tenant members can view own credentials" ON public.tenant_oauth_credentials;
DROP POLICY IF EXISTS "Tenant admins can manage credentials" ON public.tenant_oauth_credentials;

CREATE POLICY "toc_select_tenant_admin" ON public.tenant_oauth_credentials
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "toc_insert_tenant_admin" ON public.tenant_oauth_credentials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "toc_update_tenant_admin" ON public.tenant_oauth_credentials
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "toc_delete_tenant_admin" ON public.tenant_oauth_credentials
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 5. tenant_domains (keep anon SELECT for storefront routing)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tenant domains" ON public.tenant_domains;
DROP POLICY IF EXISTS "Tenant admins can insert domains" ON public.tenant_domains;
DROP POLICY IF EXISTS "Tenant admins can update domains" ON public.tenant_domains;
DROP POLICY IF EXISTS "Tenant admins can delete domains" ON public.tenant_domains;
-- Keep: "Public can read active domains" (anon, is_active=true AND dns_verified=true)

CREATE POLICY "td_select_tenant_members" ON public.tenant_domains
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "td_insert_tenant_admin" ON public.tenant_domains
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "td_update_tenant_admin" ON public.tenant_domains
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "td_delete_tenant_admin" ON public.tenant_domains
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 6. review_platform_connections (dormant — close anon SELECT leak)
-- ============================================================
DROP POLICY IF EXISTS "Public can view enabled platform connections" ON public.review_platform_connections;
DROP POLICY IF EXISTS "Users can view their tenant's review connections" ON public.review_platform_connections;
DROP POLICY IF EXISTS "Users can insert their tenant's review connections" ON public.review_platform_connections;
DROP POLICY IF EXISTS "Users can update their tenant's review connections" ON public.review_platform_connections;
DROP POLICY IF EXISTS "Users can delete their tenant's review connections" ON public.review_platform_connections;

CREATE POLICY "rpc_select_tenant_members" ON public.review_platform_connections
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "rpc_insert_tenant_admin" ON public.review_platform_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "rpc_update_tenant_admin" ON public.review_platform_connections
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "rpc_delete_tenant_admin" ON public.review_platform_connections
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 7. shipping_integrations (dormant — replace blind ALL-policy)
-- ============================================================
DROP POLICY IF EXISTS "Tenant admins can manage shipping integrations" ON public.shipping_integrations;
DROP POLICY IF EXISTS "Users can view their tenant shipping integrations" ON public.shipping_integrations;

CREATE POLICY "si_select_tenant_members" ON public.shipping_integrations
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "si_insert_tenant_admin" ON public.shipping_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "si_update_tenant_admin" ON public.shipping_integrations
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "si_delete_tenant_admin" ON public.shipping_integrations
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ============================================================
-- 8. fulfillment_api_keys (already rol-aware; normalize for consistency)
-- ============================================================
DROP POLICY IF EXISTS "Tenant admins can manage their API keys" ON public.fulfillment_api_keys;

CREATE POLICY "fak_select_tenant_admin" ON public.fulfillment_api_keys
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "fak_insert_tenant_admin" ON public.fulfillment_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "fak_update_tenant_admin" ON public.fulfillment_api_keys
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY "fak_delete_tenant_admin" ON public.fulfillment_api_keys
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

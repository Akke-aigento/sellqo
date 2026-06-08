
-- =============================================================
-- Batch 2B2a — Customers RLS hardening + cross-tenant staff cap
-- =============================================================

-- ---------- CUSTOMERS ----------
DROP POLICY IF EXISTS "Users can insert customers for their tenant" ON public.customers;
DROP POLICY IF EXISTS "Users can update their tenant's customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's customers" ON public.customers;

CREATE POLICY "Users can insert customers for their tenant"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Users can update their tenant's customers"
ON public.customers FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Tenant admins can delete their tenant's customers"
ON public.customers FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ---------- CUSTOMER_COMMUNICATION_SETTINGS ----------
DROP POLICY IF EXISTS "Tenant members can view their communication settings" ON public.customer_communication_settings;
DROP POLICY IF EXISTS "Tenant members can insert their communication settings" ON public.customer_communication_settings;
DROP POLICY IF EXISTS "Tenant members can update their communication settings" ON public.customer_communication_settings;
DROP POLICY IF EXISTS "Tenant members can delete their communication settings" ON public.customer_communication_settings;

CREATE POLICY "Tenant members can view their communication settings"
ON public.customer_communication_settings FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert their communication settings"
ON public.customer_communication_settings FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Tenant members can update their communication settings"
ON public.customer_communication_settings FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Tenant members can delete their communication settings"
ON public.customer_communication_settings FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- ---------- CUSTOMER_EVENTS (SELECT only — writes via service-role) ----------
DROP POLICY IF EXISTS "Tenants can view own events" ON public.customer_events;
CREATE POLICY "Tenants can view own events"
ON public.customer_events FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ---------- CUSTOMER_GROUPS ----------
DROP POLICY IF EXISTS "Users can view customer groups for their tenant" ON public.customer_groups;
DROP POLICY IF EXISTS "Users can insert customer groups for their tenant" ON public.customer_groups;
DROP POLICY IF EXISTS "Users can update customer groups for their tenant" ON public.customer_groups;
DROP POLICY IF EXISTS "Users can delete customer groups for their tenant" ON public.customer_groups;

CREATE POLICY "Users can view customer groups for their tenant"
ON public.customer_groups FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert customer groups for their tenant"
ON public.customer_groups FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can update customer groups for their tenant"
ON public.customer_groups FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can delete customer groups for their tenant"
ON public.customer_groups FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- ---------- CUSTOMER_GROUP_MEMBERS (FK-scope via parent) ----------
DROP POLICY IF EXISTS "Users can view customer group members" ON public.customer_group_members;
DROP POLICY IF EXISTS "Users can insert customer group members" ON public.customer_group_members;
DROP POLICY IF EXISTS "Users can update customer group members" ON public.customer_group_members;
DROP POLICY IF EXISTS "Users can delete customer group members" ON public.customer_group_members;

CREATE POLICY "Users can view customer group members"
ON public.customer_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_members.customer_group_id
      AND g.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can insert customer group members"
ON public.customer_group_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_members.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Users can update customer group members"
ON public.customer_group_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_members.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_members.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Users can delete customer group members"
ON public.customer_group_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_members.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- ---------- CUSTOMER_GROUP_PRODUCT_PRICES ----------
DROP POLICY IF EXISTS "Users can view customer group product prices" ON public.customer_group_product_prices;
DROP POLICY IF EXISTS "Users can insert customer group product prices" ON public.customer_group_product_prices;
DROP POLICY IF EXISTS "Users can update customer group product prices" ON public.customer_group_product_prices;
DROP POLICY IF EXISTS "Users can delete customer group product prices" ON public.customer_group_product_prices;

CREATE POLICY "Users can view customer group product prices"
ON public.customer_group_product_prices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_product_prices.customer_group_id
      AND g.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can insert customer group product prices"
ON public.customer_group_product_prices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_product_prices.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Users can update customer group product prices"
ON public.customer_group_product_prices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_product_prices.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_product_prices.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Users can delete customer group product prices"
ON public.customer_group_product_prices FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_groups g
    WHERE g.id = customer_group_product_prices.customer_group_id
      AND public.has_tenant_role(g.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- ---------- CUSTOMER_LOYALTY (FK-scope via loyalty_programs) ----------
DROP POLICY IF EXISTS "Users can view customer loyalty" ON public.customer_loyalty;
DROP POLICY IF EXISTS "Users can insert customer loyalty" ON public.customer_loyalty;
DROP POLICY IF EXISTS "Users can update customer loyalty" ON public.customer_loyalty;
DROP POLICY IF EXISTS "Users can delete customer loyalty" ON public.customer_loyalty;

CREATE POLICY "Users can view customer loyalty"
ON public.customer_loyalty FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = customer_loyalty.loyalty_program_id
      AND lp.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can insert customer loyalty"
ON public.customer_loyalty FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = customer_loyalty.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Users can update customer loyalty"
ON public.customer_loyalty FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = customer_loyalty.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = customer_loyalty.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Users can delete customer loyalty"
ON public.customer_loyalty FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = customer_loyalty.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- ---------- CUSTOMER_MESSAGES (inbox — role-gated) ----------
DROP POLICY IF EXISTS "Users can view messages for their tenant" ON public.customer_messages;
DROP POLICY IF EXISTS "Users can create messages for their tenant" ON public.customer_messages;
DROP POLICY IF EXISTS "Users can update messages for their tenant" ON public.customer_messages;
DROP POLICY IF EXISTS "Users can delete messages for their tenant" ON public.customer_messages;

CREATE POLICY "Users can view messages for their tenant"
ON public.customer_messages FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing','viewer']::app_role[])
);

CREATE POLICY "Users can create messages for their tenant"
ON public.customer_messages FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can update messages for their tenant"
ON public.customer_messages FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can delete messages for their tenant"
ON public.customer_messages FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- ---------- CUSTOMER_MESSAGE_ATTACHMENTS ----------
DROP POLICY IF EXISTS "Tenant members can view attachments" ON public.customer_message_attachments;
CREATE POLICY "Tenant members can view attachments"
ON public.customer_message_attachments FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing','viewer']::app_role[])
);

-- ---------- CUSTOMER_SEGMENTS ----------
DROP POLICY IF EXISTS "Users can view segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can insert segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can update segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can delete segments for their tenants" ON public.customer_segments;

CREATE POLICY "Users can view segments for their tenants"
ON public.customer_segments FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert segments for their tenants"
ON public.customer_segments FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can update segments for their tenants"
ON public.customer_segments FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can delete segments for their tenants"
ON public.customer_segments FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- ---------- SEGMENT_MEMBERS (FK-scope via segments) ----------
DROP POLICY IF EXISTS "Users can view segment members for their tenants" ON public.segment_members;
DROP POLICY IF EXISTS "Users can insert segment members for their tenants" ON public.segment_members;
DROP POLICY IF EXISTS "Users can delete segment members for their tenants" ON public.segment_members;

CREATE POLICY "Users can view segment members for their tenants"
ON public.segment_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND s.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can insert segment members for their tenants"
ON public.segment_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND public.has_tenant_role(s.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Users can delete segment members for their tenants"
ON public.segment_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND public.has_tenant_role(s.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- §9-7 Cross-tenant staff hard cap: has_role → has_tenant_role
-- Sweep buiten customer-cluster
-- =============================================================

-- categories
DROP POLICY IF EXISTS "Users can insert categories for their tenant" ON public.categories;
DROP POLICY IF EXISTS "Users can update their tenant's categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their tenant's categories" ON public.categories;

CREATE POLICY "Users can insert categories for their tenant"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Users can update their tenant's categories"
ON public.categories FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Users can delete their tenant's categories"
ON public.categories FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- products
DROP POLICY IF EXISTS "Users can insert products for their tenant" ON public.products;
DROP POLICY IF EXISTS "Users can update their tenant's products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their tenant's products" ON public.products;

CREATE POLICY "Users can insert products for their tenant"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Users can update their tenant's products"
ON public.products FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Users can delete their tenant's products"
ON public.products FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- product_variants
DROP POLICY IF EXISTS "Tenant staff can manage product_variants" ON public.product_variants;
CREATE POLICY "Tenant staff can manage product_variants"
ON public.product_variants FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

-- product_variant_options
DROP POLICY IF EXISTS "Tenant staff can manage variant options" ON public.product_variant_options;
CREATE POLICY "Tenant staff can manage variant options"
ON public.product_variant_options FOR ALL TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
    OR public.is_platform_admin(auth.uid())
  )
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
    OR public.is_platform_admin(auth.uid())
  )
);

-- vat_rates
DROP POLICY IF EXISTS "Tenant admins can insert vat rates for their tenant" ON public.vat_rates;
DROP POLICY IF EXISTS "Tenant admins can update their tenant's vat rates" ON public.vat_rates;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's vat rates" ON public.vat_rates;

CREATE POLICY "Tenant admins can insert vat rates for their tenant"
ON public.vat_rates FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Tenant admins can update their tenant's vat rates"
ON public.vat_rates FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

CREATE POLICY "Tenant admins can delete their tenant's vat rates"
ON public.vat_rates FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- vat_validations
DROP POLICY IF EXISTS "Users can insert vat validations for their tenant" ON public.vat_validations;
CREATE POLICY "Users can insert vat validations for their tenant"
ON public.vat_validations FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

-- tenant_tracking_settings
DROP POLICY IF EXISTS "Admins can manage tracking settings" ON public.tenant_tracking_settings;
CREATE POLICY "Admins can manage tracking settings"
ON public.tenant_tracking_settings FOR ALL TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- tenants
DROP POLICY IF EXISTS "Tenant admins can update their own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can update their own tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (
  id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(id, ARRAY['tenant_admin']::app_role[])
);

-- user_roles
DROP POLICY IF EXISTS "Tenant admins can update roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins can delete roles in their tenant" ON public.user_roles;

CREATE POLICY "Tenant admins can update roles in their tenant"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

CREATE POLICY "Tenant admins can delete roles in their tenant"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);


-- =====================================================================
-- BATCH 2A1 — ORDERS RLS HARDENING
-- =====================================================================

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert orders for their tenant" ON public.orders;
DROP POLICY IF EXISTS "Users can update their tenant's orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's orders" ON public.orders;

CREATE POLICY "Auth users can view tenant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff can insert tenant orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Admin/staff can update tenant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant orders"
  ON public.orders FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- ORDER_ITEMS (FK-scope via orders.tenant_id, geen warehouse-write)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert order items for their tenant" ON public.order_items;
DROP POLICY IF EXISTS "Users can update their tenant's order items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's order items" ON public.order_items;

CREATE POLICY "Auth users can view tenant order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (order_id IN (
    SELECT id FROM public.orders WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Admin/staff can insert tenant order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));

CREATE POLICY "Admin/staff can update tenant order items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));

CREATE POLICY "Tenant admins can delete tenant order items"
  ON public.order_items FOR DELETE TO authenticated
  USING (order_id IN (
    SELECT id FROM public.orders
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

-- ---------------------------------------------------------------------
-- RETURNS
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants can view own returns" ON public.returns;
DROP POLICY IF EXISTS "Tenants can insert own returns" ON public.returns;
DROP POLICY IF EXISTS "Tenants can update own returns" ON public.returns;

CREATE POLICY "Auth users can view tenant returns"
  ON public.returns FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff/warehouse can insert tenant returns"
  ON public.returns FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Admin/staff/warehouse can update tenant returns"
  ON public.returns FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant returns"
  ON public.returns FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- SHIPPING_LABELS — drop alle overlap, vervang door drie-policy
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their tenant shipping labels" ON public.shipping_labels;
DROP POLICY IF EXISTS "Tenant users can insert shipping labels" ON public.shipping_labels;
DROP POLICY IF EXISTS "Tenant users can view their shipping labels" ON public.shipping_labels;
DROP POLICY IF EXISTS "Users can view their tenant shipping labels" ON public.shipping_labels;
DROP POLICY IF EXISTS "Tenant users can update their shipping labels" ON public.shipping_labels;

CREATE POLICY "Auth users can view tenant shipping labels"
  ON public.shipping_labels FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff/warehouse can insert tenant shipping labels"
  ON public.shipping_labels FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Admin/staff/warehouse can update tenant shipping labels"
  ON public.shipping_labels FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant shipping labels"
  ON public.shipping_labels FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- SHIPPING_STATUS_UPDATES — alleen SELECT voor auth, WRITE via service-role
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their tenant shipping status updates" ON public.shipping_status_updates;
DROP POLICY IF EXISTS "Users can view their tenant shipping status updates" ON public.shipping_status_updates;

CREATE POLICY "Auth users can view tenant shipping status updates"
  ON public.shipping_status_updates FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ---------------------------------------------------------------------
-- SHIPPING_METHODS — migreer has_role → has_tenant_role
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert shipping methods for their tenant" ON public.shipping_methods;
DROP POLICY IF EXISTS "Users can update their tenant's shipping methods" ON public.shipping_methods;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's shipping methods" ON public.shipping_methods;

CREATE POLICY "Admin/staff can insert tenant shipping methods"
  ON public.shipping_methods FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Admin/staff can update tenant shipping methods"
  ON public.shipping_methods FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant shipping methods"
  ON public.shipping_methods FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- PACKING_SLIPS
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage packing slips for their tenant" ON public.packing_slips;
DROP POLICY IF EXISTS "Users can view packing slips for their tenant" ON public.packing_slips;

CREATE POLICY "Auth users can view tenant packing slips"
  ON public.packing_slips FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff/warehouse can insert tenant packing slips"
  ON public.packing_slips FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Admin/staff/warehouse can update tenant packing slips"
  ON public.packing_slips FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant packing slips"
  ON public.packing_slips FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- PACKING_SLIP_LINES — FK-scope via packing_slip_id (geen tenant_id-kolom)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage packing slip lines for their tenant" ON public.packing_slip_lines;
DROP POLICY IF EXISTS "Users can view packing slip lines for their tenant" ON public.packing_slip_lines;

CREATE POLICY "Auth users can view tenant packing slip lines"
  ON public.packing_slip_lines FOR SELECT TO authenticated
  USING (packing_slip_id IN (
    SELECT id FROM public.packing_slips WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Admin/staff/warehouse can insert tenant packing slip lines"
  ON public.packing_slip_lines FOR INSERT TO authenticated
  WITH CHECK (packing_slip_id IN (
    SELECT id FROM public.packing_slips
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  ));

CREATE POLICY "Admin/staff/warehouse can update tenant packing slip lines"
  ON public.packing_slip_lines FOR UPDATE TO authenticated
  USING (packing_slip_id IN (
    SELECT id FROM public.packing_slips
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  ));

CREATE POLICY "Tenant admins can delete tenant packing slip lines"
  ON public.packing_slip_lines FOR DELETE TO authenticated
  USING (packing_slip_id IN (
    SELECT id FROM public.packing_slips
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

-- ---------------------------------------------------------------------
-- DIGITAL_DELIVERIES
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view digital deliveries for their tenant" ON public.digital_deliveries;
DROP POLICY IF EXISTS "Users can insert digital deliveries for their tenant" ON public.digital_deliveries;
DROP POLICY IF EXISTS "Users can update digital deliveries for their tenant" ON public.digital_deliveries;
DROP POLICY IF EXISTS "Users can delete digital deliveries for their tenant" ON public.digital_deliveries;

CREATE POLICY "Auth users can view tenant digital deliveries"
  ON public.digital_deliveries FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff can insert tenant digital deliveries"
  ON public.digital_deliveries FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Admin/staff can update tenant digital deliveries"
  ON public.digital_deliveries FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );

CREATE POLICY "Tenant admins can delete tenant digital deliveries"
  ON public.digital_deliveries FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
  );

-- ---------------------------------------------------------------------
-- TRACKING_IMPORT_LOG — alleen SELECT voor auth, WRITE via service-role
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert import logs" ON public.tracking_import_log;
-- SELECT-policy "Users can view their tenant import logs" blijft bestaan, geen wijziging nodig.

-- ---------------------------------------------------------------------
-- INVENTORY_SYNC_LOG — alleen SELECT voor auth, WRITE via service-role
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert inventory sync logs for their tenant" ON public.inventory_sync_log;
-- SELECT-policy "Users can view their tenant's inventory sync logs" blijft bestaan.

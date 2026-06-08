-- Batch 2C1a-ii — Suppliers + purchase orders RLS-aanscherping
-- Scope: suppliers, supplier_documents, product_suppliers,
--        purchase_orders, purchase_order_items
-- Beslispunten bevestigd: marketing+viewer mogen GEEN suppliers/inkoop zien,
--   warehouse mag wel zien én UPDATEN op purchase_orders (ontvangst boeken).

-- ============================================================
-- suppliers
-- ============================================================
DROP POLICY IF EXISTS "Users can view suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers in their tenant" ON public.suppliers;

CREATE POLICY "Finance roles can view suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
);

CREATE POLICY "Finance staff can insert suppliers"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Finance staff can update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Tenant admins can delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ============================================================
-- supplier_documents
-- ============================================================
DROP POLICY IF EXISTS "Users can view supplier_documents in their tenant" ON public.supplier_documents;
DROP POLICY IF EXISTS "Users can create supplier_documents in their tenant" ON public.supplier_documents;
DROP POLICY IF EXISTS "Users can update supplier_documents in their tenant" ON public.supplier_documents;
DROP POLICY IF EXISTS "Users can delete supplier_documents in their tenant" ON public.supplier_documents;

CREATE POLICY "Finance roles can view supplier_documents"
ON public.supplier_documents FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
);

CREATE POLICY "Finance staff can insert supplier_documents"
ON public.supplier_documents FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Finance staff can update supplier_documents"
ON public.supplier_documents FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Tenant admins can delete supplier_documents"
ON public.supplier_documents FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ============================================================
-- product_suppliers (junction met inkoopprijs)
-- ============================================================
DROP POLICY IF EXISTS "Users can view product_suppliers in their tenant" ON public.product_suppliers;
DROP POLICY IF EXISTS "Users can create product_suppliers in their tenant" ON public.product_suppliers;
DROP POLICY IF EXISTS "Users can update product_suppliers in their tenant" ON public.product_suppliers;
DROP POLICY IF EXISTS "Users can delete product_suppliers in their tenant" ON public.product_suppliers;

CREATE POLICY "Finance roles can view product_suppliers"
ON public.product_suppliers FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
);

CREATE POLICY "Finance staff can insert product_suppliers"
ON public.product_suppliers FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Finance staff can update product_suppliers"
ON public.product_suppliers FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Tenant admins can delete product_suppliers"
ON public.product_suppliers FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ============================================================
-- purchase_orders
-- ============================================================
DROP POLICY IF EXISTS "Users can view purchase_orders in their tenant" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create purchase_orders in their tenant" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update purchase_orders in their tenant" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete purchase_orders in their tenant" ON public.purchase_orders;

CREATE POLICY "Finance/warehouse roles can view purchase_orders"
ON public.purchase_orders FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
);

CREATE POLICY "Finance staff can insert purchase_orders"
ON public.purchase_orders FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
);

CREATE POLICY "Finance/warehouse can update purchase_orders"
ON public.purchase_orders FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
);

CREATE POLICY "Tenant admins can delete purchase_orders"
ON public.purchase_orders FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ============================================================
-- purchase_order_items (FK-scope op purchase_orders.tenant_id)
-- ============================================================
DROP POLICY IF EXISTS "Users can view purchase_order_items via order" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can create purchase_order_items via order" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can update purchase_order_items via order" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can delete purchase_order_items via order" ON public.purchase_order_items;

CREATE POLICY "Finance/warehouse can view purchase_order_items"
ON public.purchase_order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_tenant_role(po.tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
  )
);

CREATE POLICY "Finance staff can insert purchase_order_items"
ON public.purchase_order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_tenant_role(po.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  )
);

CREATE POLICY "Finance/warehouse can update purchase_order_items"
ON public.purchase_order_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_tenant_role(po.tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_tenant_role(po.tenant_id, ARRAY['tenant_admin','staff','accountant','warehouse']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete purchase_order_items"
ON public.purchase_order_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_tenant_role(po.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);
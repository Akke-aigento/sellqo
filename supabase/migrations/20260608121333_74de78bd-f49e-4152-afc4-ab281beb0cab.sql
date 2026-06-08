
-- ============================================================
-- Batch 2A2a — Refund / Invoice / Quote RLS hardening
-- ============================================================

-- credit_notes -----------------------------------------------
DROP POLICY IF EXISTS "Users can view credit notes from their tenants" ON public.credit_notes;
DROP POLICY IF EXISTS "Users can insert credit notes in their tenants" ON public.credit_notes;
DROP POLICY IF EXISTS "Users can update credit notes in their tenants" ON public.credit_notes;
DROP POLICY IF EXISTS "Users can delete credit notes in their tenants" ON public.credit_notes;

CREATE POLICY "Tenant users can view credit notes" ON public.credit_notes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins can insert credit notes" ON public.credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "Tenant admins can update credit notes" ON public.credit_notes
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "Tenant admins can delete credit notes" ON public.credit_notes
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- credit_note_lines (parent-FK scope) ------------------------
DROP POLICY IF EXISTS "Users can view credit note lines from their tenants" ON public.credit_note_lines;
DROP POLICY IF EXISTS "Users can insert credit note lines in their tenants" ON public.credit_note_lines;
DROP POLICY IF EXISTS "Users can update credit note lines in their tenants" ON public.credit_note_lines;
DROP POLICY IF EXISTS "Users can delete credit note lines in their tenants" ON public.credit_note_lines;

CREATE POLICY "Tenant users can view credit note lines" ON public.credit_note_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.credit_notes cn
    WHERE cn.id = credit_note_lines.credit_note_id
      AND cn.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Tenant admins can insert credit note lines" ON public.credit_note_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.credit_notes cn
    WHERE cn.id = credit_note_lines.credit_note_id
      AND public.has_tenant_role(cn.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));
CREATE POLICY "Tenant admins can update credit note lines" ON public.credit_note_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.credit_notes cn
    WHERE cn.id = credit_note_lines.credit_note_id
      AND public.has_tenant_role(cn.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));
CREATE POLICY "Tenant admins can delete credit note lines" ON public.credit_note_lines
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.credit_notes cn
    WHERE cn.id = credit_note_lines.credit_note_id
      AND public.has_tenant_role(cn.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

-- invoices ---------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for their tenant" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their tenant's invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's invoices" ON public.invoices;

CREATE POLICY "Tenant users can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Admin staff accountant can insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "Admin staff accountant can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "Admin staff accountant can delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));

-- invoice_lines (parent-FK scope) ----------------------------
DROP POLICY IF EXISTS "Users can view their tenant's invoice lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Users can insert invoice lines for their tenant" ON public.invoice_lines;
DROP POLICY IF EXISTS "Users can update their tenant's invoice lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Users can delete their tenant's invoice lines" ON public.invoice_lines;

CREATE POLICY "Tenant users can view invoice lines" ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND i.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Admin staff accountant can insert invoice lines" ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Admin staff accountant can update invoice lines" ON public.invoice_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Admin staff accountant can delete invoice lines" ON public.invoice_lines
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));

-- invoice_archive (append-only) ------------------------------
DROP POLICY IF EXISTS "Users can view archive for their tenant" ON public.invoice_archive;
DROP POLICY IF EXISTS "Users can insert archive for their tenant" ON public.invoice_archive;

CREATE POLICY "Tenant users can view invoice archive" ON public.invoice_archive
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Admin staff accountant can append invoice archive" ON public.invoice_archive
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
-- intentionally NO UPDATE / DELETE policies (append-only)

-- invoice_discounts (parent-FK scope via invoices) -----------
DROP POLICY IF EXISTS "Users can manage invoice discounts for their tenant" ON public.invoice_discounts;
DROP POLICY IF EXISTS "Users can view invoice discounts for their tenant" ON public.invoice_discounts;

CREATE POLICY "Tenant users can view invoice discounts" ON public.invoice_discounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_discounts.invoice_id
      AND i.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Admin staff accountant can insert invoice discounts" ON public.invoice_discounts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_discounts.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Admin staff accountant can update invoice discounts" ON public.invoice_discounts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_discounts.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Admin staff accountant can delete invoice discounts" ON public.invoice_discounts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_discounts.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));

-- invoice_duplicates -----------------------------------------
DROP POLICY IF EXISTS "Tenant users can manage invoice duplicates" ON public.invoice_duplicates;

CREATE POLICY "Tenant users can view invoice duplicates" ON public.invoice_duplicates
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Admin staff accountant can insert invoice duplicates" ON public.invoice_duplicates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "Admin staff accountant can update invoice duplicates" ON public.invoice_duplicates
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "Admin staff accountant can delete invoice duplicates" ON public.invoice_duplicates
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));

-- proforma_invoices ------------------------------------------
DROP POLICY IF EXISTS "Users can manage proforma invoices for their tenant" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Users can view proforma invoices for their tenant" ON public.proforma_invoices;

CREATE POLICY "Tenant users can view proforma invoices" ON public.proforma_invoices
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Admin staff can insert proforma invoices" ON public.proforma_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "Admin staff can update proforma invoices" ON public.proforma_invoices
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "Tenant admins can delete proforma invoices" ON public.proforma_invoices
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- proforma_invoice_lines (parent-FK scope) -------------------
DROP POLICY IF EXISTS "Users can manage proforma lines for their tenant" ON public.proforma_invoice_lines;
DROP POLICY IF EXISTS "Users can view proforma lines for their tenant" ON public.proforma_invoice_lines;

CREATE POLICY "Tenant users can view proforma lines" ON public.proforma_invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proforma_invoices pi
    WHERE pi.id = proforma_invoice_lines.proforma_id
      AND pi.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Admin staff can insert proforma lines" ON public.proforma_invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proforma_invoices pi
    WHERE pi.id = proforma_invoice_lines.proforma_id
      AND public.has_tenant_role(pi.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));
CREATE POLICY "Admin staff can update proforma lines" ON public.proforma_invoice_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proforma_invoices pi
    WHERE pi.id = proforma_invoice_lines.proforma_id
      AND public.has_tenant_role(pi.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));
CREATE POLICY "Tenant admins can delete proforma lines" ON public.proforma_invoice_lines
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proforma_invoices pi
    WHERE pi.id = proforma_invoice_lines.proforma_id
      AND public.has_tenant_role(pi.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

-- quotes -----------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert quotes for their tenant" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their tenant's quotes" ON public.quotes;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's quotes" ON public.quotes;

CREATE POLICY "Tenant users can view quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Admin staff can insert quotes" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "Admin staff can update quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "Tenant admins can delete quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- quote_items (parent-FK scope) ------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Users can insert quote items for their tenant" ON public.quote_items;
DROP POLICY IF EXISTS "Users can update their tenant's quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's quote items" ON public.quote_items;

CREATE POLICY "Tenant users can view quote items" ON public.quote_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Admin staff can insert quote items" ON public.quote_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND public.has_tenant_role(q.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));
CREATE POLICY "Admin staff can update quote items" ON public.quote_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND public.has_tenant_role(q.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  ));
CREATE POLICY "Tenant admins can delete quote items" ON public.quote_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND public.has_tenant_role(q.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

-- payment_confirmations (service_role write-only) ------------
DROP POLICY IF EXISTS "Users can view own tenant confirmations" ON public.payment_confirmations;
DROP POLICY IF EXISTS "Staff+ can insert confirmations" ON public.payment_confirmations;

CREATE POLICY "Tenant users can view payment confirmations" ON public.payment_confirmations
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
-- INSERT/UPDATE/DELETE: no authenticated policy → service_role-only (webhook pad)

-- payment_reminders (parent-FK scope via invoices) -----------
DROP POLICY IF EXISTS "Users can manage payment reminders for their tenant" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can view payment reminders for their tenant" ON public.payment_reminders;

CREATE POLICY "Tenant users can view payment reminders" ON public.payment_reminders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payment_reminders.invoice_id
      AND i.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));
CREATE POLICY "Admin staff accountant can insert payment reminders" ON public.payment_reminders
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payment_reminders.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Admin staff accountant can update payment reminders" ON public.payment_reminders
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payment_reminders.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])
  ));
CREATE POLICY "Tenant admins can delete payment reminders" ON public.payment_reminders
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payment_reminders.invoice_id
      AND public.has_tenant_role(i.tenant_id, ARRAY['tenant_admin']::app_role[])
  ));

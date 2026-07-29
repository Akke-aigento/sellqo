-- SEC-2a: enforce PERMISSION_MATRIX read rights in RLS.
-- Existing USING expressions kept verbatim; only an AND role-check is added.

-- Groep A — integratie-credentials: ARRAY['tenant_admin','viewer']
DROP POLICY IF EXISTS "mc_select_tenant_members" ON public.marketplace_connections;
CREATE POLICY "mc_select_tenant_members" ON public.marketplace_connections
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "si_select_tenant_members" ON public.shipping_integrations;
CREATE POLICY "si_select_tenant_members" ON public.shipping_integrations
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "rpc_select_tenant_members" ON public.review_platform_connections;
CREATE POLICY "rpc_select_tenant_members" ON public.review_platform_connections
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Tenant users can view newsletter config" ON public.tenant_newsletter_config;
CREATE POLICY "Tenant users can view newsletter config" ON public.tenant_newsletter_config
FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Users can view their tenant whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can view their tenant whatsapp connections" ON public.whatsapp_connections
FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT ur.tenant_id FROM user_roles ur WHERE (ur.user_id = auth.uid())))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "tos_select_tenant_members" ON public.tenant_odoo_settings;
CREATE POLICY "tos_select_tenant_members" ON public.tenant_odoo_settings
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'viewer'::app_role])
);

-- Groep B — financiële documenten: ARRAY['tenant_admin','staff','accountant','viewer']
DROP POLICY IF EXISTS "Tenant users can view invoices" ON public.invoices;
CREATE POLICY "Tenant users can view invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Tenant users can view invoice lines" ON public.invoice_lines;
CREATE POLICY "Tenant users can view invoice lines" ON public.invoice_lines
FOR SELECT TO authenticated
USING (
  EXISTS ( SELECT 1 FROM invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND (i.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
      AND has_tenant_role(i.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role]))
);

DROP POLICY IF EXISTS "Tenant users can view credit notes" ON public.credit_notes;
CREATE POLICY "Tenant users can view credit notes" ON public.credit_notes
FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Tenant users can view credit note lines" ON public.credit_note_lines;
CREATE POLICY "Tenant users can view credit note lines" ON public.credit_note_lines
FOR SELECT TO authenticated
USING (
  EXISTS ( SELECT 1 FROM credit_notes cn
    WHERE cn.id = credit_note_lines.credit_note_id
      AND (cn.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
      AND has_tenant_role(cn.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role]))
);

DROP POLICY IF EXISTS "mandates_select" ON public.customer_payment_mandates;
CREATE POLICY "mandates_select" ON public.customer_payment_mandates
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "mandate_tokens_select" ON public.mandate_setup_tokens;
CREATE POLICY "mandate_tokens_select" ON public.mandate_setup_tokens
FOR SELECT TO authenticated
USING (
  (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Tenant users can view payment reminders" ON public.payment_reminders;
CREATE POLICY "Tenant users can view payment reminders" ON public.payment_reminders
FOR SELECT TO authenticated
USING (
  EXISTS ( SELECT 1 FROM invoices i
    WHERE i.id = payment_reminders.invoice_id
      AND (i.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
      AND has_tenant_role(i.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role]))
);

DROP POLICY IF EXISTS "Tenant users can view gift cards" ON public.gift_cards;
CREATE POLICY "Tenant users can view gift cards" ON public.gift_cards
FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

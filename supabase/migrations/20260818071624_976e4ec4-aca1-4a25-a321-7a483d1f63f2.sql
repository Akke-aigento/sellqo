-- SEC-4 Deel A: zeven promotietabellen achter het per-gebruiker recht 'discount_codes'
DO $$
DECLARE
  t record;
  cond text := '((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) )) AND (has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role]) OR (has_tenant_role(tenant_id, ARRAY[''marketing''::app_role]) AND has_permission_grant(auth.uid(), tenant_id, ''discount_codes''::text))))';
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('automatic_discounts','auto discounts'),
      ('bogo_promotions','bogo promotions'),
      ('gift_promotions','gift promotions'),
      ('discount_stacking_rules','stacking rules'),
      ('loyalty_programs','loyalty programs'),
      ('volume_discounts','volume discounts')
    ) AS v(tbl, label)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Marketing roles can insert '||t.label, t.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', 'Marketing roles can insert '||t.label, t.tbl, cond);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Marketing roles can update '||t.label, t.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', 'Marketing roles can update '||t.label, t.tbl, cond, cond);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Marketing roles can delete '||t.label, t.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', 'Marketing roles can delete '||t.label, t.tbl, cond);
  END LOOP;
END $$;

-- volume_discount_tiers: scopet via bovenliggende volume_discounts, EXISTS-constructie behouden
DROP POLICY IF EXISTS "Marketing roles can insert volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can insert volume discount tiers"
ON public.volume_discount_tiers FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM volume_discounts vd
  WHERE vd.id = volume_discount_tiers.volume_discount_id
    AND (has_tenant_role(vd.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
      OR (has_tenant_role(vd.tenant_id, ARRAY['marketing'::app_role])
          AND has_permission_grant(auth.uid(), vd.tenant_id, 'discount_codes'::text)))
));

DROP POLICY IF EXISTS "Marketing roles can update volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can update volume discount tiers"
ON public.volume_discount_tiers FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM volume_discounts vd
  WHERE vd.id = volume_discount_tiers.volume_discount_id
    AND (has_tenant_role(vd.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
      OR (has_tenant_role(vd.tenant_id, ARRAY['marketing'::app_role])
          AND has_permission_grant(auth.uid(), vd.tenant_id, 'discount_codes'::text)))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM volume_discounts vd
  WHERE vd.id = volume_discount_tiers.volume_discount_id
    AND (has_tenant_role(vd.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
      OR (has_tenant_role(vd.tenant_id, ARRAY['marketing'::app_role])
          AND has_permission_grant(auth.uid(), vd.tenant_id, 'discount_codes'::text)))
));

DROP POLICY IF EXISTS "Marketing roles can delete volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can delete volume discount tiers"
ON public.volume_discount_tiers FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM volume_discounts vd
  WHERE vd.id = volume_discount_tiers.volume_discount_id
    AND (has_tenant_role(vd.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])
      OR (has_tenant_role(vd.tenant_id, ARRAY['marketing'::app_role])
          AND has_permission_grant(auth.uid(), vd.tenant_id, 'discount_codes'::text)))
));

-- SEC-4 Deel B: twee tenant-blinde SELECT-policies rolgescoped
DROP POLICY IF EXISTS "Auth users can view tenant digital deliveries" ON public.digital_deliveries;
CREATE POLICY "Auth users can view tenant digital deliveries"
ON public.digital_deliveries FOR SELECT TO authenticated
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) ))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
);

DROP POLICY IF EXISTS "Tenant users can view gift card transactions" ON public.gift_card_transactions;
CREATE POLICY "Tenant users can view gift card transactions"
ON public.gift_card_transactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM gift_cards gc
  WHERE gc.id = gift_card_transactions.gift_card_id
    AND (gc.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) ))
    AND has_tenant_role(gc.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role])
));
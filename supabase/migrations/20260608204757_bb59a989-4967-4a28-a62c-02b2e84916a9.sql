-- Batch 2C2a-ii — Discount/promo/loyalty/gift-cards RLS-aanscherping
-- Cluster 2 (recon §1). Marketing-rol krijgt RW op merchandising; usage/transactions
-- worden service-role only voor INSERT (atomic via checkout RPC's).

-- =============================================================
-- discount_codes
-- =============================================================
DROP POLICY IF EXISTS "Tenant users can view their discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Tenant users can create discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Tenant users can update their discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Tenant users can delete their discount codes" ON public.discount_codes;

CREATE POLICY "Tenant users can view discount codes"
ON public.discount_codes FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert discount codes"
ON public.discount_codes FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update discount codes"
ON public.discount_codes FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete discount codes"
ON public.discount_codes FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- discount_code_usage — INSERT service-role only (checkout RPC)
-- =============================================================
DROP POLICY IF EXISTS "Tenant users can create usage records" ON public.discount_code_usage;
DROP POLICY IF EXISTS "Tenant users can view usage of their discount codes" ON public.discount_code_usage;

CREATE POLICY "Tenant users can view discount code usage"
ON public.discount_code_usage FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.discount_codes dc
    WHERE dc.id = discount_code_usage.discount_code_id
      AND dc.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

-- INSERT: geen auth-policy → service-role only via checkout RPC

CREATE POLICY "Tenant admins can update discount code usage"
ON public.discount_code_usage FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.discount_codes dc
    WHERE dc.id = discount_code_usage.discount_code_id
      AND public.has_tenant_role(dc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.discount_codes dc
    WHERE dc.id = discount_code_usage.discount_code_id
      AND public.has_tenant_role(dc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete discount code usage"
ON public.discount_code_usage FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.discount_codes dc
    WHERE dc.id = discount_code_usage.discount_code_id
      AND public.has_tenant_role(dc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- =============================================================
-- automatic_discounts
-- =============================================================
DROP POLICY IF EXISTS "Users can view auto discounts for their tenant" ON public.automatic_discounts;
DROP POLICY IF EXISTS "Users can insert auto discounts for their tenant" ON public.automatic_discounts;
DROP POLICY IF EXISTS "Users can update auto discounts for their tenant" ON public.automatic_discounts;
DROP POLICY IF EXISTS "Users can delete auto discounts for their tenant" ON public.automatic_discounts;

CREATE POLICY "Tenant users can view auto discounts"
ON public.automatic_discounts FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert auto discounts"
ON public.automatic_discounts FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update auto discounts"
ON public.automatic_discounts FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete auto discounts"
ON public.automatic_discounts FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- bogo_promotions
-- =============================================================
DROP POLICY IF EXISTS "Users can view bogo for their tenant" ON public.bogo_promotions;
DROP POLICY IF EXISTS "Users can insert bogo for their tenant" ON public.bogo_promotions;
DROP POLICY IF EXISTS "Users can update bogo for their tenant" ON public.bogo_promotions;
DROP POLICY IF EXISTS "Users can delete bogo for their tenant" ON public.bogo_promotions;

CREATE POLICY "Tenant users can view bogo promotions"
ON public.bogo_promotions FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert bogo promotions"
ON public.bogo_promotions FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update bogo promotions"
ON public.bogo_promotions FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete bogo promotions"
ON public.bogo_promotions FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- volume_discounts
-- =============================================================
DROP POLICY IF EXISTS "Users can view volume discounts for their tenant" ON public.volume_discounts;
DROP POLICY IF EXISTS "Users can insert volume discounts for their tenant" ON public.volume_discounts;
DROP POLICY IF EXISTS "Users can update volume discounts for their tenant" ON public.volume_discounts;
DROP POLICY IF EXISTS "Users can delete volume discounts for their tenant" ON public.volume_discounts;

CREATE POLICY "Tenant users can view volume discounts"
ON public.volume_discounts FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert volume discounts"
ON public.volume_discounts FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update volume discounts"
ON public.volume_discounts FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete volume discounts"
ON public.volume_discounts FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- volume_discount_tiers — scoped via volume_discount_id → volume_discounts.tenant_id
-- =============================================================
DROP POLICY IF EXISTS "Users can view volume discount tiers" ON public.volume_discount_tiers;
DROP POLICY IF EXISTS "Users can insert volume discount tiers" ON public.volume_discount_tiers;
DROP POLICY IF EXISTS "Users can update volume discount tiers" ON public.volume_discount_tiers;
DROP POLICY IF EXISTS "Users can delete volume discount tiers" ON public.volume_discount_tiers;

CREATE POLICY "Tenant users can view volume discount tiers"
ON public.volume_discount_tiers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.volume_discounts vd
    WHERE vd.id = volume_discount_tiers.volume_discount_id
      AND vd.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Marketing roles can insert volume discount tiers"
ON public.volume_discount_tiers FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.volume_discounts vd
    WHERE vd.id = volume_discount_tiers.volume_discount_id
      AND public.has_tenant_role(vd.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can update volume discount tiers"
ON public.volume_discount_tiers FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.volume_discounts vd
    WHERE vd.id = volume_discount_tiers.volume_discount_id
      AND public.has_tenant_role(vd.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.volume_discounts vd
    WHERE vd.id = volume_discount_tiers.volume_discount_id
      AND public.has_tenant_role(vd.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete volume discount tiers"
ON public.volume_discount_tiers FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.volume_discounts vd
    WHERE vd.id = volume_discount_tiers.volume_discount_id
      AND public.has_tenant_role(vd.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- gift_promotions
-- =============================================================
DROP POLICY IF EXISTS "Users can view gift promotions for their tenant" ON public.gift_promotions;
DROP POLICY IF EXISTS "Users can insert gift promotions for their tenant" ON public.gift_promotions;
DROP POLICY IF EXISTS "Users can update gift promotions for their tenant" ON public.gift_promotions;
DROP POLICY IF EXISTS "Users can delete gift promotions for their tenant" ON public.gift_promotions;

CREATE POLICY "Tenant users can view gift promotions"
ON public.gift_promotions FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert gift promotions"
ON public.gift_promotions FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update gift promotions"
ON public.gift_promotions FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete gift promotions"
ON public.gift_promotions FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- discount_stacking_rules
-- =============================================================
DROP POLICY IF EXISTS "Users can view stacking rules for their tenant" ON public.discount_stacking_rules;
DROP POLICY IF EXISTS "Users can insert stacking rules for their tenant" ON public.discount_stacking_rules;
DROP POLICY IF EXISTS "Users can update stacking rules for their tenant" ON public.discount_stacking_rules;
DROP POLICY IF EXISTS "Users can delete stacking rules for their tenant" ON public.discount_stacking_rules;

CREATE POLICY "Tenant users can view stacking rules"
ON public.discount_stacking_rules FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert stacking rules"
ON public.discount_stacking_rules FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update stacking rules"
ON public.discount_stacking_rules FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete stacking rules"
ON public.discount_stacking_rules FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- gift_cards — vervang overlap (ALL + SELECT) door split policies
-- =============================================================
DROP POLICY IF EXISTS "Tenant admins can manage gift cards" ON public.gift_cards;
DROP POLICY IF EXISTS "Tenant users can view gift cards" ON public.gift_cards;

CREATE POLICY "Tenant users can view gift cards"
ON public.gift_cards FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert gift cards"
ON public.gift_cards FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update gift cards"
ON public.gift_cards FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete gift cards"
ON public.gift_cards FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- gift_card_designs
-- =============================================================
DROP POLICY IF EXISTS "Tenant admins can manage gift card designs" ON public.gift_card_designs;
DROP POLICY IF EXISTS "Tenant users can view gift card designs" ON public.gift_card_designs;

CREATE POLICY "Tenant users can view gift card designs"
ON public.gift_card_designs FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert gift card designs"
ON public.gift_card_designs FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update gift card designs"
ON public.gift_card_designs FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete gift card designs"
ON public.gift_card_designs FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- gift_card_transactions — INSERT service-role only
-- scoped via gift_card_id → gift_cards.tenant_id
-- =============================================================
DROP POLICY IF EXISTS "Tenant admins can manage gift card transactions" ON public.gift_card_transactions;
DROP POLICY IF EXISTS "Tenant users can view gift card transactions" ON public.gift_card_transactions;

CREATE POLICY "Tenant users can view gift card transactions"
ON public.gift_card_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gift_cards gc
    WHERE gc.id = gift_card_transactions.gift_card_id
      AND gc.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

-- INSERT: geen auth-policy → service-role only via checkout/redemption flow

CREATE POLICY "Tenant admins can update gift card transactions"
ON public.gift_card_transactions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gift_cards gc
    WHERE gc.id = gift_card_transactions.gift_card_id
      AND public.has_tenant_role(gc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gift_cards gc
    WHERE gc.id = gift_card_transactions.gift_card_id
      AND public.has_tenant_role(gc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete gift card transactions"
ON public.gift_card_transactions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gift_cards gc
    WHERE gc.id = gift_card_transactions.gift_card_id
      AND public.has_tenant_role(gc.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- =============================================================
-- loyalty_programs
-- =============================================================
DROP POLICY IF EXISTS "Users can view loyalty programs for their tenant" ON public.loyalty_programs;
DROP POLICY IF EXISTS "Users can insert loyalty programs for their tenant" ON public.loyalty_programs;
DROP POLICY IF EXISTS "Users can update loyalty programs for their tenant" ON public.loyalty_programs;
DROP POLICY IF EXISTS "Users can delete loyalty programs for their tenant" ON public.loyalty_programs;

CREATE POLICY "Tenant users can view loyalty programs"
ON public.loyalty_programs FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert loyalty programs"
ON public.loyalty_programs FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update loyalty programs"
ON public.loyalty_programs FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete loyalty programs"
ON public.loyalty_programs FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- loyalty_tiers — scoped via loyalty_program_id → loyalty_programs.tenant_id
-- =============================================================
DROP POLICY IF EXISTS "Users can view loyalty tiers" ON public.loyalty_tiers;
DROP POLICY IF EXISTS "Users can insert loyalty tiers" ON public.loyalty_tiers;
DROP POLICY IF EXISTS "Users can update loyalty tiers" ON public.loyalty_tiers;
DROP POLICY IF EXISTS "Users can delete loyalty tiers" ON public.loyalty_tiers;

CREATE POLICY "Tenant users can view loyalty tiers"
ON public.loyalty_tiers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = loyalty_tiers.loyalty_program_id
      AND lp.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Marketing roles can insert loyalty tiers"
ON public.loyalty_tiers FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = loyalty_tiers.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can update loyalty tiers"
ON public.loyalty_tiers FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = loyalty_tiers.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = loyalty_tiers.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete loyalty tiers"
ON public.loyalty_tiers FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_programs lp
    WHERE lp.id = loyalty_tiers.loyalty_program_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- loyalty_transactions — INSERT service-role only
-- scoped via customer_loyalty_id → customer_loyalty.loyalty_program_id
--   → loyalty_programs.tenant_id
-- =============================================================
DROP POLICY IF EXISTS "Users can view loyalty transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Users can insert loyalty transactions" ON public.loyalty_transactions;

CREATE POLICY "Tenant users can view loyalty transactions"
ON public.loyalty_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_loyalty cl
    JOIN public.loyalty_programs lp ON lp.id = cl.loyalty_program_id
    WHERE cl.id = loyalty_transactions.customer_loyalty_id
      AND lp.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

-- INSERT: geen auth-policy → service-role only via checkout/refund flow

CREATE POLICY "Tenant admins can update loyalty transactions"
ON public.loyalty_transactions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_loyalty cl
    JOIN public.loyalty_programs lp ON lp.id = cl.loyalty_program_id
    WHERE cl.id = loyalty_transactions.customer_loyalty_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_loyalty cl
    JOIN public.loyalty_programs lp ON lp.id = cl.loyalty_program_id
    WHERE cl.id = loyalty_transactions.customer_loyalty_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete loyalty transactions"
ON public.loyalty_transactions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_loyalty cl
    JOIN public.loyalty_programs lp ON lp.id = cl.loyalty_program_id
    WHERE cl.id = loyalty_transactions.customer_loyalty_id
      AND public.has_tenant_role(lp.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

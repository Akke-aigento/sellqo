-- SEC-3: strip 'marketing' from write policies on 5 tables

-- gift_cards
DROP POLICY IF EXISTS "Marketing roles can insert gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can insert gift cards" ON public.gift_cards FOR INSERT TO authenticated
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Marketing roles can update gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can update gift cards" ON public.gift_cards FOR UPDATE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Marketing roles can delete gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can delete gift cards" ON public.gift_cards FOR DELETE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

-- customer_group_product_prices
DROP POLICY IF EXISTS "Users can insert customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can insert customer group product prices" ON public.customer_group_product_prices FOR INSERT TO authenticated
WITH CHECK (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))));

DROP POLICY IF EXISTS "Users can update customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can update customer group product prices" ON public.customer_group_product_prices FOR UPDATE TO authenticated
USING (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))))
WITH CHECK (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))));

DROP POLICY IF EXISTS "Users can delete customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can delete customer group product prices" ON public.customer_group_product_prices FOR DELETE TO authenticated
USING (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))));

-- legal_pages
DROP POLICY IF EXISTS "legal_pages_insert_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_insert_marketing" ON public.legal_pages FOR INSERT TO authenticated
WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "legal_pages_update_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_update_marketing" ON public.legal_pages FOR UPDATE TO authenticated
USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "legal_pages_delete_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_delete_marketing" ON public.legal_pages FOR DELETE TO authenticated
USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

-- external_reviews
DROP POLICY IF EXISTS "Moderators can insert external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can insert external_reviews" ON public.external_reviews FOR INSERT TO authenticated
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Moderators can update external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can update external_reviews" ON public.external_reviews FOR UPDATE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Moderators can delete external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can delete external_reviews" ON public.external_reviews FOR DELETE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

-- pos_quick_buttons
DROP POLICY IF EXISTS "pos_quick_buttons_insert" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_insert" ON public.pos_quick_buttons FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "pos_quick_buttons_update" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_update" ON public.pos_quick_buttons FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "pos_quick_buttons_delete" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_delete" ON public.pos_quick_buttons FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));
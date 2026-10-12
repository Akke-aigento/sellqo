-- VOORSTEL SEC-COST-1 (NIET UITGEVOERD) — inkoopprijs niet meer publiek leesbaar.
--
-- Probleem (gemeten 13-10-2026): de anon-rol (publieke sleutel) leest via de
-- RLS-policy "Public can view active storefront products" ALLE kolommen van
-- products en product_variants, dus ook cost_price (30 producten, 116 varianten,
-- 9 winkels) en raw_import_data.
--
-- Fix: tabel-SELECT voor anon intrekken en alleen de veilige kolommen granten.
-- RLS blijft ongewijzigd (rijfilter), dit is een kolomfilter erbovenop.
--
-- RISICO vóór uitvoeren: elke anon-query met select=* (of products(*) als
-- embed) op deze tabellen faalt daarna met "permission denied". De SellQo-
-- webshop gebruikt expliciete kolomlijsten (usePublicStorefront, SearchModal).
-- Eigen tenant-frontends (Mancini, Fonske, Benny Rich, VanXcel) eerst nalopen:
-- grep op from('products') / from('product_variants') met '*'.
-- storefront-api/storefront-customer-api draaien als service_role: niet geraakt.
--
-- LET OP (review 13-10): de policy "Public can view active storefront products" staat op
-- rol {public}, dus ook INGELOGDE gebruikers van een andere winkel lezen cost_price
-- (gemeten: Mancini-admin ziet 74 producten van andere winkels, alle kolommen). Kolomrechten
-- kunnen dat voor 'authenticated' niet oplossen (admins hebben cost_price van hun eigen
-- producten nodig). Aanvullende stap B: de publieke policies op products/product_variants
-- beperken tot TO anon, zodat ingelogde gebruikers alleen via de tenant-policies lezen.
-- Bijwerking B: een ingelogde SellQo-gebruiker die de ingebouwde webshop van een ANDERE
-- winkel bekijkt, ziet daar geen producten (eigen winkel blijft werken). Eerst policy-
-- definities ophalen: select policyname, roles, qual from pg_policies where tablename in
-- ('products','product_variants');
--
-- Afgeschermd products: amazon_listing_error, bol_listing_error, cost_price, ebay_listing_error, import_job_id, import_source, imported_at, license_generator, marketplace_last_sync_hash, marketplace_lock_reason, marketplace_mappings, odoo_listing_error, original_category_value, original_created_at, raw_import_data, shopify_listing_error, woocommerce_listing_error
-- Afgeschermd product_variants: cost_price

BEGIN;
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (access_duration_days, allow_backorder, amazon_asin, amazon_bullets, amazon_last_synced_at, amazon_listing_status, amazon_offer_id, amazon_optimized_description, amazon_optimized_title, barcode, bol_bullets, bol_condition, bol_delivery_code, bol_ean, bol_fulfilment_method, bol_last_synced_at, bol_listing_status, bol_offer_id, bol_optimized_description, bol_optimized_title, bundle_discount_type, bundle_discount_value, bundle_pricing_model, category_id, compare_at_price, created_at, description, digital_delivery_type, download_expiry_hours, download_limit, ebay_category_id, ebay_category_name, ebay_category_path, ebay_condition, ebay_item_id, ebay_last_synced_at, ebay_listing_status, ebay_offer_id, ebay_optimized_description, ebay_optimized_title, external_id, featured_image, file_size_bytes, gift_card_allow_custom, gift_card_denominations, gift_card_design_id, gift_card_expiry_months, gift_card_max_amount, gift_card_min_amount, google_product_category, hide_from_storefront, id, image_alt_texts, images, is_active, is_featured, last_inventory_sync, low_stock_threshold, marketplace_lock_amazon, marketplace_lock_bol_com, marketplace_lock_ebay, marketplace_lock_shopify, marketplace_lock_woocommerce, meta_description, meta_title, name, odoo_last_synced_at, odoo_listing_status, odoo_optimized_description, odoo_optimized_title, odoo_product_id, odoo_variant_id, parent_product_id, price, product_type, published_scope, requires_shipping, shopify_bullets, shopify_handle, shopify_last_synced_at, shopify_listing_status, shopify_meta_description, shopify_meta_title, shopify_optimized_description, shopify_optimized_title, shopify_product_id, shopify_variant_id, short_description, size_guide, sku, slug, social_channels, stock, sync_inventory, tags, tenant_id, track_inventory, updated_at, vat_rate_id, vendor, weight, woocommerce_bullets, woocommerce_last_synced_at, woocommerce_listing_status, woocommerce_meta_description, woocommerce_meta_title, woocommerce_optimized_description, woocommerce_optimized_title, woocommerce_product_id, woocommerce_variant_id) ON public.products TO anon;
REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (attribute_values, barcode, compare_at_price, created_at, id, image_url, images, internal_reference, is_active, linked_product_id, position, price, product_id, sku, stock, tenant_id, title, track_inventory, updated_at, weight) ON public.product_variants TO anon;
COMMIT;

-- Controle (aparte aanroep):
--   set local role anon; select cost_price from public.products limit 1;   -- moet falen
--   set local role anon; select id, name, price from public.products limit 1; -- moet werken
-- Terugdraaien:
--   GRANT SELECT ON public.products TO anon; GRANT SELECT ON public.product_variants TO anon;

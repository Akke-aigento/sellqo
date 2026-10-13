-- PROMO-ENGINE-1 fixture: live data for scripts/promo-compare/compare.ts.
-- E-mails only as md5. Save the `fixture` field as fixture.json (gitignored).
with carts as (
  select c.id, c.tenant_id, c.discount_codes, md5(lower(trim(c.customer_email))) as customer_email, c.shipping_method_id, c.shipping_cost, c.discount_amount, c.checkout_status, c.expires_at > now() as live
  from storefront_carts c where exists (select 1 from storefront_cart_items i where i.cart_id=c.id)
), items as (
  select i.cart_id, i.product_id, i.variant_id, i.quantity, coalesce(v.price, i.unit_price) as unit_price
  from storefront_cart_items i left join product_variants v on v.id=i.variant_id where i.cart_id in (select id from carts)
), sample_products as (
  select * from (select p.id, p.tenant_id, p.price, row_number() over (partition by p.tenant_id order by p.created_at) rn from products p where p.is_active and p.price > 0) x where rn <= 8
), pids as (select product_id id from items union select id from sample_products)
select json_build_object(
 'carts', (select json_agg(c) from carts c),
 'items', (select json_agg(i) from items i),
 'sample_products', (select json_agg(json_build_object('id',id,'tenant_id',tenant_id,'price',price)) from sample_products),
 'volume_discounts', (select json_agg(row_to_json(v)::jsonb || jsonb_build_object('volume_discount_tiers', coalesce((select jsonb_agg(t) from volume_discount_tiers t where t.volume_discount_id=v.id),'[]'::jsonb))) from volume_discounts v),
 'bogo_promotions', (select json_agg(b) from bogo_promotions b),
 'product_bundles', (select json_agg(row_to_json(b)::jsonb || jsonb_build_object('bundle_products', coalesce((select jsonb_agg(row_to_json(bp)::jsonb || jsonb_build_object('products', (select jsonb_build_object('id',p.id,'price',p.price) from products p where p.id=bp.product_id))) from bundle_products bp where bp.bundle_id=b.id),'[]'::jsonb))) from product_bundles b),
 'automatic_discounts', (select json_agg(a) from automatic_discounts a),
 'discount_stacking_rules', (select json_agg(s) from discount_stacking_rules s),
 'customer_groups', (select json_agg(g) from customer_groups g),
 'discount_codes', (select json_agg(d) from discount_codes d),
 'discount_code_usage', (select json_agg(json_build_object('discount_code_id',u.discount_code_id,'customer_email',u.customer_email)) from discount_code_usage u),
 'orders', (select json_agg(json_build_object('tenant_id',o.tenant_id,'customer_email',md5(lower(trim(o.customer_email))),'payment_status',o.payment_status)) from orders o where o.payment_status='paid' and o.customer_email is not null and md5(lower(trim(o.customer_email))) in (select customer_email from carts)),
 'product_categories', (select json_agg(json_build_object('product_id',pc.product_id,'category_id',pc.category_id)) from product_categories pc where pc.product_id in (select id from pids)),
 'products', (select json_agg(json_build_object('id',p.id,'category_id',p.category_id,'price',p.price)) from products p where p.id in (select id from pids)),
 'shipping_methods', (select json_agg(json_build_object('id',m.id,'tenant_id',m.tenant_id,'price',m.price,'free_above',m.free_above,'is_active',m.is_active)) from shipping_methods m),
 'tenants', (select json_agg(json_build_object('id',t.id,'name',t.name,'tax_percentage',t.tax_percentage)) from tenants t)
) as fixture;

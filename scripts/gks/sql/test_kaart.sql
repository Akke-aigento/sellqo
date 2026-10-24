\set ON_ERROR_STOP 1
-- KAART-1 — de horeca-kaart. Eigen zaak K (3333…), draait na de kassatests.
insert into public.tenants (id, name, business_modules) values ('33333333-3333-3333-3333-333333333333','Café K','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values
 ('aaaaaaaa-0000-0000-0000-0000000000f1','staff','33333333-3333-3333-3333-333333333333'),
 ('aaaaaaaa-0000-0000-0000-0000000000f2','marketing','33333333-3333-3333-3333-333333333333');
-- Globale tarieven (tenant_id null), zoals live.
insert into public.vat_rates (id, tenant_id, rate, is_default) values
 ('cccccccc-0000-0000-0000-0000000f0021',null,21,true),
 ('cccccccc-0000-0000-0000-0000000f0012',null,12,false),
 ('cccccccc-0000-0000-0000-0000000f0006',null,6,false);
-- Een product van een andere zaak met dezelfde slug: mag de slug van K niet beïnvloeden.
insert into public.products (tenant_id, name, slug, price) values ('22222222-2222-2222-2222-222222222222','Duvel','duvel',4);

create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;

-- Slug zonder extensies.
select public.kaart_slug('Café Crème à la Maison!') = 'cafe-creme-a-la-maison';
select public.kaart_slug('***') = 'product';

set role authenticated;
-- Marketing mag geen kaart aanmaken.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f2';
select pg_temp.try($$select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','Bieren')$$) = '42501';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[{"name":"Duvel","price":"4.50"}]')$$) = '42501';

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
-- Categorie aanmaken met standaarden; tweede keer (andere schrijfwijze) = dezelfde.
select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','Frisdrank','cccccccc-0000-0000-0000-0000000f0021','cccccccc-0000-0000-0000-0000000f0006') as cat_fris \gset
select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','  frisdrank ') = :'cat_fris';
select default_vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0021' and default_takeaway_vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0006' and slug = 'frisdrank' from public.categories where id = :'cat_fris';
select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','Bieren') as cat_bier \gset
-- Onbekend tarief en te lange naam geweigerd.
select pg_temp.try($$select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','X','cccccccc-0000-0000-0000-00000000dead')$$) = '22023';
select pg_temp.try($$select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','$$ || repeat('x', 81) || $$')$$) = '22023';

-- Producten toevoegen: standaarden van de categorie worden gestempeld, slugs uniek per zaak.
select jsonb_array_length(public.kaart_add_products('33333333-3333-3333-3333-333333333333', jsonb_build_array(
  jsonb_build_object('name','Cola','price','2.80','category_id', :'cat_fris'),
  jsonb_build_object('name','Cola','price','2.80','category_id', :'cat_fris'),
  jsonb_build_object('name','Duvel','price','4.5','category_id', :'cat_bier'),
  jsonb_build_object('name','Nootjes','price','0')))) = 4;
select count(*) = 2 from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' and slug in ('cola','cola-2');
select slug = 'duvel' from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' and name = 'Duvel';
select vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0021' and takeaway_vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0006'
   and not track_inventory and not requires_shipping and is_active
  from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' and slug = 'cola';
select vat_rate_id is null and category_id is null from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' and name = 'Nootjes';
select count(*) = 3 from public.product_categories pc join public.products p on p.id = pc.product_id where p.tenant_id = '33333333-3333-3333-3333-333333333333' and pc.is_primary;
-- Weigeringen: prijs, naam, vreemde categorie, te grote lijst — en niets half aangemaakt.
select count(*) as n_before from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' \gset
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[{"name":"Ok","price":"1"},{"name":"Fout","price":"-1"}]')$$) = '22023';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[{"name":"Fout","price":"1,50"}]')$$) = '22023';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[{"name":"","price":"1"}]')$$) = '22023';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[{"name":"X","price":"1","category_id":"dddddddd-0000-0000-0000-0000000000b1"}]')$$) = '22023';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333', (select jsonb_agg(jsonb_build_object('name','p'||g,'price','1')) from generate_series(1,301) g))$$) = '22023';
select pg_temp.try($$select public.kaart_add_products('33333333-3333-3333-3333-333333333333','[]')$$) = '22023';
select count(*) = :n_before from public.products where tenant_id = '33333333-3333-3333-3333-333333333333';
-- Andere zaak: geen toegang.
select pg_temp.try($$select public.kaart_add_products('22222222-2222-2222-2222-222222222222','[{"name":"X","price":"1"}]')$$) = '42501';

-- Bulk: prijs +0,10, +10 %, vast; nooit negatief; enkel eigen producten.
select array_agg(id) as ids from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' and name in ('Cola','Duvel') \gset
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"price":{"mode":"add","value":"0.10"}}') = 3;
select array_agg(price order by price) = '{2.90,2.90,4.60}' from public.products where id = any(:'ids');
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"price":{"mode":"percent","value":"10"}}') = 3;
select array_agg(price order by price) = '{3.19,3.19,5.06}' from public.products where id = any(:'ids');
select pg_temp.try(format($$select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', %L, '{"price":{"mode":"add","value":"-50"}}')$$, :'ids')) = '22023';
select array_agg(price order by price) = '{3.19,3.19,5.06}' from public.products where id = any(:'ids');
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"price":{"mode":"add","value":"-0.19"}}') = 3;
select array_agg(price order by price) = '{3.00,3.00,4.87}' from public.products where id = any(:'ids');
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"price":{"mode":"set","value":"3"}}') = 1;
select pg_temp.try(format($$select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', %L, '{"price":{"mode":"set","value":"-1"}}')$$, :'ids')) = '22023';
select pg_temp.try(format($$select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', %L, '{"price":{"mode":"weird","value":"1"}}')$$, :'ids')) = '22023';
select pg_temp.try(format($$select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', %L, '{"price":{"mode":"percent","value":"-100"}}')$$, :'ids')) = '22023';
select bool_and(price = 3) from public.products where id = any(:'ids');
-- Een product van een andere zaak in de selectie: niet geraakt.
select id as other from public.products where tenant_id = '22222222-2222-2222-2222-222222222222' and slug = 'duvel' \gset
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', array[:'other']::uuid[], '{"price":{"mode":"set","value":"9"}}') = 0;
select price = 4 from public.products where id = :'other';
-- Verbergen en terug.
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"is_active":false}') = 3;
select bool_and(not is_active) from public.products where id = any(:'ids');
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"is_active":true}') = 3;
-- Verplaatsen naar Bieren: primaire koppeling verhuist mee, btw van de categorie overnemen.
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', jsonb_build_object('category_id', :'cat_bier')) >= 2;
select bool_and(category_id = :'cat_bier') from public.products where id = any(:'ids');
select count(*) = 3 and bool_and(category_id = :'cat_bier' and is_primary) from public.product_categories where product_id = any(:'ids');
-- Bieren heeft geen standaard: btw blijft wat ze was (een lege standaard wist niets).
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"apply_category_vat":true}') = 0;
select count(*) = 2 from public.products where id = any(:'ids') and vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0021';
reset role;
update public.categories set default_vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0012' where id = :'cat_bier';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', :'ids', '{"apply_category_vat":true}') = 3;
select bool_and(vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0012') from public.products where id = any(:'ids');
-- Takeaway-tarief van Cola blijft (Bieren heeft er geen).
select count(*) = 2 from public.products where id = any(:'ids') and takeaway_vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0006';
-- Marketing mag niet bulken.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f2';
select pg_temp.try($$select public.kaart_bulk_update('33333333-3333-3333-3333-333333333333', array[gen_random_uuid()], '{"is_active":true}')$$) = '42501';
reset role;
\echo KAART-1: alle tests geslaagd

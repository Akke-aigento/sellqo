\set ON_ERROR_STOP 1
-- KAART-3 — volgorde en dupliceren. Zaak K (3333…) uit test_kaart.sql.
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','Van het vat') as vat \gset
-- Nieuwe producten komen achteraan in hun categorie.
select public.kaart_add_products('33333333-3333-3333-3333-333333333333', jsonb_build_array(
  jsonb_build_object('name','Pils 25cl','price','2.50','category_id',:'vat'),
  jsonb_build_object('name','Witbier','price','3.20','category_id',:'vat'),
  jsonb_build_object('name','Tripel','price','4.20','category_id',:'vat'))) is not null;
select string_agg(name, ',' order by menu_position) = 'Pils 25cl,Witbier,Tripel' from public.products where category_id = :'vat';
select id as pils from public.products where category_id = :'vat' and name = 'Pils 25cl' \gset
select id as wit from public.products where category_id = :'vat' and name = 'Witbier' \gset
select id as tri from public.products where category_id = :'vat' and name = 'Tripel' \gset
-- Volgorde slepen: Tripel bovenaan.
select public.kaart_reorder('33333333-3333-3333-3333-333333333333','products', array[:'tri',:'pils',:'wit']::uuid[]) = 3;
select string_agg(name, ',' order by menu_position) = 'Tripel,Pils 25cl,Witbier' from public.products where category_id = :'vat';
-- Extra's en een eigen post aan Pils, daarna een maat toevoegen.
reset role;
insert into public.product_addon_groups (id, tenant_id, name, product_ids) values ('abababab-0000-0000-0000-0000000000f1','33333333-3333-3333-3333-333333333333','Schuim', array[:'pils']::uuid[]);
insert into public.prep_stations (id, tenant_id, name, kind) values ('88888888-0000-0000-0000-0000000000f1','33333333-3333-3333-3333-333333333333','Tap','bar');
insert into public.prep_station_routes (tenant_id, station_id, product_id) values ('33333333-3333-3333-3333-333333333333','88888888-0000-0000-0000-0000000000f1', :'pils');
update public.products set allergens = '{gluten}', featured_image = 'https://x/pils.jpg', channels = '{pos,table}', vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0021' where id = :'pils';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select (public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', :'pils', 'Pils 33cl', '3.20') ->> 'slug') = 'pils-33cl';
select id as pils33 from public.products where name = 'Pils 33cl' \gset
-- Net onder Pils, de rest schuift op.
select string_agg(name, ',' order by menu_position) = 'Tripel,Pils 25cl,Pils 33cl,Witbier' from public.products where category_id = :'vat';
select price = 3.20 and category_id = :'vat' and allergens = '{gluten}' and featured_image = 'https://x/pils.jpg' and channels = '{pos,table}'
   and vat_rate_id = 'cccccccc-0000-0000-0000-0000000f0021' and is_active and not track_inventory
  from public.products where id = :'pils33';
reset role;
select :'pils33'::uuid = any(product_ids) from public.product_addon_groups where id = 'abababab-0000-0000-0000-0000000000f1';
select count(*) = 1 from public.prep_station_routes where product_id = :'pils33' and station_id = '88888888-0000-0000-0000-0000000000f1';
select count(*) = 1 from public.product_categories where product_id = :'pils33' and category_id = :'vat' and is_primary;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
-- Zelfde naam nog eens: slug -2. Dupliceren van een product zonder positie zet ook het origineel.
select (public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', :'pils', 'Pils 33cl', '3.20') ->> 'slug') = 'pils-33cl-2';
-- Een product zonder positie (van vóór KAART-3): origineel krijgt de laatste plaats, kopie erna.
reset role;
insert into public.products (id, tenant_id, name, slug, price, category_id) values ('eeeeeeee-0000-0000-0000-0000000000f9','33333333-3333-3333-3333-333333333333','Oud bier','oud-bier',3,:'vat');
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', 'eeeeeeee-0000-0000-0000-0000000000f9', 'Oud bier groot', '4') is not null;
select string_agg(name, ',' order by menu_position) = 'Tripel,Pils 25cl,Pils 33cl,Pils 33cl,Witbier,Oud bier,Oud bier groot' from public.products where category_id = :'vat';
-- Categorieën slepen.
select public.kaart_ensure_category('33333333-3333-3333-3333-333333333333','Frisdrank') as fris \gset
select public.kaart_reorder('33333333-3333-3333-3333-333333333333','categories', array[:'vat',:'fris']::uuid[]) >= 1;
reset role;
select (select sort_order from public.categories where id = :'vat') = 0 and (select sort_order from public.categories where id = :'fris') = 1;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
-- Weigeringen: dubbele id's, onbekende soort, prijs, naam, product van een andere zaak, andere zaak, marketing.
select pg_temp.try(format($$select public.kaart_reorder('33333333-3333-3333-3333-333333333333','products', array[%L,%L]::uuid[])$$, :'pils', :'pils')) = '22023';
select pg_temp.try(format($$select public.kaart_reorder('33333333-3333-3333-3333-333333333333','tables', array[%L]::uuid[])$$, :'pils')) = '22023';
select pg_temp.try(format($$select public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', %L, 'X', '-1')$$, :'pils')) = '22023';
select pg_temp.try(format($$select public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', %L, '', '1')$$, :'pils')) = '22023';
select pg_temp.try($$select public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', 'eeeeeeee-0000-0000-0000-0000000000b2', 'X', '1')$$) = '22023';
select pg_temp.try(format($$select public.kaart_reorder('22222222-2222-2222-2222-222222222222','products', array[%L]::uuid[])$$, :'pils')) = '42501';
-- Een product van een andere zaak in de volgorde: niet geraakt.
reset role;
select coalesce(menu_position, -99) as b2pos from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2' \gset
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select public.kaart_reorder('33333333-3333-3333-3333-333333333333','products', array['eeeeeeee-0000-0000-0000-0000000000b2']::uuid[]) = 0;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-0000000000f2';
select pg_temp.try(format($$select public.kaart_duplicate_product('33333333-3333-3333-3333-333333333333', %L, 'X', '1')$$, :'pils')) = '42501';
reset role;
select coalesce(menu_position, -99) = :b2pos from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2';
\echo KAART-3: alle tests geslaagd

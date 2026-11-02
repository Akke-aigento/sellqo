\set ON_ERROR_STOP 1
-- PRIJS-GATEN-1 — rol-impersonatie op de prijsvelden van products en product_variants en op
-- bulk_adjust_prices. Eigen zaken P (5151…) en Q (5252…), eigen gebruikers per rol.
-- Elke regel moet 't' geven (run.sh faalt op ' f').
-- Let op: lokaal staat er geen RLS op products/product_variants; deze test bewijst dus de GUARD op zich
-- (default-deny), ook voor rollen die live al door RLS worden tegengehouden (viewer, accountant).
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;

reset role;
insert into public.tenants (id, name) values
  ('51515151-0000-0000-0000-000000000001', 'Zaak P'), ('52525252-0000-0000-0000-000000000001', 'Zaak Q')
  on conflict (id) do nothing;
delete from public.user_roles where user_id::text like '5150000%';
insert into public.user_roles (user_id, role, tenant_id) values
  ('51500000-0000-0000-0000-0000000000a1', 'tenant_admin', '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a2', 'staff',        '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a3', 'warehouse',    '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a4', 'marketing',    '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a5', 'viewer',       '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a6', 'accountant',   '51515151-0000-0000-0000-000000000001'),
  ('51500000-0000-0000-0000-0000000000a7', 'platform_admin', null),
  ('51500000-0000-0000-0000-0000000000b1', 'tenant_admin', '52525252-0000-0000-0000-000000000001');
delete from public.product_variants where product_id in (select id from public.products where tenant_id in ('51515151-0000-0000-0000-000000000001','52525252-0000-0000-0000-000000000001'));
delete from public.products where tenant_id in ('51515151-0000-0000-0000-000000000001','52525252-0000-0000-0000-000000000001');
insert into public.products (id, tenant_id, name, slug, price, compare_at_price, cost_price, stock) values
  ('51510000-0000-0000-0000-0000000000f1', '51515151-0000-0000-0000-000000000001', 'Pizza', 'pg1-pizza', 10, 12, 4, 5),
  ('51510000-0000-0000-0000-0000000000f2', '51515151-0000-0000-0000-000000000001', 'Pasta', 'pg1-pasta', 8, null, 3, 5),
  ('52520000-0000-0000-0000-0000000000f1', '52525252-0000-0000-0000-000000000001', 'Kebab', 'pg1-kebab', 9, null, 3, 5);
insert into public.product_variants (id, product_id, tenant_id, title, price, compare_at_price, cost_price, stock) values
  ('51519999-0000-0000-0000-0000000000f1', '51510000-0000-0000-0000-0000000000f1', '51515151-0000-0000-0000-000000000001', 'Groot', 14, 16, 5, 3);
grant update on public.products, public.product_variants to anon;

-- De products-guard staat lokaal niet standaard aan (test_kaart3 zet hem tijdelijk); hier ook.
drop trigger if exists trg_guard_product_commercial_fields on public.products;
create trigger trg_guard_product_commercial_fields before update on public.products for each row execute function public.guard_product_commercial_fields();

-- Hulp: één update als een gebruiker (sub) of als een JWT-rol zonder sub.
create or replace function pg_temp.as_user(p_sub text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  r := pg_temp.try(p_sql);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  return r;
end $$;
create or replace function pg_temp.as_jwt_role(p_role text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
  r := pg_temp.try(p_sql);
  execute 'reset role';
  perform set_config('request.jwt.claim.role', '', true);
  return r;
end $$;

begin;
-- 1. products: prijsvelden ------------------------------------------------------------------------------
-- tenant_admin, staff, platform_admin: ok
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a1', $$update public.products set price = 11 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a2', $$update public.products set price = 12, cost_price = 5 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a7', $$update public.products set compare_at_price = 15 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
-- warehouse, marketing, viewer, accountant: 42501 op elk prijsveld
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a3', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.products set compare_at_price = 1 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$update public.products set cost_price = 1 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.products set vat_rate_id = gen_random_uuid() where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$update public.products set takeaway_vat_rate_id = gen_random_uuid() where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
-- een gebruiker zonder rol in deze zaak (admin van Q): ook geweigerd
select pg_temp.as_user('51500000-0000-0000-0000-0000000000b1', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
-- anon-JWT (geen sub): geweigerd; service role (geen sub): ok
select pg_temp.as_jwt_role('anon', $$update public.products set price = 0.01 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_jwt_role('service_role', $$update public.products set price = 13 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
-- postgres zonder JWT (migraties, cron): ok
select pg_temp.try($$update public.products set price = 13.5 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
-- de prijs staat waar de toegelaten rollen hem zetten, niet op 0,01
select price = 13.5 and cost_price = 5 and compare_at_price = 15 from public.products where id = '51510000-0000-0000-0000-0000000000f1';

-- niet-prijsvelden blijven toegelaten
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a3', $$update public.products set name = 'Pizza W', stock = 7 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$update public.products set name = 'Pizza M' where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.products set name = 'Pizza V' where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$update public.products set name = 'Pizza A', stock = 8 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
-- een volledige payload met ongewijzigde prijs (zoals het formulier stuurt): ok
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.products set name = 'Pizza', price = 13.5, cost_price = 5 where id = '51510000-0000-0000-0000-0000000000f1'$$) = 'ok';
-- bestaande regels voor marketing/warehouse ongewijzigd: sku, en voorraad enkel warehouse
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$update public.products set sku = 'X1' where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$update public.products set stock = 1 where id = '51510000-0000-0000-0000-0000000000f1'$$) = '42501';
select stock = 8 and name = 'Pizza' from public.products where id = '51510000-0000-0000-0000-0000000000f1';

-- 2. product_variants: prijsvelden ----------------------------------------------------------------------
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a1', $$update public.product_variants set price = 15 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a2', $$update public.product_variants set cost_price = 6 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a7', $$update public.product_variants set compare_at_price = 17 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a3', $$update public.product_variants set price = 0.01 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$update public.product_variants set price = 0.01 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.product_variants set compare_at_price = 1 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$update public.product_variants set cost_price = 1 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000b1', $$update public.product_variants set price = 0.01 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_jwt_role('anon', $$update public.product_variants set price = 0.01 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
select pg_temp.as_jwt_role('service_role', $$update public.product_variants set price = 15.5 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.try($$update public.product_variants set price = 15.75 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
-- variant met prijswijziging naar een product van een andere zaak verhuizen: admin van P heeft daar geen rol
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a1', $$update public.product_variants set product_id = '52520000-0000-0000-0000-0000000000f1', price = 1 where id = '51519999-0000-0000-0000-0000000000f1'$$) = '42501';
-- niet-prijsvelden: warehouse voorraad, viewer titel; ongewijzigde prijs in de payload ok
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a3', $$update public.product_variants set stock = 9, price = 15.75 where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$update public.product_variants set title = 'XL' where id = '51519999-0000-0000-0000-0000000000f1'$$) = 'ok';
select price = 15.75 and cost_price = 6 and compare_at_price = 17 and stock = 9 and title = 'XL'
  from public.product_variants where id = '51519999-0000-0000-0000-0000000000f1';

-- 3. bulk_adjust_prices ---------------------------------------------------------------------------------
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a1', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f1','51510000-0000-0000-0000-0000000000f2']::uuid[], 'add', 1, 'price')$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a2', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'exact', 2, 'cost_price')$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a7', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'set_current', 0, 'compare_at_price')$$) = 'ok';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a3', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'exact', 0.01, 'price')$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a4', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'exact', 0.01, 'price')$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a5', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'exact', 0.01, 'price')$$) = '42501';
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a6', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'remove', 0, 'cost_price')$$) = '42501';
-- admin van P met een product van Q in de selectie: geweigerd (bestaande tenantcheck)
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a1', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2','52520000-0000-0000-0000-0000000000f1']::uuid[], 'exact', 1, 'price')$$) = '42501';
-- service role (geen sub): ok
select pg_temp.as_jwt_role('service_role', $$select public.bulk_adjust_prices(array['51510000-0000-0000-0000-0000000000f2']::uuid[], 'add', 1, 'price')$$) = 'ok';
-- uitkomst: Pasta 8 +1 (admin) +1 (service) = 10, kostprijs 2, was-prijs = prijs op dat moment (9); Kebab onaangeroerd
select price = 10 and cost_price = 2 and compare_at_price = 9 from public.products where id = '51510000-0000-0000-0000-0000000000f2';
select price = 9 from public.products where id = '52520000-0000-0000-0000-0000000000f1';

-- 4. De definer-RPC kaart_bulk_update (admin/staff) wijzigt prijzen nog altijd met de guard actief -----
select pg_temp.as_user('51500000-0000-0000-0000-0000000000a2', $$select public.kaart_bulk_update('51515151-0000-0000-0000-000000000001', array['51510000-0000-0000-0000-0000000000f2']::uuid[], '{"price":{"mode":"set","value":"11"}}'::jsonb)$$) = 'ok';
select price = 11 from public.products where id = '51510000-0000-0000-0000-0000000000f2';
rollback;

-- Opruimen (de transactie hierboven rolde alles terug; trigger en testdata weg)
drop trigger trg_guard_product_commercial_fields on public.products;
revoke update on public.products, public.product_variants from anon;
delete from public.product_variants where id = '51519999-0000-0000-0000-0000000000f1';
delete from public.products where tenant_id in ('51515151-0000-0000-0000-000000000001','52525252-0000-0000-0000-000000000001');
delete from public.user_roles where user_id::text like '5150000%';
delete from public.tenants where id in ('51515151-0000-0000-0000-000000000001','52525252-0000-0000-0000-000000000001');
\echo PRIJS-GATEN-1: alle tests geslaagd

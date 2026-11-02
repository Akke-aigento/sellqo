\set ON_ERROR_STOP 1
-- PRIJS-GATEN-2 — rol-impersonatie op de voorraad-RPC's (record_stock_movement, increment_stock,
-- bulk_adjust_stock), het tenantlek in record_stock_movement en de POS-verkoop via de trigger.
-- Eigen zaken V (5353…) en W (5454…). Elke regel moet 't' geven (run.sh faalt op ' f').
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
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
create or replace function pg_temp.as_service(p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
  r := pg_temp.try(p_sql);
  execute 'reset role';
  perform set_config('request.jwt.claim.role', '', true);
  return r;
end $$;

reset role;
insert into public.tenants (id, name) values
  ('53535353-0000-0000-0000-000000000001', 'Zaak V'), ('54545454-0000-0000-0000-000000000001', 'Zaak W')
  on conflict (id) do nothing;
delete from public.user_roles where user_id::text like '5350000%';
insert into public.user_roles (user_id, role, tenant_id) values
  ('53500000-0000-0000-0000-0000000000a1', 'tenant_admin', '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a2', 'staff',        '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a3', 'warehouse',    '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a4', 'marketing',    '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a5', 'viewer',       '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a6', 'accountant',   '53535353-0000-0000-0000-000000000001'),
  ('53500000-0000-0000-0000-0000000000a7', 'platform_admin', null),
  ('53500000-0000-0000-0000-0000000000b1', 'tenant_admin', '54545454-0000-0000-0000-000000000001');
insert into public.products (id, tenant_id, name, slug, price, stock, track_inventory) values
  ('53530000-0000-0000-0000-0000000000f1', '53535353-0000-0000-0000-000000000001', 'Bier', 'pg2-bier', 3, 100, true),
  ('54540000-0000-0000-0000-0000000000f1', '54545454-0000-0000-0000-000000000001', 'Wijn', 'pg2-wijn', 5, 50, true);
insert into public.product_variants (id, product_id, tenant_id, title, price, stock, track_inventory) values
  ('53539999-0000-0000-0000-0000000000f1', '53530000-0000-0000-0000-0000000000f1', '53535353-0000-0000-0000-000000000001', '33cl', 3, 20, true),
  ('54549999-0000-0000-0000-0000000000f1', '54540000-0000-0000-0000-0000000000f1', '54545454-0000-0000-0000-000000000001', 'Fles', 5, 10, true);

begin;
-- 1. record_stock_movement op een product ---------------------------------------------------------------
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, 1, 'manual')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a2', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, 1, 'manual')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a3', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, 1, 'manual')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a7', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, 1, 'manual')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a4', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, -50, 'manual')$$) = '42501';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a5', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, -50, 'manual')$$) = '42501';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a6', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, -50, 'manual')$$) = '42501';
-- een beheerder van een andere zaak: de bestaande lidmaatschapscheck (P0001)
select pg_temp.as_user('53500000-0000-0000-0000-0000000000b1', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, -50, 'manual')$$) = 'P0001';
select stock = 104 from public.products where id = '53530000-0000-0000-0000-0000000000f1';

-- 2. variant ---------------------------------------------------------------------------------------------
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a3', $$select public.record_stock_movement(null, null, '53539999-0000-0000-0000-0000000000f1', 5, 'manual')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a5', $$select public.record_stock_movement(null, null, '53539999-0000-0000-0000-0000000000f1', -5, 'manual')$$) = '42501';
select stock = 25 from public.product_variants where id = '53539999-0000-0000-0000-0000000000f1';

-- 3. tenantlek: p_tenant_id of product_id van de beller wordt niet meer blind overgenomen --------------
-- eigen winkel opgeven, product van W: vroeger 'ok' (voorraad van W gewijzigd), nu 42501
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement('53535353-0000-0000-0000-000000000001', '54540000-0000-0000-0000-0000000000f1', null, -40, 'manual')$$) = '42501';
-- eigen winkel opgeven, variant van W
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement('53535353-0000-0000-0000-000000000001', null, '54549999-0000-0000-0000-0000000000f1', -9, 'manual')$$) = '42501';
-- eigen product + variant van W: vroeger werd de variant van W gewijzigd, nu 22023
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', '54549999-0000-0000-0000-0000000000f1', -9, 'manual')$$) = '22023';
-- zonder p_tenant_id: tenant komt van het product → lidmaatschapscheck weigert (P0001)
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement(null, '54540000-0000-0000-0000-0000000000f1', null, -40, 'manual')$$) = 'P0001';
select (select stock from public.products where id = '54540000-0000-0000-0000-0000000000f1') = 50
   and (select stock from public.product_variants where id = '54549999-0000-0000-0000-0000000000f1') = 10;
-- met de juiste p_tenant_id blijft het werken
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.record_stock_movement('53535353-0000-0000-0000-000000000001', '53530000-0000-0000-0000-0000000000f1', null, 1, 'manual')$$) = 'ok';

-- 4. increment_stock (inkooporders) en decrement_stock --------------------------------------------------
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a3', $$select public.increment_stock('53530000-0000-0000-0000-0000000000f1', 10, 'purchase')$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a5', $$select public.increment_stock('53530000-0000-0000-0000-0000000000f1', 10, 'purchase')$$) = '42501';
-- decrement_stock is niet aanroepbaar voor authenticated (bestaande grant)
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.decrement_stock('53530000-0000-0000-0000-0000000000f1', 1)$$) = '42501';
-- service role (storefront-api, stripe-webhook, sync-bol-orders): ongewijzigd
select pg_temp.as_service($$select public.decrement_stock('53530000-0000-0000-0000-0000000000f1', 2)$$) = 'ok';
select pg_temp.as_service($$select public.record_stock_movement(null, '54540000-0000-0000-0000-0000000000f1', null, -1, 'sale')$$) = 'ok';
-- postgres zonder JWT (cron, migraties)
select pg_temp.try($$select public.record_stock_movement(null, '53530000-0000-0000-0000-0000000000f1', null, -1, 'adjustment')$$) = 'ok';
select stock = 112 from public.products where id = '53530000-0000-0000-0000-0000000000f1';

-- 5. POS-verkoop via de trigger (staff): voorraad daalt nog altijd ---------------------------------------
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a2', $$insert into public.pos_transactions (tenant_id, terminal_id, cashier_id, status, items) values ('53535353-0000-0000-0000-000000000001', gen_random_uuid(), '53500000-0000-0000-0000-0000000000a2', 'completed', '[{"product_id":"53530000-0000-0000-0000-0000000000f1","quantity":3}]')$$) = 'ok';
select stock = 109 from public.products where id = '53530000-0000-0000-0000-0000000000f1';
select count(*) = 1 from public.stock_movements where product_id = '53530000-0000-0000-0000-0000000000f1' and reason = 'sale' and delta = -3
   and created_by = '53500000-0000-0000-0000-0000000000a2';

-- 6. bulk_adjust_stock ------------------------------------------------------------------------------------
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'add', 1)$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a2', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'add', 1)$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a3', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'add', 1)$$) = 'ok';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a4', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'exact', 0)$$) = '42501';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a5', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'exact', 0)$$) = '42501';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a6', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'exact', 0)$$) = '42501';
select pg_temp.as_user('53500000-0000-0000-0000-0000000000a1', $$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1','54540000-0000-0000-0000-0000000000f1']::uuid[], 'exact', 0)$$) = '42501';
select pg_temp.as_service($$select public.bulk_adjust_stock(array['53530000-0000-0000-0000-0000000000f1']::uuid[], 'add', 1)$$) = 'ok';
select stock = 113 from public.products where id = '53530000-0000-0000-0000-0000000000f1';
select stock = 49 from public.products where id = '54540000-0000-0000-0000-0000000000f1';
-- elke geslaagde boeking staat in het logboek met de juiste winkel
select count(*) = 0 from public.stock_movements m join public.products p on p.id = m.product_id where m.tenant_id <> p.tenant_id;
rollback;

reset role;
delete from public.product_variants where id in ('53539999-0000-0000-0000-0000000000f1', '54549999-0000-0000-0000-0000000000f1');
delete from public.products where tenant_id in ('53535353-0000-0000-0000-000000000001', '54545454-0000-0000-0000-000000000001');
delete from public.user_roles where user_id::text like '5350000%';
delete from public.tenants where id in ('53535353-0000-0000-0000-000000000001', '54545454-0000-0000-0000-000000000001');
\echo PRIJS-GATEN-2: alle tests geslaagd

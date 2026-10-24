\set ON_ERROR_STOP 1
-- KASSA-0.6 — product snel aanpassen op de kassa, met PIN van eigenaar/verantwoordelijke.
-- Zaak B (2222…) uit test_tafel3.sql: Els = eigenaar (…b1), Tom = ober (…b2); Pils (…b2) kost 2,80.
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
update public.pos_cashiers set pin_hash = crypt('1234', gen_salt('bf')) where id in ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000b2');
select count(*) as audit_before from public.fiscal_audit_log where action = 'kassa_product_edit' \gset
create or replace function pg_temp.edit(p jsonb) returns jsonb language sql as $$ select public.kassa_product_quick_edit('22222222-2222-2222-2222-222222222222', 'dev-b', p) $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Ober als goedkeurder: geweigerd, ook met zijn juiste PIN.
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b2","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"3.00"}')$$) = '42501';
-- Verkeerde PIN: niets gewijzigd, poging geteld en in het spoor.
select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"9999","staff_id":"99999999-0000-0000-0000-0000000000b2","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"3.00"}') ->> 'reason' = 'wrong_pin';
select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"3.00"}') ->> 'reason' = 'wrong_pin';
reset role;
select price = 2.80 from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2';
select failed_pin_attempts = 2 from public.pos_cashiers where id = '99999999-0000-0000-0000-0000000000b1';
select count(*) >= 2 from public.fiscal_audit_log where action = 'pin_failed' and details ->> 'context' = 'product_edit';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Ober start, eigenaar keurt goed met PIN: prijs.
select (pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","staff_id":"99999999-0000-0000-0000-0000000000b2","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"3.10"}') ->> 'price')::numeric = 3.10;
-- Op voor vandaag.
select (pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","sold_out":true}') ->> 'sold_out_until') is not null;
reset role;
select price = 3.10 and sold_out_until > now() from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2';
select failed_pin_attempts = 0 from public.pos_cashiers where id = '99999999-0000-0000-0000-0000000000b1';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Terug te koop; daarna geen wijziging = geen audit-regel.
select (pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","sold_out":false}') ->> 'sold_out_until') is null;
select (pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"3.1"}') ->> 'price')::numeric = 3.10;
-- Weigeringen: prijs, leeg, product van een andere zaak, onbekende goedkeurder, andere zaak.
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"-1"}')$$) = '22023';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2"}')$$) = '22023';
select pg_temp.try(format($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"%s","price":"1"}')$$,
  (select id from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' limit 1))) = '22023';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-00000000dead","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '22023';
select pg_temp.try($$select public.kassa_product_quick_edit('33333333-3333-3333-3333-333333333333','dev-b','{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '42501';
-- Goedkeurder van een andere zaak (echte eigenaar van zaak K) en een inactieve of kassaloze eigenaar: geweigerd.
reset role;
insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash, role) values
 ('99999999-0000-0000-0000-0000000000c1','33333333-3333-3333-3333-333333333333','Eigenaar K', crypt('1234', gen_salt('bf')), 'owner'),
 ('99999999-0000-0000-0000-0000000000b8','22222222-2222-2222-2222-222222222222','Oud-eigenaar', crypt('1234', gen_salt('bf')), 'owner'),
 ('99999999-0000-0000-0000-0000000000b9','22222222-2222-2222-2222-222222222222','Boekhouder', crypt('1234', gen_salt('bf')), 'owner');
update public.pos_cashiers set is_active = false where id = '99999999-0000-0000-0000-0000000000b8';
update public.pos_cashiers set can_use_pos = false where id = '99999999-0000-0000-0000-0000000000b9';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000c1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '22023';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b8","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '22023';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b9","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '22023';
-- Vijf foute PIN's: 5 minuten slot, ook met de juiste PIN daarna.
select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"0000","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}') ->> 'reason' from generate_series(1,4);
select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"0000","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}') ->> 'reason' = 'locked';
select pg_temp.try($$select pg_temp.edit('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","price":"1"}')$$) = '28000';
reset role;
select price = 3.10 from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2';
-- Drie echte wijzigingen = drie audit-regels, met goedkeurder, starter en oude/nieuwe prijs.
select count(*) = :audit_before + 3 from public.fiscal_audit_log where action = 'kassa_product_edit';
select (details ->> 'old_price')::numeric = 2.80 and (details ->> 'new_price')::numeric = 3.10
   and details ->> 'approver_id' = '99999999-0000-0000-0000-0000000000b1' and details ->> 'staff_id' = '99999999-0000-0000-0000-0000000000b2' and device_id = 'dev-b'
  from public.fiscal_audit_log where action = 'kassa_product_edit' and details ? 'new_price' order by created_at limit 1;
select pg_temp.try($$delete from public.fiscal_audit_log where action = 'kassa_product_edit'$$) <> 'ok';
update public.pos_cashiers set locked_until = null, failed_pin_attempts = 0 where id = '99999999-0000-0000-0000-0000000000b1';
\echo KASSA-0.6: alle tests geslaagd

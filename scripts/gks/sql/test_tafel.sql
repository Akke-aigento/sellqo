\set ON_ERROR_STOP 1
insert into public.tenants (id, name, business_modules) values ('11111111-1111-1111-1111-111111111111','Horeca A','{horeca}'), ('33333333-3333-3333-3333-333333333333','Horeca C','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','staff','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000005','tenant_admin','33333333-3333-3333-3333-333333333333'),
 ('aaaaaaaa-0000-0000-0000-000000000003','viewer','11111111-1111-1111-1111-111111111111');
insert into public.vat_rates (id, tenant_id, rate, is_default) values ('cccccccc-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111',21,true), ('cccccccc-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111',12,false);
insert into public.categories (id, tenant_id, name) values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Dranken'), ('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Hoofdgerechten');
insert into public.products (id, tenant_id, name, price, category_id, vat_rate_id) values
 ('eeeeeeee-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cola',3.04,'dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000021'),
 ('eeeeeeee-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Burger',28,'dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000012'),
 ('eeeeeeee-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','Vreemd',1,null,null);
insert into public.product_addon_groups (id, tenant_id, name, category_ids) values ('ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Saus','{dddddddd-0000-0000-0000-000000000002}');
insert into public.product_addon_options (id, group_id, tenant_id, name, price) values
 ('ffffffff-0000-0000-0000-0000000000a1','ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Mayonaise',2.5),
 ('ffffffff-0000-0000-0000-0000000000a2','ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ketchup',0);
insert into public.dining_tables (id, tenant_id, label) values ('77777777-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','B1'), ('77777777-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','B2'), ('77777777-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','X1');
insert into public.prep_stations (id, tenant_id, name, kind, is_default) values ('88888888-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Keuken','kitchen',true), ('88888888-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Bar','bar',false);
insert into public.prep_station_routes (tenant_id, station_id, category_id) values ('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001');
insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash) values ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Jan','x');

create or replace function pg_temp.apply(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'dev', cmds) $$;
create or replace function pg_temp.ok(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- open tafel B1, 2 cola + 1 burger met mayo en ketchup
select pg_temp.ok(pg_temp.apply('[
 {"id":"10000000-0000-0000-0000-000000000001","kind":"open_check","check_id":"c0000000-0000-0000-0000-000000000001","table_id":"77777777-0000-0000-0000-000000000001","staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"10000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":2},
 {"id":"10000000-0000-0000-0000-000000000003","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"addon_ids":["ffffffff-0000-0000-0000-0000000000a1","ffffffff-0000-0000-0000-0000000000a2"]}
]'::jsonb)) as ok_open_and_add;
select unit_price_cents = 304 and vat_label = 'A' and station_id = '88888888-0000-0000-0000-000000000002' as ok_cola_price_vat_bar from public.check_lines where id = 'a0000000-0000-0000-0000-000000000001';
select unit_price_cents = 2800 and vat_label = 'B' and jsonb_array_length(addons) = 2 and (addons -> 0 ->> 'price_cents')::int = 250 and station_id = '88888888-0000-0000-0000-000000000001' as ok_burger from public.check_lines where id = 'a0000000-0000-0000-0000-000000000002';
-- idempotent: zelfde commando nog eens = duplicate, geen tweede lijn
select (pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000009","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":2}]') -> 'results' -> 0 ->> 'duplicate')::boolean as ok_duplicate;
select count(*) = 2 as ok_two_lines from public.check_lines;
-- product van een andere zaak, extra die niet bij dit product hoort, tafel bezet: geweigerd, rest gaat door
select r -> 'results' -> 0 ->> 'ok' = 'false' and r -> 'results' -> 1 ->> 'ok' = 'false' and r -> 'results' -> 2 ->> 'ok' = 'false' and r -> 'results' -> 3 ->> 'ok' = 'true' as ok_rejections
from (select pg_temp.apply('[
 {"id":"10000000-0000-0000-0000-000000000004","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000003","product_id":"eeeeeeee-0000-0000-0000-000000000003","qty":1},
 {"id":"10000000-0000-0000-0000-000000000005","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000004","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":1,"addon_ids":["ffffffff-0000-0000-0000-0000000000a1"]},
 {"id":"10000000-0000-0000-0000-000000000006","kind":"open_check","check_id":"c0000000-0000-0000-0000-000000000002","table_id":"77777777-0000-0000-0000-000000000001"},
 {"id":"10000000-0000-0000-0000-000000000007","kind":"change_qty","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","qty":3}
]'::jsonb) r) x;
-- ronde versturen: 2 keukenbonnen (bar + keuken), lijnen verstuurd
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000008","kind":"send_round","check_id":"c0000000-0000-0000-0000-000000000001","round_id":"b0000000-0000-0000-0000-000000000001","line_ids":["a0000000-0000-0000-0000-000000000001","a0000000-0000-0000-0000-000000000002"],"staff_id":"99999999-0000-0000-0000-000000000001"}]')) as ok_send;
reset role;
select count(*) = 2 and bool_and(source = 'table' and table_label = 'B1' and service_type = 'eat_in' and total is null) as ok_kitchen_tickets from public.kitchen_tickets;
select not (items::text ~ 'price') as ok_no_amounts_on_kitchen from public.kitchen_tickets;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- verstuurde lijn kan niet meer gewijzigd worden; annuleren = negatieve CORRECTION-lijn
select (pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000009","kind":"change_qty","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","qty":1}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_sent_immutable;
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000010","kind":"void_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","new_line_id":"a0000000-0000-0000-0000-000000000005","qty":1,"reason":"mistake"}]')) as ok_void_sent;
select qty = -1 and neg_reason = 'CORRECTION' and state = 'draft' and corrects_line_id = 'a0000000-0000-0000-0000-000000000001' as ok_correction from public.check_lines where id = 'a0000000-0000-0000-0000-000000000005';
reset role; select public.horeca_open_qty('a0000000-0000-0000-0000-000000000001') = 2 as ok_open_qty_after_void; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- te veel annuleren = geweigerd
select (pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000011","kind":"void_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","new_line_id":"a0000000-0000-0000-0000-000000000006","qty":3,"reason":"mistake"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_overvoid_rejected;
-- korting op de burger (verstuurd): tegenboeking + nieuwe lijn met -10 %
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000012","kind":"discount_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","neg_line_id":"a0000000-0000-0000-0000-000000000007","new_line_id":"a0000000-0000-0000-0000-000000000008","percent":10,"name":"10%"}]')) as ok_discount;
select (select qty from public.check_lines where id='a0000000-0000-0000-0000-000000000007') = -1
   and (select neg_reason from public.check_lines where id='a0000000-0000-0000-0000-000000000007') = 'PRICE_CHANGE'
   and (select (price_changes -> 0 ->> 'amount_cents')::int from public.check_lines where id='a0000000-0000-0000-0000-000000000008') = -280
   and (select (price_changes -> 0 ->> 'grouping_id')::int from public.check_lines where id='a0000000-0000-0000-0000-000000000008') = 1 as ok_discount_lines;
-- tweede korting op het origineel = geweigerd; ongedaan maken van de nieuwe lijn = hele paar weg
select (pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000013","kind":"discount_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","neg_line_id":"a0000000-0000-0000-0000-00000000000a","new_line_id":"a0000000-0000-0000-0000-00000000000b","percent":10}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_no_double_discount;
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000014","kind":"void_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000008","reason":"mistake"}]')) as ok_undo_discount;
select count(*) = 2 as ok_pair_voided from public.check_lines where id in ('a0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000008') and state = 'void';
reset role; select public.horeca_open_qty('a0000000-0000-0000-0000-000000000002') = 1 as ok_burger_open_again; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- meer dan 100 % = geweigerd
select (pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000015","kind":"discount_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","neg_line_id":"a0000000-0000-0000-0000-00000000000c","new_line_id":"a0000000-0000-0000-0000-00000000000d","amount_cents":2801}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_max_100pct;
-- ronde 2 (de annulering), dan voorrekening
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000016","kind":"send_round","check_id":"c0000000-0000-0000-0000-000000000001","round_id":"b0000000-0000-0000-0000-000000000002"},{"id":"10000000-0000-0000-0000-000000000017","kind":"request_bill","check_id":"c0000000-0000-0000-0000-000000000001"}]')) as ok_round2_and_bill;
-- splitsen: 1 cola naar een nieuwe rekening op tafel B2 (eigen reference)
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000018","kind":"move_lines","check_id":"c0000000-0000-0000-0000-000000000001","to_check_id":"c0000000-0000-0000-0000-000000000003","to_table_id":"77777777-0000-0000-0000-000000000002","moves":[{"line_id":"a0000000-0000-0000-0000-000000000001","qty":1,"from_line_id":"a0000000-0000-0000-0000-000000000011","to_line_id":"a0000000-0000-0000-0000-000000000012"}]}]')) as ok_split;
select (select qty from public.check_lines where id='a0000000-0000-0000-0000-000000000011') = -1 and (select neg_reason from public.check_lines where id='a0000000-0000-0000-0000-000000000011') = 'COST_CENTER_CHANGE'
   and (select check_id from public.check_lines where id='a0000000-0000-0000-0000-000000000012') = 'c0000000-0000-0000-0000-000000000003'
   and (select cost_center_reference from public.dining_checks where id='c0000000-0000-0000-0000-000000000003') = 'c0000000-0000-0000-0000-000000000003' as ok_split_lines;
-- samenvoegen: alles van B1 naar de rekening van B2 → B1 sluit, B2 houdt haar reference
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000019","kind":"move_lines","check_id":"c0000000-0000-0000-0000-000000000001","to_check_id":"c0000000-0000-0000-0000-000000000003","moves":[
  {"line_id":"a0000000-0000-0000-0000-000000000001","from_line_id":"a0000000-0000-0000-0000-000000000013","to_line_id":"a0000000-0000-0000-0000-000000000014"},
  {"line_id":"a0000000-0000-0000-0000-000000000002","from_line_id":"a0000000-0000-0000-0000-000000000015","to_line_id":"a0000000-0000-0000-0000-000000000016"}]}]')) as ok_merge;
select (select status from public.dining_checks where id='c0000000-0000-0000-0000-000000000001') = 'closed' as ok_source_closed;
select (select sum(qty) from public.check_lines where check_id='c0000000-0000-0000-0000-000000000003' and state <> 'void') = 3 as ok_target_has_cola_and_burger;
-- verstuurde lijnen: nooit wijzigen of wissen, ook niet rechtstreeks (geen recht; trigger)
do $$ begin update public.check_lines set qty = 5; raise exception 'FOUT: update'; exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin delete from public.check_lines where state = 'sent'; raise exception 'FOUT: owner delete'; exception when insufficient_privilege then null; end $$;
do $$ begin update public.check_lines set qty = 5 where state = 'sent'; raise exception 'FOUT: owner update'; exception when insufficient_privilege then null; end $$;
-- viewer en vreemde zaak: geen toegang; snapshot enkel eigen zaak
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin perform public.horeca_apply('11111111-1111-1111-1111-111111111111', 'x', '[]'); raise exception 'FOUT: viewer'; exception when insufficient_privilege then null; end $$;
select jsonb_array_length(public.horeca_snapshot('11111111-1111-1111-1111-111111111111') -> 'checks') = 1 as ok_viewer_reads_snapshot;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
do $$ begin perform public.horeca_apply('11111111-1111-1111-1111-111111111111', 'x', '[]'); raise exception 'FOUT: vreemde tenant'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.horeca_snapshot('11111111-1111-1111-1111-111111111111'); raise exception 'FOUT: vreemde snapshot'; exception when insufficient_privilege then null; end $$;
select count(*) = 0 as ok_foreign_no_rows from public.check_lines;
-- vreemde tafel openen vanuit eigen zaak C = geweigerd (tafel van A)
select (public.horeca_apply('33333333-3333-3333-3333-333333333333', 'x', '[{"id":"20000000-0000-0000-0000-000000000001","kind":"open_check","check_id":"c0000000-0000-0000-0000-000000000009","table_id":"77777777-0000-0000-0000-000000000001"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_foreign_table;
reset role; set role anon;
do $$ begin perform public.horeca_snapshot('11111111-1111-1111-1111-111111111111'); raise exception 'FOUT: anon'; exception when insufficient_privilege then null; end $$;
reset role;
select version > 0 as ok_version_bumped from public.horeca_state where tenant_id = '11111111-1111-1111-1111-111111111111';
\echo 'TAFEL-1: alle tests geslaagd'

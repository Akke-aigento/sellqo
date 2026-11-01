-- KEUKEN-VEILIG-1 — controleert 20261101230200_keuken_veilig_1.sql (QR-opmerking op elke bon, allergenen, set_note
-- behoudt de gang). Niet in run.sh (die stopt bij kaart_3). Draaien: SETUP_ONLY=1 DB=x run.sh, dan
-- product_addon_options.allergens + een minimale table_requests aanmaken (zie de migratie), de migratie
-- draaien en dit bestand: elke regel moet t geven.
\set ON_ERROR_STOP 1
insert into public.tenants (id, name, business_modules) values ('11111111-1111-1111-1111-111111111111','Horeca A','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values ('aaaaaaaa-0000-0000-0000-000000000001','staff','11111111-1111-1111-1111-111111111111') on conflict do nothing;
insert into public.vat_rates (id, tenant_id, rate, is_default) values ('cccccccc-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111',21,true) on conflict do nothing;
insert into public.categories (id, tenant_id, name) values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Dranken'), ('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Hoofd') on conflict do nothing;
insert into public.products (id, tenant_id, name, price, category_id, vat_rate_id, allergens) values
 ('eeeeeeee-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cola',3,'dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000021','{}'),
 ('eeeeeeee-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Burger',20,'dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000021','{gluten,sesame}') on conflict do nothing;
insert into public.product_addon_groups (id, tenant_id, name, category_ids) values ('ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Saus','{dddddddd-0000-0000-0000-000000000002}') on conflict do nothing;
insert into public.product_addon_options (id, group_id, tenant_id, name, price, allergens) values ('ffffffff-0000-0000-0000-0000000000a1','ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Mayo',1,'{eggs,gluten}') on conflict do nothing;
insert into public.dining_tables (id, tenant_id, label) values ('77777777-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','B1') on conflict do nothing;
insert into public.prep_stations (id, tenant_id, name, kind, is_default) values ('88888888-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Keuken','kitchen',true), ('88888888-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Bar','bar',false) on conflict do nothing;
insert into public.prep_station_routes (tenant_id, station_id, category_id) values ('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001');
insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash) values ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Jan','x') on conflict do nothing;
create or replace function pg_temp.apply(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'dev', cmds) $$;
create or replace function pg_temp.ok(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- QR-aanvraag nagebootst: cola (bar) met de gastopmerking op lijn 1, burger (keuken) zonder
select pg_temp.ok(pg_temp.apply('[
 {"id":"10000000-0000-0000-0000-000000000001","kind":"open_check","check_id":"c0000000-0000-0000-0000-000000000001","table_id":"77777777-0000-0000-0000-000000000001","staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"10000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":1,"note":"QR Ann · allergie noten"},
 {"id":"10000000-0000-0000-0000-000000000003","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"course":2,"addon_ids":["ffffffff-0000-0000-0000-0000000000a1"]},
 {"id":"10000000-0000-0000-0000-000000000004","kind":"set_note","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","note":"zonder ui"}
]'::jsonb)) as ok_add;
reset role;
select course = 2 and note = 'zonder ui' as ok_set_note_keeps_course from public.check_lines where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.table_requests (id, tenant_id, check_id, status, guest_name, note, line_ids, decided_at) values
 ('12000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c0000000-0000-0000-0000-000000000001','accepted','Ann','allergie noten','{a0000000-0000-0000-0000-000000000001,a0000000-0000-0000-0000-000000000002}', now());
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000005","kind":"set_note","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000002","note":"zonder ui","course":3}]')) as ok_set_note_course;
reset role;
select course = 3 as ok_set_note_explicit_course from public.check_lines where id = 'a0000000-0000-0000-0000-000000000002';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[{"id":"10000000-0000-0000-0000-000000000008","kind":"send_round","check_id":"c0000000-0000-0000-0000-000000000001","round_id":"b0000000-0000-0000-0000-000000000001","line_ids":["a0000000-0000-0000-0000-000000000001","a0000000-0000-0000-0000-000000000002"],"staff_id":"99999999-0000-0000-0000-000000000001"}]')) as ok_send;
reset role;
select count(*) = 2 and bool_and(note = 'QR Ann · allergie noten') as ok_note_on_every_ticket from public.kitchen_tickets;
select items -> 0 -> 'allergens' = '["eggs", "gluten", "sesame"]'::jsonb as ok_allergens_union from public.kitchen_tickets where station_id = '88888888-0000-0000-0000-000000000001';
select items -> 0 -> 'allergens' = '[]'::jsonb as ok_allergens_empty from public.kitchen_tickets where station_id = '88888888-0000-0000-0000-000000000002';
-- ronde zonder QR-aanvraag: geen note
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[
 {"id":"10000000-0000-0000-0000-000000000011","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000001","line_id":"a0000000-0000-0000-0000-000000000011","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":1},
 {"id":"10000000-0000-0000-0000-000000000012","kind":"send_round","check_id":"c0000000-0000-0000-0000-000000000001","round_id":"b0000000-0000-0000-0000-000000000002","line_ids":["a0000000-0000-0000-0000-000000000011"],"staff_id":"99999999-0000-0000-0000-000000000001"}]')) as ok_send2;
reset role;
select note is null as ok_no_note_without_request from public.kitchen_tickets where round_id = 'b0000000-0000-0000-0000-000000000002';
select public.horeca_line_allergens(null, '[{"option_id":"nope"}]'::jsonb) = '[]'::jsonb as ok_helper_bad_input;

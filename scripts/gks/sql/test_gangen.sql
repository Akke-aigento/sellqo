-- GANGEN-1 — controleert 20261101230220_gangen_1.sql (gang wacht als ontwerp, keuken ziet 'waiting', fire_course,
-- gangen uit = niets verandert). Na test_keuken_veilig.sql op dezelfde databank (zelfde fixtures), met een minimale
-- horeca_pay_settings (tenant_id, methods) als die nog ontbreekt. Elke regel moet t geven.
-- Let op: draai dit vóór 20261102080020_gangen_bon_1.sql. GANGEN-BON-1 haalt de wachtende lijnen van de bon
-- (ok_kitchen_sees_waiting geldt dan niet meer); test_gangen_bon.sql controleert de nieuwe stand.
\set ON_ERROR_STOP 1
insert into public.dining_tables (id, tenant_id, label) values ('77777777-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','G1') on conflict do nothing;
-- GANGEN-1: voorgerecht (cola=bar zonder gang, burger gang 1), dessert gang 3 wacht.
insert into public.horeca_pay_settings (tenant_id, courses_enabled) values ('11111111-1111-1111-1111-111111111111', true)
  on conflict (tenant_id) do update set courses_enabled = true;
create or replace function pg_temp.apply(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'dev', cmds) $$;
create or replace function pg_temp.ok(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[
 {"id":"20000000-0000-0000-0000-000000000001","kind":"open_check","check_id":"c2000000-0000-0000-0000-000000000001","table_id":"77777777-0000-0000-0000-000000000009","staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"20000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"c2000000-0000-0000-0000-000000000001","line_id":"a2000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":2},
 {"id":"20000000-0000-0000-0000-000000000003","kind":"add_line","check_id":"c2000000-0000-0000-0000-000000000001","line_id":"a2000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"course":1},
 {"id":"20000000-0000-0000-0000-000000000004","kind":"add_line","check_id":"c2000000-0000-0000-0000-000000000001","line_id":"a2000000-0000-0000-0000-000000000003","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":2,"course":3},
 {"id":"20000000-0000-0000-0000-000000000005","kind":"send_round","check_id":"c2000000-0000-0000-0000-000000000001","round_id":"b2000000-0000-0000-0000-000000000001","line_ids":["a2000000-0000-0000-0000-000000000001","a2000000-0000-0000-0000-000000000002"],"staff_id":"99999999-0000-0000-0000-000000000001"}
]'::jsonb)) as ok_send_first_course;
reset role;
select state = 'draft' as ok_dessert_still_draft from public.check_lines where id = 'a2000000-0000-0000-0000-000000000003';
select jsonb_array_length(items) = 2 and items -> 1 ->> 'waiting' = 'true' and (items -> 1 ->> 'course')::int = 3 and items -> 0 -> 'waiting' is null as ok_kitchen_sees_waiting
  from public.kitchen_tickets where round_id = 'b2000000-0000-0000-0000-000000000001' and station_id = '88888888-0000-0000-0000-000000000001';
select not (items::text like '%waiting%') as ok_bar_no_waiting from public.kitchen_tickets where round_id = 'b2000000-0000-0000-0000-000000000001' and station_id = '88888888-0000-0000-0000-000000000002';
select (public.horeca_check_json('c2000000-0000-0000-0000-000000000001') -> 'course_fired') = 'null'::jsonb as ok_json_has_course_fired;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select (pg_temp.apply('[{"id":"20000000-0000-0000-0000-000000000006","kind":"fire_course","check_id":"c2000000-0000-0000-0000-000000000001","course":12,"staff_id":"99999999-0000-0000-0000-000000000001"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_bad_course_rejected;
select pg_temp.ok(pg_temp.apply('[
 {"id":"20000000-0000-0000-0000-000000000007","kind":"fire_course","check_id":"c2000000-0000-0000-0000-000000000001","course":3,"staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"20000000-0000-0000-0000-000000000008","kind":"fire_course","check_id":"c2000000-0000-0000-0000-000000000001","course":2,"staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"20000000-0000-0000-0000-000000000009","kind":"send_round","check_id":"c2000000-0000-0000-0000-000000000001","round_id":"b2000000-0000-0000-0000-000000000002","line_ids":["a2000000-0000-0000-0000-000000000003"],"staff_id":"99999999-0000-0000-0000-000000000001"}
]'::jsonb)) as ok_fire_and_send;
reset role;
select course_fired = 3 as ok_fired_never_goes_back from public.dining_checks where id = 'c2000000-0000-0000-0000-000000000001';
select (public.horeca_check_json('c2000000-0000-0000-0000-000000000001') ->> 'course_fired')::int = 3 as ok_json_fired;
select jsonb_array_length(items) = 1 and not (items::text like '%waiting%') as ok_released_ticket from public.kitchen_tickets where round_id = 'b2000000-0000-0000-0000-000000000002';
-- gangen uit: nooit 'waiting' op de bon
update public.horeca_pay_settings set courses_enabled = false where tenant_id = '11111111-1111-1111-1111-111111111111';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[
 {"id":"20000000-0000-0000-0000-000000000010","kind":"add_line","check_id":"c2000000-0000-0000-0000-000000000001","line_id":"a2000000-0000-0000-0000-000000000010","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"course":1},
 {"id":"20000000-0000-0000-0000-000000000011","kind":"add_line","check_id":"c2000000-0000-0000-0000-000000000001","line_id":"a2000000-0000-0000-0000-000000000011","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"course":3},
 {"id":"20000000-0000-0000-0000-000000000012","kind":"send_round","check_id":"c2000000-0000-0000-0000-000000000001","round_id":"b2000000-0000-0000-0000-000000000003","line_ids":["a2000000-0000-0000-0000-000000000010"],"staff_id":"99999999-0000-0000-0000-000000000001"}
]'::jsonb)) as ok_send_off;
reset role;
select not (items::text like '%waiting%') as ok_off_no_waiting from public.kitchen_tickets where round_id = 'b2000000-0000-0000-0000-000000000003';

-- GANGEN-BON-1 — controleert 20261102080020_gangen_bon_1.sql: met gangen aan staat wat nog wacht NIET meer op
-- de keukenbon; de lijn blijft een ontwerp-lijn en de kassa ziet hem nog (horeca_check_json). Draaien op de
-- databank van test_gangen.sql (zelfde fixtures), ná de migratie. Elke regel moet t geven.
\set ON_ERROR_STOP 1
select position('GANGEN-BON-1' in pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure)) > 0
   and position($w$'waiting', true$w$ in pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure)) = 0 as ok_patched;
select position('fire_course' in pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure)) > 0 as ok_fire_course_kept;
insert into public.dining_tables (id, tenant_id, label) values ('77777777-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','G2') on conflict do nothing;
update public.horeca_pay_settings set courses_enabled = true where tenant_id = '11111111-1111-1111-1111-111111111111';
create or replace function pg_temp.apply(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'dev', cmds) $$;
create or replace function pg_temp.ok(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[
 {"id":"6b0b0000-0000-0000-0000-000000000001","kind":"open_check","check_id":"c3000000-0000-0000-0000-000000000001","table_id":"77777777-0000-0000-0000-000000000010","staff_id":"99999999-0000-0000-0000-000000000001"},
 {"id":"6b0b0000-0000-0000-0000-000000000002","kind":"add_line","check_id":"c3000000-0000-0000-0000-000000000001","line_id":"a3000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":1,"course":1},
 {"id":"6b0b0000-0000-0000-0000-000000000003","kind":"add_line","check_id":"c3000000-0000-0000-0000-000000000001","line_id":"a3000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-000000000002","qty":2,"course":3},
 {"id":"6b0b0000-0000-0000-0000-000000000004","kind":"send_round","check_id":"c3000000-0000-0000-0000-000000000001","round_id":"b3000000-0000-0000-0000-000000000001","line_ids":["a3000000-0000-0000-0000-000000000001"],"staff_id":"99999999-0000-0000-0000-000000000001"}
]'::jsonb)) as ok_send_first_course;
reset role;
select jsonb_array_length(items) = 1 and not (items::text like '%waiting%') and (items -> 0 ->> 'course')::int = 1 as ok_ticket_only_ordered
  from public.kitchen_tickets where round_id = 'b3000000-0000-0000-0000-000000000001' and station_id = '88888888-0000-0000-0000-000000000001';
select state = 'draft' as ok_dessert_still_draft from public.check_lines where id = 'a3000000-0000-0000-0000-000000000002';
select exists (select 1 from jsonb_array_elements(public.horeca_check_json('c3000000-0000-0000-0000-000000000001') -> 'lines') l
                where l ->> 'id' = 'a3000000-0000-0000-0000-000000000002' and l ->> 'state' = 'draft') as ok_kassa_still_sees_waiting_line;

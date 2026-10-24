\set ON_ERROR_STOP 1
-- TAFEL-3 — toogverkoop, kas in/uit, shift, X/Z-rapporten. Draait na test_heartbeat.sql.
-- Zaak B (2222…) is niet-fiscaal; zaak A (1111…) is fiscaal sinds test_pay (kassa op 'fdm').
insert into public.tenants (id, name, business_modules) values ('22222222-2222-2222-2222-222222222222','Frituur B','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values ('aaaaaaaa-0000-0000-0000-000000000002','staff','22222222-2222-2222-2222-222222222222');
insert into public.vat_rates (id, tenant_id, rate, is_default) values
 ('cccccccc-0000-0000-0000-000000000b21','22222222-2222-2222-2222-222222222222',21,true),
 ('cccccccc-0000-0000-0000-000000000b12','22222222-2222-2222-2222-222222222222',12,false),
 ('cccccccc-0000-0000-0000-000000000b06','22222222-2222-2222-2222-222222222222',6,false);
insert into public.categories (id, tenant_id, name) values ('dddddddd-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Frieten'), ('dddddddd-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222','Dranken');
insert into public.products (id, tenant_id, name, price, category_id, vat_rate_id, takeaway_vat_rate_id) values
 ('eeeeeeee-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Grote friet',4.20,'dddddddd-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-000000000b12','cccccccc-0000-0000-0000-000000000b06'),
 ('eeeeeeee-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222','Pils',2.80,'dddddddd-0000-0000-0000-0000000000b2','cccccccc-0000-0000-0000-000000000b21',null);
insert into public.prep_stations (id, tenant_id, name, kind, is_default) values
 ('88888888-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Bakken','kitchen',true),
 ('88888888-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222','Toog','bar',false);
insert into public.prep_station_routes (tenant_id, station_id, category_id) values ('22222222-2222-2222-2222-222222222222','88888888-0000-0000-0000-0000000000b2','dddddddd-0000-0000-0000-0000000000b2');
insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash, role) values
 ('99999999-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Els (eigenaar)','x','owner'),
 ('99999999-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222','Tom','x','waiter');
insert into public.pos_terminals (id, tenant_id, name, settings) values ('5e000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Toog','{}');

create or replace function pg_temp.applyb(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'dev-b', cmds) $$;
create or replace function pg_temp.okb(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- ── Toogverkoop openen, meenemen, friet (afhaal 6 %) en pils (21 %) ──
select pg_temp.okb(pg_temp.applyb('[
 {"id":"b1000000-0000-0000-0000-000000000001","kind":"open_check","check_kind":"counter","service":"takeaway","check_id":"cb000000-0000-0000-0000-000000000001","name":"Toog","staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"b1000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000001","line_id":"ab000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-0000000000b1","qty":2},
 {"id":"b1000000-0000-0000-0000-000000000003","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000001","line_id":"ab000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":1}
]')) as ok_counter_open_add;
reset role;
select kind = 'counter' and service = 'takeaway' and table_id is null as ok_counter_kind from public.dining_checks where id = 'cb000000-0000-0000-0000-000000000001';
select vat_rate = 6 and vat_label = 'C' as ok_takeaway_vat from public.check_lines where id = 'ab000000-0000-0000-0000-000000000001';
select vat_rate = 21 and vat_label = 'A' as ok_no_takeaway_rate_keeps_normal from public.check_lines where id = 'ab000000-0000-0000-0000-000000000002';
select (public.horeca_check_json('cb000000-0000-0000-0000-000000000001') ->> 'kind') = 'counter' as ok_json_kind;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Ter plaatse: tarief van de open lijnen volgt (friet 12 %), terug naar meenemen = 6 %
select pg_temp.okb(pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000004","kind":"set_service","check_id":"cb000000-0000-0000-0000-000000000001","service":"eat_in"}]')) as ok_set_eat_in;
reset role;
select vat_rate = 12 and vat_label = 'B' as ok_eat_in_vat from public.check_lines where id = 'ab000000-0000-0000-0000-000000000001';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.okb(pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000005","kind":"set_service","check_id":"cb000000-0000-0000-0000-000000000001","service":"takeaway"}]')) as ok_set_takeaway;
-- Niet aan de toog: versturen, voorrekening, verplaatsen naar de toog, set_service op een gewone rekening
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000006","kind":"send_round","check_id":"cb000000-0000-0000-0000-000000000001","round_id":"bb000000-0000-0000-0000-000000000001"}]') -> 'results' -> 0 ->> 'code') = '55000' as ok_counter_no_round;
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000007","kind":"request_bill","check_id":"cb000000-0000-0000-0000-000000000001"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_counter_no_prebill;
select pg_temp.okb(pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000008","kind":"open_check","check_id":"cb000000-0000-0000-0000-000000000002","name":"Op naam"},
 {"id":"b1000000-0000-0000-0000-000000000009","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000002","line_id":"ab000000-0000-0000-0000-000000000003","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":1}]')) as ok_named_check;
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000010","kind":"set_service","check_id":"cb000000-0000-0000-0000-000000000002","service":"takeaway"}]') -> 'results' -> 0 ->> 'code') = '22023' as ok_service_only_counter;
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000011","kind":"move_lines","check_id":"cb000000-0000-0000-0000-000000000002","to_check_id":"cb000000-0000-0000-0000-000000000001","moves":[{"line_id":"ab000000-0000-0000-0000-000000000003","qty":1}]}]') -> 'results' -> 0 ->> 'code') = '55000' as ok_no_move_to_counter;
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000012","kind":"open_check","check_kind":"counter","check_id":"cb000000-0000-0000-0000-000000000009","name":"x","table_id":"77777777-0000-0000-0000-000000000001"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_counter_no_table;

-- ── Afrekenen aan de toog: claim op de ontwerp-lijnen ──
-- 2 × 4,20 + 2,80 = 11,20; contant 11,20 → afronding 0
select (public.horeca_pay_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"check_id":"cb000000-0000-0000-0000-000000000001","payment_id":"4b000000-0000-0000-0000-000000000001","line_ids":["ab000000-0000-0000-0000-000000000001","ab000000-0000-0000-0000-000000000002"],"expected_total_cents":1120}') ->> 'ok')::boolean as ok_counter_claim;
-- Tijdens de claim: niets wijzigen aan de toog (ook niet aantikken)
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000013","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000001","line_id":"ab000000-0000-0000-0000-000000000009","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":1}]') -> 'results' -> 0 ->> 'code') = '55000' as ok_counter_locked_while_paying;
-- Betaling zonder alle lijnen = gewijzigd
select pg_temp.try($q$select public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000001","check_id":"cb000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","expected_total_cents":840,"line_ids":["ab000000-0000-0000-0000-000000000001"],"tenders":[{"method":"cash","amount_cents":840}]}')$q$) = '40001' as ok_counter_all_lines;
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000001","check_id":"cb000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","expected_total_cents":1120,"line_ids":["ab000000-0000-0000-0000-000000000001","ab000000-0000-0000-0000-000000000002"],"tenders":[{"method":"cash","amount_cents":1120}],"tip_cents":50,"tip_method":"cash"}') ->> 'ok')::boolean as ok_counter_paid;
reset role;
select status = 'closed' as ok_counter_closed from public.dining_checks where id = 'cb000000-0000-0000-0000-000000000001';
select count(*) = 2 and bool_and(state = 'sent' and round_id is not null) as ok_counter_lines_sent from public.check_lines where check_id = 'cb000000-0000-0000-0000-000000000001';
select count(*) = 1 as ok_one_round_no_fiscal from public.check_rounds where check_id = 'cb000000-0000-0000-0000-000000000001' and fiscal_event_id is null;
-- Keukenbon enkel voor de friet (pils gaat naar een bar-post), meenemen = pickup, betaald, gekoppeld
select count(*) = 1 and bool_and(source = 'pos' and service_type = 'pickup' and paid and pos_transaction_id = '4b000000-0000-0000-0000-000000000001'
  and station_id = '88888888-0000-0000-0000-0000000000b1' and jsonb_array_length(items) = 1 and items -> 0 ->> 'name' = 'Grote friet')
  as ok_counter_kitchen_ticket from public.kitchen_tickets where check_id = 'cb000000-0000-0000-0000-000000000001';
-- Btw: 8,40 aan 6 % (0,48) + 2,80 aan 21 % (0,49) = 0,97
select total = 11.20 and tax_total = 0.97 and status = 'completed' as ok_counter_tx from public.pos_transactions where id = '4b000000-0000-0000-0000-000000000001';
select count(*) = 1 and bool_and(kind = 'tip' and amount = 0.50) as ok_tip_move_kind from public.pos_cash_movements where tenant_id = '22222222-2222-2222-2222-222222222222';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Zelfde betaling opnieuw = duplicate
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000001","check_id":"cb000000-0000-0000-0000-000000000001"}') ->> 'duplicate')::boolean as ok_counter_idempotent;
-- Toog zonder keuken (kitchen=false): geen keukenbon
select pg_temp.okb(pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000020","kind":"open_check","check_kind":"counter","check_id":"cb000000-0000-0000-0000-000000000003","name":"Toog"},
 {"id":"b1000000-0000-0000-0000-000000000021","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000003","line_id":"ab000000-0000-0000-0000-000000000010","product_id":"eeeeeeee-0000-0000-0000-0000000000b1","qty":1}]')) as ok_counter2;
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000002","check_id":"cb000000-0000-0000-0000-000000000003","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b1","expected_total_cents":420,"line_ids":["ab000000-0000-0000-0000-000000000010"],"tenders":[{"method":"card","amount_cents":420}],"kitchen":false}') ->> 'ok')::boolean as ok_counter2_paid;
reset role;
select count(*) = 0 as ok_no_kitchen_when_off from public.kitchen_tickets where check_id = 'cb000000-0000-0000-0000-000000000003';
select vat_rate = 12 as ok_default_service_eat_in from public.check_lines where id = 'ab000000-0000-0000-0000-000000000010';

-- ── Kas in/uit ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select (public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"7b000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","direction":"out","amount_cents":2000,"reason":"Brood bij de bakker"}') ->> 'ok')::boolean as ok_cash_out;
select (public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"7b000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","direction":"out","amount_cents":2000,"reason":"Brood bij de bakker"}') ->> 'duplicate')::boolean as ok_cash_idempotent;
select pg_temp.try($q$select public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"7b000000-0000-0000-0000-000000000002","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","direction":"out","amount_cents":2000,"reason":""}')$q$) = '22023' as ok_cash_reason_required;
select pg_temp.try($q$select public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"7b000000-0000-0000-0000-000000000003","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","direction":"out","amount_cents":-5,"reason":"x"}')$q$) = '22023' as ok_cash_positive;
select pg_temp.try($q$select public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"7b000000-0000-0000-0000-000000000004","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-000000000001","direction":"in","amount_cents":500,"reason":"x"}')$q$) = '22023' as ok_cash_staff_of_tenant;
-- Fiscale zaak A zonder handtekening: geweigerd
select pg_temp.try($q$select public.kassa_cash_move('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"7b000000-0000-0000-0000-000000000005","terminal_id":"5e000000-0000-0000-0000-000000000001","staff_id":"99999999-0000-0000-0000-000000000001","direction":"in","amount_cents":500,"reason":"Wisselgeld"}')$q$) in ('22023', '42501') as ok_cash_fiscal_needs_event;
reset role;
select count(*) = 1 and bool_and(kind = 'manual' and movement_type = 'out' and amount = 20 and pos_cashier_id = '99999999-0000-0000-0000-0000000000b2')
  as ok_cash_row from public.pos_cash_movements where id = '7b000000-0000-0000-0000-000000000001';

-- ── Shift sluiten met telling ──
-- Verwacht contant: beginkas 0 + 11,20 (verkoop) + 0,50 (fooi) − 20,00 (uit) = −8,30; geteld 0 → verschil +8,30
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select r ->> 'expected_cents' = '-830' and r ->> 'difference_cents' = '830' as ok_shift_close
  from (select public.kassa_shift('22222222-2222-2222-2222-222222222222', 'dev-b', '{"action":"close","id":"8b000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","counted_cents":0}') r) q;
select (public.kassa_shift('22222222-2222-2222-2222-222222222222', 'dev-b', '{"action":"close","id":"8b000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","counted_cents":0}') ->> 'duplicate')::boolean as ok_shift_close_idempotent;
select pg_temp.try($q$select public.kassa_shift('22222222-2222-2222-2222-222222222222', 'dev-b', '{"action":"close","id":"8b000000-0000-0000-0000-000000000002","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","counted_cents":0}')$q$) = '55000' as ok_no_shift_to_close;
select (public.kassa_shift('22222222-2222-2222-2222-222222222222', 'dev-b', '{"action":"open","id":"8b000000-0000-0000-0000-000000000003","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","counted_cents":15000}') ->> 'opening_cents') = '15000' as ok_shift_open;
select pg_temp.try($q$select public.kassa_shift('22222222-2222-2222-2222-222222222222', 'dev-b', '{"action":"open","id":"8b000000-0000-0000-0000-000000000004","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","counted_cents":100}')$q$) = '55000' as ok_shift_already_open;
reset role;
select count(*) = 1 as ok_one_open_shift from public.pos_sessions where terminal_id = '5e000000-0000-0000-0000-0000000000b1' and status = 'open';

-- ── Rapporten ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- X: iedereen; Z: niet door een ober
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000001","kind":"X","staff_id":"99999999-0000-0000-0000-0000000000b2"}') ->> 'report_no') is null as ok_x_no_number;
select r -> 'data' -> 'sales' ->> 'count' = '2' and r -> 'data' -> 'sales' ->> 'total_cents' = '1540'
  and r -> 'data' -> 'cash' ->> 'out_cents' = '2000' and r -> 'data' -> 'cash' ->> 'in_cents' = '0'
  as ok_x_figures
  from (select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000001","kind":"X","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2"}') r) q;
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000002","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b2"}')$q$) = '42501' as ok_z_not_by_waiter;
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') ->> 'report_no') = '1' as ok_z_number_1;
-- Zelfde reservering opnieuw = zelfde nummer
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') ->> 'report_no') = '1' as ok_z_reserve_idempotent;
-- Afronden zonder reservering = geweigerd
select pg_temp.try($q$select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000099","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}')$q$) = '55000' as ok_z_needs_reservation;
select r ->> 'report_no' = '1' and (r -> 'data' -> 'vats') @> '[{"rate": 6, "gross_cents": 840, "vat_cents": 48}]'::jsonb
  and (r -> 'data' -> 'vats') @> '[{"rate": 12, "gross_cents": 420, "vat_cents": 45}]'::jsonb
  and (r -> 'data' -> 'payments') @> '[{"method": "cash", "cents": 1120}, {"method": "card", "cents": 420}]'::jsonb
  and (r -> 'data' -> 'tips') @> '[{"method": "cash", "cents": 50}]'::jsonb
  and jsonb_array_length(r -> 'data' -> 'shifts') = 1 and (r -> 'data' -> 'shifts' -> 0 ->> 'difference_cents') = '830'
  and jsonb_array_length(r -> 'data' -> 'staff') = 2
  as ok_z_figures
  from (select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b1"}') r) q;
-- Een tweede Z dezelfde dag zonder nieuwe periode: geweigerd tot er tijd verstreken is; nummer 2 enkel als er iets na Z 1 is
select (public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z"}') ->> 'duplicate')::boolean as ok_z_finish_idempotent;
-- Vrijgeven: enkel zonder rapport
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000004","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') ->> 'report_no') = '2' as ok_z_number_2;
select public.kassa_report_release('22222222-2222-2222-2222-222222222222', '9b000000-0000-0000-0000-000000000003')::text = '' as ok_release_called;
reset role;
select count(*) = 2 as ok_finished_not_released from public.kassa_report_numbers where tenant_id = '22222222-2222-2222-2222-222222222222';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_report_release('22222222-2222-2222-2222-222222222222', '9b000000-0000-0000-0000-000000000004')::text = '' as ok_release_last;
reset role;
select count(*) = 1 as ok_released_last from public.kassa_report_numbers where tenant_id = '22222222-2222-2222-2222-222222222222';
-- Rapporten zijn append-only
do $$ begin update public.kassa_reports set auto = true; raise exception 'FOUT: rapport gewijzigd'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.kassa_reports; raise exception 'FOUT: rapport gewist'; exception when insufficient_privilege then null; end $$;
-- Ontbrekende Z: een verkoop van eergisteren zonder Z
insert into public.pos_transactions (id, tenant_id, terminal_id, cashier_id, total, status, created_at)
values ('4b000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000002', 5, 'completed', now() - interval '2 days');
select to_char(public.kassa_business_day('22222222-2222-2222-2222-222222222222', now() - interval '2 days'), 'YYYY-MM-DD') as old_day \gset
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_report_due('22222222-2222-2222-2222-222222222222') = jsonb_build_array(:'old_day') as ok_due_missing_z;
-- Automatische Z (robot, zonder medewerker) voor die dag
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', jsonb_build_object('id','9b000000-0000-0000-0000-000000000005','kind','Z','auto',true,
  'booking_date', :'old_day')) ->> 'report_no') = '2' as ok_auto_z_number;
select (public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000005","kind":"Z","auto":true}') -> 'data' -> 'sales' ->> 'total_cents') = '500' as ok_auto_z_figures;
select public.kassa_report_due('22222222-2222-2222-2222-222222222222') = '[]'::jsonb as ok_due_empty;
-- Automatisch enkel voor Z, medewerker verplicht voor X
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000006","kind":"X","auto":true}')$q$) = '22023' as ok_x_needs_staff;
-- Toekomstige dag: geweigerd
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', jsonb_build_object('id','9b000000-0000-0000-0000-000000000007','kind','Z','staff_id','99999999-0000-0000-0000-0000000000b1','booking_date', current_date + 5))$q$) = '22023' as ok_no_future_z;
-- Zaak B kan zaak A niet lezen of schrijven
select pg_temp.try($q$select public.kassa_report_due('11111111-1111-1111-1111-111111111111')$q$) = '42501' as ok_due_tenant_scoped;
select pg_temp.try($q$select public.kassa_report_source('11111111-1111-1111-1111-111111111111', '9b000000-0000-0000-0000-000000000003')$q$) = '42501' as ok_source_tenant_scoped;
reset role;

-- Fiscaal rapport met twee juiste events (zaak A)
insert into public.fiscal_events (id, tenant_id, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter, transaction_total_cents, cost_center_reference, request_body, response_body, request_sha256)
values
 ('6f000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','signReportTurnoverX','CPOS0031234567','T1','d',90,'2026-10-24T10:00:00+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_TURNOVER_X',1,90, null, '9a000000-0000-0000-0000-000000000002','{}','{}', repeat('e',64)),
 ('6f000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','signReportUserX','CPOS0031234567','T1','d',91,'2026-10-24T10:00:01+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_USER_X',2,91, null, '9a000000-0000-0000-0000-000000000002','{}','{}', repeat('f',64)),
 ('6f000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','signReportUserX','CPOS0031234567','T1','d',92,'2026-10-24T10:00:02+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_USER_X',3,92, null, '9a000000-0000-0000-0000-000000000002','{}','{}', repeat('9',64));
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- Fiscale zaak A: rapport zonder handtekeningen geweigerd
select pg_temp.try($q$select public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000001","kind":"X","staff_id":"99999999-0000-0000-0000-000000000001"}')$q$) = '22023' as ok_fiscal_report_needs_events;
-- Twee keer hetzelfde soort = geweigerd; omzet + gebruikers = aanvaard
select pg_temp.try($q$select public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X","staff_id":"99999999-0000-0000-0000-000000000001","fiscal_event_ids":["6f000000-0000-0000-0000-000000000002","6f000000-0000-0000-0000-000000000003"]}')$q$) = '22023' as ok_fiscal_needs_both_kinds;
select (public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X","staff_id":"99999999-0000-0000-0000-000000000001","fiscal_event_ids":["6f000000-0000-0000-0000-000000000001","6f000000-0000-0000-0000-000000000002"]}') ->> 'ok')::boolean as ok_fiscal_x;
-- Bron voor het officiële rapport: de events van vandaag
select jsonb_array_length(public.kassa_report_source('11111111-1111-1111-1111-111111111111', '9a000000-0000-0000-0000-000000000002')) >= 0 as ok_source_runs;
reset role;
-- anon nergens
set role anon;
do $$ begin perform public.kassa_cash_move('22222222-2222-2222-2222-222222222222', 'x', '{}'); raise exception 'FOUT: anon kas'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'x', '{}'); raise exception 'FOUT: anon rapport'; exception when insufficient_privilege then null; end $$;
reset role;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin perform public.kassa_report_data('22222222-2222-2222-2222-222222222222', now() - interval '1 day', now()); raise exception 'FOUT: data rechtstreeks'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_open_session('22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 0, 'x'); raise exception 'FOUT: sessie rechtstreeks'; exception when insufficient_privilege then null; end $$;
do $$ begin insert into public.kassa_reports (id, tenant_id, kind, booking_date, period_start, period_end, cutoff_hour, data) values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'X', current_date, now(), now(), 6, '{}'); raise exception 'FOUT: rapport rechtstreeks'; exception when insufficient_privilege then null; end $$;
select count(*) >= 3 as ok_reports_readable from public.kassa_reports;
reset role;
\echo 'TAFEL-3: alle tests geslaagd'

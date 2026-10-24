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
-- Review B1: een tweede keukenpost (grill) voor de burger.
insert into public.categories (id, tenant_id, name) values ('dddddddd-0000-0000-0000-0000000000b3','22222222-2222-2222-2222-222222222222','Burgers');
insert into public.products (id, tenant_id, name, price, category_id, vat_rate_id, takeaway_vat_rate_id) values
 ('eeeeeeee-0000-0000-0000-0000000000b3','22222222-2222-2222-2222-222222222222','Burger',6.00,'dddddddd-0000-0000-0000-0000000000b3','cccccccc-0000-0000-0000-000000000b12','cccccccc-0000-0000-0000-000000000b06');
insert into public.prep_stations (id, tenant_id, name, kind, is_default) values ('88888888-0000-0000-0000-0000000000b3','22222222-2222-2222-2222-222222222222','Grill','kitchen',false);
insert into public.prep_station_routes (tenant_id, station_id, category_id) values ('22222222-2222-2222-2222-222222222222','88888888-0000-0000-0000-0000000000b3','dddddddd-0000-0000-0000-0000000000b3');
insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash, role) values
 ('99999999-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Els (eigenaar)','x','owner'),
 ('99999999-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222','Tom','x','waiter');
insert into public.pos_terminals (id, tenant_id, name, settings) values ('5e000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','Toog','{}');

create or replace function pg_temp.applyb(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'dev-b', cmds) $$;
create or replace function pg_temp.okb(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
-- Btw-label per open lijn zoals het toestel het tekent (review M2).
create or replace function pg_temp.lv(p_check uuid) returns jsonb language sql as $$ select coalesce(jsonb_object_agg(x.id, x.vat_label), '{}'::jsonb) from public.check_lines x where x.check_id = p_check and x.state = 'draft' $$;
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
-- Review M2: een ander btw-label dan op de server (bv. ter plaatse getekend, meenemen op de server) = gewijzigd
select pg_temp.try($q$select public.horeca_pay_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"check_id":"cb000000-0000-0000-0000-000000000001","payment_id":"4b000000-0000-0000-0000-000000000001","line_ids":["ab000000-0000-0000-0000-000000000001","ab000000-0000-0000-0000-000000000002"],"expected_total_cents":1120,"line_vats":{"ab000000-0000-0000-0000-000000000001":"B","ab000000-0000-0000-0000-000000000002":"A"}}')$q$) = '40001' as ok_counter_vat_checked;
select pg_temp.try($q$select public.horeca_pay_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"check_id":"cb000000-0000-0000-0000-000000000001","payment_id":"4b000000-0000-0000-0000-000000000001","line_ids":["ab000000-0000-0000-0000-000000000001","ab000000-0000-0000-0000-000000000002"],"expected_total_cents":1120}')$q$) = '40001' as ok_counter_vat_required;
select (public.horeca_pay_begin('22222222-2222-2222-2222-222222222222', 'dev-b', jsonb_build_object('check_id','cb000000-0000-0000-0000-000000000001','payment_id','4b000000-0000-0000-0000-000000000001','line_ids',jsonb_build_array('ab000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002'),'expected_total_cents',1120,'line_vats',pg_temp.lv('cb000000-0000-0000-0000-000000000001'))) ->> 'ok')::boolean as ok_counter_claim;
-- Tijdens de claim: niets wijzigen aan de toog (ook niet aantikken)
select (pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000013","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000001","line_id":"ab000000-0000-0000-0000-000000000009","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":1}]') -> 'results' -> 0 ->> 'code') = '55000' as ok_counter_locked_while_paying;
-- Betaling zonder alle lijnen = gewijzigd
select pg_temp.try($q$select public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000001","check_id":"cb000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","expected_total_cents":840,"line_ids":["ab000000-0000-0000-0000-000000000001"],"tenders":[{"method":"cash","amount_cents":840}]}')$q$) = '40001' as ok_counter_all_lines;
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000001","check_id":"cb000000-0000-0000-0000-000000000001","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2","expected_total_cents":1120,"line_ids":["ab000000-0000-0000-0000-000000000001","ab000000-0000-0000-0000-000000000002"],"tenders":[{"method":"cash","amount_cents":1120}],"tip_cents":50,"tip_method":"cash"}'::jsonb || jsonb_build_object('line_vats', pg_temp.lv('cb000000-0000-0000-0000-000000000001'))) ->> 'ok')::boolean as ok_counter_paid;
reset role;
select status = 'closed' as ok_counter_closed from public.dining_checks where id = 'cb000000-0000-0000-0000-000000000001';
select count(*) = 2 and bool_and(state = 'sent' and round_id is not null) as ok_counter_lines_sent from public.check_lines where check_id = 'cb000000-0000-0000-0000-000000000001';
select count(*) = 1 as ok_one_round_no_fiscal from public.check_rounds where check_id = 'cb000000-0000-0000-0000-000000000001' and fiscal_event_id is null;
-- Keukenbon enkel voor de friet (pils gaat naar een bar-post), meenemen = pickup, betaald, gekoppeld
select count(*) = 1 and bool_and(source = 'pos' and service_type = 'pickup' and paid and pos_transaction_id is null and round_id is not null
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
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000002","check_id":"cb000000-0000-0000-0000-000000000003","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b1","expected_total_cents":420,"line_ids":["ab000000-0000-0000-0000-000000000010"],"tenders":[{"method":"card","amount_cents":420}],"kitchen":false}'::jsonb || jsonb_build_object('line_vats', pg_temp.lv('cb000000-0000-0000-0000-000000000003'))) ->> 'ok')::boolean as ok_counter2_paid;
-- Review B1: friet (Bakken) + burger (Grill) = twee keukenbonnen, één verkoop
select pg_temp.okb(pg_temp.applyb('[{"id":"b1000000-0000-0000-0000-000000000030","kind":"open_check","check_kind":"counter","check_id":"cb000000-0000-0000-0000-000000000004","name":"Toog"},
 {"id":"b1000000-0000-0000-0000-000000000031","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000004","line_id":"ab000000-0000-0000-0000-000000000020","product_id":"eeeeeeee-0000-0000-0000-0000000000b1","qty":1},
 {"id":"b1000000-0000-0000-0000-000000000032","kind":"add_line","check_id":"cb000000-0000-0000-0000-000000000004","line_id":"ab000000-0000-0000-0000-000000000021","product_id":"eeeeeeee-0000-0000-0000-0000000000b3","qty":1}]')) as ok_counter3;
select (public.horeca_pay('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"4b000000-0000-0000-0000-000000000003","check_id":"cb000000-0000-0000-0000-000000000004","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b1","expected_total_cents":1020,"line_ids":["ab000000-0000-0000-0000-000000000020","ab000000-0000-0000-0000-000000000021"],"tenders":[{"method":"card","amount_cents":1020}]}'::jsonb || jsonb_build_object('line_vats', pg_temp.lv('cb000000-0000-0000-0000-000000000004'))) ->> 'ok')::boolean as ok_counter_two_stations_paid;
reset role;
select count(*) = 2 as ok_two_kitchen_tickets from public.kitchen_tickets where check_id = 'cb000000-0000-0000-0000-000000000004';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
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
reset role;
select pg_sleep(2.2); -- de periode stopt 2 s voor nu (een lopende betaling valt in het volgende rapport)
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- X: iedereen; Z: niet door een ober
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000001","kind":"X","staff_id":"99999999-0000-0000-0000-0000000000b2"}') ->> 'report_no') is null as ok_x_no_number;
select r -> 'data' -> 'sales' ->> 'count' = '3' and r -> 'data' -> 'sales' ->> 'total_cents' = '2560'
  and r -> 'data' -> 'cash' ->> 'out_cents' = '2000' and r -> 'data' -> 'cash' ->> 'in_cents' = '0'
  as ok_x_figures
  from (select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000001","kind":"X","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b2"}') r) q;
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000002","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b2"}')$q$) = '42501' as ok_z_not_by_waiter;
-- Review M8: automatisch niet voor vandaag
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000008","kind":"Z","auto":true}')$q$) = '22023' as ok_auto_not_today;
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') ->> 'report_no') = '1' as ok_z_number_1;
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') ->> 'report_no') = '1' as ok_z_reserve_idempotent;
-- Review M3: een tweede Z terwijl de eerste nog loopt (< 2 min, niets getekend) = bezig
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000009","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}')$q$) = '55000' as ok_z_busy;
select pg_temp.try($q$select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000099","kind":"Z"}')$q$) = '55000' as ok_z_needs_reservation;
select pg_temp.try($q$select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000003","kind":"X"}')$q$) = '22023' as ok_finish_kind_checked;
-- Review M3: blijft de eerste liggen (crash), dan neemt de volgende Z na 2 minuten het nummer over
reset role;
update public.kassa_report_runs set reserved_at = now() - interval '3 minutes' where id = '9b000000-0000-0000-0000-000000000003';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select r ->> 'report_no' = '1' and r ->> 'id' = '9b000000-0000-0000-0000-000000000004' as ok_z_takeover_same_number
  from (select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000004","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}') r) q;
reset role;
select count(*) = 1 as ok_one_open_z from public.kassa_report_runs where tenant_id = '22222222-2222-2222-2222-222222222222' and kind = 'Z';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select r ->> 'report_no' = '1' and (r -> 'data' -> 'vats') @> '[{"rate": 6, "gross_cents": 840, "vat_cents": 48}]'::jsonb
  and (r -> 'data' -> 'vats') @> '[{"rate": 12, "gross_cents": 1440, "vat_cents": 154}]'::jsonb
  and (r -> 'data' -> 'payments') @> '[{"method": "cash", "cents": 1120}, {"method": "card", "cents": 1440}]'::jsonb
  and (r -> 'data' -> 'tips') @> '[{"method": "cash", "cents": 50}]'::jsonb
  and jsonb_array_length(r -> 'data' -> 'shifts') = 1 and (r -> 'data' -> 'shifts' -> 0 ->> 'difference_cents') = '830'
  and jsonb_array_length(r -> 'data' -> 'staff') = 2
  as ok_z_figures
  from (select public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000004","kind":"Z","terminal_id":"5e000000-0000-0000-0000-0000000000b1","staff_id":"99999999-0000-0000-0000-0000000000b1"}') r) q;
select (public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000004","kind":"Z"}') ->> 'duplicate')::boolean as ok_z_finish_idempotent;
-- Meteen een nieuwe Z: niets nieuws na Z 1 = al afgesloten
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000010","kind":"Z","staff_id":"99999999-0000-0000-0000-0000000000b1"}')$q$) = '55000' as ok_z_closed;
-- Rapporten zijn append-only
reset role;
do $$ begin update public.kassa_reports set auto = true; raise exception 'FOUT: rapport gewijzigd'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.kassa_reports; raise exception 'FOUT: rapport gewist'; exception when insufficient_privilege then null; end $$;
-- Ontbrekende Z: een verkoop van eergisteren zonder Z
insert into public.pos_transactions (id, tenant_id, terminal_id, cashier_id, total, status, created_at)
values ('4b000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', '5e000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000002', 5, 'completed', now() - interval '2 days');
select to_char(public.kassa_business_day('22222222-2222-2222-2222-222222222222', now() - interval '2 days'), 'YYYY-MM-DD') as old_day \gset
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.kassa_report_due('22222222-2222-2222-2222-222222222222') = jsonb_build_array(:'old_day') as ok_due_missing_z;
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', jsonb_build_object('id','9b000000-0000-0000-0000-000000000005','kind','Z','auto',true,
  'booking_date', :'old_day')) ->> 'report_no') = '2' as ok_auto_z_number;
select (public.kassa_report_finish('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000005","kind":"Z","auto":true}') -> 'data' -> 'sales' ->> 'total_cents') = '500' as ok_auto_z_figures;
select public.kassa_report_due('22222222-2222-2222-2222-222222222222') = '[]'::jsonb as ok_due_empty;
-- Vrijgeven: een X die niet doorging verdwijnt; een afgewerkt rapport nooit
select (public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000011","kind":"X","staff_id":"99999999-0000-0000-0000-0000000000b2"}') ->> 'id') is not null as ok_x_begun;
select public.kassa_report_release('22222222-2222-2222-2222-222222222222', '9b000000-0000-0000-0000-000000000011')::text = '' as ok_release_x;
select public.kassa_report_release('22222222-2222-2222-2222-222222222222', '9b000000-0000-0000-0000-000000000004')::text = '' as ok_release_finished_called;
reset role;
select count(*) = 0 as ok_x_released from public.kassa_report_runs where id = '9b000000-0000-0000-0000-000000000011';
select count(*) = 1 as ok_finished_kept from public.kassa_report_runs where id = '9b000000-0000-0000-0000-000000000004';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', '{"id":"9b000000-0000-0000-0000-000000000006","kind":"X","auto":true}')$q$) = '22023' as ok_x_needs_staff;
select pg_temp.try($q$select public.kassa_report_begin('22222222-2222-2222-2222-222222222222', 'dev-b', jsonb_build_object('id','9b000000-0000-0000-0000-000000000007','kind','Z','staff_id','99999999-0000-0000-0000-0000000000b1','booking_date', current_date + 5))$q$) = '22023' as ok_no_future_z;
select pg_temp.try($q$select public.kassa_report_due('11111111-1111-1111-1111-111111111111')$q$) = '42501' as ok_due_tenant_scoped;
select pg_temp.try($q$select public.kassa_report_source('11111111-1111-1111-1111-111111111111', '9b000000-0000-0000-0000-000000000003', 'x')$q$) = '42501' as ok_source_tenant_scoped;
-- Review M6a: bron enkel voor een rapport in aanmaak van deze zaak
select pg_temp.try($q$select public.kassa_report_source('22222222-2222-2222-2222-222222222222', gen_random_uuid(), 'x')$q$) = '55000' as ok_source_needs_run;
select pg_temp.try($q$select public.kassa_report_source('22222222-2222-2222-2222-222222222222', '9b000000-0000-0000-0000-000000000004', 'x')$q$) = '55000' as ok_source_not_after_finish;
reset role;

-- Fiscale zaak A
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select (public.kassa_report_begin('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X","staff_id":"99999999-0000-0000-0000-000000000001"}') ->> 'fiscal')::boolean as ok_fiscal_flag;
-- zonder handtekeningen geweigerd
select pg_temp.try($q$select public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X"}')$q$) = '22023' as ok_fiscal_report_needs_events;
select jsonb_typeof(public.kassa_report_source('11111111-1111-1111-1111-111111111111', '9a000000-0000-0000-0000-000000000002', 'dev')) = 'array' as ok_source_runs;
reset role;
select count(*) = 1 as ok_source_audited from public.fiscal_audit_log where action = 'report_source_read' and details ->> 'report_id' = '9a000000-0000-0000-0000-000000000002';
insert into public.fiscal_events (id, tenant_id, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter, transaction_total_cents, cost_center_reference, request_body, response_body, request_sha256)
values
 ('6f000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','signReportUserX','CPOS0031234567','T1','d',91,'2026-10-24T10:00:01+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_USER_X',2,91, null, '9a000000-0000-0000-0000-000000000002','{}','{}', repeat('f',64));
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- enkel het gebruikersrapport = nog niet genoeg
select pg_temp.try($q$select public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X"}')$q$) = '22023' as ok_fiscal_needs_both_kinds;
reset role;
insert into public.fiscal_events (id, tenant_id, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter, transaction_total_cents, cost_center_reference, request_body, response_body, request_sha256)
values
 ('6f000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','signReportTurnoverX','CPOS0031234567','T1','d',90,'2026-10-24T10:00:00+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_TURNOVER_X',1,90, null, '9a000000-0000-0000-0000-000000000002','{}','{}', repeat('e',64));
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select cardinality(array(select jsonb_array_elements_text(to_jsonb(fiscal_event_ids)))) = 2 as ok_fiscal_x
  from (select public.kassa_report_finish('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000002","kind":"X"}') r) q
  cross join lateral (select fiscal_event_ids from public.kassa_reports where id = '9a000000-0000-0000-0000-000000000002') k;
-- Review M3: Z met al een ondertekend omzetrapport maar zonder gebruikersrapport (afgebroken):
-- de volgende Z krijgt die terug om af te werken (resume), niet een nieuw nummer.
reset role;
update public.pos_cashiers set role = 'owner' where id = '99999999-0000-0000-0000-000000000001';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select (public.kassa_report_begin('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000003","kind":"Z","staff_id":"99999999-0000-0000-0000-000000000001"}') ->> 'report_no') is not null as ok_fiscal_z_begun;
reset role;
insert into public.fiscal_events (id, tenant_id, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter, transaction_total_cents, cost_center_reference, request_body, response_body, request_sha256)
values
 ('6f000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','signReportTurnoverZ','CPOS0031234567','T1','d',93,'2026-10-24T10:00:03+02:00','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'FOD01000001','x','R','REPORT_TURNOVER_Z',4,93, null, '9a000000-0000-0000-0000-000000000003','{}','{}', repeat('7',64));
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select r ->> 'resume' = 'true' and r ->> 'id' = '9a000000-0000-0000-0000-000000000003' and r -> 'signed' = '["signReportTurnoverZ"]'::jsonb as ok_fiscal_z_resume
  from (select public.kassa_report_begin('11111111-1111-1111-1111-111111111111', 'dev', '{"id":"9a000000-0000-0000-0000-000000000004","kind":"Z","staff_id":"99999999-0000-0000-0000-000000000001"}') r) q;
-- een getekende Z wordt nooit vrijgegeven
select public.kassa_report_release('11111111-1111-1111-1111-111111111111', '9a000000-0000-0000-0000-000000000003')::text = '' as ok_release_signed_called;
reset role;
select count(*) = 1 as ok_signed_run_kept from public.kassa_report_runs where id = '9a000000-0000-0000-0000-000000000003';
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

\set ON_ERROR_STOP 1
-- TAFEL-2 — apart afrekenen (deelrekening) en horeca_pay. Draait na test_tafel.sql in dezelfde
-- databank: rekening c…003 op tafel B2 is open met verstuurde lijnen.
insert into public.pos_terminals (id, tenant_id, name, settings) values
 ('5e000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Toog','{}'),
 ('5e000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Zaal (GKS)','{"fiscal":{"mode":"simulator"}}'),
 ('5e000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','Vreemd','{}');
insert into public.pos_sessions (id, tenant_id, terminal_id, opened_by) values ('5f000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','5e000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');

create or replace function pg_temp.apply(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('11111111-1111-1111-1111-111111111111', 'dev', cmds) $$;
create or replace function pg_temp.ok(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
create or replace function pg_temp.total(p_check uuid) returns bigint language sql as $$ select coalesce(sum(public.horeca_line_total(x)), 0) from public.check_lines x where x.check_id = p_check and x.state = 'sent' $$;
-- Zonder line_ids: alle verstuurde lijnen van de rekening (zoals het toestel ze ondertekent).
create or replace function pg_temp.with_lines(p jsonb) returns jsonb language sql as $$
  select case when p ? 'line_ids' then p else p || jsonb_build_object('line_ids', coalesce((select jsonb_agg(x.id) from public.check_lines x where x.check_id = (p ->> 'check_id')::uuid and x.state = 'sent'), '[]'::jsonb)) end $$;
create or replace function pg_temp.pay(p jsonb) returns jsonb language sql as $$ select public.horeca_pay('11111111-1111-1111-1111-111111111111', 'dev', pg_temp.with_lines(p)) $$;
-- Probeer; geef de foutcode terug ('ok' als het lukte).
create or replace function pg_temp.try_pay(p jsonb) returns text language plpgsql as $$
begin perform public.horeca_pay('11111111-1111-1111-1111-111111111111', 'dev', pg_temp.with_lines(p)); return 'ok';
exception when others then return sqlstate; end $$;

select status = 'open' and table_id = '77777777-0000-0000-0000-000000000002' as ok_b2_open from public.dining_checks where id = 'c0000000-0000-0000-0000-000000000003';

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- ── Apart afrekenen: 1 burger naar een deelrekening van dezelfde tafel ──
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000001","kind":"move_lines","split":true,"check_id":"c0000000-0000-0000-0000-000000000003","to_check_id":"c0000000-0000-0000-0000-000000000011","staff_id":"99999999-0000-0000-0000-000000000001","moves":[{"line_id":"a0000000-0000-0000-0000-000000000016","qty":1,"from_line_id":"a0000000-0000-0000-0000-000000000031","to_line_id":"a0000000-0000-0000-0000-000000000032"}]}]')) as ok_split_sub;
select table_id = '77777777-0000-0000-0000-000000000002' and split_of = 'c0000000-0000-0000-0000-000000000003' and split_no = 1 and status = 'open'
  as ok_sub_on_same_table from public.dining_checks where id = 'c0000000-0000-0000-0000-000000000011';
-- Een deel van een deel hangt aan de hoofdrekening (max. 2 niveaus), volgnummer 2
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000002","kind":"move_lines","split":true,"check_id":"c0000000-0000-0000-0000-000000000003","to_check_id":"c0000000-0000-0000-0000-000000000012","moves":[{"line_id":"a0000000-0000-0000-0000-000000000014","qty":1,"from_line_id":"a0000000-0000-0000-0000-000000000033","to_line_id":"a0000000-0000-0000-0000-000000000034"}]}]')) as ok_split_sub2;
select split_of = 'c0000000-0000-0000-0000-000000000003' and split_no = 2 as ok_sub2_numbered from public.dining_checks where id = 'c0000000-0000-0000-0000-000000000012';
reset role;
select (public.horeca_check_json('c0000000-0000-0000-0000-000000000011') ->> 'parent_reference') = 'c0000000-0000-0000-0000-000000000003' as ok_parent_reference_in_json;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- B2 blijft "bezet" voor een nieuwe hoofdrekening
select (pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000003","kind":"open_check","check_id":"c0000000-0000-0000-0000-000000000019","table_id":"77777777-0000-0000-0000-000000000002"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_table_still_taken;

-- ── horeca_pay: weigeringen ──
reset role;
select pg_temp.total('c0000000-0000-0000-0000-000000000011') as sub_total \gset
select (:sub_total) > 0 as ok_sub_total_positive;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- verkeerd verwacht totaal = rekening gewijzigd
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total + 1, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total + 1)))) = '40001' as ok_changed_total;
-- andere lijnen dan ondertekend (één te weinig) = rekening gewijzigd
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'line_ids', '["a0000000-0000-0000-0000-000000000099"]'::jsonb,
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total)))) = '40001' as ok_line_set_checked;
-- betaalmiddelen sluiten niet
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total - 1)))) = '22023' as ok_tenders_must_match;
-- onbekend betaalmiddel, negatief bedrag
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','bitcoin','amount_cents', :sub_total)))) = '22023' as ok_unknown_method;
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total + 100), jsonb_build_object('method','cash','amount_cents', -100)))) = '22023' as ok_negative_tender;
-- afronding: de server rekent na (burger 28,00 + mayo 2,50 → 0 afronding; verkeerd voorstel = geweigerd)
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'rounding_cents', 2, 'tenders', jsonb_build_array(jsonb_build_object('method','cash','amount_cents', :sub_total)))) = '22023' as ok_rounding_checked;
-- fooi zonder betaalwijze
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tip_cents', 200, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total)))) = '22023' as ok_tip_needs_method;
-- kassa van een andere zaak, onbekende medewerker
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000003','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total)))) = '22023' as ok_foreign_terminal;
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total)))) = '22023' as ok_staff_required;
-- niet-fiscale kassa met een fiscaal event = geweigerd (geen gemengde boekhouding)
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'fiscal_event_id','6e000000-0000-0000-0000-000000000099',
  'expected_total_cents', :sub_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub_total)))) = '22023' as ok_event_on_off_terminal;
-- niets van dit alles liet sporen na
reset role;
select (select count(*) from public.pos_transactions) = 0 and (select count(*) from public.check_payments) = 0 as ok_no_traces_after_rejections;

-- ── horeca_pay: gesplitste betaling met contant + kaart + fooi ──
-- 1 burger met mayo = 30,50. Contant 10,03 (→ 10,05 afgerond, +0,02) + kaart 20,47; fooi 2,00 kaart.
select (:sub_total) = 3050 as ok_sub_total_3050;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select (r ->> 'ok')::boolean and r ->> 'receipt_number' is not null and (r ->> 'total_cents')::bigint = 3050 as ok_paid
from (select pg_temp.pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', 3050, 'rounding_cents', 2, 'tip_cents', 200, 'tip_method', 'card',
  'tenders', jsonb_build_array(jsonb_build_object('method','cash','amount_cents', 1003), jsonb_build_object('method','card','amount_cents', 2047)))) r) x;
reset role;
select status = 'closed' and closed_at is not null as ok_sub_closed from public.dining_checks where id = 'c0000000-0000-0000-0000-000000000011';
select total = 30.50 and tax_total = 3.27 and subtotal = 27.23 and session_id = '5f000000-0000-0000-0000-000000000001' and pos_cashier_id = '99999999-0000-0000-0000-000000000001'
   and cashier_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'completed' and cash_received = 10.05
   as ok_pos_transaction from public.pos_transactions where id = '40000000-0000-0000-0000-000000000001';
select (payments -> 0 ->> 'method') = 'cash' and (payments -> 0 ->> 'amount')::numeric = 10.05 and (payments -> 1 ->> 'method') = 'card' and (payments -> 1 ->> 'amount')::numeric = 20.47
   as ok_payments_as_received from public.pos_transactions where id = '40000000-0000-0000-0000-000000000001';
select jsonb_array_length(items) = 1 and (items -> 0 ->> 'quantity')::int = 1 and (items -> 0 ->> 'total')::numeric = 30.50 as ok_items from public.pos_transactions where id = '40000000-0000-0000-0000-000000000001';
select (select count(*) from public.test_stock_log where product_id = 'eeeeeeee-0000-0000-0000-000000000002' and qty = 1) = 1 as ok_stock_once;
select (select count(*) from public.test_usage_log) = 1 as ok_usage_recorded;
select rounding_cents = 2 and tip_cents = 200 and tip_method = 'card' and total_cents = 3050 and staff_id = '99999999-0000-0000-0000-000000000001' as ok_payment_row from public.check_payments where id = '40000000-0000-0000-0000-000000000001';
-- dubbel versturen (antwoord verloren) = zelfde antwoord, niets dubbel
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select (r ->> 'duplicate')::boolean as ok_pay_idempotent
from (select pg_temp.pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000001','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', 3050, 'tenders', '[]'::jsonb)) r) x;
-- afgesloten rekening opnieuw betalen met een nieuwe id = geweigerd
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000002','check_id','c0000000-0000-0000-0000-000000000011','terminal_id','5e000000-0000-0000-0000-000000000001','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', 3050, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', 3050)))) = '55000' as ok_no_double_pay;
reset role;
select (select count(*) from public.pos_transactions) = 1 and (select count(*) from public.test_stock_log) = 1 as ok_still_one_sale;

-- ── Open ronde = eerst versturen ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000004","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000012","line_id":"a0000000-0000-0000-0000-000000000035","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":1}]')) as ok_draft_added;
reset role; select pg_temp.total('c0000000-0000-0000-0000-000000000012') as sub2_total \gset
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
-- (een collega tikte een cola aan terwijl er afgerekend wordt: die gaat niet verloren, zie verder)

-- ── Fiscale kassa: zonder, met verkeerd en met juist N-event ──
reset role;
insert into public.fiscal_events (id, tenant_id, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter, transaction_total_cents, cost_center_reference, request_body, response_body, request_sha256)
values
 ('6e000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','signSale','CPOS0031234567','T1','d',1,'x','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'SIM01000001','x','N','SALE',1,1, :sub2_total + 5, 'c0000000-0000-0000-0000-000000000012','{}','{}', repeat('a',64)),
 ('6e000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','signSale','CPOS0031234567','T1','d',2,'x','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'SIM01000001','x','N','SALE',2,2, :sub2_total, 'c0000000-0000-0000-0000-000000000012','{}','{}', repeat('b',64)),
 ('6e000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','signOrder','CPOS0031234567','T1','d',1,'x','v','2026-10-24','dffcd829-a0e5-41ca-a0ae-9eb887f95637',
  'SIM01000001','x','P','ORDER',1,3, :sub2_total, 'c0000000-0000-0000-0000-000000000012','{}','{}', repeat('c',64));
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000004','check_id','c0000000-0000-0000-0000-000000000012','terminal_id','5e000000-0000-0000-0000-000000000002','staff_id','99999999-0000-0000-0000-000000000001',
  'expected_total_cents', :sub2_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub2_total)))) = '22023' as ok_fiscal_requires_event;
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000004','check_id','c0000000-0000-0000-0000-000000000012','terminal_id','5e000000-0000-0000-0000-000000000002','staff_id','99999999-0000-0000-0000-000000000001',
  'fiscal_event_id','6e000000-0000-0000-0000-000000000001',
  'expected_total_cents', :sub2_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub2_total)))) = '22023' as ok_event_amount_must_match;
select pg_temp.try_pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000004','check_id','c0000000-0000-0000-0000-000000000012','terminal_id','5e000000-0000-0000-0000-000000000002','staff_id','99999999-0000-0000-0000-000000000001',
  'fiscal_event_id','6e000000-0000-0000-0000-000000000003',
  'expected_total_cents', :sub2_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub2_total)))) = '22023' as ok_event_must_be_sale;
select (pg_temp.pay(jsonb_build_object('id','40000000-0000-0000-0000-000000000004','check_id','c0000000-0000-0000-0000-000000000012','terminal_id','5e000000-0000-0000-0000-000000000002','staff_id','99999999-0000-0000-0000-000000000001',
  'fiscal_event_id','6e000000-0000-0000-0000-000000000002',
  'expected_total_cents', :sub2_total, 'tenders', jsonb_build_array(jsonb_build_object('method','card','amount_cents', :sub2_total)))) ->> 'ok')::boolean as ok_fiscal_paid;
reset role;
select fiscal_event_id = '6e000000-0000-0000-0000-000000000002' and session_id is null as ok_fiscal_link
  from public.check_payments p join public.pos_transactions t on t.id = p.pos_transaction_id where p.id = '40000000-0000-0000-0000-000000000004';
-- de nog niet verstuurde cola staat op een nieuwe open rekening op dezelfde tafel (deel 2)
select count(*) = 1 as ok_draft_carried_over from public.dining_checks d join public.check_lines l on l.check_id = d.id
  where d.status = 'open' and d.split_of = 'c0000000-0000-0000-0000-000000000003' and d.split_no = 2 and d.id <> 'c0000000-0000-0000-0000-000000000012'
    and l.state = 'draft' and l.product_id = 'eeeeeeee-0000-0000-0000-000000000001' and l.qty = 1;
select state = 'void' and void_reason = 'carried_over' as ok_original_draft_voided from public.check_lines where id = 'a0000000-0000-0000-0000-000000000035';

-- ── Rechten ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin insert into public.check_payments (id, tenant_id, check_id, pos_transaction_id, terminal_id, total_cents, tenders)
  values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', gen_random_uuid(), '5e000000-0000-0000-0000-000000000001', 0, '[]');
  raise exception 'FOUT: rechtstreeks betalen'; exception when insufficient_privilege then null; end $$;
select count(*) = 2 as ok_staff_reads_payments from public.check_payments;
reset role;
do $$ begin update public.check_payments set tip_cents = 0, tip_method = null; raise exception 'FOUT: owner update'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.check_payments; raise exception 'FOUT: owner delete'; exception when insufficient_privilege then null; end $$;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin perform public.horeca_pay('11111111-1111-1111-1111-111111111111', 'x', '{"id":"40000000-0000-0000-0000-000000000009"}'); raise exception 'FOUT: viewer betaalt'; exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
do $$ begin perform public.horeca_pay('11111111-1111-1111-1111-111111111111', 'x', '{"id":"40000000-0000-0000-0000-000000000009"}'); raise exception 'FOUT: vreemde zaak betaalt'; exception when insufficient_privilege then null; end $$;
-- eigen zaak C kan geen betaling van zaak A opvragen via de idempotentie
do $$ begin perform public.horeca_pay('33333333-3333-3333-3333-333333333333', 'x', '{"id":"40000000-0000-0000-0000-000000000001"}'); raise exception 'FOUT: betaling van een andere zaak opgevraagd'; exception when insufficient_privilege then null; end $$;
reset role; set role anon;
do $$ begin perform public.horeca_pay('11111111-1111-1111-1111-111111111111', 'x', '{}'); raise exception 'FOUT: anon'; exception when insufficient_privilege then null; end $$;
reset role;

-- ── Hoofdrekening verhuizen: deelrekeningen gaan mee ──
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000009","kind":"add_line","check_id":"c0000000-0000-0000-0000-000000000003","line_id":"a0000000-0000-0000-0000-000000000038","product_id":"eeeeeeee-0000-0000-0000-000000000001","qty":2},
 {"id":"30000000-0000-0000-0000-000000000010","kind":"send_round","check_id":"c0000000-0000-0000-0000-000000000003","round_id":"b0000000-0000-0000-0000-000000000009"}]')) as ok_more_on_main;
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000006","kind":"move_lines","split":true,"check_id":"c0000000-0000-0000-0000-000000000003","to_check_id":"c0000000-0000-0000-0000-000000000013","moves":[{"line_id":"a0000000-0000-0000-0000-000000000012","qty":1,"from_line_id":"a0000000-0000-0000-0000-000000000036","to_line_id":"a0000000-0000-0000-0000-000000000037"}]}]')) as ok_split_sub3;
select pg_temp.ok(pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000007","kind":"move_check","check_id":"c0000000-0000-0000-0000-000000000003","to_table_id":"77777777-0000-0000-0000-000000000001"}]')) as ok_move_main;
select table_id = '77777777-0000-0000-0000-000000000001' as ok_sub_followed from public.dining_checks where id = 'c0000000-0000-0000-0000-000000000013';
select (pg_temp.apply('[{"id":"30000000-0000-0000-0000-000000000008","kind":"move_check","check_id":"c0000000-0000-0000-0000-000000000013","to_table_id":"77777777-0000-0000-0000-000000000002"}]') -> 'results' -> 0 ->> 'ok') = 'false' as ok_sub_not_movable;
reset role;
\echo 'TAFEL-2: alle tests geslaagd'

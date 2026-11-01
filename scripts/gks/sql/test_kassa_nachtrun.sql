\set ON_ERROR_STOP 1
-- KASSA-RECHTEN-1 + KASSA-UX-6. Draait na test_kassa06.sql (zaak B: Els = eigenaar …b1, Tom = ober …b2,
-- PIN 1234) en na de migraties 20261101230250/…260.
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
create or replace function pg_temp.applyb(cmds jsonb) returns jsonb language sql as $$ select public.horeca_apply('22222222-2222-2222-2222-222222222222', 'dev-b', cmds) $$;
create or replace function pg_temp.okb(r jsonb) returns boolean language sql as $$ select bool_and((x ->> 'ok')::boolean) from jsonb_array_elements(r -> 'results') x $$;
create or replace function pg_temp.r0(r jsonb) returns text language sql as $$ select coalesce(r -> 'results' -> 0 ->> 'code', 'ok') $$;
create or replace function pg_temp.approve(p jsonb) returns jsonb language sql as $$ select public.kassa_approve('22222222-2222-2222-2222-222222222222', 'dev-b', p) $$;
update public.pos_cashiers set pin_hash = crypt('1234', gen_salt('bf')), failed_pin_attempts = 0, locked_until = null
  where id in ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000b2');
update public.products set sold_out_until = null where id = 'eeeeeeee-0000-0000-0000-0000000000b2';

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Tom opent "Jan", 3 pils, verstuurt; daarna 1 pils als ontwerp.
select pg_temp.okb(pg_temp.applyb('[
 {"id":"d1000000-0000-0000-0000-000000000001","kind":"open_check","check_id":"cd000000-0000-0000-0000-000000000001","name":"Jan","staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000002","kind":"add_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":3,"staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000003","kind":"send_round","check_id":"cd000000-0000-0000-0000-000000000001","round_id":"bd000000-0000-0000-0000-000000000001","line_ids":["ad000000-0000-0000-0000-000000000001"],"staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000004","kind":"add_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000002","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":1,"staff_id":"99999999-0000-0000-0000-0000000000b2"}
]')) as ok_setup;

-- ── KASSA-RECHTEN-1 ──
-- Ober zonder akkoord: korting (verstuurd én ontwerp), gratis en annuleren van een verstuurde lijn geweigerd.
select pg_temp.r0(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000010","kind":"discount_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","neg_line_id":"ad000000-0000-0000-0000-000000000010","new_line_id":"ad000000-0000-0000-0000-000000000011","percent":50,"name":"-50","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) = '42501' as ok_waiter_discount_refused;
select pg_temp.r0(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000011","kind":"discount_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000002","neg_line_id":"ad000000-0000-0000-0000-000000000012","new_line_id":"ad000000-0000-0000-0000-000000000013","percent":100,"name":"Gratis","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) = '42501' as ok_waiter_free_draft_refused;
select pg_temp.r0(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000012","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","new_line_id":"ad000000-0000-0000-0000-000000000014","qty":1,"reason":"customer","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) = '42501' as ok_waiter_void_sent_refused;
-- Zonder staff_id ook geweigerd.
select pg_temp.r0(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000013","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","new_line_id":"ad000000-0000-0000-0000-000000000014","qty":1,"reason":"customer"}]')) = '42501' as ok_anonymous_void_refused;
reset role;
select count(*) = 0 as ok_nothing_written from public.check_lines where id in ('ad000000-0000-0000-0000-000000000010','ad000000-0000-0000-0000-000000000011','ad000000-0000-0000-0000-000000000014');
select price_changes = '[]'::jsonb as ok_draft_untouched from public.check_lines where id = 'ad000000-0000-0000-0000-000000000002';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Ontwerp-lijn weghalen blijft vrij voor de ober (niets ging naar keuken/FDM).
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000014","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000002","new_line_id":"ad000000-0000-0000-0000-000000000015","qty":1,"reason":"mistake","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) as ok_waiter_void_draft_ok;

-- Akkoord vragen: ober als goedkeurder = 42501; foute PIN = wrong_pin (geteld); juiste PIN = akkoord.
select pg_temp.try($$select pg_temp.approve('{"approver_id":"99999999-0000-0000-0000-0000000000b2","pin":"1234","action":"discount","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001"}')$$) = '42501' as ok_waiter_cannot_approve;
select pg_temp.approve('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"9999","staff_id":"99999999-0000-0000-0000-0000000000b2","action":"discount","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001"}') ->> 'reason' = 'wrong_pin' as ok_wrong_pin;
select pg_temp.try($$select pg_temp.approve('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","action":"gratis","check_id":"cd000000-0000-0000-0000-000000000001"}')$$) = '22023' as ok_bad_action;
select (pg_temp.approve('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","staff_id":"99999999-0000-0000-0000-0000000000b2","action":"discount","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001"}') ->> 'approval_id') as disc_ok \gset
select pg_temp.try($$select public.kassa_approve('33333333-3333-3333-3333-333333333333','dev-b','{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","action":"discount","check_id":"cd000000-0000-0000-0000-000000000001"}')$$) = '42501' as ok_other_tenant_refused;
-- Akkoord voor een andere lijn of actie telt niet.
select pg_temp.r0(pg_temp.applyb(format('[{"id":"d1000000-0000-0000-0000-000000000020","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","new_line_id":"ad000000-0000-0000-0000-000000000014","qty":1,"reason":"customer","staff_id":"99999999-0000-0000-0000-0000000000b2","approval_id":"%s"}]', :'disc_ok')::jsonb)) = '42501' as ok_wrong_action_refused;
-- Met akkoord: −50 % op de verstuurde lijn gaat door, precies zoals voorheen (tegenboeking + nieuwe lijn).
select pg_temp.okb(pg_temp.applyb(format('[{"id":"d1000000-0000-0000-0000-000000000021","kind":"discount_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000001","neg_line_id":"ad000000-0000-0000-0000-000000000010","new_line_id":"ad000000-0000-0000-0000-000000000011","percent":50,"name":"-50","staff_id":"99999999-0000-0000-0000-0000000000b2","approval_id":"%s"}]', :'disc_ok')::jsonb)) as ok_discount_with_approval;
reset role;
select (select (select qty from public.check_lines where id = 'ad000000-0000-0000-0000-000000000010') = -3
   and (select neg_reason from public.check_lines where id = 'ad000000-0000-0000-0000-000000000010') = 'PRICE_CHANGE'
   and (select (price_changes -> 0 ->> 'amount_cents')::int from public.check_lines where id = 'ad000000-0000-0000-0000-000000000011') = -465) as ok_discount_lines_same_as_before;
select (select used_at is not null and command_id = 'd1000000-0000-0000-0000-000000000021' and approver_id = '99999999-0000-0000-0000-0000000000b1' and staff_id = '99999999-0000-0000-0000-0000000000b2'
  from public.kassa_approvals where id = :'disc_ok') as ok_approval_used;
select (select failed_pin_attempts = 0 from public.pos_cashiers where id = '99999999-0000-0000-0000-0000000000b1') as ok_pin_counter_reset;
select (select count(*) >= 1 from public.fiscal_audit_log where action = 'kassa_approval' and details ->> 'approval_id' = :'disc_ok') as ok_audit_approval;
select (select count(*) >= 1 from public.fiscal_audit_log where action = 'pin_failed' and details ->> 'context' = 'kassa_approval') as ok_audit_pin_failed;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Ronde 2 versturen: de tegenboeking en de lijn met korting zijn nu verstuurd.
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000026","kind":"send_round","check_id":"cd000000-0000-0000-0000-000000000001","round_id":"bd000000-0000-0000-0000-000000000002","line_ids":["ad000000-0000-0000-0000-000000000010","ad000000-0000-0000-0000-000000000011"],"staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) as ok_send_round2;
-- Eenmalig: hetzelfde akkoord nog eens (nieuw commando) = geweigerd.
select pg_temp.r0(pg_temp.applyb(format('[{"id":"d1000000-0000-0000-0000-000000000022","kind":"discount_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000011","neg_line_id":"ad000000-0000-0000-0000-000000000016","new_line_id":"ad000000-0000-0000-0000-000000000017","percent":10,"name":"-10","staff_id":"99999999-0000-0000-0000-0000000000b2","approval_id":"%s"}]', :'disc_ok')::jsonb)) = '42501' as ok_approval_single_use;
-- Annuleren van een verstuurde lijn met akkoord void_sent.
select (pg_temp.approve('{"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","staff_id":"99999999-0000-0000-0000-0000000000b2","action":"void_sent","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000011"}') ->> 'approval_id') as void_ok \gset
reset role;
-- Verlopen akkoord = geweigerd.
update public.kassa_approvals set expires_at = now() - interval '1 second' where id = :'void_ok';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.r0(pg_temp.applyb(format('[{"id":"d1000000-0000-0000-0000-000000000023","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000011","new_line_id":"ad000000-0000-0000-0000-000000000018","qty":1,"reason":"customer","staff_id":"99999999-0000-0000-0000-0000000000b2","approval_id":"%s"}]', :'void_ok')::jsonb)) = '42501' as ok_expired_refused;
reset role;
update public.kassa_approvals set expires_at = now() + interval '5 minutes' where id = :'void_ok';
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.okb(pg_temp.applyb(format('[{"id":"d1000000-0000-0000-0000-000000000024","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000011","new_line_id":"ad000000-0000-0000-0000-000000000018","qty":1,"reason":"customer","staff_id":"99999999-0000-0000-0000-0000000000b2","approval_id":"%s"}]', :'void_ok')::jsonb)) as ok_void_with_approval;
-- Eigenaar aan de kassa: meteen, zonder akkoord (bestaande correcte aanroepen blijven werken).
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000025","kind":"void_line","check_id":"cd000000-0000-0000-0000-000000000001","line_id":"ad000000-0000-0000-0000-000000000011","new_line_id":"ad000000-0000-0000-0000-000000000019","qty":1,"reason":"broken","staff_id":"99999999-0000-0000-0000-0000000000b1"}]')) as ok_owner_void_direct;
reset role;
select (select qty = -1 and neg_reason = 'CORRECTION' and state = 'draft' from public.check_lines where id = 'ad000000-0000-0000-0000-000000000019') as ok_owner_correction_line;
-- Rechtstreeks aanroepen kan niet.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.try($$select public.kassa_require_approval('22222222-2222-2222-2222-222222222222','cd000000-0000-0000-0000-000000000001','{}')$$) = '42501' as ok_gate_not_callable;
select pg_temp.try($$select * from public.kassa_approvals$$) = '42501' as ok_table_not_readable;

-- ── KASSA-UX-6 ──
-- Toogverkoop (meenemen, friet 6 %) → rekening op naam: wordt een gewone rekening, ter plaatse (12 %).
select pg_temp.okb(pg_temp.applyb('[
 {"id":"d1000000-0000-0000-0000-000000000030","kind":"open_check","check_kind":"counter","service":"takeaway","check_id":"cd000000-0000-0000-0000-000000000002","name":"Toog","staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000031","kind":"add_line","check_id":"cd000000-0000-0000-0000-000000000002","line_id":"ad000000-0000-0000-0000-000000000030","product_id":"eeeeeeee-0000-0000-0000-0000000000b1","qty":1,"staff_id":"99999999-0000-0000-0000-0000000000b2"}
]')) as ok_counter_open;
reset role;
select (select vat_rate = 6 from public.check_lines where id = 'ad000000-0000-0000-0000-000000000030') as ok_counter_takeaway_rate;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000032","kind":"move_check","check_id":"cd000000-0000-0000-0000-000000000002","to_table_id":null,"to_name":"Piet","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) as ok_counter_to_tab;
reset role;
select (select kind = 'table' and service is null and name = 'Piet' and table_id is null and status = 'open' from public.dining_checks where id = 'cd000000-0000-0000-0000-000000000002') as ok_tab_is_table;
select (select vat_rate = 12 and vat_label = 'B' and state = 'draft' from public.check_lines where id = 'ad000000-0000-0000-0000-000000000030') as ok_tab_eat_in_rate;
-- Toogverkoop bij een bestaande rekening (Jan): alles verhuist, de toog sluit.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.okb(pg_temp.applyb('[
 {"id":"d1000000-0000-0000-0000-000000000033","kind":"open_check","check_kind":"counter","service":"eat_in","check_id":"cd000000-0000-0000-0000-000000000003","name":"Toog","staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000034","kind":"add_line","check_id":"cd000000-0000-0000-0000-000000000003","line_id":"ad000000-0000-0000-0000-000000000031","product_id":"eeeeeeee-0000-0000-0000-0000000000b2","qty":2,"staff_id":"99999999-0000-0000-0000-0000000000b2"},
 {"id":"d1000000-0000-0000-0000-000000000035","kind":"add_line","check_id":"cd000000-0000-0000-0000-000000000003","line_id":"ad000000-0000-0000-0000-000000000032","product_id":"eeeeeeee-0000-0000-0000-0000000000b1","qty":1,"staff_id":"99999999-0000-0000-0000-0000000000b2"}
]')) as ok_counter2_open;
-- Half verplaatsen mag niet.
select pg_temp.r0(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000036","kind":"move_lines","check_id":"cd000000-0000-0000-0000-000000000003","to_check_id":"cd000000-0000-0000-0000-000000000001","moves":[{"line_id":"ad000000-0000-0000-0000-000000000031","qty":2,"from_line_id":"ad000000-0000-0000-0000-000000000040","to_line_id":"ad000000-0000-0000-0000-000000000041"}],"staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) = '22023' as ok_counter_partial_refused;
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000037","kind":"move_lines","check_id":"cd000000-0000-0000-0000-000000000003","to_check_id":"cd000000-0000-0000-0000-000000000001","moves":[
  {"line_id":"ad000000-0000-0000-0000-000000000031","qty":2,"from_line_id":"ad000000-0000-0000-0000-000000000040","to_line_id":"ad000000-0000-0000-0000-000000000041"},
  {"line_id":"ad000000-0000-0000-0000-000000000032","qty":1,"from_line_id":"ad000000-0000-0000-0000-000000000042","to_line_id":"ad000000-0000-0000-0000-000000000043"}],"staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) as ok_counter_merge;
reset role;
select (select status = 'closed' from public.dining_checks where id = 'cd000000-0000-0000-0000-000000000003') as ok_counter_closed_after_merge;
select (select count(*) = 2 from public.check_lines where check_id = 'cd000000-0000-0000-0000-000000000001' and id in ('ad000000-0000-0000-0000-000000000041','ad000000-0000-0000-0000-000000000043') and state = 'draft') as ok_lines_on_jan;
-- Naar een toog blijft verboden; een tafelrekening verplaatsen werkt zoals voorheen.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.okb(pg_temp.applyb('[{"id":"d1000000-0000-0000-0000-000000000038","kind":"move_check","check_id":"cd000000-0000-0000-0000-000000000002","to_table_id":null,"to_name":"Piet B","staff_id":"99999999-0000-0000-0000-0000000000b2"}]')) as ok_table_move_unchanged;

-- Mijn dienst: leest, schrijft niets; andere zaak geweigerd.
select (public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2') ? 'tips_cents') as ok_my_shift_shape;
select pg_temp.try($$select public.kassa_my_shift('33333333-3333-3333-3333-333333333333', '99999999-0000-0000-0000-0000000000b2')$$) = '42501' as ok_my_shift_other_tenant;
select pg_temp.try($$select public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-00000000dead')$$) = '22023' as ok_my_shift_unknown_staff;
reset role;
-- Mijn dienst = de staff-regel van kassa_report_data (zelfde bron als het X-rapport).
select (m ->> 'total_cents')::bigint = coalesce((select (e ->> 'total_cents')::bigint from jsonb_array_elements(d -> 'staff') e where e ->> 'staff_id' = '99999999-0000-0000-0000-0000000000b2'), 0)
   and (m ->> 'tips_cents')::bigint = coalesce((select (e ->> 'tips_cents')::bigint from jsonb_array_elements(d -> 'staff') e where e ->> 'staff_id' = '99999999-0000-0000-0000-0000000000b2'), 0)
  as ok_my_shift_matches_report
  from (select public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2') m,
               public.kassa_report_data('22222222-2222-2222-2222-222222222222', (public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2') ->> 'from')::timestamptz,
                                        (public.kassa_my_shift('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2') ->> 'to')::timestamptz) d) q;
-- Vergrendeltijd: standaard 2, enkel 0/1/2/5/10.
insert into public.horeca_pay_settings (tenant_id) values ('22222222-2222-2222-2222-222222222222') on conflict (tenant_id) do nothing;
select (select kassa_lock_minutes = 2 from public.horeca_pay_settings where tenant_id = '22222222-2222-2222-2222-222222222222') as ok_lock_default;
select pg_temp.try($$update public.horeca_pay_settings set kassa_lock_minutes = 3 where tenant_id = '22222222-2222-2222-2222-222222222222'$$) = '23514' as ok_lock_values_checked;
\echo 'KASSA-RECHTEN-1 + KASSA-UX-6: alle tests geslaagd'

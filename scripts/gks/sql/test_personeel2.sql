\set ON_ERROR_STOP 1
-- PERSONEEL-2 (uren) + RAPPORT-HORECA-1 (analyse). Eigen zaak D, eigen gebruikers.
create table if not exists public.check_online_payments (id uuid primary key, tenant_id uuid not null, check_id uuid, status text not null default 'pending',
  tip_cents integer not null default 0, paid_at timestamptz);
insert into public.tenants (id, name, business_modules) values ('44444444-4444-4444-4444-444444444444','Horeca D','{horeca}'), ('55555555-5555-5555-5555-555555555555','Horeca E','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values
 ('dddddddd-0000-0000-0000-000000000001','staff','44444444-4444-4444-4444-444444444444'),
 ('dddddddd-0000-0000-0000-000000000002','tenant_admin','44444444-4444-4444-4444-444444444444'),
 ('dddddddd-0000-0000-0000-000000000003','tenant_admin','55555555-5555-5555-5555-555555555555'),
 ('dddddddd-0000-0000-0000-000000000004','accountant','44444444-4444-4444-4444-444444444444');

set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000002';
select public.kassa_staff_save('44444444-4444-4444-4444-444444444444', null, 'Lien', 'waiter', null, null, true, true, '1234') as lien \gset
select public.kassa_staff_save('44444444-4444-4444-4444-444444444444', null, 'Bart', 'bartender', null, null, true, true, '4321') as bart \gset
reset role;

-- Kassa (staff): knopstand komt van de server, over toestellen heen.
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';
select public.kassa_clock_state('44444444-4444-4444-4444-444444444444', :'lien') ->> 'state' = 'out' as ok_start_out;
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'lien', 'in', 'tablet-A', null, null)) ->> 'changed' = 'true' as ok_in_a;
select public.kassa_clock_state('44444444-4444-4444-4444-444444444444', :'lien') ->> 'state' = 'in' as ok_tablet_b_sees_in;
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'lien', 'in', 'tablet-B', null, null)) ->> 'changed' = 'false' as ok_double_in_noop;
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'lien', 'out', 'tablet-B', null, null)) ->> 'changed' = 'true' as ok_out_b;
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'lien', 'out', 'tablet-B', null, null)) ->> 'changed' = 'false' as ok_double_out_noop;
select public.kassa_clock_state('44444444-4444-4444-4444-444444444444', :'lien') ->> 'state' = 'out' as ok_back_out;
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'bart', 'in', 'tablet-A', null, null)) ->> 'state' = 'in' as ok_bart_in;
-- staff leest geen uren en corrigeert niet; vals fiscaal event geweigerd
do $$ begin perform 1 from public.kassa_shifts; if found then raise exception 'FOUT: staff leest shifts'; end if; end $$;
do $$ begin perform public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', '{"action":"void","shift_id":"00000000-0000-0000-0000-000000000000","reason":"test"}'); raise exception 'FOUT: staff corrigeert'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_hours_report('44444444-4444-4444-4444-444444444444', now() - interval '1 day', now() + interval '1 day'); raise exception 'FOUT: staff rapport'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_clock('44444444-4444-4444-4444-444444444444', (select id from public.pos_cashiers where display_name='Lien'), 'in', 'x', null, gen_random_uuid()); raise exception 'FOUT: vals event'; exception when sqlstate '22023' then null; end $$;
-- rechtstreeks schrijven kan niet
do $$ begin insert into public.kassa_shifts (tenant_id, staff_id) values ('44444444-4444-4444-4444-444444444444', (select id from public.pos_cashiers where display_name='Lien')); raise exception 'FOUT: insert'; exception when insufficient_privilege then null; end $$;
reset role;

-- Bron is onwijzigbaar behalve afsluiten (ook niet als superuser)
do $$ begin update public.kassa_shifts set clock_in_at = clock_in_at - interval '1 hour'; raise exception 'FOUT: update shift'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.kassa_shifts; raise exception 'FOUT: delete shift'; exception when insufficient_privilege then null; end $$;

-- Andere zaak: geen toegang
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000003';
do $$ begin perform public.kassa_clock_state('44444444-4444-4444-4444-444444444444', gen_random_uuid()); raise exception 'FOUT: vreemde zaak'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_clock('55555555-5555-5555-5555-555555555555', (select id from public.pos_cashiers limit 1), 'in', 'x', null, null); raise exception 'FOUT: vreemde medewerker'; exception when sqlstate 'P0002' then null; end $$;
select count(*) = 0 as ok_other_sees_no_shifts from public.kassa_shifts;
reset role;

-- Beheer: correcties
set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000002';
select id as lien_shift from public.kassa_shifts where staff_id = :'lien' \gset
select id as bart_shift from public.kassa_shifts where staff_id = :'bart' \gset
select public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', jsonb_build_object('action','adjust','shift_id',:'lien_shift',
  'clock_in_at', now() - interval '8 hours', 'clock_out_at', now() - interval '30 minutes', 'reason', 'vergeten in te klokken')) is not null as ok_adjust;
-- Bart vergat uit te klokken: de zaakvoerder sluit de shift via een correctie → niet meer ingeklokt
select public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', jsonb_build_object('action','adjust','shift_id',:'bart_shift',
  'clock_in_at', now() - interval '2 hours', 'clock_out_at', now() - interval '1 hour', 'reason', 'vergeten uit te klokken')) is not null as ok_close_by_correction;
select public.kassa_clock_state('44444444-4444-4444-4444-444444444444', :'bart') ->> 'state' = 'out' as ok_corrected_is_out;
select public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', jsonb_build_object('action','add','staff_id',:'lien',
  'clock_in_at', now() - interval '30 hours', 'clock_out_at', now() - interval '26 hours', 'reason', 'shift gisteren')) is not null as ok_add;
do $$ begin perform public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', jsonb_build_object('action','add','staff_id',(select id from public.pos_cashiers where display_name='Lien'),
  'clock_in_at', now() - interval '30 hours', 'clock_out_at', now() - interval '2 hours', 'reason', 'te lang')); raise exception 'FOUT: >24u'; exception when sqlstate '22023' then null; end $$;
do $$ begin perform public.kassa_shift_correct('44444444-4444-4444-4444-444444444444', jsonb_build_object('action','add','staff_id',(select id from public.pos_cashiers where display_name='Lien'),
  'clock_in_at', now() - interval '3 hours', 'clock_out_at', now() - interval '2 hours', 'reason', '')); raise exception 'FOUT: zonder reden'; exception when check_violation then null; end $$;
do $$ begin update public.kassa_shift_corrections set reason = 'x'; raise exception 'FOUT: update correctie'; exception when insufficient_privilege then null; end $$;
select (r -> 'shifts') @> jsonb_build_array(jsonb_build_object('id', :'lien_shift', 'corrected', true))
   and jsonb_array_length(r -> 'shifts') = 3
   and jsonb_array_length(r -> 'staff') = 2 as ok_staff
  from (select public.kassa_hours_report('44444444-4444-4444-4444-444444444444', now() - interval '7 days', now() + interval '1 hour') as r) q;
-- de originele tijden blijven in de bron staan
select (select clock_out_at from public.kassa_shifts where id = :'bart_shift') is null as ok_source_untouched;
-- inklokken na correctie: nieuwe shift
reset role; set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';
select (public.kassa_clock('44444444-4444-4444-4444-444444444444', :'bart', 'in', 'tablet-A', null, null)) ->> 'changed' = 'true' as ok_bart_new_shift;
reset role;

-- RAPPORT-HORECA-1: één tafelrekening (2 couverts, fooi 150) + één klassiek ticket + één ticket aan een order (telt niet).
insert into public.pos_terminals (id, tenant_id) values ('d0000000-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444');
insert into public.dining_checks (id, tenant_id, name, status, guests, cost_center_reference) values ('d0000000-0000-0000-0000-0000000000c1', '44444444-4444-4444-4444-444444444444', 'T1', 'closed', 2, 'cc-1');
insert into public.check_lines (id, tenant_id, check_id, seq, product_id, name, department_id, department_name, vat_rate, vat_label, unit_price_cents, qty, state) values
 (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000c1', 1, 'd0000000-0000-0000-0000-0000000000b1', 'Pils', 'd', 'Drank', 21, 'A', 300, 4, 'sent'),
 (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000c1', 2, null, 'Spaghetti', 'k', 'Keuken', 12, 'B', 1400, 1, 'sent'),
 (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000c1', 3, null, 'Cola', 'd', 'Drank', 21, 'A', 300, 1, 'void');
insert into public.pos_transactions (id, tenant_id, terminal_id, cashier_id, pos_cashier_id, total, status) values
 ('d0000000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000a', gen_random_uuid(), :'lien', 26.00, 'completed');
insert into public.check_payments (id, tenant_id, check_id, pos_transaction_id, terminal_id, staff_id, total_cents, tenders, tip_cents, tip_method) values
 ('d0000000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-0000000000c1', 'd0000000-0000-0000-0000-0000000000a1',
  'd0000000-0000-0000-0000-00000000000a', :'lien', 2600, '[{"method":"card","amount_cents":2600}]', 150, 'card');
insert into public.pos_transactions (tenant_id, terminal_id, cashier_id, pos_cashier_id, total, status, items) values
 ('44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000a', gen_random_uuid(), :'bart', 6.00, 'completed',
  '[{"product_id":"d0000000-0000-0000-0000-0000000000b1","name":"Pils","quantity":2,"total":6}]'),
 ('44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000a', gen_random_uuid(), :'bart', 99.00, 'completed', '[]'),
 ('44444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000a', gen_random_uuid(), :'bart', 50.00, 'voided', '[]');
update public.pos_transactions set order_id = gen_random_uuid() where total = 99.00 and tenant_id = '44444444-4444-4444-4444-444444444444';

set role authenticated; set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';
select (a -> 'totals' ->> 'revenue_cents')::int = 3200
   and (a -> 'totals' ->> 'tickets')::int = 2
   and (a -> 'totals' ->> 'checks')::int = 1 and (a -> 'totals' ->> 'guests')::int = 2 and (a -> 'totals' ->> 'guests_revenue_cents')::int = 2600
   and (a -> 'totals' ->> 'tips_cents')::int = 150
   and (a -> 'products' -> 0 ->> 'name') = 'Pils' and (a -> 'products' -> 0 ->> 'qty')::int = 6 and (a -> 'products' -> 0 ->> 'cents')::int = 1800
   and jsonb_array_length(a -> 'products') = 2
   and (select sum((h ->> 'cents')::int) from jsonb_array_elements(a -> 'hours') h) = 3200
   and jsonb_array_length(a -> 'staff') = 2 as ok_staff_split
  from (select public.horeca_analysis('44444444-4444-4444-4444-444444444444', current_date - 2, current_date + 1) as a) q;
do $$ begin perform public.kassa_hours_report('44444444-4444-4444-4444-444444444444', now() - interval '1 day', now()); raise exception 'FOUT: boekhouder ziet uren'; exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';
do $$ begin perform public.horeca_analysis('44444444-4444-4444-4444-444444444444', current_date - 1, current_date); raise exception 'FOUT: staff analyse'; exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000003';
do $$ begin perform public.horeca_analysis('44444444-4444-4444-4444-444444444444', current_date - 1, current_date); raise exception 'FOUT: vreemde zaak analyse'; exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000002';
select (r -> 'tips' -> 0 ->> 'cents')::int = 150 as ok_tip_pot_day
  from (select public.kassa_hours_report('44444444-4444-4444-4444-444444444444', now() - interval '1 day', now() + interval '1 hour') as r) q;
reset role;
set role anon;
do $$ begin perform public.kassa_clock_state('44444444-4444-4444-4444-444444444444', gen_random_uuid()); raise exception 'FOUT: anon'; exception when insufficient_privilege then null; end $$;
reset role;
\echo 'PERSONEEL-2 + RAPPORT-HORECA-1: alle tests geslaagd'

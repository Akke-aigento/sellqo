\set ON_ERROR_STOP 1
insert into public.tenants (id, name, business_modules) values
 ('11111111-1111-1111-1111-111111111111','Horeca A','{horeca}'),
 ('22222222-2222-2222-2222-222222222222','Webshop B','{}'),
 ('33333333-3333-3333-3333-333333333333','Horeca C','{horeca}');
insert into public.user_roles (user_id, role, tenant_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','staff','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000002','tenant_admin','22222222-2222-2222-2222-222222222222'),
 ('aaaaaaaa-0000-0000-0000-000000000003','viewer','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000004','tenant_admin','11111111-1111-1111-1111-111111111111');

create or replace function pg_temp.ev(t uuid, by uuid, ticket int, counter int) returns void language sql as $$
  insert into public.fiscal_events (tenant_id, created_by, mutation, pos_id, terminal_id, device_id, pos_fiscal_ticket_no, pos_date_time,
    pos_sw_version, booking_date, booking_period_id, fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter,
    request_body, response_body, request_sha256)
  values (t, by, 'signSale', 'CPOS0031234567', 'TER-2-DIN', 'dev', ticket, '2024-07-29T13:00:00.000+02:00', '1', '2024-07-29',
    'dffcd829-a0e5-41ca-a0ae-9eb887f95637', 'SIM01000001', '2024-07-29T11:00:08.000Z', 'N', 'SALE', counter, counter,
    '{"query":"x","variables":{"data":{"employeeId":"84022899837"}}}', '{}', repeat('a',64));
$$;

-- staff van horecazaak A mag invoegen
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ev('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',1,1);
-- metadata lezen mag, berichtinhoud niet
select count(*) = 1 as ok_meta from public.fiscal_events;
do $$ begin perform request_body from public.fiscal_events; raise exception 'FOUT: request_body leesbaar'; exception when insufficient_privilege then null; end $$;
-- als iemand anders invoegen = geweigerd
do $$ begin perform pg_temp.ev('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004',2,2); raise exception 'FOUT: imitatie'; exception when insufficient_privilege then null; end $$;
-- andere horecazaak = geweigerd
do $$ begin perform pg_temp.ev('33333333-3333-3333-3333-333333333333','aaaaaaaa-0000-0000-0000-000000000001',2,2); raise exception 'FOUT: vreemde tenant'; exception when insufficient_privilege then null; end $$;
-- update / delete = geweigerd (geen grant)
do $$ begin update public.fiscal_events set pos_sw_version = '2'; raise exception 'FOUT: update'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.fiscal_events; raise exception 'FOUT: delete'; exception when insufficient_privilege then null; end $$;
-- dubbel (zelfde sleutelvelden) = geweigerd
do $$ begin perform pg_temp.ev('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',1,9); raise exception 'FOUT: dubbel'; exception when unique_violation then null; end $$;
-- viewer mag niet invoegen
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin perform pg_temp.ev('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003',3,3); raise exception 'FOUT: viewer'; exception when insufficient_privilege then null; end $$;
-- webshop zonder horeca: admin mag niet invoegen
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin perform pg_temp.ev('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002',1,4); raise exception 'FOUT: geen horeca'; exception when insufficient_privilege then null; end $$;
select count(*) = 0 as ok_other_tenant_invisible from public.fiscal_events;
-- anon ziet niets en mag niets
reset role; set role anon;
do $$ begin perform 1 from public.fiscal_events; raise exception 'FOUT: anon'; exception when insufficient_privilege then null; end $$;
-- service_role mag ook niet wijzigen of wissen
reset role; set role service_role;
do $$ begin update public.fiscal_events set pos_sw_version = '2'; raise exception 'FOUT: service update'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.fiscal_events; raise exception 'FOUT: service delete'; exception when insufficient_privilege then null; end $$;
-- zelfs de eigenaar: trigger weigert update, delete en truncate
reset role;
do $$ begin update public.fiscal_events set pos_sw_version = '2'; raise exception 'FOUT: owner update'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.fiscal_events; raise exception 'FOUT: owner delete'; exception when insufficient_privilege then null; end $$;
do $$ begin truncate public.fiscal_events; raise exception 'FOUT: owner truncate'; exception when insufficient_privilege then null; end $$;
-- auditlog: lid schrijft, enkel admin leest, niemand wijzigt
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.fiscal_audit_log (tenant_id, action, details) values ('11111111-1111-1111-1111-111111111111','fdm_unreachable','{"tries":3}');
select count(*) = 0 as ok_staff_cannot_read_audit from public.fiscal_audit_log;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
select count(*) = 1 as ok_admin_reads_audit from public.fiscal_audit_log;
do $$ begin update public.fiscal_audit_log set action = 'x'; raise exception 'FOUT: audit update'; exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin delete from public.fiscal_audit_log; raise exception 'FOUT: audit owner delete'; exception when insufficient_privilege then null; end $$;
select count(*) = 1 as ok_one_event from public.fiscal_events;
\echo 'fiscal_events/fiscal_audit_log: alle tests geslaagd'

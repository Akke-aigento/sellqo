-- PRINT-1 — RLS- en guardtests voor printers en print_jobs. Elke actie die geweigerd moet
-- worden maar toch lukt, gooit 'FOUT: ...'. Draaien via run_print.sh.
\set ON_ERROR_STOP 1
insert into public.tenants (id, name, business_modules) values
 ('11111111-1111-1111-1111-111111111111','Horeca A','{horeca}'),
 ('33333333-3333-3333-3333-333333333333','Horeca C','{horeca}');
insert into public.user_roles (user_id, role, tenant_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','staff','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000003','viewer','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000004','tenant_admin','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000005','tenant_admin','33333333-3333-3333-3333-333333333333');

-- beheerder A koppelt een printer (token_hash schrijven mag)
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
insert into public.printers (id, tenant_id, name, kind, protocol, width_chars, token_hash) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Kassa','receipt','escpos_lan',48, null),
 ('bbbbbbbb-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Bar','bar','star_cloudprnt',42, repeat('ab',32));
select count(*) = 2 as ok_admin_sees_printers from public.printers;
-- token_hash is nooit leesbaar voor authenticated
do $$ begin perform token_hash from public.printers; raise exception 'FOUT: token_hash leesbaar'; exception when insufficient_privilege then null; end $$;
do $$ begin perform * from public.printers; raise exception 'FOUT: select * leest token_hash'; exception when insufficient_privilege then null; end $$;
-- ... maar wel bij te werken (nieuw token)
update public.printers set token_hash = repeat('cd',32) where id = 'bbbbbbbb-0000-0000-0000-000000000002';
-- wissen kan niet (uitzetten wel)
do $$ begin delete from public.printers; raise exception 'FOUT: printer gewist'; exception when insufficient_privilege then null; end $$;
update public.printers set is_active = false where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.printers set is_active = true where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- staff mag geen printers beheren, wel jobs aanmaken
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin insert into public.printers (tenant_id, name, kind, protocol) values ('11111111-1111-1111-1111-111111111111','x','receipt','escpos_lan'); raise exception 'FOUT: staff maakt printer'; exception when insufficient_privilege then null; end $$;
update public.printers set name = 'gekaapt';
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
select count(*) = 0 as ok_staff_could_not_rename from public.printers where name = 'gekaapt';
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

create or replace function pg_temp.job(t uuid, p uuid, k text) returns void language sql as $$
  insert into public.print_jobs (tenant_id, printer_id, kind, payload_text, payload_escpos, dedupe_key)
  values (t, p, 'kasticket', 'btw-KASTICKET', 'G0AbdBM=', k);
$$;
select pg_temp.job('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','SIM01000001:N1/1:kasticket:p1');
select count(*) = 1 as ok_staff_queues_job from public.print_jobs;
-- dedupe: hetzelfde event op dezelfde printer = geweigerd (herafdruk = copy-event)
do $$ begin perform pg_temp.job('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','SIM01000001:N1/1:kasticket:p1'); raise exception 'FOUT: dubbele job'; exception when unique_violation then null; end $$;
-- ongeldige base64 = geweigerd
do $$ begin insert into public.print_jobs (tenant_id, printer_id, kind, payload_text, payload_escpos, dedupe_key) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','kasticket','x','<<niet base64>>','k2'); raise exception 'FOUT: base64'; exception when check_violation then null; end $$;
-- een job start als queued
do $$ begin insert into public.print_jobs (tenant_id, printer_id, kind, payload_text, dedupe_key, status, printed_at) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','kasticket','x','k3','printed', now()); raise exception 'FOUT: status bij insert'; exception when insufficient_privilege or check_violation then null; end $$;
-- printer van een andere zaak = geweigerd
set role postgres; reset role;
insert into public.printers (id, tenant_id, name, kind, protocol) values ('bbbbbbbb-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333','C','receipt','escpos_lan');
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin perform pg_temp.job('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000009','k4'); raise exception 'FOUT: vreemde printer'; exception when foreign_key_violation then null; end $$;
-- vreemde zaak = geweigerd
do $$ begin perform pg_temp.job('33333333-3333-3333-3333-333333333333','bbbbbbbb-0000-0000-0000-000000000009','k5'); raise exception 'FOUT: vreemde tenant'; exception when insufficient_privilege or foreign_key_violation then null; end $$;
-- inhoud is onveranderlijk
do $$ begin update public.print_jobs set payload_text = 'anders'; raise exception 'FOUT: payload gewijzigd'; exception when insufficient_privilege then null; end $$;
-- statusverloop: queued -> printing -> printed
update public.print_jobs set status = 'printing', claimed_at = now(), attempts = 1;
update public.print_jobs set status = 'printed', printed_at = now();
-- printed is eindstatus: nooit opnieuw in de wachtrij
do $$ begin update public.print_jobs set status = 'queued', printed_at = null; raise exception 'FOUT: herafdruk'; exception when insufficient_privilege then null; end $$;
-- verwijderen kan niet
do $$ begin delete from public.print_jobs; raise exception 'FOUT: job gewist'; exception when insufficient_privilege then null; end $$;
-- viewer: lezen ja, aanmaken nee
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select count(*) = 1 as ok_viewer_reads from public.print_jobs;
do $$ begin perform pg_temp.job('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','k6'); raise exception 'FOUT: viewer'; exception when insufficient_privilege then null; end $$;
-- beheerder van zaak C ziet niets van A
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
select count(*) = 0 as ok_other_tenant_no_jobs from public.print_jobs;
select count(*) = 1 as ok_other_tenant_only_own_printer from public.printers;
-- anon: niets
reset role; set role anon;
do $$ begin perform 1 from public.printers; raise exception 'FOUT: anon printers'; exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.print_jobs; raise exception 'FOUT: anon jobs'; exception when insufficient_privilege then null; end $$;
-- service_role (edge function cloudprnt): token_hash opzoeken mag, printed terugzetten niet, wissen niet
reset role; set role service_role;
select count(*) = 1 as ok_service_finds_token from public.printers where token_hash = repeat('cd',32);
do $$ begin update public.print_jobs set status = 'queued', printed_at = null; raise exception 'FOUT: service herafdruk'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.print_jobs; raise exception 'FOUT: service delete'; exception when insufficient_privilege then null; end $$;
-- failed -> queued mag (nieuwe poging), queued -> failed mag
reset role;
insert into public.print_jobs (tenant_id, printer_id, kind, payload_text, dedupe_key) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000002','bar','2 x Dry Martini','k7');
update public.print_jobs set status = 'failed', error = 'papier op' where dedupe_key = 'k7';
update public.print_jobs set status = 'queued', error = null where dedupe_key = 'k7';
-- printed zonder printed_at = geweigerd
do $$ begin update public.print_jobs set status = 'printed' where dedupe_key = 'k7'; raise exception 'FOUT: printed zonder tijdstip'; exception when check_violation then null; end $$;
select 'ALLE PRINT-1 SQL-TESTS GESLAAGD' as resultaat;

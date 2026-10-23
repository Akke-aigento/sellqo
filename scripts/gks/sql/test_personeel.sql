\set ON_ERROR_STOP 1
insert into public.tenants (id, name, business_modules) values ('11111111-1111-1111-1111-111111111111','Horeca A','{horeca}'), ('33333333-3333-3333-3333-333333333333','Horeca C','{horeca}') on conflict (id) do nothing;
insert into public.user_roles (user_id, role, tenant_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','staff','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000004','tenant_admin','11111111-1111-1111-1111-111111111111'),
 ('aaaaaaaa-0000-0000-0000-000000000005','tenant_admin','33333333-3333-3333-3333-333333333333');
select count(*) = 1 as ok_one_key from vault.secrets where name = 'kassa_insz_key';

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
select public.kassa_staff_save('11111111-1111-1111-1111-111111111111', null, 'Jan', 'waiter', null, '#112233', true, true, '1234') as jan \gset
select public.kassa_staff_save('11111111-1111-1111-1111-111111111111', null, 'An', 'bartender', null, null, true, true, '4321') as an \gset
select employee_no from public.pos_cashiers order by employee_no;
select public.kassa_staff_set_insz(:'jan', '84022899837') is not null as ok_insz_set;
do $$ begin perform public.kassa_staff_set_insz((select id from public.pos_cashiers where display_name='An'), '84022899838'); raise exception 'FOUT: ongeldig INSZ'; exception when sqlstate '22023' then null; end $$;
do $$ begin perform public.kassa_staff_save('11111111-1111-1111-1111-111111111111', null, 'X', 'waiter', null, null, true, true, '12'); raise exception 'FOUT: korte pin'; exception when sqlstate '22023' then null; end $$;
-- geheimen niet leesbaar, rechtstreeks schrijven niet toegestaan
do $$ begin perform pin_hash from public.pos_cashiers; raise exception 'FOUT: pin_hash leesbaar'; exception when insufficient_privilege then null; end $$;
do $$ begin perform insz_encrypted from public.pos_cashiers; raise exception 'FOUT: insz leesbaar'; exception when insufficient_privilege then null; end $$;
do $$ begin update public.pos_cashiers set display_name = 'Y'; raise exception 'FOUT: update'; exception when insufficient_privilege then null; end $$;
do $$ begin insert into public.pos_cashiers (tenant_id, display_name, pin_hash) values ('11111111-1111-1111-1111-111111111111','Z','x'); raise exception 'FOUT: insert'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from public.pos_cashiers; raise exception 'FOUT: delete'; exception when insufficient_privilege then null; end $$;
-- staff: mag niet beheren, wel inloggen
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin perform public.kassa_staff_save('11111111-1111-1111-1111-111111111111', null, 'Hack', 'owner', null, null, true, true, '9999'); raise exception 'FOUT: staff beheert'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_staff_set_insz((select id from public.pos_cashiers where display_name='Jan'), null); raise exception 'FOUT: staff zet insz'; exception when insufficient_privilege then null; end $$;
select (public.kassa_staff_login(:'jan', '1234', 'dev-1')) ->> 'employee_id' = '84022899837' as ok_login_returns_insz;
select (public.kassa_staff_login(:'an', '4321', 'dev-1')) ->> 'employee_id' is null as ok_no_insz_null;
select (public.kassa_staff_login(:'jan', '0000', 'dev-1')) ->> 'reason' = 'wrong_pin' as ok_wrong;
select public.kassa_staff_login(:'jan', '0000', 'dev-1') is not null, public.kassa_staff_login(:'jan', '0000', 'dev-1') is not null, public.kassa_staff_login(:'jan', '0000', 'dev-1') is not null;
select (public.kassa_staff_login(:'jan', '0000', 'dev-1')) ->> 'reason' = 'locked' as ok_locked_after_5;
select (public.kassa_staff_login(:'jan', '1234', 'dev-1')) ->> 'reason' = 'locked' as ok_still_locked_with_right_pin;
-- andere zaak: geen toegang
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
do $$ begin perform public.kassa_staff_login((select id from public.pos_cashiers limit 0), '1234'); raise exception 'FOUT: leeg'; exception when insufficient_privilege then null; end $$;
select count(*) = 0 as ok_other_tenant_sees_nothing from public.pos_cashiers;
reset role;
do $$ declare v uuid; begin select id into v from public.pos_cashiers where display_name='Jan';
  set local role authenticated; perform set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000005', true);
  perform public.kassa_staff_login(v, '1234'); raise exception 'FOUT: vreemde tenant login'; exception when insufficient_privilege then null; end $$;
reset role;
select count(*) = 5 as ok_audit_pin_failed from public.fiscal_audit_log where action = 'pin_failed';
select insz_encrypted is not null and position('84022899837' in encode(insz_encrypted,'escape')) = 0 as ok_encrypted_not_plain from public.pos_cashiers where display_name='Jan';
-- anon mag niets
set role anon;
do $$ begin perform 1 from public.pos_cashiers; raise exception 'FOUT: anon leest'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.kassa_staff_login(gen_random_uuid(), '1234'); raise exception 'FOUT: anon login'; exception when insufficient_privilege then null; end $$;
reset role;
\echo 'PERSONEEL-1: alle tests geslaagd'

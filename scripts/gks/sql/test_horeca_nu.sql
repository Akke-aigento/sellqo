\set ON_ERROR_STOP 1
-- HORECA-NU-1/2 — zone open/dicht, dagschotel, vandaag dicht en de kassa-functies van het Nu-paneel.
-- Draait na 20261104140000_horeca_nu_1.sql (2×). Zaak B (22222222-…): Els = eigenaar (…b1, PIN 1234),
-- Tom = ober (…b2, PIN 1234), toestel ac…a0 (11_horeca_nu_prelude.sql). Zaak U (b0000000-…01, UREN-1):
-- b1…01 = tenant_admin, b1…02 = staff. aaaaaaaa-…05 = tenant_admin van een andere zaak (33333333-…).
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate; end $$;
update public.pos_cashiers set pin_hash = crypt('1234', gen_salt('bf')), failed_pin_attempts = 0, locked_until = null
 where id in ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000b2');
update public.products set daily_special_until = null, sold_out_until = null where tenant_id = '22222222-2222-2222-2222-222222222222';
update public.dining_areas set is_open = true;
select count(*) as audit_before from public.fiscal_audit_log where action = 'kassa_now' \gset

-- ── 1. Kolommen: additief, met standaard ─────────────────────────────────────────────────────────────────
select bool_and(is_open) from public.dining_areas;
select column_default = 'true' and is_nullable = 'NO' from information_schema.columns where table_name = 'dining_areas' and column_name = 'is_open';
select is_nullable = 'YES' and column_default is null from information_schema.columns where table_name = 'products' and column_name = 'daily_special_until';

-- ── 2. Dagschotel in beheer (security invoker: RLS op products) ──────────────────────────────────────────
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.set_product_daily_special('eeeeeeee-0000-0000-0000-0000000000b3', true) = public.sold_out_reset_at();
select public.set_product_daily_special('eeeeeeee-0000-0000-0000-0000000000b1', true) is not null;
reset role;
select count(*) = 2 from public.products where tenant_id = '22222222-2222-2222-2222-222222222222' and daily_special_until > now();
-- Iemand van een andere zaak: geen product gevonden (RLS), niets gewijzigd; "allemaal uit" raakt 0 rijen.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
select pg_temp.try($$select public.set_product_daily_special('eeeeeeee-0000-0000-0000-0000000000b2', true)$$) = '42501';
select public.clear_daily_specials('22222222-2222-2222-2222-222222222222') = 0;
reset role;
select daily_special_until is null from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b2';
select count(*) = 2 from public.products where tenant_id = '22222222-2222-2222-2222-222222222222' and daily_special_until is not null;
-- De eigen zaak: één uit, dan allemaal uit.
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.set_product_daily_special('eeeeeeee-0000-0000-0000-0000000000b1', false) is null;
select public.clear_daily_specials('22222222-2222-2222-2222-222222222222') = 1;
reset role;
select count(*) = 0 from public.products where tenant_id = '22222222-2222-2222-2222-222222222222' and daily_special_until is not null;
-- anon mag geen enkele van de nieuwe functies.
select not has_function_privilege('anon', 'public.set_product_daily_special(uuid, boolean)', 'execute')
   and not has_function_privilege('anon', 'public.clear_daily_specials(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.business_hours_close_today(uuid, boolean, text)', 'execute')
   and not has_function_privilege('anon', 'public.kassa_now_state(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.kassa_now_apply(uuid, text, jsonb)', 'execute');

-- ── 3. Vandaag uitzonderlijk dicht (enkel tenant_admin) ──────────────────────────────────────────────────
update public.business_hours set closures = '[]', timezone = 'Europe/Brussels' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select to_char((now() at time zone 'Europe/Brussels')::date, 'YYYY-MM-DD') as today \gset
set role authenticated; set request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
select (public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', true, 'Personeel ziek') ->> 'closed')::boolean;
-- Twee keer dicht = één sluiting.
select (public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', true, null) ->> 'day') = :'today';
reset role;
select jsonb_array_length(closures) = 1 and closures -> 0 ->> 'from' = :'today' and closures -> 0 ->> 'reason' = 'Personeel ziek'
  from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select public.business_closures_valid(closures) from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
-- Medewerker (staff): geweigerd door RLS, niets gewijzigd.
set role authenticated; set request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000002';
-- Terug open: RLS laat de update stil weg; de functie meldt de echte stand (nog dicht), zo ziet de UI het.
select (public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', false) ->> 'closed')::boolean;
-- Dicht (upsert): RLS weigert met een fout.
select pg_temp.try($$select public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', true)$$) = '42501';
reset role;
select jsonb_array_length(closures) = 1 from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
-- Terug open: enkel de sluiting van één dag gaat weg; een periode rond vandaag blijft en wordt gemeld.
update public.business_hours set closures = closures || jsonb_build_array(jsonb_build_object('from', to_char(current_date - 1, 'YYYY-MM-DD'), 'to', to_char(current_date + 3, 'YYYY-MM-DD'), 'reason', 'Verlof'))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
set role authenticated; set request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
select public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', false) @> '{"closed": true, "period": true}';
reset role;
select jsonb_array_length(closures) = 1 and closures -> 0 ->> 'reason' = 'Verlof' from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.business_hours set closures = '[]' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
-- Zaak zonder rij in business_hours: dicht maakt de rij aan; terug open laat een lege lijst.
delete from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
set role authenticated; set request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
select (public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', true) ->> 'closed')::boolean;
select not (public.business_hours_close_today('b0000000-0000-0000-0000-000000000001', false) ->> 'closed')::boolean;
reset role;
select closures = '[]'::jsonb from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';

-- ── 4. Kassa: stand en handelingen ───────────────────────────────────────────────────────────────────────
select public.kassa_staff_session_start('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b1', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0') ->> 'token' as els_token \gset
select public.kassa_staff_session_start('22222222-2222-2222-2222-222222222222', '99999999-0000-0000-0000-0000000000b2', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0') ->> 'token' as tom_token \gset
create or replace function pg_temp.now_b(p jsonb) returns jsonb language sql as $$
  select public.kassa_now_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0', p) $$;
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000a0';
-- Stand: online bestellen staat aan (B), nog geen pauze.
select public.kassa_now_state('22222222-2222-2222-2222-222222222222') = '{"online": true, "paused_until": null}'::jsonb;
-- Het toestel van B mag de stand van een andere zaak niet lezen.
select pg_temp.try($$select public.kassa_now_state('11111111-1111-1111-1111-111111111111')$$) = '42501';
-- Eigenaar met eigen sessietoken: meteen.
select (pg_temp.now_b(jsonb_build_object('kind', 'pause', 'minutes', 15, 'staff_id', '99999999-0000-0000-0000-0000000000b1', 'staff_token', :'els_token')) ->> 'ok')::boolean;
select (public.kassa_now_state('22222222-2222-2222-2222-222222222222') ->> 'paused_until')::timestamptz between now() + interval '14 minutes' and now() + interval '16 minutes';
-- Ober met eigen token: geen eigenaar → akkoord nodig.
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000b2","open":false,"staff_id":"99999999-0000-0000-0000-0000000000b2","staff_token":"%s"}')$$, :'tom_token')) = '42501';
-- Token van Els, maar staff_id van Tom (of andersom): geen uitzondering.
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000b2","open":false,"staff_id":"99999999-0000-0000-0000-0000000000b2","staff_token":"%s"}')$$, :'els_token')) = '42501';
-- Ober als goedkeurder: geweigerd. Verkeerde PIN van Els: niets, poging geteld.
select pg_temp.try($$select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000b2","open":false,"approver_id":"99999999-0000-0000-0000-0000000000b2","pin":"1234"}')$$) = '42501';
select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000b2","open":false,"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"0000","staff_id":"99999999-0000-0000-0000-0000000000b2"}') ->> 'reason' = 'wrong_pin';
reset role;
select is_open from public.dining_areas where id = 'a7000000-0000-0000-0000-0000000000b2';
select failed_pin_attempts = 1 from public.pos_cashiers where id = '99999999-0000-0000-0000-0000000000b1';
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000a0';
-- Ober start, Els keurt goed met PIN: terras dicht.
select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000b2","open":false,"approver_id":"99999999-0000-0000-0000-0000000000b1","pin":"1234","staff_id":"99999999-0000-0000-0000-0000000000b2"}') @> '{"ok": true, "open": false}';
-- Dagschotel aan, op voor vandaag, alles uit.
select (pg_temp.now_b(jsonb_build_object('kind', 'special', 'product_id', 'eeeeeeee-0000-0000-0000-0000000000b3', 'on', true, 'staff_id', '99999999-0000-0000-0000-0000000000b1', 'staff_token', :'els_token')) ->> 'until')::timestamptz = public.sold_out_reset_at();
select (pg_temp.now_b(jsonb_build_object('kind', 'sold_out', 'product_id', 'eeeeeeee-0000-0000-0000-0000000000b1', 'sold_out', true, 'staff_id', '99999999-0000-0000-0000-0000000000b1', 'staff_token', :'els_token')) ->> 'ok')::boolean;
reset role;
select is_open = false from public.dining_areas where id = 'a7000000-0000-0000-0000-0000000000b2';
select is_open from public.dining_areas where id = 'a7000000-0000-0000-0000-0000000000b1';
select daily_special_until > now() from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b3';
select sold_out_until > now() from public.products where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000a0';
select (pg_temp.now_b(jsonb_build_object('kind', 'special_clear', 'staff_id', '99999999-0000-0000-0000-0000000000b1', 'staff_token', :'els_token')) ->> 'cleared')::int = 1;
-- Hervatten.
select (pg_temp.now_b(jsonb_build_object('kind', 'pause', 'minutes', 0, 'staff_id', '99999999-0000-0000-0000-0000000000b1', 'staff_token', :'els_token')) ->> 'paused_until') is null;
-- Weigeringen: ruimte en product van een andere zaak, onbekende handeling, foute minuten, een ander toestel-ID.
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"area","area_id":"a7000000-0000-0000-0000-0000000000a1","open":false,"staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$, :'els_token')) = '22023';
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"special","product_id":"%s","on":true,"staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$,
  (select id from public.products where tenant_id = '33333333-3333-3333-3333-333333333333' limit 1), :'els_token')) = '22023';
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"price","staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$, :'els_token')) = '22023';
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"pause","minutes":45,"staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$, :'els_token')) = '22023';
select pg_temp.try(format($$select public.kassa_now_apply('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000999', '{"kind":"pause","minutes":0,"staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$, :'els_token')) = '42501';
-- Een toestel van zaak B voor zaak A: geweigerd.
select pg_temp.try($$select public.kassa_now_apply('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000a0', '{"kind":"pause","minutes":0}')$$) = '42501';
reset role;
-- Een ingetrokken sessietoken telt niet meer.
update public.kassa_staff_sessions set revoked_at = now() where token_hash = encode(digest(:'els_token', 'sha256'), 'hex');
set role authenticated; set request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000a0';
select pg_temp.try(format($$select pg_temp.now_b('{"kind":"pause","minutes":0,"staff_id":"99999999-0000-0000-0000-0000000000b1","staff_token":"%s"}')$$, :'els_token')) = '42501';
reset role;
-- Spoor: zes geslaagde handelingen, met soort en goedkeurder; append-only.
select count(*) = :audit_before + 6 from public.fiscal_audit_log where action = 'kassa_now';
select details ->> 'kind' = 'area' and details ->> 'approver_id' = '99999999-0000-0000-0000-0000000000b1' and details ->> 'staff_id' = '99999999-0000-0000-0000-0000000000b2'
  from public.fiscal_audit_log where action = 'kassa_now' and details ->> 'kind' = 'area' order by created_at desc limit 1;
select count(*) >= 1 from public.fiscal_audit_log where action = 'pin_failed' and details ->> 'context' = 'kassa_now';
update public.dining_areas set is_open = true;
select 'HORECA-NU-1/2: alle tests geslaagd';

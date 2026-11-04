\set ON_ERROR_STOP 1
-- UREN-1 — business_hours (constraints, RLS), de kopie van oude sluitingsdagen en reservation_slots per keuze.
-- Spelers: A = tenant_admin van U, S = staff van U, O = tenant_admin van een andere zaak V.
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.times(j jsonb) returns text language sql as $$
  select coalesce(string_agg(x ->> 'time', ',' order by ord), '') from jsonb_array_elements(j -> 'slots') with ordinality as t(x, ord) $$;

reset role;
insert into public.user_roles (user_id, role, tenant_id) values
  ('b1000000-0000-0000-0000-000000000001', 'tenant_admin', 'b0000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002', 'staff', 'b0000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000003', 'tenant_admin', 'b0000000-0000-0000-0000-000000000002');

-- ── 1. Kopie van de oude sluitingsdagen: enkel de komende, één keer ──────────────────────────────────────
select (select closures from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001')
     = jsonb_build_array(jsonb_build_object('from', to_char(current_date + 5, 'YYYY-MM-DD'), 'to', to_char(current_date + 5, 'YYYY-MM-DD'), 'reason', null))
  as ok_kopie_enkel_komend_en_een_keer;
select (select closed_dates from public.fulfillment_settings where tenant_id = 'b0000000-0000-0000-0000-000000000001') = array[current_date + 5, current_date - 1]
  as ok_oude_kolom_ongemoeid;

-- ── 2. Constraints ─────────────────────────────────────────────────────────────────────────────────────
select pg_temp.try($q$update public.business_hours set week = '{"7": [["10:00","11:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_dag_7_geweigerd;
select pg_temp.try($q$update public.business_hours set week = '{"1": [["10:00","10:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_leeg_blok_geweigerd;
select pg_temp.try($q$update public.business_hours set week = '{"1": [["10:00","11:00"],["12:00","13:00"],["14:00","15:00"],["16:00","17:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_max_drie_blokken;
select pg_temp.try($q$update public.business_hours set week = '{"1": [["9:00","11:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_uur_met_twee_cijfers;
select pg_temp.try($q$update public.business_hours set closures = '[{"from":"2026-12-26","to":"2026-12-24"}]' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_periode_omgekeerd_geweigerd;
select pg_temp.try($q$update public.business_hours set closures = '[{"from":"2026-02-30","to":"2026-03-01"}]' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_onbestaande_datum_geweigerd;
select pg_temp.try($q$update public.business_hours set closures = jsonb_build_array(jsonb_build_object('from','2026-12-24','to','2026-12-24','reason', repeat('x', 81))) where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_reden_max_80;
select pg_temp.try($q$update public.business_hours set timezone = 'Europe/Brussels; drop' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_tijdzone_gecontroleerd;
select pg_temp.try($q$update public.business_hours set week = '{"6": [["20:00","02:00"]]}', closures = '[{"from":"2026-12-24","to":"2026-12-26","reason":"Kerst"}]' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) = 'ok' as ok_over_middernacht_en_periode_mag;

-- ── 3. RLS ─────────────────────────────────────────────────────────────────────────────────────────────
set role anon;
select pg_temp.try($q$select count(*) from public.business_hours$q$) like '42501%' as ok_anon_kan_niet_lezen;
reset role;
set role authenticated;
select pg_temp.as_user('b1000000-0000-0000-0000-000000000002');
select (select count(*) from public.business_hours) = 1 as ok_staff_leest_eigen_zaak;
select pg_temp.try($q$update public.business_hours set week = '{}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) = 'ok' as ok_staff_update_geen_fout;
reset role;
select (select week from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001') = '{"6": [["20:00","02:00"]]}'::jsonb as ok_staff_wijzigde_niets;
set role authenticated;
select pg_temp.as_user('b1000000-0000-0000-0000-000000000003');
select (select count(*) from public.business_hours) = 0 as ok_andere_zaak_ziet_niets;
select pg_temp.try($q$insert into public.business_hours (tenant_id, week) values ('b0000000-0000-0000-0000-000000000001', '{}') on conflict (tenant_id) do update set week = excluded.week$q$) like '42501%' as ok_andere_zaak_kan_niet_schrijven;
select pg_temp.try($q$insert into public.business_hours (tenant_id, week) values ('b0000000-0000-0000-0000-000000000002', '{"1": [["10:00","18:00"]]}')$q$) = 'ok' as ok_eigen_zaak_schrijven;
select pg_temp.as_user('b1000000-0000-0000-0000-000000000001');
-- Zoals de app: upsert op tenant_id.
select pg_temp.try($q$insert into public.business_hours (tenant_id, week, closures) values ('b0000000-0000-0000-0000-000000000001', '{}', '[]') on conflict (tenant_id) do update set week = excluded.week, closures = excluded.closures$q$) = 'ok' as ok_beheerder_upsert;
reset role;
select pg_temp.try($q$select public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date)$q$) = 'ok' as ok_service_kan_slots;
select not has_function_privilege('authenticated', 'public.reservation_slots(uuid, date)', 'execute')
   and not has_function_privilege('anon', 'public.reservation_slots(uuid, date)', 'execute') as ok_slots_enkel_service_role;

-- ── 4. reservation_slots per keuze ─────────────────────────────────────────────────────────────────────
-- Alle dagen 10:00–12:00 open; online elk uur, geen minimale termijn; datum = overmorgen.
update public.business_hours set week = (select jsonb_object_agg(d::text, '[["10:00","12:00"]]'::jsonb) from generate_series(0, 6) d), closures = '[]'
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
insert into public.reservation_settings (tenant_id, online_enabled, slot_minutes, min_notice_minutes, online_hours)
values ('b0000000-0000-0000-0000-000000000001', true, 60, 0, '{}')
on conflict (tenant_id) do update set online_enabled = true, slot_minutes = 60, min_notice_minutes = 0, online_hours = '{}', online_hours_mode = null;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00,11:00' as ok_nieuw_zelfde_als_openingsuren_tot_voor_sluiten;
update public.reservation_settings set online_hours = (select jsonb_object_agg(d::text, '[["18:00","19:00"]]'::jsonb) from generate_series(0, 6) d)
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '18:00,19:00' as ok_bestaande_eigen_uren_blijven;
update public.reservation_settings set online_hours_mode = 'business' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00,11:00' as ok_keuze_zelfde_als_wint;
update public.reservation_settings set online_hours_mode = 'own' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '18:00,19:00' as ok_keuze_eigen_uren;
-- Sluitingsperiode over de datum: dicht, ook bij eigen uren.
update public.business_hours set closures = jsonb_build_array(jsonb_build_object('from', to_char(current_date + 1, 'YYYY-MM-DD'), 'to', to_char(current_date + 3, 'YYYY-MM-DD'), 'reason', 'Verlof'))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '' as ok_sluitingsperiode_dicht;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 4)) = '18:00,19:00' as ok_dag_na_periode_open;
-- De oude kolom closed_dates telt niet meer mee (bron = business_hours).
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 5)) = '18:00,19:00' as ok_oude_closed_dates_genegeerd;
-- Over middernacht (zelfde als openingsuren): staart van gisteren 00:00 + vandaag 22:00, 23:00.
update public.business_hours set closures = '[]', week = (select jsonb_object_agg(d::text, '[["22:00","01:00"]]'::jsonb) from generate_series(0, 6) d)
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.reservation_settings set online_hours_mode = 'business' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '00:00,22:00,23:00' as ok_over_middernacht;
-- Zonder openingsuren en zonder eigen uren: geen tijdstippen (de beheerpagina waarschuwt).
delete from public.business_hours where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.reservation_settings set online_hours_mode = null, online_hours = '{}' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '' as ok_zonder_uren_geen_slots;
select (public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2) ->> 'enabled')::boolean as ok_wel_enabled;
select 'UREN-1: alle controles gedraaid' as klaar;

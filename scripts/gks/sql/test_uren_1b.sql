\set ON_ERROR_STOP 1
-- UREN-1b — laatste aankomst vóór sluiting (online_last_arrival_minutes) en de nieuwe schakelaars.
-- Draait na test_uren.sql (zaak U b0…0001 met online reserveren aan, slot 60 min, termijn 0).
create or replace function pg_temp.times(j jsonb) returns text language sql as $$
  select coalesce(string_agg(x ->> 'time', ',' order by ord), '') from jsonb_array_elements(j -> 'slots') with ordinality as t(x, ord) $$;
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
reset role;
insert into public.business_hours (tenant_id, week, closures) values ('b0000000-0000-0000-0000-000000000001',
  (select jsonb_object_agg(d::text, '[["10:00","12:00"]]'::jsonb) from generate_series(0, 6) d), '[]')
on conflict (tenant_id) do update set week = excluded.week, closures = '[]';
update public.reservation_settings set online_hours_mode = 'business', online_hours = '{}', online_last_arrival_minutes = 0, slot_minutes = 60, min_notice_minutes = 0
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select (select online_last_arrival_minutes from public.reservation_settings where tenant_id = 'b0000000-0000-0000-0000-000000000001') = 0 as ok_standaard_0;
select (select qr_block_outside_hours = false and online_block_outside_hours = false from public.fulfillment_settings where tenant_id = 'b0000000-0000-0000-0000-000000000001') as ok_schakelaars_standaard_toegestaan;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00,11:00' as ok_marge_0_tot_voor_sluiten;
update public.reservation_settings set online_last_arrival_minutes = 60 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00,11:00' as ok_marge_60_laatste_11u;
update public.reservation_settings set online_last_arrival_minutes = 90 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00' as ok_marge_90_laatste_10u30;
update public.reservation_settings set online_last_arrival_minutes = 120 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '10:00' as ok_marge_120_enkel_openingsuur;
-- Eigen uren: de marge telt niet (het laatste aankomstuur vul je zelf in).
update public.reservation_settings set online_hours_mode = 'own', online_hours = (select jsonb_object_agg(d::text, '[["18:00","19:00"]]'::jsonb) from generate_series(0, 6) d)
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '18:00,19:00' as ok_eigen_uren_zonder_marge;
-- Over middernacht 22:00–01:00, marge 60: laatste aankomst 00:00 (staart), marge 120: laatste 23:00.
update public.business_hours set week = (select jsonb_object_agg(d::text, '[["22:00","01:00"]]'::jsonb) from generate_series(0, 6) d)
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.reservation_settings set online_hours_mode = 'business', online_last_arrival_minutes = 60 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '00:00,22:00,23:00' as ok_middernacht_marge_60;
update public.reservation_settings set online_last_arrival_minutes = 120 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '22:00,23:00' as ok_middernacht_marge_120;
update public.reservation_settings set online_last_arrival_minutes = 0 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', current_date + 2)) = '00:00,22:00,23:00' as ok_middernacht_marge_0_zoals_uren_1;
select pg_temp.try($q$update public.reservation_settings set online_last_arrival_minutes = 601 where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_marge_max_600;
select 'UREN-1b: alle controles gedraaid' as klaar;

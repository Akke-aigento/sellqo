\set ON_ERROR_STOP 1
-- UREN-1c — sluitingsdag rond middernacht ("een blok hoort bij zijn startdag"), "night" bij de staart van
-- gisteren, tijdzone uit business_hours eerst, en de tijdzone-trigger. Draait na test_uren_1b.sql
-- (zaak U b0…0001, online reserveren aan, slot 60 min, termijn 0, 30 dagen vooruit).
create or replace function pg_temp.times(j jsonb) returns text language sql as $$
  select coalesce(string_agg(x ->> 'time', ',' order by ord), '') from jsonb_array_elements(j -> 'slots') with ordinality as t(x, ord) $$;
create or replace function pg_temp.nights(j jsonb) returns text language sql as $$
  select coalesce(string_agg(x ->> 'time', ',' order by ord), '') from jsonb_array_elements(j -> 'slots') with ordinality as t(x, ord)
   where (x ->> 'night')::boolean is true $$;
create or replace function pg_temp.try(sql text) returns text language plpgsql as $$ begin execute sql; return 'ok'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
-- Eerstvolgende zaterdag en zondag minstens 2 dagen vooruit (zondag = zaterdag + 1).
create or replace function pg_temp.sat() returns date language sql as $$
  select d::date from generate_series(current_date + 2, current_date + 9, interval '1 day') d where extract(dow from d) = 6 limit 1 $$;
reset role;
update public.reservation_settings set online_hours_mode = 'business', online_hours = '{}', online_last_arrival_minutes = 0, slot_minutes = 60,
  min_notice_minutes = 0, days_ahead = 30 where tenant_id = 'b0000000-0000-0000-0000-000000000001';

-- 1. za 20:00–02:00, zondag gesloten: de staart op zondag blijft (startdag zaterdag is open).
update public.business_hours set week = '{"6": [["20:00","02:00"]]}', closures = jsonb_build_array(jsonb_build_object('from', pg_temp.sat() + 1, 'to', pg_temp.sat() + 1))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat() + 1)) = '00:00,01:00' as ok_za_open_zo_dicht_staart_blijft;
select pg_temp.nights(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat() + 1)) = '00:00,01:00' as ok_staart_heeft_night;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat())) = '20:00,21:00,22:00,23:00' as ok_zaterdag_zelf_open;
select pg_temp.nights(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat())) = '' as ok_avond_zonder_night;

-- 2. vr 20:00–02:00, zaterdag gesloten: de staart op zaterdag blijft.
update public.business_hours set week = '{"5": [["20:00","02:00"]]}', closures = jsonb_build_array(jsonb_build_object('from', pg_temp.sat(), 'to', pg_temp.sat()))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat())) = '00:00,01:00' as ok_vr_open_za_dicht_staart_blijft;

-- 3. Startdag gesloten: za 20:00–02:00 met zaterdag dicht → ook geen staart op zondag.
update public.business_hours set week = '{"6": [["20:00","02:00"]]}', closures = jsonb_build_array(jsonb_build_object('from', pg_temp.sat(), 'to', pg_temp.sat()))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat())) = '' as ok_startdag_dicht_avond_weg;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat() + 1)) = '' as ok_startdag_dicht_staart_weg;

-- 4. Eigen uren: de sluitingsdag van vandaag geldt nog altijd.
update public.reservation_settings set online_hours_mode = 'own', online_hours = '{"0": [["12:00","13:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.business_hours set closures = jsonb_build_array(jsonb_build_object('from', pg_temp.sat() + 1, 'to', pg_temp.sat() + 1))
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat() + 1)) = '' as ok_eigen_uren_sluitingsdag;
update public.business_hours set closures = '[]' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat() + 1)) = '12:00,13:00' as ok_eigen_uren_open;
update public.reservation_settings set online_hours_mode = 'business', online_hours = '{}' where tenant_id = 'b0000000-0000-0000-0000-000000000001';

-- 5. Tijdzone: business_hours eerst, dan fulfillment_settings. Een uur op 'Pacific/Kiritimati' (UTC+14)
--    valt op een andere UTC-tijd dan in Brussel; de telling van een reservatie toont welke zone gebruikt is.
update public.business_hours set week = '{"6": [["10:00","11:00"]]}', closures = '[]', timezone = 'Pacific/Kiritimati'
 where tenant_id = 'b0000000-0000-0000-0000-000000000001';
update public.fulfillment_settings set timezone = 'Europe/Brussels' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
insert into public.table_reservations (tenant_id, name, guests, starts_at, status)
values ('b0000000-0000-0000-0000-000000000001', 'TZ', 3, (pg_temp.sat() + time '10:00') at time zone 'Pacific/Kiritimati', 'booked');
select (public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat()) -> 'slots' -> 0 ->> 'left')::int
     = (select max_guests_per_slot - 3 from public.reservation_settings where tenant_id = 'b0000000-0000-0000-0000-000000000001') as ok_tijdzone_uit_business_hours;
delete from public.table_reservations where name = 'TZ' and tenant_id = 'b0000000-0000-0000-0000-000000000001';

-- 6. Trigger: een onbekende tijdzone wordt geweigerd (23514), een echte niet.
select pg_temp.try($q$update public.business_hours set timezone = 'Europe/Leuven' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) like '23514%' as ok_onbekende_tijdzone_geweigerd;
select pg_temp.try($q$update public.business_hours set timezone = 'Europe/Amsterdam' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) = 'ok' as ok_echte_tijdzone_aanvaard;
select pg_temp.try($q$update public.business_hours set week = '{}' where tenant_id = 'b0000000-0000-0000-0000-000000000001'$q$) = 'ok' as ok_trigger_enkel_bij_tijdzone;
-- Een foute waarde die er toch in raakt (bv. van vóór de trigger) laat reservation_slots niet falen.
alter table public.business_hours disable trigger trg_business_hours_timezone;
update public.business_hours set timezone = 'Europe/Leuven', week = '{"6": [["10:00","11:00"]]}' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
alter table public.business_hours enable trigger trg_business_hours_timezone;
select pg_temp.times(public.reservation_slots('b0000000-0000-0000-0000-000000000001', pg_temp.sat())) = '10:00' as ok_foute_tijdzone_valt_terug;
update public.business_hours set timezone = 'Europe/Brussels' where tenant_id = 'b0000000-0000-0000-0000-000000000001';
select 'UREN-1c: alle controles gedraaid' as klaar;

-- UREN-1b — vervolg op UREN-1 (zelfde batch, 2026.15d).
--  1. reservation_settings.online_last_arrival_minutes: bij "Zelfde als openingsuren" hoe lang vóór sluiting de
--     laatste aankomst kan. 0 (standaard) = tot net vóór sluiting, zoals UREN-1. >0 = laatste aankomst op of vóór
--     (sluiting − marge). Geldt niet voor "Eigen uren" (daar vul je het laatste aankomstuur zelf in).
--  2. fulfillment_settings.qr_block_outside_hours / online_block_outside_hours: bestellen buiten de openingsuren
--     niet toestaan (QR aan tafel / afhalen en leveren "zo snel mogelijk"). Standaard false = het gedrag van vandaag
--     (toegestaan). Afgedwongen in storefront-api; hier enkel de kolommen.
--  3. UREN-1c: reservation_slots volgt de regel "een blok hoort bij zijn startdag" bij sluitingsdagen, markeert
--     uren uit de staart van gisteren met "night": true, en neemt de tijdzone uit business_hours eerst.
-- Idempotent. Handmatig terugdraaien:
--   reservation_slots: de definitie uit 20261104120000_uren_1.sql opnieuw uitvoeren;
--   de drie kolommen mogen blijven staan (standaardwaarden = gedrag van vóór deze migratie).

alter table public.reservation_settings add column if not exists online_last_arrival_minutes integer not null default 0;
alter table public.fulfillment_settings add column if not exists qr_block_outside_hours boolean not null default false;
alter table public.fulfillment_settings add column if not exists online_block_outside_hours boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reservation_settings_last_arrival_check') then
    alter table public.reservation_settings add constraint reservation_settings_last_arrival_check
      check (online_last_arrival_minutes between 0 and 600);
  end if;
end $$;

-- reservation_slots: zoals UREN-1, met de marge. Rekent in minuten vanaf p_date 00:00 (lokaal); een blok over
-- middernacht loopt tot (sluiting + 1440). Gisteren telt mee voor de staart na middernacht.
-- UREN-1c — één regel voor sluitingsdagen, zoals storefront-api en de site: een blok hoort bij zijn startdag.
--   Is de startdag gesloten, dan vervalt het hele blok (ook het deel na middernacht): de blokken van vandaag
--   (v_off = 0) toetsen p_date, de staart van gisteren (v_off = -1440) toetst p_date - 1. Is enkel vandaag
--   gesloten, dan blijft de staart van gisteren staan. Eigen uren hebben geen staart: daar toetst p_date.
--   Elk uur uit de staart van gisteren krijgt "night": true (additief), zodat de site "(nacht van gisteren)" toont.
--   Tijdzone: business_hours.timezone, dan fulfillment_settings.timezone, dan Europe/Brussels (één bron,
--   zoals storefront-api); een onbekende waarde valt terug op Europe/Brussels in plaats van te falen.
create or replace function public.reservation_slots(p_tenant_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  s public.reservation_settings%rowtype;
  bh public.business_hours%rowtype;
  v_tz text;
  v_today date;
  v_mode text;
  v_margin integer;
  v_ranges jsonb;
  v_range jsonb;
  v_off integer;      -- 0 = blokken van vandaag, -1440 = blokken van gisteren
  v_a integer;
  v_b integer;
  v_e integer;
  v_t integer;
  v_incl boolean;
  v_closed_today boolean;
  v_closed_yday boolean;
  v_cands integer[] := '{}';  -- minuten vanaf p_date 00:00, binnen [0, 1440)
  v_day integer[] := '{}';    -- uit de blokken van vandaag
  v_night integer[] := '{}';  -- uit de staart van gisteren
  v_m integer;
  v_time time;
  v_at timestamptz;
  v_taken integer;
  v_slots jsonb := '[]'::jsonb;
begin
  select * into s from public.reservation_settings where tenant_id = p_tenant_id;
  if s.tenant_id is null or not s.online_enabled then
    return jsonb_build_object('enabled', false, 'slots', '[]'::jsonb);
  end if;
  select * into bh from public.business_hours where tenant_id = p_tenant_id;
  v_tz := nullif(bh.timezone, '');
  if v_tz is null then
    select nullif(f.timezone, '') into v_tz from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  end if;
  v_tz := coalesce(v_tz, 'Europe/Brussels');
  begin
    v_today := (now() at time zone v_tz)::date;
  exception when others then
    v_tz := 'Europe/Brussels';
    v_today := (now() at time zone v_tz)::date;
  end;
  if p_date is null or p_date < v_today or p_date > v_today + s.days_ahead then
    return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', '[]'::jsonb);
  end if;
  v_closed_today := exists (select 1 from jsonb_array_elements(coalesce(bh.closures, '[]'::jsonb)) c
                             where p_date between (c ->> 'from')::date and (c ->> 'to')::date);
  v_closed_yday := exists (select 1 from jsonb_array_elements(coalesce(bh.closures, '[]'::jsonb)) c
                            where p_date - 1 between (c ->> 'from')::date and (c ->> 'to')::date);

  v_mode := coalesce(s.online_hours_mode, case when public.hours_week_has_ranges(s.online_hours) then 'own' else 'business' end);
  if v_mode = 'own' then
    -- Eigen uren: eerste en laatste aankomstuur, beide inbegrepen (RESERVATIE-2). Geen staart over middernacht.
    if v_closed_today then
      return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', '[]'::jsonb);
    end if;
    v_ranges := coalesce(s.online_hours -> extract(dow from p_date)::int::text, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
    for v_range in select * from jsonb_array_elements(v_ranges) loop
      begin
        v_a := extract(epoch from (v_range ->> 0)::time)::int / 60;
        v_b := extract(epoch from (v_range ->> 1)::time)::int / 60;
      exception when others then
        continue;
      end;
      v_t := v_a;
      while v_t <= v_b and v_t < 1440 loop
        v_cands := v_cands || v_t;
        v_t := v_t + s.slot_minutes;
      end loop;
    end loop;
  else
    -- Zelfde als openingsuren: van openen tot (sluiting − marge); marge 0 = tot net vóór sluiting.
    v_margin := coalesce(s.online_last_arrival_minutes, 0);
    v_incl := v_margin > 0;
    foreach v_off in array array[0, -1440] loop
      -- Een blok hoort bij zijn startdag: is die gesloten, dan vervalt het hele blok.
      if (v_off = 0 and v_closed_today) or (v_off < 0 and v_closed_yday) then continue; end if;
      v_ranges := coalesce(bh.week -> ((extract(dow from p_date)::int + case when v_off = 0 then 0 else 6 end) % 7)::text, '[]'::jsonb);
      if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
      for v_range in select * from jsonb_array_elements(v_ranges) loop
        begin
          v_a := extract(epoch from (v_range ->> 0)::time)::int / 60;
          v_b := extract(epoch from (v_range ->> 1)::time)::int / 60;
        exception when others then
          continue;
        end;
        if v_b <= v_a then v_b := v_b + 1440; end if;   -- over middernacht
        if v_off < 0 and v_b <= 1440 then continue; end if; -- gisteren zonder staart: niets voor vandaag
        v_e := v_b - v_margin;
        v_t := v_a;
        while (v_incl and v_t <= v_e) or (not v_incl and v_t < v_e) loop
          v_m := v_t + v_off;
          if v_m >= 0 and v_m < 1440 then
            if not (v_m = any(v_cands)) then v_cands := v_cands || v_m; end if;
            if v_off = 0 then v_day := v_day || v_m; else v_night := v_night || v_m; end if;
          end if;
          v_t := v_t + s.slot_minutes;
        end loop;
      end loop;
    end loop;
  end if;

  for v_m in select distinct x from unnest(v_cands) x order by x loop
    v_time := make_time(v_m / 60, v_m % 60, 0);
    v_at := (p_date + v_time) at time zone v_tz;
    if v_at >= now() + make_interval(mins => s.min_notice_minutes) then
      select coalesce(sum(r.guests), 0) into v_taken from public.table_reservations r
       where r.tenant_id = p_tenant_id and r.starts_at = v_at and r.status in ('requested', 'booked', 'seated');
      if v_taken < s.max_guests_per_slot then
        v_slots := v_slots || jsonb_build_array(
          jsonb_build_object('time', to_char(v_time, 'HH24:MI'), 'left', s.max_guests_per_slot - v_taken)
          || case when v_m = any(v_night) and not (v_m = any(v_day)) then '{"night": true}'::jsonb else '{}'::jsonb end);
      end if;
    end if;
  end loop;
  return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', v_slots);
end
$fn$;
revoke all on function public.reservation_slots(uuid, date) from public, anon, authenticated;
grant execute on function public.reservation_slots(uuid, date) to service_role;

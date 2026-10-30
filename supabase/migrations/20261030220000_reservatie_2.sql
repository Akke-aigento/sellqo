-- RESERVATIE-2 — online reserveren door gasten (aanvraag, het personeel bevestigt).
--
-- Bouwt verder op RESERVATIE-1. De regel blijft: een reservatie raakt nooit een rekening.
--  * table_reservations: e-mail, bron (staff/online), aanvraag-id (idempotent), mail verstuurd;
--    status + 'requested' (aangevraagd, nog niet bevestigd) en 'declined' (geweigerd).
--  * reservation_settings: online aan/uit (standaard UIT), uren per weekdag, kwartier/halfuur,
--    max. personen per tijdstip, grootste gezelschap, dagen vooruit, minimale termijn.
--  * reservation_slots(tenant, datum): vrije tijdstippen (storefront-api, service role).
--  * reservation_request_place(tenant, aanvraag): valideert alles opnieuw, remt bij drukte,
--    is idempotent op request_id, maakt de aanvraag + een melding in het belletje.
--  * Trigger: bij bevestigen of weigeren van een online aanvraag een mail naar de gast
--    (edge function reservation-mail, X-Internal-Secret). Een mislukte mail houdt niets tegen.
-- Idempotent. Handmatig terugdraaien:
--   drop trigger trg_table_reservations_mail on public.table_reservations;
--   drop function public.reservation_mail_tr(), public.reservation_request_place(uuid, jsonb), public.reservation_slots(uuid, date);
--   status-check terug naar ('booked','seated','cancelled','no_show') (enkel zonder rijen met de nieuwe statussen);
--   de nieuwe kolommen mogen blijven staan.

alter table public.table_reservations add column if not exists email text check (email is null or char_length(email) <= 200);
alter table public.table_reservations add column if not exists source text not null default 'staff' check (source in ('staff', 'online'));
alter table public.table_reservations add column if not exists request_id uuid;
alter table public.table_reservations add column if not exists mail_sent_at timestamptz;
create unique index if not exists table_reservations_request_uq on public.table_reservations (tenant_id, request_id) where request_id is not null;
alter table public.table_reservations drop constraint if exists table_reservations_status_check;
alter table public.table_reservations add constraint table_reservations_status_check
  check (status in ('requested', 'booked', 'seated', 'cancelled', 'no_show', 'declined'));

alter table public.reservation_settings add column if not exists online_enabled boolean not null default false;
-- {"0": [["12:00","14:00"]], "5": [["18:00","21:30"]]}: weekdag 0 = zondag; eerste en laatste aankomstuur.
alter table public.reservation_settings add column if not exists online_hours jsonb not null default '{}'::jsonb;
alter table public.reservation_settings add column if not exists slot_minutes integer not null default 15 check (slot_minutes in (15, 30, 60));
alter table public.reservation_settings add column if not exists max_guests_per_slot integer not null default 20 check (max_guests_per_slot between 1 and 500);
alter table public.reservation_settings add column if not exists max_party integer not null default 8 check (max_party between 1 and 99);
alter table public.reservation_settings add column if not exists days_ahead integer not null default 30 check (days_ahead between 1 and 365);
alter table public.reservation_settings add column if not exists min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 10080);

-- Vrije tijdstippen op één dag. Een tijdstip is vrij als de som van de personen van aangevraagde,
-- geboekte en aangekomen reservaties op dat uur onder het maximum blijft.
create or replace function public.reservation_slots(p_tenant_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  s public.reservation_settings%rowtype;
  v_tz text;
  v_today date;
  v_ranges jsonb;
  v_range jsonb;
  v_t time;
  v_end time;
  v_at timestamptz;
  v_taken integer;
  v_slots jsonb := '[]'::jsonb;
begin
  select * into s from public.reservation_settings where tenant_id = p_tenant_id;
  if s.tenant_id is null or not s.online_enabled then
    return jsonb_build_object('enabled', false, 'slots', '[]'::jsonb);
  end if;
  select coalesce(nullif(f.timezone, ''), 'Europe/Brussels') into v_tz from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  v_tz := coalesce(v_tz, 'Europe/Brussels');
  v_today := (now() at time zone v_tz)::date;
  if p_date is null or p_date < v_today or p_date > v_today + s.days_ahead
     or exists (select 1 from public.fulfillment_settings f where f.tenant_id = p_tenant_id and p_date = any(f.closed_dates)) then
    return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', '[]'::jsonb);
  end if;
  v_ranges := coalesce(s.online_hours -> extract(dow from p_date)::int::text, '[]'::jsonb);
  if jsonb_typeof(v_ranges) <> 'array' then v_ranges := '[]'::jsonb; end if;
  for v_range in select * from jsonb_array_elements(v_ranges) loop
    begin
      v_t := (v_range ->> 0)::time;
      v_end := (v_range ->> 1)::time;
    exception when others then
      continue;
    end;
    while v_t <= v_end loop
      v_at := (p_date + v_t) at time zone v_tz;
      if v_at >= now() + make_interval(mins => s.min_notice_minutes) then
        select coalesce(sum(r.guests), 0) into v_taken from public.table_reservations r
         where r.tenant_id = p_tenant_id and r.starts_at = v_at and r.status in ('requested', 'booked', 'seated');
        if v_taken < s.max_guests_per_slot then
          v_slots := v_slots || jsonb_build_array(jsonb_build_object('time', to_char(v_t, 'HH24:MI'), 'left', s.max_guests_per_slot - v_taken));
        end if;
      end if;
      exit when v_t + make_interval(mins => s.slot_minutes) <= v_t; -- over middernacht: stoppen
      v_t := v_t + make_interval(mins => s.slot_minutes);
    end loop;
  end loop;
  return jsonb_build_object('enabled', true, 'max_party', s.max_party, 'days_ahead', s.days_ahead, 'slots', v_slots);
end
$fn$;
revoke all on function public.reservation_slots(uuid, date) from public, anon, authenticated;
grant execute on function public.reservation_slots(uuid, date) to service_role;

-- Aanvraag van een gast (enkel via storefront-api, service role). Fouten = vaste codes.
create or replace function public.reservation_request_place(p_tenant_id uuid, p_req jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_request uuid;
  v_name text := btrim(coalesce(p_req ->> 'name', ''));
  v_email text := lower(btrim(coalesce(p_req ->> 'email', '')));
  v_phone text := nullif(btrim(coalesce(p_req ->> 'phone', '')), '');
  v_note text := nullif(btrim(coalesce(p_req ->> 'note', '')), '');
  v_guests integer;
  v_date date;
  v_time text := btrim(coalesce(p_req ->> 'time', ''));
  v_slots jsonb;
  v_slot jsonb;
  v_tz text;
  v_at timestamptz;
  v_taken integer;
  s public.reservation_settings%rowtype;
  prior public.table_reservations%rowtype;
  v_id uuid;
begin
  begin
    v_request := (p_req ->> 'request_id')::uuid;
    v_guests := (p_req ->> 'guests')::integer;
    v_date := (p_req ->> 'date')::date;
  exception when others then
    raise exception 'RESERVATION_INVALID' using errcode = '22023';
  end;
  if v_request is null then raise exception 'RESERVATION_INVALID' using errcode = '22023'; end if;
  select * into prior from public.table_reservations where tenant_id = p_tenant_id and request_id = v_request;
  if prior.id is not null then
    return jsonb_build_object('id', prior.id, 'status', prior.status, 'duplicate', true);
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 60
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200
     or (v_phone is not null and char_length(v_phone) > 30) or (v_note is not null and char_length(v_note) > 200)
     or v_time !~ '^\d{2}:\d{2}$' then
    raise exception 'RESERVATION_INVALID' using errcode = '22023';
  end if;

  select * into s from public.reservation_settings where tenant_id = p_tenant_id;
  if s.tenant_id is null or not s.online_enabled then raise exception 'RESERVATION_CLOSED' using errcode = '55000'; end if;
  if v_guests is null or v_guests < 1 or v_guests > s.max_party then raise exception 'RESERVATION_PARTY' using errcode = '22023'; end if;

  select coalesce(nullif(f.timezone, ''), 'Europe/Brussels') into v_tz from public.fulfillment_settings f where f.tenant_id = p_tenant_id;
  v_tz := coalesce(v_tz, 'Europe/Brussels');
  v_at := (v_date + v_time::time) at time zone v_tz;

  -- Eén aanvraag tegelijk per tijdstip, zodat twee gelijktijdige aanvragen het maximum niet samen overschrijden.
  perform pg_advisory_xact_lock(hashtextextended('reservation:' || p_tenant_id::text || ':' || v_at::text, 0));
  v_slots := public.reservation_slots(p_tenant_id, v_date) -> 'slots';
  select x into v_slot from jsonb_array_elements(coalesce(v_slots, '[]'::jsonb)) x where x ->> 'time' = v_time;
  if v_slot is null then raise exception 'RESERVATION_SLOT' using errcode = '22023'; end if;
  select coalesce(sum(r.guests), 0) into v_taken from public.table_reservations r
   where r.tenant_id = p_tenant_id and r.starts_at = v_at and r.status in ('requested', 'booked', 'seated');
  if v_taken + v_guests > s.max_guests_per_slot then raise exception 'RESERVATION_FULL' using errcode = '22023'; end if;

  -- Rem bij misbruik: per zaak en per e-mailadres.
  if (select count(*) from public.table_reservations r where r.tenant_id = p_tenant_id and r.source = 'online'
        and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;
  if (select count(*) from public.table_reservations r where r.tenant_id = p_tenant_id and r.source = 'online'
        and lower(r.email) = v_email and r.status = 'requested') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;

  insert into public.table_reservations (tenant_id, table_id, name, guests, phone, email, note, starts_at, status, source, request_id, created_by)
  values (p_tenant_id, null, v_name, v_guests, v_phone, v_email, v_note, v_at, 'requested', 'online', v_request, null)
  returning id into v_id;

  begin
    insert into public.notifications (tenant_id, category, type, title, message, priority, action_url, data)
    values (p_tenant_id, 'customers', 'reservation_request', 'Nieuwe reservatie-aanvraag',
            v_name || ' · ' || v_guests || ' pers. · ' || to_char(v_at at time zone v_tz, 'DD/MM HH24:MI'),
            'high', '/admin/bestellen?tab=reservaties', jsonb_build_object('reservation_id', v_id, 'source', 'reservation_request'));
  exception when others then
    raise warning 'RESERVATIE-2: melding niet gemaakt: %', sqlerrm;
  end;

  return jsonb_build_object('id', v_id, 'status', 'requested');
end
$fn$;
revoke all on function public.reservation_request_place(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reservation_request_place(uuid, jsonb) to service_role;

-- Bevestigd of geweigerd (door een mens) → mail naar de gast. Nooit bij reservaties van het personeel.
create or replace function public.reservation_mail_tr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_url text;
  v_anon text;
  v_secret text;
begin
  if new.source <> 'online' or new.email is null or old.status <> 'requested' or new.status not in ('booked', 'declined') then
    return new;
  end if;
  begin
    select value into v_url from public.internal_config where key = 'supabase_url';
    select value into v_anon from public.internal_config where key = 'supabase_anon_key';
    select value into v_secret from public.internal_config where key = 'internal_webhook_secret';
    if v_url is null or v_anon is null or v_secret is null then return new; end if;
    perform net.http_post(
      url := v_url || '/functions/v1/reservation-mail',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon, 'X-Internal-Secret', v_secret),
      body := jsonb_build_object('reservation_id', new.id),
      timeout_milliseconds := 15000);
  exception when others then
    raise warning 'RESERVATIE-2: mail niet aangevraagd: %', sqlerrm;
  end;
  return new;
end
$fn$;
revoke all on function public.reservation_mail_tr() from public, anon, authenticated;

drop trigger if exists trg_table_reservations_mail on public.table_reservations;
create trigger trg_table_reservations_mail after update of status on public.table_reservations
  for each row execute function public.reservation_mail_tr();

-- RESERVATIE-MELDING-1 — een nieuwe online reservatie-aanvraag komt ook op de toestellen van de zaak.
--
-- Wat al bestond (RESERVATIE-2, reservation_request_place): een melding in het belletje
-- (notifications, category 'customers', type 'reservation_request', priority 'high'). Die gaat via
-- de bestaande triggers notify_push_on_notification (push naar de gebruikers) en
-- trigger_notification_email (mail volgens de meldingsinstellingen) al naar de zaakvoerder.
-- Wat ontbrak: kassa- en posttoestellen (horeca_notify_devices, personal = false) krijgen geen
-- persoonlijke meldingen, dus de bediening aan de kassa zag een aanvraag pas in de lijst.
--
-- Nu: bij een nieuwe aanvraag (source 'online', status 'requested') een horeca-melding naar de
-- toestellen met het profiel "QR-bestellingen" (zelfde profiel als OBER-ROEPEN-1, geen nieuw
-- event-type). Zonder naam van de gast (gedeeld toestel): enkel personen en tijdstip.
-- Eigen triggerfunctie; reservation_request_place en de bestaande triggers blijven ongemoeid.
-- Faalt nooit mee.
--
-- Handmatig terugdraaien:
--   drop trigger if exists trg_table_reservations_device_push on public.table_reservations;
--   drop function if exists public.reservation_device_push_tr();

create or replace function public.reservation_device_push_tr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tz text;
begin
  if new.source is distinct from 'online' or new.status is distinct from 'requested' then return new; end if;
  if not exists (select 1 from public.horeca_notify_devices d where d.tenant_id = new.tenant_id and 'qr_request' = any(d.events)) then
    return new;
  end if;
  begin
    select coalesce(nullif(f.timezone, ''), 'Europe/Brussels') into v_tz from public.fulfillment_settings f where f.tenant_id = new.tenant_id;
    perform public.horeca_device_notify(new.tenant_id, 'qr_request', null,
      jsonb_build_object('ref', new.id, 'reservation', true, 'guests', new.guests,
        'at', to_char(new.starts_at at time zone coalesce(v_tz, 'Europe/Brussels'), 'DD/MM HH24:MI')));
  exception when others then
    raise warning 'RESERVATIE-MELDING-1: melding niet verstuurd: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.reservation_device_push_tr() from public, anon, authenticated;

drop trigger if exists trg_table_reservations_device_push on public.table_reservations;
create trigger trg_table_reservations_device_push after insert on public.table_reservations
  for each row execute function public.reservation_device_push_tr();

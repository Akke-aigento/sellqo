-- MELDING-1 — meldingen per toestel en per post (horeca).
--
-- Tot nu volgde push de gebruiker: elke melding ging naar alle toestellen van iedereen in het team,
-- en er bestonden geen horeca-meldingen. Nu krijgt elk toestel een profiel (kassa, post, gsm …) met
-- wat het ontvangt:
--   qr_request   — een QR-bestelling wacht op bevestiging (table_requests, pending)
--   ticket_new   — nieuwe bon voor een post (kitchen_tickets, new; webshop-, afhaal- en leverorders zodra ze
--                  in de keuken horen, orders); filter op posten
--   ticket_ready — een bon is klaar (kitchen_tickets → ready)
--   paid_online  — een gast betaalde (een deel van) de rekening online (check_online_payments → paid)
--
-- Horeca-meldingen gaan NIET naar het belletje (notifications): in de rush zouden honderden bonnen
-- per avond het belletje onbruikbaar maken (Akke 28-10). Ze gaan rechtstreeks naar de toestellen met
-- het juiste profiel, via de edge function horeca-device-push.
--
-- Een profiel hangt aan een vaste installatie-ID per toestel (device_tokens.install_id, door de app
-- gezet), niet aan het push-token: tokens vernieuwen, het profiel moet blijven.
-- personal = false: de persoonlijke meldingen van de aangemelde gebruiker (facturen, webshop …)
-- komen niet op dit toestel (standaard op kassa- en posttoestellen; send-push-notification filtert).
--
-- Triggers falen nooit mee: een fout bij het melden mag een ronde, aanvraag of betaling niet tegenhouden.
--
-- Handmatig terugdraaien:
--   drop trigger if exists trg_table_requests_device_push on public.table_requests;
--   drop trigger if exists trg_kitchen_tickets_device_push on public.kitchen_tickets;
--   drop trigger if exists trg_check_online_payments_device_push on public.check_online_payments;
--   drop trigger if exists trg_orders_device_push on public.orders;
--   drop function if exists public.horeca_device_push_tr(), public.horeca_device_notify(uuid, text, uuid, jsonb),
--     public.horeca_notify_targets(uuid, text, uuid), public.horeca_notify_devices_list(uuid),
--     public.horeca_notify_device_save(uuid, text, text, text, text[], uuid[], boolean, text),
--     public.horeca_notify_device_remove(uuid, text);
--   drop table if exists public.horeca_notify_devices;
--   (device_tokens.install_id mag blijven: additief, ongebruikt.)

-- 1. Vaste installatie-ID per toestel ----------------------------------------------------------------
alter table public.device_tokens add column if not exists install_id text;
create index if not exists device_tokens_install_idx on public.device_tokens (install_id) where install_id is not null;

-- 2. Profielen --------------------------------------------------------------------------------------
create table if not exists public.horeca_notify_devices (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  install_id text not null check (install_id ~ '^[A-Za-z0-9-]{8,64}$'),
  name text not null check (length(btrim(name)) between 1 and 60),
  kind text not null default 'other' check (kind in ('kassa', 'station', 'phone', 'other')),
  events text[] not null default '{}'
    check (events <@ array['qr_request', 'ticket_new', 'ticket_ready', 'paid_online']::text[]),
  station_ids uuid[] not null default '{}',             -- ticket_new: deze posten; leeg = alle posten
  personal boolean not null default false,
  lang text not null default 'nl' check (lang ~ '^[a-z]{2}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, install_id)
);
comment on table public.horeca_notify_devices is 'MELDING-1: wat een toestel (installatie) van een zaak ontvangt aan horeca-meldingen.';
alter table public.horeca_notify_devices enable row level security;
revoke all on public.horeca_notify_devices from anon, authenticated;
grant select on public.horeca_notify_devices to authenticated;
drop policy if exists horeca_notify_devices_select on public.horeca_notify_devices;
create policy horeca_notify_devices_select on public.horeca_notify_devices for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- 3. Beheer (Kassa › Kassa's en toestellen, en "Meldingen op dit toestel") ----------------------------
create or replace function public.horeca_notify_device_save(
  p_tenant_id uuid, p_install_id text, p_name text, p_kind text, p_events text[], p_station_ids uuid[], p_personal boolean, p_lang text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.horeca_notify_devices%rowtype;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_station_ids, '{}')) s(id)
              where not exists (select 1 from public.prep_stations x where x.id = s.id and x.tenant_id = p_tenant_id)) then
    raise exception 'onbekende post' using errcode = '22023';
  end if;
  insert into public.horeca_notify_devices as d (tenant_id, install_id, name, kind, events, station_ids, personal, lang, created_by)
  values (p_tenant_id, p_install_id, btrim(p_name), coalesce(p_kind, 'other'),
          coalesce((select array_agg(distinct e order by e) from unnest(p_events) e), '{}'),
          coalesce((select array_agg(distinct s) from unnest(p_station_ids) s), '{}'),
          coalesce(p_personal, false), coalesce(nullif(p_lang, ''), 'nl'), auth.uid())
  on conflict (tenant_id, install_id) do update
    set name = excluded.name, kind = excluded.kind, events = excluded.events, station_ids = excluded.station_ids,
        personal = excluded.personal, lang = excluded.lang, updated_at = now()
  returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.horeca_notify_device_save(uuid, text, text, text, text[], uuid[], boolean, text) from public, anon;
grant execute on function public.horeca_notify_device_save(uuid, text, text, text, text[], uuid[], boolean, text) to authenticated;

create or replace function public.horeca_notify_device_remove(p_tenant_id uuid, p_install_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  delete from public.horeca_notify_devices where tenant_id = p_tenant_id and install_id = p_install_id;
end;
$$;
revoke all on function public.horeca_notify_device_remove(uuid, text) from public, anon;
grant execute on function public.horeca_notify_device_remove(uuid, text) to authenticated;

-- Profielen met wat er van het toestel bekend is (enkel tokens van wie nog in het team zit).
create or replace function public.horeca_notify_devices_list(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'install_id', d.install_id, 'name', d.name, 'kind', d.kind, 'events', d.events, 'station_ids', d.station_ids,
      'personal', d.personal, 'lang', d.lang, 'updated_at', d.updated_at,
      'push', coalesce(t.n, 0) > 0, 'os', t.os, 'platforms', t.platforms, 'last_seen_at', t.last_seen_at)
      order by d.kind, d.name)
    from public.horeca_notify_devices d
    left join lateral (
      select count(*) as n, max(k.os) as os, jsonb_agg(distinct k.platform) as platforms, max(k.last_seen_at) as last_seen_at
        from public.device_tokens k
       where k.install_id = d.install_id
         and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = d.tenant_id)
    ) t on true
    -- Een stilgezet gedeeld toestel (verwijderd uit de lijst, zie HorecaNotifyDevices) blijft als profiel
    -- bestaan zodat het geen persoonlijke meldingen krijgt, maar staat niet meer in de lijst.
    where d.tenant_id = p_tenant_id and not (d.events = '{}' and not d.personal and d.kind in ('kassa', 'station'))), '[]'::jsonb);
end;
$$;
revoke all on function public.horeca_notify_devices_list(uuid) from public, anon;
grant execute on function public.horeca_notify_devices_list(uuid) to authenticated;

-- 4. Ontvangers (enkel horeca-device-push, service_role) ----------------------------------------------
-- Return type kreeg een kolom (kind): eerst weg, dan opnieuw (enkel service_role gebruikt hem).
drop function if exists public.horeca_notify_targets(uuid, text, uuid);
create or replace function public.horeca_notify_targets(p_tenant_id uuid, p_event text, p_station_id uuid)
returns table (install_id text, lang text, kind text, token text, platform text, p256dh text, auth text)
language sql
stable
security definer
set search_path to ''
as $$
  select d.install_id, d.lang, d.kind, k.token, k.platform, k.p256dh, k.auth
    from public.horeca_notify_devices d
    join public.device_tokens k on k.install_id = d.install_id
   where d.tenant_id = p_tenant_id
     and p_event = any(d.events)
     and (p_event <> 'ticket_new' or d.station_ids = '{}' or p_station_id = any(d.station_ids))
     -- Een toestel van iemand die uit het team gehaald is, krijgt niets meer.
     and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = p_tenant_id);
$$;
revoke all on function public.horeca_notify_targets(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.horeca_notify_targets(uuid, text, uuid) to service_role;

-- 5. Versturen: enkel als er een toestel voor dit event is (anders gebeurt er niets) -----------------
create or replace function public.horeca_device_notify(p_tenant_id uuid, p_event text, p_station_id uuid, p_ctx jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_anon text;
  v_secret text;
begin
  if not exists (select 1 from public.horeca_notify_devices d
                  where d.tenant_id = p_tenant_id and p_event = any(d.events)
                    and (p_event <> 'ticket_new' or d.station_ids = '{}' or p_station_id = any(d.station_ids))) then
    return;
  end if;
  select value into v_url from public.internal_config where key = 'supabase_url';
  select value into v_anon from public.internal_config where key = 'supabase_anon_key';
  select value into v_secret from public.internal_config where key = 'internal_webhook_secret';
  if v_url is null or v_anon is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/horeca-device-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon, 'X-Internal-Secret', v_secret),
    body := jsonb_build_object('tenant_id', p_tenant_id, 'event', p_event, 'station_id', p_station_id, 'ctx', coalesce(p_ctx, '{}'::jsonb)),
    timeout_milliseconds := 15000);
end;
$$;
revoke all on function public.horeca_device_notify(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- 6. Triggers ---------------------------------------------------------------------------------------
create or replace function public.horeca_device_push_tr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_station uuid;
  v_station_name text;
  v_n integer;
begin
  -- Winkels zonder meldingstoestellen (bijna allemaal): meteen klaar, geen tellingen.
  if not exists (select 1 from public.horeca_notify_devices d where d.tenant_id = new.tenant_id) then
    return new;
  end if;
  begin
    if tg_table_name = 'table_requests' then
      if new.status = 'pending' then
        select count(*) into v_n from public.table_requests x
         where x.tenant_id = new.tenant_id and x.status = 'pending' and x.created_at > now() - interval '4 hours';
        perform public.horeca_device_notify(new.tenant_id, 'qr_request', null,
          jsonb_build_object('ref', new.id, 'table', new.table_label, 'items', new.item_count, 'count', v_n));
      end if;

    elsif tg_table_name = 'kitchen_tickets' then
      v_station := coalesce(new.station_id, (select s.id from public.prep_stations s
                                               where s.tenant_id = new.tenant_id and s.is_default and s.is_active limit 1));
      select s.name into v_station_name from public.prep_stations s where s.id = v_station;
      if tg_op = 'INSERT' and new.status = 'new' then
        select count(*) into v_n from public.kitchen_tickets x
         where x.tenant_id = new.tenant_id and x.status = 'new' and x.created_at > now() - interval '18 hours'
           and coalesce(x.station_id, v_station) is not distinct from v_station;
        perform public.horeca_device_notify(new.tenant_id, 'ticket_new', v_station,
          jsonb_build_object('ref', new.id, 'table', new.table_label, 'customer', new.customer_label, 'station', v_station_name,
            'items', (select coalesce(sum(coalesce((i ->> 'quantity')::numeric, 1)), 0) from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i),
            'count', v_n));
      elsif tg_op = 'INSERT' and new.status = 'ready' then
        -- Een webshopbon ontstaat pas bij de eerste klik op het keukenscherm, soms meteen op klaar.
        perform public.horeca_device_notify(new.tenant_id, 'ticket_ready', v_station,
          jsonb_build_object('ref', new.id, 'table', new.table_label, 'customer', new.customer_label, 'station', v_station_name));
      elsif tg_op = 'UPDATE' then
        if new.status = 'ready' and old.status is distinct from 'ready' then
          perform public.horeca_device_notify(new.tenant_id, 'ticket_ready', v_station,
            jsonb_build_object('ref', new.id, 'table', new.table_label, 'customer', new.customer_label, 'station', v_station_name));
        end if;
      end if;

    elsif tg_table_name = 'orders' then
      -- Webshop-, afhaal- en leverorders komen op het keukenscherm zodra ze betaald zijn (of betalen bij
      -- afhalen), zie orderBelongsInKitchen in kitchenModel.ts. Hun keukenbon ontstaat pas later, dus hier
      -- de melding "nieuwe bon" voor de standaardpost.
      if new.service_type in ('pickup', 'local_delivery', 'eat_in') and new.status is distinct from 'cancelled'
         and (new.payment_status = 'paid' or new.payment_method = 'pay_on_pickup') then
        if tg_op = 'INSERT' then
          v_n := 1;
        elsif not (coalesce(old.payment_status = 'paid', false) or coalesce(old.payment_method = 'pay_on_pickup', false)) then
          v_n := 1;
        end if;
        if v_n = 1 then
          select s.id, s.name into v_station, v_station_name from public.prep_stations s
           where s.tenant_id = new.tenant_id and s.is_default and s.is_active limit 1;
          perform public.horeca_device_notify(new.tenant_id, 'ticket_new', v_station,
            jsonb_build_object('ref', new.id, 'table', new.table_label, 'customer', coalesce(new.customer_name, new.order_number),
              'station', v_station_name, 'count', 1));
        end if;
      end if;

    elsif tg_table_name = 'check_online_payments' then
      if new.status = 'paid' and old.status is distinct from 'paid' then
        perform public.horeca_device_notify(new.tenant_id, 'paid_online', null,
          jsonb_build_object('ref', new.id, 'table', new.table_label, 'amount_cents', new.amount_cents, 'tip_cents', new.tip_cents, 'kind', new.kind,
            'rest_open', exists (select 1 from public.dining_checks c where c.id = new.check_id and c.status = 'open')));
      end if;
    end if;
  exception when others then
    -- Een melding mag nooit een ronde, aanvraag of betaling tegenhouden.
    raise warning 'MELDING-1: melding niet verstuurd (%): %', tg_table_name, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.horeca_device_push_tr() from public, anon, authenticated;

drop trigger if exists trg_table_requests_device_push on public.table_requests;
create trigger trg_table_requests_device_push after insert on public.table_requests
  for each row execute function public.horeca_device_push_tr();
drop trigger if exists trg_kitchen_tickets_device_push on public.kitchen_tickets;
create trigger trg_kitchen_tickets_device_push after insert or update of status on public.kitchen_tickets
  for each row execute function public.horeca_device_push_tr();
drop trigger if exists trg_check_online_payments_device_push on public.check_online_payments;
create trigger trg_check_online_payments_device_push after update of status on public.check_online_payments
  for each row execute function public.horeca_device_push_tr();
drop trigger if exists trg_orders_device_push on public.orders;
create trigger trg_orders_device_push after insert or update of payment_status on public.orders
  for each row execute function public.horeca_device_push_tr();

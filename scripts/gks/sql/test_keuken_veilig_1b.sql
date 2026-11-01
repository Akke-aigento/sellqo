-- KEUKEN-VEILIG-1b — controleert 20261101230210 (barbon in één tik → ticket_ready, geen dubbele melding).
-- Draaien op de testdatabank van test_keuken_veilig.sql: eerst de stub-setup hieronder (kopie van
-- horeca_device_push_tr uit 20261028180000_melding_1.sql met een nep-horeca_device_notify), dan de migratie, dan de controles.
-- ===== setup =====
create table if not exists public.horeca_notify_devices (tenant_id uuid);
create table if not exists public.push_log (ev text, ref uuid, at timestamptz default clock_timestamp());
create or replace function public.horeca_device_notify(p_tenant_id uuid, p_event text, p_station_id uuid, p_ctx jsonb) returns void language sql as $f$ insert into public.push_log(ev, ref) values (p_event, (p_ctx->>'ref')::uuid) $f$;
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
drop trigger if exists trg_kitchen_tickets_device_push on public.kitchen_tickets;
create trigger trg_kitchen_tickets_device_push after insert or update of status on public.kitchen_tickets for each row execute function public.horeca_device_push_tr();
-- ===== na de migratie: controles (elke regel t) =====
insert into public.horeca_notify_devices values ('11111111-1111-1111-1111-111111111111');
delete from public.push_log;
insert into public.kitchen_tickets (id, tenant_id, source, service_type, station_id, items, paid, status) values
 ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','table','eat_in','88888888-0000-0000-0000-000000000002','[]',false,'new'),
 ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','table','eat_in','88888888-0000-0000-0000-000000000001','[]',false,'new'),
 ('d0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','table','eat_in','88888888-0000-0000-0000-000000000002','[]',false,'new');
delete from public.push_log;
update public.kitchen_tickets set status='done' where id='d0000000-0000-0000-0000-000000000001';
select count(*) = 1 as ok_bar_one_tap_ready from public.push_log where ev='ticket_ready' and ref='d0000000-0000-0000-0000-000000000001';
update public.kitchen_tickets set status='done' where id='d0000000-0000-0000-0000-000000000002';
select count(*) = 0 as ok_kitchen_done_no_ready from public.push_log where ref='d0000000-0000-0000-0000-000000000002';
update public.kitchen_tickets set status='ready' where id='d0000000-0000-0000-0000-000000000003';
update public.kitchen_tickets set status='done' where id='d0000000-0000-0000-0000-000000000003';
select count(*) = 1 as ok_no_double from public.push_log where ref='d0000000-0000-0000-0000-000000000003';

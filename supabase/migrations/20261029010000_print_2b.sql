-- PRINT-2b — printer voor bonnen zonder post.
--
-- Recon (WANDELING, 29-10): een zaak zonder posten (of zonder standaardpost) kon in PRINT-2 geen
-- enkele keukenbon laten afdrukken, want de printer hing enkel aan een post. Nu:
--   horeca_pay_settings.ticket_printer_id — printer voor bonnen zonder post (Kassa › Bon & printers).
--   horeca_printer_ref_guard controleert ook die kolom (printer van dezelfde zaak).
--   horeca_print_tr: bon zonder post → printer voor bonnen zonder post; een bon van een post blijft enkel
--   naar de printer van die post gaan.
-- Hoort bij edge function horeca-print PRINT-2b (fallbackPrinter). VOLGORDE: (1) horeca-print deployen,
-- (2) deze migratie, (3) pas dan de admin publiceren: Bon & printers leest ticket_printer_id en geeft een
-- fout zolang de kolom ontbreekt.
-- Additief. Terugdraaien (handmatig): de definities van horeca_print_tr en horeca_printer_ref_guard
-- uit 20261028230000_print_2.sql opnieuw draaien; alter table public.horeca_pay_settings drop column if exists ticket_printer_id;
-- drop trigger trg_horeca_pay_settings_printer + opnieuw aanmaken zoals in 20261028230000.

create schema if not exists ops;
create table if not exists ops.print_2b_prev_functions as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as saved_at
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('horeca_print_tr', 'horeca_printer_ref_guard');

alter table public.horeca_pay_settings add column if not exists ticket_printer_id uuid references public.printers(id) on delete set null;
comment on column public.horeca_pay_settings.ticket_printer_id is 'PRINT-2b: printer voor keukenbonnen zonder post (geen posten of geen standaardpost).';

create or replace function public.horeca_printer_ref_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  j jsonb := to_jsonb(new);
  v_printer uuid;
begin
  -- Via jsonb: plpgsql controleert elk veld van new, ook in een tak die niet loopt.
  foreach v_printer in array (case when tg_table_name = 'prep_stations'
                                   then array[(j ->> 'printer_id')::uuid]
                                   else array[(j ->> 'receipt_printer_id')::uuid, (j ->> 'ticket_printer_id')::uuid] end) loop
    if v_printer is not null and not exists (select 1 from public.printers p where p.id = v_printer and p.tenant_id = new.tenant_id) then
      raise exception 'PRINT-2: printer hoort niet bij deze zaak' using errcode = 'foreign_key_violation';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_horeca_pay_settings_printer on public.horeca_pay_settings;
create trigger trg_horeca_pay_settings_printer before insert or update of receipt_printer_id, ticket_printer_id on public.horeca_pay_settings
  for each row execute function public.horeca_printer_ref_guard();

create or replace function public.horeca_print_tr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_station uuid;
  v_go boolean := false;
begin
  begin
    if tg_table_name = 'check_online_payments' then
      if new.status = 'paid' and old.status is distinct from 'paid'
         and exists (select 1 from public.horeca_pay_settings s where s.tenant_id = new.tenant_id and s.mail_online) then
        perform public.horeca_print_call('horeca-receipt-mail', jsonb_build_object('source', 'online', 'payment_id', new.id));
      end if;
      return new;
    end if;

    -- Winkels zonder actieve printer (bijna allemaal): meteen klaar.
    if not exists (select 1 from public.printers p where p.tenant_id = new.tenant_id and p.is_active) then
      return new;
    end if;
    -- Geregistreerde kassa (GKS): een keukenbon moet daar de identificatie van het P-event dragen
    -- (PRT-04/05); die maakt de kassa zelf. Hier dus niets afdrukken.
    if public.horeca_tenant_fiscal(new.tenant_id) then
      return new;
    end if;

    if tg_table_name = 'kitchen_tickets' then
      -- Een webshopbon ontstaat pas bij de eerste klik op het keukenscherm: die order is al afgedrukt (orders).
      if new.status = 'new' and new.source <> 'webshop' then
        v_station := coalesce(new.station_id, (select s.id from public.prep_stations s
                                                 where s.tenant_id = new.tenant_id and s.is_default and s.is_active limit 1));
        -- Een bon van een post: enkel de printer van die post. Een bon zonder post (geen posten, of geen
        -- standaardpost): de printer voor bonnen zonder post (PRINT-2b).
        if (v_station is not null and exists (select 1 from public.prep_stations s join public.printers p on p.id = s.printer_id and p.is_active
                                                where s.id = v_station))
           or (v_station is null and exists (select 1 from public.horeca_pay_settings h join public.printers p on p.id = h.ticket_printer_id and p.is_active
                                               where h.tenant_id = new.tenant_id)) then
          perform public.horeca_print_call('horeca-print', jsonb_build_object('kind', 'ticket', 'id', new.id));
        end if;
      end if;

    elsif tg_table_name = 'orders' then
      -- Zelfde voorwaarde als het keukenscherm (orderBelongsInKitchen) en MELDING-1.
      if new.service_type in ('pickup', 'local_delivery', 'eat_in') and new.status is distinct from 'cancelled'
         and (new.payment_status = 'paid' or new.payment_method = 'pay_on_pickup') then
        if tg_op = 'INSERT' then
          v_go := true;
        elsif not (coalesce(old.payment_status = 'paid', false) or coalesce(old.payment_method = 'pay_on_pickup', false)) then
          v_go := true;
        end if;
        v_station := (select s.id from public.prep_stations s where s.tenant_id = new.tenant_id and s.is_default and s.is_active limit 1);
        if v_go and ((v_station is not null and exists (select 1 from public.prep_stations s join public.printers p on p.id = s.printer_id and p.is_active
                                                          where s.id = v_station))
                     or (v_station is null and exists (select 1 from public.horeca_pay_settings h join public.printers p on p.id = h.ticket_printer_id and p.is_active
                                                         where h.tenant_id = new.tenant_id))) then
          perform public.horeca_print_call('horeca-print', jsonb_build_object('kind', 'order', 'id', new.id));
        end if;
      end if;

    elsif tg_table_name = 'check_payments' then
      -- Een online betaling via de QR sluit de rekening ook af via horeca_pay (betaalwijze 'online'):
      -- dan staat er niemand aan de printer, de gast krijgt eventueel een mail.
      if new.fiscal_event_id is null
         and exists (select 1 from jsonb_array_elements(coalesce(new.tenders, '[]'::jsonb)) e where coalesce(e ->> 'method', '') <> 'online')
         and exists (
           select 1 from public.horeca_pay_settings s join public.printers p on p.id = s.receipt_printer_id and p.is_active
            where s.tenant_id = new.tenant_id and s.receipt_print) then
        perform public.horeca_print_call('horeca-print', jsonb_build_object('kind', 'receipt', 'id', new.id));
      end if;
    end if;
  exception when others then
    -- Afdrukken of mailen mag nooit een bestelling of betaling tegenhouden.
    raise warning 'PRINT-2: niet doorgestuurd (%): %', tg_table_name, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.horeca_print_tr() from public, anon, authenticated;

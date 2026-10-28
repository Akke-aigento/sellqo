-- PRINT-2 — printers instellen, bonnen per post naar de printer, betaalbewijs afdrukken en mailen.
--
-- Bouwt op PRINT-1 (printers, print_jobs, edge function cloudprnt — live sinds 24-10, nog 0 printers).
--   1. printers.lang: taal van de bon (keuken- en betaalbewijs).
--   2. prep_stations.printer_id: elke post (keuken, bar …) kiest zijn printer. Eén printer mag meerdere
--      posten bedienen.
--   3. horeca_pay_settings: receipt_print + receipt_printer_id (betaalbewijs na afrekenen aan de kassa),
--      mail_online (betaalbewijs mailen na online betalen via de QR), mail_button (knop "Mail bon" op
--      het afrekenscherm; de kassa vraagt er nooit zelf naar).
--   4. print_jobs.kind: + 'test' en 'betaalbewijs' (verbreden, niets valt weg).
--   5. horeca_receipt_mails: logboek per verstuurde bonmail (enkel een hash van het adres), voor
--      dedupe (online: één mail per betaling) en een plafond (kassa: 3 per betaling, 300 per dag).
--   6. horeca_receipt_data(): de gegevens van een betaalbewijs in één JSON (bedragen uit dezelfde
--      functies als de kassa: horeca_line_total / horeca_line_part_cents). Enkel service_role.
--      Taalconstraint printers_lang_check volgt SUPPORTED_LANGUAGES (src/i18n/languages.ts): een nieuwe
--      taal daar = deze constraint verbreden in een eigen migratie.
--   7. Trigger horeca_print_tr: nieuwe bon (kitchen_tickets), webshoporder die in de keuken hoort
--      (orders, zelfde voorwaarde als MELDING-1), betaling aan de kassa (check_payments) en online
--      betaling (check_online_payments → paid) roepen horeca-print / horeca-receipt-mail aan via
--      pg_net — enkel als de zaak daar iets voor ingesteld heeft. Nooit bij een geregistreerde kassa
--      (fiscal_event_id): daar maakt de kassa zelf het kasticket.
--
-- Additief: geen kolom hernoemd of verwijderd, geen default gewijzigd. prep_stations,
-- horeca_pay_settings, printers en print_jobs zijn horeca-tabellen (niet gedeeld met custom frontends).
-- Op orders komt enkel een trigger bij, met een WHEN-voorwaarde (service_type is not null) en een
-- vroege uitstap voor winkels zonder printer.
--
-- Terugdraaien (handmatig):
--   drop trigger if exists trg_kitchen_tickets_print on public.kitchen_tickets;
--   drop trigger if exists trg_orders_print on public.orders;
--   drop trigger if exists trg_check_payments_print on public.check_payments;
--   drop trigger if exists trg_check_online_payments_mail on public.check_online_payments;
--   drop trigger if exists trg_prep_stations_printer on public.prep_stations;
--   drop trigger if exists trg_horeca_pay_settings_printer on public.horeca_pay_settings;
--   drop function if exists public.horeca_print_tr(), public.horeca_print_call(text, jsonb),
--     public.horeca_receipt_data(text, uuid), public.horeca_printer_ref_guard();
--   drop table if exists public.horeca_receipt_mails;
--   alter table public.horeca_pay_settings drop column if exists receipt_print, drop column if exists receipt_printer_id,
--     drop column if exists mail_online, drop column if exists mail_button;
--   alter table public.prep_stations drop column if exists printer_id;
--   alter table public.printers drop column if exists lang;
--   print_jobs_kind_check terug naar ('kasticket','refund','voorrekening','bestelbon','kopie','training','keuken','bar','rapport')
--     (faalt zolang er test- of betaalbewijs-jobs bestaan — dat is de bedoeling).

-- 1. printers.lang -------------------------------------------------------------------------------------
alter table public.printers add column if not exists lang text not null default 'nl';
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.printers'::regclass and conname = 'printers_lang_check') then
    alter table public.printers add constraint printers_lang_check check (lang in ('nl', 'en', 'fr', 'de', 'uk'));
  end if;
end
$mig$;
grant select (lang), insert (lang), update (lang) on public.printers to authenticated;
comment on column public.printers.lang is 'PRINT-2: taal van de bonnen op deze printer.';

-- 2. + 3. Toewijzing en bon-instellingen ---------------------------------------------------------------
alter table public.prep_stations add column if not exists printer_id uuid references public.printers(id) on delete set null;
comment on column public.prep_stations.printer_id is 'PRINT-2: bonnen van deze post gaan naar deze printer (Kassa › Bon & printers).';

alter table public.horeca_pay_settings add column if not exists receipt_print boolean not null default false;
alter table public.horeca_pay_settings add column if not exists receipt_printer_id uuid references public.printers(id) on delete set null;
alter table public.horeca_pay_settings add column if not exists mail_online boolean not null default false;
alter table public.horeca_pay_settings add column if not exists mail_button boolean not null default true;
comment on column public.horeca_pay_settings.receipt_print is 'PRINT-2: na afrekenen aan de kassa een betaalbewijs afdrukken op receipt_printer_id (niet bij een geregistreerde kassa).';
comment on column public.horeca_pay_settings.mail_online is 'PRINT-2: na online betalen via de QR het betaalbewijs mailen naar het adres uit Stripe.';
comment on column public.horeca_pay_settings.mail_button is 'PRINT-2: knop "Mail bon" op het afrekenscherm van de kassa.';

-- Een printer van een andere zaak koppelen kan niet (ook niet voor service_role).
create or replace function public.horeca_printer_ref_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  -- Via jsonb: plpgsql controleert elk veld van new, ook in de tak van een CASE die niet loopt.
  v_printer uuid := (to_jsonb(new) ->> case when tg_table_name = 'prep_stations' then 'printer_id' else 'receipt_printer_id' end)::uuid;
begin
  if v_printer is not null and not exists (select 1 from public.printers p where p.id = v_printer and p.tenant_id = new.tenant_id) then
    raise exception 'PRINT-2: printer hoort niet bij deze zaak' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prep_stations_printer on public.prep_stations;
create trigger trg_prep_stations_printer before insert or update of printer_id on public.prep_stations
  for each row execute function public.horeca_printer_ref_guard();
drop trigger if exists trg_horeca_pay_settings_printer on public.horeca_pay_settings;
create trigger trg_horeca_pay_settings_printer before insert or update of receipt_printer_id on public.horeca_pay_settings
  for each row execute function public.horeca_printer_ref_guard();

-- 4. print_jobs.kind verbreden ---------------------------------------------------------------------------
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.print_jobs'::regclass and conname = 'print_jobs_kind_check'
                   and pg_get_constraintdef(oid) like '%betaalbewijs%') then
    alter table public.print_jobs drop constraint if exists print_jobs_kind_check;
    alter table public.print_jobs add constraint print_jobs_kind_check check (kind in
      ('kasticket','refund','voorrekening','bestelbon','kopie','training','keuken','bar','rapport','test','betaalbewijs'));
  end if;
end
$mig$;

-- 5. Logboek bonmails ------------------------------------------------------------------------------------
create table if not exists public.horeca_receipt_mails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null check (source in ('kassa', 'online')),
  payment_id uuid not null,
  -- Enkel een SHA-256 van het (kleine letters) adres: genoeg voor tellen, geen adresboek van gasten.
  email_sha256 text not null check (email_sha256 ~ '^[0-9a-f]{64}$'),
  resend_id text check (char_length(resend_id) <= 200),
  sent_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists horeca_receipt_mails_online_uq on public.horeca_receipt_mails (payment_id) where source = 'online';
create index if not exists horeca_receipt_mails_tenant_day on public.horeca_receipt_mails (tenant_id, created_at desc);
create index if not exists horeca_receipt_mails_payment on public.horeca_receipt_mails (payment_id);
alter table public.horeca_receipt_mails enable row level security;
revoke all on public.horeca_receipt_mails from anon, authenticated;
grant select, insert, update, delete on public.horeca_receipt_mails to service_role;
comment on table public.horeca_receipt_mails is 'PRINT-2: verstuurde betaalbewijzen per mail (hash van het adres). Enkel service_role.';

-- 6. Gegevens van een betaalbewijs ------------------------------------------------------------------------
create or replace function public.horeca_receipt_data(p_source text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  p public.check_payments%rowtype;
  o public.check_online_payments%rowtype;
  c public.dining_checks%rowtype;
  t record;
  v_lines jsonb := '[]'::jsonb;
  v_check uuid;
  v_tenant uuid;
  v_receipt text;
  v_prepaid bigint := 0;
begin
  if p_source = 'kassa' then
    select * into p from public.check_payments where id = p_id;
    if p.id is null then return null; end if;
    v_check := p.check_id; v_tenant := p.tenant_id;
    select x.receipt_number into v_receipt from public.pos_transactions x where x.id = p.pos_transaction_id;
  elsif p_source = 'online' then
    select * into o from public.check_online_payments where id = p_id;
    if o.id is null then return null; end if;
    v_check := o.check_id; v_tenant := o.tenant_id;
  else
    return null;
  end if;
  select * into c from public.dining_checks where id = v_check;
  -- Online "hele rekening" na eerdere online delen: die delen staan als "eerder betaald" op het bewijs.
  if p_source = 'online' and o.kind = 'full' then
    select coalesce(sum(x.amount_cents), 0) into v_prepaid from public.check_online_payments x
     where x.check_id = v_check and x.status = 'paid' and x.id <> o.id and coalesce(x.paid_at, x.updated_at) <= coalesce(o.paid_at, o.updated_at);
  end if;
  select x.name, x.address, x.postal_code, x.city, x.btw_number, x.language into t from public.tenants x where x.id = v_tenant;

  if p_source = 'online' and o.kind = 'lines' then
    select coalesce(jsonb_agg(jsonb_build_object('quantity', (e ->> 'qty')::int, 'name', l.name,
             'total_cents', public.horeca_line_part_cents(l, (e ->> 'qty')::int),
             'addons', (select coalesce(jsonb_agg(a ->> 'name'), '[]'::jsonb) from jsonb_array_elements(coalesce(l.addons, '[]'::jsonb)) a))
           order by l.seq), '[]'::jsonb)
      into v_lines
      from jsonb_array_elements(coalesce(o.lines, '[]'::jsonb)) e
      join public.check_lines l on l.id = (e ->> 'line_id')::uuid and l.check_id = v_check;
  elsif p_source = 'kassa' or o.kind = 'full' then
    select coalesce(jsonb_agg(jsonb_build_object('quantity', l.qty, 'name', l.name, 'total_cents', public.horeca_line_total(l),
             'addons', (select coalesce(jsonb_agg(a ->> 'name'), '[]'::jsonb) from jsonb_array_elements(coalesce(l.addons, '[]'::jsonb)) a))
           order by l.seq), '[]'::jsonb)
      into v_lines
      from public.check_lines l where l.check_id = v_check and l.state <> 'void';
  end if;

  return jsonb_build_object(
    'tenant_id', v_tenant,
    'store_name', t.name,
    'address', jsonb_build_array(t.address, nullif(concat_ws(' ', t.postal_code, t.city), '')),
    'vat_number', t.btw_number,
    'tenant_lang', t.language,
    'origin', p_source,
    'online_kind', case when p_source = 'online' then case o.kind when 'lines' then 'items' else o.kind end end,
    'table', coalesce((select dt.label from public.dining_tables dt where dt.id = c.table_id), o.table_label, c.name),
    'when', case when p_source = 'kassa' then p.created_at else coalesce(o.paid_at, o.updated_at) end,
    'receipt_no', v_receipt,
    'lines', v_lines,
    'paid_cents', case when p_source = 'kassa' then p.total_cents else o.amount_cents end,
    'tip_cents', case when p_source = 'kassa' then coalesce(p.tip_cents, 0) else coalesce(o.tip_cents, 0) end,
    'rounding_cents', case when p_source = 'kassa' then coalesce(p.rounding_cents, 0) else 0 end,
    'tenders', case when p_source = 'kassa' then coalesce(p.tenders, '[]'::jsonb)
                    else jsonb_build_array(jsonb_build_object('method', 'online', 'amount_cents', o.amount_cents)) end,
    'prepaid_cents', v_prepaid,
    -- Een afgesplitst deel is zelf altijd gesloten; open blijft dan de oorspronkelijke rekening.
    'rest_open', coalesce(c.status = 'open', false)
                 or exists (select 1 from public.dining_checks x where x.id = c.split_of and x.status = 'open'),
    'fiscal', p_source = 'kassa' and p.fiscal_event_id is not null,
    'status', case when p_source = 'online' then o.status else 'paid' end,
    'stripe_session_id', case when p_source = 'online' then o.stripe_session_id end
  );
end;
$$;
revoke all on function public.horeca_receipt_data(text, uuid) from public, anon, authenticated;
grant execute on function public.horeca_receipt_data(text, uuid) to service_role;

-- 7. Aanroepen en trigger ----------------------------------------------------------------------------------
create or replace function public.horeca_print_call(p_fn text, p_body jsonb)
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
  if p_fn not in ('horeca-print', 'horeca-receipt-mail') then return; end if;
  select value into v_url from public.internal_config where key = 'supabase_url';
  select value into v_anon from public.internal_config where key = 'supabase_anon_key';
  select value into v_secret from public.internal_config where key = 'internal_webhook_secret';
  if v_url is null or v_anon is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/' || p_fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon, 'X-Internal-Secret', v_secret),
    body := p_body,
    timeout_milliseconds := 15000);
end;
$$;
revoke all on function public.horeca_print_call(text, jsonb) from public, anon, authenticated;

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
        if exists (select 1 from public.prep_stations s join public.printers p on p.id = s.printer_id and p.is_active
                    where s.id = v_station) then
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
        if v_go and exists (select 1 from public.prep_stations s join public.printers p on p.id = s.printer_id and p.is_active
                             where s.tenant_id = new.tenant_id and s.is_default and s.is_active) then
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

drop trigger if exists trg_kitchen_tickets_print on public.kitchen_tickets;
create trigger trg_kitchen_tickets_print after insert on public.kitchen_tickets
  for each row execute function public.horeca_print_tr();
drop trigger if exists trg_orders_print on public.orders;
create trigger trg_orders_print after insert or update of payment_status, payment_method on public.orders
  for each row when (new.service_type is not null) execute function public.horeca_print_tr();
drop trigger if exists trg_check_payments_print on public.check_payments;
create trigger trg_check_payments_print after insert on public.check_payments
  for each row execute function public.horeca_print_tr();
drop trigger if exists trg_check_online_payments_mail on public.check_online_payments;
create trigger trg_check_online_payments_mail after update of status on public.check_online_payments
  for each row execute function public.horeca_print_tr();

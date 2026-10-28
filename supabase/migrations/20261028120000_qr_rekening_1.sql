-- QR-REKENING-1 — bestellen via de QR aan tafel komt op de tafelrekening.
--
-- Instelling (Bestellen › QR, fulfillment_settings):
--   qr_flow        'order' = elke bestelling apart afrekenen (zoals vóór deze batch, standaard)
--                  'check' = op de tafelrekening: de bestelling wordt een tafelaanvraag
--   qr_auto_accept false   = het personeel bevestigt elke aanvraag (standaard, Akke 28-10)
--                  true    = een kassa die openstaat bevestigt zelf
--
-- Een tafelaanvraag is GEEN order: er wordt niets betaald, afgeboekt of als omzet geteld. Pas
-- bij "Bevestigen" op SellQo Kassa komen de lijnen als ontwerp op de rekening van die tafel
-- (dezelfde add_line als bij aantikken: prijs, btw, extra's en post uit de databank), en de
-- kassa verstuurt de ronde zoals altijd (keukenbonnen per post; op een GKS-kassa ondertekend).
--
-- Robuust bij drukte (Akke 28-10: "geen crashes"):
--   - idempotent: de aanvraag-ID komt van de gast (dubbel tikken = één aanvraag), het mandje
--     wordt in dezelfde transactie afgesloten (één mandje = één aanvraag);
--   - rem: max. 6 aanvragen per tafel per minuut, 10 openstaande per tafel en 300 per zaak;
--   - bevestigen is één transactie met een rijlock op de aanvraag: twee kassa's tegelijk geven
--     één keer lijnen, nooit twee; lukt één lijn niet (bv. net op), dan gebeurt er niets;
--   - elke wijziging zet horeca_state.version één hoger: de kassa's halen enkel bij verschil op.
--
-- Handmatig terugdraaien:
--   drop function if exists public.table_request_place(uuid, uuid, uuid, uuid, text, text, text);
--   drop function if exists public.horeca_table_request_accept(uuid, text, uuid, uuid);
--   drop function if exists public.horeca_table_request_reject(uuid, uuid, uuid, text);
--   drop table if exists public.table_requests;
--   alter table public.fulfillment_settings drop column if exists qr_flow, drop column if exists qr_auto_accept;

-- 1. Instellingen ---------------------------------------------------------------------------------
alter table public.fulfillment_settings add column if not exists qr_flow text not null default 'order';
alter table public.fulfillment_settings add column if not exists qr_auto_accept boolean not null default false;
do $mig$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.fulfillment_settings'::regclass and conname = 'fulfillment_settings_qr_flow_check') then
    alter table public.fulfillment_settings add constraint fulfillment_settings_qr_flow_check check (qr_flow in ('order', 'check'));
  end if;
end
$mig$;

-- 2. Tafelaanvragen --------------------------------------------------------------------------------
create table if not exists public.table_requests (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Eén mandje = één aanvraag (het mandje wordt in dezelfde transactie afgesloten).
  cart_id uuid unique,
  dining_table_id uuid references public.dining_tables(id) on delete set null,
  table_label text not null check (char_length(table_label) between 1 and 40),
  -- [{product_id, variant_id, qty, addon_ids[], name, unit_price_cents, addons[{name}]}]
  -- name/prijs enkel ter info voor de gast en de inbox; bij bevestigen beslist de databank.
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  item_count integer not null check (item_count between 1 and 999),
  total_cents integer not null check (total_cents >= 0),
  guest_name text check (guest_name is null or char_length(guest_name) <= 100),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reason text check (reason is null or char_length(reason) <= 160),
  check_id uuid,
  -- Lijnen die bij bevestigen op de rekening kwamen (de kassa verstuurt precies die als ronde).
  line_ids uuid[],
  decided_at timestamptz,
  decided_by uuid,
  device_id text check (device_id is null or char_length(device_id) <= 200),
  created_at timestamptz not null default now()
);
alter table public.table_requests add column if not exists line_ids uuid[];
comment on table public.table_requests is 'QR-REKENING-1: bestellingen via de QR aan tafel die het personeel op de tafelrekening zet (geen order).';
create index if not exists table_requests_pending_idx on public.table_requests (tenant_id, created_at) where status = 'pending';
create index if not exists table_requests_table_idx on public.table_requests (tenant_id, table_label, created_at);

revoke all on public.table_requests from anon, authenticated;
grant select on public.table_requests to authenticated;
alter table public.table_requests enable row level security;
drop policy if exists table_requests_select on public.table_requests;
create policy table_requests_select on public.table_requests for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
-- Schrijven enkel via de functies hieronder (security definer).

-- 3. Plaatsen (enkel storefront-api, service role) ----------------------------------------------------
create or replace function public.table_request_place(
  p_tenant_id uuid, p_request_id uuid, p_cart_id uuid, p_table_id uuid, p_table_label text, p_guest_name text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  fs record;
  cart record;
  prior public.table_requests%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_total integer := 0;
  it record;
begin
  if p_request_id is null or p_cart_id is null or coalesce(btrim(p_table_label), '') = '' then
    raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
  end if;

  -- Idempotent: dezelfde aanvraag (dubbel tikken, netwerk opnieuw) geeft hetzelfde antwoord.
  select * into prior from public.table_requests where id = p_request_id;
  if prior.id is not null then
    if prior.tenant_id <> p_tenant_id then raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023'; end if;
    return jsonb_build_object('request_id', prior.id, 'status', prior.status, 'duplicate', true);
  end if;

  select qr_mode, qr_flow into fs from public.fulfillment_settings where tenant_id = p_tenant_id;
  if coalesce(fs.qr_mode, 'view') <> 'order' or coalesce(fs.qr_flow, 'order') <> 'check' then
    raise exception 'TABLE_REQUESTS_OFF' using errcode = '55000';
  end if;

  select * into cart from public.storefront_carts where id = p_cart_id and tenant_id = p_tenant_id for update;
  if cart.id is null then raise exception 'CART_NOT_FOUND' using errcode = 'P0002'; end if;
  if cart.checkout_status = 'converted' then
    -- Dit mandje werd al doorgegeven (andere aanvraag-ID, bv. tweede tabblad): die aanvraag.
    select * into prior from public.table_requests where cart_id = p_cart_id;
    if prior.id is not null then return jsonb_build_object('request_id', prior.id, 'status', prior.status, 'duplicate', true); end if;
    raise exception 'CART_ALREADY_ORDERED' using errcode = '55000';
  end if;
  -- Een mandje waarvoor al een online betaling loopt, wordt geen tafelaanvraag (anders betaalt de
  -- gast zonder dat er een bestelling volgt: de webhook slaat afgesloten mandjes over).
  if cart.stripe_session_id is not null then raise exception 'CART_IN_PAYMENT' using errcode = '55000'; end if;
  -- (De storefront wist dan het mandje: de gast begint met een nieuw.)

  -- Rem bij drukte: per tafel en per zaak.
  if (select count(*) from public.table_requests r where r.tenant_id = p_tenant_id and r.table_label = btrim(p_table_label)
        and r.created_at > now() - interval '1 minute') >= 6 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;
  if (select count(*) from public.table_requests r where r.tenant_id = p_tenant_id and r.table_label = btrim(p_table_label)
        and r.status = 'pending') >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;
  if (select count(*) from public.table_requests r where r.tenant_id = p_tenant_id and r.status = 'pending') >= 300 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;

  -- Tickets en cadeaubonnen horen niet op een tafelrekening: weigeren, nooit stil weglaten.
  if exists (select 1 from public.storefront_cart_items ci where ci.cart_id = p_cart_id
               and (ci.event_detail_id is not null or ci.gift_card_metadata is not null)) then
    raise exception 'TABLE_REQUEST_MIXED' using errcode = '22023';
  end if;
  -- Een product dat (niet meer) bestaat, mag ook niet stil wegvallen.
  if exists (select 1 from public.storefront_cart_items ci left join public.products p on p.id = ci.product_id and p.tenant_id = p_tenant_id
              where ci.cart_id = p_cart_id and p.id is null) then
    raise exception 'CART_NOT_FOUND' using errcode = 'P0002';
  end if;

  for it in
    select ci.product_id, ci.variant_id, ci.quantity, ci.addons, ci.unit_price,
           p.name as product_name, p.is_active, p.sold_out_until, p.channels, v.title as variant_title, v.is_active as variant_active, (ci.variant_id is not null and v.id is null) as variant_missing
      from public.storefront_cart_items ci
      join public.products p on p.id = ci.product_id and p.tenant_id = p_tenant_id
      left join public.product_variants v on v.id = ci.variant_id
     where ci.cart_id = p_cart_id and ci.event_detail_id is null and ci.gift_card_metadata is null
     order by ci.created_at
  loop
    if not it.is_active then raise exception 'NOT_AVAILABLE:%', it.product_name using errcode = '22023'; end if;
    if it.sold_out_until is not null and it.sold_out_until > now() then raise exception 'SOLD_OUT:%', it.product_name using errcode = '22023'; end if;
    if it.channels is not null and not ('table' = any(it.channels)) then raise exception 'NOT_AVAILABLE_AT_TABLE:%', it.product_name using errcode = '22023'; end if;
    if it.variant_missing or it.variant_active is false then raise exception 'NOT_AVAILABLE:%', it.product_name using errcode = '22023'; end if;
    if it.quantity is null or it.quantity < 1 or it.quantity > 99 then raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023'; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', it.product_id, 'variant_id', it.variant_id, 'qty', it.quantity,
      'addon_ids', coalesce((select jsonb_agg(a ->> 'option_id') from jsonb_array_elements(coalesce(it.addons, '[]'::jsonb)) a where a ? 'option_id'), '[]'::jsonb),
      'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a ->> 'name')) from jsonb_array_elements(coalesce(it.addons, '[]'::jsonb)) a), '[]'::jsonb),
      'name', it.product_name || coalesce(' · ' || it.variant_title, ''),
      -- unit_price bevat de extra's al (storefront-api cart_add: prijs + extra's).
      'unit_price_cents', round(coalesce(it.unit_price, 0) * 100)));
    v_count := v_count + it.quantity;
    v_total := v_total + round(coalesce(it.unit_price, 0) * 100) * it.quantity;
  end loop;
  if jsonb_array_length(v_items) = 0 then raise exception 'CART_EMPTY' using errcode = '22023'; end if;
  if jsonb_array_length(v_items) > 60 or v_count > 999 then raise exception 'TABLE_REQUEST_TOO_BIG' using errcode = '22023'; end if;

  begin
    insert into public.table_requests (id, tenant_id, cart_id, dining_table_id, table_label, items, item_count, total_cents, guest_name, note)
    values (p_request_id, p_tenant_id, p_cart_id, p_table_id, left(btrim(p_table_label), 40), v_items, v_count, v_total,
            nullif(left(btrim(coalesce(p_guest_name, '')), 100), ''), nullif(left(btrim(coalesce(p_note, '')), 500), ''));
  exception when unique_violation then
    -- Zelfde aanvraag-ID tegelijk binnen (twee tikken op twee servers): het antwoord van de eerste.
    select * into prior from public.table_requests where id = p_request_id and tenant_id = p_tenant_id;
    if prior.id is not null then return jsonb_build_object('request_id', prior.id, 'status', prior.status, 'duplicate', true); end if;
    raise exception 'TABLE_REQUEST_INVALID' using errcode = '22023';
  end;
  update public.storefront_carts set checkout_status = 'converted', updated_at = now() where id = p_cart_id;
  perform public.horeca_bump(p_tenant_id);
  return jsonb_build_object('request_id', p_request_id, 'status', 'pending', 'duplicate', false);
end;
$$;
revoke all on function public.table_request_place(uuid, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.table_request_place(uuid, uuid, uuid, uuid, text, text, text) to service_role;

-- 4. Bevestigen (SellQo Kassa) ------------------------------------------------------------------------
-- Eén transactie: aanvraag vergrendelen, open rekening van de tafel zoeken of openen, elke lijn
-- via horeca_apply_one (zelfde regels als aantikken), aanvraag op 'accepted'. Al bevestigd =
-- hetzelfde antwoord (idempotent). De kassa verstuurt daarna de ronde zoals altijd.
create or replace function public.horeca_table_request_accept(p_tenant_id uuid, p_device_id text, p_request_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.table_requests%rowtype;
  v_check uuid;
  v_res jsonb;
  it jsonb;
  v_first boolean := true;
  v_note text;
  v_line uuid;
  v_lines uuid[] := '{}';
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  select * into r from public.table_requests where id = p_request_id and tenant_id = p_tenant_id for update;
  if r.id is null then raise exception 'aanvraag niet gevonden' using errcode = 'P0002'; end if;
  if r.status = 'accepted' then
    -- Al bevestigd. Enkel het toestel dat bevestigde, krijgt de nog onverstuurde lijnen terug om
    -- ze (alsnog) te versturen: kwam het antwoord nooit aan, dan probeert het opnieuw. Een ander
    -- toestel verstuurt nooit zelf (op een GKS-kassa zou dat een tweede P/ORDER voor dezelfde
    -- lijnen kunnen ondertekenen); het hoort enkel hoeveel lijnen nog wachten.
    return jsonb_build_object('ok', true, 'duplicate', true, 'check_id', r.check_id,
      'line_ids', case when r.device_id is not distinct from left(p_device_id, 200) then
        coalesce((select jsonb_agg(x.id) from public.check_lines x
                   where x.check_id = r.check_id and x.state = 'draft' and x.id = any(coalesce(r.line_ids, '{}'))), '[]'::jsonb)
        else '[]'::jsonb end,
      'unsent', (select count(*) from public.check_lines x
                  where x.check_id = r.check_id and x.state = 'draft' and x.id = any(coalesce(r.line_ids, '{}'))),
      'age_s', floor(extract(epoch from now() - r.decided_at)),
      'version', coalesce((select version from public.horeca_state where tenant_id = p_tenant_id), 0));
  end if;
  if r.status <> 'pending' then raise exception 'deze aanvraag werd al geweigerd' using errcode = '55000'; end if;

  -- Twee aanvragen van dezelfde tafel tegelijk: na elkaar, zodat er nooit twee rekeningen openen.
  perform pg_advisory_xact_lock(hashtextextended('table_request:' || p_tenant_id::text || ':' || coalesce(r.dining_table_id::text, r.table_label), 0));
  -- Open hoofdrekening van deze tafel (zaalplan), anders op naam "Tafel <label>".
  if r.dining_table_id is not null then
    select x.id into v_check from public.dining_checks x
     where x.tenant_id = p_tenant_id and x.table_id = r.dining_table_id and x.status = 'open' and x.split_of is null
     order by x.opened_at limit 1 for update;
  else
    select x.id into v_check from public.dining_checks x
     where x.tenant_id = p_tenant_id and x.table_id is null and x.status = 'open' and x.split_of is null
       and x.name = 'Tafel ' || r.table_label
     order by x.opened_at limit 1 for update;
  end if;
  if v_check is null then
    v_check := gen_random_uuid();
    v_res := public.horeca_apply_one(p_tenant_id, jsonb_build_object(
      'id', gen_random_uuid(), 'kind', 'open_check', 'check_id', v_check, 'staff_id', p_staff_id,
      'table_id', r.dining_table_id, 'name', case when r.dining_table_id is null then left('Tafel ' || r.table_label, 40) end));
  end if;

  v_note := nullif(btrim(concat_ws(' · ', case when r.guest_name is not null then 'QR ' || r.guest_name else 'QR' end, r.note)), '');
  for it in select * from jsonb_array_elements(r.items) loop
    v_line := gen_random_uuid();
    v_lines := v_lines || v_line;
    v_res := public.horeca_apply_one(p_tenant_id, jsonb_build_object(
      'id', gen_random_uuid(), 'kind', 'add_line', 'check_id', v_check, 'staff_id', p_staff_id, 'line_id', v_line,
      'product_id', it ->> 'product_id', 'variant_id', it ->> 'variant_id', 'qty', (it ->> 'qty')::integer,
      'addon_ids', coalesce(it -> 'addon_ids', '[]'::jsonb),
      -- De opmerking van de gast staat bij de eerste lijn (keukenbon), zo verdwijnt ze nergens.
      'note', case when v_first then left(v_note, 200) end));
    v_first := false;
  end loop;

  update public.table_requests set status = 'accepted', check_id = v_check, line_ids = v_lines, decided_at = now(),
    decided_by = p_staff_id, device_id = left(p_device_id, 200) where id = r.id;
  -- line_ids: de kassa verstuurt enkel deze lijnen als ronde (niet wat een collega aan die
  -- tafel nog aan het aantikken is).
  return jsonb_build_object('ok', true, 'duplicate', false, 'check_id', v_check, 'line_ids', to_jsonb(v_lines),
    'version', public.horeca_bump(p_tenant_id));
end;
$$;
revoke all on function public.horeca_table_request_accept(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.horeca_table_request_accept(uuid, text, uuid, uuid) to authenticated;

-- 5. Weigeren (SellQo Kassa) --------------------------------------------------------------------------
create or replace function public.horeca_table_request_reject(p_tenant_id uuid, p_request_id uuid, p_staff_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.table_requests%rowtype;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_staff_id is not null and not exists (select 1 from public.pos_cashiers s where s.id = p_staff_id and s.tenant_id = p_tenant_id and s.is_active) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  select * into r from public.table_requests where id = p_request_id and tenant_id = p_tenant_id for update;
  if r.id is null then raise exception 'aanvraag niet gevonden' using errcode = 'P0002'; end if;
  if r.status = 'rejected' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if r.status <> 'pending' then raise exception 'deze aanvraag staat al op de rekening' using errcode = '55000'; end if;
  update public.table_requests set status = 'rejected', reason = nullif(left(btrim(coalesce(p_reason, '')), 160), ''),
    decided_at = now(), decided_by = p_staff_id where id = r.id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'version', public.horeca_bump(p_tenant_id));
end;
$$;
revoke all on function public.horeca_table_request_reject(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.horeca_table_request_reject(uuid, uuid, uuid, text) to authenticated;

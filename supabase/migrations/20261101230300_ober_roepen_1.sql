-- OBER-ROEPEN-1 — de gast roept vanaf zijn tafel (QR) de bediening of vraagt de rekening.
--
-- Een oproep is GEEN bestelling en geen tafelaanvraag: een eigen tabel (table_calls) zodat
-- table_requests (items verplicht, bevestigen = lijnen op de rekening) ongemoeid blijft.
-- Persoonsgegevens: geen (enkel tafel, soort, tijd).
--
--   storefront-api  table_call            → table_call_place (service_role)
--   SellQo Kassa    kolom "Binnenkomend"  → leest open oproepen (RLS: leden van de zaak)
--                   knop "Afgehandeld"    → horeca_table_call_handle (tenant_admin/staff)
--   Melding         trigger → horeca_device_notify(tenant, 'qr_request', …, ctx.call)
--                   (zelfde toestelprofiel als QR-bestellingen; horeca-device-push maakt er
--                    "Tafel 4 roept de bediening" van; geen nieuw event-type nodig)
--
-- Rem (Akke: "geen crashes", geen spam):
--   - één oproep per tafel per soort per 2 minuten: opnieuw roepen binnen 2 min geeft dezelfde
--     oproep terug (geen fout, geen nieuwe melding);
--   - staat ze na 2 min nog open: dezelfde rij, repeat_count + 1, nieuwe melding;
--   - max. 100 open oproepen per zaak; storefront-api remt daarbovenop per IP.
--   - idempotent op de oproep-ID van de gast.
--
-- Handmatig terugdraaien:
--   drop trigger if exists trg_table_calls_device_push on public.table_calls;
--   drop function if exists public.table_call_push_tr(), public.table_call_place(uuid, uuid, uuid, text, text),
--     public.horeca_table_call_handle(uuid, uuid, uuid);
--   drop table if exists public.table_calls;

create table if not exists public.table_calls (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dining_table_id uuid references public.dining_tables(id) on delete set null,
  table_label text not null check (char_length(table_label) between 1 and 40),
  kind text not null check (kind in ('waiter', 'bill')),
  status text not null default 'open' check (status in ('open', 'handled')),
  repeat_count integer not null default 1 check (repeat_count between 1 and 999),
  last_called_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid,
  created_at timestamptz not null default now()
);
comment on table public.table_calls is 'OBER-ROEPEN-1: oproepen van een tafel via de QR (bediening of rekening). Geen persoonsgegevens.';
create index if not exists table_calls_open_idx on public.table_calls (tenant_id, last_called_at) where status = 'open';
create index if not exists table_calls_table_idx on public.table_calls (tenant_id, table_label, kind, last_called_at desc);

revoke all on public.table_calls from anon, authenticated;
grant select on public.table_calls to authenticated;
alter table public.table_calls enable row level security;
drop policy if exists table_calls_select on public.table_calls;
create policy table_calls_select on public.table_calls for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
-- Schrijven enkel via de functies hieronder (security definer).

-- Plaatsen (enkel storefront-api, service role) ----------------------------------------------------
create or replace function public.table_call_place(
  p_tenant_id uuid, p_call_id uuid, p_table_id uuid, p_table_label text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.table_calls%rowtype;
  v_label text := btrim(coalesce(p_table_label, ''));
  v_id uuid := coalesce(p_call_id, gen_random_uuid());
begin
  if p_kind not in ('waiter', 'bill') or char_length(v_label) not between 1 and 40 then
    raise exception 'TABLE_CALL_INVALID' using errcode = '22023';
  end if;

  -- Zelfde oproep-ID opnieuw (netwerkfout): dezelfde oproep.
  select * into r from public.table_calls where id = v_id;
  if r.id is not null then
    if r.tenant_id <> p_tenant_id or r.kind <> p_kind then raise exception 'TABLE_CALL_INVALID' using errcode = '22023'; end if;
    return jsonb_build_object('call_id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at, 'duplicate', true,
      'retry_after_s', greatest(0, 120 - floor(extract(epoch from now() - r.last_called_at)))::integer);
  end if;

  -- Twee gsm's aan dezelfde tafel tegelijk: na elkaar.
  perform pg_advisory_xact_lock(hashtextextended('table_call:' || p_tenant_id::text || ':' || coalesce(p_table_id::text, v_label) || ':' || p_kind, 0));
  select * into r from public.table_calls x
   where x.tenant_id = p_tenant_id and x.kind = p_kind
     and (case when p_table_id is not null then x.dining_table_id = p_table_id else x.dining_table_id is null and x.table_label = v_label end)
   order by x.last_called_at desc limit 1 for update;

  if r.id is not null and r.last_called_at > now() - interval '2 minutes' then
    return jsonb_build_object('call_id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at, 'duplicate', true,
      'retry_after_s', greatest(0, 120 - floor(extract(epoch from now() - r.last_called_at)))::integer);
  end if;

  if r.id is not null and r.status = 'open' then
    update public.table_calls set repeat_count = least(repeat_count + 1, 999), last_called_at = now() where id = r.id returning * into r;
    perform public.horeca_bump(p_tenant_id);
    return jsonb_build_object('call_id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at, 'duplicate', false, 'retry_after_s', 120);
  end if;

  if (select count(*) from public.table_calls x where x.tenant_id = p_tenant_id and x.status = 'open'
        and x.last_called_at > now() - interval '4 hours') >= 100 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '55000';
  end if;

  insert into public.table_calls (id, tenant_id, dining_table_id, table_label, kind)
  values (v_id, p_tenant_id, p_table_id, v_label, p_kind)
  returning * into r;
  perform public.horeca_bump(p_tenant_id);
  return jsonb_build_object('call_id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at, 'duplicate', false, 'retry_after_s', 120);
end;
$$;
revoke all on function public.table_call_place(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.table_call_place(uuid, uuid, uuid, text, text) to service_role;

-- Afhandelen (SellQo Kassa) ----------------------------------------------------------------------
create or replace function public.horeca_table_call_handle(p_tenant_id uuid, p_call_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.table_calls%rowtype;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_staff_id is not null and not exists (select 1 from public.pos_cashiers s where s.id = p_staff_id and s.tenant_id = p_tenant_id and s.is_active) then
    raise exception 'onbekende medewerker' using errcode = '22023';
  end if;
  select * into r from public.table_calls where id = p_call_id and tenant_id = p_tenant_id for update;
  if r.id is null then raise exception 'oproep niet gevonden' using errcode = 'P0002'; end if;
  if r.status = 'handled' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  update public.table_calls set status = 'handled', handled_at = now(), handled_by = p_staff_id where id = r.id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'version', public.horeca_bump(p_tenant_id));
end;
$$;
revoke all on function public.horeca_table_call_handle(uuid, uuid, uuid) from public, anon;
grant execute on function public.horeca_table_call_handle(uuid, uuid, uuid) to authenticated;

-- Melding naar de toestellen met het profiel "QR-bestellingen" ---------------------------------------
-- Eigen triggerfunctie (horeca_device_push_tr van MELDING-1 blijft ongemoeid). Faalt nooit mee.
create or replace function public.table_call_push_tr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and new.last_called_at is not distinct from old.last_called_at then return new; end if;
  if not exists (select 1 from public.horeca_notify_devices d where d.tenant_id = new.tenant_id and 'qr_request' = any(d.events)) then
    return new;
  end if;
  begin
    perform public.horeca_device_notify(new.tenant_id, 'qr_request', null,
      jsonb_build_object('ref', new.id, 'table', new.table_label, 'call', new.kind, 'repeat', new.repeat_count));
  exception when others then
    raise warning 'OBER-ROEPEN-1: melding niet verstuurd: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.table_call_push_tr() from public, anon, authenticated;

drop trigger if exists trg_table_calls_device_push on public.table_calls;
create trigger trg_table_calls_device_push after insert or update of last_called_at on public.table_calls
  for each row execute function public.table_call_push_tr();

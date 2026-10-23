-- PRINT-1 (23-10-2026): printers en printwachtrij voor SellQo Kassa (GKS 2.0).
-- Eisenmatrix: PRT-01, PRT-03, PRT-09, EVT-12 (herafdruk enkel via een copy-event, FAQ Q503).
--
-- printers   = de bon-, keuken- en barprinters per zaak. Een Star-printer met CloudPRNT pollt de
--              edge function `cloudprnt` en meldt zich aan met een geheim token; enkel de
--              SHA-256 daarvan (token_hash) staat hier, en `authenticated` kan die kolom NIET lezen.
-- print_jobs = de afdrukken, gemaakt door src/kassa/print/queue.ts. payload_text is de tekst
--              (32/42/48 kolommen), payload_escpos de ESC/POS-bytes in base64 (met QR).
--
-- Regels in de database:
-- - dedupe_key is uniek per zaak: hetzelfde ondertekende event gaat nooit twee keer naar
--   dezelfde printer. Een herafdruk vraagt een nieuw copy-event (C) en dus een nieuwe sleutel.
-- - Een afgedrukte job (status 'printed') verandert nooit meer van status, en de inhoud
--   (payload, sleutel, printer, zaak) is na het aanmaken onveranderlijk (trigger, ook voor
--   service_role). Zo kan een job nooit stil een tweede keer afgedrukt worden.
-- - Geen INSZ: de payloads komen uit de ticketrenderer, die het INSZ nooit afdrukt.
--
-- Additief: twee nieuwe tabellen en twee functies, niets bestaands geraakt (live nagetrokken op
-- 23-10-2026: geen tabel met "print" in de naam behalve de Printful-tabellen). Idempotent.
-- Terugdraaien (handmatig; wist alle printers en de printgeschiedenis):
--   drop table if exists public.print_jobs; drop table if exists public.printers;
--   drop function if exists public.print_jobs_guard(); drop function if exists public.printers_touch();

create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('receipt','kitchen','bar')),
  protocol text not null check (protocol in ('star_cloudprnt','epson_sdp','escpos_lan')),
  width_chars smallint not null default 42 check (width_chars in (32, 42, 48)),
  -- SHA-256 (hex) van het printer-token. Nooit leesbaar voor authenticated (zie grants).
  token_hash text check (token_hash ~ '^[0-9a-f]{64}$'),
  -- laatst gemeld door de printer (CloudPRNT-poll): MAC en statusCode, enkel ter info
  printer_mac text check (char_length(printer_mac) <= 64),
  last_status text check (char_length(last_status) <= 200),
  last_seen_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists printers_token_hash_uq on public.printers (token_hash) where token_hash is not null;
create index if not exists printers_tenant on public.printers (tenant_id);

create or replace function public.printers_touch()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists printers_touch on public.printers;
create trigger printers_touch before update on public.printers
  for each row execute function public.printers_touch();

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  printer_id uuid not null references public.printers(id) on delete restrict,
  kind text not null check (kind in ('kasticket','refund','voorrekening','bestelbon','kopie','training','keuken','bar','rapport')),
  payload_text text not null check (octet_length(payload_text) <= 65536),
  payload_escpos text check (payload_escpos ~ '^[A-Za-z0-9+/]*={0,2}$' and octet_length(payload_escpos) <= 262144),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  status text not null default 'queued' check (status in ('queued','printing','printed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 1000),
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  claimed_at timestamptz,
  printed_at timestamptz,
  constraint print_jobs_printed_at check ((status = 'printed') = (printed_at is not null))
);
create unique index if not exists print_jobs_dedupe_uq on public.print_jobs (tenant_id, dedupe_key);
create index if not exists print_jobs_queue on public.print_jobs (printer_id, created_at) where status in ('queued','printing');
create index if not exists print_jobs_tenant on public.print_jobs (tenant_id, created_at desc);

-- Onveranderlijke inhoud + toegelaten statusovergangen, voor iedereen (ook service_role).
create or replace function public.print_jobs_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'queued' or new.attempts <> 0 or new.printed_at is not null or new.claimed_at is not null then
      raise exception 'PRINT-1: een nieuwe job start als queued' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.printers p where p.id = new.printer_id and p.tenant_id = new.tenant_id) then
      raise exception 'PRINT-1: printer hoort niet bij deze zaak' using errcode = 'foreign_key_violation';
    end if;
    return new;
  end if;
  if new.tenant_id <> old.tenant_id or new.printer_id <> old.printer_id or new.kind <> old.kind
     or new.payload_text <> old.payload_text or new.payload_escpos is distinct from old.payload_escpos
     or new.dedupe_key <> old.dedupe_key or new.created_at <> old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'PRINT-1: inhoud van een printjob is onveranderlijk' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'printed' and new.status <> 'printed' then
    raise exception 'PRINT-1: een afgedrukte job wordt nooit opnieuw afgedrukt (herafdruk = copy-event)' using errcode = 'insufficient_privilege';
  end if;
  if new.status <> old.status and not (
       (old.status = 'queued' and new.status in ('printing','printed','failed'))
    or (old.status = 'printing' and new.status in ('printed','failed','queued'))
    or (old.status = 'failed' and new.status = 'queued')
  ) then
    raise exception 'PRINT-1: statusovergang % -> % niet toegelaten', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists print_jobs_guard on public.print_jobs;
create trigger print_jobs_guard before insert or update on public.print_jobs
  for each row execute function public.print_jobs_guard();

alter table public.printers enable row level security;
alter table public.print_jobs enable row level security;

-- Rechten. anon: niets. authenticated: printers lezen zonder token_hash; token_hash wel
-- schrijven (beheerder koppelt een printer), nooit lezen. Printers worden uitgezet, niet gewist.
-- service_role (edge function): lezen en bijwerken.
revoke all on public.printers from anon, authenticated, service_role;
revoke all on public.print_jobs from anon, authenticated, service_role;
grant select (id, tenant_id, name, kind, protocol, width_chars, printer_mac, last_status, last_seen_at, is_active, created_at, updated_at)
  on public.printers to authenticated;
grant insert (id, tenant_id, name, kind, protocol, width_chars, token_hash, is_active) on public.printers to authenticated;
grant update (name, kind, protocol, width_chars, token_hash, is_active) on public.printers to authenticated;
grant select, insert, update on public.printers to service_role;

grant select on public.print_jobs to authenticated;
grant insert (tenant_id, printer_id, kind, payload_text, payload_escpos, dedupe_key) on public.print_jobs to authenticated;
-- Een lokale ESC/POS-printer (escpos_lan) wordt door het kassatoestel zelf aangestuurd; dat
-- toestel meldt de uitkomst. De guard-trigger bewaakt welke overgangen mogen.
grant update (status, attempts, error, claimed_at, printed_at) on public.print_jobs to authenticated;
grant select, insert, update on public.print_jobs to service_role;

drop policy if exists printers_select on public.printers;
create policy printers_select on public.printers for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists printers_insert on public.printers;
create policy printers_insert on public.printers for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
drop policy if exists printers_update on public.printers;
create policy printers_update on public.printers for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
-- Geen delete voor authenticated: een printer met geschiedenis zet je uit (is_active = false).
drop policy if exists printers_delete on public.printers;

drop policy if exists print_jobs_select on public.print_jobs;
create policy print_jobs_select on public.print_jobs for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists print_jobs_insert on public.print_jobs;
create policy print_jobs_insert on public.print_jobs for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_tenant_role(tenant_id, array['tenant_admin','staff']::public.app_role[])
  );
drop policy if exists print_jobs_update on public.print_jobs;
create policy print_jobs_update on public.print_jobs for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin','staff']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['tenant_admin','staff']::public.app_role[]));

comment on table public.printers is 'SellQo Kassa: bon-, keuken- en barprinters. token_hash = SHA-256 van het CloudPRNT-token, nooit leesbaar voor authenticated.';
comment on table public.print_jobs is 'SellQo Kassa: printwachtrij. Inhoud onveranderlijk, printed is eindstatus; herafdruk enkel via een copy-event (FAQ Q503).';

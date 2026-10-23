-- KASSA-0 (23-10-2026): fiscaal logboek van SellQo Kassa (GKS 2.0).
-- Eisenmatrix: EVT-01, EVT-13, DATA-01, DATA-04, DATA-05.
--
-- fiscal_events   = elk door de FDM ondertekend event, met het verzonden bericht en het
--                   antwoord BYTE-EXACT. Enkel ondertekende events komen hier; een bericht dat
--                   nog geen antwoord kreeg, wacht op het toestel (FiscalSender).
-- fiscal_audit_log = wat er rond de fiscale laag gebeurt (weigering, FDM onbereikbaar,
--                   trainingsmodus aan/uit, export, ...).
-- Beide zijn APPEND-ONLY: geen UPDATE, DELETE of TRUNCATE voor wie dan ook (trigger + geen
-- grants), ook niet voor service_role. Bewaartermijn 10 jaar (art. 60 Wbtw): nooit purgen.
--
-- Additief: twee nieuwe tabellen, niets bestaands geraakt. Idempotent.
-- Terugdraaien (handmatig, ENKEL zolang er geen echte events in staan):
--   drop table if exists public.fiscal_audit_log; drop table if exists public.fiscal_events;
--   drop function if exists public.fiscal_append_only();
--   drop function if exists public.tenant_has_business_module(uuid, text);
--
-- Security
-- - INSZ (employeeId) zit onvermijdelijk in request_body/response_body: kolomrechten laten
--   die twee kolommen NIET lezen door `authenticated`. Inzage voor de controleur gaat later via
--   een export-functie (CERT-1). De metadata (labels, tellers, bedragen) is leesbaar voor
--   leden van de zaak.
-- - Insert enkel voor een tenant waar je lid van bent, met horeca-spoor, als tenant_admin of
--   staff. De ondertekening zelf komt van de FDM; dubbels botsen op de unieke sleutels.

create or replace function public.fiscal_append_only()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'GKS: % is append-only (% geweigerd)', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- Heeft deze zaak het horeca-spoor? Security definer zodat de policy niet afhangt van de
-- RLS op tenants. Leest enkel business_modules van één tenant.
create or replace function public.tenant_has_business_module(_tenant_id uuid, _module text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.tenants t where t.id = _tenant_id and _module = any(t.business_modules));
$$;
revoke all on function public.tenant_has_business_module(uuid, text) from public, anon;
grant execute on function public.tenant_has_business_module(uuid, text) to authenticated, service_role;

create table if not exists public.fiscal_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  mutation text not null check (mutation in (
    'signWorkIn','signWorkOut','signInvoice','signSale','signCostCenterChange','signOrder','signPreBill',
    'signMoneyInOut','signDrawerOpen','signPaymentCorrection','signReportTurnoverX','signReportTurnoverZ',
    'signReportUserX','signReportUserZ','signCopy')),
  is_training boolean not null default false,
  -- identificatie (uit het bericht)
  pos_id text not null check (pos_id ~ '^[A-Z0-9]{14}$'),
  terminal_id text not null check (char_length(terminal_id) between 1 and 100),
  device_id text not null check (char_length(device_id) between 1 and 200),
  pos_fiscal_ticket_no integer not null check (pos_fiscal_ticket_no between 1 and 999999999),
  pos_date_time text not null,
  pos_sw_version text not null check (char_length(pos_sw_version) between 1 and 36),
  booking_date date not null,
  booking_period_id uuid not null,
  -- verwijzing naar het personeelsprofiel (PERSONEEL-1); nooit het INSZ zelf in een kolom
  staff_id uuid,
  -- FDM-antwoord
  fdm_id text not null,
  fdm_date_time text not null,
  event_label text not null check (event_label in ('N','P','F','S','I','R','C','T')),
  event_operation text not null,
  event_counter integer not null check (event_counter between 1 and 999999999),
  total_counter integer not null check (total_counter between 1 and 999999999),
  short_signature text,
  verification_url text,
  -- afgeleid, voor snelle rapporten (bron blijft request/response)
  transaction_total_cents bigint,
  cost_center_reference text,
  -- de bytes zoals verstuurd en ontvangen (DATA-01)
  request_body text not null,
  response_body text not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  constraint fiscal_events_label_mutation check (
    (is_training and event_label = 'T') or (not is_training and event_label <> 'T')
  )
);

-- ID-11: de vijf sleutelvelden zijn uniek per zaak.
create unique index if not exists fiscal_events_key_uq
  on public.fiscal_events (tenant_id, pos_id, pos_date_time, terminal_id, event_label, pos_fiscal_ticket_no);
-- Eén FDM-teller wordt maar één keer gebruikt.
create unique index if not exists fiscal_events_fdm_counter_uq on public.fiscal_events (fdm_id, total_counter, fdm_date_time);
create index if not exists fiscal_events_tenant_day on public.fiscal_events (tenant_id, booking_date, total_counter);
create index if not exists fiscal_events_tenant_cc on public.fiscal_events (tenant_id, cost_center_reference) where cost_center_reference is not null;

drop trigger if exists fiscal_events_no_update on public.fiscal_events;
create trigger fiscal_events_no_update before update or delete on public.fiscal_events
  for each row execute function public.fiscal_append_only();
drop trigger if exists fiscal_events_no_truncate on public.fiscal_events;
create trigger fiscal_events_no_truncate before truncate on public.fiscal_events
  for each statement execute function public.fiscal_append_only();

create table if not exists public.fiscal_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now(),
  actor_id uuid default auth.uid(),
  device_id text,
  action text not null check (action ~ '^[a-z_]{3,60}$'),
  details jsonb not null default '{}'::jsonb,
  constraint fiscal_audit_details_size check (pg_column_size(details) <= 16384)
);
create index if not exists fiscal_audit_log_tenant on public.fiscal_audit_log (tenant_id, created_at desc);

drop trigger if exists fiscal_audit_log_no_update on public.fiscal_audit_log;
create trigger fiscal_audit_log_no_update before update or delete on public.fiscal_audit_log
  for each row execute function public.fiscal_append_only();
drop trigger if exists fiscal_audit_log_no_truncate on public.fiscal_audit_log;
create trigger fiscal_audit_log_no_truncate before truncate on public.fiscal_audit_log
  for each statement execute function public.fiscal_append_only();

alter table public.fiscal_events enable row level security;
alter table public.fiscal_audit_log enable row level security;

-- Rechten: niemand mag wijzigen of wissen; authenticated leest geen berichtinhoud.
revoke all on public.fiscal_events from anon, authenticated, service_role;
revoke all on public.fiscal_audit_log from anon, authenticated, service_role;
grant insert on public.fiscal_events to authenticated;
grant select (
  id, tenant_id, created_at, created_by, mutation, is_training, pos_id, terminal_id, device_id,
  pos_fiscal_ticket_no, pos_date_time, pos_sw_version, booking_date, booking_period_id, staff_id,
  fdm_id, fdm_date_time, event_label, event_operation, event_counter, total_counter,
  short_signature, verification_url, transaction_total_cents, cost_center_reference, request_sha256
) on public.fiscal_events to authenticated;
grant select, insert on public.fiscal_events to service_role;
grant select, insert on public.fiscal_audit_log to authenticated, service_role;

drop policy if exists fiscal_events_insert on public.fiscal_events;
create policy fiscal_events_insert on public.fiscal_events for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_tenant_role(tenant_id, array['tenant_admin','staff']::public.app_role[])
    and public.tenant_has_business_module(tenant_id, 'horeca')
  );
drop policy if exists fiscal_events_select on public.fiscal_events;
create policy fiscal_events_select on public.fiscal_events for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));

drop policy if exists fiscal_audit_insert on public.fiscal_audit_log;
create policy fiscal_audit_insert on public.fiscal_audit_log for insert to authenticated
  with check (
    actor_id = auth.uid()
    and tenant_id in (select public.get_user_tenant_ids(auth.uid()))
  );
drop policy if exists fiscal_audit_select on public.fiscal_audit_log;
create policy fiscal_audit_select on public.fiscal_audit_log for select to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));

comment on table public.fiscal_events is 'GKS 2.0: door de FDM ondertekende events, append-only, 10 jaar bewaren. Wijzigen in src/kassa/ = fiscale release.';
comment on table public.fiscal_audit_log is 'GKS 2.0: auditspoor rond de fiscale laag, append-only.';

-- KASSA-ODOO-1 — dagontvangsten van SellQo Kassa naar Odoo (één boeking per Z-rapport).
-- Edge function: supabase/functions/sync-odoo-pos-z; regels: supabase/functions/_shared/odooPosZ.ts.
--
-- 1. Instellingen op tenant_odoo_settings (niet een van de vier gedeelde storefront-tabellen;
--    storefront-api leest deze tabel niet). Standaard UIT:
--      pos_z_sync_enabled  false  = de functie slaat de winkel over.
--      pos_z_sync_from     null   = zonder startdatum boekt de functie niets (geen terugwerkende
--                                   kracht: Z's die de boekhouder al met de hand boekte, blijven
--                                   buiten). De admin vult vandaag in bij het aanzetten.
--      pos_z_journal_id/_name null = het gewone verkoopdagboek (odoo_journal_id).
--    Geen gevoelige gegevens. Tabelrechten en RLS (tenant_admin/accountant schrijven) blijven.
-- 2. Logtabel odoo_pos_z_sync_log: één claim per Z (unieke index op pending/synced/skipped),
--    mislukte pogingen als losse rijen. Schrijven enkel service_role; lezen platformbeheer en de
--    beheerder/boekhouder van de eigen winkel.
--
-- Additief en idempotent. Geen cron hier (zie 20261101230502_kassa_odoo_1_cron.sql).
--
-- Handmatig terugdraaien (enkel zolang er nog geen Z's geboekt zijn; anders de logtabel bewaren,
-- want ze is het bewijs welke Z in welke Odoo-boeking zit):
--   drop table if exists public.odoo_pos_z_sync_log;
--   alter table public.tenant_odoo_settings drop column if exists pos_z_sync_enabled,
--     drop column if exists pos_z_sync_from, drop column if exists pos_z_journal_id,
--     drop column if exists pos_z_journal_name;

alter table public.tenant_odoo_settings add column if not exists pos_z_sync_enabled boolean not null default false;
alter table public.tenant_odoo_settings add column if not exists pos_z_sync_from date;
alter table public.tenant_odoo_settings add column if not exists pos_z_journal_id text;
alter table public.tenant_odoo_settings add column if not exists pos_z_journal_name text;

comment on column public.tenant_odoo_settings.pos_z_sync_enabled is 'KASSA-ODOO-1: Z-rapporten van SellQo Kassa naar Odoo boeken (standaard uit).';
comment on column public.tenant_odoo_settings.pos_z_sync_from is 'KASSA-ODOO-1: enkel Z-rapporten met bedrijfsdag vanaf deze datum. Leeg = niets boeken.';
comment on column public.tenant_odoo_settings.pos_z_journal_id is 'KASSA-ODOO-1: Odoo-verkoopdagboek voor de Z-boekingen. Leeg = odoo_journal_id.';

create table if not exists public.odoo_pos_z_sync_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kassa_report_id uuid not null references public.kassa_reports(id) on delete restrict,
  report_no integer,
  booking_date date,
  sync_status text not null check (sync_status in ('pending', 'synced', 'failed', 'skipped')),
  move_type text check (move_type is null or move_type in ('out_invoice', 'out_refund')),
  odoo_move_id text,
  odoo_move_name text,
  odoo_state text,
  amounts jsonb,
  error_message text,
  -- Eén rij per Z: een nieuwe poging zet de laatste 'failed'-rij terug op pending (attempts + 1);
  -- created_at = begin van de laatste poging.
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- Eén Z hoogstens één keer in behandeling of geboekt (R6). 'failed' mag herhaald worden.
create unique index if not exists odoo_pos_z_sync_log_claim_uq on public.odoo_pos_z_sync_log (tenant_id, kassa_report_id)
  where sync_status in ('pending', 'synced', 'skipped');
create index if not exists odoo_pos_z_sync_log_tenant_idx on public.odoo_pos_z_sync_log (tenant_id, created_at desc);
create index if not exists odoo_pos_z_sync_log_report_idx on public.odoo_pos_z_sync_log (kassa_report_id);

alter table public.odoo_pos_z_sync_log enable row level security;
drop policy if exists odoo_pos_z_sync_log_read on public.odoo_pos_z_sync_log;
create policy odoo_pos_z_sync_log_read on public.odoo_pos_z_sync_log for select to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or exists (select 1 from public.user_roles ur
               where ur.user_id = auth.uid() and ur.tenant_id = odoo_pos_z_sync_log.tenant_id
                 and ur.role in ('tenant_admin', 'accountant'))
  );
revoke all on public.odoo_pos_z_sync_log from anon, authenticated;
grant select on public.odoo_pos_z_sync_log to authenticated;
grant all on public.odoo_pos_z_sync_log to service_role;

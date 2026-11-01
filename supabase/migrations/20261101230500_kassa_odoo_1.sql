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
-- 3. (Review 1) Startdatum server-side: trigger tenant_odoo_settings_pos_z_guard zet
--    pos_z_enabled_at bij het aanzetten en weigert een pos_z_sync_from vóór de Brusselse dag van
--    het aanzetten, tenzij odoo_pos_z_confirm_backfill (RPC, met het aantal Z's dat dan geboekt
--    wordt) een vroegere datum bevestigde. De client kan pos_z_enabled_at en pos_z_backfill_*
--    niet zelf schrijven (de trigger zet ze terug). Uitzetten wist de bevestiging.
-- 4. (Review 1) RPC's voor de admin: odoo_pos_z_backfill_count, odoo_pos_z_confirm_backfill,
--    odoo_pos_z_accept (een met de hand geboekte Z aanvaarden, logt wie) en odoo_pos_z_retry
--    (needs_review opnieuw laten proberen). Enkel tenant_admin/accountant of platformbeheer.
--
-- Additief en idempotent. Geen cron hier (zie 20261101230502_kassa_odoo_1_cron.sql).
--
-- Handmatig terugdraaien (enkel zolang er nog geen Z's geboekt zijn; anders de logtabel bewaren,
-- want ze is het bewijs welke Z in welke Odoo-boeking zit):
--   drop trigger if exists tenant_odoo_settings_pos_z_guard on public.tenant_odoo_settings;
--   drop function if exists public.tenant_odoo_settings_pos_z_guard(), public.odoo_pos_z_backfill_count(uuid, date),
--     public.odoo_pos_z_confirm_backfill(uuid, date, integer), public.odoo_pos_z_accept(uuid, text), public.odoo_pos_z_retry(uuid);
--   drop table if exists public.odoo_pos_z_sync_log;
--   alter table public.tenant_odoo_settings drop column if exists pos_z_sync_enabled,
--     drop column if exists pos_z_sync_from, drop column if exists pos_z_journal_id,
--     drop column if exists pos_z_journal_name, drop column if exists pos_z_enabled_at,
--     drop column if exists pos_z_backfill_from, drop column if exists pos_z_backfill_confirmed_at,
--     drop column if exists pos_z_backfill_confirmed_by;

alter table public.tenant_odoo_settings add column if not exists pos_z_sync_enabled boolean not null default false;
alter table public.tenant_odoo_settings add column if not exists pos_z_sync_from date;
alter table public.tenant_odoo_settings add column if not exists pos_z_journal_id text;
alter table public.tenant_odoo_settings add column if not exists pos_z_journal_name text;
alter table public.tenant_odoo_settings add column if not exists pos_z_enabled_at timestamptz;
alter table public.tenant_odoo_settings add column if not exists pos_z_backfill_from date;
alter table public.tenant_odoo_settings add column if not exists pos_z_backfill_confirmed_at timestamptz;
alter table public.tenant_odoo_settings add column if not exists pos_z_backfill_confirmed_by uuid;

comment on column public.tenant_odoo_settings.pos_z_sync_enabled is 'KASSA-ODOO-1: Z-rapporten van SellQo Kassa naar Odoo boeken (standaard uit).';
comment on column public.tenant_odoo_settings.pos_z_sync_from is 'KASSA-ODOO-1: enkel Z-rapporten met bedrijfsdag vanaf deze datum. Leeg = niets boeken.';
comment on column public.tenant_odoo_settings.pos_z_journal_id is 'KASSA-ODOO-1: Odoo-verkoopdagboek voor de Z-boekingen. Leeg = odoo_journal_id.';

create table if not exists public.odoo_pos_z_sync_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kassa_report_id uuid not null references public.kassa_reports(id) on delete restrict,
  report_no integer,
  booking_date date,
  -- needs_review = na 10 pogingen of bij een ongeldige Z: geen automatische pogingen meer.
  -- accepted = door een gebruiker aanvaard (met de hand geboekt), zie accepted_*.
  sync_status text not null check (sync_status in ('pending', 'synced', 'failed', 'skipped', 'needs_review', 'accepted')),
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
  finished_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  accepted_note text
);
-- Eén Z hoogstens één keer in behandeling of geboekt (R6). 'failed' mag herhaald worden.
create unique index if not exists odoo_pos_z_sync_log_claim_uq on public.odoo_pos_z_sync_log (tenant_id, kassa_report_id)
  where sync_status in ('pending', 'synced', 'skipped', 'needs_review', 'accepted');
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

-- ── Startdatum: trigger (review 1, punt 1) ─────────────────────────────────────────────────
-- Bevoorrecht = alles behalve een rechtstreekse client-schrijfactie (authenticated/anon): de
-- service role, migraties en de SECURITY DEFINER-RPC hieronder (daar is current_user de eigenaar).
create or replace function public.tenant_odoo_settings_pos_z_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_priv boolean := current_user not in ('authenticated', 'anon');
  v_min date;
begin
  if tg_op = 'INSERT' then
    if not v_priv then
      new.pos_z_enabled_at := null; new.pos_z_backfill_from := null;
      new.pos_z_backfill_confirmed_at := null; new.pos_z_backfill_confirmed_by := null;
    end if;
    if coalesce(new.pos_z_sync_enabled, false) and new.pos_z_enabled_at is null then new.pos_z_enabled_at := now(); end if;
  else
    if not v_priv then
      new.pos_z_enabled_at := old.pos_z_enabled_at; new.pos_z_backfill_from := old.pos_z_backfill_from;
      new.pos_z_backfill_confirmed_at := old.pos_z_backfill_confirmed_at; new.pos_z_backfill_confirmed_by := old.pos_z_backfill_confirmed_by;
    end if;
    if coalesce(new.pos_z_sync_enabled, false) and not coalesce(old.pos_z_sync_enabled, false) then
      new.pos_z_enabled_at := now();
    elsif not coalesce(new.pos_z_sync_enabled, false) and coalesce(old.pos_z_sync_enabled, false) then
      -- Uitzetten wist het aanzetmoment en de bevestiging: opnieuw aanzetten = opnieuw bevestigen.
      new.pos_z_enabled_at := null; new.pos_z_backfill_from := null;
      new.pos_z_backfill_confirmed_at := null; new.pos_z_backfill_confirmed_by := null;
    end if;
  end if;
  if coalesce(new.pos_z_sync_enabled, false) then
    if new.pos_z_sync_from is null then
      raise exception 'kies vanaf welke bedrijfsdag de Z-rapporten naar Odoo gaan' using errcode = '22023';
    end if;
    v_min := least((coalesce(new.pos_z_enabled_at, now()) at time zone 'Europe/Brussels')::date, coalesce(new.pos_z_backfill_from, 'infinity'::date));
    if new.pos_z_sync_from < v_min then
      raise exception 'een startdatum vóór vandaag moet eerst bevestigd worden (met het aantal Z-rapporten dat dan geboekt wordt)' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists tenant_odoo_settings_pos_z_guard on public.tenant_odoo_settings;
create trigger tenant_odoo_settings_pos_z_guard before insert or update on public.tenant_odoo_settings
  for each row execute function public.tenant_odoo_settings_pos_z_guard();

-- Mag de gebruiker de Z-instellingen of -log van deze winkel beheren?
create or replace function public.odoo_pos_z_can_manage(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_platform_admin(auth.uid())
      or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.tenant_id = p_tenant_id
                 and ur.role in ('tenant_admin', 'accountant'));
$$;
revoke all on function public.odoo_pos_z_can_manage(uuid) from public, anon, authenticated;

-- Hoeveel Z's zouden vanaf p_from geboekt worden (nog niet geboekt, overgeslagen of aanvaard)?
create or replace function public.odoo_pos_z_backfill_count(p_tenant_id uuid, p_from date)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.odoo_pos_z_can_manage(p_tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  return (select count(*)::integer from public.kassa_reports k
          where k.tenant_id = p_tenant_id and k.kind = 'Z' and k.booking_date >= p_from
            and not (k.data ? 'historical_import')
            and not exists (select 1 from public.odoo_pos_z_sync_log l where l.kassa_report_id = k.id
                            and l.sync_status in ('synced', 'skipped', 'accepted', 'needs_review')));
end;
$$;
revoke all on function public.odoo_pos_z_backfill_count(uuid, date) from public, anon;
grant execute on function public.odoo_pos_z_backfill_count(uuid, date) to authenticated;

-- Een startdatum in het verleden bevestigen. p_count = het aantal dat de gebruiker zag: klopt het
-- niet meer (intussen een Z bij), dan weigeren zodat hij het nieuwe aantal ziet.
create or replace function public.odoo_pos_z_confirm_backfill(p_tenant_id uuid, p_from date, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  if not public.odoo_pos_z_can_manage(p_tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  if p_from is null or p_from > (now() at time zone 'Europe/Brussels')::date then raise exception 'ongeldige startdatum' using errcode = '22023'; end if;
  v_count := public.odoo_pos_z_backfill_count(p_tenant_id, p_from);
  if v_count is distinct from p_count then
    raise exception 'het aantal Z-rapporten is intussen gewijzigd (% i.p.v. %); bevestig opnieuw', v_count, p_count using errcode = '40001';
  end if;
  update public.tenant_odoo_settings
     set pos_z_backfill_from = p_from, pos_z_backfill_confirmed_at = now(), pos_z_backfill_confirmed_by = auth.uid(),
         pos_z_sync_from = p_from, updated_at = now()
   where tenant_id = p_tenant_id;
  if not found then raise exception 'eerst de Odoo-instellingen opslaan' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'from', p_from, 'count', v_count);
end;
$$;
revoke all on function public.odoo_pos_z_confirm_backfill(uuid, date, integer) from public, anon;
grant execute on function public.odoo_pos_z_confirm_backfill(uuid, date, integer) to authenticated;

-- Een Z die met de hand in Odoo geboekt werd, aanvaarden (review 1, punt 4). Logt wie en waarom.
create or replace function public.odoo_pos_z_accept(p_log_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  l public.odoo_pos_z_sync_log%rowtype;
begin
  select * into l from public.odoo_pos_z_sync_log where id = p_log_id for update;
  if l.id is null or not public.odoo_pos_z_can_manage(l.tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  if l.sync_status not in ('failed', 'needs_review') then raise exception 'enkel een mislukte Z kan aanvaard worden' using errcode = '55000'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'zeg kort hoe deze Z geboekt werd (bv. het Odoo-nummer)' using errcode = '22023'; end if;
  update public.odoo_pos_z_sync_log
     set sync_status = 'accepted', accepted_at = now(), accepted_by = auth.uid(), accepted_note = left(trim(p_note), 500), finished_at = now()
   where id = p_log_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.odoo_pos_z_accept(uuid, text) from public, anon;
grant execute on function public.odoo_pos_z_accept(uuid, text) to authenticated;

-- needs_review opnieuw laten proberen (teller op nul: weer elk uur, tot 3 pogingen).
create or replace function public.odoo_pos_z_retry(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  l public.odoo_pos_z_sync_log%rowtype;
begin
  select * into l from public.odoo_pos_z_sync_log where id = p_log_id for update;
  if l.id is null or not public.odoo_pos_z_can_manage(l.tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  if l.sync_status <> 'needs_review' then raise exception 'enkel een Z die nagekeken moet worden' using errcode = '55000'; end if;
  update public.odoo_pos_z_sync_log set sync_status = 'failed', attempts = 0, finished_at = now() where id = p_log_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.odoo_pos_z_retry(uuid) from public, anon;
grant execute on function public.odoo_pos_z_retry(uuid) to authenticated;

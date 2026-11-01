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
-- 3. Startdatum server-side (review 1 en 2): BEFORE-trigger _guard zet pos_z_enabled_at bij het
--    aanzetten, zet pos_z_enabled_at/pos_z_backfill_* terug bij een client-schrijfactie, en zet de
--    Z-sync uit (met wissen) als de factuursync uitgaat. AFTER-trigger _check weigert een eindstaat
--    met pos_z_sync_from vóór de bedrijfsdag van het aanzetten, tenzij odoo_pos_z_confirm_backfill
--    (die ook meteen aanzet) een vroegere dag bevestigde. Werkt ook voor PostgREST-upserts.
-- 4. (Review 1) RPC's voor de admin: odoo_pos_z_backfill_count, odoo_pos_z_confirm_backfill,
--    odoo_pos_z_accept (een met de hand geboekte Z aanvaarden, logt wie) en odoo_pos_z_retry
--    (needs_review opnieuw laten proberen). Enkel tenant_admin/accountant of platformbeheer.
--
-- Additief en idempotent. Geen cron hier (zie 20261101230502_kassa_odoo_1_cron.sql).
--
-- Handmatig terugdraaien (enkel zolang er nog geen Z's geboekt zijn; anders de logtabel bewaren,
-- want ze is het bewijs welke Z in welke Odoo-boeking zit):
--   drop trigger if exists tenant_odoo_settings_pos_z_guard on public.tenant_odoo_settings;
--   drop trigger if exists tenant_odoo_settings_pos_z_check on public.tenant_odoo_settings;
--   drop function if exists public.tenant_odoo_settings_pos_z_guard(), public.tenant_odoo_settings_pos_z_check(),
--     public.odoo_pos_z_min_from(uuid, timestamptz, date), public.odoo_pos_z_can_manage(uuid), public.odoo_pos_z_business_day(uuid),
--     public.odoo_pos_z_backfill_count(uuid, date), public.odoo_pos_z_confirm_backfill(uuid, date, integer, text, text),
--     public.odoo_pos_z_accept(uuid, text), public.odoo_pos_z_retry(uuid);
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
  -- Review 2: uitgestelde pogingen (tijdsbudget op) en de ronde na 'Opnieuw proberen' (dedupe).
  deferrals integer not null default 0,
  retry_round integer not null default 0,
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

-- ── Startdatum: triggers (review 1 punt 1, review 2 B1/4/14) ───────────────────────────────
-- Twee triggers, omdat PostgREST een upsert als INSERT … ON CONFLICT DO UPDATE stuurt: de BEFORE
-- INSERT-trigger ziet dan de voorgestelde rij (zonder de bestaande enabled_at/backfill), ook als
-- die daarna een UPDATE wordt. Daarom:
--   * BEFORE INSERT OR UPDATE (_guard): enkel opschonen en zetten, nooit weigeren.
--   * AFTER INSERT OR UPDATE (_check): controleert de EINDSTAAT van de rij en weigert dan.
-- Bevoorrecht = alles behalve een rechtstreekse client-schrijfactie (authenticated/anon): de
-- service role, migraties en de SECURITY DEFINER-RPC's hieronder (daar is current_user de eigenaar).
create or replace function public.tenant_odoo_settings_pos_z_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_priv boolean := current_user not in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if not v_priv then
      new.pos_z_enabled_at := null; new.pos_z_backfill_from := null;
      new.pos_z_backfill_confirmed_at := null; new.pos_z_backfill_confirmed_by := null;
    end if;
    -- Let op: bij een upsert is dit de VOORGESTELDE rij en wat we hier zetten, belandt in EXCLUDED.
    -- Daarom hier geen payloadkolommen (pos_z_sync_enabled, …) wijzigen; enkel de beschermde.
    if coalesce(new.pos_z_sync_enabled, false) and new.pos_z_enabled_at is null then new.pos_z_enabled_at := now(); end if;
    return new;
  end if;
  if not v_priv then
    new.pos_z_enabled_at := old.pos_z_enabled_at; new.pos_z_backfill_from := old.pos_z_backfill_from;
    new.pos_z_backfill_confirmed_at := old.pos_z_backfill_confirmed_at; new.pos_z_backfill_confirmed_by := old.pos_z_backfill_confirmed_by;
  end if;
  -- Review 2 punt 4: de factuursync uit = ook de Z-sync uit (zelfde verbinding en dagboek).
  if not coalesce(new.odoo_sync_enabled, false) then new.pos_z_sync_enabled := false; end if;
  if coalesce(new.pos_z_sync_enabled, false) and not coalesce(old.pos_z_sync_enabled, false) then
    new.pos_z_enabled_at := now();
  elsif not coalesce(new.pos_z_sync_enabled, false) then
    -- Uit = aanzetmoment en bevestiging weg: opnieuw aanzetten = opnieuw vanaf de huidige bedrijfsdag.
    new.pos_z_enabled_at := null; new.pos_z_backfill_from := null;
    new.pos_z_backfill_confirmed_at := null; new.pos_z_backfill_confirmed_by := null;
  end if;
  return new;
end;
$$;
drop trigger if exists tenant_odoo_settings_pos_z_guard on public.tenant_odoo_settings;
create trigger tenant_odoo_settings_pos_z_guard before insert or update on public.tenant_odoo_settings
  for each row execute function public.tenant_odoo_settings_pos_z_guard();

-- Vroegste toegestane startdatum: de bedrijfsdag (afkapuur van de kassa) van het aanzetten, of een
-- vroegere dag die via odoo_pos_z_confirm_backfill bevestigd werd (review 2 punt 14).
create or replace function public.odoo_pos_z_min_from(p_tenant_id uuid, p_enabled_at timestamptz, p_backfill date)
returns date
language sql
stable
security definer
set search_path to ''
as $$
  select least(public.kassa_business_day(p_tenant_id, coalesce(p_enabled_at, now())), coalesce(p_backfill, 'infinity'::date));
$$;
revoke all on function public.odoo_pos_z_min_from(uuid, timestamptz, date) from public, anon, authenticated;

-- AFTER: eindstaat controleren (security definer voor kassa_business_day; weigeren = hele
-- opdracht terug).
create or replace function public.tenant_odoo_settings_pos_z_check()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if coalesce(new.pos_z_sync_enabled, false) then
    if not coalesce(new.odoo_sync_enabled, false) then
      raise exception 'zet eerst de Odoo-facturatiesync aan' using errcode = '22023';
    end if;
    if new.pos_z_sync_from is null then
      raise exception 'kies vanaf welke bedrijfsdag de Z-rapporten naar Odoo gaan' using errcode = '22023';
    end if;
    if new.pos_z_sync_from < public.odoo_pos_z_min_from(new.tenant_id, new.pos_z_enabled_at, new.pos_z_backfill_from) then
      raise exception 'een startdatum vóór de huidige bedrijfsdag moet eerst bevestigd worden (met het aantal Z-rapporten dat dan geboekt wordt)' using errcode = '42501';
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists tenant_odoo_settings_pos_z_check on public.tenant_odoo_settings;
create trigger tenant_odoo_settings_pos_z_check after insert or update on public.tenant_odoo_settings
  for each row execute function public.tenant_odoo_settings_pos_z_check();

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

-- Huidige bedrijfsdag van de kassa (afkapuur), voor de standaard-startdatum in de admin.
create or replace function public.odoo_pos_z_business_day(p_tenant_id uuid)
returns date
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.odoo_pos_z_can_manage(p_tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  return public.kassa_business_day(p_tenant_id, now());
end;
$$;
revoke all on function public.odoo_pos_z_business_day(uuid) from public, anon;
grant execute on function public.odoo_pos_z_business_day(uuid) to authenticated;

-- Een startdatum in het verleden bevestigen ÉN in dezelfde transactie de Z-sync aanzetten met dat
-- dagboek (review 2 H2: geen losse bevestiging die later bij een ander aanzetten meetelt).
-- p_count = het aantal dat de gebruiker zag: klopt het niet meer, dan weigeren.
create or replace function public.odoo_pos_z_confirm_backfill(p_tenant_id uuid, p_from date, p_count integer, p_journal_id text, p_journal_name text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  if not public.odoo_pos_z_can_manage(p_tenant_id) then raise exception 'geen toegang' using errcode = '42501'; end if;
  if p_from is null or p_from > public.kassa_business_day(p_tenant_id, now()) then raise exception 'ongeldige startdatum' using errcode = '22023'; end if;
  v_count := public.odoo_pos_z_backfill_count(p_tenant_id, p_from);
  if v_count is distinct from p_count then
    raise exception 'het aantal Z-rapporten is intussen gewijzigd (% i.p.v. %); bevestig opnieuw', v_count, p_count using errcode = '40001';
  end if;
  update public.tenant_odoo_settings
     set pos_z_sync_enabled = true, pos_z_sync_from = p_from,
         pos_z_journal_id = nullif(p_journal_id, ''), pos_z_journal_name = case when nullif(p_journal_id, '') is null then null else p_journal_name end,
         pos_z_backfill_from = p_from, pos_z_backfill_confirmed_at = now(), pos_z_backfill_confirmed_by = auth.uid(), updated_at = now()
   where tenant_id = p_tenant_id and odoo_sync_enabled;
  if not found then raise exception 'zet eerst de Odoo-facturatiesync aan en sla op' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'from', p_from, 'count', v_count);
end;
$$;
drop function if exists public.odoo_pos_z_confirm_backfill(uuid, date, integer);
revoke all on function public.odoo_pos_z_confirm_backfill(uuid, date, integer, text, text) from public, anon;
grant execute on function public.odoo_pos_z_confirm_backfill(uuid, date, integer, text, text) to authenticated;

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
  -- Nieuwe ronde: teller op nul en retry_round + 1, zodat meldingen opnieuw komen (review 2 punt 11).
  update public.odoo_pos_z_sync_log set sync_status = 'failed', attempts = 0, retry_round = retry_round + 1, finished_at = now() where id = p_log_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.odoo_pos_z_retry(uuid) from public, anon;
grant execute on function public.odoo_pos_z_retry(uuid) to authenticated;

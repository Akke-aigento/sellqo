-- lovable-cron-fallback-reviewed: MAIL-2a, minuutcadans automation-scheduler + process-campaign-queue, akkoord Akke 20-10
-- MAIL-2a — e-mailautomations: welkomstreeks, na aankoop + reviewvraag, win-back, verlaten winkelwagen.
-- Go van Akke 19-10-2026 (beslissingen 1-4 en 6 "akkoord"). Zie docs/role-audit.md MAIL-2a.
--
-- Ontwerp in één alinea: elke automation-stap krijgt een verborgen "systeemcampagne" in
-- email_campaigns (kind = 'automation', status permanent 'sending'). Een automationmail is een
-- gewone rij in campaign_sends (met automation_run_id en eigen variabelen), zodat de bestaande
-- worker (process-campaign-queue) ze verstuurt met dezelfde huisstijl, afzender, uitschrijflink en
-- retry, en ze vanzelf meetellen voor marketing_emails_used (de maandlimiet).
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT; cron wordt opnieuw opgebouwd.
-- Additief, met één bewuste uitzondering: de unieke sleutel campaign_sends_campaign_email_key wordt
-- vervangen door twee partiële unieke indexen (zie §2). Eerst de nieuwe indexen, dan
-- enqueue_campaign_sends met het bijpassende ON CONFLICT, pas daarna de oude sleutel weg.
--
-- Terugdraaien (handmatig, er is geen DOWN):
--   select cron.unschedule('automation-scheduler');
--   cron process-campaign-queue: opnieuw het DO-blok §7 uit 20261019210000 draaien.
--   drop trigger if exists trg_automation_order_paid on public.orders;
--   drop trigger if exists trg_guard_email_campaign_kind on public.email_campaigns;
--   drop trigger if exists trg_guard_automation_runs_write on public.automation_runs;
--   drop trigger if exists trg_guard_email_automation_preset on public.email_automations;
--   alter table public.automation_steps drop constraint if exists automation_steps_delay_range;
--   guard_email_campaign_status terug naar de versie uit 20261019210000 (zonder current_user-regel).
--   update public.email_automations set is_active = false where preset_key is not null;
--   handle_campaign_notification: de live versie van vóór 20-10 (zonder de guard op kind, §11b).
--   -- unieke sleutel terug (lukt enkel als er geen automationmails dubbel per adres staan):
--   delete from public.campaign_sends where automation_run_id is not null;   -- verzendhistoriek automations weg
--   alter table public.campaign_sends add constraint campaign_sends_campaign_email_key unique (campaign_id, email);
--   -- en enqueue_campaign_sends terug uit 20261019210000 (ON CONFLICT (campaign_id, email) zonder WHERE).
--   De nieuwe kolommen, indexen en functies mogen blijven staan (additief).
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'email-automations';

-- ── 1. Kolommen ──────────────────────────────────────────────────────────────
-- email_campaigns: soort campagne. 'automation' = systeemcampagne van één automation-stap,
-- verborgen in de campagnelijsten van de winkel.
alter table public.email_campaigns add column if not exists kind text not null default 'campaign';
alter table public.email_campaigns add column if not exists automation_step_id uuid
  references public.automation_steps(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_kind_check') then
    alter table public.email_campaigns
      add constraint email_campaigns_kind_check check (kind in ('campaign', 'automation'));
  end if;
end $$;
create unique index if not exists email_campaigns_automation_step_uniq
  on public.email_campaigns (automation_step_id) where automation_step_id is not null;

-- campaign_sends: bij welke automation-run hoort deze mail, en welke extra variabelen
-- (bestelnummer, link, reviewlink, taal, toestemmingsbasis) gelden voor deze ene mail.
-- Bewust geen foreign key: een run verwijderen mag de verzendhistoriek (en dus het
-- maandverbruik) niet wissen.
alter table public.campaign_sends add column if not exists automation_run_id uuid;
alter table public.campaign_sends add column if not exists variables jsonb;

-- email_automations: vaste presets per winkel en het tijdstip van de laatste scan.
alter table public.email_automations add column if not exists preset_key text;
alter table public.email_automations add column if not exists last_scanned_at timestamptz;
create unique index if not exists email_automations_tenant_preset_uniq
  on public.email_automations (tenant_id, preset_key) where preset_key is not null;

-- automation_runs: ontvanger, volgende stap, triggertijdstip, claim en pogingen.
alter table public.automation_runs add column if not exists recipient_email text;
alter table public.automation_runs add column if not exists customer_id uuid;
alter table public.automation_runs add column if not exists next_step_id uuid;
alter table public.automation_runs add column if not exists trigger_at timestamptz;
alter table public.automation_runs add column if not exists claimed_at timestamptz;
alter table public.automation_runs add column if not exists attempts integer not null default 0;

-- Eén run per automation per trigger (bestelling, winkelwagen, inschrijving). Live 0 rijen op 19-10.
create unique index if not exists automation_runs_automation_entity_uniq
  on public.automation_runs (automation_id, trigger_entity_id) where trigger_entity_id is not null;
create index if not exists idx_automation_runs_recipient
  on public.automation_runs (automation_id, recipient_email, created_at);
create index if not exists idx_automation_runs_due
  on public.automation_runs (scheduled_for) where status = 'scheduled' and recipient_email is not null;

-- ── 2. Uniciteit van verzendrijen ────────────────────────────────────────────
-- Campagnes: nog steeds één rij per ontvanger per campagne (zelfde regel als MAIL-1a).
-- Automations: één rij per run per stap. Een vaste klant kan zo bij elke bestelling opnieuw een
-- bedankmail krijgen, wat met de oude sleutel (campaign_id, email) onmogelijk was.
create unique index if not exists campaign_sends_campaign_email_uniq
  on public.campaign_sends (campaign_id, email) where automation_run_id is null;
create unique index if not exists campaign_sends_run_campaign_uniq
  on public.campaign_sends (automation_run_id, campaign_id) where automation_run_id is not null;

-- Zelfde functie als MAIL-1a, enkel het ON CONFLICT-doel noemt nu de partiële index.
create or replace function public.enqueue_campaign_sends(
  p_campaign_id uuid,
  p_from_statuses text[],
  p_rows jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tenant uuid;
  v_status text;
  v_limit integer;
  v_used integer;
  v_new integer;
  v_queued integer;
  v_kind text;
begin
  select tenant_id, status, kind into v_tenant, v_status, v_kind
    from public.email_campaigns where id = p_campaign_id for update;
  if v_tenant is null then raise exception 'MAIL_NOT_FOUND'; end if;
  -- Systeemcampagnes van automations verstuur je nooit als gewone campagne (MAIL-2a).
  if v_kind = 'automation' then raise exception 'MAIL_ALREADY_SENDING'; end if;
  if not (v_status = any (p_from_statuses)) then raise exception 'MAIL_ALREADY_SENDING'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then raise exception 'MAIL_NO_RECIPIENTS'; end if;

  perform pg_advisory_xact_lock(hashtext('marketing_quota:' || v_tenant::text));

  select count(*) into v_new
    from (select distinct lower(trim(x.email)) as email
            from jsonb_to_recordset(p_rows) as x(email text, customer_id uuid, customer_name text)
           where coalesce(trim(x.email), '') <> '') r
   where not exists (
     select 1 from public.campaign_sends cs
      where cs.campaign_id = p_campaign_id and cs.email = r.email and cs.status <> 'failed'
        and cs.automation_run_id is null);

  v_limit := public.marketing_email_limit(v_tenant);
  v_used := public.marketing_emails_used(v_tenant);
  if v_limit is not null and v_used + v_new > v_limit then
    raise exception 'MAIL_PLAN_LIMIT:%:%', v_limit, v_used;
  end if;

  with src as (
    select distinct on (lower(trim(x.email)))
           lower(trim(x.email)) as email, x.customer_id, x.customer_name
      from jsonb_to_recordset(p_rows) as x(email text, customer_id uuid, customer_name text)
     where coalesce(trim(x.email), '') <> ''
  ), ins as (
    insert into public.campaign_sends (campaign_id, customer_id, email, customer_name, status, created_at)
    select p_campaign_id, src.customer_id, src.email, src.customer_name, 'queued', now() from src
    on conflict (campaign_id, email) where automation_run_id is null do update
      set status = 'queued', attempts = 0, next_attempt_at = null, claimed_at = null,
          error_message = null, created_at = now()
      where public.campaign_sends.status = 'failed'
    returning 1
  )
  select count(*) into v_queued from ins;

  if v_queued = 0 then raise exception 'MAIL_NO_RECIPIENTS'; end if;

  update public.email_campaigns
     set status = 'sending', send_started_at = now(), send_error = null,
         total_recipients = (select count(*) from public.campaign_sends where campaign_id = p_campaign_id and status <> 'failed'),
         updated_at = now()
   where id = p_campaign_id;

  return jsonb_build_object('queued', v_queued, 'limit', v_limit, 'used', v_used + v_queued);
end $$;

revoke all on function public.enqueue_campaign_sends(uuid, text[], jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_campaign_sends(uuid, text[], jsonb) to service_role;

-- Pas nu de oude sleutel weg: de partiële index hierboven dekt exact dezelfde rijen (alle
-- campagnerijen hebben automation_run_id = null).
do $$
begin
  if exists (select 1 from pg_indexes where indexname = 'campaign_sends_campaign_email_uniq')
     and exists (select 1 from pg_constraint where conname = 'campaign_sends_campaign_email_key') then
    alter table public.campaign_sends drop constraint campaign_sends_campaign_email_key;
  end if;
end $$;

-- ── 3. Guards ────────────────────────────────────────────────────────────────
-- 3a. De statusguard van MAIL-1a laat nu ook SellQo's eigen databankfuncties door. auth.role() blijft
-- binnen een SECURITY DEFINER-functie 'authenticated' (het is een JWT-claim), current_user niet: dat
-- is dan de eigenaar van de functie. Een gebruiker via PostgREST is altijd current_user
-- authenticated/anon, dus voor hem verandert niets.
create or replace function public.guard_email_campaign_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user::text not in ('authenticated', 'anon') then return new; end if;
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'draft') not in ('draft', 'scheduled') then
      raise exception 'MAIL_STATUS_GUARD: een nieuwe campagne start als concept of ingepland';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if old.status not in ('draft', 'scheduled', 'failed') or new.status not in ('draft', 'scheduled') then
      raise exception 'MAIL_STATUS_GUARD: deze statuswijziging gebeurt enkel door SellQo';
    end if;
  end if;
  return new;
end $$;

-- 3b. Systeemcampagnes: een gebruiker mag de inhoud (onderwerp, tekst, vertalingen) bewerken, maar
-- maakt er geen, verandert de soort of de stap niet en verwijdert er geen (dat zou de
-- verzendhistoriek en het maandverbruik wissen).
create or replace function public.guard_email_campaign_kind()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user::text not in ('authenticated', 'anon') then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if coalesce(new.kind, 'campaign') <> 'campaign' or new.automation_step_id is not null then
      raise exception 'MAIL_KIND_GUARD: automationmails maakt enkel SellQo aan';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.kind = 'automation' then
      raise exception 'MAIL_KIND_GUARD: een automationmail verwijder je niet, zet de automation uit';
    end if;
    return old;
  end if;
  if new.kind is distinct from old.kind or new.automation_step_id is distinct from old.automation_step_id then
    raise exception 'MAIL_KIND_GUARD: de soort van een campagne wijzigt enkel SellQo';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_email_campaign_kind on public.email_campaigns;
create trigger trg_guard_email_campaign_kind
  before insert or update or delete on public.email_campaigns
  for each row execute function public.guard_email_campaign_kind();

-- 3c. Runs schrijft enkel de server. De bestaande RLS liet marketingrollen runs invoegen en
-- wijzigen; zo kon een gebruiker een run "inplannen" naar een willekeurig adres. Lezen blijft.
create or replace function public.guard_automation_runs_write()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user::text in ('authenticated', 'anon') then
    raise exception 'AUTOMATION_RUNS_GUARD: automation-runs schrijft enkel SellQo';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_automation_runs_write on public.automation_runs;
create trigger trg_guard_automation_runs_write
  before insert or update or delete on public.automation_runs
  for each row execute function public.guard_automation_runs_write();

-- 3d. Presets: een gebruiker zet ze aan/uit en past vertraging en instellingen aan, maar verandert
-- de soort (preset_key, trigger_type) niet. Anders kon een welkomstreeks de toestemmingsregel van
-- de winkelwagen krijgen. Vertraging per stap begrensd op 0 tot 400 dagen.
create or replace function public.guard_email_automation_preset()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user::text not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.preset_key is not null then
      raise exception 'AUTOMATION_PRESET_GUARD: presets maakt enkel SellQo aan';
    end if;
    return new;
  end if;
  if new.preset_key is distinct from old.preset_key or
     (old.preset_key is not null and new.trigger_type is distinct from old.trigger_type) then
    raise exception 'AUTOMATION_PRESET_GUARD: de soort van een automation wijzigt enkel SellQo';
  end if;
  -- Review-fix: win-back hooguit eens per 30 dagen per klant (standaard 180 dagen = 4320 u).
  if new.preset_key = 'win_back' and coalesce(new.cooldown_hours, 0) < 720 then
    raise exception 'AUTOMATION_PRESET_GUARD: de wachttijd van win-back is minstens 30 dagen (720 uur)';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_email_automation_preset on public.email_automations;
create trigger trg_guard_email_automation_preset
  before insert or update on public.email_automations
  for each row execute function public.guard_email_automation_preset();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'automation_steps_delay_range') then
    alter table public.automation_steps add constraint automation_steps_delay_range
      check (coalesce(delay_hours, 0) between 0 and 9600 and coalesce(delay_minutes, 0) between 0 and 59) not valid;
  end if;
end $$;

-- ── 4. Toestemming ───────────────────────────────────────────────────────────
-- Beslissingen Akke 19-10:
--   * verlaten winkelwagen (cart_abandoned): ingeschreven klant, OF klant met minstens één eerdere
--     betaalde bestelling in de eigen webshop (soft opt-in). Marketplace- en importbestellingen tellen
--     niet: die klant kocht niet bij de winkel zelf (bol.com verbiedt marketing aan zijn klanten).
--   * alle andere triggers (welkom, na aankoop, reviewvraag, win-back): enkel email_subscribed = true.
--   * wie op de uitschrijflijst staat (uitgeschreven, bounce, klacht, AVG) krijgt nooit iets.
-- Teruggave: 'subscribed' | 'soft_optin' | 'unsubscribed' | 'no_consent'.
create or replace function public.automation_consent(p_tenant uuid, p_email text, p_trigger_type text)
returns text
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' then return 'no_consent'; end if;
  if exists (select 1 from public.email_unsubscribes u
              where u.tenant_id = p_tenant and lower(trim(u.email)) = v_email) then
    return 'unsubscribed';
  end if;
  if exists (select 1 from public.customers c
              where c.tenant_id = p_tenant and lower(trim(c.email)) = v_email and c.email_subscribed is true) then
    return 'subscribed';
  end if;
  -- Review-fix MAIL-2a: opt-outs die niet in email_unsubscribes staan (import-status
  -- 'unsubscribed', of alle voorkeuren uit) gelden ook. email_subscribed = true hierboven is een
  -- geldige (her)inschrijving: newsletter-confirm zet de voorkeuren dan weer aan.
  if exists (select 1 from public.customers c
              where c.tenant_id = p_tenant and lower(trim(c.email)) = v_email
                and c.email_marketing_status = 'unsubscribed')
     or exists (select 1 from public.email_preferences ep
                 where ep.tenant_id = p_tenant and lower(trim(ep.email)) = v_email
                   and ep.newsletter is false and ep.promotions is false and ep.product_updates is false) then
    return 'unsubscribed';
  end if;
  if p_trigger_type = 'cart_abandoned' and exists (
       select 1 from public.orders o
        where o.tenant_id = p_tenant and lower(trim(o.customer_email)) = v_email
          and o.payment_status::text in ('paid', 'partially_refunded')
          and o.marketplace_source is null and o.import_source is null
          and o.marketplace_order_id is null and o.marketplace_connection_id is null) then
    return 'soft_optin';
  end if;
  return 'no_consent';
end $$;

-- ── 5. Een run inplannen ─────────────────────────────────────────────────────
-- Nieuwe versie naast de oude schedule_automation_run (die blijft ongewijzigd; niets roept ze aan).
-- Plant enkel als: de winkel een actieve automation voor deze trigger heeft, er toestemming is,
-- max_runs_per_customer en cooldown_hours het toelaten, en er nog geen run is voor deze trigger
-- (bestelling, winkelwagen, inschrijving). Stapvertragingen tellen vanaf p_trigger_at.
-- Geeft de run-id terug, of null als er niets ingepland werd.
create or replace function public.schedule_automation_run_v2(
  p_tenant_id uuid,
  p_trigger_type text,
  p_trigger_entity_id uuid,
  p_trigger_entity_type text,
  p_email text,
  p_customer_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_trigger_at timestamptz default now()
)
returns uuid
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_auto public.email_automations%rowtype;
  v_step public.automation_steps%rowtype;
  v_consent text;
  v_customer uuid := p_customer_id;
  v_count integer;
  v_run uuid;
  v_at timestamptz := coalesce(p_trigger_at, now());
begin
  if v_email = '' or position('@' in v_email) = 0 then return null; end if;

  select * into v_auto from public.email_automations
   where tenant_id = p_tenant_id and trigger_type = p_trigger_type and is_active is true
     and preset_key is not null
   order by priority desc nulls last, created_at
   limit 1;
  if v_auto.id is null then return null; end if;

  v_consent := public.automation_consent(p_tenant_id, v_email, p_trigger_type);
  if v_consent not in ('subscribed', 'soft_optin') then return null; end if;

  if v_customer is null then
    select c.id into v_customer from public.customers c
     where c.tenant_id = p_tenant_id and lower(trim(c.email)) = v_email
     order by c.created_at limit 1;
  end if;

  -- Eén beslissing per automation + adres tegelijk (max runs en cooldown zijn telregels).
  perform pg_advisory_xact_lock(hashtext('automation_run:' || v_auto.id::text || ':' || v_email));

  if coalesce(v_auto.max_runs_per_customer, 0) > 0 then
    select count(*) into v_count from public.automation_runs r
     where r.automation_id = v_auto.id and r.recipient_email = v_email
       and r.status not in ('skipped', 'cancelled');
    if v_count >= v_auto.max_runs_per_customer then return null; end if;
  end if;

  if coalesce(v_auto.cooldown_hours, 0) > 0 and exists (
       select 1 from public.automation_runs r
        where r.automation_id = v_auto.id and r.recipient_email = v_email
          and r.status not in ('skipped', 'cancelled')
          and r.created_at > now() - make_interval(hours => v_auto.cooldown_hours)) then
    return null;
  end if;

  select * into v_step from public.automation_steps s
   where s.automation_id = v_auto.id and s.is_active is not false
   order by s.step_order limit 1;
  if v_step.id is null then return null; end if;

  insert into public.automation_runs (
    automation_id, tenant_id, trigger_entity_id, trigger_entity_type, status, current_step,
    scheduled_for, trigger_at, next_step_id, recipient_email, customer_id, metadata
  ) values (
    v_auto.id, p_tenant_id, p_trigger_entity_id, coalesce(p_trigger_entity_type, 'customer'), 'scheduled', 0,
    greatest(now(), v_at + make_interval(hours => coalesce(v_step.delay_hours, 0), mins => coalesce(v_step.delay_minutes, 0))),
    v_at, v_step.id, v_email, v_customer,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('consent', v_consent)
  )
  on conflict (automation_id, trigger_entity_id) where trigger_entity_id is not null do nothing
  returning id into v_run;

  if v_run is not null then
    update public.email_automations set total_runs = coalesce(total_runs, 0) + 1 where id = v_auto.id;
  end if;
  return v_run;
end $$;

-- ── 6. Runs claimen (de engine) ──────────────────────────────────────────────
-- Zoals claim_campaign_sends: SKIP LOCKED, runs die >15 min op 'running' blijven hangen gaan terug,
-- na 5 pogingen op 'failed'. Enkel runs van deze engine (recipient_email gezet).
create or replace function public.claim_automation_runs(p_limit integer default 50)
returns setof public.automation_runs
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.automation_runs
     set status = case when attempts >= 5 then 'failed' else 'scheduled' end,
         claimed_at = null,
         completed_at = case when attempts >= 5 then now() else completed_at end,
         error_message = case when attempts >= 5 then 'Verwerken bleef hangen na 5 pogingen.' else error_message end
   where status = 'running' and claimed_at < now() - interval '15 minutes';

  return query
  update public.automation_runs r
     set status = 'running', claimed_at = now(), started_at = coalesce(r.started_at, now()),
         attempts = r.attempts + 1
   where r.id in (
     select q.id from public.automation_runs q
      where q.status = 'scheduled' and q.scheduled_for <= now() and q.recipient_email is not null
      order by q.scheduled_for, q.id
      limit greatest(1, least(p_limit, 500))
      for update of q skip locked
   )
  returning r.*;
end $$;

-- ── 7. Een stap afronden ─────────────────────────────────────────────────────
-- p_outcome 'next': door naar de volgende actieve stap (vertraging vanaf trigger_at), of klaar.
-- p_outcome 'cancelled' | 'skipped' | 'failed' | 'completed': de run stopt hier.
-- Idempotent: enkel een run op 'running' verandert. Geeft de nieuwe status terug.
create or replace function public.automation_finish_step(p_run_id uuid, p_outcome text, p_message text default null)
returns text
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_run public.automation_runs%rowtype;
  v_order integer;
  v_next public.automation_steps%rowtype;
begin
  select * into v_run from public.automation_runs where id = p_run_id for update;
  if v_run.id is null then return null; end if;
  if v_run.status <> 'running' then return v_run.status; end if;

  if p_outcome = 'next' then
    select step_order into v_order from public.automation_steps where id = v_run.next_step_id;
    -- Huidige stap onbekend (verwijderd): nooit opnieuw bij stap 1 beginnen, de run stopt.
    if v_order is not null then
      select * into v_next from public.automation_steps s
       where s.automation_id = v_run.automation_id and s.is_active is not false
         and s.step_order > v_order
       order by s.step_order limit 1;
    end if;
    if v_next.id is not null then
      update public.automation_runs
         set status = 'scheduled', next_step_id = v_next.id, current_step = coalesce(current_step, 0) + 1,
             scheduled_for = greatest(now(), coalesce(trigger_at, now())
               + make_interval(hours => coalesce(v_next.delay_hours, 0), mins => coalesce(v_next.delay_minutes, 0))),
             claimed_at = null, attempts = 0, error_message = p_message
       where id = p_run_id;
      return 'scheduled';
    end if;
    p_outcome := 'completed';
  end if;

  if p_outcome not in ('completed', 'cancelled', 'skipped', 'failed') then
    raise exception 'AUTOMATION_BAD_OUTCOME:%', p_outcome;
  end if;
  update public.automation_runs
     set status = p_outcome, completed_at = now(), claimed_at = null, next_step_id = null,
         error_message = coalesce(p_message, error_message)
   where id = p_run_id;
  if p_outcome = 'completed' then
    update public.email_automations set total_completed = coalesce(total_completed, 0) + 1
     where id = v_run.automation_id;
  end if;
  return p_outcome;
end $$;

-- ── 8. Een automationmail in de wachtrij zetten ──────────────────────────────
-- Controleert in één transactie (zelfde advisory lock per winkel als enqueue_campaign_sends):
-- run is geclaimd en staat op deze stap, campagne is de systeemcampagne van deze stap, adres staat
-- niet op de uitschrijflijst, toestemming volgens §4, maandlimiet. Ontdubbelt per run + stap.
-- Fouten: MAIL_RUN_STATE, MAIL_STEP_MISMATCH, MAIL_INVALID_EMAIL, MAIL_UNSUBSCRIBED,
-- MAIL_NO_CONSENT, MAIL_PLAN_LIMIT:<limiet>:<gebruikt>.
-- Teruggave: { status: 'queued' | 'duplicate', send_id, consent }.
create or replace function public.enqueue_automation_send(
  p_run_id uuid,
  p_step_id uuid,
  p_email text,
  p_customer_id uuid,
  p_campaign_id uuid,
  p_variables jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_run public.automation_runs%rowtype;
  v_auto public.email_automations%rowtype;
  v_camp public.email_campaigns%rowtype;
  v_consent text;
  v_limit integer;
  v_used integer;
  v_send uuid;
  v_customer uuid := p_customer_id;
  v_name text;
begin
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'MAIL_INVALID_EMAIL'; end if;

  select * into v_run from public.automation_runs where id = p_run_id for update;
  if v_run.id is null or v_run.status <> 'running' then raise exception 'MAIL_RUN_STATE'; end if;
  if v_run.next_step_id is distinct from p_step_id then raise exception 'MAIL_STEP_MISMATCH'; end if;

  select * into v_auto from public.email_automations where id = v_run.automation_id;
  select * into v_camp from public.email_campaigns where id = p_campaign_id;
  if v_camp.id is null or v_camp.kind <> 'automation' or v_camp.automation_step_id is distinct from p_step_id
     or v_camp.tenant_id <> v_run.tenant_id or v_auto.tenant_id <> v_run.tenant_id then
    raise exception 'MAIL_STEP_MISMATCH';
  end if;

  -- Al verstuurd voor deze run en stap? Dan niets opnieuw (bv. na een crash tussen enqueue en afronden).
  select id into v_send from public.campaign_sends
   where automation_run_id = p_run_id and campaign_id = p_campaign_id;
  if v_send is not null then
    return jsonb_build_object('status', 'duplicate', 'send_id', v_send);
  end if;

  v_consent := public.automation_consent(v_run.tenant_id, v_email, v_auto.trigger_type);
  if v_consent = 'unsubscribed' then raise exception 'MAIL_UNSUBSCRIBED'; end if;
  if v_consent not in ('subscribed', 'soft_optin') then raise exception 'MAIL_NO_CONSENT'; end if;

  perform pg_advisory_xact_lock(hashtext('marketing_quota:' || v_run.tenant_id::text));
  v_limit := public.marketing_email_limit(v_run.tenant_id);
  v_used := public.marketing_emails_used(v_run.tenant_id);
  if v_limit is not null and v_used + 1 > v_limit then
    raise exception 'MAIL_PLAN_LIMIT:%:%', v_limit, v_used;
  end if;

  if v_customer is null then
    select c.id into v_customer from public.customers c
     where c.tenant_id = v_run.tenant_id and lower(trim(c.email)) = v_email order by c.created_at limit 1;
  end if;
  if v_customer is not null then
    select nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '') into v_name
      from public.customers c where c.id = v_customer and c.tenant_id = v_run.tenant_id;
    if not found then v_customer := null; end if;
  end if;

  insert into public.campaign_sends (campaign_id, customer_id, email, customer_name, status, created_at,
                                     automation_run_id, variables)
  values (p_campaign_id, v_customer, v_email, v_name, 'queued', now(), p_run_id,
          coalesce(p_variables, '{}'::jsonb) || jsonb_build_object('_consent', v_consent))
  on conflict (automation_run_id, campaign_id) where automation_run_id is not null do nothing
  returning id into v_send;

  if v_send is null then
    select id into v_send from public.campaign_sends
     where automation_run_id = p_run_id and campaign_id = p_campaign_id;
    return jsonb_build_object('status', 'duplicate', 'send_id', v_send);
  end if;

  update public.email_campaigns set total_recipients = coalesce(total_recipients, 0) + 1 where id = p_campaign_id;
  update public.email_automations set total_sent = coalesce(total_sent, 0) + 1 where id = v_auto.id;
  return jsonb_build_object('status', 'queued', 'send_id', v_send, 'consent', v_consent);
end $$;

-- ── 9. Triggers die zelf zoeken: win-back en verlaten winkelwagen ────────────
-- Aangeroepen door de engine bij elke run; per automation hooguit eens per 20 uur (win-back) of
-- per 5 minuten (winkelwagen), bijgehouden in last_scanned_at.
--   * Win-back: ingeschreven klanten met minstens één niet-geannuleerde bestelling en geen
--     niet-geannuleerde bestelling in de laatste trigger_config.days dagen (standaard 90, 30-365).
--     Cooldown (180 dagen) en toestemming bewaakt schedule_automation_run_v2. Max 500 per scan.
--   * Winkelwagen: storefront_carts op 'checkout' met een adres, laatst gewijzigd tussen
--     (vertraging + 48 u) en (vertraging) geleden, nog niet verlopen, en geen bestelling (welke
--     betaalstatus ook, behalve geannuleerd) met dat adres sinds het mandje ontstond: wie per
--     overschrijving bestelde, krijgt dus geen herinnering. De vertraging is die van stap 1.
--     Eén run per winkelwagen (unieke sleutel, elke status). Zonder toestemming komt er een
--     'skipped'-run, zodat het mandje niet opnieuw beoordeeld wordt. Max 200 per scan.
create or replace function public.automation_scan_triggers()
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  a record;
  c record;
  v_days integer;
  v_delay interval;
  v_winback integer := 0;
  v_carts integer := 0;
begin
  for a in
    update public.email_automations ea set last_scanned_at = now()
     where ea.is_active is true and ea.preset_key = 'win_back'
       and (ea.last_scanned_at is null or ea.last_scanned_at < now() - interval '20 hours')
    returning ea.id, ea.tenant_id, ea.trigger_config, ea.cooldown_hours
  loop
    v_days := least(365, greatest(30, coalesce(nullif(a.trigger_config->>'days', '')::integer, 90)));
    for c in
      select cu.id, cu.email from public.customers cu
       where cu.tenant_id = a.tenant_id and cu.email_subscribed is true
         and coalesce(cu.total_orders, 0) >= 1 and coalesce(trim(cu.email), '') <> ''
         and exists (select 1 from public.orders o
                      where o.customer_id = cu.id and coalesce(o.status::text, '') <> 'cancelled')
         and not exists (select 1 from public.orders o
                          where o.customer_id = cu.id and coalesce(o.status::text, '') <> 'cancelled'
                            and o.created_at >= now() - make_interval(days => v_days))
         -- Review-fix: wie binnen de cooldown al een run had, valt hier al weg, zodat de scan
         -- niet elke keer op dezelfde eerste 500 blijft hangen.
         and not exists (select 1 from public.automation_runs r
                          where r.automation_id = a.id and r.recipient_email = lower(trim(cu.email))
                            and r.status not in ('skipped', 'cancelled')
                            and r.created_at > now() - make_interval(hours => greatest(720, coalesce(a.cooldown_hours, 0))))
       order by cu.id
       limit 500
    loop
      if public.schedule_automation_run_v2(a.tenant_id, 'customer_inactive', null, 'customer', c.email, c.id,
                                           jsonb_build_object('days', v_days)) is not null then
        v_winback := v_winback + 1;
      end if;
    end loop;
  end loop;

  for a in
    update public.email_automations ea set last_scanned_at = now()
     where ea.is_active is true and ea.preset_key = 'abandoned_cart'
       and (ea.last_scanned_at is null or ea.last_scanned_at < now() - interval '5 minutes')
    returning ea.id, ea.tenant_id
  loop
    select make_interval(hours => coalesce(s.delay_hours, 0), mins => coalesce(s.delay_minutes, 0)) into v_delay
      from public.automation_steps s
     where s.automation_id = a.id and s.is_active is not false order by s.step_order limit 1;
    if v_delay is null then continue; end if;
    if v_delay < interval '30 minutes' then v_delay := interval '30 minutes'; end if;

    for c in
      select sc.id, sc.customer_email, sc.created_at, sc.updated_at, sc.locale
        from public.storefront_carts sc
       where sc.tenant_id = a.tenant_id and sc.checkout_status = 'checkout'
         and coalesce(trim(sc.customer_email), '') <> ''
         and sc.updated_at <= now() - v_delay
         and sc.updated_at > now() - v_delay - interval '48 hours'
         and sc.expires_at > now()
         and not exists (
           select 1 from public.orders o
            where o.tenant_id = sc.tenant_id
              and lower(trim(o.customer_email)) = lower(trim(sc.customer_email))
              and o.created_at >= sc.created_at
              and coalesce(o.status::text, '') <> 'cancelled')
         and not exists (
           select 1 from public.automation_runs r
            where r.automation_id = a.id and r.trigger_entity_id = sc.id)
       order by sc.updated_at
       limit 200
    loop
      if public.schedule_automation_run_v2(a.tenant_id, 'cart_abandoned', c.id, 'cart', c.customer_email, null,
                                           jsonb_build_object('locale', c.locale), c.updated_at) is not null then
        v_carts := v_carts + 1;
      elsif public.automation_consent(a.tenant_id, c.customer_email, 'cart_abandoned') not in ('subscribed', 'soft_optin') then
        -- Review-fix: geen toestemming → een 'skipped'-run, zodat dit mandje niet bij elke scan
        -- opnieuw beoordeeld wordt (de NOT EXISTS hierboven telt elke status).
        insert into public.automation_runs (automation_id, tenant_id, trigger_entity_id, trigger_entity_type,
                                            status, current_step, recipient_email, completed_at, error_message)
        values (a.id, a.tenant_id, c.id, 'cart', 'skipped', 0, lower(trim(c.customer_email)), now(),
                'Geen toestemming voor marketingmail.')
        on conflict (automation_id, trigger_entity_id) where trigger_entity_id is not null do nothing;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('win_back', v_winback, 'abandoned_cart', v_carts);
end $$;

-- ── 10. Trigger: bestelling betaald → na-aankoopreeks ────────────────────────
-- Bestellingen worden op verschillende plekken betaald (stripe-connect-webhook, storefront-api,
-- handmatig/overschrijving, imports). Eén databanktrigger vangt ze allemaal. Uitgesloten:
-- marketplace- en importbestellingen en bestellingen zonder adres. Faalveilig zoals
-- ticket_mail_on_paid: een fout hier mag een betaling nooit tegenhouden.
create or replace function public.automation_on_order_paid()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' and old.payment_status::text = 'paid' then return null; end if;
  if new.marketplace_source is not null or new.import_source is not null
     or new.marketplace_order_id is not null or new.marketplace_connection_id is not null then return null; end if;
  if coalesce(trim(new.customer_email), '') = '' then return null; end if;
  -- Review-fix: een bestelling die pas veel later op betaald komt (oude overschrijving, rechtzetting)
  -- krijgt geen bedankmail meer.
  if new.paid_at is not null and new.paid_at < now() - interval '14 days' then return null; end if;
  if not exists (select 1 from public.email_automations
                  where tenant_id = new.tenant_id and preset_key = 'post_purchase' and is_active is true) then
    return null;
  end if;
  perform public.schedule_automation_run_v2(
    new.tenant_id, 'order_paid', new.id, 'order', new.customer_email, null,
    jsonb_build_object('order_number', new.order_number, 'locale', new.locale),
    -- Stapvertragingen tellen vanaf de betaling, maar hooguit 2 dagen terug en nooit in de toekomst.
    least(now(), greatest(coalesce(new.paid_at, now()), now() - interval '2 days')));
  return null;
exception when others then
  raise warning 'automation_on_order_paid failed for order %: %', new.id, sqlerrm;
  return null;
end $$;

drop trigger if exists trg_automation_order_paid on public.orders;
create trigger trg_automation_order_paid
  after insert or update of payment_status on public.orders
  for each row when (new.payment_status = 'paid')
  execute function public.automation_on_order_paid();

-- ── 11. Presets klaarzetten (vanuit de admin) ────────────────────────────────
-- Maakt de ontbrekende presets van een winkel aan, uitgeschakeld, met hun stappen en
-- systeemcampagnes. Bestaande presets blijven ongemoeid (ook als hun inhoud aangepast is).
-- p_presets: [{ preset_key, name, description, trigger_config, max_runs_per_customer,
--   cooldown_hours, steps: [{ step_order, delay_hours, name, subject, preview_text, html_content,
--   translations, available_languages }] }]  — de standaardteksten komen uit
-- src/lib/marketing/automationPresets.ts.
-- De welkomstreeks neemt een bestaande, ingeschakelde eigen welkomstmail (tenant_newsletter_config) over als stap 1,
-- met de oude placeholders omgezet naar de variabelen van de engine.
create or replace function public.automation_ensure_presets(p_tenant uuid, p_presets jsonb)
returns integer
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  p jsonb;
  s jsonb;
  v_auto uuid;
  v_step uuid;
  v_created integer := 0;
  v_cfg record;
  v_subject text;
  v_body text;
  v_langs text[];
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin', 'staff', 'marketing']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  if jsonb_typeof(p_presets) is distinct from 'array' then raise exception 'INVALID_PRESETS'; end if;

  select welcome_email_subject, welcome_email_body, welcome_email_enabled into v_cfg
    from public.tenant_newsletter_config where tenant_id = p_tenant limit 1;

  for p in select * from jsonb_array_elements(p_presets)
  loop
    if (p->>'preset_key') not in ('welcome_series', 'post_purchase', 'win_back', 'abandoned_cart') then
      raise exception 'INVALID_PRESET_KEY';
    end if;
    -- trigger_type ligt per preset vast (beslissing 19-10): de toestemmingsregel hangt eraan
    -- (enkel cart_abandoned kent soft opt-in), dus de client kiest hem niet.
    insert into public.email_automations (tenant_id, name, description, trigger_type, trigger_config, is_active,
                                          preset_key, max_runs_per_customer, cooldown_hours)
    values (p_tenant, left(p->>'name', 200), left(p->>'description', 500),
            case p->>'preset_key'
              when 'welcome_series' then 'newsletter_confirmed'
              when 'post_purchase' then 'order_paid'
              when 'win_back' then 'customer_inactive'
              when 'abandoned_cart' then 'cart_abandoned'
            end,
            case when p->>'preset_key' = 'win_back'
                 then jsonb_build_object('days', 90) || coalesce(p->'trigger_config', '{}'::jsonb)
                 else coalesce(p->'trigger_config', '{}'::jsonb) end,
            false, p->>'preset_key',
            -- Standaarden (beslissing 19-10): welkom 1 keer, na aankoop bij elke bestelling, win-back
            -- hooguit eens per 180 dagen (4320 u), winkelwagen onbeperkt (ontdubbeld per winkelwagen).
            greatest(0, coalesce((p->>'max_runs_per_customer')::integer,
              case p->>'preset_key' when 'welcome_series' then 1 else 0 end)),
            greatest(0, coalesce((p->>'cooldown_hours')::integer,
              case p->>'preset_key' when 'win_back' then 4320 else 0 end)))
    on conflict (tenant_id, preset_key) where preset_key is not null do nothing
    returning id into v_auto;
    if v_auto is null then continue; end if;
    v_created := v_created + 1;

    for s in select * from jsonb_array_elements(coalesce(p->'steps', '[]'::jsonb))
    loop
      insert into public.automation_steps (automation_id, step_order, action_type, delay_hours, delay_minutes,
                                           is_active, condition_rules)
      values (v_auto, (s->>'step_order')::integer, 'send_email',
              least(24 * 400, greatest(0, coalesce((s->>'delay_hours')::integer, 0))), 0, true,
              coalesce(s->'condition_rules', '{}'::jsonb))
      returning id into v_step;

      v_subject := s->>'subject';
      v_body := s->>'html_content';
      v_langs := array(select jsonb_array_elements_text(coalesce(s->'available_languages', '["nl"]'::jsonb)));
      if p->>'preset_key' = 'welcome_series' and (s->>'step_order')::integer = 1
         and v_cfg.welcome_email_enabled is true
         and coalesce(trim(v_cfg.welcome_email_body), '') <> '' then
        v_subject := coalesce(nullif(trim(v_cfg.welcome_email_subject), ''), v_subject);
        v_body := replace(replace(replace(replace(replace(replace(replace(v_cfg.welcome_email_body,
                    '{{SHOP_URL}}', '{{shop_url}}'), '{{AFMELD_URL}}', '{{unsubscribe_url}}'),
                    '{{LOGO_URL}}', '{{tenant_logo_url}}'), '{{JAAR}}', '{{current_year}}'),
                    '{{first_name}}', '{{customer_first_name}}'), '{{customer_name}}', '{{customer_first_name}}'),
                    '{{company_website}}', '{{shop_url}}');
        v_langs := array['nl'];  -- de oude welkomstmail was eentalig: taal van de winkel
      end if;

      insert into public.email_campaigns (tenant_id, name, subject, preview_text, html_content, status, kind,
                                          automation_id, automation_step_id, translations, available_languages,
                                          send_started_at)
      values (p_tenant, left(coalesce(s->>'name', p->>'name'), 200), coalesce(v_subject, ''), s->>'preview_text',
              coalesce(v_body, ''), 'sending', 'automation', v_auto, v_step,
              case when array_length(v_langs, 1) > 1 then coalesce(s->'translations', '{}'::jsonb) else '{}'::jsonb end,
              v_langs, now());
    end loop;
  end loop;
  return v_created;
end $$;

-- ── 11b. Meldingen over campagnes: niet voor systeemcampagnes ────────────────
-- handle_campaign_notification (trigger_campaign_notification op email_campaigns) meldt "campagne
-- gestart/voltooid/hoge bounce". Een systeemcampagne staat permanent op 'sending' en telt per mail
-- op; daar horen geen campagnemeldingen bij. Live definitie (pg_get_functiondef, 20-10-2026)
-- letterlijk overgenomen, enkel de guard op kind is nieuw.
CREATE OR REPLACE FUNCTION public.handle_campaign_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
BEGIN
  -- MAIL-2a: systeemcampagnes van automations geven geen campagnemeldingen.
  IF NEW.kind = 'automation' THEN
    RETURN NEW;
  END IF;

  v_action_url := '/admin/marketing/campaigns/' || NEW.id;
  
  -- CAMPAGNE VERZONDEN (status wordt 'sending' of 'sent')
  IF TG_OP = 'UPDATE' 
     AND NEW.status = 'sending' 
     AND OLD.status != 'sending' THEN
    v_type := 'campaign_sent';
    v_title := 'Campagne gestart: ' || NEW.name;
    v_message := 'E-mailcampagne "' || NEW.name || '" wordt nu verzonden naar ' || COALESCE(NEW.total_recipients, 0) || ' ontvangers';
    v_priority := 'medium';
    
  -- CAMPAGNE VOLTOOID
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.status = 'sent' 
        AND OLD.status = 'sending' THEN
    v_type := 'campaign_completed';
    v_title := 'Campagne voltooid: ' || NEW.name;
    v_message := 'E-mailcampagne "' || NEW.name || '" is succesvol verzonden naar ' 
                 || COALESCE(NEW.total_delivered, 0) || ' ontvangers';
    v_priority := 'low';
    
  -- CAMPAGNE GEFAALD (veel bounces)
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.total_bounced > 0
        AND COALESCE(OLD.total_bounced, 0) = 0
        AND NEW.total_recipients > 0
        AND (NEW.total_bounced::float / NEW.total_recipients::float) > 0.1 THEN
    v_type := 'campaign_high_bounce';
    v_title := 'Hoge bounce rate: ' || NEW.name;
    v_message := 'Campagne "' || NEW.name || '" heeft ' || NEW.total_bounced 
                 || ' bounces (' || ROUND((NEW.total_bounced::float / NEW.total_recipients::float * 100)::numeric, 1) || '%)';
    v_priority := 'high';
    
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.send_notification(
    NEW.tenant_id,
    'marketing',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'campaign_id', NEW.id,
      'campaign_name', NEW.name,
      'total_recipients', NEW.total_recipients,
      'total_delivered', NEW.total_delivered,
      'total_opened', NEW.total_opened,
      'total_clicked', NEW.total_clicked,
      'total_bounced', NEW.total_bounced,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$function$;

-- ── 12. Rechten ──────────────────────────────────────────────────────────────
revoke all on function public.automation_consent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.schedule_automation_run_v2(uuid, text, uuid, text, text, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_automation_runs(integer) from public, anon, authenticated;
revoke all on function public.automation_finish_step(uuid, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_automation_send(uuid, uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.automation_scan_triggers() from public, anon, authenticated;
revoke all on function public.automation_on_order_paid() from public, anon, authenticated;
revoke all on function public.automation_ensure_presets(uuid, jsonb) from public, anon;
grant execute on function public.automation_consent(uuid, text, text) to service_role;
grant execute on function public.schedule_automation_run_v2(uuid, text, uuid, text, text, uuid, jsonb, timestamptz) to service_role;
grant execute on function public.claim_automation_runs(integer) to service_role;
grant execute on function public.automation_finish_step(uuid, text, text) to service_role;
grant execute on function public.enqueue_automation_send(uuid, uuid, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.automation_scan_triggers() to service_role;
grant execute on function public.automation_ensure_presets(uuid, jsonb) to authenticated, service_role;

-- ── 13. Cron: de engine ──────────────────────────────────────────────────────
-- Elke minuut als het platform dat toelaat (process-campaign-queue draait live op * * * * *),
-- anders elk uur. Doet enkel iets als er een actieve automation is.
do $$
declare
  v_cmd text := $cmd$
    SELECT net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/automation-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := '{"source":"cron"}'::jsonb,
      timeout_milliseconds := 150000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.email_automations WHERE is_active IS TRUE AND preset_key IS NOT NULL
    );
  $cmd$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ontbreekt — cron voor MAIL-2a overgeslagen';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'automation-scheduler') then
    perform cron.unschedule('automation-scheduler');
  end if;

  begin
    perform cron.schedule('automation-scheduler', '* * * * *', v_cmd);
  exception when others then
    raise notice 'sub-hourly schedule geweigerd (%), val terug op elk uur', sqlerrm;
    perform cron.schedule('automation-scheduler', '5 * * * *', v_cmd);
  end;
end $$;

-- ── 13b. Cron van de campagneworker (MAIL-1a) bijgewerkt ─────────────────────
-- Systeemcampagnes staan permanent op 'sending'. De voorwaarde van MAIL-1a ("een campagne op
-- sending") zou de worker dus elke minuut laten starten, ook zonder werk. Nieuwe voorwaarde:
-- een geplande campagne die aan de beurt is, een gewone campagne die nog verstuurt, of een
-- verzendrij in de wachtrij die nu mag vertrekken én bij een campagne op 'sending' hoort (de worker
-- claimt enkel zulke rijen; anders start hij leeg).
do $$
declare
  v_cmd text := $cmd$
    SELECT net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/process-campaign-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := '{"source":"cron"}'::jsonb,
      timeout_milliseconds := 150000
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.email_campaigns
      WHERE (status = 'scheduled' AND scheduled_at <= now())
         OR (status = 'sending' AND kind = 'campaign')
    ) OR EXISTS (
      SELECT 1 FROM public.campaign_sends cs
      JOIN public.email_campaigns ec ON ec.id = cs.campaign_id AND ec.status = 'sending'
      WHERE cs.status = 'queued' AND (cs.next_attempt_at IS NULL OR cs.next_attempt_at <= now())
    );
  $cmd$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ontbreekt — cron process-campaign-queue niet bijgewerkt';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'process-campaign-queue') then
    perform cron.unschedule('process-campaign-queue');
  end if;
  begin
    perform cron.schedule('process-campaign-queue', '* * * * *', v_cmd);
  exception when others then
    raise notice 'sub-hourly schedule geweigerd (%), val terug op elk uur', sqlerrm;
    perform cron.schedule('process-campaign-queue', '3 * * * *', v_cmd);
  end;
end $$;

-- ── 14. Helpartikel ──────────────────────────────────────────────────────────
insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing/automations',
  'Automatische e-mails (automatiseringen)',
  'email-automations',
  'Welkomstreeks, bedankmail en reviewvraag na een aankoop, win-back en verlaten winkelwagen: zo zet je ze aan en pas je ze aan.',
  $html$
<h2>Wat zijn automatiseringen?</h2>
<p>Automatiseringen zijn marketingmails die vanzelf vertrekken na iets wat een klant doet. Je vindt ze in <strong>Marketing → Automatiseringen</strong>. Er zijn vier automatiseringen, en ze staan standaard <strong>uit</strong>:</p>
<ul>
  <li><strong>Welkomstreeks</strong>: twee mails nadat een nieuwe abonnee zijn inschrijving op je nieuwsbrief bevestigde via de bevestigingsmail (dubbele opt-in, standaard in elke winkel), meteen en na 3 dagen.</li>
  <li><strong>Na aankoop</strong>: een bedankmail 1 dag na een betaalde bestelling en een reviewvraag na 14 dagen.</li>
  <li><strong>Win-back</strong>: één mail naar klanten die al een tijd (standaard 90 dagen) niets meer bestelden. Dezelfde klant krijgt die mail hooguit eens per 180 dagen.</li>
  <li><strong>Verlaten winkelwagen</strong>: één herinnering als iemand zijn gegevens invulde bij het afrekenen maar niet bestelde (standaard na 1 uur).</li>
</ul>

<h2>Wie krijgt ze?</h2>
<p>De welkomstreeks, de mails na aankoop en de win-back gaan enkel naar klanten die ingeschreven zijn op je nieuwsbrief. De herinnering voor een verlaten winkelwagen gaat naar ingeschreven klanten en naar klanten die eerder al iets bij je kochten in je webshop. Wie zich uitschreef of in zijn mailvoorkeuren alles uitzette, krijgt nooit een automatische mail. Elke mail heeft een afmeldlink.</p>
<p>Voor de herinnering bij een verlaten winkelwagen ben jij als winkel verantwoordelijk dat dit in je privacyverklaring staat.</p>

<h2>Teksten aanpassen</h2>
<p>Klik bij een automatisering op een stap om het onderwerp en de tekst aan te passen, per taal. Het voorbeeld toont de mail in je huisstijl. Naast de gewone variabelen kan je onder meer <code>{{order_number}}</code> (bestelnummer), <code>{{shop_url}}</code> (link naar je winkel), <code>{{cart_items}}</code> (producten in het winkelmandje) en <code>{{review_url}}</code> (link naar je reviewpagina) gebruiken.</p>
<p>Had je al een eigen welkomstmail ingeschakeld? Die staat als eerste mail in de welkomstreeks. Zolang de welkomstreeks uit staat, blijft je oude welkomstmail vertrekken. Zet je de reeks aan, dan krijgt een nieuwe abonnee enkel de reeks.</p>

<h2>De reviewvraag</h2>
<p>De reviewmail linkt naar je Google- of Trustpilot-profiel. Koppel dat eerst in <strong>Instellingen → Reviews</strong> en vul de profiel-URL in. Zonder gekoppeld profiel wordt de reviewmail overgeslagen.</p>

<h2>Limiet en opvolging</h2>
<p>Automatische mails tellen mee voor je maandelijkse limiet aan marketingmails. Is je limiet bereikt, dan wordt de mail niet verstuurd en krijg je een melding. In het logboek onder elke automatisering zie je de laatste 50 verzendingen met hun status.</p>
$html$,
  60
)
on conflict (doc_level, slug) do update
  set category_id = excluded.category_id, context_path = excluded.context_path, title = excluded.title,
      excerpt = excluded.excerpt, content = excluded.content, sort_order = excluded.sort_order, updated_at = now();

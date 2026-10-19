-- MAIL-1a — e-mailmarketing voor winkels: toestemming, double opt-in, wachtrij, limieten, cron.
-- Recon: claude/recon-mail-1.md (project Nomadix Socials). Go van Akke 19-10-2026.
--
-- Idempotent: alles met IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT, cron opnieuw opgebouwd.
--
-- Terugdraaien (handmatig, er is geen DOWN):
--   alter table public.customers alter column email_subscribed set default true;
--   alter table public.tenant_newsletter_config alter column double_optin set default false;
--   select cron.unschedule('process-campaign-queue');
--   drop trigger trg_guard_email_campaign_status on public.email_campaigns;
--   drop trigger trg_guard_campaign_sends_write on public.campaign_sends;
--   De nieuwe kolommen, indexen en functies mogen blijven staan (additief, niets leest ze nog).
--   De backfill van 19-10 (email_subscribed) staat in snapshots.platform_20261019_customers_email_subscribed.

-- 1. Toestemming: niemand is nog vanzelf ingeschreven ----------------------------------------
-- Tot nu stond email_subscribed standaard op true: elke koper kreeg marketing zonder toestemming.
-- Inschrijven kan enkel nog via het nieuwsbriefformulier (met bevestiging) of een import met
-- bevestigde toestemming. De bestaande rijen zijn op 19-10 rechtgezet (zie role-audit MAIL-1a).
alter table public.customers alter column email_subscribed set default false;

-- 2. Double opt-in standaard aan, ook voor bestaande winkels (beslissing Akke 19-10) ------------
alter table public.tenant_newsletter_config alter column double_optin set default true;
update public.tenant_newsletter_config set double_optin = true, updated_at = now()
where double_optin is distinct from true;

-- 3. Campagnes: fouttekst en starttijd van het versturen ---------------------------------------
alter table public.email_campaigns add column if not exists send_error text;
alter table public.email_campaigns add column if not exists send_started_at timestamptz;

-- 4. Wachtrij in campaign_sends ----------------------------------------------------------------
-- Status: queued → sending → sent (daarna delivered/opened/… via de webhook), of failed.
alter table public.campaign_sends add column if not exists attempts integer not null default 0;
alter table public.campaign_sends add column if not exists claimed_at timestamptz;
alter table public.campaign_sends add column if not exists next_attempt_at timestamptz;

-- Eén rij per ontvanger per campagne: dubbel klikken of opnieuw starten mailt niemand twee keer.
-- Het adres wordt altijd in kleine letters weggeschreven. (Live 0 rijen op 19-10: geen duplicaten.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaign_sends_campaign_email_key') then
    alter table public.campaign_sends
      add constraint campaign_sends_campaign_email_key unique (campaign_id, email);
  end if;
end $$;

-- De webhook zoekt op resend_id; zonder index werd dat een volledige scan.
create index if not exists idx_campaign_sends_resend_id on public.campaign_sends (resend_id)
  where resend_id is not null;
create index if not exists idx_campaign_sends_queue on public.campaign_sends (created_at)
  where status in ('queued', 'sending');

-- 5. Limiet marketingmails per maand per plan (beslissing Akke 19-10) ---------------------------
-- null = onbeperkt. Eigen merken, interne en demo-winkels zijn altijd onbeperkt
-- (platform_tenant_unlimited, LIMITS-1).
alter table public.pricing_plans add column if not exists limit_marketing_emails_monthly integer;
update public.pricing_plans set limit_marketing_emails_monthly = case id
    when 'free' then 500
    when 'starter' then 2500
    when 'pro' then 10000
    when 'horeca' then 10000
    when 'horeca_big' then 10000
    when 'enterprise' then 50000
    when 'events_flex' then 500      -- niet expliciet beslist: gelijk aan Free (€0/maand)
    when 'events_vast' then 2500     -- niet expliciet beslist: gelijk aan Starter
    else limit_marketing_emails_monthly
  end
where id in ('free', 'starter', 'pro', 'horeca', 'horeca_big', 'enterprise', 'events_flex', 'events_vast');

-- Limiet van een winkel, of null als ze onbeperkt mag (of geen abonnement heeft: dan Free).
create or replace function public.marketing_email_limit(p_tenant_id uuid)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when public.platform_tenant_unlimited(p_tenant_id) then null
    else coalesce(
      (select pp.limit_marketing_emails_monthly
         from public.tenant_subscriptions s join public.pricing_plans pp on pp.id = s.plan_id
        where s.tenant_id = p_tenant_id
        limit 1),
      (select limit_marketing_emails_monthly from public.pricing_plans where id = 'free'))
  end
$$;

-- Verbruik deze kalendermaand (Brusselse tijd): alles wat in de wachtrij kwam en niet mislukte.
create or replace function public.marketing_emails_used(p_tenant_id uuid)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::integer
  from public.campaign_sends cs
  join public.email_campaigns c on c.id = cs.campaign_id
  where c.tenant_id = p_tenant_id
    and coalesce(cs.status, '') <> 'failed'
    and cs.created_at >= (date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels')
$$;

-- 6. Wachtrij claimen (de worker) ---------------------------------------------------------------
-- Neemt tot p_limit rijen van campagnes die aan het versturen zijn, zonder dat twee workers
-- dezelfde rij pakken (SKIP LOCKED). Rijen die >15 min op 'sending' blijven hangen (worker
-- gecrasht) komen eerst terug in de wachtrij, na 5 pogingen op 'failed'.
create or replace function public.claim_campaign_sends(p_limit integer default 100)
returns setof public.campaign_sends
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.campaign_sends
     set status = case when attempts >= 5 then 'failed' else 'queued' end,
         claimed_at = null,
         error_message = case when attempts >= 5 then 'Versturen bleef hangen na 5 pogingen.' else error_message end
   where status = 'sending' and claimed_at < now() - interval '15 minutes';

  return query
  update public.campaign_sends cs
     set status = 'sending', claimed_at = now(), attempts = cs.attempts + 1
   where cs.id in (
     select q.id
       from public.campaign_sends q
       join public.email_campaigns c on c.id = q.campaign_id
      where q.status = 'queued'
        and c.status = 'sending'
        and (q.next_attempt_at is null or q.next_attempt_at <= now())
      order by q.created_at, q.id
      limit greatest(1, least(p_limit, 1000))
      for update of q skip locked
   )
  returning cs.*;
end $$;

-- 6b. Een campagne atomair in de wachtrij zetten -------------------------------------------------
-- Eén transactie, één winkel tegelijk (advisory lock): status controleren, limiet controleren,
-- rijen invoegen (mislukte rijen van een vorige poging gaan opnieuw in de wachtrij) en pas dan de
-- campagne op 'sending' zetten. Zo ziet de worker nooit een campagne op 'sending' zonder rijen,
-- en kunnen twee campagnes samen niet over de limiet.
-- p_rows: [{ "email": text, "customer_id": uuid|null, "customer_name": text|null }, …]
-- Fouten: MAIL_ALREADY_SENDING, MAIL_PLAN_LIMIT:<limiet>:<gebruikt>, MAIL_NO_RECIPIENTS.
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
begin
  select tenant_id, status into v_tenant, v_status
    from public.email_campaigns where id = p_campaign_id for update;
  if v_tenant is null then raise exception 'MAIL_NOT_FOUND'; end if;
  if not (v_status = any (p_from_statuses)) then raise exception 'MAIL_ALREADY_SENDING'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then raise exception 'MAIL_NO_RECIPIENTS'; end if;

  perform pg_advisory_xact_lock(hashtext('marketing_quota:' || v_tenant::text));

  -- Enkel adressen die nog niet (met succes) in deze campagne zitten tellen voor de limiet.
  select count(*) into v_new
    from (select distinct lower(trim(x.email)) as email
            from jsonb_to_recordset(p_rows) as x(email text, customer_id uuid, customer_name text)
           where coalesce(trim(x.email), '') <> '') r
   where not exists (
     select 1 from public.campaign_sends cs
      where cs.campaign_id = p_campaign_id and cs.email = r.email and cs.status <> 'failed');

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
    on conflict (campaign_id, email) do update
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

-- 6c. Status en wachtrij enkel via de server -----------------------------------------------------
-- De RLS-policies laten een winkel haar campagnes en sends bijwerken. Een gebruiker mocht zo zelf
-- een campagne op 'sending' zetten of rijen terug op 'queued' (limiet en betaalcontrole omzeilen).
-- Gebruikers (rol authenticated/anon) mogen de status enkel nog tussen draft en scheduled wisselen;
-- campaign_sends schrijven doet enkel de server.
create or replace function public.guard_email_campaign_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
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

drop trigger if exists trg_guard_email_campaign_status on public.email_campaigns;
create trigger trg_guard_email_campaign_status
  before insert or update on public.email_campaigns
  for each row execute function public.guard_email_campaign_status();

create or replace function public.guard_campaign_sends_write()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'MAIL_SENDS_GUARD: verzendrijen schrijft enkel SellQo';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_campaign_sends_write on public.campaign_sends;
create trigger trg_guard_campaign_sends_write
  before insert or update on public.campaign_sends
  for each row execute function public.guard_campaign_sends_write();

-- Verzonden rijen in één keer markeren: [{ "id": uuid, "resend_id": text }, …].
create or replace function public.mark_campaign_sends_sent(p_rows jsonb)
returns integer
language sql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
  with upd as (
    update public.campaign_sends cs
       set status = 'sent', resend_id = x.resend_id, sent_at = now(), error_message = null, claimed_at = null
      from jsonb_to_recordset(p_rows) as x(id uuid, resend_id text)
     where cs.id = x.id and cs.status = 'sending'
    returning 1
  )
  select count(*)::integer from upd
$$;

revoke all on function public.mark_campaign_sends_sent(jsonb) from public, anon, authenticated;
grant execute on function public.mark_campaign_sends_sent(jsonb) to service_role;

revoke all on function public.marketing_email_limit(uuid) from public, anon, authenticated;
revoke all on function public.marketing_emails_used(uuid) from public, anon, authenticated;
revoke all on function public.claim_campaign_sends(integer) from public, anon, authenticated;
grant execute on function public.marketing_email_limit(uuid) to service_role;
grant execute on function public.marketing_emails_used(uuid) to service_role;
grant execute on function public.claim_campaign_sends(integer) to service_role;

-- 7. Cron: de worker -----------------------------------------------------------------------------
-- Draait enkel iets als er werk is: een geplande campagne die aan de beurt is, of een rij in de
-- wachtrij. Elke minuut als het platform dat toelaat; er staat een guard op sub-hourly schedules
-- (zie 20260912140000), dan valt hij terug op elk uur. "Nu verzenden" wacht nooit op de cron:
-- send-campaign-batch start de worker meteen, en de worker roept zichzelf opnieuw aan zolang er
-- werk is. De cron is het vangnet en de klok voor geplande campagnes.
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
         OR status = 'sending'
    );
  $cmd$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ontbreekt — cron voor MAIL-1a overgeslagen';
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

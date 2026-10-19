-- MAIL-2d — A/B-test van de onderwerpregel van een campagne.
-- Go van Akke 20-10-2026. Zie docs/role-audit.md MAIL-2d.
--
-- Werking: een campagne krijgt een optioneel tweede onderwerp (subject_b). Bij het versturen gaat
-- een testgroep (standaard 20% van de doelgroep, minstens 100 per variant) 50/50 naar A en B; de
-- rest wacht in campaign_sends met status 'held'. Na de wachttijd (standaard 4 uur, 1-24) kiest
-- process-campaign-queue de winnaar op klikratio (gelijk → openratio → A) en zet de wachtende rijen
-- via campaign_ab_release in de wachtrij met het winnende onderwerp.
--
-- Bouwt op MAIL-1a/2a: dezelfde wachtrij (enqueue_campaign_sends), dezelfde maandlimiet. De limiet
-- telt bij de bevestiging de volledige doelgroep (ook de wachtende rijen), dus de rest kan nooit
-- achteraf op de limiet stuklopen. Automationmails (kind = 'automation') testen nooit.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, constraints enkel als ze ontbreken, CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER, ON CONFLICT voor het helpartikel. Strikt additief:
-- enkel nieuwe kolommen; enqueue_campaign_sends behoudt zijn signatuur en gedrag zonder A/B.
--
-- Terugdraaien (handmatig, er is geen DOWN):
--   -- eerst wachtende rijen vrijgeven of laten vallen, anders blijft een campagne op 'sending':
--   update public.campaign_sends set status = 'failed', error_message = 'A/B teruggedraaid'
--    where status = 'held';
--   drop trigger if exists trg_guard_email_campaign_ab on public.email_campaigns;
--   drop function if exists public.guard_email_campaign_ab();
--   drop function if exists public.campaign_ab_release(uuid, text);
--   drop function if exists public.campaign_ab_stats(uuid);
--   enqueue_campaign_sends: de versie uit 20261019230000_mail_2a_automations.sql opnieuw draaien.
--   alter table public.email_campaigns drop constraint if exists email_campaigns_ab_kind_check;
--   De nieuwe kolommen mogen blijven staan (additief, zonder A/B leest niets ze).
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'ab-test-onderwerp';

-- ── 1. Kolommen ──────────────────────────────────────────────────────────────
alter table public.email_campaigns add column if not exists subject_b text;
alter table public.email_campaigns add column if not exists ab_test_percent integer not null default 20;
alter table public.email_campaigns add column if not exists ab_wait_hours integer not null default 4;
alter table public.email_campaigns add column if not exists ab_started_at timestamptz;
alter table public.email_campaigns add column if not exists ab_winner text;
alter table public.email_campaigns add column if not exists ab_decided_at timestamptz;

comment on column public.email_campaigns.subject_b is
  'MAIL-2d: tweede onderwerp voor een A/B-test. Leeg = geen test. Nooit bij kind = automation.';
comment on column public.email_campaigns.ab_started_at is
  'MAIL-2d: moment waarop de testgroep in de wachtrij ging (enkel door SellQo gezet).';
comment on column public.email_campaigns.ab_winner is
  'MAIL-2d: A of B, gekozen door process-campaign-queue (enkel door SellQo gezet).';

-- campaign_sends.variant: A of B voor de testgroep; null voor de rest (die krijgt ab_winner).
alter table public.campaign_sends add column if not exists variant text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_ab_percent_check') then
    alter table public.email_campaigns
      add constraint email_campaigns_ab_percent_check check (ab_test_percent between 10 and 50);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_ab_wait_check') then
    alter table public.email_campaigns
      add constraint email_campaigns_ab_wait_check check (ab_wait_hours between 1 and 24);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_ab_winner_check') then
    alter table public.email_campaigns
      add constraint email_campaigns_ab_winner_check check (ab_winner is null or ab_winner in ('A', 'B'));
  end if;
  -- Automationmails testen nooit.
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_ab_kind_check') then
    alter table public.email_campaigns
      add constraint email_campaigns_ab_kind_check check (kind = 'campaign' or subject_b is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_sends_variant_check') then
    alter table public.campaign_sends
      add constraint campaign_sends_variant_check check (variant is null or variant in ('A', 'B'));
  end if;
end $$;

-- Wachtende rijen per campagne snel vinden (vrijgeven en "nog open"-telling).
create index if not exists idx_campaign_sends_held
  on public.campaign_sends (campaign_id) where status = 'held';

-- ── 2. Guard ─────────────────────────────────────────────────────────────────
-- Een gebruiker stelt het tweede onderwerp, het percentage en de wachttijd in zolang de campagne
-- niet verstuurt; het verloop van de test (start, winnaar, beslismoment) zet enkel SellQo.
create or replace function public.guard_email_campaign_ab()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user::text not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.ab_started_at is not null or new.ab_winner is not null or new.ab_decided_at is not null then
      raise exception 'MAIL_AB_GUARD: het verloop van een A/B-test zet enkel SellQo';
    end if;
    return new;
  end if;
  if new.ab_started_at is distinct from old.ab_started_at
     or new.ab_winner is distinct from old.ab_winner
     or new.ab_decided_at is distinct from old.ab_decided_at then
    raise exception 'MAIL_AB_GUARD: het verloop van een A/B-test zet enkel SellQo';
  end if;
  if (new.subject_b is distinct from old.subject_b
      or new.ab_test_percent is distinct from old.ab_test_percent
      or new.ab_wait_hours is distinct from old.ab_wait_hours)
     and old.status not in ('draft', 'scheduled', 'failed') then
    raise exception 'MAIL_AB_GUARD: de A/B-test wijzig je niet meer tijdens of na het versturen';
  end if;
  -- Review-fix: tijdens een lopende test (gestart, nog geen winnaar) ligt onderwerp A ook vast,
  -- anders vergelijkt de test iets anders dan wat de rest krijgt.
  if new.subject is distinct from old.subject
     and old.ab_started_at is not null and old.ab_decided_at is null then
    raise exception 'MAIL_AB_GUARD: het onderwerp wijzig je niet tijdens een lopende A/B-test';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_email_campaign_ab on public.email_campaigns;
create trigger trg_guard_email_campaign_ab
  before insert or update on public.email_campaigns
  for each row execute function public.guard_email_campaign_ab();

-- ── 3. In de wachtrij zetten, met optionele A/B-verdeling ─────────────────────
-- Zelfde signatuur en gedrag als MAIL-2a. Nieuw: elke rij mag `variant` hebben:
--   'A' / 'B' → testgroep, status queued;   'hold' → de rest, status held (wacht op de winnaar).
-- Zonder variant (gewone campagne) verandert er niets. De verdeling zelf (wie in welke groep)
-- maakt de server (campaignQueue.ts, willekeurig); de databank controleert de regels.
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
  v_subject_b text;
  v_ab boolean;
  v_a integer;
  v_b integer;
  v_hold integer;
begin
  select tenant_id, status, kind, subject_b into v_tenant, v_status, v_kind, v_subject_b
    from public.email_campaigns where id = p_campaign_id for update;
  if v_tenant is null then raise exception 'MAIL_NOT_FOUND'; end if;
  -- Systeemcampagnes van automations verstuur je nooit als gewone campagne (MAIL-2a).
  if v_kind = 'automation' then raise exception 'MAIL_ALREADY_SENDING'; end if;
  if not (v_status = any (p_from_statuses)) then raise exception 'MAIL_ALREADY_SENDING'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then raise exception 'MAIL_NO_RECIPIENTS'; end if;

  -- MAIL-2d: A/B-regels. Eén rij per adres (zelfde ontdubbeling als de insert hieronder).
  select count(*) filter (where d.variant = 'A'),
         count(*) filter (where d.variant = 'B'),
         count(*) filter (where d.variant = 'hold'),
         count(*) filter (where d.variant is not null)
    into v_a, v_b, v_hold, v_new
    from (select distinct on (lower(trim(x.email))) x.variant
            from jsonb_to_recordset(p_rows) as x(email text, variant text)
           where coalesce(trim(x.email), '') <> ''
           order by lower(trim(x.email)), x.variant) d;
  v_ab := v_new > 0;
  if v_ab then
    if v_kind <> 'campaign' or coalesce(trim(v_subject_b), '') = '' then raise exception 'MAIL_AB_INVALID'; end if;
    if v_a + v_b + v_hold <> v_new then raise exception 'MAIL_AB_INVALID'; end if;
    if exists (select 1 from jsonb_to_recordset(p_rows) as x(email text, variant text)
                where coalesce(trim(x.email), '') <> '' and x.variant is null) then
      raise exception 'MAIL_AB_INVALID';
    end if;
    if v_a < 100 or v_b < 100 then raise exception 'MAIL_AB_TOO_SMALL:%:%', v_a, v_b; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('marketing_quota:' || v_tenant::text));

  -- De limiet telt de volledige doelgroep, ook de rijen die op de winnaar wachten.
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
           lower(trim(x.email)) as email, x.customer_id, x.customer_name,
           case when x.variant = 'hold' then 'held' else 'queued' end as status,
           case when x.variant in ('A', 'B') then x.variant end as variant
      from jsonb_to_recordset(p_rows) as x(email text, customer_id uuid, customer_name text, variant text)
     where coalesce(trim(x.email), '') <> ''
     order by lower(trim(x.email)), x.variant
  ), ins as (
    insert into public.campaign_sends (campaign_id, customer_id, email, customer_name, status, variant, created_at)
    select p_campaign_id, src.customer_id, src.email, src.customer_name, src.status, src.variant, now() from src
    on conflict (campaign_id, email) where automation_run_id is null do update
      set status = excluded.status, variant = excluded.variant, attempts = 0, next_attempt_at = null,
          claimed_at = null, error_message = null, created_at = now()
      where public.campaign_sends.status = 'failed'
    returning 1
  )
  select count(*) into v_queued from ins;

  if v_queued = 0 then raise exception 'MAIL_NO_RECIPIENTS'; end if;

  update public.email_campaigns
     set status = 'sending', send_started_at = now(), send_error = null,
         total_recipients = (select count(*) from public.campaign_sends where campaign_id = p_campaign_id and status <> 'failed'),
         ab_started_at = case when v_ab then now() end,
         ab_winner = null,
         ab_decided_at = null,
         updated_at = now()
   where id = p_campaign_id;

  return jsonb_build_object('queued', v_queued, 'limit', v_limit, 'used', v_used + v_queued,
    'ab', case when v_ab then jsonb_build_object('a', v_a, 'b', v_b, 'held', v_hold) end);
end $$;

revoke all on function public.enqueue_campaign_sends(uuid, text[], jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_campaign_sends(uuid, text[], jsonb) to service_role;

-- ── 4. Winnaar vastleggen en de rest vrijgeven ───────────────────────────────
-- Eén keer per campagne (rij-lock + ab_winner is null), enkel als de wachttijd voorbij is en de
-- campagne nog verstuurt. Twee workers tegelijk: de tweede krijgt released = 0.
create or replace function public.campaign_ab_release(p_campaign_id uuid, p_winner text)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  c record;
  v_released integer;
begin
  if p_winner is null or p_winner not in ('A', 'B') then raise exception 'MAIL_AB_INVALID'; end if;
  select id, status, kind, ab_started_at, ab_wait_hours, ab_winner into c
    from public.email_campaigns where id = p_campaign_id for update;
  if c.id is null then raise exception 'MAIL_NOT_FOUND'; end if;
  if c.kind <> 'campaign' or c.status <> 'sending' or c.ab_started_at is null or c.ab_winner is not null then
    return jsonb_build_object('released', 0, 'winner', c.ab_winner, 'skipped', true);
  end if;
  if now() < c.ab_started_at + make_interval(hours => c.ab_wait_hours) then
    return jsonb_build_object('released', 0, 'winner', null, 'skipped', true, 'reason', 'not_due');
  end if;

  update public.email_campaigns
     set ab_winner = p_winner, ab_decided_at = now(), updated_at = now()
   where id = p_campaign_id;

  with upd as (
    update public.campaign_sends
       set status = 'queued', next_attempt_at = null, claimed_at = null
     where campaign_id = p_campaign_id and status = 'held'
    returning 1
  )
  select count(*) into v_released from upd;

  return jsonb_build_object('released', v_released, 'winner', p_winner, 'skipped', false);
end $$;

revoke all on function public.campaign_ab_release(uuid, text) from public, anon, authenticated;
grant execute on function public.campaign_ab_release(uuid, text) to service_role;

-- ── 5. Cijfers per variant ───────────────────────────────────────────────────
-- Voor de beslissing (worker) en het campagnerapport (winkel). 'rest' = de groep die de winnaar
-- kreeg. Verzonden = alles wat Resend aannam; geopend omvat ook wie klikte.
create or replace function public.campaign_ab_stats(p_campaign_id uuid)
returns table (variant text, recipients integer, sent integer, opened integer, clicked integer, waiting integer)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.email_campaigns where id = p_campaign_id;
  if v_tenant is null then return; end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_tenant_role(v_tenant, array['tenant_admin', 'staff', 'marketing', 'viewer']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  return query
    select coalesce(cs.variant, 'rest')::text,
           count(*) filter (where cs.status <> 'failed')::integer,
           count(*) filter (where cs.status in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'))::integer,
           count(*) filter (where cs.opened_at is not null or cs.clicked_at is not null
                              or cs.status in ('opened', 'clicked'))::integer,
           count(*) filter (where cs.clicked_at is not null or cs.status = 'clicked')::integer,
           count(*) filter (where cs.status = 'held')::integer
      from public.campaign_sends cs
     where cs.campaign_id = p_campaign_id and cs.automation_run_id is null
     group by 1
     order by 1;
end $$;

revoke all on function public.campaign_ab_stats(uuid) from public, anon;
grant execute on function public.campaign_ab_stats(uuid) to authenticated, service_role;

-- ── 6. Helpartikel ───────────────────────────────────────────────────────────
insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing',
  'Twee onderwerpen testen (A/B-test)',
  'ab-test-onderwerp',
  'Test twee onderwerpregels op een deel van je doelgroep; de rest krijgt automatisch het onderwerp dat het best scoort.',
  $html$
<h2>Wat doet een A/B-test?</h2>
<p>Je geeft een campagne een <strong>tweede onderwerp (B)</strong>. Bij het versturen gaat een testgroep van je doelgroep half met onderwerp A en half met onderwerp B. Na een wachttijd kiest SellQo het onderwerp waarop het meest geklikt werd, en de rest van je doelgroep krijgt dat onderwerp. De inhoud van de mail is voor iedereen dezelfde.</p>

<h2>Instellen</h2>
<ol>
  <li>Open of maak een campagne in <strong>Marketing → E-mail</strong>.</li>
  <li>Zet <strong>A/B-test van het onderwerp</strong> aan en vul onderwerp B in.</li>
  <li>Kies hoe groot de testgroep is (standaard 20% van je doelgroep) en hoe lang SellQo wacht voor het de winnaar kiest (standaard 4 uur, tussen 1 en 24 uur).</li>
</ol>

<h2>Hoe wordt de winnaar gekozen?</h2>
<p>Op het <strong>percentage ontvangers dat op een link klikte</strong>. Is dat gelijk, dan telt het percentage dat de mail opende. Is ook dat gelijk, dan wint onderwerp A. In het rapport van de campagne zie je per onderwerp hoeveel mails verstuurd, geopend en aangeklikt zijn, en welk onderwerp gewonnen heeft.</p>
<p>Openingen zijn een benadering: sommige mailprogramma's laden de afbeeldingen vooraf of blokkeren ze. Daarom telt de klikratio eerst.</p>

<h2>Wanneer kan het niet?</h2>
<ul>
  <li>Elke variant heeft minstens <strong>100 ontvangers</strong> nodig. Is je doelgroep daarvoor te klein, dan zegt SellQo dat vóór het versturen en gaat de campagne met onderwerp A naar iedereen.</li>
  <li>Een campagne in meerdere talen test niet: elke taal heeft al een eigen onderwerp.</li>
  <li>Automatische e-mails (automatiseringen) testen niet.</li>
</ul>

<h2>Je maandlimiet</h2>
<p>Bij het bevestigen telt je volledige doelgroep mee voor je marketingmails van deze maand, ook de ontvangers die nog op de winnaar wachten. Zo loopt de rest van je campagne nooit vast op je limiet.</p>
$html$,
  60
)
on conflict (doc_level, slug) do update
  set title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      context_path = excluded.context_path,
      category_id = excluded.category_id,
      updated_at = now();

-- MAIL-CLEAN-1 (20-10-2026) — de oude nieuwsbriefroute opruimen, zonder dat een winkel iets merkt.
--
-- 1. Snapshots (vóór elke wijziging, idempotent: een tweede run laat de eerste snapshot staan).
-- 2. Eigen welkomstmail (tenant_newsletter_config) → welkomstreeks (email_automations), stap 1 =
--    exact het eigen onderwerp en de eigen HTML, meteen, aan. Geen stap 2: zelfde gedrag als vroeger
--    (één welkomstmail na de bevestiging). Daarna welcome_email_enabled = false, zodat de oude losse
--    mail (newsletter-confirm sendWelcomeEmail) nooit meer vertrekt, ook niet als de winkel de reeks
--    later uitzet. De kolommen blijven; de inhoud staat ook nog in de snapshot.
-- 3. double_optin kan niet meer uit (de schakelaar verdwijnt uit de admin). Rijen die ooit op false
--    stonden gaan naar true (live: 0).
-- 4. Bevestigde abonnees zonder ingeschreven klantrij krijgen die rij, zoals newsletter-confirm
--    hem vandaag maakt. Zonder melding/push "nieuwe klant" (trigger tijdelijk uit, in deze transactie).
-- 5. Helpartikelen bijgewerkt (email-automations, emailcampagnes, teamleden-rollen).
--
-- Geen kolom gedropt of hernoemd. Gedeelde tabellen van de eerste wet niet geraakt.
--
-- Handmatig terugdraaien (geen DOWN):
--   delete from public.email_campaigns c using public.email_automations a
--     where c.automation_id = a.id and a.preset_key = 'welcome_series' and a.trigger_config ? 'legacy_welcome';
--   delete from public.automation_steps s using public.email_automations a
--     where s.automation_id = a.id and a.preset_key = 'welcome_series' and a.trigger_config ? 'legacy_welcome';
--   delete from public.email_automations where preset_key = 'welcome_series' and trigger_config ? 'legacy_welcome';
--   update public.tenant_newsletter_config c set welcome_email_enabled = s.welcome_email_enabled,
--     double_optin = s.double_optin
--     from snapshots.platform_20261020_tenant_newsletter_config s where s.id = c.id;
--   Klantrijen: vergelijk public.customers met snapshots.platform_20261020_customers_subs
--   (nieuwe rijen hebben tags {subscribed}, acquisition_source 'webshop' en email_subscribed_at = confirmed_at).
--   Helpartikelen: content terugzetten uit snapshots.platform_20261020_doc_articles_mail_clean.

create schema if not exists snapshots;

create table if not exists snapshots.platform_20261020_tenant_newsletter_config as
  select * from public.tenant_newsletter_config;
create table if not exists snapshots.platform_20261020_email_automations as
  select * from public.email_automations;
create table if not exists snapshots.platform_20261020_newsletter_subscribers as
  select * from public.newsletter_subscribers;
create table if not exists snapshots.platform_20261020_customers_subs as
  select c.* from public.customers c
   where exists (select 1 from public.newsletter_subscribers s
                  where s.tenant_id = c.tenant_id and lower(trim(s.email)) = lower(trim(c.email)));
create table if not exists snapshots.platform_20261020_doc_articles_mail_clean as
  select * from public.doc_articles
   where slug in ('email-automations', 'emailcampagnes', 'teamleden-rollen');

-- ── 2. Eigen welkomstmail → welkomstreeks ────────────────────────────────────
-- Zelfde opbouw als automation_ensure_presets (MAIL-2a §11): automation + stap + systeemcampagne,
-- met dezelfde omzetting van de oude placeholders naar de variabelen van de engine. Die RPC zelf kan
-- hier niet: hij vraagt een ingelogde winkelgebruiker (has_tenant_role).
-- trigger_config.legacy_welcome markeert de overgenomen reeks (uitleg in de admin, terugdraaien).
do $$
declare
  r record;
  v_auto uuid;
  v_step uuid;
  v_body text;
begin
  for r in
    select c.tenant_id, c.welcome_email_subject, c.welcome_email_body
      from public.tenant_newsletter_config c
     where c.welcome_email_enabled is true
       and coalesce(trim(c.welcome_email_body), '') <> ''
       and not exists (select 1 from public.email_automations a
                        where a.tenant_id = c.tenant_id and a.preset_key = 'welcome_series')
  loop
    insert into public.email_automations (tenant_id, name, description, trigger_type, trigger_config, is_active,
                                          preset_key, max_runs_per_customer, cooldown_hours)
    values (r.tenant_id, 'Welkomstreeks',
            'Je vroegere welkomstmail, na het bevestigen van de nieuwsbrief (overgenomen in MAIL-CLEAN-1).',
            'newsletter_confirmed', jsonb_build_object('legacy_welcome', true), true,
            'welcome_series', 1, 0)
    on conflict (tenant_id, preset_key) where preset_key is not null do nothing
    returning id into v_auto;
    if v_auto is null then continue; end if;

    insert into public.automation_steps (automation_id, step_order, action_type, delay_hours, delay_minutes,
                                         is_active, condition_rules)
    values (v_auto, 1, 'send_email', 0, 0, true, '{}'::jsonb)
    returning id into v_step;

    v_body := replace(replace(replace(replace(replace(replace(replace(r.welcome_email_body,
                '{{SHOP_URL}}', '{{shop_url}}'), '{{AFMELD_URL}}', '{{unsubscribe_url}}'),
                '{{LOGO_URL}}', '{{tenant_logo_url}}'), '{{JAAR}}', '{{current_year}}'),
                '{{first_name}}', '{{customer_first_name}}'), '{{customer_name}}', '{{customer_first_name}}'),
                '{{company_website}}', '{{shop_url}}');

    insert into public.email_campaigns (tenant_id, name, subject, preview_text, html_content, status, kind,
                                        automation_id, automation_step_id, translations, available_languages,
                                        send_started_at)
    values (r.tenant_id, 'Welkomstreeks: welkom',
            -- zelfde terugval als de oude mail (newsletter-confirm): standaardonderwerp als het leeg was
            coalesce(nullif(trim(r.welcome_email_subject), ''), 'Welkom bij onze nieuwsbrief!'),
            null, v_body, 'sending', 'automation', v_auto, v_step,
            '{}'::jsonb, array['nl'], now());  -- de oude welkomstmail was eentalig
  end loop;
end $$;

-- De oude losse welkomstmail nooit meer: enkel waar de reeks nu bestaat.
update public.tenant_newsletter_config c
   set welcome_email_enabled = false
 where c.welcome_email_enabled is true
   and exists (select 1 from public.email_automations a
                where a.tenant_id = c.tenant_id and a.preset_key = 'welcome_series');

-- ── 3. Double opt-in altijd aan ──────────────────────────────────────────────
update public.tenant_newsletter_config set double_optin = true where double_optin is false;

-- ── 4. Bevestigde abonnees → ingeschreven klant ──────────────────────────────
-- Zelfde velden als newsletter-confirm markCustomerSubscribed; als datum de echte bevestiging.
-- Overgeslagen: uitgeschreven adressen, klanten die zich elders uitschreven (marketingstatus of
-- alle voorkeuren uit). Geen melding "nieuwe klant" voor deze rechtzetting.
-- Review-fix: in één DO-blok (één statement = atomair). Faalt iets, dan rolt ook de
-- DISABLE TRIGGER terug; de trigger kan dus nooit uit blijven staan.
do $mailclean$
begin
alter table public.customers disable trigger trigger_customer_notification;

with todo as (
  select distinct on (s.tenant_id, lower(trim(s.email)))
         s.tenant_id, lower(trim(s.email)) as email, nullif(trim(s.first_name), '') as first_name,
         s.confirmed_at,
         case when lower(left(s.metadata->>'language', 2)) in ('nl', 'en', 'fr', 'de')
              then lower(left(s.metadata->>'language', 2)) end as lang
    from public.newsletter_subscribers s
   where s.status = 'active' and s.confirmed_at is not null
     and not exists (select 1 from public.email_unsubscribes u
                      where u.tenant_id = s.tenant_id and lower(trim(u.email)) = lower(trim(s.email)))
     and not exists (select 1 from public.customers c
                      where c.tenant_id = s.tenant_id and lower(trim(c.email)) = lower(trim(s.email))
                        and (c.email_subscribed is true or c.email_marketing_status = 'unsubscribed'))
     and not exists (select 1 from public.email_preferences ep
                      where ep.tenant_id = s.tenant_id and lower(trim(ep.email)) = lower(trim(s.email))
                        and ep.newsletter is false and ep.promotions is false and ep.product_updates is false)
   order by s.tenant_id, lower(trim(s.email)), s.confirmed_at
),
upd as (
  update public.customers c
     set email_subscribed = true,
         email_subscribed_at = t.confirmed_at,
         tags = case when 'subscribed' = any(coalesce(c.tags, '{}')) then c.tags
                     else array_append(coalesce(c.tags, '{}'), 'subscribed') end,
         preferred_language = coalesce(c.preferred_language, t.lang)
    from todo t
   where c.tenant_id = t.tenant_id and lower(trim(c.email)) = t.email
     and c.email_subscribed is not true
  returning c.tenant_id, lower(trim(c.email)) as email
)
insert into public.customers (tenant_id, email, first_name, customer_type, tags, email_subscribed,
                              email_subscribed_at, preferred_language, acquisition_source)
select t.tenant_id, t.email, t.first_name, 'prospect', array['subscribed'], true, t.confirmed_at, t.lang, 'webshop'
  from todo t
 where not exists (select 1 from upd u where u.tenant_id = t.tenant_id and u.email = t.email)
   and not exists (select 1 from public.customers c
                    where c.tenant_id = t.tenant_id and lower(trim(c.email)) = t.email)
on conflict do nothing;

alter table public.customers enable trigger trigger_customer_notification;
end
$mailclean$;

-- Geen email_preferences-rij: zonder rij gelden alle voorkeuren als aan (automation_consent,
-- voorkeurenpagina). Geen van de 7 live abonnees heeft er een.

-- ── 5. Helpartikelen (DOCS-1) ────────────────────────────────────────────────
-- Gerichte vervanging: idempotent (de oude zin bestaat na de eerste run niet meer).
update public.doc_articles
   set content = replace(content,
     '<p>Had je al een eigen welkomstmail ingeschakeld? Die staat als eerste mail in de welkomstreeks. Zolang de welkomstreeks uit staat, blijft je oude welkomstmail vertrekken. Zet je de reeks aan, dan krijgt een nieuwe abonnee enkel de reeks.</p>',
     '<p>Had je vroeger een eigen welkomstmail bij <strong>Instellingen → Nieuwsbrief</strong>? Die staat nu als enige mail in de <strong>Welkomstreeks</strong>, met je eigen onderwerp en je eigen ontwerp, en de reeks staat aan. Je nieuwe abonnees krijgen dus dezelfde welkomstmail als vroeger, meteen na hun bevestiging. Aanpassen doe je door op die stap te klikken. Zet je de welkomstreeks uit, dan krijgt een nieuwe abonnee geen welkomstmail meer.</p>
<p>Inschrijven op je nieuwsbrief gebeurt altijd met bevestiging (dubbele opt-in); dat kan je niet uitzetten.</p>')
 where doc_level = 'tenant' and slug = 'email-automations'
   and position('Zolang de welkomstreeks uit staat, blijft je oude welkomstmail vertrekken.' in content) > 0;

update public.doc_articles
   set content = replace(content,
     'Pas daarna krijgt die persoon je campagnes en je welkomstmail.',
     'Pas daarna krijgt die persoon je campagnes, en je welkomstmail als je de <strong>Welkomstreeks</strong> in <strong>Marketing → Automatiseringen</strong> aanzette. Die bevestiging staat altijd aan.')
 where doc_level = 'tenant' and slug = 'emailcampagnes'
   and position('Pas daarna krijgt die persoon je campagnes en je welkomstmail.' in content) > 0;

update public.doc_articles
   set content = replace(content, 'WhatsApp, Nieuwsbrief, Social Media', 'WhatsApp, E-mailinschrijving, Social Media')
 where doc_level = 'tenant' and slug = 'teamleden-rollen'
   and position('WhatsApp, Nieuwsbrief, Social Media' in content) > 0;
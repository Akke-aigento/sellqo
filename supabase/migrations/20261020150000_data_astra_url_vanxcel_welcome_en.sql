-- DATA-20OKT — twee datacorrecties na de mail-reeks (20 oktober 2026).
--
-- a. Astra Sleep (tenant 169cf7b9-b22a-4a94-87d1-fb4b9cc948f9, slug 'astra-sleep') had geen
--    product_url_template. Productlinks in mails en feeds konden daardoor niet naar de eigen
--    frontend wijzen. Hun storefront heeft de route /products/$slug
--    (src/routes/products.$slug.tsx). Enkel zetten als het veld nog leeg is.
--    Let op: de Astra-site staat in MAINTENANCE_MODE (src/lib/site-status.ts = true); de links
--    tonen de onderhoudspagina tot de schakelaar terug op false staat.
--
-- b. VanXcel welkomstreeks (email_automations.preset_key = 'welcome_series', stap 1,
--    email_campaigns 9893658c-40ab-4784-be04-aab7276123ed, kind 'automation') kreeg een Engelse
--    versie. Zelfde structuur als AutomationStepDialog/useEmailAutomations.saveStep schrijft:
--    translations.en = { subject, preview_text, html_content } en available_languages = nl + en.
--    campaignQueue.renderFor kiest 'en' voor klanten met preferred_language/locale 'en'.
--    De EN-body = de live NL-body met enkel de zichtbare teksten vervangen (replace van exacte
--    NL-fragmenten). Placeholders, opmaak, links en WELCOME10 blijven identiek; zichtbare
--    'vanxcel.be' wordt 'vanxcel.com'. HTML-commentaar (onzichtbaar) blijft NL.
--    Wacht: enkel als er nog geen 'en' is én de NL-body nog exact de verwachte is
--    (md5 4ba371d5170b270814e771d4131c99b3). Anders: niets, met een NOTICE.
--
-- Idempotent: snapshots via CREATE TABLE IF NOT EXISTS (de eerste run telt); a. enkel bij null;
-- b. enkel als translations nog geen 'en' heeft. Tweede run verandert niets.
-- Geen schemawijziging, geen gedeelde tabel geraakt (tenants.product_url_template en
-- email_campaigns zitten niet in het storefront-api-contract van de custom frontends).
--
-- Terugdraaien (handmatig):
--   update public.tenants t set product_url_template = s.product_url_template
--     from snapshots.astra_sleep_20261020_tenants_product_url s where t.id = s.id;
--   update public.email_campaigns c
--      set translations = s.translations, available_languages = s.available_languages
--     from snapshots.vanxcel_20261020_welcome_step s where c.id = s.id;

create schema if not exists snapshots;

create table if not exists snapshots.astra_sleep_20261020_tenants_product_url as
  select id, name, slug, product_url_template, now() as snapshot_at
    from public.tenants
   where id = '169cf7b9-b22a-4a94-87d1-fb4b9cc948f9';

create table if not exists snapshots.vanxcel_20261020_welcome_step as
  select c.*, now() as snapshot_at
    from public.email_campaigns c
    join public.automation_steps s on s.id = c.automation_step_id
    join public.email_automations a on a.id = s.automation_id
   where c.tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
     and c.kind = 'automation'
     and a.tenant_id = c.tenant_id
     and a.preset_key = 'welcome_series';

-- ── a. Astra Sleep product_url_template ──────────────────────────────────────
update public.tenants
   set product_url_template = 'https://astrasleep.shop/products/{slug}'
 where id = '169cf7b9-b22a-4a94-87d1-fb4b9cc948f9'
   and slug = 'astra-sleep'
   and product_url_template is null;

-- ── b. VanXcel welkomstmail: Engelse versie ──────────────────────────────────
do $$
declare
  v_id uuid := '9893658c-40ab-4784-be04-aab7276123ed';
  v_row record;
  v_en text;
begin
  select c.id, c.html_content, c.translations, c.available_languages
    into v_row
    from public.email_campaigns c
    join public.automation_steps s on s.id = c.automation_step_id
    join public.email_automations a on a.id = s.automation_id
   where c.id = v_id
     and c.tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
     and c.kind = 'automation'
     and a.preset_key = 'welcome_series';

  if not found then
    raise notice 'DATA-20OKT b: welkomstcampagne VanXcel niet gevonden, overgeslagen';
    return;
  end if;
  if coalesce(v_row.translations, '{}'::jsonb) ? 'en' then
    raise notice 'DATA-20OKT b: Engelse versie bestaat al, overgeslagen';
    return;
  end if;
  if md5(v_row.html_content) <> '4ba371d5170b270814e771d4131c99b3' then
    raise notice 'DATA-20OKT b: NL-body gewijzigd sinds de recon (md5 %), overgeslagen', md5(v_row.html_content);
    return;
  end if;

  v_en := v_row.html_content;
  v_en := replace(v_en, '<html lang="nl"', '<html lang="en"');
  v_en := replace(v_en, '<title>Welkom bij VanXcel</title>', '<title>Welcome to VanXcel</title>');
  v_en := replace(v_en,
    'Welkom aan boord — 10% korting op je eerste VanXcel-bestelling met code WELCOME10.',
    'Welcome aboard — 10% off your first VanXcel order with code WELCOME10.');
  v_en := replace(v_en, '>Welkom aan boord</p>', '>Welcome aboard</p>');
  v_en := replace(v_en,
    'Klaar voor het avontuur, {{customer_first_name}}?',
    'Ready for the road, {{customer_first_name}}?');
  v_en := replace(v_en,
    'Fijn dat je erbij bent. Bij VanXcel bouwen we betrouwbare off-grid stroom voor campers en avonturiers — LiFePO&#8324;-batterijen, omvormers, laders en alles ertussenin. Om je op weg te helpen, geven we je <strong style="color:#111111;">10% korting op je eerste bestelling</strong>.',
    'Great to have you with us. At VanXcel we build reliable off-grid power for campers and adventurers — LiFePO&#8324; batteries, inverters, chargers and everything in between. To get you started, here''s <strong style="color:#111111;">10% off your first order</strong>.');
  v_en := replace(v_en, '>Jouw welkomstkorting</p>', '>Your welcome discount</p>');
  v_en := replace(v_en, '>op je eerste bestelling</p>', '>on your first order</p>');
  v_en := replace(v_en, 'Ontdek de shop &#8594;', 'Explore the shop &#8594;');
  v_en := replace(v_en,
    'Gebruik code <strong style="color:#666666;">WELCOME10</strong> bij het afrekenen. Geldig op je eerste bestelling. Niet combineerbaar met andere acties.',
    'Use code <strong style="color:#666666;">WELCOME10</strong> at checkout. Valid on your first order. Cannot be combined with other offers.');
  v_en := replace(v_en, '>2 jaar</p>', '>2 years</p>');
  v_en := replace(v_en, '>garantie op alle producten</p>', '>warranty on all products</p>');
  v_en := replace(v_en, '>Snel</p>', '>Fast</p>');
  v_en := replace(v_en, '>verzonden vanuit België</p>', '>shipped from Belgium</p>');
  v_en := replace(v_en, '>Advies</p>', '>Advice</p>');
  v_en := replace(v_en, '>gratis hulp bij je opstelling</p>', '>free help with your setup</p>');
  v_en := replace(v_en, 'VanXcel &mdash; onderdeel van Nomadix BV<br>', 'VanXcel &mdash; part of Nomadix BV<br>');
  v_en := replace(v_en,
    'Beekstraat 49, 3051 Oud-Heverlee, België &middot; BTW BE 1017.500.207',
    'Beekstraat 49, 3051 Oud-Heverlee, Belgium &middot; VAT BE 1017.500.207');
  v_en := replace(v_en,
    'Je ontvangt deze mail omdat je je inschreef via vanxcel.be.<br>',
    'You''re receiving this email because you signed up at vanxcel.com.<br>');
  v_en := replace(v_en, 'text-decoration:underline;">Afmelden</a>', 'text-decoration:underline;">Unsubscribe</a>');
  v_en := replace(v_en, 'text-decoration:underline;">vanxcel.be</a>', 'text-decoration:underline;">vanxcel.com</a>');

  update public.email_campaigns
     set translations = coalesce(translations, '{}'::jsonb) || jsonb_build_object('en', jsonb_build_object(
           'subject', 'Welcome aboard — 10% off your first order',
           'preview_text', null,
           'html_content', v_en)),
         available_languages = (
           select array_agg(l order by case l when 'nl' then 0 else 1 end, l)
             from (select distinct unnest(coalesce(available_languages, array['nl']) || array['nl', 'en']) as l) x)
   where id = v_row.id;
end $$;

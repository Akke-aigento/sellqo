-- MAIL-UX-1 — Marketing → E-mail met tabbladen bovenaan; Automatiseringen is een tabblad (20 oktober 2026).
--
-- WAAROM. /admin/marketing/automations is geen eigen pagina meer: de route stuurt door naar
-- /admin/marketing?tab=automations (met behoud van ?trigger=). Het helpartikel 'email-automations'
-- hing aan die oude route (context_path) en twee artikelen wezen de weg via
-- "Marketing → Automatiseringen". De contextuele hulp verschijnt op het pad zonder query, dus
-- context_path wordt '/admin/marketing', zoals de andere e-mailartikelen.
--
-- Wat deze migratie doet (enkel public.doc_articles, enkel deze twee rijen, geen schemawijziging):
--   0. Snapshot van beide rijen in snapshots.platform_20261020_doc_articles_mail_ux.
--   1. 'email-automations': context_path → '/admin/marketing'; menupad → Marketing → E-mail → Automatiseringen.
--   2. 'emailcampagnes': menupad, de plek van de teller (tabblad Overzicht), een korte alinea
--      "Wat vind je waar?" en één zin over de mailversie van een logo dat er al stond.
--
-- Idempotent: elke stap schrijft enkel als de oude tekst er nog staat of de nieuwe er nog niet
-- staat; replace() van een tekst die er niet (meer) is, verandert niets. De snapshot is
-- CREATE TABLE IF NOT EXISTS (de eerste run telt). category_id wordt niet aangeraakt (NOT NULL,
-- bestaande waarde blijft).
--
-- Terugdraaien (handmatig):
--   update public.doc_articles d
--      set content = s.content, context_path = s.context_path
--     from snapshots.platform_20261020_doc_articles_mail_ux s
--    where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.platform_20261020_doc_articles_mail_ux as
  select * from public.doc_articles
   where doc_level = 'tenant' and slug in ('email-automations', 'emailcampagnes');

-- ── 1. email-automations ─────────────────────────────────────────────────────
update public.doc_articles
   set context_path = '/admin/marketing'
 where doc_level = 'tenant'
   and slug = 'email-automations'
   and context_path is distinct from '/admin/marketing';

update public.doc_articles
   set content = replace(content,
         '<strong>Marketing → Automatiseringen</strong>',
         '<strong>Marketing → E-mail → Automatiseringen</strong>')
 where doc_level = 'tenant'
   and slug in ('email-automations', 'emailcampagnes')
   and position('<strong>Marketing → Automatiseringen</strong>' in content) > 0;

-- ── 2. emailcampagnes ────────────────────────────────────────────────────────
update public.doc_articles
   set content = replace(content,
         '<p>Bovenaan <strong>Marketing → E-mail</strong> zie je hoeveel marketingmails',
         '<p>Op het tabblad <strong>Overzicht</strong> van <strong>Marketing → E-mail</strong> zie je hoeveel marketingmails')
 where doc_level = 'tenant'
   and slug = 'emailcampagnes'
   and position('<p>Bovenaan <strong>Marketing → E-mail</strong> zie je hoeveel marketingmails' in content) > 0;

update public.doc_articles
   set content = replace(content,
         E'\n<h2>Een campagne maken</h2>',
         $html$
<h2>Wat vind je waar?</h2>
<p>In <strong>Marketing → E-mail</strong> staan bovenaan zes tabbladen:</p>
<ul>
  <li><strong>Overzicht</strong>: je verbruik van marketingmails deze maand, de cijfers van je verzonden campagnes, een grafiek en de live activiteit.</li>
  <li><strong>Campagnes</strong>: al je campagnes, met hun status. Heb je nog geen campagnes, dan opent de pagina hier.</li>
  <li><strong>Automatiseringen</strong>: de automatische mails, zoals de welkomstreeks en de herinnering bij een verlaten winkelwagen.</li>
  <li><strong>Templates</strong> en <strong>Segmenten</strong>: herbruikbare ontwerpen en klantgroepen. Op die tabbladen staat de knop om er een nieuwe te maken.</li>
  <li><strong>Abonnees</strong>: wie ingeschreven is, wie nog moet bevestigen en wie zich uitschreef.</li>
</ul>
<p>Het aantal abonnees op het overzicht en op het tabblad Abonnees komt uit dezelfde telling: enkel wie ingeschreven is en zich niet uitschreef, en geen adres dat terugkwam of een klacht gaf. Dat zijn ook de mensen die je campagnes krijgen.</p>

<h2>Een campagne maken</h2>$html$)
 where doc_level = 'tenant'
   and slug = 'emailcampagnes'
   and position('<h2>Wat vind je waar?</h2>' in content) = 0
   and position(E'\n<h2>Een campagne maken</h2>' in content) > 0;

update public.doc_articles
   set content = replace(content,
         ' Heb je geen logo, dan staat de naam van je winkel er in tekst.</p>',
         ' Stond je logo er al voordat SellQo die versie maakte, dan wordt ze vanzelf gemaakt zodra je als beheerder <strong>Marketing</strong> of <strong>Instellingen</strong> opent. Lukt dat niet, klik dan bij je logo op <strong>Mailversie maken van je huidige logo</strong>. Heb je geen logo, dan staat de naam van je winkel er in tekst.</p>')
 where doc_level = 'tenant'
   and slug = 'emailcampagnes'
   and position('Mailversie maken van je huidige logo' in content) = 0
   and position(' Heb je geen logo, dan staat de naam van je winkel er in tekst.</p>' in content) > 0;

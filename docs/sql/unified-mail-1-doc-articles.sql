-- UNIFIED-MAIL-1 — helpartikelen: klantcontact-e-mail (tenant) en contactformulier (platform).
--
-- BEWUST GEEN MIGRATIE in supabase/migrations/: chat-Claude voert dit bestand uit
-- via de connector (duplicaat-les). Idempotent via ON CONFLICT (doc_level, slug).
--
-- Terugdraaien:
--   (1) klantcontact-email-instellen: de vorige inhoud staat in docs/sql/mail-contact-1-doc-article.sql
--       en is live bijgewerkt op 18-09 (MAIL-SENDER-1) — neem vóór het draaien een snapshot:
--       SELECT content, excerpt FROM public.doc_articles WHERE doc_level='tenant' AND slug='klantcontact-email-instellen';
--   (2) custom-frontend-contactformulier: UPDATE public.doc_articles SET is_published = false
--       WHERE doc_level = 'platform' AND slug = 'custom-frontend-contactformulier';

-- (1) Tenant — Klantcontact-e-mail instellen (categorie Communicatie)
INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings?section=inbound-email',
  'Klantcontact-e-mail instellen',
  'klantcontact-email-instellen',
  'Standaard komen antwoorden van klanten en contactformulieren in je SellQo-inbox. Een eigen adres kan, als bewuste keuze.',
  $html$<h2>Klantcontact-e-mail</h2>
<p>Elke mail die SellQo namens je winkel naar een klant stuurt — orderbevestigingen, facturen, offertes, retouren, cadeaukaarten en nieuwsbrieven — komt van het SellQo-adres van je winkel: <em>jouwwinkel@mail.sellqo.app</em>. Antwoordt een klant op zo'n mail, dan gaat dat antwoord naar het klantcontactadres dat je hier kiest.</p>

<h3>Twee keuzes</h3>
<ul>
<li><strong>Mijn SellQo-inbox (aanbevolen)</strong> — dit is de standaard. Antwoorden van klanten komen in je inbox in SellQo, naast je andere berichten, en je beantwoordt ze daar.</li>
<li><strong>Eigen adres</strong> — antwoorden gaan naar een e-mailadres dat je zelf invult, bijvoorbeeld <em>info@jouwwinkel.be</em>. Ze komen dan <strong>niet</strong> in je SellQo-inbox.</li>
</ul>

<h3>Contactformulieren</h3>
<p>Berichten via het contactformulier van je webshop komen altijd in je SellQo-inbox, ook als je een eigen adres kiest.</p>

<h3>Meldingsmail bij een nieuw bericht</h3>
<p>Komt er een bericht binnen in SellQo, dan krijg je een meldingsmail met de afzender, het begin van het bericht en een knop <strong>Bericht openen</strong>. Beantwoord het bericht in SellQo: antwoorden op de meldingsmail zelf komen niet bij je klant. Die meldingsmail blijft komen, ook met een eigen klantcontactadres.</p>

<h3>Instellen</h3>
<ol>
<li>Ga naar <strong>Instellingen &rarr; Email Inbox</strong>.</li>
<li>Kies bovenaan bij <strong>Klantcontact-e-mail</strong> voor <strong>Mijn SellQo-inbox</strong> of <strong>Eigen adres</strong>, en vul bij een eigen adres het e-mailadres in.</li>
<li>Klik op <strong>Opslaan</strong>.</li>
</ol>

<h3>Wie kan dit wijzigen?</h3>
<p>Alleen een beheerder van de winkel kan dit adres aanpassen.</p>

<h3>Niet hetzelfde als je meldingsadres</h3>
<p>Bij <strong>Instellingen &rarr; Winkel Notificaties</strong> kies je naar welk adres de meldingsmails gaan, zoals die van een nieuwe bestelling of een nieuw bericht. Dat adres zien je klanten nooit.</p>$html$,
  3
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id  = EXCLUDED.category_id,
  sort_order   = EXCLUDED.sort_order;

-- (2) Platform — contactformulier in een custom frontend (categorie Custom Frontend Gids)
INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'platform',
  'b0000001-0000-0000-0000-000000000002',
  NULL,
  'Contactformulier in een custom frontend',
  'custom-frontend-contactformulier',
  'Een contactformulier roept altijd storefront-api submit_contact_form aan; het bericht landt in de SellQo-inbox van de winkel.',
  $html$<h2>Contactformulier: altijd via <code>submit_contact_form</code></h2>
<p>Een contactformulier in een custom frontend stuurt het bericht naar <code>storefront-api</code> met de actie <code>submit_contact_form</code>. Het bericht landt in de inbox van de winkel in SellQo, en de winkel krijgt een meldingsmail. Geen <code>mailto:</code>, geen eigen mailfunctie, geen externe formulierdienst.</p>

<h3>Request</h3>
<pre><code>POST /functions/v1/storefront-api
{
  "action": "submit_contact_form",
  "tenant_id": "&lt;tenant-uuid&gt;",
  "params": {
    "name": "Cissy Janssen",
    "email": "cissy@voorbeeld.be",
    "subject": "Vraag over levering",
    "message": "Wanneer is dit weer leverbaar?",
    "orderNumber": "#1042"
  }
}</code></pre>
<ul>
<li><code>name</code> — verplicht, max. 200 tekens.</li>
<li><code>email</code> — verplicht, geldig adres, max. 320 tekens.</li>
<li><code>subject</code> — verplicht, max. 300 tekens.</li>
<li><code>message</code> — verplicht, max. 5000 tekens.</li>
<li><code>orderNumber</code> (of <code>order_number</code>) — optioneel, max. 50 tekens.</li>
</ul>

<h3>Response</h3>
<p>Gelukt (HTTP 200):</p>
<pre><code>{ "success": true, "data": { "success": true, "message_id": "&lt;uuid&gt;" } }</code></pre>
<p>Validatiefout (óók HTTP 200 — controleer <code>data.success</code>):</p>
<pre><code>{ "success": true, "data": { "success": false, "error": "Subject is required (max 300 chars)" } }</code></pre>
<p>Te veel aanvragen (HTTP 429): maximaal 5 berichten per 10 minuten per IP-adres per winkel.</p>
<pre><code>{ "success": false, "error": { "code": "RATE_LIMITED", "message": "…" } }</code></pre>
<p>Toon de gebruiker bij een fout een melding en laat het formulier ingevuld staan.</p>

<h3>Contactadres tonen</h3>
<p>Wil je een e-mailadres op de site tonen, gebruik dan <code>get_config</code> &rarr; <code>contact.email</code>. Dat is het klantcontactadres van de winkel: haar SellQo-inbox, tenzij ze bewust een eigen adres instelde. Nooit een eigenaar- of info@-adres hardcoden.</p>

<h3>Tijdelijke aliassen</h3>
<p><code>submit_contact</code> en <code>contact</code> worden tijdelijk ook geaccepteerd, omdat drie bestaande frontends die stuurden en daardoor nooit een bericht afleverden. Gebruik ze niet in nieuwe code: ze verdwijnen zodra die frontends zijn overgestapt.</p>

<h3>Proxy-valkuil</h3>
<p>Veel frontends praten via een eigen proxy met <code>storefront-api</code>. Een ontbrekende regel voor <code>/contact</code> valt daar vaak terug op een samengestelde actienaam die niet bestaat. Test het formulier tegen de echte API en kijk of het bericht in de inbox verschijnt.</p>$html$,
  4
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id  = EXCLUDED.category_id,
  sort_order   = EXCLUDED.sort_order;

-- Controle
SELECT doc_level, slug, length(content) AS lengte, updated_at FROM public.doc_articles
WHERE (doc_level, slug) IN (('tenant','klantcontact-email-instellen'), ('platform','custom-frontend-contactformulier'));

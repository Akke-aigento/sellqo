-- MAIL-SENDER-1 — helpartikel "Klantcontact-e-mail instellen" bijwerken.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector (zoals
-- mail-contact-1-doc-article.sql). Idempotent via ON CONFLICT (doc_level, slug).
-- Rij: 9e095c6d-9125-462a-9548-6fee8210e3d1.

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings?section=inbound-email',
  'Klantcontact-e-mail instellen',
  'klantcontact-email-instellen',
  'Kies waar antwoorden van klanten terechtkomen: in je SellQo-inbox of op je eigen e-mailadres.',
  $html$<h2>Klantcontact-e-mail</h2>
<p>Elke mail die SellQo namens je winkel naar een klant stuurt — orderbevestigingen, facturen, offertes, retouren, cadeaukaarten en nieuwsbrieven — komt van het SellQo-adres van je winkel: <em>jouwwinkel@mail.sellqo.app</em>. Antwoordt een klant op zo'n mail, dan gaat dat antwoord naar het klantcontactadres dat je hier kiest.</p>

<h3>Twee keuzes</h3>
<ul>
<li><strong>Mijn SellQo-inbox</strong> — antwoorden van klanten komen in je inbox in SellQo, naast je andere berichten. Je krijgt er ook een melding van.</li>
<li><strong>Eigen adres</strong> — antwoorden gaan naar een e-mailadres dat je zelf invult, bijvoorbeeld <em>info@jouwwinkel.be</em>, buiten SellQo om.</li>
</ul>

<h3>Instellen</h3>
<ol>
<li>Ga naar <strong>Instellingen &rarr; Email Inbox</strong>.</li>
<li>Kies bovenaan bij <strong>Klantcontact-e-mail</strong> voor <strong>Mijn SellQo-inbox</strong> of <strong>Eigen adres</strong>, en vul bij een eigen adres het e-mailadres in.</li>
<li>Klik op <strong>Opslaan</strong>.</li>
</ol>

<h3>Wie kan dit wijzigen?</h3>
<p>Alleen een beheerder van de winkel kan dit adres aanpassen.</p>

<h3>Niet hetzelfde als je meldingsadres</h3>
<p>Bij <strong>Instellingen &rarr; Winkel Notificaties</strong> kun je een ander adres kiezen voor je eigen meldingen, zoals een nieuwe bestelling. Dat adres zien je klanten nooit.</p>$html$,
  3
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id  = EXCLUDED.category_id,
  sort_order   = EXCLUDED.sort_order;

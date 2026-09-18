-- MAIL-CONTACT-1 — helpartikel "Klantcontact-e-mail instellen".
--
-- BEWUST GEEN MIGRATIE in supabase/migrations/: Lovable voert dit bestand uit en
-- schrijft daarbij zijn eigen migratie. Een tweede kopie ernaast zou dubbel
-- draaien (duplicaat-les).
--
-- Categorie Communicatie (a0000001-…-0007), naast "Inbox gebruiken" en
-- "Notificaties instellen". Idempotent via ON CONFLICT (doc_level, slug).
--
-- Terugdraaien: UPDATE public.doc_articles SET is_published = false
--               WHERE doc_level = 'tenant' AND slug = 'klantcontact-email-instellen';

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings?section=inbound-email',
  'Klantcontact-e-mail instellen',
  'klantcontact-email-instellen',
  'Kies het e-mailadres dat je klanten zien in orderbevestigingen, facturen en nieuwsbrieven, en waar hun antwoorden naartoe gaan.',
  $html$<h2>Klantcontact-e-mail</h2>
<p>Elke mail die SellQo namens je winkel naar een klant stuurt — orderbevestigingen, facturen, offertes, retouren, cadeaukaarten en nieuwsbrieven — vermeldt één contactadres. Antwoordt een klant op zo'n mail, dan komt dat antwoord op dit adres binnen.</p>

<h3>Instellen</h3>
<ol>
<li>Ga naar <strong>Instellingen &rarr; Email Inbox</strong>.</li>
<li>Vul bovenaan bij <strong>Klantcontact-e-mail</strong> het adres in dat je klanten mogen zien, bijvoorbeeld <em>info@jouwwinkel.be</em>.</li>
<li>Klik op <strong>Opslaan</strong>.</li>
</ol>
<p>Laat je het veld leeg, dan gebruiken we het e-mailadres van de eigenaar van de winkel.</p>

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

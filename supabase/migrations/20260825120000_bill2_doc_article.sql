-- BILL-2 — doc-artikel over het btw-regime op abonnementsfacturen.
--
-- Abonnementsfacturen namen de B2B-status en het btw-regime van de klant niet over:
-- invoices.is_b2b bleef op de default false staan en vat_regime op 'domestic_standard'.
-- Dit artikel legt aan de tenant uit wat er verandert en wat hij zelf moet controleren.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien:
--   DELETE FROM public.doc_articles WHERE doc_level = 'tenant' AND slug = 'btw-op-abonnementsfacturen';
--
-- CATEGORIEKEUZE — geverifieerd tegen de live doc_categories door Akke.
-- Tenant: Facturatie & Boekhouding (a0000001-0000-0000-0000-000000000009, slug
-- 'facturatie'). Daar staan de fiscale buren al: "Hoe wordt de btw berekend?",
-- "Peppol-facturatie" en "Facturen aanmaken".
-- NIET 'Betalingen' (…003): die categorie gaat over betaalmethoden en hun setup,
-- niet over de btw-behandeling op een factuur. Deze categorie is niet in de repo
-- geseed — 20260212104235_337079f9-….sql:111 kent er acht, tot en met …008 — dus
-- ze is buiten de migraties om aangemaakt en alleen live verifieerbaar.
--
-- CONTEXT_PATH: /admin/orders/subscriptions, geverifieerd tegen src/App.tsx:221
-- (<Route path="orders/subscriptions" ...> binnen <Route path="/admin">).

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000009',
  '/admin/orders/subscriptions',
  'BTW op abonnementsfacturen',
  'btw-op-abonnementsfacturen',
  'Hoe het btw-regime van je klant op een abonnementsfactuur terechtkomt, wanneer de btw verlegd wordt en wat je zelf moet invullen.',
  '<p>Facturen die uit een abonnement ontstaan, bepalen hun btw-behandeling voortaan op dezelfde manier als de facturen uit je webshop. Daarvoor werd elke abonnee als particulier behandeld, ook als het om een zakelijke klant met een geldig Europees btw-nummer ging.</p>
<h3>Wat er nu gebeurt</h3>
<ul>
<li>Staat de klant in je klantenbestand als <strong>zakelijk</strong>, dan wordt dat ook zo op de factuur vastgelegd.</li>
<li>Heeft die klant een <strong>geldig btw-nummer uit een ander EU-land</strong>, dan wordt de btw verlegd: er staat 0% btw op de factuur, met de wettelijk verplichte vermelding erbij.</li>
<li>Is de klant in <strong>hetzelfde land</strong> gevestigd als jij, dan verandert er niets — een Belgische zakelijke klant betaalt gewoon Belgische btw.</li>
<li>Verlaagde tarieven die je zelf op een abonnementsregel hebt ingesteld, zoals 6% of 12%, blijven staan.</li>
</ul>
<h3>Wat je zelf moet controleren</h3>
<p>De btw-behandeling volgt uit de gegevens van de klant. Klopt daar iets niet, dan klopt de factuur ook niet:</p>
<ul>
<li><strong>Klanttype</strong> — staat de klant op zakelijk? Een zakelijke klant die als particulier geregistreerd staat, krijgt gewoon binnenlandse btw.</li>
<li><strong>BTW-nummer</strong> — is het ingevuld en klopt het? Het nummer wordt bij het aanmaken van de factuur gecontroleerd bij de Europese VIES-databank. Wordt het daar afgekeurd of is de dienst tijdelijk onbereikbaar, dan valt de factuur terug op binnenlandse btw. Dat is bewust: liever btw aanrekenen die achteraf verrekend wordt dan een verlegging die niet standhoudt.</li>
<li><strong>Land van de klant</strong> — het factuuradres bepaalt welk regime geldt.</li>
</ul>
<h3>Facturen van vóór deze wijziging</h3>
<p>Bestaande abonnementsfacturen worden niet automatisch aangepast. Facturen die al verstuurd of betaald zijn, blijven staan zoals ze zijn; een correctie daarop verloopt via een creditnota of een nieuwe factuur. Neem contact op als je wilt weten welke van je facturen het betreft.</p>
<h3>Abonnementen die vooraf worden geïncasseerd</h3>
<p>Wordt een abonnement eerst afgerekend en pas daarna gefactureerd, dan blijft het bedrag op de factuur altijd gelijk aan wat er daadwerkelijk is geïncasseerd. Wijkt het btw-regime van de klant af van wat er is afgerekend, dan houdt de factuur het feitelijk aangerekende tarief aan en wordt de afwijking apart vastgelegd, zodat je boekhouder er een correctie op kan maken.</p>',
  70
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id  = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title        = EXCLUDED.title,
    excerpt      = EXCLUDED.excerpt,
    content      = EXCLUDED.content,
    sort_order   = EXCLUDED.sort_order;

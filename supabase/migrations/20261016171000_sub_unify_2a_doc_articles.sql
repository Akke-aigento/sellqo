-- SUB-UNIFY-2A — helpartikels abonnement (tenant, /admin/billing): opzeggen en Free kiezen gaan
-- in op het einde van de betaalde periode; opzegging ongedaan maken. — 16 oktober 2026
-- NOG NIET GEDRAAID. Pas draaien na de deploy van sync-tenant-plan en de publish van sellqo.app
-- (zie docs/prepared/SUB-UNIFY-2A-deploy.md).
--
-- Basis: de LIVE content van 16-10-2026 (query_database, base64 byte-exact nagerekend):
--   abonnement-en-betaalwijze-beheren  md5 a1aa081d58a116a0dd3c4ec02816e87d  → nieuw 9639747fd91bc35a5a4468bd704252fc
--     + één <li> "Opzeggen of Free kiezen" in de spelregels-lijst
--     + een sectie <h2>Opzeggen en heractiveren</h2> vóór "Betaalwijze later wijzigen"
--     + excerpt vermeldt opzeggen, tag 'opzeggen' erbij
--   abonnement-beheren                 md5 b02fa70407b4bff346f1f4203dad7abc  → nieuw 33ba21649b0d121d159b93a76da328a1
--     + de onjuiste zin "Wijzigingen gaan direct in." vervangen door de echte regels
-- Al de rest (titel, categorie, context_path, sort_order, overige tekst) blijft byte-exact zoals live.
--
-- Guard: overschrijft alleen een rij waarvan de content nog de live- of deze versie is. Iemand het
-- artikel intussen met de hand bijgewerkt: 0 rijen, opnieuw baseren op live.
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE met een VASTE updated_at.
-- Handmatig terugdraaien: snapshot vóór het draaien
--   (create table snapshots.sellqo_20261016_doc_articles_su2a as select * from public.doc_articles
--    where doc_level='tenant' and slug in ('abonnement-en-betaalwijze-beheren','abonnement-beheren');)
-- en zet daarna content/excerpt/tags/updated_at terug uit die snapshot.
-- Natrek: select slug, md5(content) from public.doc_articles where doc_level='tenant'
--   and slug in ('abonnement-en-betaalwijze-beheren','abonnement-beheren');
--   verwacht 9639747fd91bc35a5a4468bd704252fc en 33ba21649b0d121d159b93a76da328a1

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order, updated_at)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-00000000000e',
  '/admin/billing',
  'Abonnement en betaalwijze beheren',
  'abonnement-en-betaalwijze-beheren',
  'Kies je plan, stel je betaalwijze in en zie hoe een upgrade (pro rata, eerst betalen), een downgrade en opzeggen (op de periodegrens) precies werken.',
  '<h2>Plan kiezen</h2><p>Ga naar <strong>Instellingen → Abonnement</strong>. Kies maand- of jaarfacturatie en klik op het plan dat je wilt. Je krijgt eerst een bevestiging met het periodetarief (excl. btw) en de spelregels:</p><ul><li><strong>Upgrade</strong>: gaat in zodra hij betaald is. Je betaalt enkel het verschil voor de dagen die nog resteren in je lopende periode — nooit een volle nieuwe maand of jaar.</li><li><strong>Downgrade</strong>: je houdt je huidige plan tot het einde van de periode, daarna gaat het nieuwe plan in.</li><li><strong>Opzeggen of Free kiezen</strong>: je houdt je huidige plan tot het einde van de periode waarvoor je al betaalde, daarna ga je naar Free.</li></ul><h2>Hoe een upgrade precies wordt gerekend</h2><p>We nemen het verschil tussen je nieuwe en je huidige periodeprijs en rekenen daarvan alleen de resterende dagen. Voorbeeld: zit je op een plan van € 2 per maand en ga je naar € 5 per maand met nog 15 van 31 dagen te gaan, dan betaal je € 1,45 excl. btw (€ 1,75 incl. 21%). Wat je voor de lopende periode al betaalde, blijft gewoon staan.</p><p>Wissel je tegelijk van maand naar jaar (of omgekeerd), dan start je nieuwe periode vandaag en krijg je de ongebruikte dagen van je oude periode in mindering.</p><h2>Betaalwijze instellen (zelfde stap)</h2><p>Heb je nog geen betaalwijze, dan vraagt dezelfde wizard er direct om — met het gekozen bedrag in beeld. Je kiest tussen:</p><ul><li><strong>Automatische incasso</strong>: je gaat meteen door naar de machtigingspagina. Daar zie je precies waarvoor en voor welk bedrag je machtigt. Zodra je de machtiging ondertekent, kom je automatisch terug op je abonnementspagina en wordt je plan vanzelf geactiveerd. Bij een upgrade wordt het pro-rata-bedrag dan direct geïncasseerd en gaat je nieuwe plan meteen in.</li><li><strong>Betalingsverzoek per periode</strong>: je ontvangt elke periode een betalingsverzoek en betaalt zelf.</li></ul><p>Ging er onderweg iets mis (machtiging gezet, plan nog niet actief)? Bovenaan de abonnementspagina staat dan een melding waarmee je in één klik afrondt.</p><h2>Upgrade die op betaling wacht</h2><p>Betaal je per betalingsverzoek (of lukte de incasso niet), dan sturen we je een betalingsverzoek voor het pro-rata-bedrag. Op je abonnementspagina staat dan bovenaan <strong>"Je upgrade wacht op betaling"</strong> met:</p><ul><li>een knop <strong>Nu betalen</strong> die je naar de betaallink brengt;</li><li>een knop <strong>Upgrade annuleren</strong>, die je kunt gebruiken zolang je nog niet betaald hebt.</li></ul><p>Zolang die upgrade openstaat, kun je geen tweede planwissel starten. Betaal je niet binnen 7 dagen, dan vervalt de aanvraag automatisch en blijf je op je huidige plan — je kunt daarna gewoon opnieuw upgraden. Zodra de betaling binnen is, gaat je nieuwe plan direct in en krijg je de factuur.</p><h2>Opzeggen en heractiveren</h2><p>Kies je onder <strong>Instellingen → Abonnement</strong> het plan Free, dan zeg je je betaalde abonnement op. Je houdt je huidige plan en al zijn functies tot het einde van de periode waarvoor je al betaalde. Bovenaan de pagina staat dan <strong>"Je abonnement loopt af op …"</strong> met de einddatum. Na die datum staat je winkel op Free en krijg je daarvan een melding.</p><p>Bedenk je je? Zolang de einddatum niet voorbij is, klik je in die melding op <strong>Heractiveer abonnement</strong>. Je abonnement loopt dan gewoon door op hetzelfde plan, zonder extra kosten. Kies je in plaats daarvan een ander betaald plan, dan vervalt de opzegging ook en gelden de gewone regels voor een upgrade of downgrade.</p><p>Zit je nog in je proefperiode, of loopt er geen betaalde periode, dan ga je meteen naar Free: er is dan niets betaald om uit te dienen.</p><p>Na de einddatum kun je op elk moment opnieuw een betaald plan kiezen.</p><h2>Betaalwijze later wijzigen</h2><p>Zodra je een abonnement of betaalwijze hebt, zie je op de abonnementspagina een blok met je huidige betaalwijze (incasso actief of in verwerking, of betalingsverzoek). Klik je daar op wijzigen of instellen, dan ga je direct naar de machtigingspagina.</p><h2>Goed om te weten</h2><ul><li>Beschikbaar vanaf elk abonnement, inclusief Free (upgraden naar een betaald plan vereist een betaalwijze).</li><li><strong>Enterprise</strong> regel je via ons: neem contact op.</li><li>Een downgrade volledig stopzetten doe je via support.</li></ul><h2>Je facturen en documenten</h2><p>Onderaan de abonnementspagina vind je al je SellQo-documenten:</p><ul><li><strong>Facturen</strong>: nummer, datum, bedrag en status. Klik op het download-icoon voor de PDF. Standaard zie je de tien meest recente facturen; met "Toon oudere facturen" krijg je de volledige lijst.</li><li><strong>Creditnota''s</strong>: terugbetalingen of correcties, met verwijzing naar de oorspronkelijke factuur. Is een factuur gecrediteerd, dan zie je dat ook bij die factuur staan.</li><li><strong>Open betalingsverzoeken</strong>: staan bovenaan zolang ze niet betaald zijn, met een knop <strong>Betalen</strong> en de PDF van het verzoek.</li></ul><p>Downloadlinks zijn persoonlijk en tijdelijk geldig — deel ze niet, download het bestand liever opnieuw.</p><p>Beschikbaar vanaf elk abonnement, inclusief Free.</p>',
  ARRAY['abonnement','betaalwijze','facturen','creditnota','betalingsverzoek','download','opzeggen'],
  0,
  '2026-10-16 17:00:00+00'
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at
WHERE md5(public.doc_articles.content) IN (
  'a1aa081d58a116a0dd3c4ec02816e87d',
  '9639747fd91bc35a5a4468bd704252fc'
);

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order, updated_at)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-00000000000e',
  '/admin/billing',
  'Je abonnement beheren',
  'abonnement-beheren',
  'Plannen vergelijken, upgraden en je facturen van SellQo bekijken.',
  '<h2>Je SellQo-abonnement</h2><p>Onder <strong>Abonnement</strong> beheer je je plan en zie je je facturen van SellQo.</p><h3>De plannen</h3><ul><li><strong>Free</strong> — €0/maand: tot 25 producten, 1 gebruiker, de basis om te starten</li><li><strong>Starter</strong> — €29/maand: 250 producten, 3 gebruikers, eigen domein, AI-copywriting, e-mailmarketing, webhooks en API</li><li><strong>Pro</strong> — €79/maand: 2.500 producten, 10 gebruikers, Bol.com, POS, loyaliteit, Peppol, Odoo-koppeling, AI-chatbot en Business Coach, visuele editor</li><li><strong>Enterprise</strong> — €199/maand: onbeperkt producten, 50 gebruikers, Amazon &amp; eBay, white-label</li></ul><h3>Upgraden of downgraden</h3><p>Een upgrade gaat in zodra hij betaald is. Een downgrade, opzeggen of Free kiezen gaat in op het einde van de periode waarvoor je al betaalde; tot dan houd je je huidige plan. Elk plan heeft ook een maandelijks inbegrepen transactievolume — daarboven geldt een kleine vergoeding per transactie.</p><h3>Betaling</h3><p>Je betaalt via SEPA-domiciliëring of kaart. Je facturen vind je terug op dezelfde pagina.</p>',
  ARRAY['abonnement','upgrade','plannen','facturen'],
  1,
  '2026-10-16 17:00:00+00'
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at
WHERE md5(public.doc_articles.content) IN (
  'b02fa70407b4bff346f1f4203dad7abc',
  '33ba21649b0d121d159b93a76da328a1'
);

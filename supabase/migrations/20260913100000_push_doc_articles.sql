-- PUSH-1 — twee bestaande doc-artikelen rechtzetten.
--
-- WAAROM BIJWERKEN EN NIET TOEVOEGEN. Beide artikelen bestonden al, en allebei
-- beweerden ze iets dat niet klopte:
--
--  1. 'meldingen-aanzetten-in-de-app' beloofde: "Met pushmeldingen krijg je
--     nieuwe bestellingen, berichten en waarschuwingen direct op je telefoon."
--     Dat heeft tot 13 september 2026 nooit gewerkt. send-push-notification
--     stopt op tenant_notification_settings.push_enabled, en die kolom stond voor
--     elke rij op false zonder dat er in de app een schakelaar voor bestond.
--
--     Erger: de probleemoplossing stuurde tenants naar hun telefooninstellingen,
--     "Niet storen" en het juiste account. Wie dat volgde zocht op de verkeerde
--     plek — de oorzaak zat server-side, en geen enkele telefooninstelling kon
--     het verhelpen.
--
--  2. 'notificaties-instellen' zei: "Teamleden beheren hun eigen
--     notificatievoorkeuren." Ook dat klopt niet. De instellingen staan in
--     tenant_notification_settings, met een UNIQUE op (tenant_id, category,
--     notification_type) en zonder user_id. Wie push aanzet voor bestellingen,
--     zet het aan voor het hele team. Dat moet een tenant weten vóór hij de
--     schakelaar omzet.
--
--  3. Beide noemden de plek "Instellingen → Meldingen". In het menu heet die
--     sectie "Winkel Notificaties" (settings.sections.shop_notifications) — wie de
--     instructie letterlijk volgde, vond hem niet. Nagetrokken in nl.json.
--
-- Twee artikelen over hetzelfde onderwerp is al veel; een derde ernaast zou de
-- AI-helpchat met tegenstrijdige bronnen voeden.
--
-- Categorie en context_path blijven wat ze waren (Communicatie, …0007).
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien: er is geen oude versie om naar terug te gaan die klopt.
-- Wie toch wil, haalt de vorige content uit git (deze migratie vervangt hem).

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings/notifications',
  'Pushmeldingen op je telefoon',
  'meldingen-aanzetten-in-de-app',
  'Zo krijg je nieuwe bestellingen en berichten als melding op je telefoon, en wat je doet als er niets binnenkomt.',
  $html$<h2>Pushmeldingen op je telefoon</h2>
<p>Met pushmeldingen krijg je een seintje op je telefoon, ook als de SellQo-app niet open staat. Ze werken alleen in de SellQo-app — in de browser niet.</p>

<h3>Twee dingen moeten aan staan</h3>
<p>Een pushmelding komt pas binnen als <strong>beide</strong> in orde zijn.</p>
<ol>
<li><strong>In SellQo: push aanzetten per soort melding.</strong> Ga naar <strong>Instellingen &rarr; Winkel Notificaties</strong>. Elke soort melding heeft drie schakelaars: in de app, e-mail en push. <strong>Push staat voor elke soort standaard uit</strong> — je kiest zelf wat je op je telefoon wilt. Klap een categorie open, of gebruik de schakelaar bovenaan om een hele categorie in één keer aan te zetten.</li>
<li><strong>Op je telefoon: meldingen van SellQo toestaan.</strong> Heb je bij de eerste keer opstarten op <strong>Niet toestaan</strong> getikt, dan vraagt je telefoon het niet opnieuw. De app toont dan bovenaan <strong>Meldingen staan uit</strong>. Zet het zelf aan:
<ul>
<li><strong>iPhone / iPad:</strong> Instellingen &rarr; Winkel Notificaties &rarr; SellQo &rarr; Meldingen toestaan</li>
<li><strong>Android:</strong> Instellingen &rarr; Apps &rarr; SellQo &rarr; Meldingen</li>
</ul>
Sluit de app daarna volledig af en open hem opnieuw.</li>
</ol>

<h3>Let op: dit geldt voor je hele team</h3>
<p>De meldingsinstellingen horen bij je winkel, niet bij één persoon. Zet je push aan voor nieuwe bestellingen, dan krijgt <strong>iedereen met toegang tot je winkel</strong> die melding op zijn telefoon — mits zijn telefoon meldingen toestaat. Heb je teamleden die niet elke bestelling hoeven te zien, overleg dan eerst welke soorten je aanzet.</p>

<h3>Beheer je meerdere winkels?</h3>
<p>Heb je met één account toegang tot meer dan één winkel, dan krijg je meldingen van al die winkels op dezelfde telefoon. De naam van de winkel staat dan vóór de melding, bijvoorbeeld <em>Winkelnaam &middot; Nieuwe bestelling</em>. Wie maar één winkel beheert, ziet die naam niet.</p>

<h3>Een melding aantikken</h3>
<p>Tik je een melding aan, dan opent de app meteen het bijbehorende scherm — bijvoorbeeld de bestelling. Hoort de melding bij een andere winkel dan die je open had, dan wisselt de app eerst naar die winkel.</p>

<h3>Er komt niets binnen?</h3>
<p>Loop dit na, in deze volgorde:</p>
<ol>
<li><strong>Staat push aan voor die soort melding?</strong> Dat is de meest voorkomende oorzaak, want push start voor elke soort uit. Controleer het in Instellingen &rarr; Winkel Notificaties.</li>
<li><strong>Staat de melding bovenaan de app: "Meldingen staan uit"?</strong> Dan blokkeert je telefoon ze — zie stap 2 hierboven.</li>
<li>Staat <strong>Niet storen</strong> of een focusstand aan op je telefoon?</li>
<li>Ben je in de app ingelogd met hetzelfde account als waarmee je in SellQo werkt?</li>
</ol>$html$,
  0
),
(
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/notifications',
  'Notificaties instellen',
  'notificaties-instellen',
  'Kies waarover je meldingen krijgt en via welk kanaal: in de app, per e-mail of als pushmelding op je telefoon.',
  $html$<h2>Notificaties</h2>
<p>Via <strong>Instellingen &rarr; Winkel Notificaties</strong> bepaal je waarover je meldingen krijgt — nieuwe bestellingen, retouren, lage voorraad, nieuwe berichten en meer — en langs welke weg.</p>

<h3>Drie kanalen</h3>
<ul>
<li><strong>In de app:</strong> verschijnt onder het belletje rechtsboven.</li>
<li><strong>E-mail:</strong> gaat naar het adres dat je bij de meldingsinstellingen hebt gekozen.</li>
<li><strong>Push:</strong> een melding op je telefoon, alleen in de SellQo-app. Staat voor elke soort standaard uit. Zie het artikel over pushmeldingen.</li>
</ul>
<p>Per soort melding zet je elk kanaal apart aan of uit. Met de schakelaar bovenaan een categorie zet je een kanaal voor de hele categorie in één keer om.</p>

<h3>Voor je hele team</h3>
<p>De instellingen gelden voor je winkel als geheel, niet per teamlid. Wat je hier aanzet, geldt voor iedereen met toegang tot je winkel.</p>$html$,
  2
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id  = EXCLUDED.category_id,
  sort_order   = EXCLUDED.sort_order;

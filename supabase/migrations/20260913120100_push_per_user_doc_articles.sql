-- PUSH-2 — de twee helpartikelen uit PUSH-1 opnieuw bijwerken.
--
-- WAAROM. Push staat sinds PUSH-2 per gebruiker, in Instellingen → Mijn
-- meldingen, en niet meer per winkel in Winkel Notificaties. Beide artikelen
-- zeiden nog dat push voor het hele team geldt en stuurden naar de oude plek.
--
-- EEN FOUT UIT PUSH-1 MEE. Het telefoonpad voor iPhone luidde live
-- "Instellingen → Winkel Notificaties → SellQo". Dat menu bestaat op een
-- iPhone niet; bij het vervangen van "Instellingen → Meldingen" door de
-- SellQo-menunaam is dat iOS-pad onterecht meegegaan. Nagetrokken in de live
-- rij op 13 sep 2026. Het juiste pad is Instellingen → Meldingen → SellQo.
--
-- Nog steeds bijwerken en niet toevoegen: een derde artikel zou de
-- AI-helpchat met tegenstrijdige bronnen voeden. Categorie, context_path en
-- sort_order blijven wat ze live zijn.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien: 20260913100000_push_doc_articles.sql opnieuw
-- draaien — maar die beschrijft de oude, niet meer bestaande werking.

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

<h3>Push stel je voor jezelf in</h3>
<p>Pushmeldingen gelden per persoon. Wat jij aanzet, komt alleen op <strong>jouw</strong> telefoon binnen. Je teamleden kiezen zelf wat zij willen ontvangen.</p>

<h3>Twee dingen moeten aan staan</h3>
<p>Een pushmelding komt pas binnen als <strong>beide</strong> in orde zijn.</p>
<ol>
<li><strong>In SellQo: push aanzetten per soort melding.</strong> Ga naar <strong>Instellingen &rarr; Mijn meldingen</strong>. Elke soort melding heeft een eigen schakelaar, en <strong>push staat voor elke soort standaard uit</strong>. Klap een categorie open, of gebruik de schakelaar bovenaan om een hele categorie in één keer aan te zetten. Je ziet alleen de categorieën die bij je rol horen.</li>
<li><strong>Op je telefoon: meldingen van SellQo toestaan.</strong> Heb je bij de eerste keer opstarten op <strong>Niet toestaan</strong> getikt, dan vraagt je telefoon het niet opnieuw. De app toont dan bovenaan <strong>Meldingen staan uit</strong>. Zet het zelf aan:
<ul>
<li><strong>iPhone / iPad:</strong> Instellingen &rarr; Meldingen &rarr; SellQo &rarr; Sta meldingen toe</li>
<li><strong>Android:</strong> Instellingen &rarr; Apps &rarr; SellQo &rarr; Meldingen</li>
</ul>
Sluit de app daarna volledig af en open hem opnieuw.</li>
</ol>

<h3>Beheer je meerdere winkels?</h3>
<p>Je instellingen gelden voor de winkel die op dat moment open staat. Wissel van winkel om push voor een andere winkel in te stellen. Krijg je meldingen van meer dan één winkel, dan staat de naam van de winkel vóór de melding, bijvoorbeeld <em>Winkelnaam &middot; Nieuwe bestelling</em>.</p>

<h3>Een melding aantikken</h3>
<p>Tik je een melding aan, dan opent de app meteen het bijbehorende scherm — bijvoorbeeld de bestelling. Hoort de melding bij een andere winkel dan die je open had, dan wisselt de app eerst naar die winkel.</p>

<h3>Er komt niets binnen?</h3>
<p>Loop dit na, in deze volgorde:</p>
<ol>
<li><strong>Staat push aan voor die soort melding, in de juiste winkel?</strong> Dat is de meest voorkomende oorzaak, want push start voor elke soort uit. Controleer het in Instellingen &rarr; Mijn meldingen, met de winkel open waarvan je meldingen verwacht.</li>
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
<p>SellQo meldt je nieuwe bestellingen, retouren, lage voorraad, nieuwe berichten en meer. Dat kan langs drie wegen, en die stel je op twee plekken in.</p>

<h3>Voor de winkel: in de app en e-mail</h3>
<p>Via <strong>Instellingen &rarr; Winkel Notificaties</strong> bepaal je per soort melding of hij in de app verschijnt en of hij per e-mail verstuurd wordt.</p>
<ul>
<li><strong>In de app:</strong> verschijnt onder het belletje rechtsboven.</li>
<li><strong>E-mail:</strong> gaat naar het adres dat je bij de meldingsinstellingen hebt gekozen.</li>
</ul>
<p>Deze instellingen gelden voor de winkel als geheel. Met de schakelaar bovenaan een categorie zet je een kanaal voor de hele categorie in één keer om.</p>

<h3>Voor jezelf: push op je telefoon</h3>
<p>Pushmeldingen stel je in via <strong>Instellingen &rarr; Mijn meldingen</strong>. Die gelden alleen voor jou: je teamleden kiezen elk zelf wat ze op hun telefoon krijgen. Zie het artikel over pushmeldingen.</p>$html$,
  2
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id  = EXCLUDED.category_id,
  sort_order   = EXCLUDED.sort_order;

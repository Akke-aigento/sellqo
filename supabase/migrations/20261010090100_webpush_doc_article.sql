-- WEBPUSH-1 — helpartikel "Pushmeldingen op je telefoon" bijwerken.
--
-- WAAROM. Het artikel zei "Ze werken alleen in de SellQo-app — in de browser
-- niet." Sinds WEBPUSH-1 kan push ook via de webapp op het beginscherm (voor
-- telefoons waar de app niet op mag, zoals bedrijfstelefoons met MDM).
--
-- Bijwerken en niet toevoegen (zelfde keuze als PUSH-2): een tweede artikel
-- zou de AI-helpchat met tegenstrijdige bronnen voeden. De basis is de live
-- rij zoals nagetrokken op 10 okt 2026 (updated_at 2026-09-18 13:48). Categorie,
-- context_path en sort_order blijven wat ze live zijn.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien: de content van vóór deze migratie staat in de
-- role-audit-entry WEBPUSH-1 beschreven; het enige verschil is de eerste
-- alinea plus de twee secties "Geen app? Gebruik de webapp" en
-- "Dubbele meldingen".

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings/notifications',
  'Pushmeldingen op je telefoon',
  'meldingen-aanzetten-in-de-app',
  'Zo krijg je nieuwe bestellingen en berichten als melding op je telefoon — via de app of de webapp — en wat je doet als er niets binnenkomt.',
  $html$<h2>Pushmeldingen op je telefoon</h2>
<p>Met pushmeldingen krijg je een seintje op je telefoon, ook als SellQo niet open staat. Dat kan via de SellQo-app, of via de webapp op je beginscherm als je de app niet kunt installeren.</p>

<h3>Push stel je voor jezelf in</h3>
<p>Pushmeldingen gelden per persoon. Wat jij uitzet, geldt alleen voor <strong>jouw</strong> telefoon. Je teamleden kiezen zelf wat zij willen ontvangen.</p>

<h3>Push staat standaard aan</h3>
<p>Heb je een rol in een winkel, dan krijg je van die winkel standaard een pushmelding voor elke soort melding die bij je rol hoort. Wil je iets niet, zet het dan uit in <strong>Instellingen &rarr; Mijn meldingen</strong>. Elke soort melding heeft een eigen schakelaar; met de schakelaar bovenaan een categorie zet je een hele categorie in één keer uit. Je ziet alleen de categorieën die bij je rol horen.</p>

<h3>Je telefoon moet meldingen van SellQo toestaan</h3>
<p>Heb je bij de eerste keer opstarten op <strong>Niet toestaan</strong> getikt, dan vraagt je telefoon het niet opnieuw. De app toont dan bovenaan <strong>Meldingen staan uit</strong>. Zet het zelf aan:</p>
<ul>
<li><strong>iPhone / iPad:</strong> Instellingen &rarr; Meldingen &rarr; SellQo &rarr; Sta meldingen toe</li>
<li><strong>Android:</strong> Instellingen &rarr; Apps &rarr; SellQo &rarr; Meldingen</li>
</ul>
<p>Sluit de app daarna volledig af en open hem opnieuw.</p>

<h3>Geen app? Gebruik de webapp</h3>
<p>Mag de SellQo-app niet op je telefoon, bijvoorbeeld op een bedrijfstelefoon, dan kun je meldingen krijgen via de webapp:</p>
<ol>
<li><strong>iPhone / iPad:</strong> open SellQo in <strong>Safari</strong>, tik op <strong>Deel</strong> en kies <strong>Zet op beginscherm</strong>. Open SellQo daarna via dat nieuwe icoon. Meldingen werken op iPhone en iPad alleen vanuit het beginscherm, niet in een gewoon Safari-tabblad.</li>
<li><strong>Android of computer:</strong> open SellQo in je browser. Op Android kun je het ook op je beginscherm zetten via het browsermenu.</li>
<li>Ga naar <strong>Instellingen &rarr; Mijn meldingen</strong> en tik bij <strong>Web-meldingen op dit toestel</strong> op <strong>Meldingen aanzetten</strong>. Sta de meldingen toe als je toestel erom vraagt.</li>
</ol>
<p>Welke meldingen je krijgt, stel je op dezelfde plek in als voor de app.</p>

<h3>Dubbele meldingen</h3>
<p>Onder <strong>Instellingen &rarr; Mijn meldingen &rarr; Mijn toestellen</strong> zie je alle toestellen die jouw meldingen krijgen: de app en de webapp, met wanneer ze voor het laatst actief waren. Een toestel dat je niet meer gebruikt, koppel je daar los.</p>
<p>Staat SellQo op dezelfde telefoon als app <em>én</em> als webapp, dan krijg je alles dubbel. De app heeft dan voorrang: open je de app, dan vraagt SellQo of de webapp op deze telefoon staat en zet hij de web-meldingen uit als je dat bevestigt. Andersom waarschuwt de webapp je als je meldingen aanzet terwijl de app al actief is op een telefoon van hetzelfde type.</p>

<h3>Beheer je meerdere winkels?</h3>
<p>Je instellingen gelden voor de winkel die op dat moment open staat. Wissel van winkel om push voor een andere winkel in te stellen. Krijg je meldingen van meer dan één winkel, dan staat de naam van de winkel vóór de melding, bijvoorbeeld <em>Winkelnaam &middot; Nieuwe bestelling</em>.</p>

<h3>Een melding aantikken</h3>
<p>Tik je een melding aan, dan opent SellQo meteen het bijbehorende scherm — bijvoorbeeld de bestelling. Hoort de melding bij een andere winkel dan die je open had, dan wisselt de app eerst naar die winkel.</p>

<h3>Er komt niets binnen?</h3>
<p>Loop dit na, in deze volgorde:</p>
<ol>
<li><strong>Staat de melding bovenaan de app: "Meldingen staan uit"?</strong> Dan blokkeert je telefoon ze — zie hierboven.</li>
<li><strong>Heb je die soort melding ooit uitgezet?</strong> Controleer het in Instellingen &rarr; Mijn meldingen, met de winkel open waarvan je meldingen verwacht.</li>
<li><strong>Via de webapp:</strong> staat je toestel bij <strong>Mijn toestellen</strong>? Op iPhone en iPad: open je SellQo wel via het icoon op je beginscherm?</li>
<li>Staat <strong>Niet storen</strong> of een focusstand aan op je telefoon?</li>
<li>Ben je ingelogd met hetzelfde account als waarmee je in SellQo werkt?</li>
</ol>$html$,
  0
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  updated_at = now();

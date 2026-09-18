-- PUSH-DEFAULT-1 — helpartikels bijwerken: push staat nu standaard aan,
-- e-mail bij berichten standaard aan met een throttle.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector (zoals
-- mail-sender-1-doc-article.sql). Idempotent via ON CONFLICT (doc_level, slug).
-- Rijen: 45c6db0d-1eaa-474f-a961-d690033809b4 (meldingen-aanzetten-in-de-app),
--        c6488452-9128-4579-aca4-9c91a88a38c2 (notificaties-instellen).
-- category_id, context_path en sort_order blijven wat ze op 18-09 waren.
-- Terugdraaien: de vorige content staat nergens in de repo. Bewaar daarom eerst
-- de snapshot hieronder; terugzetten = dezelfde UPDATE met die content.

SELECT id, slug, title, excerpt, content
FROM public.doc_articles
WHERE id IN ('45c6db0d-1eaa-474f-a961-d690033809b4', 'c6488452-9128-4579-aca4-9c91a88a38c2');

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/settings/notifications',
  'Pushmeldingen op je telefoon',
  'meldingen-aanzetten-in-de-app',
  'Zo krijg je nieuwe bestellingen en berichten als melding op je telefoon, en wat je doet als er niets binnenkomt.',
  $html$<h2>Pushmeldingen op je telefoon</h2>
<p>Met pushmeldingen krijg je een seintje op je telefoon, ook als de SellQo-app niet open staat. Ze werken alleen in de SellQo-app — in de browser niet.</p>

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

<h3>Beheer je meerdere winkels?</h3>
<p>Je instellingen gelden voor de winkel die op dat moment open staat. Wissel van winkel om push voor een andere winkel in te stellen. Krijg je meldingen van meer dan één winkel, dan staat de naam van de winkel vóór de melding, bijvoorbeeld <em>Winkelnaam &middot; Nieuwe bestelling</em>.</p>

<h3>Een melding aantikken</h3>
<p>Tik je een melding aan, dan opent de app meteen het bijbehorende scherm — bijvoorbeeld de bestelling. Hoort de melding bij een andere winkel dan die je open had, dan wisselt de app eerst naar die winkel.</p>

<h3>Er komt niets binnen?</h3>
<p>Loop dit na, in deze volgorde:</p>
<ol>
<li><strong>Staat de melding bovenaan de app: "Meldingen staan uit"?</strong> Dan blokkeert je telefoon ze — zie hierboven.</li>
<li><strong>Heb je die soort melding ooit uitgezet?</strong> Controleer het in Instellingen &rarr; Mijn meldingen, met de winkel open waarvan je meldingen verwacht.</li>
<li>Staat <strong>Niet storen</strong> of een focusstand aan op je telefoon?</li>
<li>Ben je in de app ingelogd met hetzelfde account als waarmee je in SellQo werkt?</li>
</ol>$html$,
  0
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    updated_at = now()
RETURNING id, slug, length(content);

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
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

<h3>Wat standaard aan staat</h3>
<ul>
<li><strong>Berichten van klanten</strong> (e-mail, contactformulier, WhatsApp, Facebook, Instagram, Bol.com) krijg je standaard ook per e-mail. Stuurt dezelfde klant via hetzelfde kanaal meerdere berichten kort na elkaar, dan krijg je hooguit één e-mail per kwartier; in de app en op je telefoon zie je ze wel allemaal.</li>
<li><strong>Andere meldingen</strong> komen standaard niet per e-mail, behalve urgente meldingen (prioriteit hoog of dringend). Wil je die ook niet per e-mail, zet dan e-mail voor die soort melding uit.</li>
</ul>

<h3>Voor jezelf: push op je telefoon</h3>
<p>Pushmeldingen staan standaard aan en stel je in via <strong>Instellingen &rarr; Mijn meldingen</strong>. Die gelden alleen voor jou: je teamleden kiezen elk zelf wat ze op hun telefoon krijgen. Zie het artikel over pushmeldingen.</p>$html$,
  2
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    updated_at = now()
RETURNING id, slug, length(content);

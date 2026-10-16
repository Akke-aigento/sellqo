-- EVENT-DOOR-2 — helpartikel "Tickets scannen aan de deur" bijgewerkt (bestaand artikel).
-- Nieuw: wat de scanner doet bij slecht bereik of zonder verbinding, de wachtrij, en de
-- aparte teksten voor geannuleerde en terugbetaalde tickets.
-- Basis: de live content van 16-10-2026 (updated_at 2026-10-14 09:28), via query_database
-- nagelezen. Categorie (a0000001-...0001), context_path, tags en sort_order blijven zoals live.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE, met een VASTE updated_at zodat een
-- herhaalde run hetzelfde resultaat geeft.
-- Handmatig terugdraaien: snapshot de huidige rij vóór het draaien
--   (create table snapshots.sellqo_20261016_doc_articles as select * from public.doc_articles
--    where doc_level='tenant' and slug='tickets-scannen-aan-de-deur';)
-- en zet daarna content/excerpt/tags/updated_at terug uit die snapshot.

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order, updated_at)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000001',
  '/admin/checkin',
  'Tickets scannen aan de deur',
  'tickets-scannen-aan-de-deur',
  'Scan tickets met je gsm via SellQo Deur, ook zonder account en bij slecht bereik, en zet de scanner op je beginscherm.',
  $html$<h3>Twee manieren om te scannen</h3><ul><li><strong>Je deurploeg, zonder account:</strong> maak op de eventpagina, tabblad <strong>Toegangen</strong>, een scanlink (of laat hem maken bij Nieuw event). Je crew scant de QR-code of opent de link en kan meteen scannen. Ze zien alleen dit event, niets anders van je winkel. Trek je de link in, dan werkt hij meteen niet meer.</li><li><strong>Jij als beheerder:</strong> ga naar <strong>Events → Ticket check-in</strong>, kies het event en scan.</li></ul><h3>Zo werkt de scanner</h3><p>Tik op <strong>Start scannen</strong> en richt de camera op de QR-code van het ticket. Het scherm blijft aan zolang je scant. Terwijl een scan loopt, zie je <strong>Bezig met controleren…</strong>.</p><ul><li><strong>Groen</strong>: welkom, het ticket is ingecheckt.</li><li><strong>Oranje</strong>: al binnen, geen heringang, of een ticket voor een andere datum.</li><li><strong>Rood</strong>: ongeldig ticket. Is het ticket geannuleerd of terugbetaald, dan staat er <strong>Ticket geannuleerd</strong> of <strong>Ticket terugbetaald</strong>.</li><li><strong>Grijs</strong>: geen verbinding. De scan is niet geregistreerd, maar het ticket is ook niet afgekeurd. Zie hieronder.</li></ul><p>Op Android trilt de gsm mee; met de luidsprekerknop zet je het geluid aan of uit. In het donker gebruik je de zaklampknop (als je gsm dat toelaat). Bovenaan zie je hoeveel mensen er binnen zijn van het aantal verkochte tickets.</p><h3>Slecht bereik of geen verbinding</h3><ul><li><strong>Trage verbinding:</strong> krijgt de scanner na 8 seconden geen antwoord, dan probeert hij het zelf nog één keer. Je ziet dan <strong>Trage verbinding, nog één poging…</strong>.</li><li><strong>Volgende gast al gescand?</strong> Scans die binnenkomen terwijl er nog een scan loopt, gaan in een wachtrij en worden daarna één voor één gecontroleerd. Je ziet hoeveel er wachten.</li><li><strong>Geen verbinding:</strong> je krijgt een grijs scherm <strong>Geen verbinding</strong> of <strong>Verbinding te traag</strong>, met de knop <strong>Opnieuw proberen</strong>. Je kan ook gewoon dezelfde QR-code meteen opnieuw scannen. In de lijst met laatste scans staat zo'n scan als <strong>Niet geregistreerd</strong>, met een knop om het opnieuw te proberen.</li><li><strong>Offline:</strong> bovenaan zie je een wifi-icoon. Is je gsm offline, dan staat er een oranje balk <strong>Offline: scans worden niet geregistreerd</strong>. Scans worden niet bewaard om later door te sturen: zoek bereik (of wifi) en probeer opnieuw.</li><li><strong>Kwam je check-in wel aan, maar het antwoord niet?</strong> Scan je hetzelfde ticket binnen 30 seconden opnieuw op dezelfde gsm, dan toont de scanner gewoon <strong>Welkom</strong> in plaats van <strong>Al binnen</strong>. Zie je toch <strong>Al binnen</strong> met een tijdstip van eerder, dan werd het ticket al eerder gescand.</li><li><strong>Teller niet actueel:</strong> lukt het niet om de teller bij te werken, dan kleurt hij oranje met een waarschuwing. Hij loopt weer gelijk zodra de verbinding terug is.</li></ul><h3>Scant een QR-code niet?</h3><p>Tik op <strong>Zoek op naam</strong> en typ een naam, e-mailadres of bestelnummer. Bij het juiste ticket tik je op <strong>Inchecken</strong>. Lukt het zoeken niet door de verbinding, dan zie je <strong>Zoeken mislukt</strong> met een knop om opnieuw te proberen, en niet "geen tickets gevonden".</p><h3>Op je beginscherm</h3><p>Op iPhone: open de scanlink in Safari, tik op Deel en kies <strong>Zet op beginscherm</strong>. Op Android: open het menu van Chrome en kies <strong>Toevoegen aan startscherm</strong> of <strong>App installeren</strong>. Daarna open je de scanner met één tik. Heb je hem toegevoegd vanuit Ticket check-in, dan opent het icoon je event-keuze.</p><p>Een check-in terugdraaien kan alleen de beheerder, in de lijst met laatste scans.</p>$html$,
  ARRAY['scannen', 'check-in', 'deur', 'qr', 'scanner', 'offline', 'verbinding'],
  0,
  '2026-10-16 09:00:00+00'
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at;

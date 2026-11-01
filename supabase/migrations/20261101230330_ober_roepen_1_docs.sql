-- OBER-ROEPEN-1 / RESERVATIE-MELDING-1 — helpartikel "Oproepen van tafels" (tafel-oproepen, /kassa).
-- ON CONFLICT DO NOTHING: een tweede run of een latere handmatige wijziging blijft staan.
-- Categorie a0000001-…-0006 = dezelfde als "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening).
-- PAS DRAAIEN NA 20261101230300_ober_roepen_1.sql, de deploy van storefront-api en horeca-device-push,
-- de publish van de admin én de storefront met de knoppen voor de gast.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'tafel-oproepen';

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published)
values ('tenant', 'a0000001-0000-0000-0000-000000000006', '/kassa', 'tafel-oproepen',
  'Oproepen van tafels: bediening roepen en rekening vragen',
  'Gasten roepen via de QR-code op hun tafel de bediening of vragen de rekening. Je ziet het op de kassa bij Binnenkomend en tikt op Afgehandeld.',
  $c$
<p>Via de QR-code op hun tafel kunnen gasten de bediening roepen of de rekening vragen, zonder te zwaaien. Dat werkt zodra het QR-menu aanstaat (<strong>Bestellen › QR-menu</strong>).</p>

<h2>Wat je ziet op de kassa</h2>
<ul>
  <li>Een oproep komt binnen in de kolom <strong>Binnenkomend</strong> (op een tablet naast het zaalplan, op een gsm onder <strong>Bar</strong>), bovenaan bij <em>Oproepen van tafels</em>.</li>
  <li>Je ziet welke tafel roept en of ze de bediening of de rekening vraagt, en hoelang geleden.</li>
  <li>Ben je langs geweest, tik dan op <strong>Afgehandeld</strong>. De oproep verdwijnt op alle kassa's, en de gast ziet dat ze gezien is.</li>
  <li>Een oproep die na 3 uur nog openstaat, verdwijnt vanzelf uit de lijst.</li>
</ul>

<h2>Geen spam</h2>
<ul>
  <li>Tikt een gast meerdere keren, of tikken twee mensen aan dezelfde tafel, dan blijft het één oproep.</li>
  <li>Roept dezelfde tafel na 2 minuten opnieuw terwijl de oproep nog openstaat, dan zie je erbij hoeveel keer er geroepen werd, en komt er opnieuw een melding.</li>
</ul>

<h2>Meldingen op je toestellen</h2>
<p>Toestellen die een melding krijgen bij een QR-bestelling, krijgen ook een melding bij een oproep van een tafel en bij een nieuwe online reservatie-aanvraag. Welke toestellen dat zijn, stel je in bij de meldingen van de kassa (het belletje op de kassa, of <strong>Kassa › Kassa's en toestellen</strong>). Een melding van een reservatie-aanvraag toont het aantal personen en het uur, niet de naam van de gast.</p>
$c$, 35, true)
on conflict (doc_level, slug) do nothing;

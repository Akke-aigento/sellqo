-- MENUKAART-PRINT-1 — helpartikel "Je menukaart afdrukken" (Kaart › Afdrukken).
-- Categorie: dezelfde als het artikel horeca-kaart (live opgezocht bij het draaien); bestaat dat
-- artikel niet, dan de horeca-categorie a0000001-…-006 zoals mijn-zaak-instellingen.
-- PAS DRAAIEN NA de publish van sellqo.app met MENUKAART-PRINT-1 (anders beschrijft het artikel wat nog
-- niet live is).
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'menukaart-afdrukken';

insert into public.doc_articles (category_id, doc_level, title, slug, content, excerpt, tags, context_path, sort_order, is_published)
values (
  coalesce((select category_id from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-kaart'), 'a0000001-0000-0000-0000-000000000006'),
  'tenant',
  'Je menukaart afdrukken',
  'menukaart-afdrukken',
  $doc$<p>Werk je ook met een papieren kaart? Op de <strong>Kaart</strong> staat de knop <strong>Afdrukken</strong>. Je krijgt een PDF van je kaart in de kleuren en met het logo van je zaak, klaar om af te drukken of naar een drukkerij te sturen. Het werkt ook op je gsm, tablet en in de app.</p>
<h2>Drie sjablonen</h2>
<ul>
<li><strong>Boekje A5</strong>: twee pagina's naast elkaar op een A4 liggend. Na het vouwen heb je een boekje op A5.</li>
<li><strong>A4-kaart</strong>: losse A4-pagina's staand (kaft, je gerechten in twee kolommen, achterkant), voor een menumap of -houder.</li>
<li><strong>Fotokaft</strong>: het A5-boekje met een grote foto op de kaft en je naam erover. Kies een foto uit je mediabibliotheek, tik op een foto van een van je gerechten of upload er zelf een.</li>
</ul>
<h2>Wat staat erop</h2>
<p>Alles wat in het QR-menu staat: producten die <em>Op de kaart</em> staan, per categorie in dezelfde volgorde als op je Kaart, met prijs. Wat je verbergt of enkel online verkoopt, staat er niet op. "Uitverkocht vandaag" telt niet mee, want een papieren kaart gaat lang mee.</p>
<p>Met de schakelaars kies je wat je toont:</p>
<ul>
<li><strong>Omschrijvingen</strong> onder elk gerecht.</li>
<li><strong>Allergenen</strong> als kleine nummers achter de naam, met onderaan de legende van de 14 allergenen. Dieetlabels (vegetarisch, veganistisch, …) staan er als korte letters bij.</li>
<li><strong>Adres en openingsuren</strong> op de achterkant, uit je bedrijfsgegevens en openingsuren.</li>
<li><strong>QR-code</strong> naar je online kaart op de achterkant.</li>
</ul>
<p>Je kan ook een ondertitel op de kaft zetten en de taal van de vaste teksten kiezen ("Allergenen", "Openingsuren", …). Je gerechten staan erop zoals je ze invulde. Een lange kaart wordt iets kleiner gezet als dat een vel papier scheelt.</p>
<h2>Afdrukken en vouwen</h2>
<ol>
<li>Tik op <strong>PDF downloaden</strong> en open de PDF.</li>
<li>Boekje of fotokaft: druk <strong>dubbelzijdig</strong> af op A4, <strong>omslaan langs de korte kant</strong>, op <strong>ware grootte (100 %)</strong>. Leg de vellen in volgorde op elkaar en vouw ze samen dubbel. De pagina's staan al in de juiste volgorde.</li>
<li>A4-kaart: druk dubbelzijdig af, omslaan langs de lange kant.</li>
</ol>
<p>Laat je de kaart drukken bij een drukkerij, kies dan <strong>Losse pagina's</strong>: die PDF heeft de pagina's één voor één, in leesvolgorde.</p>
<h2>Je keuzes worden onthouden</h2>
<p>Sjabloon, schakelaars, ondertitel, taal en kaftfoto worden bewaard voor je zaak, ook als je later op een ander toestel afdrukt. Pas je je kaart aan, dan download je gewoon een nieuwe PDF.</p>
<p>Beschikbaar met de horecamodule (Horeca Small en Horeca Big).</p>$doc$,
  'Druk je kaart af als A5-boekje, A4-kaart of boekje met een foto op de kaft, in de stijl van je zaak.',
  array['menukaart', 'afdrukken', 'pdf', 'kaart', 'allergenen'],
  '/admin/bestellen',
  20,
  true
)
on conflict (doc_level, slug) do update
  set title = excluded.title, content = excluded.content, excerpt = excluded.excerpt, tags = excluded.tags,
      context_path = excluded.context_path, is_published = true;

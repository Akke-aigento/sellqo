-- HORECA-0 — helpartikel "Keukenscherm en bestellen aan tafel". Live gedraaid op 24-10-2026 (go Akke);
-- draaien via query_database na de go op HORECA-0 (samen met de deploy).
-- Idempotent via (doc_level, slug). Categorie = die van "Kassa (POS) gebruiken".
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Keukenscherm en bestellen aan tafel',
  'keukenscherm-en-tafelbestelling',
  'Hoe het keukenscherm werkt op tablet en gsm, en wat je gasten zien als ze via de QR-code aan tafel bestellen.',
  $html$
<h2>Keukenscherm</h2>
<p>Open <strong>Keuken</strong> in het menu. Het scherm vult het hele toestel, ook in de app; de menubalk onderaan verdwijnt zolang je in de keuken staat.</p>
<ul>
  <li>Op een <strong>breed scherm</strong> (laptop, grote tablet liggend) zie je drie kolommen naast elkaar: nieuw, in bereiding, klaar.</li>
  <li>Op een <strong>tablet of gsm</strong> wissel je tussen die kolommen met de tabbladen bovenaan.</li>
  <li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>
</ul>

<h2>Bestellen aan tafel (QR-code)</h2>
<p>Een gast die de QR-code op de tafel scant, bestelt <strong>voor die tafel</strong>:</p>
<ul>
  <li>Hij ziet geen levering, geen verzendkosten en geen drempel voor gratis verzending. Zijn bestelling gaat naar de tafel.</li>
  <li>Zijn tafelmandje staat los van een gewoon webshopmandje en vervalt na 3 uur.</li>
  <li>Met <strong>Ik zit niet meer aan tafel</strong> keert hij terug naar je gewone online kaart. Een online bestelling neemt nooit een tafelnummer mee.</li>
  <li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>
</ul>

<h2>Als er iets misloopt</h2>
<p>Loopt er in SellQo iets fout, dan zie je een scherm met <strong>Opnieuw proberen</strong> en <strong>Pagina herladen</strong> in plaats van een wit scherm. De fout komt automatisch bij ons binnen. Komt het scherm terug, laat het ons dan weten met het uur waarop het gebeurde.</p>

<h2>Kassa zonder internet</h2>
<p>Valt de wifi weg tijdens een contante verkoop, dan bewaart de kassa de verkoop en stuurt ze hem door zodra de verbinding terug is. De knop <strong>Wachtend</strong> bovenaan toont hoeveel verkopen nog onderweg zijn; tik erop om meteen opnieuw te versturen. Een verkoop wordt nooit dubbel geboekt.</p>
$html$,
  array['horeca','keuken','tafel','qr','kassa'],
  '/admin/keuken',
  4,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();

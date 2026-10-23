-- TAFEL-2 — helpartikel "Afrekenen op de kassa". Nog NIET live gedraaid:
-- draaien via query_database na de go op TAFEL-2. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Afrekenen op SellQo Kassa: contant, kaart, delen en apart betalen',
  'kassa-afrekenen',
  'Reken een tafel of rekening af met contant, kaart, maaltijdcheques of een combinatie; deel gelijk of laat één klant apart betalen.',
  $html$
<p>Open de rekening en tik op <strong>Afrekenen</strong>. Staat er nog iets dat niet verstuurd is, dan gaat dat eerst naar keuken of bar.</p>

<h2>Het hele bedrag</h2>
<ul>
  <li>Tik op <strong>Contant</strong> of <strong>Kaart</strong> en daarna op <strong>Betaald</strong>.</li>
  <li>Bij contant rondt de kassa af op 5 cent (wettelijke regel) en toont ze het wisselgeld als je intikt hoeveel je kreeg.</li>
  <li>De kaartterminal staat los van de kassa: laat de klant eerst op de terminal betalen en bevestig dan in de kassa.</li>
</ul>

<h2>Met meerdere betaalmiddelen of gelijk delen</h2>
<ul>
  <li><strong>Gelijk delen door 2…6</strong> maakt evenveel delen; kies per deel contant, kaart, maaltijdcheque, bon of andere.</li>
  <li>Of voeg zelf betaalmiddelen toe. De kassa toont wat er nog openstaat; pas als het exact klopt, kan je bevestigen.</li>
  <li>Alles samen is één kasticket.</li>
</ul>

<h2>Eén klant betaalt apart</h2>
<ol>
  <li>Kies in het menu <em>Meer</em> › <strong>Apart afrekenen</strong>.</li>
  <li>Tik per gerecht of drankje aan hoeveel deze klant neemt.</li>
  <li>Dat gaat naar een apart deel van de rekening ("Tafel 4 · deel 1") en je rekent het meteen af. De rest blijft op de tafel.</li>
</ol>

<h2>Fooi</h2>
<p>Vul de fooi apart in en kies of ze contant of met de kaart gegeven werd. Fooi telt niet mee in je omzet en btw.</p>

<h2>Na het afrekenen</h2>
<ul>
  <li>De verkoop staat meteen bij de verkopen van die kassa (en in het shiftrapport als er op die kassa een shift open staat) en je voorraad wordt afgeboekt.</li>
  <li>Het totaal komt altijd uit de verstuurde bestellingen in SellQo, nooit uit het toestel. Wijzigde een collega net iets aan de rekening, dan vraagt de kassa om opnieuw af te rekenen.</li>
  <li>Op een geregistreerde kassa (GKS) wordt de verkoop eerst ondertekend en verschijnt het btw-kasticket om af te drukken. Valt het internet net daarna weg, dan bewaart de kassa de betaling en stuurt ze die vanzelf door; de rekening blijft tot dan vergrendeld.</li>
</ul>
<p>Afrekenen kan niet zonder verbinding: zo kunnen twee toestellen nooit dezelfde rekening betalen.</p>
$html$,
  array['kassa','horeca','afrekenen','betalen','fooi','splitsen'],
  '/kassa',
  31,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();

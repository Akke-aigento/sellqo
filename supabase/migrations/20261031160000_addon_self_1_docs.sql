-- ADDON-SELF-1 — helpartikel "Een onderdeel bijnemen" (zaakvoerder zet zelf een spoor aan).
-- Alleen tekst. Idempotent: ON CONFLICT (doc_level, slug) werkt het artikel bij.
-- Handmatig terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'onderdeel-bijnemen';
insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published, tags)
values ('tenant', 'a0000001-0000-0000-0000-00000000000e', '/admin/settings?section=modules', 'onderdeel-bijnemen',
  'Een onderdeel bijnemen: webshop, horeca of events',
  'Je plan bepaalt je hoofdonderdeel. Een webshop, horeca of events erbij zet je zelf aan in Instellingen › Modules, met vooraf de exacte prijs.',
  $c$
<p>Je <strong>plan</strong> bepaalt je hoofdonderdeel: webshop, horeca of events. Wil je er een tweede onderdeel bij, bijvoorbeeld een café dat ook online verkoopt, dan neem je dat als <strong>add-on</strong>. Dat doe je zelf in <strong>Instellingen › Modules</strong>. Enkel de beheerder van de winkel kan dat.</p>

<h2>Wat kost een add-on?</h2>
<ul>
  <li><strong>Webshop:</strong> € 19 per maand (€ 190 per jaar).</li>
  <li><strong>Horeca:</strong> € 29 per maand (€ 290 per jaar).</li>
  <li><strong>Events:</strong> geen vaste kosten, € 0,69 per verkocht ticket.</li>
</ul>
<p>Prijzen zonder btw. Een add-on volgt je plan: betaal je je plan per jaar, dan betaal je de add-on ook per jaar.</p>

<h2>Zo zet je een onderdeel aan</h2>
<ol>
  <li>Ga naar <strong>Instellingen › Modules</strong> en zet de schakelaar van het onderdeel aan.</li>
  <li>Je ziet meteen wat je vandaag betaalt. Loopt je abonnement al, dan betaal je enkel voor de resterende dagen van je periode. Daarna komt de add-on mee op je gewone factuur.</li>
  <li>Kies <strong>Betalen en aanzetten</strong>. Heb je een domiciliëring of opgeslagen kaart, dan gebeurt dat meteen. Anders krijg je een betaalverzoek.</li>
  <li>Het onderdeel staat aan zodra de betaling binnen is. Het verschijnt dan in je menu.</li>
</ol>
<p>Zit je nog in je <strong>proefperiode</strong>? Dan is een add-on gratis tot het einde ervan. Daarna komt hij mee op je eerste factuur.</p>

<h2>Een onderdeel uitzetten</h2>
<ul>
  <li>Een betaalde add-on loopt tot het einde van de periode die je al betaalde. Daarna verdwijnt het onderdeel uit je menu. Je gegevens blijven bewaard.</li>
  <li>Zolang er nog werk openstaat, kan je het niet uitzetten: open rekeningen in de kassa (horeca), komende events met verkochte tickets (events) of betaalde bestellingen die nog verzonden moeten worden (webshop). Rond die eerst af.</li>
  <li>Bedenk je je vóór de einddatum? Zet het gewoon weer aan, zonder extra kosten.</li>
</ul>

<h2>Goed om te weten</h2>
<ul>
  <li>Staat er <strong>Inbegrepen</strong> bij een onderdeel, dan krijg je het gratis van SellQo. Daar betaal je niets voor.</li>
  <li>Staat er nog een betaling open voor je abonnement, dan kan je pas iets bijnemen als die betaald is.</li>
  <li>Wil je van hoofdonderdeel wisselen, bijvoorbeeld van webshop naar horeca? Neem dan contact op met SellQo via Help.</li>
</ul>
$c$,
  10, true, array['abonnement', 'add-on', 'modules', 'webshop', 'horeca', 'events'])
on conflict (doc_level, slug) do update
  set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
      context_path = excluded.context_path, category_id = excluded.category_id, tags = excluded.tags, updated_at = now();

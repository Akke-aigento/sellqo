-- SOCIAL-6 — helpartikel "Social planning: posts goedkeuren": score, meting na 48 uur en
-- rangschikking per label in de tab Resultaten.
-- Zelfde slug; ON CONFLICT werkt bij.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: DELETE FROM public.doc_articles WHERE doc_level = 'tenant' AND slug = 'social-planning-goedkeuren';

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing/social',
  'Social planning: posts goedkeuren',
  'social-planning-goedkeuren',
  'Zo keur je je geplande posts goed, pas je ze aan of schrap je ze, en wat er gebeurt na goedkeuring.',
  $html$<h2>Social planning: posts goedkeuren</h2>
<p>Onder <strong>Marketing &rarr; Social planning</strong> staan al je geplande posts, per week. Elke post toont het beeld zoals het op Instagram verschijnt, de tekst, het uur en de status.</p>

<h3>Goedkeuren</h3>
<ul>
<li><strong>Goedkeuren</strong> op een post keurt die ene post goed.</li>
<li><strong>Week goedkeuren</strong> bovenaan een week keurt in één keer alle posts goed die in die week nog wachten.</li>
<li>Een goedgekeurde post gaat vanzelf online in de eerste minuten na het geplande uur. Je hoeft SellQo daarvoor niet open te hebben.</li>
<li>Is het geplande uur al voorbij, dan gaat de post binnen enkele minuten na je goedkeuring online.</li>
<li><strong>Nu posten</strong> zet een post meteen online, zonder op het geplande uur te wachten, en keurt hem daarmee goed. Lukt het niet meteen (bijvoorbeeld omdat Instagram een video nog verwerkt), dan probeert SellQo het binnen het uur opnieuw. Stories met een sticker en reels met je eigen muziek post je zelf.</li>
</ul>

<h3>Aanpassen en schrappen</h3>
<p>Met <strong>Aanpassen</strong> wijzig je de tekst, de datum en het uur. Met het vuilbakje schrap je een post: hij verdwijnt uit de planning en wordt niet gepubliceerd. Een post die al online staat of op dat moment gepubliceerd wordt, kun je niet meer schrappen.</p>

<h3>Mislukt</h3>
<p>Lukt een post niet, dan staat hij op <strong>Mislukt</strong> met de reden erbij. Los de oorzaak op (bijvoorbeeld Instagram opnieuw koppelen in SellQo Connect) en kies <strong>Opnieuw inplannen</strong>: de post wordt dan opnieuw goedgekeurd voor het uur dat je kiest.</p>

<h3>Bekijken en downloaden</h3>
<p>Onder het beeld van elke post staan <strong>Bekijken</strong> en <strong>Downloaden</strong>. Met Bekijken zie je elk beeld (en bij een reel de video en de cover) groot, met per beeld een eigen knop Downloaden en Openen. Downloaden onder een post met één beeld haalt dat beeld meteen binnen.</p>

<h3>Taal veranderen</h3>
<p>Met <strong>Taal veranderen</strong> kies je een andere taal, bijvoorbeeld Engels voor je internationale volgers. De caption en de tekst in de beelden worden vertaald (dat kost 1 AI-credit); je kijkt alles na, past aan waar nodig en ziet het resultaat voor je bewaart. Bij een reel zit de tekst in de video zelf: dan wordt er een nieuwe versie in die taal gemaakt, zoals bij <strong>Opnieuw maken</strong>. Beelden zonder aanpasbare tekst blijven zoals ze zijn; dat staat erbij.</p>

<h3>Tekst in het beeld aanpassen</h3>
<p>Bij posts en stories die voor je klaargezet zijn, staat een knop <strong>Tekst in beeld</strong>. Je ziet een veld per tekstvak in het beeld (bijvoorbeeld titel, prijs of onderregel) en een voorbeeld dat meeverandert terwijl je typt. Het ontwerp zelf blijft hetzelfde; elk vak heeft een maximumlengte zodat de tekst blijft passen.</p>
<p>Klik op <strong>Volgende</strong>: SellQo maakt het nieuwe beeld en toont het precies zoals het online gaat. Klopt het, klik dan op <strong>Bewaren</strong>; anders ga je <strong>Terug</strong>. De status van de post verandert niet: een goedgekeurde post blijft goedgekeurd en gaat met het nieuwe beeld online. Voor reels kan dit niet; gebruik daar <strong>Opnieuw maken</strong>.</p>

<h3>Reels</h3>
<p>Een reel toont een videovoorbeeld en een <strong>muziekvoorstel</strong>: concrete nummers om in de muziekzoeker van Instagram te zoeken, met de sfeer en het tempo erbij. Niet elk nummer is beschikbaar voor elk account (zakelijke accounts hebben vaak een kleinere muziekbibliotheek); kies er een die je in de app vindt. Je kiest:</p>
<ul>
<li><strong>Goedkeuren (automatisch)</strong>: SellQo post de versie met muziek zelf op het geplande uur. Deze knop verschijnt enkel als er een versie met muziek is.</li>
<li><strong>Ik kies zelf muziek</strong>: de reel komt op <strong>Zelf posten</strong>. Met <strong>Downloaden</strong> haal je de video binnen en met <strong>Caption kopiëren</strong> de tekst. In de Instagram-app kies je een nummer, plak je de tekst en post je. Klik daarna op <strong>Gepost</strong>.</li>
</ul>
<p>Een video mag maximaal 10 MB zijn. Reels publiceert SellQo enkel op Instagram.</p>

<h3>Zelf posten</h3>
<p>Sommige dingen kan Instagram niet automatisch laten plaatsen, zoals een story met een link-, poll- of vraagsticker, of een reel met een nummer uit de Instagram-app. Die staan op <strong>Zelf posten</strong>. Download het beeld of de video, plaats het zelf in de Instagram-app en klik daarna op <strong>Gepost</strong>.</p>
<p>Ongeveer een uur voor het geplande moment krijg je een <strong>melding</strong> (in SellQo en als pushmelding, als die aan staat). De pushmelding zet je aan of uit bij <strong>Instellingen &rarr; Mijn meldingen</strong>, onder Marketing.</p>

<h3>Opnieuw maken</h3>
<p>Bij posts die voor je klaargezet zijn, staat een knop <strong>Opnieuw maken</strong>. Schrijf er eventueel bij wat er anders moet (bijvoorbeeld "grappiger" of "een andere foto") en kies een <strong>taal</strong> als de nieuwe versie in een andere taal moet, bijvoorbeeld Engels voor je internationale volgers. De taal van een post staat als code naast het platform (bijvoorbeeld EN). De post krijgt de status <strong>Wordt opnieuw gemaakt</strong> en telt niet mee bij <strong>Week goedkeuren</strong>. Zodra de nieuwe versie klaarstaat, op dezelfde dag en hetzelfde uur, krijg je een melding en keur je hem opnieuw goed.</p>

<h3>Resultaten</h3>
<p>Bovenaan de Social planning staan twee tabs: <strong>Planning</strong> en <strong>Resultaten</strong>. Zodra een post online staat, haalt SellQo elke 3 uur de cijfers op bij Instagram. Je ziet ze onder de post (bereik, weergaven, likes, reacties, bewaard, gedeeld en de interactiegraad) met een link naar de post op Instagram.</p>
<p>In de tab <strong>Resultaten</strong> zie je over de laatste 90 dagen:</p>
<ul>
<li>hoeveel posts gemeten zijn, het gemiddelde bereik, de gemiddelde interactiegraad en je aantal volgers, met de groei sinds de eerste meting;</li>
<li>welk <strong>dagdeel</strong>, welke <strong>weekdag</strong> en welk <strong>soort post</strong> (post, carrousel, reel, story) het best werkt. Een vak telt pas mee als er minstens 3 posts in zitten;</li>
<li>je <strong>beste posts</strong>.</li>
</ul>
<p>De <strong>interactiegraad</strong> is het aantal likes, reacties, bewaringen en keren gedeeld, gedeeld door het aantal accounts dat de post zag. Zo kun je posts met een groot en een klein bereik eerlijk vergelijken.</p>
<p>De rangschikking gebeurt op een <strong>score</strong>: likes, reacties (×2), bewaard en gedeeld (×3) en nieuwe volgers (×5) per 100 bereikte accounts. Bewaren, delen en volgen zeggen meer over je post dan een like. SellQo neemt daarvoor de meting van <strong>48 uur na publicatie</strong>, zodat een post van gisteren eerlijk vergeleken wordt met een post van vorige maand.</p>
<p>Hebben je posts <strong>labels</strong> (pijler, format, soort opening, lengte van de tekst, oproep tot actie), dan zie je onder <strong>Wat werkt qua inhoud</strong> ook welke inhoud het best scoort. Posts die voor je klaargezet worden, krijgen die labels automatisch.</p>
<p>Zie je enkel likes en reacties, koppel Instagram dan opnieuw in <strong>SellQo Connect &rarr; Kanalen</strong> en geef toestemming voor statistieken. Instagram kan tot 48 uur achterlopen, en stories zijn maar 24 uur meetbaar. Posts die je zelf in de Instagram-app plaatste en op <strong>Gepost</strong> zette, koppelt SellQo op tijdstip aan de juiste post.</p>

<h3>Geen koppeling?</h3>
<p>Zie je bovenaan een melding dat er geen Instagram- of Facebook-koppeling is, koppel dan eerst je account in <strong>SellQo Connect &rarr; Kanalen</strong>. Zonder koppeling kan een goedgekeurde post niet online: op het geplande uur komt hij op <strong>Mislukt</strong> te staan en krijg je een melding. Na het koppelen plan je hem opnieuw in.</p>$html$,
  5
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  updated_at = now();

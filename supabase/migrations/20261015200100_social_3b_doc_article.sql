-- SOCIAL-3b — helpartikel "Social planning: posts goedkeuren": songvoorstellen bij reels,
-- taal per post en "Opnieuw maken" in een andere taal. Zelfde slug; ON CONFLICT werkt bij.
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
<li>Is het geplande uur al voorbij, dan gaat de post binnen het uur na je goedkeuring online.</li>
</ul>

<h3>Aanpassen en schrappen</h3>
<p>Met <strong>Aanpassen</strong> wijzig je de tekst, de datum en het uur. Met het vuilbakje schrap je een post: hij verdwijnt uit de planning en wordt niet gepubliceerd. Een post die al online staat of op dat moment gepubliceerd wordt, kun je niet meer schrappen.</p>

<h3>Mislukt</h3>
<p>Lukt een post niet, dan staat hij op <strong>Mislukt</strong> met de reden erbij. Los de oorzaak op (bijvoorbeeld Instagram opnieuw koppelen in SellQo Connect) en kies <strong>Opnieuw inplannen</strong>: de post wordt dan opnieuw goedgekeurd voor het uur dat je kiest.</p>

<h3>Reels</h3>
<p>Een reel toont een videovoorbeeld en een <strong>muziekvoorstel</strong>: concrete nummers om in de muziekzoeker van Instagram te zoeken, met de sfeer en het tempo erbij. Niet elk nummer is beschikbaar voor elk account (zakelijke accounts hebben vaak een kleinere muziekbibliotheek); kies er een die je in de app vindt. Je kiest:</p>
<ul>
<li><strong>Goedkeuren (automatisch)</strong>: SellQo post de versie met muziek zelf op het geplande uur. Deze knop verschijnt enkel als er een versie met muziek is.</li>
<li><strong>Ik kies zelf muziek</strong>: de reel komt op <strong>Zelf posten</strong>. Met <strong>Video downloaden</strong> haal je de stille versie binnen en met <strong>Caption kopiëren</strong> de tekst. In de Instagram-app kies je een nummer, plak je de tekst en post je. Klik daarna op <strong>Gepost</strong>.</li>
</ul>
<p>Een video mag maximaal 10 MB zijn. Reels publiceert SellQo enkel op Instagram.</p>

<h3>Zelf posten</h3>
<p>Sommige dingen kan Instagram niet automatisch laten plaatsen, zoals een story met een link-, poll- of vraagsticker, of een reel met een nummer uit de Instagram-app. Die staan op <strong>Zelf posten</strong>. Open het beeld (of download de video), plaats het zelf in de Instagram-app en klik daarna op <strong>Gepost</strong>.</p>
<p>Ongeveer een uur voor het geplande moment krijg je een <strong>melding</strong> (in SellQo en als pushmelding, als die aan staat). De pushmelding zet je aan of uit bij <strong>Instellingen &rarr; Mijn meldingen</strong>, onder Marketing.</p>

<h3>Opnieuw maken</h3>
<p>Bij posts die voor je klaargezet zijn, staat een knop <strong>Opnieuw maken</strong>. Schrijf er eventueel bij wat er anders moet (bijvoorbeeld "grappiger" of "een andere foto") en kies een <strong>taal</strong> als de nieuwe versie in een andere taal moet, bijvoorbeeld Engels voor je internationale volgers. De taal van een post staat als code naast het platform (bijvoorbeeld EN). De post krijgt de status <strong>Wordt opnieuw gemaakt</strong> en telt niet mee bij <strong>Week goedkeuren</strong>. Zodra de nieuwe versie klaarstaat, op dezelfde dag en hetzelfde uur, krijg je een melding en keur je hem opnieuw goed.</p>

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

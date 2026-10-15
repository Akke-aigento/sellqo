-- SOCIAL-2 — helpartikel "Social planning: posts goedkeuren".
--
-- Nieuwe pagina Marketing → Social planning (/admin/marketing/social): geplande posts per
-- week, goedkeuren (los of per week), aanpassen, schrappen, en zelf te posten items afvinken.
-- Eigen artikel naast 'social-posts-inplannen' (dat over koppelen en publiceren gaat), met
-- context_path op de nieuwe pagina zodat de contextuele hulp daar verschijnt.
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

<h3>Zelf posten</h3>
<p>Sommige dingen kan Instagram niet automatisch laten plaatsen, zoals een story met een link-, poll- of vraagsticker. Die staan op <strong>Zelf posten</strong>. Open het beeld, plaats het zelf in de Instagram-app en klik daarna op <strong>Gepost</strong>.</p>

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

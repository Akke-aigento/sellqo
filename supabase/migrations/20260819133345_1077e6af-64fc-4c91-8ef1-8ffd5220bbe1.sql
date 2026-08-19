-- EVENT-SYSTEEM FASE 4b — in-app documentatie voor de tickettype-beheer-UI.
-- Idempotent via UNIQUE (doc_level, slug). Terugdraaien:
--   DELETE FROM public.doc_articles WHERE doc_level='tenant' AND slug='event-tickettypes-beheren';
INSERT INTO public.doc_articles (doc_level, category_id, slug, title, excerpt, content, context_path, sort_order, is_published)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000001',
  'event-tickettypes-beheren',
  'Tickettypes beheren op de eventpagina',
  'Tickettypes aanmaken, bewerken, activeren of deactiveren per eventdatum — met capaciteit, verkoopvenster en heringang-beleid.',
  '<h2>Tickettypes beheren</h2>
<p>Open een eventdatum via <strong>Events</strong> en ga naar het tabblad <strong>Tickettypes</strong>. Daar bepaal je welke tickets voor dat event te koop zijn.</p>
<h3>Een tickettype toevoegen</h3>
<ol>
<li>Klik op <strong>Tickettype toevoegen</strong>.</li>
<li>Kies een <strong>ticketproduct</strong>. De naam en de prijs komen uit dat product, zodat er één bron van waarheid is. Heb je nog geen ticketproduct? Maak eerst een product aan met type <em>ticket</em>.</li>
<li>Vul optioneel een <strong>sub-capaciteit</strong> in: het maximum voor dit specifieke tickettype. Laat je het leeg, dan geldt alleen de capaciteit van het event zelf. De event-capaciteit blijft altijd de harde bovengrens, ook als de som van de sub-capaciteiten hoger uitkomt.</li>
<li>Stel eventueel een <strong>verkoopvenster</strong> in met een start- en einddatum plus tijd. Buiten dat venster is het tickettype niet te koop.</li>
<li>Kies het <strong>heringang-beleid</strong> (geen heringang, onbeperkt, één keer per dag of één keer per event) en de <strong>sorteervolgorde</strong> waarin het tickettype in je webshop verschijnt.</li>
</ol>
<h3>Wijzigen, deactiveren en verwijderen</h3>
<ul>
<li>In de lijst zie je per tickettype de prijs, de capaciteit, hoeveel er verkocht zijn en hoeveel plaatsen er nog vrij zijn.</li>
<li><strong>Deactiveren</strong> stopt de verkoop van dat tickettype. Bestaande tickets blijven geldig en die bezoekers kunnen nog inchecken. Zijn er al verkopen, dan vragen we eerst om bevestiging.</li>
<li>Verlaag je de <strong>sub-capaciteit</strong> onder het aantal dat al verkocht is, dan stopt nieuwe verkoop meteen. Ook hier vragen we eerst om bevestiging; niemand verliest zijn ticket.</li>
<li><strong>Verwijderen</strong> kan alleen bij een tickettype zonder verkopen. Zijn er verkopen, deactiveer het dan.</li>
<li>Eenzelfde ticketproduct kun je maar één keer aan een event koppelen; al gekoppelde producten verdwijnen uit de keuzelijst.</li>
</ul>
<p>Werk je met een eigen frontend? Die haalt de tickettypes automatisch op via de storefront-API — je hoeft daar niets aan te passen.</p>',
  '/admin/events',
  62,
  true
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    context_path = EXCLUDED.context_path,
    sort_order = EXCLUDED.sort_order,
    is_published = EXCLUDED.is_published,
    updated_at = now();
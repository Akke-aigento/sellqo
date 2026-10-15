-- EVENT-ADMIN-1 — helpartikel "Tickets in een bestelling bekijken" (nieuw).
-- Categorie Bestellingen (a0000001-...0002), nagetrokken tegen de live doc_categories op 16-10-2026.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: DELETE FROM public.doc_articles WHERE doc_level = 'tenant' AND slug = 'tickets-in-een-bestelling';

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000002',
  '/admin/orders',
  'Tickets in een bestelling bekijken',
  'tickets-in-een-bestelling',
  'Op een bestelling met tickets zie je elk ticket apart: event, datum, tickettype, houder, code en status.',
  $html$<h2>Tickets in een bestelling bekijken</h2>
<p>Open een bestelling onder <strong>Bestellingen</strong>. Zitten er tickets in, dan staat er een blok <strong>Tickets en munten</strong> met elk ticket apart.</p>

<h3>Wat je per ticket ziet</h3>
<ul>
<li><strong>Event en datum</strong>: voor welk event en welke datum (met startuur) het ticket geldt.</li>
<li><strong>Tickettype</strong>: bijvoorbeeld VIP of Camping. Het gewone ticket van het event heet <strong>Standaardticket</strong>.</li>
<li><strong>Houder</strong>: de naam op het ticket, en de plaats als je met een zaalplan werkt.</li>
<li><strong>Ticketcode</strong>: alleen de laatste tekens. Wie de volledige code heeft, komt binnen, daarom toont SellQo hem nooit helemaal. Vraagt een bezoeker naar zijn ticket, dan vergelijk je de laatste tekens met de code in zijn mail.</li>
<li><strong>Status</strong>: <strong>Geldig</strong>, <strong>Ingecheckt</strong> (met het tijdstip van de scan), <strong>Geannuleerd</strong>, <strong>Terugbetaald</strong> of <strong>Overgedragen</strong>.</li>
</ul>

<h3>Tickets opnieuw mailen</h3>
<p>Is de bestelling betaald, dan stuur je met <strong>Tickets opnieuw mailen</strong> de ticketmail nog eens naar de koper, bijvoorbeeld als hij hem niet terugvindt. Er komen geen nieuwe tickets bij: het zijn dezelfde tickets met dezelfde QR-codes.</p>

<h3>Ticketproducten en de productlijst</h3>
<p>Met de module Events staan ticketproducten niet tussen je gewone producten onder <strong>Producten</strong>. Bovenaan die lijst zie je hoeveel eventtickets er zijn, met een link naar <strong>Events</strong>, waar je ze beheert.</p>

<p>Beschikbaar met de module Events, ook in Events Flex.</p>$html$,
  ARRAY['tickets', 'bestelling', 'ticketcode', 'ingecheckt', 'ticketmail'],
  31
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

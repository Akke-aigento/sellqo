-- EVENT-ORDER-1 — helpartikel "Tickets in een bestelling bekijken" aangevuld (bestaand artikel).
-- Nieuw: een bestelling met alleen tickets/combitickets/munten staat na de ticketmail op
-- Afgeleverd en kan nu nog gewoon geannuleerd worden; munten vervallen niet vanzelf.
-- Basis: de live content van 16-10-2026 (updated_at 2026-10-15 23:50, md5
-- 9d60785c48b761071f88f94b715ed0a1), via query_database nagelezen. Categorie
-- (a0000001-...0002), context_path, tags en sort_order blijven zoals live.
--
-- PAS DRAAIEN NA DE DEPLOY van update-order-fulfillment-status (EVENT-ORDER-1): vóór die
-- deploy weigert de server delivered → cancelled nog, en zou het artikel iets beloven
-- dat niet werkt.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE, met een VASTE updated_at.
-- Handmatig terugdraaien: snapshot de huidige rij vóór het draaien
--   (create table snapshots.sellqo_20261016_doc_articles_eo1 as select * from public.doc_articles
--    where doc_level='tenant' and slug='tickets-in-een-bestelling';)
-- en zet daarna content/updated_at terug uit die snapshot.

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order, updated_at)
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

<h3>Annuleren of terugbetalen</h3>
<p>Annuleer je een bestelling, of betaal je ze volledig terug, dan vervallen de tickets die nog niet gescand zijn automatisch. Ze komen niet meer binnen aan de deur en de plaatsen komen vrij voor nieuwe kopers. Wie al ingecheckt is, blijft ingecheckt. Bij een gedeeltelijke terugbetaling verandert er niets aan de tickets.</p>
<p>Een bestelling met alleen tickets, combitickets of munten staat na de ticketmail meteen op <strong>Afgeleverd</strong>. Je kan ze daarna nog gewoon annuleren: kies <strong>Geannuleerd</strong> bij <strong>Orderstatus</strong>. Dat kan de eigenaar of een medewerker. Zit er ook een gewoon product in de bestelling, dan volgt ze de gewone verzendflow en kan ze na <strong>Afgeleverd</strong> niet meer zomaar geannuleerd worden.</p>
<p>Munten vervallen bij annuleren niet vanzelf. Wil je ze ook ongeldig maken, ga dan naar <strong>Events → Munten</strong>, tabblad <strong>Kaarten</strong>, en kies <strong>Blokkeren</strong> bij de kaart van die bestelling.</p>

<h3>Ticketproducten en de productlijst</h3>
<p>Met de module Events staan ticketproducten niet tussen je gewone producten onder <strong>Producten</strong>. Bovenaan die lijst zie je hoeveel eventtickets er zijn, met een link naar <strong>Events</strong>, waar je ze beheert.</p>

<p>Beschikbaar met de module Events, ook in Events Flex.</p>$html$,
  ARRAY['tickets', 'bestelling', 'ticketcode', 'ingecheckt', 'ticketmail', 'annuleren'],
  31,
  '2026-10-16 12:00:00+00'
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at;

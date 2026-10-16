-- EVENT-COIN-1 — helpartikel "Tickets in een bestelling bekijken" bijgewerkt (bestaand artikel).
-- Oud: "Munten vervallen bij annuleren niet vanzelf ... kies Blokkeren".
-- Nieuw: bij annuleren of volledig terugbetalen wordt de muntenkaart automatisch
-- geblokkeerd (resterende munten onbruikbaar, gebruikte blijven gebruikt), niet bij een
-- gedeeltelijke terugbetaling; Vrijgeven maakt hem weer bruikbaar.
-- Basis: de live content van 16-10-2026 (= EVENT-ORDER-1-versie), md5 vóór
-- e02e6a545e71d11f4d988af56ba0ce0f, via query_database nagelezen en byte-exact
-- gereconstrueerd. Alleen die ene alinea is vervangen; categorie, context_path, titel,
-- excerpt en sort_order blijven zoals live, tags krijgen 'munten' erbij.
-- Verwachte md5(content) na het draaien: 1823f1876e8af4e6e604466bfb918ff6.
--
-- PAS DRAAIEN NA 20261016180000_event_coin_1.sql en de natrek daarvan: anders belooft
-- het artikel iets dat de database nog niet doet.
--
-- Geen vaste updated_at: de trigger update_doc_articles_updated_at zet die toch op now().
-- Verificatie gaat via md5(content).
--
-- Idempotent: snapshot met IF NOT EXISTS (bewaart dus de rij van vóór de eerste run),
-- daarna ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, tags = s.tags
--     from snapshots.sellqo_20261016_doc_articles_ec1 s
--    where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261016_doc_articles_ec1 as
  select * from public.doc_articles
   where doc_level = 'tenant' and slug = 'tickets-in-een-bestelling';
revoke all on snapshots.sellqo_20261016_doc_articles_ec1 from anon, authenticated;

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

<h3>Annuleren of terugbetalen</h3>
<p>Annuleer je een bestelling, of betaal je ze volledig terug, dan vervallen de tickets die nog niet gescand zijn automatisch. Ze komen niet meer binnen aan de deur en de plaatsen komen vrij voor nieuwe kopers. Wie al ingecheckt is, blijft ingecheckt. Bij een gedeeltelijke terugbetaling verandert er niets aan de tickets.</p>
<p>Een bestelling met alleen tickets, combitickets of munten staat na de ticketmail meteen op <strong>Afgeleverd</strong>. Je kan ze daarna nog gewoon annuleren: kies <strong>Geannuleerd</strong> bij <strong>Orderstatus</strong>. Dat kan de eigenaar of een medewerker. Zit er ook een gewoon product in de bestelling, dan volgt ze de gewone verzendflow en kan ze na <strong>Afgeleverd</strong> niet meer zomaar geannuleerd worden.</p>
<p>Ook de muntenkaart van de bestelling vervalt dan automatisch: de munten die nog over zijn, kunnen niet meer gebruikt worden aan de bar. Wat al gebruikt is, blijft gebruikt; het saldo blijft zichtbaar. Je ziet de kaart als <strong>Geblokkeerd</strong> onder <strong>Events → Munten</strong>, tabblad <strong>Kaarten</strong>. Bij een gedeeltelijke terugbetaling blijft de kaart gewoon bruikbaar. Heeft de koper al een terugbetaling van zijn munten aangevraagd, dan loopt die verder via <strong>Retouren</strong>.</p>
<p>Was het een vergissing, of wil je de munten toch laten gebruiken? Kies dan <strong>Vrijgeven</strong> bij die kaart. Zet je een geannuleerde bestelling terug, dan gaan tickets en munten niet vanzelf weer open.</p>

<h3>Ticketproducten en de productlijst</h3>
<p>Met de module Events staan ticketproducten niet tussen je gewone producten onder <strong>Producten</strong>. Bovenaan die lijst zie je hoeveel eventtickets er zijn, met een link naar <strong>Events</strong>, waar je ze beheert.</p>

<p>Beschikbaar met de module Events, ook in Events Flex.</p>$html$,
  ARRAY['tickets', 'bestelling', 'ticketcode', 'ingecheckt', 'ticketmail', 'annuleren', 'munten'],
  31
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order;

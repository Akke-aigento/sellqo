-- FASE 4a — in-app documentatie voor de read-only event-detailpagina.
-- Idempotent: ON CONFLICT (doc_level, slug) werkt het bestaande artikel bij.
-- Handmatig terugdraaien: DELETE FROM public.doc_articles
--   WHERE doc_level = 'tenant' AND slug = 'event-detailpagina';
INSERT INTO public.doc_articles (doc_level, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  '/admin/events',
  'De eventpagina: deelnemers en check-in-overzicht',
  'event-detailpagina',
  'Wat je ziet op de detailpagina van een event: bezetting, tickettypes, deelnemers en de scan-log.',
  '<p>Klik in het eventoverzicht op een datum om de eventpagina te openen. De pagina is alleen-lezen; datums, capaciteit en tickettypes wijzig je bij het product zelf.</p>
<h3>Overzicht</h3>
<ul>
<li><strong>Capaciteit</strong> — het maximum aantal plaatsen voor deze datum.</li>
<li><strong>Verkocht</strong> — geldige en al ingecheckte tickets samen.</li>
<li><strong>Nu binnen</strong> — bezoekers waarvan de laatste scan een check-in was.</li>
<li><strong>Vrij</strong> — capaciteit min verkocht.</li>
<li><strong>Tickettypes</strong> — per type de prijs, het aantal verkochte tickets en of het type op dit moment te koop is.</li>
</ul>
<h3>Deelnemers</h3>
<p>Per bezoeker de naam, het e-mailadres, het tickettype, het bestelnummer en de check-in-status. Die status komt uit de scan-log: <em>Binnen</em>, <em>Buiten</em> of <em>Niet gescand</em>, met het tijdstip van de laatste scan.</p>
<h3>Scan-log</h3>
<p>Alle scans van deze datum, nieuwste eerst, met tijd, richting (in of uit), resultaat, zone en wie er scande. Handig om te zien waarom een ticket geweigerd werd of wanneer iemand het terrein verliet.</p>',
  60
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET context_path = EXCLUDED.context_path,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.doc_articles (doc_level, category_id, slug, context_path, title, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000001',
  'ticket-product-datums',
  '/admin/products',
  'Ticket-product aanmaken en datums beheren',
  'Verkoop tickets voor evenementen: maak een ticketproduct aan en beheer datums, capaciteit en status.',
  '<h2>Ticket-product aanmaken</h2><p>Ga naar <strong>Producten</strong> en klik op <strong>Nieuw product</strong>. Kies bij het producttype de kaart <strong>Ticket / Event</strong>. Verzending en voorraadbeheer worden dan automatisch uitgeschakeld: een ticket is een dienst, de beschikbaarheid regel je via de capaciteit per datum.</p><p>Vul verder de gewone productgegevens in (naam, prijs, beschrijving, afbeeldingen) en klik op <strong>Opslaan</strong>.</p><h2>Datums beheren</h2><p>Na het opslaan verschijnt op het productscherm de sectie <strong>Events &amp; Datums</strong>. Klik op <strong>Datum toevoegen</strong> en vul in:</p><ul><li><strong>Datum</strong> — de dag waarop het evenement doorgaat.</li><li><strong>Starttijd</strong> — standaard 21:00, aanpasbaar.</li><li><strong>Capaciteit</strong> — het maximum aantal deelnemers voor die datum.</li><li><strong>Minimum deelnemers</strong> — vanaf hoeveel inschrijvingen het evenement doorgaat (0 als er geen minimum is).</li><li><strong>Locatie</strong> en <strong>Verzamelpunt</strong> — optioneel, handig om mee te geven aan je deelnemers.</li></ul><h2>Status per datum</h2><p>Elke datum heeft een status:</p><ul><li><strong>Gepland</strong> — de datum staat vast maar is nog niet bevestigd.</li><li><strong>Bevestigd</strong> — het evenement gaat door.</li><li><strong>Geannuleerd</strong> — het evenement gaat niet door.</li><li><strong>Afgerond</strong> — het evenement is voorbij.</li></ul><h2>Bewerken en verwijderen</h2><p>Klik op het potloodicoon naast een datum om de gegevens aan te passen, of op het prullenbakicoon om de datum te verwijderen. Verwijderen vraagt om een bevestiging en kan niet ongedaan gemaakt worden.</p><p>Het in bulk plannen, verplaatsen of samenvoegen van datums komt in een latere update.</p>',
  3
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order;
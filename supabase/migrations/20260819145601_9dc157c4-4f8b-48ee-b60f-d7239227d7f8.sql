INSERT INTO public.doc_articles (doc_level, category_id, slug, title, excerpt, content, context_path, sort_order, is_published)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000001',
  'event-toegangen-beheren',
  'Deurtoegangen en scan-QR''s beheren',
  'Maak per deur of vrijwilliger een eigen scan-toegang aan, deel de QR-code en trek een toegang met één klik in.',
  '<h2>Wat is een deurtoegang?</h2><p>Een deurtoegang is een eigen scan-code voor iemand die aan de deur staat. Die persoon heeft geen SellQo-account nodig: je stuurt hem of haar een QR-code of link, en daarmee kan alleen dit ene event gescand worden — precies zoals jij het instelt.</p><h2>Een toegang aanmaken</h2><p>Open het event en ga naar het tabblad <strong>Toegangen</strong>. Klik op <strong>Toegang aanmaken</strong> en vul in:</p><ul><li><strong>Naam</strong> — waar of voor wie de toegang bedoeld is, bijvoorbeeld "Vrijwilliger hoofdingang".</li><li><strong>Zone</strong> — de ingang of ruimte. Heeft dit event nog geen zone? Dan maken we automatisch een hoofdingang aan.</li><li><strong>Richting</strong> — in, uit of beide.</li><li><strong>Scanmodus</strong> — inchecken, alleen controleren (zonder in te checken) of uitchecken.</li><li><strong>Tickettypes</strong> — vink aan welke tickettypes deze toegang mag scannen. Vink je niets aan, dan zijn alle tickettypes toegestaan.</li><li><strong>Vervaldatum</strong> — optioneel; na dat moment werkt de toegang niet meer.</li></ul><h2>De QR-code delen</h2><p>Na het aanmaken zie je meteen de QR-code met de scan-link. Je kunt die later altijd opnieuw opvragen via <strong>QR tonen</strong>. Deel de link alleen met mensen die echt aan de deur staan: iedereen met de link kan scannen binnen de grenzen die je hebt ingesteld.</p><h2>Een toegang intrekken</h2><p>Klik op <strong>Intrekken</strong>. De code werkt daarna onmiddellijk niet meer. De toegang blijft wel in de lijst staan met de status <em>Ingetrokken</em>, zodat je later nog kunt terugkijken wie wat gescand heeft. Is er per ongeluk een verkeerde toegang aangemaakt en nog nooit gebruikt? Dan kun je die definitief verwijderen. Zodra er één keer mee gescand is, kun je alleen nog intrekken — zo blijft de scan-geschiedenis kloppen.</p><h2>Gebruik volgen</h2><p>In de lijst zie je per toegang hoe vaak er mee gescand is en wanneer dat het laatst gebeurde. Handig om te zien of iemand aan de deur daadwerkelijk aan het scannen is.</p>',
  '/admin/events',
  63,
  true
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    context_path = EXCLUDED.context_path,
    sort_order = EXCLUDED.sort_order,
    is_published = EXCLUDED.is_published;
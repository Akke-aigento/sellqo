INSERT INTO public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, tags, is_published)
VALUES (
  'tenant',
  'factuur-terugbetalen-en-crediteren',
  'Een betaalde factuur terugbetalen en crediteren',
  'Betaal een betaalde factuur volledig terug vanuit SellQo; de creditnota wordt automatisch aangemaakt.',
  '<h2>Wat doet deze actie?</h2><p>Bij een betaalde factuur kun je in één actie het volledige bedrag terugbetalen aan je klant. SellQo regelt de terugbetaling bij Stripe en maakt meteen een creditnota aan voor je boekhouding. Werkt ook voor abonnementsfacturen en handmatige facturen zonder bestelling.</p><h3>Zo doe je het</h3><ol><li>Ga naar <strong>Facturen &amp; creditnota''s</strong>.</li><li>Zoek de factuur met status <strong>Betaald</strong>.</li><li>Open het actiemenu (⋯) en kies <strong>Terugbetalen &amp; crediteren</strong>.</li><li>Controleer het bedrag in het bevestigingsvenster en bevestig.</li></ol><h3>Goed om te weten</h3><ul><li>Het gaat altijd om het <strong>volledige</strong> factuurbedrag; gedeeltelijk terugbetalen doe je via een retour op de bestelling.</li><li>De actie kan niet ongedaan gemaakt worden.</li><li>Een factuur kan maar één keer terugbetaald worden. Daarna staat de actie op <em>Al terugbetaald</em>.</li><li>De creditnota gaat automatisch mee naar je boekhouding als je de Odoo-koppeling gebruikt.</li><li>Is de betaling niet via Stripe verlopen? Dan meldt SellQo dat er geen Stripe-betaling gevonden is en verandert er niets. Maak in dat geval handmatig een creditnota aan.</li><li>Alleen beheerders van de winkel kunnen terugbetalen. Beschikbaar in alle abonnementen.</li></ul>',
  '/admin/orders/invoices',
  'a0000001-0000-0000-0000-000000000009',
  ARRAY['terugbetaling','refund','creditnota','stripe','factuur'],
  true
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  category_id = EXCLUDED.category_id,
  tags = EXCLUDED.tags,
  is_published = true,
  updated_at = now();
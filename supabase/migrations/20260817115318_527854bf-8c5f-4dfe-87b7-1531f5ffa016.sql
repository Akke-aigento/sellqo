INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000003',
  '/admin/subscriptions',
  'Een SEPA-mandaatlink aanmaken',
  'sepa-mandaatlink-aanmaken',
  'Stuur je klant een link waarmee die eenmalig een doorlopende SEPA-machtiging goedkeurt, met bedrag, reden en interval duidelijk in beeld.',
  '<h2>Wat is een mandaatlink?</h2><p>Met een mandaatlink laat je een klant eenmalig een doorlopende SEPA-machtiging (of kaartmachtiging) goedkeuren. Daarna worden de facturen van dat abonnement automatisch geincasseerd, zonder dat de klant elke keer zelf moet betalen.</p><h2>Zo maak je hem aan</h2><ol><li>Ga naar <strong>Abonnementen</strong>.</li><li>Open het menu bij het juiste abonnement en kies <strong>Mandaatlink aanmaken</strong>.</li><li>Kopieer de link of mail hem direct naar je klant.</li></ol><h2>Wat ziet je klant?</h2><p>Bovenaan de machtigingspagina staat nu expliciet waarvoor de klant een machtiging geeft: jouw bedrijfsnaam, de reden (de omschrijving van de eerste abonnementsregel), het bedrag inclusief btw en het interval, bijvoorbeeld &quot;per jaar&quot;. Het bedrag wordt uit het abonnement zelf berekend, dus het is exact het bedrag dat later wordt afgeschreven. Er staat ook bij dat de machtiging op elk moment stopgezet kan worden.</p><p>Is er geen bedrag bekend, dan ziet de klant nog steeds duidelijk dat het om een doorlopende SEPA-machtiging voor jouw bedrijf gaat.</p><h2>Goed om te weten</h2><ul><li>Een mandaatlink is eenmalig geldig en verloopt automatisch.</li><li>Wijzigt het abonnementsbedrag later, dan hoeft de machtiging niet opnieuw: de machtiging geldt voor het abonnement, niet voor een vast bedrag.</li></ul>',
  70
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order;
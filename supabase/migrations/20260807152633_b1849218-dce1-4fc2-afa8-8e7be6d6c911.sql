INSERT INTO public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, tags, is_published)
VALUES (
  'tenant',
  'meldingen-aanzetten-in-de-app',
  'Meldingen aanzetten in de SellQo-app',
  'Zo zet je pushmeldingen weer aan als je telefoon ze eerder heeft geblokkeerd.',
  '<h2>Meldingen aanzetten in de app</h2><p>Met pushmeldingen krijg je nieuwe bestellingen, berichten en waarschuwingen direct op je telefoon, ook als de SellQo-app niet open staat. Meldingen zijn beschikbaar op elk abonnement (Free, Starter, Pro en Enterprise).</p><h3>Melding gemist? Check je telefooninstellingen</h3><p>Heb je bij de eerste keer opstarten op <strong>Niet toestaan</strong> getikt, dan vraagt je telefoon dit niet opnieuw. De app laat dat bovenaan zien met de melding <strong>Meldingen staan uit</strong>. Je zet het dan zelf aan:</p><ul><li><strong>iPhone / iPad:</strong> Instellingen &rarr; Meldingen &rarr; SellQo &rarr; Meldingen toestaan</li><li><strong>Android:</strong> Instellingen &rarr; Apps &rarr; SellQo &rarr; Meldingen</li></ul><p>Sluit daarna de app volledig af en open hem opnieuw. De balk verdwijnt zodra de meldingen aan staan.</p><h3>Kiezen welke meldingen je krijgt</h3><p>Welke gebeurtenissen een melding sturen, regel je in SellQo zelf via <strong>Instellingen &rarr; Meldingen</strong>. Daar zet je per soort bericht aan of uit of je een melding en/of e-mail wil ontvangen.</p><h3>Nog steeds geen meldingen?</h3><ul><li>Controleer of <strong>Niet storen</strong> of een focusstand aan staat op je telefoon.</li><li>Controleer of je met hetzelfde account bent ingelogd als waarmee je in SellQo werkt.</li><li>Op de webversie in de browser werken pushmeldingen niet; gebruik daarvoor de app.</li></ul>',
  '/admin/settings/notifications',
  'a0000001-0000-0000-0000-000000000007',
  ARRAY['meldingen','pushmeldingen','notificaties','app','telefoon'],
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
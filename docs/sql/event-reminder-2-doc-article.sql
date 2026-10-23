-- EVENT-REMINDER-2 — helpartikel "Herinneringsmail met WhatsApp-groep". Gedraaid via
-- query_database op 23-10-2026. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000001',
  'tenant',
  'Herinneringsmail op de dag van je event (met WhatsApp-groep)',
  'event-herinnering-whatsapp',
  'Laat je tickethouders op de dag zelf een herinnering krijgen met een knop naar je WhatsApp-groep.',
  $html$
<p>Op de dag van je event krijgt elke tickethouder om <strong>10 uur 's ochtends</strong> een herinneringsmail. Daarin staan het startuur, het verzamelpunt en een knop om je <strong>WhatsApp-groep</strong> te joinen. Zo vinden laatkomers en verdwaalde deelnemers je makkelijk terug.</p>

<h2>Zo stel je het in</h2>
<ol>
  <li>Maak in WhatsApp een groep aan en kies <em>Uitnodigen via link</em>. Kopieer de link (die begint met <code>chat.whatsapp.com/</code>).</li>
  <li>Open je event en plak de link in het veld <strong>WhatsApp-groeplink</strong> bij de datum. Je kunt ook meteen de hele deeltekst van WhatsApp plakken: SellQo haalt de link er zelf uit.</li>
  <li>Sla op. Klaar.</li>
</ol>

<h2>Goed om te weten</h2>
<ul>
  <li>Laat je het veld leeg, dan gaat er <strong>geen</strong> herinneringsmail uit voor die datum.</li>
  <li>Een nieuwe datum neemt de link van je laatste datum over. Gebruik je per editie een nieuwe groep, pas de link dan aan.</li>
  <li>Iedereen met een geldig ticket krijgt de mail, één keer per e-mailadres, in de taal van de bestelling.</li>
  <li>In een WhatsApp-groep zien leden elkaars gsm-nummer. Gebruik je één vaste groep voor alle edities, zet dan in WhatsApp <em>Goedkeuring van beheerders</em> aan.</li>
  <li>Staat <em>Tickets per e-mail</em> uit bij je klantcommunicatie, dan gaat ook deze herinnering niet uit.</li>
</ul>
$html$,
  array['events','tickets','whatsapp','herinnering'],
  '/admin/events',
  62,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();

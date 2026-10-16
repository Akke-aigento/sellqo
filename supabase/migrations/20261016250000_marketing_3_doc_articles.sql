-- MARKETING-3 — de tab "Maken" op Social is vervangen door één knop "Post met AI".
-- Promo-wizard, toolraster en menukaart zijn uit de interface gehaald (niet gebruikt).
--
-- Idempotent: elke UPDATE zoekt de oude tekst; een tweede run vindt die niet meer.
-- Het artikel over de dagelijkse menukaart wordt verborgen (is_published = false), niet gewist.
-- Terugdraaien: inhoud staat in 20261016240100_marketing_2_doc_articles.sql; het menukaart-artikel
-- terugzetten met UPDATE public.doc_articles SET is_published = true
--   WHERE doc_level = 'tenant' AND slug = 'dagelijkse-menukaart';

UPDATE public.doc_articles
SET content = replace(content,
  '<p>In de tab <strong>Maken</strong> laat je AI een post, een volledige promo voor een product of een beeld maken. Heb je een horecazaak, dan vind je hier ook de <strong>Menukaart van vandaag</strong>. Alles wat je maakt, komt in de planning met de status <strong>Wacht op goedkeuring</strong>: niets gaat online zonder dat jij het goedkeurt. AI-tools kosten AI-credits; je saldo en de knop om credits bij te kopen staan bovenaan de tab.</p>',
  '<p>Klik bovenaan op <strong>Post met AI</strong> om AI een post te laten schrijven, eventueel over een product. Je kiest het moment; de post komt in de planning met de status <strong>Wacht op goedkeuring</strong>: niets gaat online zonder dat jij het goedkeurt. Een AI-post kost AI-credits; je saldo en de knop om credits bij te kopen staan in het venster.</p>'),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'social-planning-goedkeuren'
  AND content LIKE '%<p>In de tab <strong>Maken</strong> laat je AI%';

UPDATE public.doc_articles
SET content = replace(content,
  '<li><strong>Posts, promo&rsquo;s en beelden</strong>: Marketing &rarr; Social &rarr; Maken. Wat je maakt, komt in de planning en gaat pas online na je goedkeuring.</li>',
  '<li><strong>Social posts</strong>: Marketing &rarr; Social &rarr; Post met AI. Wat je maakt, komt in de planning en gaat pas online na je goedkeuring.</li><li><strong>Productfoto&rsquo;s</strong>: bewerken met AI bij het product of in Marketing &rarr; Media.</li>'),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'ai-functies-overzicht'
  AND content LIKE '%Marketing &rarr; Social &rarr; Maken.%';

UPDATE public.doc_articles
SET is_published = false,
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'dagelijkse-menukaart' AND is_published;

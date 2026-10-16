-- MARKETING-2 — helpartikels volgen de nieuwe plek van alles onder Marketing:
-- Social (Planning, Maken, Resultaten, Kanalen), E-mail, Media, SEO, Ads. De AI Content Hub
-- bestaat niet meer als aparte plek.
--
-- Gerichte tekstvervangingen (replace) + nieuwe context_path. Idempotent: een tweede run vindt
-- de oude tekst niet meer en verandert niets; de toevoeging aan social-planning-goedkeuren
-- gebeurt enkel als ze er nog niet staat.
-- Terugdraaien: de vorige inhoud staat in 20261016230100_social_6_doc_article.sql
-- (social-planning-goedkeuren) en in de eerdere doc-migraties van de andere slugs.

-- Dagelijkse menukaart: zat in "Sellqo AI", nu in Social → Maken.
UPDATE public.doc_articles
SET content = replace(content,
      '<p>In <strong>Sellqo AI</strong> vind je het tabblad <strong>Menukaart</strong>.',
      '<p>Onder <strong>Marketing &rarr; Social &rarr; Maken</strong> vind je het blok <strong>Menukaart van vandaag</strong>.'),
    context_path = '/admin/marketing/social',
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'dagelijkse-menukaart'
  AND (content LIKE '%In <strong>Sellqo AI</strong> vind je het tabblad%' OR context_path <> '/admin/marketing/social');

-- Mediabibliotheek: nu Marketing → Media.
UPDATE public.doc_articles
SET content = replace(replace(content,
      'Je vindt de volledige bibliotheek onder <strong>Marketing → AI Content Hub → Assets</strong>',
      'Je vindt de volledige bibliotheek onder <strong>Marketing → Media</strong>'),
      'In de mediabibliotheek (Assets) zie je',
      'In de mediabibliotheek (<strong>Marketing → Media</strong>) zie je'),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'productfotos-mediabibliotheek-fotostandaard'
  AND (content LIKE '%AI Content Hub → Assets%' OR content LIKE '%mediabibliotheek (Assets)%');

-- Social posts inplannen: koppelen kan nu in Social → Kanalen; publiceren binnen enkele minuten.
UPDATE public.doc_articles
SET content = replace(replace(content,
      'binnen het uur na het tijdstip dat je kiest',
      'binnen enkele minuten na het tijdstip dat je kiest'),
      '<p>Ga naar <strong>SellQo Connect &rarr; Kanalen</strong> en koppel je account.</p>',
      '<p>Ga naar <strong>Marketing &rarr; Social &rarr; Kanalen</strong> en koppel je Instagram-account. Facebook en andere kanalen koppel je in <strong>SellQo Connect &rarr; Kanalen</strong>.</p>'),
    context_path = '/admin/marketing/social',
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'social-posts-inplannen'
  AND (content LIKE '%binnen het uur na het tijdstip%' OR content LIKE '%<p>Ga naar <strong>SellQo Connect &rarr; Kanalen</strong> en koppel je account.</p>%' OR context_path <> '/admin/marketing/social');

-- AI-functies: waar je ze nu vindt.
UPDATE public.doc_articles
SET content = content || '<h3>Waar vind je de AI-tools?</h3><ul><li><strong>Posts, promo&rsquo;s en beelden</strong>: Marketing &rarr; Social &rarr; Maken. Wat je maakt, komt in de planning en gaat pas online na je goedkeuring.</li><li><strong>E-mails</strong>: Marketing &rarr; E-mail &rarr; Maak met AI.</li><li><strong>Productteksten en SEO-velden</strong>: het ✨ icoon bij het veld.</li></ul>',
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'ai-functies-overzicht'
  AND content NOT LIKE '%Waar vind je de AI-tools?%';

-- Social planning: tabs Maken en Kanalen.
UPDATE public.doc_articles
SET content = replace(content, '<h3>Geen koppeling?</h3>',
'<h3>Maken met AI</h3>
<p>In de tab <strong>Maken</strong> laat je AI een post, een volledige promo voor een product of een beeld maken. Heb je een horecazaak, dan vind je hier ook de <strong>Menukaart van vandaag</strong>. Alles wat je maakt, komt in de planning met de status <strong>Wacht op goedkeuring</strong>: niets gaat online zonder dat jij het goedkeurt. AI-tools kosten AI-credits; je saldo en de knop om credits bij te kopen staan bovenaan de tab.</p>

<h3>Kanalen</h3>
<p>In de tab <strong>Kanalen</strong> zie je welke accounts gekoppeld zijn en tot wanneer de koppeling geldig is. Je koppelt Instagram hier ook (opnieuw), bijvoorbeeld om statistieken te zien. Log daarbij in met het Instagram-account van deze winkel. Facebook en andere kanalen beheer je in SellQo Connect.</p>

<h3>Geen koppeling?</h3>'),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'social-planning-goedkeuren'
  AND content NOT LIKE '%<h3>Maken met AI</h3>%';

UPDATE public.doc_articles
SET content = replace(content,
      'koppel dan eerst je account in <strong>SellQo Connect &rarr; Kanalen</strong>',
      'koppel dan eerst je account in de tab <strong>Kanalen</strong>'),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'social-planning-goedkeuren'
  AND content LIKE '%koppel dan eerst je account in <strong>SellQo Connect &rarr; Kanalen</strong>%';

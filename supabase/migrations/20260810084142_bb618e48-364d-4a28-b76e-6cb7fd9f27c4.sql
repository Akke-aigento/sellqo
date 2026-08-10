UPDATE public.doc_articles
SET content = content || '<p>Sessie-acties zoals <strong>Kas +/-</strong>, <strong>Rapport</strong>, <strong>Retouren</strong> en <strong>Dag sluiten</strong> vind je op telefoon in het <strong>•••</strong> menu rechtsboven in de kassa-balk.</p>',
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'pos-gebruiken';
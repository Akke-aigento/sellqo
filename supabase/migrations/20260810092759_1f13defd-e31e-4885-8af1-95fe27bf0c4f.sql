UPDATE public.doc_articles
SET content = content || '<p>De kassa hanteert btw identiek aan je webshop: bij prijzen inclusief btw wordt de btw uit de prijs gehaald, bij prijzen exclusief btw komt ze erbovenop.</p>',
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'pos-gebruiken';
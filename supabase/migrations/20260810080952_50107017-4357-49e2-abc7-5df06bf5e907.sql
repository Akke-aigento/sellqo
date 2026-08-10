UPDATE public.doc_articles
SET content = content || '<h3>Kassa op tablet of telefoon</h3><p>De kassa werkt ook op kleinere schermen. Het productpaneel vult dan je volledige scherm en onderaan zie je een vaste balk met het aantal artikelen en het totaal. Tik op <strong>Afrekenen</strong> om je winkelwagen van onderen uit te schuiven: daar pas je aantallen aan, kies je een klant of korting, parkeer je de verkoop of reken je af met contant, PIN, bank of een combinatie. Op laptop en desktop blijft de winkelwagen als vast zijpaneel staan.</p>',
    tags = (select array(select distinct unnest(coalesce(tags, '{}') || array['kassa','pos','tablet','mobiel']))),
    updated_at = now()
WHERE doc_level = 'tenant' AND slug = 'pos-gebruiken';
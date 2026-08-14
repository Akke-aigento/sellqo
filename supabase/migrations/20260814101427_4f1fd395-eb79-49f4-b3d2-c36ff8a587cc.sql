UPDATE public.doc_articles
SET content = content || '<h2>Inschrijvingen per datum</h2><p>Onder elke datum zie je een balkje met de tekst <strong>X / capaciteit ingeschreven</strong>. Zo weet je in een oogopslag hoe vol een datum zit. Heb je een minimum aantal deelnemers ingesteld, dan staat erbij of dat minimum gehaald is (groen) of hoeveel inschrijvingen er nog nodig zijn (amber). Zit een datum vol, dan wordt het balkje rood met de melding <strong>uitverkocht</strong>. Overgeslagen en samengevoegde datums krijgen geen balkje, want die tellen niet mee.</p><p>Zolang er nog geen tickets verkocht zijn, staat de teller op 0. Zodra de ticketverkoop live gaat, loopt de teller automatisch mee.</p><p>Beweeg je met de muis over een actieknop naast een datum, dan zie je nu ook wat die knop doet.</p>',
    updated_at = now()
WHERE doc_level = 'tenant'
  AND slug = 'ticket-product-datums'
  AND content NOT LIKE '%Inschrijvingen per datum%';
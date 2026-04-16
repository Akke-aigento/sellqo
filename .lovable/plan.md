
Plan: nieuwsbrief-flow herstellen zodat inschrijving ook effectief een klantrecord én mail oplevert

Wat ik heb nagekeken
- De inschrijving maakt wél records aan in `newsletter_subscribers`.
- Er verschijnen géén overeenkomstige records in `customers`.
- De welkomstmail wordt vanuit `storefront-api` doorgestuurd naar `send-transactional-email`, maar die functie staat momenteel niet in het project.
- Er is ook nog geen e-maildomein geconfigureerd voor dit project, dus app mails kunnen sowieso nog niet vertrekken.
- In de customer-upsert zit zeer waarschijnlijk een concrete bug: de insert naar `customers` stuurt een `source` veld mee, maar dat veld bestaat niet op de `customers` tabel. De fout wordt bovendien “non-fatal” gelogd en dus stil ingeslikt.

Aanpak

1. Fix klantcreatie in de nieuwsbrief-flow
- Bestand: `supabase/functions/storefront-api/index.ts`
- `newsletterSubscribe` aanpassen zodat de customer-upsert echt werkt:
  - ongeldig `source` veld verwijderen uit de `customers` insert
  - bestaande klant correct updaten met `email_subscribed = true`, `email_subscribed_at`, en tag `nieuwsbrief`
  - nieuwe klant aanmaken als `customer_type = 'prospect'` met tag `nieuwsbrief`
- De mutaties ook explicieter valideren zodat failures niet meer stil verdwijnen.

2. App mail-infrastructuur voorzien
- Eerst een sender domain instellen voor jullie domein.
- Daarna de ingebouwde app mail-infrastructuur opzetten, want `send-transactional-email` ontbreekt nu volledig.
- Zonder deze stap blijft de huidige fetch-call altijd doodlopen of niets bruikbaars doen.

3. Welkomstmail-template effectief toevoegen
- Een `tenant-welcome` template toevoegen en registreren binnen de app mail setup.
- Die template laten werken met de data die de nieuwsbrief-flow al doorstuurt:
  - onderwerp
  - body
  - voornaam
  - bedrijfsnaam
  - website-url
- Zo sluit dit aan op jullie bestaande editor met variabelen.

4. Silent failures verwijderen uit de flow
- In `storefront-api` de call naar de mailfunctie harden:
  - `response.ok` controleren
  - foutbody uitlezen en loggen
  - duidelijke logging toevoegen voor:
    - customer insert/update
    - welcome mail send
- Zo lijkt de flow niet langer “geslaagd” terwijl er in werkelijkheid niets verstuurd is.

5. End-to-end validatie
- Na implementatie de flow volledig nalopen:
  - nieuwsbriefinschrijving
  - record in `newsletter_subscribers`
  - record in `customers`
  - tag `nieuwsbrief`
  - `customer_type = prospect`
  - mail-aanmaak/verzendstatus
  - zichtbaarheid in klantlijst

Technische details
- Hoofdbestand voor de bugfix: `supabase/functions/storefront-api/index.ts`
- Extra werk nodig voor app mails omdat `send-transactional-email` momenteel ontbreekt
- Er is geen frontend-wijziging nodig voor de klantlijst zelf; die lijst leest al uit `customers`
- De kern van het probleem zit dus niet in de UI, maar in:
  1) falende customer insert
  2) ontbrekende mailinfrastructuur/template

Resultaat na uitvoering
- Elke nieuwsbriefinschrijving maakt of update een klantrecord
- Die klant verschijnt in de klantlijst als prospect met label/tag `nieuwsbrief`
- De welkomstmail vertrekt via de ingebouwde app mail-flow in plaats van een niet-bestaande functie

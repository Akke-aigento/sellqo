

# Plan: Fix newsletter subscription flow

## Problemen gevonden

1. **NewsletterSection roept de verkeerde functie aan**: De newsletter sectie op de storefront roept `newsletter-subscribe` aan (een losse edge function), terwijl de popup `storefront-api` met actie `newsletter_subscribe` aanroept. De storefront-api versie heeft extra logica voor welkomst-e-mails. Beide moeten dezelfde route gebruiken.

2. **Geen duidelijke success-state**: Na inschrijving verdwijnt de toast snel en reset het formulier — er is geen visuele bevestiging die blijft staan (bijv. "Bedankt, je bent ingeschreven!").

3. **Geen newsletter config aanwezig**: Er is geen `tenant_newsletter_config` record in de database, waardoor de instellingen (welkomstmail, provider, double opt-in) nooit worden geladen. De subscriber wordt aangemaakt maar er gebeurt verder niets.

## Wijzigingen

### 1. NewsletterSection: gebruik storefront-api in plaats van newsletter-subscribe
**Bestand:** `src/components/storefront/sections/NewsletterSection.tsx`

- Vervang `supabase.functions.invoke('newsletter-subscribe', ...)` door `supabase.functions.invoke('storefront-api', { body: { action: 'newsletter_subscribe', tenant_id: tenantId, email, source: 'website' } })`
- Dit zorgt ervoor dat dezelfde logica (welkomstmail, provider sync) wordt gebruikt als de popup

### 2. Success-state toevoegen aan NewsletterSection
**Bestand:** `src/components/storefront/sections/NewsletterSection.tsx`

- Voeg een `submitted` state toe
- Na succesvolle inschrijving: toon een "Bedankt voor je aanmelding!" bericht in plaats van het formulier
- Consistent met de popup die dit al doet

### 3. Success-state toevoegen aan NewsletterPopup
**Bestand:** `src/components/storefront/NewsletterPopup.tsx`

- De popup heeft al een success-state — geen wijzigingen nodig

## Technische details

**NewsletterSection.tsx** krijgt:
- Nieuwe `submitted` boolean state
- Na success: `setSubmitted(true)` in plaats van alleen `setEmail('')`  
- Conditionele rendering: formulier vs bedankbericht
- De `storefront-api` aanroep gebruikt dezelfde structuur als de popup

Geen database- of edge function-wijzigingen nodig — de `storefront-api` `newsletter_subscribe` actie werkt al correct.


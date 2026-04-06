

## Welkomstmail per tenant implementeren

### Huidige situatie
- De toggle `welcome_email_enabled` bestaat en wordt opgeslagen in `tenant_newsletter_config`
- Er is **geen code** die daadwerkelijk een welkomstmail verstuurt wanneer iemand zich aanmeldt
- Er is geen template of inhoud per tenant configureerbaar

### Wat er moet gebeuren

**1. Database: welkomstmail-inhoud per tenant opslaan**

Voeg kolommen toe aan `tenant_newsletter_config`:
```sql
ALTER TABLE tenant_newsletter_config 
  ADD COLUMN IF NOT EXISTS welcome_email_subject text DEFAULT 'Welkom bij onze nieuwsbrief!',
  ADD COLUMN IF NOT EXISTS welcome_email_body text DEFAULT '';
```

**2. Admin UI: welkomstmail configureren per tenant**

In `NewsletterSettings.tsx` — onder de "Welkomst Email" toggle een sectie toevoegen (alleen zichtbaar als toggle aan staat):
- **Onderwerp** — text input
- **Inhoud** — rich text editor (hergebruik `CampaignRichEditor`)
- Placeholder/default tekst als er nog niets is ingesteld

**3. Verzendlogica: welkomstmail sturen bij nieuwe subscriber**

In `storefront-api/index.ts` in de `newsletterSubscribe` functie:
- Na succesvolle inschrijving, check `welcome_email_enabled` uit de config
- Als true: haal `welcome_email_subject` en `welcome_email_body` op
- Verstuur via `supabase.functions.invoke('send-transactional-email', ...)` met een generiek template dat de tenant-specifieke body/subject gebruikt

**4. Email template: generiek "tenant-welcome" template**

Maak een `tenant-welcome.tsx` React Email template in `_shared/transactional-email-templates/` dat:
- `subject` accepteert als dynamic prop
- `body` (HTML string) accepteert als prop — gerenderd als tenant-specifieke content
- Tenant naam/logo bevat indien beschikbaar

### Bestanden

| Bestand | Actie |
|---|---|
| Database migration | `welcome_email_subject` + `welcome_email_body` kolommen |
| `src/components/admin/storefront/NewsletterSettings.tsx` | Editor voor welkomstmail content |
| `src/hooks/useNewsletterConfig.ts` | Nieuwe velden in interface |
| `supabase/functions/storefront-api/index.ts` | Welkomstmail versturen na subscribe |
| `supabase/functions/_shared/transactional-email-templates/tenant-welcome.tsx` | Nieuw template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Template registreren |

### Flow

```text
Klant meldt zich aan voor nieuwsbrief
  → storefront-api: newsletterSubscribe()
  → Check: welcome_email_enabled = true?
  → Ja: haal welcome_email_subject + welcome_email_body op
  → Roep send-transactional-email aan met tenant-welcome template
  → Klant ontvangt gepersonaliseerde welkomstmail van die specifieke tenant
```

### Geen conflict met bestaande email infra
Dit gebruikt het bestaande transactional email systeem — geen nieuwe edge functions nodig, alleen een nieuw template + aanroep.


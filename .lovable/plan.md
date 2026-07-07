## 1. Trigger-uitleg (info-tooltip)

In `src/components/admin/marketing/CampaignDialog.tsx`, bij het "Automatische trigger" gedeelte:

- Voeg een info-icoon (lucide `Info`) toe naast het label "Automatische trigger" (radio-optie) met een `Tooltip`/`HoverCard` die het verschil tussen doelgroep en trigger uitlegt:
  > *Doelgroep bepaalt wie de mail krijgt bij een eenmalige verzending. Een trigger stuurt de mail automatisch op elk moment dat een klant een gebeurtenis triggert (inschrijving, aankoop, verjaardag, …). "Welkomstmail — nieuwe klant" vuurt bij een nieuwe subscriber.*
- Voeg per triggeroptie in de dropdown een subtiele beschrijving toe (subline onder elk label):
  - Welkomstmail: "Bij nieuwe inschrijving op de nieuwsbrief"
  - Verlaten winkelmandje: "Wanneer een klant een winkelmandje niet afrondt"
  - Na aankoop: "X uur nadat een bestelling betaald is"
  - Verjaardag: "Op de verjaardag van de klant"
  - Heractivering — inactieve klant: "Wanneer een klant X dagen niets kocht"

Geen data-model of edge-function wijzigingen.

## 2. Multi-taal campagne editor (4 tabs, auto-routing)

### Data-model (migratie)

Nieuwe kolom op `email_campaigns`:

```sql
ALTER TABLE public.email_campaigns
  ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb;
-- shape: { "en": { subject, preview_text, html_content }, "fr": {...}, "de": {...} }
```

De bestaande kolommen `subject`, `preview_text`, `html_content` blijven de **default / NL versie**. Bij verzenden pakt de engine per klant `translations[preferred_language]` en valt terug op de defaults als die niet bestaat.

Nieuwe kolom (optioneel maar handig voor filtering):
```sql
ALTER TABLE public.email_campaigns
  ADD COLUMN available_languages text[] NOT NULL DEFAULT ARRAY['nl'];
```

Geen extra GRANT nodig (bestaande tabel).

### UI (`CampaignDialog.tsx`)

- Vervang de single-select "Taal" dropdown door een **multi-select toggle-groep** met NL/EN/FR/DE. NL is altijd verplicht (default fallback).
- Wanneer 2+ talen aangevinkt zijn: het "Onderwerp / Preview / Email content" blok wordt omhuld door een `<Tabs>` met één tab per geselecteerde taal. Elke tab bevat een eigen `subject`, `preview_text` en HTML/rich editor.
- Als slechts 1 taal aangevinkt is: geen tabs, gedraagt zich zoals nu.
- Bij opslaan: NL-inhoud → hoofdkolommen; overige talen → `translations` jsonb; `available_languages` → geselecteerde talen; `language` (bestaand veld) → `null` (want multi-lingual).

### Verzendlogica (`supabase/functions/send-campaign-batch/index.ts`)

- Als `available_languages.length > 1` (of `translations` niet leeg):
  - Skip de bestaande `campaign.language` recipient-filter (want we willen álle talen bereiken).
  - Per recipient: kies `recipient.preferred_language` als die in `available_languages` staat, anders de default (NL / hoofdkolommen).
  - Render onderwerp, preview en HTML uit `translations[lang]` of default.
- Bestaand gedrag voor single-language campagnes blijft ongewijzigd.

### Types

- Update `src/types/marketing.ts`: `EmailCampaign` krijgt `translations?: Record<'en'|'fr'|'de', { subject: string; preview_text?: string; html_content: string }>` en `available_languages?: string[]`.

## 3. Buiten scope

- AI-autovertaling knop (kan later als aparte feature).
- Per-taal aparte templates selecteren (voor nu deelt de campagne één basis-template; taal-tabs overschrijven de content).
- Analytics per taal (open/click uitsplitsing per taal).

## Technische details

- Migratie 1 losse call; front-end en edge function pas na goedkeuring.
- Edge function moet redeployed worden na wijziging (`send-campaign-batch`).
- Fallback-ketting bij render: `translations[preferred_language]` → `translations['nl']` (indien default niet NL) → hoofdkolommen.
- Bestaande campagnes blijven werken (translations = `{}`, `available_languages = ['nl']` via default).

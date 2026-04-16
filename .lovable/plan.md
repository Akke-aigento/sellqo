

# Plan: Variable inserter + HTML toggle voor welkomstmail editor

## Probleem
1. **Variabelen werken niet**: De welkomstmail body bevat `{{first_name}}` maar de edge function vervangt die niet — het stuurt de body ongewijzigd door naar `send-transactional-email`
2. **Geen variabele-inserter**: In de campagne-editor zit een `VariableInserter` component, maar die ontbreekt in de nieuwsbrief-instellingen
3. **Geen HTML toggle**: De campagne-editor heeft een visueel/HTML toggle, maar de welkomstmail editor heeft alleen de visuele editor

## Wijzigingen

### 1. VariableInserter + HTML toggle toevoegen aan NewsletterSettings
**Bestand:** `src/components/admin/storefront/NewsletterSettings.tsx`

- Importeer `VariableInserter` uit `@/components/admin/marketing/VariableInserter`
- Voeg een `editorMode` state toe (`'visual' | 'html'`)
- Voeg tabknoppen toe boven de editor (Visueel / HTML)
- In visuele modus: huidige `CampaignRichEditor` + `VariableInserter` eronder
- In HTML modus: een `<Textarea>` met de ruwe HTML
- `VariableInserter.onInsert` voegt de variabele in de body in (append bij HTML modus, of insert via editor in visuele modus)

### 2. Variabele-vervanging toevoegen in de edge function
**Bestand:** `supabase/functions/storefront-api/index.ts` (~regel 2634)

Vóór het versturen van de welkomstmail, doe regex-vervanging op de body:
```
body.replace(/\{\{first_name\}\}/g, firstName || '')
    .replace(/\{\{customer_email\}\}/g, email)
    .replace(/\{\{company_name\}\}/g, tenantName)
    .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
```

Dit volgt exact hetzelfde patroon als `send-campaign-batch/index.ts` (regel 114-119). We moeten de tenant naam ophalen (al beschikbaar via een extra select) en de unsubscribe URL genereren.

### 3. Subset variabelen voor welkomstmail
De `VariableInserter` toont nu alle klant-, bedrijfs- en systeemvariabelen. Voor de welkomstmail zijn slechts enkele relevant (we hebben geen volledige klantdata). We filteren de getoonde variabelen of voegen een `filter` prop toe:
- `{{first_name}}` — Voornaam (uit aanmelding)
- `{{customer_email}}` — E-mail
- `{{company_name}}` — Winkelnaam
- `{{unsubscribe_url}}` — Uitschrijflink

## Technische details

**NewsletterSettings.tsx** wijzigingen:
- Nieuwe state: `editorMode: 'visual' | 'html'`
- Tabs component boven editor
- VariableInserter onder editor met `onInsert` callback
- Bij HTML mode: textarea die direct `welcome_email_body` bewerkt

**storefront-api/index.ts** wijzigingen:
- Tenant naam ophalen (als dat nog niet gebeurt op dat punt)
- Regex replacements op `config.welcome_email_body` voordat het naar de email service gaat

## Bestanden
- `src/components/admin/storefront/NewsletterSettings.tsx` — UI uitbreiding
- `supabase/functions/storefront-api/index.ts` — Variabele vervanging


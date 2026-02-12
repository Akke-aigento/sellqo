

# Plan: AI Assistent - Geheugen & SEO Integratie

## Wat gaat er veranderen?

### 1. Generatie onthouden (niet meer wissen bij sluiten)
Nu wordt de gegenereerde tekst gewist zodra je de popover sluit. Straks blijft het laatste voorstel zichtbaar wanneer je de popover opnieuw opent. Alleen bij het klikken op "Opnieuw genereren" wordt er een nieuwe generatie gestart.

### 2. SEO Keywords meenemen in AI-suggesties
De AI houdt nu nog geen rekening met je ingestelde SEO-zoekwoorden. Straks worden je primaire SEO-keywords automatisch meegestuurd zodat de AI ze op een natuurlijke manier verwerkt in titels, beschrijvingen en meta-teksten. Dit sluit aan bij hoe de storefront copy-generator al werkt.

---

## Technische Details

### AIFieldAssistant.tsx
- De `onOpenChange` callback stopt met het wissen van `result` en `variations` bij sluiten. De state blijft behouden zolang het component gemount is.
- De expliciete "Sluiten" knop (X) sluit alleen de popover, zonder data te wissen.
- Alleen "Accepteer" wist de state (want dan is het voorstel toegepast).
- Alleen "Opnieuw genereren" overschrijft de bestaande generatie.
- Nieuwe prop `seoKeywords?: string[]` toegevoegd die wordt meegegeven aan de edge function.

### Plekken waar AIFieldAssistant wordt gebruikt (ProductForm, CategoryFormDialog, etc.)
- Waar beschikbaar worden de SEO-keywords via de bestaande `useSEOKeywords` hook opgehaald en als prop doorgegeven aan de `AIFieldAssistant`.

### Edge Function: ai-product-field-assistant
- Accepteert een nieuw optioneel veld `seoKeywords` in de request body.
- Als er keywords aanwezig zijn, worden ze in de systeemprompt opgenomen onder een "SEO KEYWORDS" sectie, met de instructie om ze natuurlijk te verwerken in de tekst.
- Dit is dezelfde aanpak die al gebruikt wordt in de `ai-generate-storefront-copy` functie, zodat alle AI-output consistent SEO-bewust is.

### Samenvatting wijzigingen
| Bestand | Wat |
|---|---|
| `src/components/admin/ai/AIFieldAssistant.tsx` | State behouden bij sluiten, SEO keywords prop |
| `src/pages/admin/ProductForm.tsx` | SEO keywords ophalen en doorgeven |
| `src/components/admin/CategoryFormDialog.tsx` | SEO keywords doorgeven |
| `supabase/functions/ai-product-field-assistant/index.ts` | SEO keywords in prompt verwerken |


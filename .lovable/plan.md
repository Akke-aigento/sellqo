
# AI Invulassistent voor Productvelden

## Overzicht
Een slimme AI-assistent die bij elk tekstveld een sterretjes-icoon toont waarmee tenants automatisch kwalitatieve teksten kunnen laten genereren. De assistent leert van context (productdata, categorie, toon) en biedt twee modi: automatisch voorstel en beschrijf-wat-je-wilt.

## Fasering
Dit is een groot feature-pakket. We splitsen het op in beheersbare fases:

### Fase 1: Kern Component + Edge Function (deze implementatie)
### Fase 2: Bulk AI + Marketplace-bewuste suggesties (vervolgstap)
### Fase 3: Upsell hints + uitbreiding naar alle pagina's (vervolgstap)

---

## Fase 1: Gedetailleerd Plan

### 1. Nieuw herbruikbaar component: `AIFieldAssistant`
**Bestand:** `src/components/admin/ai/AIFieldAssistant.tsx`

Een generiek component dat naast elk tekstveld geplaatst kan worden. Het vervangt de bestaande `AICopyButton` niet (die blijft voor de storefront visual editor), maar bouwt voort op hetzelfde patroon.

**Props:**
- `fieldType`: 'product_title' | 'short_description' | 'description' | 'meta_title' | 'meta_description' | 'specification_value' | 'bullet_point' | 'category_description' | 'page_content' | 'newsletter' | 'campaign'
- `currentValue`: huidige waarde van het veld
- `onApply`: callback om gegenereerde tekst toe te passen
- `context`: object met alle beschikbare productdata (naam, categorie, prijs, gewicht, etc.)
- `language`: taalcode (nl, en, fr, de) - voor taaldetectie
- `multiVariant`: boolean - of er meerdere varianten getoond moeten worden (voor langere velden)

**UI-gedrag:**
- Klein Sparkles-icoon naast het veld (7x7px, ghost variant)
- Klik opent een Popover met twee tabs: "Automatisch" en "Eigen briefing"
- Tab "Automatisch": klik op "Genereer" -> AI maakt voorstel op basis van context
- Tab "Eigen briefing": tekstveld voor kernwoorden/instructie + "Genereer" knop
- Bij `multiVariant=true`: toont 3 varianten (hergebruik `AICopyVariationsPopover` patroon)
- Bij `multiVariant=false`: toont 1 voorstel met "Accepteer", "Opnieuw" en "Aanpassen" knoppen
- Loading state met Loader2 spinner
- Credit kosten: 1 credit per generatie, 2 voor varianten

**Feature gate:**
- Component checkt `checkFeature('ai_copywriting')` via `useUsageLimits`
- Rendert niets als tenant geen AI-pakket heeft
- Credit check via `useAICredits` -> `hasCredits(1)`

### 2. Nieuwe Edge Function: `ai-product-field-assistant`
**Bestand:** `supabase/functions/ai-product-field-assistant/index.ts`

**Accepteert:**
```typescript
{
  fieldType: string,
  currentValue: string,
  action: 'auto_generate' | 'briefing_generate' | 'generate_variations' | 'rewrite' | 'shorter' | 'longer',
  briefing?: string,          // Optie B: eigen instructie
  language: string,           // nl, en, fr, de
  productContext: {
    name?: string,
    short_description?: string,
    description?: string,
    category_name?: string,
    price?: number,
    weight?: string,
    tags?: string[],
    specifications?: Record<string, string>,
    images?: string[],
  },
  existingTranslation?: string, // Tekst in andere taal als basis
}
```

**Logica:**
1. Authenticeer gebruiker, haal tenant_id op
2. Check en decrementeer AI credits (1 of 2)
3. Haal context op: tenant naam/branche, SEO keywords, learning patterns (hergebruik bestaande helpers uit `ai-generate-storefront-copy`)
4. Bouw field-specifiek systeem prompt:
   - Product context meegeven
   - SEO best practices voor meta-velden (lengte, keywords)
   - Taaldetectie: genereer in opgegeven taal
   - Als `existingTranslation` meegestuurd: gebruik als basis maar herschrijf
   - Marketplace richtlijnen als product gesynchroniseerd is
5. Call Lovable AI Gateway (google/gemini-3-flash-preview)
6. Log in `ai_usage_log`
7. Return gegenereerde tekst(en)

**CORS headers:** Uitgebreid met alle x-supabase-client headers (conform platform standaard).

**Runtime:** `Deno.serve` patroon.

### 3. Integratie in ProductForm
**Bestand:** `src/pages/admin/ProductForm.tsx`

Bij de volgende velden wordt `AIFieldAssistant` toegevoegd:
- **Naam** (product_title) - naast het label, single variant
- **Korte beschrijving** (short_description) - naast het label, single variant
- **Meta titel** (meta_title) - naast het label, single variant
- **Meta beschrijving** (meta_description) - naast het label, single variant

De context wordt samengesteld uit alle `form.watch()` waarden:
```typescript
const aiContext = {
  name: form.watch('name'),
  short_description: form.watch('short_description'),
  description: form.watch('description'),
  category_name: categories.find(c => c.id === form.watch('category_id'))?.name,
  price: form.watch('price'),
  weight: form.watch('weight'),
  tags: form.watch('tags'),
};
```

### 4. Integratie in ProductDescriptionEditor
**Bestand:** `src/components/admin/products/ProductDescriptionEditor.tsx`

- Voeg `AIFieldAssistant` toe in de toolbar (naast Undo/Redo)
- `multiVariant=true` voor beschrijving (3 varianten)
- `fieldType='description'`
- Gegenereerde HTML wordt in de TipTap editor gezet via `editor.commands.setContent()`

### 5. Config.toml update
Voeg de nieuwe edge function toe:
```toml
[functions.ai-product-field-assistant]
verify_jwt = false
```

### 6. Documentatie update
- Update tenant-documentatie (`doc_articles`) met uitleg over de AI Invulassistent
- Beschrijf de twee modi (automatisch en briefing)
- Uitleg over credits verbruik

---

## Technische details

### Component structuur
```text
AIFieldAssistant (nieuw)
  |-- Popover met 2 tabs
  |     |-- Tab "Automatisch": directe generatie
  |     |-- Tab "Eigen briefing": tekstveld + genereer
  |-- AICopyVariationsPopover (hergebruik, voor multiVariant)
  |-- SEOScorePreview (hergebruik, voor meta-velden)
  |-- Loading/Error states
```

### Credit flow
```text
Tenant klikt AI icoon
  -> Check ai_copywriting feature (useUsageLimits)
  -> Check credits beschikbaar (useAICredits)
  -> Call edge function
  -> Edge function: deduct credit + generate
  -> Return voorstel
  -> Tenant accepteert/verwerpt
  -> Bij acceptatie: useAILearning.learnFromEdit() als later bewerkt
```

### Bestanden die aangemaakt worden:
1. `src/components/admin/ai/AIFieldAssistant.tsx` - hoofdcomponent
2. `supabase/functions/ai-product-field-assistant/index.ts` - edge function

### Bestanden die gewijzigd worden:
1. `src/pages/admin/ProductForm.tsx` - AI iconen bij velden
2. `src/components/admin/products/ProductDescriptionEditor.tsx` - AI in toolbar
3. `supabase/config.toml` - nieuwe function registratie

### Niet in scope (Fase 2/3):
- Bulk AI generatie vanuit productoverzicht
- Marketplace-bewuste suggesties (Bol.com/Amazon richtlijnen)
- Upsell hints voor tenants zonder AI-pakket
- Uitbreiding naar categoriebeschrijvingen, pagina-content, nieuwsbrieven, campagnes
- AI bij specificatie-waardes en bullet points

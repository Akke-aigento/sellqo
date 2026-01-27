

# Plan: AI Copywriting Next Level Features

Dit plan beschrijft drie krachtige uitbreidingen die de AI Copywriting naar een hoger niveau tillen door integratie met bestaande systemen.

---

## Feature 1: A/B Test Variaties

### Wat het doet
Bij elke AI generatie krijgt de merchant 2-3 verschillende tekstvarianten te zien, zodat ze de beste kunnen kiezen.

### Gebruikerservaring
1. Klik op "✨ AI" → "Genereer variaties"
2. Popover toont 3 tekstopties met labels (A, B, C)
3. Elke optie heeft een korte stijlbeschrijving: "Zakelijk", "Speels", "Kort & Krachtig"
4. Merchant klikt op favoriet → tekst wordt geplaatst
5. Gekozen variant wordt opgeslagen voor learning (AI leert welke stijl preferred is)

### Technische Implementatie

**Edge Function aanpassing: `ai-generate-storefront-copy`**
- Nieuwe action type: `generate_variations`
- Retourneert array van 3 varianten met metadata
- Elke variant heeft: `text`, `style`, `keywords_used`

**Nieuwe component: `AICopyVariationsPopover.tsx`**
- Toont 3 varianten in kaarten
- Highlight bij hover
- Animatie bij selectie
- Radio-achtige selectie UI

**AICopyButton aanpassing:**
- Nieuwe menu-optie: "Genereer 3 variaties"
- Bij keuze wordt variant + rejected alternatieven naar learning gestuurd

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/ai-generate-storefront-copy/index.ts` | Nieuwe `generate_variations` action |
| `src/components/admin/storefront/visual-editor/AICopyButton.tsx` | Nieuwe menu-optie + state voor variaties |
| `src/components/admin/storefront/visual-editor/AICopyVariationsPopover.tsx` | Nieuw: varianten selector UI |

---

## Feature 2: Live SEO Score Preview

### Wat het doet
Bij AI-gegenereerde tekst direct een SEO score preview tonen, zodat de merchant weet hoe goed de tekst scoort voordat ze accepteren.

### Gebruikerservaring
1. AI genereert tekst
2. Onder de tekst verschijnt een compacte score card:
   - Keyword match: ✅ 2 van 3 keywords gebruikt
   - Lengte: ✅ Optimaal (8 woorden)
   - Leesbaarheid: ✅ Goed
   - Overall: 92/100 (groen)
3. Tips voor verbetering als score <80
4. Merchant kan accepteren of opnieuw genereren

### Technische Implementatie

**Bestaande SEO logica hergebruiken:**
De `ai-seo-analyzer` heeft al scoring logica. We maken een **lightweight client-side scorer** voor instant feedback.

**Nieuwe utility: `calculateQuickSEOScore.ts`**
```typescript
// Client-side snelle SEO check (geen API call nodig)
function calculateQuickSEOScore(text: string, keywords: string[], fieldType: string) {
  // Keyword presence check
  // Length optimization check  
  // Readability (sentence length)
  return { score, breakdown: { keywords, length, readability } }
}
```

**SEO Keywords cachen:**
- Bij eerste AI generatie worden primaire keywords opgehaald
- Cached in React Query voor instant access
- Doorgegeven aan scorer

**Nieuwe component: `SEOScorePreview.tsx`**
- Compact inline display
- Color-coded score (groen/oranje/rood)
- Uitklapbare breakdown
- Suggesties voor verbetering

| Bestand | Wijziging |
|---------|-----------|
| `src/utils/calculateQuickSEOScore.ts` | Nieuw: client-side SEO scorer |
| `src/components/admin/storefront/visual-editor/SEOScorePreview.tsx` | Nieuw: score preview component |
| `src/components/admin/storefront/visual-editor/AICopyButton.tsx` | Toon SEO score na generatie |
| `src/hooks/useSEOKeywords.ts` | Nieuw: hook voor keyword caching |

---

## Feature 3: Business Coach Storefront Suggesties

### Wat het doet
De AI Business Coach analyseert trends en stelt proactief storefront-verbeteringen voor, zoals:
- "Je bestseller is [Product X], zal ik een Hero-sectie genereren?"
- "Black Friday is over 14 dagen, tijd voor een actie-banner?"
- "Je hebt 200 nieuwe nieuwsbriefabonnees, highlight dit in je Hero!"

### Gebruikerservaring
1. In het Notification Center verschijnt een Coach suggestie met 🏠 icoon
2. Suggestie toont preview van wat gegenereerd zou worden
3. Quick Actions:
   - "Genereer Hero" → Opent Visual Editor met AI-gegenereerde content
   - "Pas sectie aan" → Opent editor met suggesties ingevuld
   - "Stel uit" / "Niet relevant"
4. Bij acceptatie wordt de AI copy functie automatisch aangeroepen

### Technische Implementatie

**Business Coach uitbreiden:**
De bestaande `ai-business-coach` edge function krijgt een nieuw analyse type: `storefront`.

**Nieuwe analyses:**
| Analyse | Trigger | Suggestie |
|---------|---------|-----------|
| Bestseller Hero | Product >50% boven gemiddelde verkopen | "Spotlight je bestseller [X] in de Hero" |
| Seizoen Banner | Feestdag <14 dagen | "Maak een [Feestdag] actie-banner" |
| Social Proof | >100 reviews OF >500 nieuwsbrief | "Toon je populariteit in de storefront" |
| Nieuwe Collectie | >10 nieuwe producten in 7 dagen | "Introduceer je nieuwe collectie" |

**Nieuwe suggestie types in `ai_action_suggestions`:**
- `storefront_hero_update`
- `storefront_seasonal_banner`
- `storefront_social_proof`

**Quick Action executie:**
Bij klik op "Genereer Hero":
1. Navigeer naar Visual Editor
2. Open Hero sectie in edit mode
3. Trigger AI copy generatie met pre-filled context (bestseller naam, seizoen, etc.)

**Nieuwe componenten:**

| Component | Doel |
|-----------|------|
| Uitbreiding `ai-business-coach/index.ts` | Nieuwe `analyzeStorefront()` functie |
| `StorefrontCoachSuggestion.tsx` | Speciale UI voor storefront suggesties met preview |

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/ai-business-coach/index.ts` | Nieuwe storefront analyse + suggestie types |
| `src/types/aiCoach.ts` | Nieuwe AnalysisType: 'storefront' |
| `src/components/admin/notifications/AICoachNotificationItem.tsx` | Speciale rendering voor storefront suggesties |
| `src/components/admin/notifications/QuickActionButton.tsx` | Nieuwe action type: 'open_visual_editor' |

---

## Implementatie Volgorde

```text
Week 1: A/B Test Variaties
├── Edge function: generate_variations action
├── AICopyVariationsPopover component  
├── Learning integration (track chosen variant)
└── UI polish & animaties

Week 2: SEO Score Preview
├── Client-side SEO scorer utility
├── useSEOKeywords hook voor caching
├── SEOScorePreview component
└── Integratie in AICopyButton

Week 3: Business Coach Storefront
├── analyzeStorefront() in edge function
├── Nieuwe suggestie types in database
├── StorefrontCoachSuggestion UI
└── Quick Action: open_visual_editor
```

---

## Bestanden Overzicht

### Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `src/components/admin/storefront/visual-editor/AICopyVariationsPopover.tsx` | Keuze UI voor 3 varianten |
| `src/components/admin/storefront/visual-editor/SEOScorePreview.tsx` | Inline SEO score display |
| `src/utils/calculateQuickSEOScore.ts` | Client-side SEO scoring |
| `src/hooks/useSEOKeywords.ts` | Keyword caching hook |

### Aangepaste bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/ai-generate-storefront-copy/index.ts` | Variaties generatie |
| `src/components/admin/storefront/visual-editor/AICopyButton.tsx` | Variaties + SEO preview |
| `supabase/functions/ai-business-coach/index.ts` | Storefront analyse |
| `src/types/aiCoach.ts` | Nieuwe types |
| `src/components/admin/notifications/AICoachNotificationItem.tsx` | Storefront suggestie UI |
| `src/components/admin/notifications/QuickActionButton.tsx` | Visual Editor action |

---

## AI Credits Verbruik

| Feature | Credits |
|---------|---------|
| Genereer 1 variant | 1 credit |
| Genereer 3 variaties | 2 credits (bulk discount) |
| Business Coach analyse | 0 credits (automatisch) |

---

## Resultaat

Na implementatie:

| Voorheen | Nu |
|----------|-----|
| 1 AI-suggestie per keer | 3 variaties om uit te kiezen |
| Geen SEO feedback | Instant SEO score preview |
| Handmatige storefront updates | Proactieve Coach suggesties |
| AI werkt reactief | AI werkt proactief + reactief |

**Merchant voordelen:**
- Sneller de juiste tekst vinden (A/B variaties)
- Direct weten of tekst SEO-proof is (score preview)
- Nooit meer missen van seizoens-opportuniteiten (Coach suggesties)


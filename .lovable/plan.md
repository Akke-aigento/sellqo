
# Plan: AI Copywriting Verbinden met SEO & Marketing Ecosysteem

## Huidige Situatie

De Visual Editor AI (`ai-generate-storefront-copy`) werkt momenteel **geïsoleerd**:
- Gebruikt alleen basis tenant context (naam, branche, toon)
- Houdt **geen** rekening met SEO keywords
- Haalt **geen** marketing context op (bestsellers, seizoen, campagnes)
- Leert **niet** van gebruikersbewerkingen
- Is niet verbonden met de andere AI functies

## Wat Jullie Al Hebben (Sterk Ecosysteem!)

| Component | Functie |
|-----------|---------|
| `ai-marketing-context` | Verzamelt bedrijfsdata: bestsellers, seizoen, feestdagen, klantsegmenten |
| `ai-learning-patterns` | Leert toon, lengte en stijlvoorkeuren van merchant |
| `seo_keywords` tabel | Bijgehouden keywords per product/categorie met zoekvolume en intent |
| `ai-seo-analyzer` | Analyseert en scoort SEO van alle content |
| `ai-learn-from-feedback` | Leert van bewerkingen die merchants maken |

## Nieuwe Architectuur

De Storefront Copy AI wordt een **volwaardige deelnemer** in het ecosysteem:

```text
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED AI CONTEXT                        │
├─────────────────────────────────────────────────────────────┤
│  Marketing Context    │  SEO Keywords     │  User Patterns  │
│  - Bestsellers        │  - Primary KWs    │  - Toon         │
│  - Seizoen/Feestdag   │  - Zoekintentie   │  - Lengte       │
│  - Featured Products  │  - Zoekvolume     │  - Stijl        │
└───────────┬───────────┴────────┬──────────┴────────┬────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              ai-generate-storefront-copy                    │
│   Genereert copy met SEO-optimalisatie & persoonlijke stijl │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                 ai-learn-from-feedback                      │
│    Als merchant bewerkt → leert voor volgende generaties    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### 1. Edge Function Uitbreiden: `ai-generate-storefront-copy`

**Nieuwe features:**
- Haalt marketing context op via interne functie
- Laadt primaire SEO keywords voor de tenant
- Past geleerde stijlpatronen toe
- Stuurt feedback terug voor learning

**Aanpassingen in de edge function:**

```typescript
// NIEUW: Haal rijke context op
const [marketingContext, seoKeywords, learningPatterns] = await Promise.all([
  fetchMarketingContext(supabase, tenantId),
  fetchSEOKeywords(supabase, tenantId),
  fetchLearningPatterns(supabase, tenantId, userId),
]);

// NIEUW: Bouw SEO-bewuste prompt
const systemPrompt = buildEnhancedSystemPrompt({
  tenant: marketingContext.business,
  primaryKeywords: seoKeywords.filter(k => k.is_primary),
  seasonality: marketingContext.seasonality,
  learningPatterns,
  fieldType,
  sectionType,
});
```

**Nieuwe helper functies:**

| Functie | Doel |
|---------|------|
| `fetchMarketingContext()` | Haalt bedrijfsdata, seizoenaliteit, bestsellers op |
| `fetchSEOKeywords()` | Laadt primaire keywords voor de webshop |
| `fetchLearningPatterns()` | Haalt geleerde stijlvoorkeuren op |
| `buildEnhancedSystemPrompt()` | Bouwt context-bewuste prompt |

### 2. SEO-Bewuste Prompt Structuur

De AI krijgt nu context over:

```typescript
// Voorbeeld systeem prompt
`Je bent een Nederlandse copywriter gespecialiseerd in e-commerce.

BEDRIJFSCONTEXT:
- Naam: ${businessName}
- Branche: ${industry}
- Bestsellers: ${bestsellers.join(', ')}

SEO RICHTLIJNEN:
- Primaire keywords: ${primaryKeywords.join(', ')}
- Focus op zoekintentie: ${dominantIntent}
- Gebruik keywords natuurlijk, niet geforceerd

SEIZOENALITEIT:
- Huidige seizoen: ${season}
- Aankomende feestdag: ${upcomingHoliday} (over ${daysUntil} dagen)

PERSOONLIJKE STIJL (geleerd van jouw bewerkingen):
- Toon: ${learnedTone || 'professioneel'}
- Voorkeur lengte: ${learnedLength || 'beknopt'}
- Emoji gebruik: ${learnedEmoji || 'minimaal'}
`
```

### 3. Learning Loop Aansluiten

**In de frontend (InlineTextEditor):**
- Track wanneer merchant AI-gegenereerde tekst bewerkt
- Stuur origineel + bewerkt naar `ai-learn-from-feedback`

**Nieuwe prop in AICopyButton:**
```typescript
interface AICopyButtonProps {
  // ... bestaande props
  onTextEdited?: (original: string, edited: string) => void; // NIEUW
}
```

**In InlineTextEditor:**
```typescript
// Bij save, check of tekst AI-gegenereerd was en bewerkt
const handleSave = useCallback(() => {
  const newValue = editorRef.current?.textContent || '';
  if (lastAIGenerated && newValue !== lastAIGenerated) {
    // Stuur naar learning system
    learnFromEdit(lastAIGenerated, newValue);
  }
  onSave(newValue);
}, [lastAIGenerated, onSave]);
```

### 4. Frontend Updates

**Bestand: `AICopyButton.tsx`**
- Voeg `tenantId` prop toe
- Stuur context mee bij genereren
- Track gegenereerde tekst voor learning

**Bestand: `InlineTextEditor.tsx`**
- Track `lastAIGenerated` state
- Trigger learning bij bewerkingen

**Nieuwe hook: `useAILearning.ts`**
```typescript
export function useAILearning() {
  const learnFromEdit = async (original: string, edited: string, feature: string) => {
    await supabase.functions.invoke('ai-learn-from-feedback', {
      body: { original, edited, feature: 'storefront_copy' }
    });
  };
  
  return { learnFromEdit };
}
```

---

## Bestanden Overzicht

### Aangepaste bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/ai-generate-storefront-copy/index.ts` | Volledige uitbreiding met context, SEO en learning |
| `src/components/admin/storefront/visual-editor/AICopyButton.tsx` | Track gegenereerde tekst, voeg tenantId toe |
| `src/components/admin/storefront/visual-editor/InlineTextEditor.tsx` | Track bewerkingen voor learning |

### Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `src/hooks/useAILearning.ts` | Hook voor learning feedback loop |

---

## Resultaat

Na deze uitbreiding:

| Feature | Voorheen | Nu |
|---------|----------|-----|
| SEO Keywords | ❌ Niet gebruikt | ✅ Primaire keywords in prompts |
| Seizoenaliteit | ❌ Geen context | ✅ Seizoen + feestdagen |
| Bestsellers | ❌ Niet bekend | ✅ Verwerkt in context |
| Persoonlijke stijl | ❌ Altijd generiek | ✅ Leert van bewerkingen |
| Learning loop | ❌ Niet aanwezig | ✅ Actief lerend |

**Voorbeeld output verschil:**

Zonder context:
> "Ontdek onze collectie"

Met volledige context:
> "Winterjas nodig? Onze bestseller Parka Pro nu met gratis verzending – ideaal voor Sinterklaas!"

---

## Implementatie Volgorde

1. **Fase 1**: Edge function uitbreiden met context ophalen
2. **Fase 2**: SEO keywords integreren in prompts  
3. **Fase 3**: Learning loop aansluiten
4. **Fase 4**: Frontend aanpassen voor tracking

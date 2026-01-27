

# Plan: Marketing Pagina Herstructurering - Van Samenraapsel naar Samenhangend Verhaal

## Probleemanalyse

Na grondige analyse van alle 12 landing page secties identificeer ik de volgende problemen:

### 1. Incoherente Narrative Flow

| Huidige Volgorde | Probleem |
|------------------|----------|
| Hero -> Social Proof -> **Problem** -> Features | Problemen komen NA de oplossing wordt getoond |
| Features -> Modules Grid -> Why SellQo | **Dubbele feature secties** die overlappen |
| Comparison -> Pricing -> Testimonials -> Demo | Demo komt TE LAAT, testimonials staan niet bij social proof |

### 2. Overlappende & Redundante Secties

| Sectie | Overlap met |
|--------|-------------|
| **FeaturesSection** (10 bento cards) | ModulesGrid (16 modules) - zelfde info anders verpakt |
| **WhySellqoSection** (4 redenen) | Comparison table - "waarom SellQo" vs concurrenten |
| **ModulesGrid** | Pricing features - lijsten overlappen |

### 3. Messaging Inconsistenties

| Plek | Zegt | Probleem |
|------|------|----------|
| WhySellqo | "Business plan" migratie | Er is geen Business plan, wel Enterprise |
| FAQ | "€9 per 500 AI credits" | Pricing toont €19 per pack |
| SocialProof | "500+ ondernemers" | Statistieken tonen "€2.4M verwerkt" wat klein lijkt voor 500 shops |

### 4. Ontbrekende Unieke Selling Points

De USPs die jullie onderscheiden zijn NIET prominent:

- 5-minuten setup wizard
- Shop Health Score
- AI Business Coach
- Gamification & Badges
- Bank Transfer QR (€0 transactiekosten)
- Bol.com VVB Labels

### 5. Placeholder Content

- **DemoSection**: Lege placeholder zonder echte video/demo
- **Testimonials**: Fictieve namen en bedrijven
- **Logo carousel**: Alleen tekst, geen echte logo's of partners

---

## Voorgestelde Nieuwe Structuur

### Storytelling Flow

```text
EMOTIONELE HOOK
1. Hero - "Jouw Online Imperium, Volledig Onder Controle"
2. Social Proof (kort) - "500+ ondernemers vertrouwen SellQo"

PROBLEEM IDENTIFICATIE  
3. Problem Section - "Herken je dit?" (frustraties)

OPLOSSING INTRODUCTIE
4. Solution Overview (NIEUW) - Korte intro hoe SellQo helpt

UNIEKE DIFFERENTIATORS
5. Unique Advantages (NIEUW) - 5-min setup, Shop Health, AI Coach, Gamification

FEATURES (GECONSOLIDEERD)
6. Core Features - Gecombineerde FeaturesSection + ModulesGrid

BEWIJS
7. Comparison Table - SellQo vs concurrenten
8. Testimonials - Klantquotes met resultaten

ACTIE
9. Pricing - Duidelijke tiers
10. FAQ - Veelgestelde vragen
11. Final CTA - Start gratis
```

### Verwijderen/Samenvoegen

| Actie | Sectie | Reden |
|-------|--------|-------|
| **Verwijderen** | ModulesGrid | Overlap met Features |
| **Verwijderen** | DemoSection | Placeholder zonder content |
| **Samenvoegen** | WhySellqoSection -> nieuwe "UniqueAdvantagesSection" | Focus op echte USPs |
| **Verplaatsen** | Testimonials -> direct na Comparison | Bewijs na vergelijking |

---

## Gedetailleerde Implementatie

### Fase 1: Nieuwe "SolutionOverviewSection"

**Doel**: Bridge tussen probleem en features - kort en krachtig

```text
┌─────────────────────────────────────────────────────────────┐
│ "SellQo Maakt Het Anders"                                   │
│                                                              │
│ [Icoon] Alles in één      [Icoon] Live in 5 min            │
│ dashboard                  geen technische kennis nodig     │
│                                                              │
│ [Icoon] AI die meedenkt   [Icoon] Gebouwd voor             │
│ niet alleen rapporteert    België & Nederland               │
└─────────────────────────────────────────────────────────────┘
```

**Nieuw bestand**: `src/components/landing/SolutionOverviewSection.tsx`

### Fase 2: Nieuwe "UniqueAdvantagesSection"

**Vervangt**: WhySellqoSection
**Focus**: Wat jullie UNIEK maakt vs wat iedereen biedt

```text
┌─────────────────────────────────────────────────────────────┐
│ "Wat SellQo Uniek Maakt"                                    │
├─────────────────────────────────────────────────────────────┤
│ ⚡ 5-Minuten Setup           │ 📊 Shop Health Score         │
│ Live in 5 minuten,           │ Real-time gezondheid van je  │
│ geen developer nodig         │ shop: voorraad, marges, SEO  │
├─────────────────────────────────────────────────────────────┤
│ 🤖 Proactieve AI Coach       │ 🎮 Gamification              │
│ Krijg advies VOORDAT er      │ Badges, milestones en        │
│ problemen ontstaan           │ "vandaag verdien je..."      │
├─────────────────────────────────────────────────────────────┤
│ 💸 €0 Transactiekosten       │ 📦 Bol.com VVB Labels        │
│ Bank Transfer QR-codes       │ Direct verzenden via         │
│ = geen Stripe fees           │ Bol.com fulfillment          │
└─────────────────────────────────────────────────────────────┘
```

**Nieuw bestand**: `src/components/landing/UniqueAdvantagesSection.tsx`

### Fase 3: Consolideer FeaturesSection

**Huidige**: 10 bento cards met overlappende info
**Nieuw**: 6 kerncategorieën met duidelijke voordelen

```text
┌─────────────────────────────────────────────────────────────┐
│ 🛒 Verkoop Overal            │ 📦 Nooit Meer Uitverkocht    │
│ Webshop, POS, Bol.com,       │ Real-time sync tussen        │
│ Amazon - 1 dashboard         │ alle kanalen                 │
├─────────────────────────────────────────────────────────────┤
│ 🎁 8 Promotietypen           │ 💰 Slimme Financiën          │
│ Van kortingscodes tot        │ Facturen, BTW, Peppol,       │
│ loyaliteitspunten            │ winstmarges per product      │
├─────────────────────────────────────────────────────────────┤
│ 🤖 AI Marketing              │ 📈 Groei Insights            │
│ Content, beschrijvingen,     │ Trends, best sellers,        │
│ afbeeldingen genereren       │ optimale prijspunten         │
└─────────────────────────────────────────────────────────────┘
```

### Fase 4: Update PricingSection

**Problemen**:
- "Business plan" referentie in andere secties die niet bestaat
- Transactiekosten uitleg is verwarrend

**Fixes**:
- Duidelijkere AI credits uitleg
- Bank Transfer QR prominent als "€0 alternatief"
- Peppol badge "Verplicht 2026" behouden

### Fase 5: Fix Inconsistenties

| Bestand | Fix |
|---------|-----|
| WhySellqoSection.tsx | "Business plan" -> "Enterprise plan" |
| FaqSection.tsx | "€9 per 500 credits" -> "€19 per 500 credits" (of huidige prijzen) |
| SocialProofSection.tsx | Meer realistische statistieken of verwijderen |

### Fase 6: Update Landing.tsx Volgorde

```typescript
// NIEUW
<HeroSection />
<SocialProofSection /> // Verkort: alleen stats, geen logos
<ProblemSection />
<SolutionOverviewSection /> // NIEUW
<UniqueAdvantagesSection /> // NIEUW - vervangt WhySellqo
<FeaturesSection /> // Geconsolideerd
// VERWIJDERD: ModulesGrid
<ComparisonSection />
<TestimonialsSection /> // Verplaatst: na comparison
<PricingSection />
<FaqSection />
<FinalCtaSection />
// VERWIJDERD: DemoSection (placeholder)
```

---

## Bestanden Overzicht

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `SolutionOverviewSection.tsx` | Korte bridge tussen probleem en features |
| `UniqueAdvantagesSection.tsx` | 6 unieke USPs die concurrenten niet hebben |

### Aangepaste Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `Landing.tsx` | Nieuwe sectievolgorde, verwijder ModulesGrid en DemoSection |
| `FeaturesSection.tsx` | Consolideer naar 6 kerncategorieën |
| `SocialProofSection.tsx` | Verwijder logo carousel, focus op stats |
| `ProblemSection.tsx` | Kleine tekstaanpassingen |
| `FaqSection.tsx` | Fix prijsinconsistentie (€19 ipv €9) |
| `TestimonialsSection.tsx` | Eventueel meer resultaat-gefocust |

### Verwijderde Bestanden

| Bestand | Reden |
|---------|-------|
| `ModulesGrid.tsx` | Overlap met FeaturesSection |
| `DemoSection.tsx` | Placeholder zonder echte content |
| `WhySellqoSection.tsx` | Vervangen door UniqueAdvantagesSection |

---

## Visuele Verbeteringen

### 1. Consistente Card Styling
- Alle secties gebruiken `rounded-2xl border border-border shadow-sellqo`
- Hover effect: `hover:shadow-sellqo-lg hover:-translate-y-1`

### 2. Kleurgebruik
- Primary (navy): Headers, icoon achtergronden
- Accent (oranje): CTAs, highlights, badges
- Green: Succesvolle acties, checkmarks, positieve stats

### 3. Spacing
- Secties: `py-20 md:py-28` consistent
- Alternerende achtergronden: `bg-background` vs `bg-secondary/20`

---

## Verwacht Resultaat

### Voor Bezoekers

| Voorheen | Nu |
|----------|-----|
| 12 secties, veel overlap | 10 secties, logische flow |
| USPs verstopt | USPs prominent in eigen sectie |
| Placeholder demo | Geen lege beloftes |
| Verwarrende vergelijking | Duidelijk "waarom SellQo" |

### Voor Conversie

| Metric | Verwacht Effect |
|--------|-----------------|
| Time on page | +20% door betere flow |
| Scroll depth | +15% door minder herhaling |
| CTA clicks | +25% door duidelijkere USPs |
| Bounce rate | -10% door coherent verhaal |


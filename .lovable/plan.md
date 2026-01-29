

# Plan: Prijzen Excl. BTW Indicatie + Billing Pagina Herstel

## Samenvatting

Dit plan lost twee problemen op:
1. **Marketing pagina's**: Duidelijk vermelden dat prijzen exclusief BTW zijn
2. **Admin Billing pagina crash**: ReferenceError fixen + plan vergelijkingstabel toevoegen

---

## Probleem 1: Prijzen Excl. BTW

### Huidige Situatie
De marketing pagina's (`/`, `/pricing`) tonen prijzen zonder BTW-indicatie. Dit is verwarrend voor klanten, vooral in B2B context waar prijzen typisch excl. BTW worden getoond.

### Oplossing
Voeg een duidelijke BTW-disclaimer toe aan alle prijzen secties:

| Locatie | Wijziging |
|---------|-----------|
| `PricingSection.tsx` (Landing) | Footer tekst: "Alle prijzen exclusief BTW" |
| `Pricing.tsx` (Standalone) | Dezelfde footer tekst |
| Prijsweergave | Optioneel: kleine "excl. BTW" badge naast prijzen |

### Implementatie

**Bestand: `src/components/landing/PricingSection.tsx`**
- Regel 356-368: Voeg "Alle prijzen exclusief BTW" toe aan de bestaande footer
- Styling: Subtiele tekst onder de Stripe kosten melding

**Bestand: `src/pages/Pricing.tsx`**
- Voeg vergelijkbare disclaimer toe onder de plan cards
- Tekst: "Alle prijzen zijn exclusief BTW"

---

## Probleem 2: Billing Pagina Crash

### Oorzaak
In `src/pages/admin/Billing.tsx` op regel 128:
```typescript
const switchablePlans = plans.filter(p => p.id !== currentPlan?.id && p.id !== 'free');
```

`currentPlan` wordt hier gebruikt VOOR het is gedeclareerd op regel 142:
```typescript
const currentPlan = subscription?.pricing_plan || plans.find(p => p.id === 'free');
```

Dit veroorzaakt: `ReferenceError: Cannot access 'R' before initialization`

### Fix
Verplaats de `currentPlan` declaratie naar VOOR `switchablePlans`.

---

## Probleem 3: Billing Pagina Redesign

### Huidige Situatie
De billing pagina toont alleen een dropdown met plannen. De gebruiker ziet niet wat hij krijgt of verliest bij een plan wijziging totdat hij klikt.

### Gewenste Situatie
Een visuele tabel vergelijkbaar met de marketing pagina met:
- Alle plannen naast elkaar
- Huidig plan gemarkeerd met badge
- Hogere plannen: "Upgrade" knop + wat je erbij krijgt (groen)
- Lagere plannen: "Downgrade" knop + wat je verliest (rood)

### Nieuwe Component: `PlanComparisonTable`

```text
Ontwerp (referentie: marketing pagina screenshot):

┌─────────┬──────────┬──────────┬─────────────┐
│  Free   │ Starter  │   Pro    │ Enterprise  │
├─────────┼──────────┼──────────┼─────────────┤
│ Gratis  │ €29/mnd  │ €79/mnd  │ €199/mnd    │
├─────────┼──────────┼──────────┼─────────────┤
│ [badge: │          │ [badge:  │             │
│ Downgrade│          │ Huidig   │ [Upgrade]   │
│ -7 features]        │  plan]   │ +12 features│
└─────────┴──────────┴──────────┴─────────────┘
```

### Features Vergelijking Logica

Voor elk plan berekenen:
- `features.gained`: Features in target plan die niet in current plan zitten
- `features.lost`: Features in current plan die niet in target plan zitten
- Limits vergelijking (producten, orders, klanten)

---

## Technische Implementatie

### Fase 1: Bug Fix (Kritiek)

**Bestand: `src/pages/admin/Billing.tsx`**

Huidige code (fout):
```typescript
// Regel 128 - VOOR currentPlan is gedeclareerd
const switchablePlans = plans.filter(p => p.id !== currentPlan?.id && p.id !== 'free');

// ... loading check ...

// Regel 142 - currentPlan wordt pas hier gedeclareerd
const currentPlan = subscription?.pricing_plan || plans.find(p => p.id === 'free');
```

Nieuwe code (fix):
```typescript
// currentPlan EERST declareren
const currentPlan = subscription?.pricing_plan || plans.find(p => p.id === 'free');

// switchablePlans NA currentPlan
const switchablePlans = plans.filter(p => p.id !== currentPlan?.id && p.id !== 'free');
```

### Fase 2: Excl. BTW Indicator

**Bestanden:**
- `src/components/landing/PricingSection.tsx`
- `src/pages/Pricing.tsx`

Toevoegen aan footer sectie:
```typescript
<p className="text-sm text-muted-foreground">
  Alle prijzen zijn exclusief BTW
</p>
```

### Fase 3: Plan Vergelijkingstabel (Optioneel upgrade)

**Nieuw component: `src/components/admin/billing/PlanComparisonCards.tsx`**

Props:
- `plans`: Array van PricingPlan
- `currentPlanId`: string
- `currentInterval`: 'monthly' | 'yearly'
- `onSelectPlan`: (planId: string, isUpgrade: boolean) => void

Logica:
1. Sorteer plannen op prijs (laag → hoog)
2. Bepaal index van huidig plan
3. Voor elk plan:
   - Index < current = Downgrade (toon verloren features in rood)
   - Index = current = "Huidig plan" badge
   - Index > current = Upgrade (toon nieuwe features in groen)

---

## Visueel Ontwerp Referentie

Op basis van de marketing pagina screenshot:

| Element | Stijl |
|---------|-------|
| Plan cards | Wit met border, schaduw bij highlighted |
| Huidig plan | Ring-2 ring-primary + "Huidig plan" badge |
| Upgrade | Groene CTA button, "+N features" badge |
| Downgrade | Outline button, "-N features" badge in rood |
| Features lijst | Checkmarks (groen) / X (grijs) |
| Prijs | Groot, bold + "excl. BTW" subscript |

---

## Bestanden Overzicht

| Bestand | Actie | Prioriteit |
|---------|-------|------------|
| `src/pages/admin/Billing.tsx` | Fix variabele volgorde + redesign | Kritiek |
| `src/components/landing/PricingSection.tsx` | BTW disclaimer toevoegen | Hoog |
| `src/pages/Pricing.tsx` | BTW disclaimer toevoegen | Hoog |
| `src/components/admin/billing/PlanComparisonCards.tsx` | Nieuw component | Medium |

---

## Verwachte Resultaat

1. **Billing pagina werkt weer** - geen crash meer
2. **Duidelijke BTW indicatie** - klanten weten dat prijzen excl. BTW zijn
3. **Visuele plan vergelijking** - gebruikers zien precies wat ze krijgen/verliezen bij upgrade/downgrade
4. **Consistente styling** - admin billing lijkt op marketing pagina


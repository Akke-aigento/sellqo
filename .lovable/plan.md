

# Marketing Landing Page - Layout Fixes (Desktop & Mobile)

## Geïdentificeerde Problemen

### Desktop (Screenshots 1-2)
De FeaturesSection toont "witte gaten" in het grid omdat:
- Het grid is 3 kolommen breed (`lg:grid-cols-3`)
- Sommige cards hebben `gridSpan: 2` (beslaan 2 kolommen)
- De huidige volgorde zorgt ervoor dat er 1-kolom gaten ontstaan

**Huidige volgorde en spans:**
| # | Feature | Span | Rij |
|---|---------|------|-----|
| 1 | Multi-Channel Verkoop | 2 | Rij 1: 2 cols |
| 2 | Voorraadsync | 1 | Rij 1: + 1 = 3 ✅ |
| 3 | AI Marketing Suite | 2 | Rij 2: 2 cols |
| 4 | AI SEO | 1 | Rij 2: + 1 = 3 ✅ |
| 5 | Promotietypen | 2 | Rij 3: 2 cols |
| 6 | Unified Inbox | 2 | Rij 3: GAT! (2+2=4, past niet) |
| 7 | Webshop Builder | 2 | Rij 4: 2 cols |
| 8 | Slimme Financiën | 1 | Rij 4: + 1 = 3 ✅ |
| 9 | Groei-Insights & POS | 1 | Rij 5: 1 col - GAT! |

**Oplossing:** Herorden features zodat elke rij exact 3 kolommen vult.

---

### Mobile (Screenshots 3-5)

**Probleem 1: Hero tekst loopt over**
- Grote fonts breken niet goed op smalle schermen
- "Volledig Onder Controle" past niet op één regel

**Probleem 2: Dashboard mockup te breed**
- De `HeroDashboardMockup` heeft `max-w-2xl` maar geen goede mobile constraints
- Scrollt horizontaal op kleine schermen

**Probleem 3: Comparison tabel horizontaal scrollen**
- Tabel met 5 kolommen past niet op mobile
- `min-w-[640px]` forceert horizontaal scrollen

---

## Voorgestelde Oplossingen

### 1. FeaturesSection - Grid Rebalanceren

**Nieuwe feature volgorde:**

```text
Rij 1: [Multi-Channel (2)] + [Voorraadsync (1)] = 3 ✅
Rij 2: [AI Marketing (2)] + [AI SEO (1)] = 3 ✅  
Rij 3: [Promoties (2)] + [Financiën (1)] = 3 ✅
Rij 4: [Unified Inbox (2)] + [Groei-Insights (1)] = 3 ✅
Rij 5: [Webshop Builder (2)] + [LEGE RUIMTE] = ? ← PROBLEEM
```

**Betere oplossing:** Maak Webshop Builder ook `gridSpan: 1`, of voeg een 10e feature toe, of gebruik een andere layout.

**Aanbevolen aanpak:**
- Wijzig `Unified Inbox` naar `gridSpan: 1`
- Wijzig `Webshop Builder` naar `gridSpan: 1`
- Dit geeft 9 features met balans: 3 rijen van 3 cards

OF gebruik een hybrid benadering:
- Eerste 6 features: 3 rijen met afwisselend 2+1 patroon
- Laatste 3 features: 1 rij met 3x span-1

---

### 2. HeroSection - Mobile Typography

**Wijzigingen:**
- Verklein hero titel op mobile van `text-5xl` naar `text-3xl`/`text-4xl`
- Voeg `break-words` of betere line breaks toe
- Controleer container padding

---

### 3. HeroDashboardMockup - Mobile Responsiveness

**Wijzigingen:**
- Voeg `overflow-hidden` toe aan parent container
- Schaal mockup op mobile met `transform: scale(0.85)` of vergelijkbaar
- Verberg sommige elementen op mobile (bijv. sidebar altijd hidden op mobile - al gedaan)
- Zorg dat inhoud niet breder is dan viewport

---

### 4. ComparisonSection - Mobile Friendly

**Opties:**

**Optie A: Horizontale scroll verbeteren**
- Voeg scroll indicators toe
- Maak Feature kolom sticky

**Optie B: Card-based layout voor mobile**
- Toon op mobile cards per feature ipv tabel
- Elke card toont SellQo vs concurrenten verticaal

**Aanbevolen: Optie A** met sticky eerste kolom + scroll hint

---

## Technische Implementatie

### Bestand 1: `src/components/landing/FeaturesSection.tsx`

**Wijzigingen:**
- Herorden `features` array voor betere grid flow
- Pas `gridSpan` aan voor specifieke items
- Alternatief: gebruik CSS `grid-auto-flow: dense` om gaten automatisch te vullen

### Bestand 2: `src/components/landing/HeroSection.tsx`

**Wijzigingen:**
- Hero titel: `text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl`
- Container: betere padding op mobile
- Dashboard wrapper: `overflow-hidden` en responsive scaling

### Bestand 3: `src/components/landing/HeroDashboardMockup.tsx`

**Wijzigingen:**
- Outer container: `max-w-full overflow-hidden`
- Responsive wrapper met mobile scaling
- Verklein stat grid naar 2 kolommen op mobile (al gedaan: `grid-cols-2 lg:grid-cols-4`)

### Bestand 4: `src/components/landing/ComparisonSection.tsx`

**Wijzigingen:**
- Wrapper div: `overflow-x-auto -mx-4 px-4` voor edge-to-edge scroll
- Feature kolom: `sticky left-0 bg-card z-10` zodat deze zichtbaar blijft
- Scroll indicator visueel element toevoegen

---

## Visuele Weergave Nieuwe Grid

```text
DESKTOP (3 kolommen):
┌─────────────────────┬────────────┐
│ Multi-Channel (2)   │ Voorraad(1)│
├─────────────────────┼────────────┤
│ AI Marketing (2)    │ AI SEO (1) │
├─────────────────────┼────────────┤
│ Promoties (2)       │ Financiën(1)│
├─────────────────────┴────────────┤
│ Unified Inbox │ Webshop │ Groei  │ ← Alle 1-span
└───────────────┴─────────┴────────┘

MOBILE (1 kolom):
┌──────────────────┐
│ Multi-Channel    │
├──────────────────┤
│ Voorraad         │
├──────────────────┤
│ AI Marketing     │
│  ...etc          │
└──────────────────┘
```

---

## Verwacht Resultaat

Na implementatie:
1. **Desktop**: Geen witte gaten meer - alle rijen volledig gevuld
2. **Mobile Hero**: Tekst past binnen viewport, geen overflow
3. **Mobile Dashboard**: Mockup schaalt netjes, geen horizontaal scrollen
4. **Mobile Comparison**: Smooth horizontale scroll met zichtbare feature namen


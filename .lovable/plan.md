
# Plan: Shop Health Dashboard met Live Pulse

## Visie & Filosofie

Het Shop Health Dashboard transformeert droge statistieken naar een **emotionele connectie** met je business. In plaats van "3 bestellingen te verwerken" zeg je "3 klanten wachten op hun pakketje! 📦". Het dashboard voelt als een **levend organisme** dat de gezondheid van je winkel weerspiegelt.

## Dashboard Structuur

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ╭─────────────────────────────────────────────────────────────────────────────────────╮
│  │                                                                                     │
│  │     💚 Je winkel bruist van energie!              Score: 87/100                    │
│  │     ────────────────────────────────────────────────────────────                   │
│  │     Vandaag al €127,50 omzet • 3 nieuwe klanten • Je bent on fire! 🔥             │
│  │                                                                                     │
│  │     ████████████████████████████████████████████░░░░░░░░░░░  87%                   │
│  │                                                                                     │
│  ╰─────────────────────────────────────────────────────────────────────────────────────╯
│                                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ 🟢 Bestellingen      │  │ 🟢 Voorraad          │  │ 🟡 Klantservice      │          │
│  │                      │  │                      │  │                      │          │
│  │ 0 wachtend           │  │ Alles op voorraad    │  │ 2 berichten wachten  │          │
│  │ ✓ Alles verzonden    │  │ ✓ 23 producten ok    │  │ Gemiddeld: 4 uur     │          │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘          │
│                                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ 🟢 Betalingen        │  │ 🟢 SEO & Zichtbaar   │  │ 🟢 Compliance        │          │
│  │                      │  │                      │  │                      │          │
│  │ Stripe actief ✓      │  │ Score: 78/100        │  │ 4/4 pagina's ✓       │          │
│  │ €0 openstaand        │  │ +12% vs vorige week  │  │ BTW, KvK ingevuld    │          │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘          │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  📌 Actie-items (3)                                                                    │
│  ──────────────────────────────────────────────────────────────────────────────────    │
│  │ 🔴 URGENT │ "Vintage Lamp" is uitverkocht - 2 klanten vroegen ernaar    [Bijvullen]│
│  │ 🟡 MEDIUM │ Klant Jan de Vries wacht 26 uur op antwoord                 [Beantwoord]│
│  │ 🔵 TIP    │ Voeg alt-teksten toe aan 5 producten voor betere SEO       [Verbeteren]│
│  ──────────────────────────────────────────────────────────────────────────────────    │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  🏆 Prestaties deze week                    📈 Trend (7 dagen)                        │
│  ┌────────────────────────────────────┐    ┌────────────────────────────────────────┐ │
│  │ ⭐ 5 nieuwe klanten                │    │  ▄                                      │ │
│  │ 🎯 Hoogste dag: woensdag (€89)     │    │ ▄█▄    ▄                                │ │
│  │ 💝 Terugkerende klant: Marie B.    │    │ ███▄  ▄█▄  ▄                            │ │
│  │ 📦 12 pakketten verzonden          │    │ █████▄███▄▄█▄                           │ │
│  │ 🌟 0 negatieve reviews             │    │ Ma Di Wo Do Vr Za Zo                    │ │
│  └────────────────────────────────────┘    └────────────────────────────────────────┘ │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Health Score Categorieën (6 pilaren)

### 1. Bestellingen & Fulfillment (25 punten max)
**Wat we meten:**
- Orders die op verwerking wachten (penalty per uur wachttijd)
- Gemiddelde verwerkingstijd vs benchmark
- Retourpercentage (laag = goed)
- Op tijd verzonden percentage

**Emotionele copy:**
- 🟢 "Alle pakketjes zijn onderweg! Je klanten zijn blij."
- 🟡 "2 bestellingen wachten op jou - ze popelen om verzonden te worden!"
- 🔴 "5 klanten wachten al 48+ uur. Tijd voor actie!"

### 2. Voorraad & Catalogus (20 punten max)
**Wat we meten:**
- Producten met lage voorraad (< 5 stuks)
- Producten uitverkocht
- Actieve producten ratio
- Producten zonder afbeeldingen

**Emotionele copy:**
- 🟢 "Voorraad is top! Alles ready to ship."
- 🟡 "3 bestsellers raken op - tijd om bij te bestellen!"
- 🔴 "Je populairste product is uitverkocht! 😱"

### 3. Klantservice & Communicatie (15 punten max)
**Wat we meten:**
- Onbeantwoorde klantberichten
- Gemiddelde responstijd
- Ongelezen offertes (verlopen bijna)
- Klanttevredenheid (indien reviews)

**Emotionele copy:**
- 🟢 "Klanten voelen zich gehoord - alle berichten beantwoord!"
- 🟡 "2 klanten wachten op een antwoord (gem. 4 uur)"
- 🔴 "Jan wacht al 48 uur - hij verliest misschien interesse!"

### 4. Financiën & Betalingen (20 punten max)
**Wat we meten:**
- Stripe Connect status (actief/niet actief)
- Openstaande facturen (overdue)
- Betalingsachterstand totaal
- BTW-compliance status

**Emotionele copy:**
- 🟢 "Financiën op orde! €0 openstaand."
- 🟡 "€150 aan openstaande facturen - verstuur een herinnering?"
- 🔴 "Stripe niet gekoppeld - je mist online betalingen!"

### 5. SEO & Vindbaarheid (10 punten max)
**Wat we meten:**
- SEO score van producten
- Meta descriptions aanwezig
- Alt-teksten bij afbeeldingen
- Sitemap gegenereerd

**Emotionele copy:**
- 🟢 "Google ziet je! SEO score: 78/100"
- 🟡 "5 producten missen meta descriptions - snel te fixen!"
- 🔴 "Je producten zijn onzichtbaar voor Google"

### 6. Setup & Compliance (10 punten max)
**Wat we meten:**
- Onboarding voltooid
- Juridische paginas aanwezig (AV, Privacy, etc.)
- Bedrijfsgegevens compleet
- Logo geüpload

**Emotionele copy:**
- 🟢 "Je winkel is 100% compliant en professioneel!"
- 🟡 "Alleen nog de retourpolicy nodig"
- 🔴 "4 juridische pagina's ontbreken - risico!"

## Score Berekening Logica

```typescript
interface HealthCategory {
  id: string;
  name: string;
  maxScore: number;
  currentScore: number;
  status: 'healthy' | 'warning' | 'critical';
  items: HealthItem[];
  emotionalMessage: string;
  actionUrl?: string;
}

interface HealthItem {
  label: string;
  status: 'ok' | 'warning' | 'critical';
  value: string | number;
  action?: { label: string; url: string };
}

// Score thresholds
// 80-100: 💚 GEZOND - "Je winkel bruist van energie!"
// 60-79:  🟡 ATTENTIE - "Er zijn een paar aandachtspunten"
// 40-59:  🟠 WAARSCHUWING - "Je winkel heeft wat liefde nodig"
// 0-39:   🔴 KRITIEK - "Directe actie vereist!"
```

## Motiverende Elementen

### 1. Daily Pulse Banner
Een dynamische banner bovenaan die verandert op basis van:
- Tijd van de dag ("Goedemorgen! Nieuwe dag, nieuwe kansen")
- Recente activiteit ("Wow! 3 bestellingen in het laatste uur!")
- Milestones ("Je 100e bestelling komt eraan! 🎉")
- Seizoen ("Decembermaand = piekmaand! Ben je ready?")

### 2. Achievements & Streaks
- "5 dagen op rij alle orders op tijd verzonden! 🔥"
- "Eerste €1000 omzet bereikt! 🏆"
- "10 5-sterren reviews - je bent een ster! ⭐"
- "Nul retouren deze maand - perfectie! 💎"

### 3. Comparative Insights
- "Je reageert 2x sneller dan gemiddeld!"
- "Je SEO score is hoger dan 70% van de shops"
- "Topdag! 40% meer omzet dan vorige week woensdag"

### 4. Actionable Tips
Geen vage adviezen maar concrete acties:
- "Voeg 'gratis verzending boven €50' toe → verhoogt gemiddelde orderwaarde met 23%"
- "Stuur Marie B. een persoonlijke bedankmail → ze bestelde al 3x!"

## Technische Implementatie

### Nieuwe Bestanden

```text
src/
├── hooks/
│   └── useShopHealth.ts                 # Hoofd-hook voor health data
├── components/admin/widgets/
│   └── ShopHealthWidget.tsx             # Hoofdwidget
├── components/shop-health/
│   ├── HealthScoreCircle.tsx            # Animatie cirkel met score
│   ├── HealthPulseBanner.tsx            # Dynamische motivatie banner
│   ├── HealthCategoryCard.tsx           # Individuele categorie kaart
│   ├── HealthActionList.tsx             # Prioriteit actielijst
│   ├── HealthAchievements.tsx           # Prestaties en streaks
│   ├── HealthTrendChart.tsx             # 7-dagen trend mini-chart
│   └── HealthStatusIndicator.tsx        # Groen/geel/rood indicator
├── lib/
│   └── healthScoreCalculator.ts         # Score berekening logica
└── config/
    └── healthMessages.ts                # Alle emotionele copy
```

### useShopHealth Hook

```typescript
interface ShopHealthData {
  overallScore: number;
  overallStatus: 'healthy' | 'warning' | 'critical';
  emotionalMessage: string;
  dailyPulse: string;
  categories: HealthCategory[];
  actionItems: ActionItem[];
  achievements: Achievement[];
  trends: TrendData;
  lastUpdated: Date;
}

// Hook verzamelt data van:
// - useOrders (pending orders, processing time)
// - useProducts (stock levels, images)
// - useCustomerMessages (unread messages)
// - useInvoices (overdue invoices)
// - useSEO (SEO scores)
// - useLegalPages (compliance)
// - useStripeConnect (payment status)
// - useAnalytics (trends, revenue)
```

### Widget Integratie

Widget wordt toegevoegd aan `dashboardWidgets.ts` met:
- `id: 'shop-health'`
- `category: 'stats'`
- `defaultSize: 'full'` (neemt volledige breedte)
- Komt bovenaan het dashboard (voor stats-grid)

## UI/UX Details

### Animaties
- Score cirkel vult zich langzaam (odometer effect)
- Pulse animatie op de banner
- Smooth transitions bij status wijzigingen
- Confetti bij bereiken van achievements

### Kleuren
- 💚 Gezond: `bg-emerald-500/10 border-emerald-500`
- 🟡 Attentie: `bg-amber-500/10 border-amber-500`
- 🔴 Kritiek: `bg-red-500/10 border-red-500`
- 🔵 Tip: `bg-blue-500/10 border-blue-500`

### Responsiveness
- Desktop: Volledige 3-kolom grid
- Tablet: 2-kolom grid
- Mobile: Gestapelde kaarten met collapse

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/hooks/useShopHealth.ts` | Nieuw | Hoofd-hook die alle health data verzamelt |
| `src/lib/healthScoreCalculator.ts` | Nieuw | Score berekening algoritme |
| `src/config/healthMessages.ts` | Nieuw | Emotionele copy en berichten |
| `src/components/shop-health/HealthScoreCircle.tsx` | Nieuw | Animatie score cirkel |
| `src/components/shop-health/HealthPulseBanner.tsx` | Nieuw | Dynamische motivatie banner |
| `src/components/shop-health/HealthCategoryCard.tsx` | Nieuw | Categorie kaart component |
| `src/components/shop-health/HealthActionList.tsx` | Nieuw | Prioriteit actie items |
| `src/components/shop-health/HealthAchievements.tsx` | Nieuw | Achievements & streaks |
| `src/components/shop-health/HealthTrendChart.tsx` | Nieuw | Mini trend grafiek |
| `src/components/admin/widgets/ShopHealthWidget.tsx` | Nieuw | Dashboard widget wrapper |
| `src/config/dashboardWidgets.ts` | Update | Voeg shop-health widget toe |
| `src/components/admin/DashboardGrid.tsx` | Update | Import ShopHealthWidget |

## Implementatie Volgorde

1. **Health Score Calculator** - Logica voor score berekening
2. **Health Messages Config** - Alle emotionele copy
3. **useShopHealth Hook** - Data aggregatie
4. **UI Components** - Alle visuele componenten
5. **ShopHealthWidget** - Widget wrapper
6. **Dashboard Integratie** - Toevoegen aan grid
7. **Polish & Animaties** - Verfijnen en testen

## Resultaat

Na implementatie:
- Merchants zien direct hun "winkel gezondheid" in één oogopslag
- Emotionele connectie door menselijke copy i.p.v. droge cijfers
- Duidelijke prioriteit van wat als eerste aandacht nodig heeft
- Motivatie door achievements en positieve feedback
- Actionable insights die direct omzetbaar zijn

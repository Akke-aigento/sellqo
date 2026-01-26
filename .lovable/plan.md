

# Plan: Dashboard Layout & Routing Fixes

## Samenvatting

Dit plan lost twee hoofdproblemen op:
1. **Routing problemen** - Klikbare tegels leiden naar incorrecte of 404 pagina's
2. **Layout problemen** - Rommelige layout met verschillende tegelformaten en tekst overflow

---

## Probleem Analyse

### 1. Routing Problemen Geïdentificeerd

De Shop Health widget en andere dashboard tegels linken naar URLs die niet altijd bestaan:

| URL in Code | Bestaat? | Probleem |
|-------------|----------|----------|
| `/admin/orders?status=pending` | ✅ | Query param wordt mogelijk niet gelezen |
| `/admin/products?stock=out` | ⚠️ | Query param "stock" wordt niet ondersteund |
| `/admin/products?stock=low` | ⚠️ | Query param "stock" wordt niet ondersteund |
| `/admin/invoices?status=overdue` | ⚠️ | Route is `/admin/orders/invoices`, niet `/admin/invoices` |
| `/admin/invoices` | ❌ | Bestaat niet! Moet `/admin/orders/invoices` zijn |
| `/admin/quotes` | ❌ | Bestaat niet! Moet `/admin/orders/quotes` zijn |
| `/admin/messages` | ✅ | Werkt |
| `/admin/seo` | ❌ | Bestaat niet! Moet `/admin/marketing/seo` zijn |
| `/admin/storefront?tab=legal` | ✅ | Werkt |
| `/admin/settings?tab=payments` | ✅ | Werkt |

### 2. Layout Problemen Geïdentificeerd

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  HUIDIGE SITUATIE (Rommelig)                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SHOP HEALTH (full width) - Neemt HELE breedte + heeft INTERNE 6-kolom grid    │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  ← 6 kleine kaarten     │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │ Actions     │ Achievements │ Trends                                      │  │   │
│  │  └──────────────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌────────────────────────────────┐  ← TODAY WIDGET (lg = 2 cols) MAAR widget zelf    │
│  │  VANDAAG                       │     is smal ontworpen                              │
│  │  overflow tekst...              │                                                    │
│  └────────────────────────────────┘                                                     │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STATS GRID (full width) - 4 stats in eigen row, breekt layout               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐  ← 3 medium widgets maar met verschillende          │
│  │ Quick  │ │ Orders │ │ AI     │     interne hoogtes = rommelig                       │
│  │ Actions│ │        │ │        │                                                       │
│  └────────┘ └────────┘ └────────┘                                                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PROBLEMEN:
1. Shop Health is te dominant (full width met eigen complexe layout)
2. Today Widget krijgt 2 kolommen maar de content is smal
3. Stats Grid (full width) dupliceert statistieken die al in Shop Health staan
4. Alle widgets hebben verschillende hoogtes
5. 6-kolom grid in Shop Health past niet in 3-kolom dashboard grid
6. Tekst in compacte category cards wordt afgesneden (truncate)
```

---

## Oplossing

### 1. Fix Alle Routing URLs

```text
VOOR                              → NA
────────────────────────────────────────────────────────
/admin/invoices                   → /admin/orders/invoices
/admin/invoices?status=overdue    → /admin/orders/invoices
/admin/quotes                     → /admin/orders/quotes
/admin/seo                        → /admin/marketing/seo
```

**Bestand:** `src/lib/healthScoreCalculator.ts`

### 2. Herstructureer Dashboard Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  NIEUWE LAYOUT (Clean & Consistent)                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ROW 1: Hero Banner (Score + Quick Stats)                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🟢 85/100  "Je winkel draait lekker!"     €1,250 omzet • 12 orders • 3 klanten │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ROW 2: Health Categories (2 cols) + Live Feed (1 col)                                 │
│  ┌─────────────────────────────────────────┐  ┌────────────────────────────────────┐   │
│  │  Health Categories (2x3 grid)           │  │  📡 Live Feed                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │  • Order #1234 - €125             │   │
│  │  │ Orders   │ │ Inventory│ │ Service  │ │  │  • Nieuw product toegevoegd       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ │  │  • Klant geregistreerd            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │                                    │   │
│  │  │ Finance  │ │ SEO      │ │ Complianc│ │  │  📊 Vandaag: €1,250 • 12 orders   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ │  └────────────────────────────────────┘   │
│  └─────────────────────────────────────────┘                                            │
│                                                                                         │
│  ROW 3: Action Items (1 col) + Quick Actions (1 col) + AI Coach (1 col)                │
│  ┌────────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐  │
│  │  ⚠️ Actie-items (3)       │ │  ⚡ Snelle acties    │ │  🤖 AI Coach             │  │
│  │  • 2 orders wachten       │ │  + Nieuw product     │ │  "VIP klant inactief..." │  │
│  │  • 3 producten low stock  │ │  📦 Bestellingen     │ │  [Actie]                 │  │
│  └────────────────────────────┘ └──────────────────────┘ └──────────────────────────┘  │
│                                                                                         │
│  ROW 4: Feature Widgets (Optional - based on enabled features)                         │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────────────────┐  │
│  │  🏪 POS Overzicht               │  │  🛒 Marktplaatsen                          │  │
│  │  €450 omzet • 2 actieve sessies │  │  Bol.com: 45 orders • Amazon: 12 orders   │  │
│  └──────────────────────────────────┘  └────────────────────────────────────────────┘  │
│                                                                                         │
│  ROW 5: Badges (Full width, compact)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🏆 [Badge1] [Badge2] [Badge3]...  Progress: ████████░░ 80% naar volgende      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Widget Size Adjustments

| Widget | Oude Size | Nieuwe Size | Reden |
|--------|-----------|-------------|-------|
| `shop-health` | `full` | **Splitsen in 2 widgets** | Te dominant, overlapt stats-grid |
| `today-widget` | `lg` | `md` | Content is compact, past in 1 kolom |
| `stats-grid` | `full` | **Verwijderen** | Dupliceert Shop Health stats |
| `quick-actions` | `md` | `md` | OK |
| `recent-orders` | `md` | **Verwijderen** | Live feed in Today Widget is beter |
| `ai-marketing` | `md` | `md` | OK |
| `pos-overview` | `md` | `md` | OK |
| `marketplace` | `full` | `lg` | Hoeft niet full width |
| `low-stock` | `full` | **Verwijderen** | Al in Inventory health card |
| `badges` | `md` | `full` | Compacte horizontal view |

### 4. Fix Text Overflow

**HealthCategoryCardCompact:** 
- Voeg `min-h-[X]` toe voor consistente hoogte
- Gebruik `line-clamp-1` ipv `truncate` voor betere tekst afkapping
- Vergroot padding voor leesbaarheid

**HealthActionList:**
- Gebruik `line-clamp-2` voor descriptions
- Wrap op kleinere schermen

---

## Technische Details

### Bestanden die worden aangepast:

| Bestand | Wijziging |
|---------|-----------|
| `src/lib/healthScoreCalculator.ts` | Fix alle action URLs |
| `src/config/dashboardWidgets.ts` | Pas widget sizes aan, verwijder redundante widgets |
| `src/components/admin/DashboardGrid.tsx` | Update grid layout logic |
| `src/components/admin/widgets/ShopHealthWidget.tsx` | Refactor naar 2 widgets: Banner + Categories |
| `src/components/shop-health/HealthCategoryCard.tsx` | Fix overflow, consistente sizing |
| `src/components/shop-health/HealthActionList.tsx` | Fix text overflow |
| `src/components/admin/widgets/TodayWidget.tsx` | Optimaliseer voor md size |
| `src/components/admin/widgets/BadgesWidget.tsx` | Maak horizontale compact versie |

### Nieuwe Widget Structuur:

```typescript
// Oude widgets die worden BEHOUDEN (met aanpassingen):
'health-banner'     // Nieuw: Alleen score banner
'health-categories' // Nieuw: Alleen 6 category cards
'today-widget'      // Geoptimaliseerd voor 1 kolom
'quick-actions'     // Ongewijzigd
'ai-marketing'      // Ongewijzigd  
'pos-overview'      // Ongewijzigd
'marketplace'       // Verkleind naar lg
'badges'            // Horizontale versie

// Widgets die VERWIJDERD worden:
'stats-grid'        // Duplicatie van health banner
'recent-orders'     // Duplicatie van today widget
'low-stock'         // Duplicatie van inventory health
'shop-health'       // Wordt gesplitst in banner + categories
```

---

## Implementatie Volgorde

1. **Fix Routing URLs** - `healthScoreCalculator.ts`
   - `/admin/invoices` → `/admin/orders/invoices`
   - `/admin/quotes` → `/admin/orders/quotes`  
   - `/admin/seo` → `/admin/marketing/seo`

2. **Update Widget Configuratie** - `dashboardWidgets.ts`
   - Splits `shop-health` in `health-banner` en `health-categories`
   - Verwijder `stats-grid`, `recent-orders`, `low-stock`
   - Pas sizes aan

3. **Refactor ShopHealthWidget** 
   - Maak `HealthBannerWidget` (full width, compact)
   - Maak `HealthCategoriesWidget` (lg, 2x3 grid)

4. **Fix Text Overflow**
   - `HealthCategoryCardCompact`: consistente min-height, line-clamp
   - `HealthActionList`: responsive text wrapping

5. **Update DashboardGrid**
   - Nieuwe default widget order
   - Betere grid class mapping voor consistent spacing

6. **Update TodayWidget & BadgesWidget**
   - Optimaliseer voor nieuwe sizes

---

## Conclusie

Dit plan:
- ✅ Fixt alle 404 routing problemen
- ✅ Maakt een cleane, consistente grid layout
- ✅ Verwijdert duplicatie (stats-grid, low-stock)
- ✅ Fixt text overflow issues
- ✅ Behoudt alle belangrijke informatie in een compactere vorm


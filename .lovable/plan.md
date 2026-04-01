

## Prompt 16: UX Verbeteringen Ads Pagina's

### Overzicht

Verbeter empty states, loading skeletons, error handling, responsive design, consistent styling en datum formatting op 6 pagina's.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Ads.tsx` | Empty state link → marketplace settings, channel hex kleuren op chart, skeleton chart |
| `src/pages/admin/AdsBolcom.tsx` | Empty state tekst verbeteren, KPI grid responsive (`grid-cols-2 lg:grid-cols-5`), table `overflow-x-auto`, skeleton loaders, error state |
| `src/pages/admin/AdsBolcomKeywords.tsx` | Replace Loader2 spinner met skeletons, empty state tekst verbeteren, table al has `overflow-x-auto` |
| `src/pages/admin/AdsBolcomSearchTerms.tsx` | Replace Loader2 spinner met skeletons, empty state tekst verbeteren |
| `src/pages/admin/AdsAiRules.tsx` | Replace "Laden..." tekst met skeletons, empty states per tab met iconen |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | Replace Loader2 spinner met skeleton layout, table `overflow-x-auto`, responsive info cards |

### Wijzigingen per pagina

**1. Ads.tsx** — globaal dashboard
- Empty state: link wijzigen van `/admin/ads/bolcom` naar `/admin/marketplace` (marketplace connectie settings)
- Empty state tekst: "Start met adverteren — verbind je marketplace account om campagnes te beheren"
- Chart skeleton: als `isLoading` toon `Skeleton h-[300px]` i.p.v. niets
- Kanaal kleuren: chart lines kleuren naar hex (`#0000FF` Bol, etc.) — voor nu alleen Bol.com actief maar klaar voor multi-channel
- KPI grid al responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) ✓

**2. AdsBolcom.tsx**
- KPI grid: `grid-cols-5` → `grid-cols-2 lg:grid-cols-5`
- Loading state: skeleton loaders voor KPI cards (5x `Skeleton h-20`), chart (`Skeleton h-[300px]`), table rows (3x `Skeleton h-12`)
- Empty state: tekst al goed, voeg "Klik Synchroniseren om je bestaande campagnes op te halen" toe
- Table: wrap in `overflow-x-auto` met `min-w-[900px]`
- Keywords+Search terms grid: `grid-cols-2` → `grid-cols-1 lg:grid-cols-2`
- Error handling: try/catch op sync al aanwezig ✓

**3. AdsBolcomKeywords.tsx**
- Loading: vervang `Loader2` spinner door skeleton KPI cards (4x) + skeleton table rows (5x)
- Empty state: betere tekst "Geen keywords gevonden. Maak eerst een campagne aan of synchroniseer bestaande campagnes."
- Table `overflow-x-auto` al aanwezig ✓

**4. AdsBolcomSearchTerms.tsx**
- Loading: vervang full-page `Loader2` spinner door skeleton KPI cards (4x) + skeleton table rows (5x)
- Empty state: als geen search terms na laden → "Zoektermen worden beschikbaar nadat je campagnes actief zijn en data genereren."
- Table `overflow-x-auto` al aanwezig ✓

**5. AdsAiRules.tsx**
- Loading: vervang "Laden..." tekst met skeleton cards (3x per tab)
- Empty states: voeg `Check` icoon toe bij "Geen aanbevelingen" empty state
- Geschiedenis tab empty state: "Nog geen AI acties uitgevoerd."

**6. AdsBolcomCampaignDetail.tsx**
- Loading: vervang `Loader2` met skeleton layout (header + info cards + chart placeholder)
- Info cards: al `grid-cols-2 md:grid-cols-5` ✓
- Tables: wrap Ad Groups en Negative Keywords tables in `overflow-x-auto`
- Datum formatting: `start_date`/`end_date` via `format(date, 'dd-MM-yyyy')` i.p.v. raw string

### Cross-cutting patronen

**Skeleton loader** patroon:
```tsx
// KPI cards
<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
  {[1,2,3,4,5].map(i => (
    <Card key={i}><CardContent className="pt-4">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-7 w-20" />
    </CardContent></Card>
  ))}
</div>

// Chart
<Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>

// Table rows
<Card><CardContent className="p-4 space-y-3">
  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
</CardContent></Card>
```

**Kanaal kleuren** — hex constanten:
```ts
const CHANNEL_HEX = { bolcom: '#0000FF', amazon: '#FF9900', google: '#4285F4', meta: '#1877F2' };
```

**Datum formatting** — alle datums via `format(date, 'dd-MM-yyyy')`, al grotendeels correct. Kleine fixes op CampaignDetail `start_date`/`end_date`.

### Geen database wijzigingen nodig.


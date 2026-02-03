
## Doel
Zorgen dat (1) de Bol.com-sync daadwerkelijk historische orders kan (her)importeren en (2) de UI geen “faku-demo” data meer toont maar echte data uit de database + correcte aantallen uit de sync-responses.

## Wat ik al zie (belangrijk)
- De backend-sync werkt wél: de logs tonen dat `sync-bol-orders` een order heeft geïmporteerd en de `marketplace_connections.stats.totalOrders` op **1** staat.
- De UI toont “0” omdat:
  1) `sync-bol-orders` retourneert `orders_imported`, maar de UI leest `ordersImported`.
  2) `sync-bol-inventory` retourneert `products_synced`, maar de UI leest `productsSynced`.
  3) `MarketplaceDetail.tsx` gebruikt nog hardcoded `mockOrders/mockActivities/mockProducts/mockLogs`, waardoor je altijd demo-gegevens ziet, ongeacht echte imports.

## Oplossing in 4 delen

### 1) Maak response-format consistent (en backwards compatible)
**Waarom:** zodat zowel de “koppeling gelukt” modal als “Sync nu” de juiste aantallen tonen.

**Aanpassingen**
- `supabase/functions/sync-bol-orders/index.ts`
  - Voeg camelCase velden toe naast snake_case:
    - `ordersImported` naast `orders_imported`
    - `connectionsProcessed` naast `connections_processed`
    - `errorsCount` naast `errors`
  - (Kleine correctie) Update per connection `stats.totalOrders` op basis van de import van dié run/connection (niet op de globale accumulator), zodat stats altijd logisch blijven.

- `supabase/functions/sync-bol-inventory/index.ts`
  - Voeg camelCase toe:
    - `productsSynced` naast `products_synced`
    - `connectionsProcessed`, `errorsCount`

**Acceptatiecriteria**
- Na sync toont de toast “X orders geïmporteerd” met X ≠ 0 wanneer er echt orders zijn geïmporteerd.
- Koppeldialoog toont bij “Bestellingen ophalen (X gevonden)” het echte X.

---

### 2) Fix de UI die nu de verkeerde keys leest
**Bestanden**
- `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`
  - Lees `ordersImported ?? orders_imported ?? 0`
  - Lees `productsSynced ?? products_synced ?? 0`
  - Als `invoke()` een error geeft: toon dit als fout in de UI (nu wordt dat te veel “geslikt”, waardoor het lijkt alsof alles OK is met 0 resultaten).

- `src/pages/admin/MarketplaceDetail.tsx`
  - In `handleSyncNow()` idem: gebruik de correcte keys (camelCase met fallback op snake_case).
  - (Extra) Maak sync-functie dynamisch op basis van `connection.marketplace_type` (nu staat er hardcoded Bol-functies; werkt voor Bol, maar is fragile).

**Acceptatiecriteria**
- “Sync Nu” toont het juiste aantal en geen “altijd 0” meer.

---

### 3) Verwijder demo/mock data en toon echte data (orders, activiteiten, logs, voorraad)
**Waarom:** dit is de reden dat je “faku-demo” blijft zien.

**Bestand**
- `src/pages/admin/MarketplaceDetail.tsx`

**Vervang**
- `mockActivities` → echte sync-activiteit (bijv. uit `sync_activity_log` via bestaande `useSyncHistory()` hook)
- `mockOrders` → query naar `orders` met:
  - `marketplace_connection_id = connectionId`
  - `tenant_id = currentTenant.id` (via `useTenant()`)
  - sort `created_at desc`, limit (bijv. 50)
- `mockProducts` → query naar `products` voor tenant (optioneel filter: `sync_inventory = true` en `bol_ean is not null` of mapping aanwezig)
- `mockLogs` → `sync_activity_log` (zelfde bron als SyncHistoryWidget/SyncLogDialog)

**UX verbeteringen**
- In de Orders tab: toon “Geen orders gevonden” als de query leeg is (met knop “Import historisch” of “Sync nu”).
- In Overzicht: “Recente activiteit” toont echte sync events.

**Acceptatiecriteria**
- Demo-orders verdwijnen volledig.
- Als er 1 Bol-order in de database staat, zie je die ook in de Orders-tab.

---

### 4) Maak “historische import” opnieuw mogelijk (ook na mislukte 1e poging)
**Waarom:** nu gebeurt historisch alleen bij “first sync”. Als die poging fout liep of als je later shipped/completed orders wil binnenhalen, heb je geen goede herstart.

**Aanpassingen**
- `supabase/functions/sync-bol-orders/index.ts`
  - Ondersteun een body-parameter zoals:
    - `forceHistoricalImport: boolean`
    - optioneel `historicalPeriodDays?: number`
  - Als `forceHistoricalImport=true`:
    - gebruik status `ALL`
    - gebruik `historicalPeriodDays` uit body of fallback naar `connection.settings.historicalPeriodDays`
    - laat dit onafhankelijk zijn van `isFirstSync`
- `src/pages/admin/MarketplaceDetail.tsx`
  - Voeg knop toe in header: **“Import historisch”**
  - Die roept `sync-bol-orders` aan met `{ connectionId, forceHistoricalImport: true }`
  - Toon resultaat met het correcte aantal geïmporteerde orders
  - Invalidate queries (`marketplace-connection`, `marketplace-connections`, `orders`, `sync-history`) zodat UI direct refresht

**Acceptatiecriteria**
- Je kan altijd opnieuw historisch importeren zonder de koppeling te verwijderen.
- Na klikken zie je de echte orders in de Orders-tab (geen mock).

---

## Testplan (end-to-end)
1) Ga naar **Admin → Connect → Bol.com → Instellingen**
2) Klik **Sync Nu**
   - Verwacht: toast met correct aantal (`ordersImported`), en Orders-tab toont echte orders.
3) Klik **Import historisch**
   - Verwacht: (opnieuw) import met status `ALL`, en aantallen kloppen.
4) Controleer Overzicht:
   - “Totaal Orders” en “Recente activiteit” tonen geen demo-data meer.

## Risico’s / Edge cases
- Als er echt 0 orders zijn binnen de gekozen periode (bijv. max 2 jaar), dan blijft het 0 — maar dan is het tenminste “echt 0”, zichtbaar met echte logs i.p.v. demo.
- Als er extreem veel orders zijn, kan één run te lang duren; dan kunnen we daarna upgraden naar een “resumable/pagination cursor” aanpak (1 pagina per call) zodat import altijd afmaakt zonder timeouts.

## Bestanden die ik ga aanpassen
- `supabase/functions/sync-bol-orders/index.ts`
- `supabase/functions/sync-bol-inventory/index.ts`
- `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`
- `src/pages/admin/MarketplaceDetail.tsx`



## Product Sync Uitbreiden: Richting + Selectieve Sync

### Wat er nu is
- De `BolProductImportDialog` is puur import-only: producten ophalen van Bol.com → selecteren → importeren in SellQo
- Er is al een `SyncDirectionSelector` component (import/export/bidirectional)
- De `sync-bol-products` edge function ondersteunt alleen `list` en `import` modes

### Wat we bouwen

**De dialog wordt een volledige "Product Sync Manager"** met:

1. **Sync-richting selector** bovenaan de dialog (hergebruik bestaande `SyncDirectionSelector`)
   - **Import**: Bol.com → SellQo (huidige flow, werkt al)
   - **Export**: SellQo → Bol.com (selecteer SellQo-producten om als offer aan te maken op Bol.com)
   - **Bidirectioneel**: Beide kanten, met conflict-strategie keuze

2. **Selectieve productlijst aangepast per richting**:
   - **Import-modus**: Toont Bol.com offers (huidige flow), selecteer welke je wilt importeren
   - **Export-modus**: Toont SellQo-producten (uit `products` tabel), selecteer welke je wilt pushen naar Bol.com
   - **Bidirectioneel**: Toont gecombineerde lijst, geeft aan wat waar al bestaat, selecteer welke je synchroon wilt houden

3. **Per-product sync toggle** — na initiële import/export kan de tenant per product aan/uitzetten of die meesynchroniseert (opslaan in `marketplace_mappings` of `sync_inventory` veld)

### Aanpassingen

| Bestand | Actie |
|---|---|
| `src/components/admin/marketplace/BolProductImportDialog.tsx` | Uitbreiden naar "BolProductSyncDialog": sync-richting selector toevoegen, export-modus UI (SellQo producten ophalen), bidirectionele view, per-product sync toggle |
| `supabase/functions/sync-bol-products/index.ts` | Nieuwe `export` mode: maakt offers aan op Bol.com via `POST /retailer/offers` voor geselecteerde SellQo-producten. Nieuwe `sync-settings` mode: slaat per-product sync preferences op |
| `src/pages/admin/MarketplaceDetail.tsx` | Button tekst aanpassen van "Importeer Producten" naar "Producten Synchroniseren" |

### Export flow (nieuw)

```text
Tenant kiest "Export" richting
  → Frontend haalt SellQo-producten op (die nog niet op Bol.com staan)
  → Tabel toont: naam, EAN, prijs, voorraad, of al op Bol.com
  → Tenant selecteert welke producten ze willen pushen
  → "Exporteer" → Edge function maakt offers aan via Bol.com API
  → Resultaat: X aangemaakt, Y al bestaand, Z fouten
```

### Bidirectioneel (nieuw)

- Gecombineerde lijst: alle producten uit beide bronnen
- Kolom "Bron" toont waar het product vandaan komt
- Conflict-strategie keuze (SellQo wins / Bol.com wins / nieuwste wins)
- Na activatie: producten worden bij elke sync in beide richtingen bijgewerkt


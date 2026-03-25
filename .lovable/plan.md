

## Per-Product Sync Velden Toggles

Momenteel is er alleen een aan/uit toggle per product. De uitbreiding voegt granulaire controle toe over **welke data** gesynchroniseerd wordt per product.

### Syncbare velden voor Bol.com

| Veld | Richting | Beschrijving |
|---|---|---|
| Prijs | Import/Export | Verkoopprijs synchroniseren |
| Voorraad | Import/Export | Stock levels bijwerken |
| Titel & beschrijving | Import/Export | Productnaam en omschrijving |
| Fulfillment | Alleen import | FBR/FBB methode overnemen |
| Verzendinfo | Export | Leveringscode meesturen |

### UI-aanpassing

In de producttabel komt per gekoppeld product een **uitklapbaar paneel** (accordion/expandable row). Als je op een gekoppeld product klikt, verschijnt een rij met toggles voor elk syncbaar veld. Zo blijft de tabel overzichtelijk maar heb je per product volledige controle.

```text
┌─────────────────────────────────────────────────────┐
│ ☑ Product X  │ EAN │ €29.99 │ 150 │ FBR │ Gekoppeld │ 🔄 Aan │
├─────────────────────────────────────────────────────┤
│  Sync instellingen:                                 │
│  [✓] Prijs   [✓] Voorraad   [ ] Titel   [✓] Verzend│
└─────────────────────────────────────────────────────┘
```

### Datamodel

De sync-veld preferences worden opgeslagen in `marketplace_mappings` (JSON) op het product, naast de bestaande `sync_inventory` boolean:

```json
{
  "bol_com": {
    "offerId": "uuid",
    "syncFields": {
      "price": true,
      "stock": true,
      "title": false,
      "fulfillment": false,
      "shipping": true
    }
  }
}
```

### Aanpassingen

| Bestand | Actie |
|---|---|
| `src/components/admin/marketplace/BolProductImportDialog.tsx` | Expandable rows toevoegen voor gekoppelde producten met per-veld toggles. Nieuwe state voor `expandedProductId`. |
| `supabase/functions/sync-bol-products/index.ts` | `sync-settings` mode uitbreiden: naast `syncEnabled` ook `syncFields` object accepteren en opslaan in `marketplace_mappings` |
| `supabase/functions/sync-bol-inventory/index.ts` | Bij stock sync checken of `syncFields.stock` enabled is voor dat product, anders overslaan |

### Hoe het werkt

1. Tenant koppelt producten (import/export, bestaande flow)
2. Bij gekoppelde producten verschijnt een uitklaprij met veld-toggles
3. Toggles worden opgeslagen via `sync-settings` in `marketplace_mappings`
4. Bij elke automatische sync worden alleen de ingeschakelde velden gesynchroniseerd



# Granulaire Synchronisatie Configuratie

## Overzicht

Een uitgebreid configuratiesysteem waarmee merchants per integratie exact kunnen bepalen **wat** er gesynchroniseerd wordt, in **welke richting**, en **waar** de data terechtkomt.

---

## Visueel Concept

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔄 Synchronisatie Regels                                         [Opslaan] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ BESTELLINGEN                                          [Configureer ▾]│ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  Richting:  ○ Import    ● Beide    ○ Export                           │ │
│  │                                                                        │ │
│  │  Import naar:           [Bestellingen ▾]                              │ │
│  │  Status mapping:        [Configureer →]                               │ │
│  │  Automatisch:           ● Ja  ○ Nee                                   │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ PRODUCTEN                                             [Configureer ▾]│ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  Richting:  ○ Import    ○ Beide    ● Export                           │ │
│  │                                                                        │ │
│  │  Velden synchroniseren:                                               │ │
│  │    ☑ Naam           → product.name                                    │ │
│  │    ☑ Prijs          → product.price                                   │ │
│  │    ☑ Beschrijving   → product.description                             │ │
│  │    ☑ Afbeeldingen   → product.images                                  │ │
│  │    ☐ SKU            → product.sku                                     │ │
│  │    ☐ Gewicht        → product.weight                                  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ VOORRAAD                                              [Configureer ▾]│ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  Richting:  ○ Import    ○ Beide    ● Export                           │ │
│  │  Veiligheidsvoorraad:   [5] stuks aftrekken                           │ │
│  │  Realtime updates:      ● Aan  ○ Uit                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☐ KLANTEN                                               [Configureer ▾]│ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  (Uitgeschakeld - klik om te activeren)                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☐ FACTUREN                                   [Alleen Odoo/WooCommerce] │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☐ RETOUREN                                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Types per Platform

Niet elk platform ondersteunt dezelfde sync opties. Hier is de matrix:

| Data Type      | Bol.com | Amazon | Shopify | WooCommerce | Odoo |
|----------------|---------|--------|---------|-------------|------|
| Bestellingen   | ↓ Import | ↓ Import | ↕ Beide | ↕ Beide | ↕ Beide |
| Producten      | ↑ Export | ↑ Export | ↕ Beide | ↕ Beide | ↕ Beide |
| Voorraad       | ↑ Export | ↑ Export | ↕ Beide | ↕ Beide | ↕ Beide |
| Klanten        | ↓ Import | ↓ Import | ↕ Beide | ↕ Beide | ↕ Beide |
| Facturen       | ✗ | ✗ | ✗ | ↕ Beide | ↑ Export |
| Retouren       | ↓ Import | ↓ Import | ↕ Beide | ↕ Beide | ↕ Beide |
| Verzendingen   | ↑ Export | ↑ Export | ↕ Beide | ↕ Beide | ↕ Beide |
| Categorieën    | ✗ | ✗ | ↕ Beide | ↕ Beide | ↕ Beide |
| BTW/Belastingen | ✗ | ✗ | ↓ Import | ↓ Import | ↕ Beide |

---

## Technische Implementatie

### 1. Nieuwe Types

```text
SyncDataType = 
  'orders' | 'products' | 'inventory' | 'customers' | 
  'invoices' | 'returns' | 'shipments' | 'categories' | 'taxes'

SyncDirection = 'import' | 'export' | 'bidirectional'

SyncRuleConfig = {
  enabled: boolean
  direction: SyncDirection
  autoSync: boolean
  fieldMappings: FieldMapping[]
  customSettings: Record<string, unknown>
}

FieldMapping = {
  sourceField: string      // Veld in het externe platform
  targetField: string      // Veld in SellQo
  enabled: boolean
  transform?: string       // Optionele transformatie
}
```

### 2. Database Wijzigingen

Uitbreiding van `marketplace_connections.settings` JSONB met geneste sync_rules:

```text
settings: {
  // Bestaande velden blijven behouden
  syncInterval: 15,
  autoImport: true,
  
  // NIEUW: Granulaire sync configuratie
  syncRules: {
    orders: {
      enabled: true,
      direction: 'import',
      autoSync: true,
      fieldMappings: [...],
      statusMapping: {
        'PENDING': 'pending',
        'SHIPPED': 'shipped',
        ...
      }
    },
    products: {
      enabled: true,
      direction: 'export',
      autoSync: false,
      fieldMappings: [
        { sourceField: 'name', targetField: 'product.name', enabled: true },
        { sourceField: 'price', targetField: 'product.price', enabled: true },
        { sourceField: 'sku', targetField: 'product.sku', enabled: false },
        ...
      ]
    },
    inventory: { ... },
    customers: { ... },
    invoices: { ... },
    returns: { ... },
  }
}
```

### 3. UI Componenten

```text
Nieuwe componenten:
├── SyncRulesTab.tsx              # Nieuwe tab in MarketplaceDetail
├── SyncRuleCard.tsx              # Individuele data type configuratie
├── SyncDirectionSelector.tsx     # Import/Export/Beide keuze
├── FieldMappingEditor.tsx        # Veld-voor-veld mapping UI
├── StatusMappingDialog.tsx       # Order status mapping modal
└── SyncRulePresets.tsx           # Quick-apply standaard configuraties
```

### 4. Default Configuraties per Platform

Elke marketplace krijgt standaard "slimme defaults" die merchants kunnen aanpassen:

```text
BOL.COM DEFAULTS:
├── Orders: Import, Auto, Enabled
├── Products: Export, Manual, Enabled
├── Inventory: Export, Auto, Enabled
├── Customers: Import, Auto, Disabled (privacy)
└── Returns: Import, Auto, Enabled

ODOO DEFAULTS:
├── Orders: Bidirectional, Auto, Enabled
├── Products: Bidirectional, Auto, Enabled
├── Inventory: Bidirectional, Auto, Enabled
├── Customers: Bidirectional, Auto, Enabled
├── Invoices: Export, Manual, Disabled
└── Taxes: Import, Manual, Enabled
```

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/types/marketplace.ts` | Wijzigen | Nieuwe sync rule types toevoegen |
| `src/types/syncRules.ts` | Nieuw | Dedicated types voor sync configuratie |
| `src/pages/admin/MarketplaceDetail.tsx` | Wijzigen | Nieuwe "Sync Regels" tab toevoegen |
| `src/components/admin/marketplace/SyncRulesTab.tsx` | Nieuw | Hoofdcomponent voor sync configuratie |
| `src/components/admin/marketplace/SyncRuleCard.tsx` | Nieuw | Accordeon card per data type |
| `src/components/admin/marketplace/SyncDirectionSelector.tsx` | Nieuw | Radio group voor richting |
| `src/components/admin/marketplace/FieldMappingEditor.tsx` | Nieuw | Checkbox lijst met veld mappings |
| `src/components/admin/marketplace/StatusMappingDialog.tsx` | Nieuw | Order status mapping configuratie |
| `src/components/admin/marketplace/SyncRulePresets.tsx` | Nieuw | Preset configuraties |
| `src/lib/syncRuleDefaults.ts` | Nieuw | Default configuraties per platform |
| `src/hooks/useSyncRules.ts` | Nieuw | Hook voor sync rules management |

---

## Implementatie Volgorde

1. **Types & Defaults** - Nieuwe type definities en default configuraties
2. **Database Migratie** - Toevoegen van default sync_rules aan bestaande connecties  
3. **useSyncRules Hook** - State management voor sync regels
4. **SyncDirectionSelector** - Basis UI component
5. **FieldMappingEditor** - Veld mapping UI
6. **SyncRuleCard** - Accordeon component per data type
7. **SyncRulesTab** - Integratie in MarketplaceDetail
8. **StatusMappingDialog** - Geavanceerde order status mapping
9. **Presets** - Snelle configuratie opties
10. **Edge Functions Update** - Sync functies respecteren nieuwe configuratie

---

## Gebruikerservaring

```text
Scenario: WooCommerce merchant configureert sync

1. Opent MarketplaceDetail voor WooCommerce
2. Klikt op nieuwe "Sync Regels" tab
3. Ziet overzicht van alle data types met aan/uit toggles

4. Klikt op "Producten" card → opent configuratie
   - Kiest richting: "Beide" (bidirectioneel)
   - Ziet lijst met velden:
     ☑ Naam
     ☑ Prijs  
     ☑ Beschrijving
     ☐ SKU (uit, wil dit handmatig beheren)
     ☑ Afbeeldingen
   - Slaat op

5. Klikt op "Klanten" card → activeert deze
   - Kiest richting: "Import"
   - Alles velden aan
   - Target: "Klanten" tabel in SellQo

6. Klikt op "Facturen" → activeert export naar WooCommerce
   - Automatisch: Nee (handmatig per factuur)

7. Klikt "Opslaan" → alle sync regels worden opgeslagen

Volgende keer dat sync draait:
- Alleen geconfigureerde data types worden gesynchroniseerd
- Alleen gekozen velden worden overgenomen
- Richting wordt gerespecteerd
```

---

## Field Mapping Details

Elke data type heeft specifieke velden die gemapped kunnen worden:

### Orders Field Mapping

| Extern Veld | SellQo Veld | Default |
|-------------|-------------|---------|
| order_id | order_number | ☑ |
| customer_email | customer.email | ☑ |
| line_items | items | ☑ |
| total | total | ☑ |
| shipping_address | shipping_address | ☑ |
| billing_address | billing_address | ☑ |
| order_status | status | ☑ |
| payment_status | payment_status | ☑ |
| notes | notes | ☐ |
| tags | tags | ☐ |

### Products Field Mapping

| Extern Veld | SellQo Veld | Default |
|-------------|-------------|---------|
| title | name | ☑ |
| price | price | ☑ |
| compare_at_price | compare_at_price | ☑ |
| description | description | ☑ |
| images | images | ☑ |
| sku | sku | ☐ |
| barcode | barcode | ☐ |
| weight | weight | ☐ |
| inventory_quantity | stock | ☑ |
| categories | category_id | ☑ |
| tags | tags | ☐ |
| meta_title | meta_title | ☐ |
| meta_description | meta_description | ☐ |

### Customers Field Mapping

| Extern Veld | SellQo Veld | Default |
|-------------|-------------|---------|
| email | email | ☑ |
| first_name | first_name | ☑ |
| last_name | last_name | ☑ |
| phone | phone | ☑ |
| company | company_name | ☐ |
| address | billing_address | ☑ |
| shipping_address | shipping_address | ☑ |
| total_spent | total_spent | ☐ |
| orders_count | total_orders | ☐ |
| tags | tags | ☐ |
| notes | notes | ☐ |

---

## Status Mapping (Orders)

Een speciale configuratie voor het mappen van order statussen tussen platforms:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Order Status Mapping                                    [Save] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WooCommerce Status      →     SellQo Status                    │
│  ───────────────────────────────────────────────                │
│  pending                 →     [pending ▾]                      │
│  processing              →     [processing ▾]                   │
│  on-hold                 →     [on_hold ▾]                      │
│  completed               →     [delivered ▾]                    │
│  cancelled               →     [cancelled ▾]                    │
│  refunded                →     [refunded ▾]                     │
│  failed                  →     [cancelled ▾]                    │
│                                                                  │
│  [+ Custom Status Mapping]                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Voordelen

1. **Volledige Controle** - Merchants bepalen exact wat er sync't
2. **Privacy-vriendelijk** - Klantgegevens sync kan uit staan
3. **Flexibel** - Per platform verschillende configuraties
4. **Onthouden** - Configuratie wordt permanent opgeslagen
5. **Veilig** - Voorkomt ongewenste data overschrijvingen
6. **Duidelijk** - Visueel overzicht van alle sync regels

---

## Technische Notes

- Alle sync configuratie wordt opgeslagen in `marketplace_connections.settings.syncRules`
- Edge functions worden aangepast om sync rules te respecteren
- Field mappings ondersteunen basis transformaties (trim, lowercase, etc.)
- Backwards compatible: bestaande connecties krijgen default configuratie

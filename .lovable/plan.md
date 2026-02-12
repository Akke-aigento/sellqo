
# Uitgebreide Productspecificaties met Marketplace-Mapping

## Overzicht

Dit is een fundamentele uitbreiding van het productsysteem. In plaats van alle mogelijke velden als kolommen aan de `products` tabel toe te voegen (onschaalbaar), wordt een flexibel specificatiesysteem gebouwd met:

1. **Gestructureerde specificaties** (vaste velden zoals afmetingen, merk, MPN) in een aparte `product_specifications` tabel
2. **Vrije key-value specificaties** in een `product_custom_specs` tabel met groepering en drag-and-drop
3. **Marketplace field mapping configuratie** in een `channel_field_mappings` tabel (platform admin beheerd)
4. **Validatiewaarschuwingen** per kanaal op productniveau

---

## Database Ontwerp

### Tabel 1: `product_specifications` (gestructureerde velden)

Eenmalige rij per product met alle standaard specificatievelden.

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| product_id | UUID FK UNIQUE | 1-op-1 met products |
| tenant_id | UUID FK | |
| **Afmetingen & Gewicht** | | |
| length_cm | NUMERIC | Productlengte |
| width_cm | NUMERIC | Productbreedte |
| height_cm | NUMERIC | Producthoogte |
| weight_kg | NUMERIC | Productgewicht (netto) |
| package_length_cm | NUMERIC | Verpakkingslengte |
| package_width_cm | NUMERIC | Verpakkingsbreedte |
| package_height_cm | NUMERIC | Verpakkingshoogte |
| package_weight_kg | NUMERIC | Brutogewicht |
| units_per_package | INT | Stuks per verpakking |
| **Identificatie** | | |
| upc | TEXT | Universal Product Code |
| mpn | TEXT | Manufacturer Part Number |
| isbn | TEXT | Voor boeken |
| brand | TEXT | Merk |
| manufacturer | TEXT | Fabrikant |
| model_number | TEXT | Modelnummer |
| country_of_origin | TEXT | Herkomstland (ISO code) |
| hs_tariff_code | TEXT | HS/Taric douanecode |
| **Materiaal** | | |
| material | TEXT | Hoofdmateriaal |
| color | TEXT | Kleur |
| size | TEXT | Maat |
| composition | JSONB | Samenstelling (array van {material, percentage}) |
| **Garantie & Compliance** | | |
| warranty_months | INT | Garantieperiode |
| ce_marking | BOOLEAN | CE-markering |
| energy_label | TEXT | Energielabel (A+++ tot G) |
| safety_warnings | TEXT | Veiligheidsinstructies |
| **Logistiek** | | |
| lead_time_days | INT | Doorlooptijd |
| shipping_class | TEXT | Verzendklasse |
| is_fragile | BOOLEAN | Breekbaar |
| is_hazardous | BOOLEAN | Gevaarlijke stoffen |
| hazard_class | TEXT | Gevarenklasse (bv. UN3481) |
| storage_instructions | TEXT | Opslaginstructies |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabel 2: `product_custom_specs` (vrije key-value paren)

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| product_id | UUID FK | |
| tenant_id | UUID FK | |
| group_name | TEXT | Groepsnaam (bv. "Elektrisch") |
| spec_key | TEXT | Specificatie naam |
| spec_value | TEXT | Waarde |
| value_type | TEXT | 'text', 'number', 'boolean' |
| sort_order | INT | Volgorde binnen groep |
| group_sort_order | INT | Volgorde van de groep |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabel 3: `channel_field_mappings` (platform admin configuratie)

Definieert hoe SellQo-velden mappen naar kanaalvelden. Beheerd door platform admins.

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| channel_type | TEXT | 'bol_com', 'amazon', 'shopify', 'woocommerce', 'ebay' |
| channel_category | TEXT NULL | Kanaal-specifieke categorie (optioneel) |
| sellqo_field | TEXT | Veldnaam in SellQo (bv. 'specs.brand', 'specs.ean', 'custom.Batterijcapaciteit') |
| channel_field | TEXT | Veldnaam bij het kanaal |
| channel_field_label | TEXT | Menselijke naam voor het kanaal-veld |
| is_required | BOOLEAN | Verplicht voor dit kanaal? |
| transform_rule | JSONB | Transformatieregels (eenheden, format) |
| field_group | TEXT | Groepering (bv. 'dimensions', 'identification') |
| sort_order | INT | |
| is_active | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabel 4: `product_channel_warnings` (gegenereerde waarschuwingen, cache)

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| product_id | UUID FK | |
| tenant_id | UUID FK | |
| channel_type | TEXT | |
| missing_fields | JSONB | Array van ontbrekende verplichte velden |
| warning_message | TEXT | Leesbare waarschuwing |
| severity | TEXT | 'error' (verplicht) of 'warning' (aanbevolen) |
| checked_at | TIMESTAMPTZ | Laatste controle |

### RLS Policies

- `product_specifications`: CRUD voor eigen tenant (via `tenant_id IN (get_user_tenant_ids(auth.uid()))`)
- `product_custom_specs`: Idem
- `channel_field_mappings`: SELECT voor alle authenticated users, INSERT/UPDATE/DELETE alleen voor platform admins
- `product_channel_warnings`: SELECT/INSERT/UPDATE/DELETE voor eigen tenant

---

## Frontend Componenten

### 1. ProductSpecificationsSection.tsx (collapsible sectie in Product tab)

Uitklapbare sectie "Technische Specificaties" met subsecties:

```text
[v] Technische Specificaties          [3 van 28 ingevuld]
    |
    [>] Afmetingen & Gewicht            (0 ingevuld)
    [v] Identificatie                   (2 ingevuld)
    |   ├── UPC: ___________
    |   ├── MPN: ABC-12345
    |   ├── ISBN: ___________
    |   ├── Merk: PowerStation Pro
    |   ├── Fabrikant: ___________
    |   ├── Modelnummer: ___________
    |   ├── Herkomstland: [dropdown ISO]
    |   └── HS/Taric code: ___________
    |
    [>] Materiaal & Samenstelling       (1 ingevuld)
    [>] Garantie & Compliance           (0 ingevuld)
    [>] Logistiek                       (0 ingevuld)
    [v] Vrije specificaties             [+ Specificatie toevoegen]
        ├── Groep: "Elektrisch"
        |   ├── Batterijcapaciteit: 512Wh
        |   ├── Uitgangsvermogen: 500W
        |   └── [drag handle]
        └── Groep: "Connectiviteit"
            ├── USB-A poorten: 3
            └── USB-C poorten: 2
```

**Samenvatting-modus**: Toont alleen ingevulde velden. "Bewerk alle specificaties" knop opent de volledige editor.

**Vrije specificaties**: Key-value invoer met:
- Groepsnaam selectie/aanmaak
- Drag-and-drop ordening (met bestaande @dnd-kit)
- Inline bewerken en verwijderen
- Value type selector (tekst/nummer/ja-nee)

### 2. ChannelFieldMappingAdmin.tsx (platform admin)

Onder `/admin/platform/field-mappings` (of vergelijkbare route):

```text
Kanaal: [Bol.com v]    Categorie: [Alle / specifiek]

SellQo Veld              ->    Bol.com Veld          Verplicht
─────────────────────────────────────────────────────────────
specs.barcode (EAN)       ->    ean                    [x]
specs.brand               ->    brand                  [x]
specs.length_cm           ->    packageDimensions.l    [ ]
specs.weight_kg           ->    packageWeight          [ ]
custom.Batterijcapaciteit ->    attributes.battery     [ ]
                                              [+ Mapping toevoegen]
```

Transformatieregels configureerbaar: cm->inches, kg->lbs, etc.

### 3. ProductChannelWarnings.tsx (waarschuwingen op productpagina)

Toont per kanaal wat ontbreekt:

```text
[!] Bol.com: Merk en EAN zijn verplicht
[!] Amazon: Gevaarlijke goederen classificatie ontbreekt
[ok] Shopify: Alle velden compleet
```

Geintegreerd in:
- Het product formulier (boven of onder de marketplace tab)
- De productlijst als een status indicator
- De marketplace tab per kanaal

### 4. Bulk Specificaties Bewerken

Uitbreiding van het bestaande bulk-edit systeem met een nieuwe tab "Specificaties":
- Herkomstland instellen voor geselecteerde producten
- HS/Taric code instellen
- Merk instellen
- Via een nieuwe RPC functie `bulk_update_specifications`

---

## Hooks

### useProductSpecifications(productId)
- Query: `product_specifications` + `product_custom_specs` voor dit product
- Mutations: upsert specs, add/update/delete custom specs, reorder

### useChannelFieldMappings(channelType?)
- Query: alle mappings, optioneel gefilterd op kanaal
- Mutations: CRUD (alleen platform admins)

### useProductChannelWarnings(productId)
- Berekent client-side welke verplichte velden ontbreken per actief kanaal
- Gebaseerd op `channel_field_mappings` + huidige product specs

---

## Vertalingen

Vrije specificaties (key + value) worden vertaalbaar via het bestaande `content_translations` systeem:
- `entity_type = 'product_custom_spec'`
- `entity_id = custom_spec.id`
- `field_name = 'spec_key'` of `'spec_value'`

Dit hergebruikt de bestaande vertaalinfrastructuur.

---

## Storefront API

De bestaande `usePublicStorefront` hook wordt uitgebreid om specificaties mee te laden:

```typescript
// Gestructureerd object terug:
{
  specifications: {
    dimensions: { length_cm: 30, width_cm: 20, ... },
    identification: { brand: "PowerStation Pro", mpn: "ABC-123", ... },
    ...
  },
  custom_specifications: [
    { group: "Elektrisch", specs: [{ key: "Batterijcapaciteit", value: "512Wh" }, ...] },
    ...
  ]
}
```

Vertalingen worden automatisch toegepast op basis van de actieve locale.

---

## Implementatievolgorde

### Fase 1: Database + Basisstructuur
1. Migratie: 4 tabellen + RLS + indexes
2. Types uitbreiden in TypeScript
3. `useProductSpecifications` hook

### Fase 2: Product Form UI
4. `ProductSpecificationsSection` component met collapsible subsecties
5. Vrije key-value editor met drag-and-drop
6. Integratie in ProductForm.tsx (linkerkolom, onder varianten)

### Fase 3: Marketplace Mapping
7. `channel_field_mappings` seed data voor Bol.com, Amazon, Shopify, WooCommerce, eBay
8. `ChannelFieldMappingAdmin` component voor platform admins
9. `ProductChannelWarnings` component

### Fase 4: Bulk + API + Vertalingen
10. Bulk specificaties bewerken (RPC + UI)
11. Storefront API uitbreiding
12. Vertaling integratie voor custom specs
13. Documentatie bijwerken voor AI helpbot

---

## Bestanden Overzicht

| Bestand | Actie |
|---------|-------|
| `supabase/migrations/XXXX.sql` | 4 tabellen, RLS, indexes, seed data |
| `src/types/specifications.ts` | Types voor specs, custom specs, mappings |
| `src/hooks/useProductSpecifications.ts` | CRUD hook voor specs |
| `src/hooks/useChannelFieldMappings.ts` | Hook voor mapping config |
| `src/components/admin/products/ProductSpecificationsSection.tsx` | Hoofdcomponent met collapsible subsecties |
| `src/components/admin/products/specs/DimensionsFields.tsx` | Afmetingen velden |
| `src/components/admin/products/specs/IdentificationFields.tsx` | Identificatie velden |
| `src/components/admin/products/specs/MaterialFields.tsx` | Materiaal velden |
| `src/components/admin/products/specs/ComplianceFields.tsx` | Garantie & compliance |
| `src/components/admin/products/specs/LogisticsFields.tsx` | Logistiek velden |
| `src/components/admin/products/specs/CustomSpecsEditor.tsx` | Vrije key-value editor |
| `src/components/admin/products/specs/SpecsSummaryView.tsx` | Samenvatting ingevulde velden |
| `src/components/admin/marketplace/ProductChannelWarnings.tsx` | Kanaalwaarschuwingen |
| `src/components/admin/platform/ChannelFieldMappingAdmin.tsx` | Platform admin mapping beheer |
| `src/pages/admin/ProductForm.tsx` | Integratie van specificatie-sectie |
| `src/components/admin/products/bulk/BulkSpecificationsTab.tsx` | Bulk bewerken |
| `src/hooks/usePublicStorefront.ts` | Storefront API uitbreiding |

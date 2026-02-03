

# Plan: Bol.com CSV Import voor Volledige Orderhistorie

## Probleem

De Bol.com API beperkt toegang tot historische data:
- **Orders API**: Verzonden orders slechts 48 uur beschikbaar
- **Shipments API**: Maximaal 3 maanden historie

Echter, Bol.com Seller Central biedt een **export functie** in "Verkoopanalyse" met data tot **2 jaar** terug. Door deze CSV te kunnen uploaden, kunnen gebruikers hun volledige orderhistorie importeren.

## Oplossing

Bouw een gespecialiseerde Bol.com CSV import flow die:
1. De standaard Bol.com export CSV kan verwerken
2. Orders mapt naar het SellQo database schema
3. Duplicaten herkent en overslaat

## Implementatie

### 1. Bol.com Order Mapping Toevoegen

**Bestand:** `src/lib/importMappings.ts`

Voeg mapping toe voor Bol.com verkoop export kolommen:
- `Bestelnummer` → `marketplace_order_id`
- `Besteldatum` → `created_at`
- `Verzonden op` → `shipped_at`
- `Prijs (incl. BTW)` → `total`
- `EAN` → voor product matching
- Klantgegevens → `shipping_address`

### 2. Dedicated CSV Import Component

**Bestand:** `src/components/admin/marketplace/BolCsvImport.tsx` (nieuw)

Een compacte CSV upload component specifiek voor Bol.com die:
- Bestand upload via drag & drop of file picker
- Voorbeeldweergave van eerste 5 rijen
- Mapping preview toont
- Import start met voortgangsindicator

### 3. Edge Function voor Verwerking

**Bestand:** `supabase/functions/import-bol-csv/index.ts` (nieuw)

Backend processing die:
- CSV data ontvangt van frontend
- Per rij een order creëert (of overslaat als `marketplace_order_id` al bestaat)
- Klant zoekt/creëert op basis van e-mail
- Order items aanmaakt
- Resultaten teruggeeft (imported / skipped / failed)

### 4. UI Integratie

**Bestand:** `src/pages/admin/MarketplaceDetail.tsx`

Voeg "CSV Import" knop/modal toe naast de bestaande "Import Historisch" knop, specifiek voor Bol.com connecties.

## Verwachte Bol.com Export Kolommen

Op basis van de Bol.com Verkoopanalyse export:

| Kolom | Mapping |
|-------|---------|
| Bestelnummer | `marketplace_order_id` |
| Besteldatum | `created_at` |
| EAN | Product lookup / `order_items` |
| Titel | `product_name` |
| Aantal | `quantity` |
| Prijs | `unit_price` |
| Commissie | `raw_marketplace_data` |
| Verzendkosten | `shipping_cost` |

## Gebruikerservaring

1. Ga naar Bol.com Seller Central → Verkoopanalyse
2. Selecteer periode (tot 2 jaar)
3. Exporteer als CSV
4. Upload in SellQo via de nieuwe knop
5. Preview en bevestig import
6. Resultaat: Alle historische orders beschikbaar in SellQo

## Bestanden te Maken/Wijzigen

| Bestand | Actie |
|---------|-------|
| `src/lib/importMappings.ts` | Bol.com mapping toevoegen + detectie |
| `src/components/admin/marketplace/BolCsvImport.tsx` | **Nieuw** - Upload component |
| `supabase/functions/import-bol-csv/index.ts` | **Nieuw** - Verwerkingsfunctie |
| `src/pages/admin/MarketplaceDetail.tsx` | CSV import knop toevoegen |
| `src/types/import.ts` | `bol_com` als ImportPlatform toevoegen |

## Technische Details

### CSV Parsing Flow
```text
┌─────────────────────────────┐
│  Frontend: FileUpload       │
│  - Drag & drop CSV          │
│  - Parse headers            │
│  - Toon preview (5 rijen)   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Edge Function              │
│  - Ontvang CSV data         │
│  - Loop door rijen          │
│  - Check duplicaten         │
│  - Creëer orders + items    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Resultaat                  │
│  - X geïmporteerd           │
│  - Y overgeslagen           │
│  - Z fouten                 │
└─────────────────────────────┘
```

### Order Creatie Logica
```typescript
// Per CSV rij:
// 1. Check of order al bestaat
const existing = await supabase
  .from('orders')
  .select('id')
  .eq('marketplace_order_id', row['Bestelnummer'])
  .eq('tenant_id', tenantId)
  .single();

if (existing) {
  skippedCount++;
  continue;
}

// 2. Creëer order met status 'shipped' (historisch)
const order = await supabase
  .from('orders')
  .insert({
    marketplace_source: 'bol_com',
    marketplace_order_id: row['Bestelnummer'],
    status: 'shipped',
    payment_status: 'paid',
    // ... mapping
  });

// 3. Voeg order items toe
await supabase
  .from('order_items')
  .insert({
    order_id: order.id,
    product_name: row['Titel'],
    quantity: parseInt(row['Aantal']),
    unit_price: parseFloat(row['Prijs']),
    // ...
  });
```

## Voordeel voor Gebruikers

Met deze feature kunnen SellQo gebruikers:
- **Volledige 2 jaar historie** importeren uit Bol.com
- **Eenmalige actie** - daarna pakt automatische sync het over
- **Rapportages** - complete verkoopcijfers voor analyse
- **Klantprofielen** - alle historische klanten in één systeem


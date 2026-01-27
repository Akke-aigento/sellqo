

# Plan: eBay Product Listing Functionaliteit

## Huidige Situatie

De eBay integratie heeft al **order sync** en **inventory sync**, maar mist nog de mogelijkheid om producten direct naar eBay te pushen. Dit plan voegt volledige **Product Listing** toe, consistent met hoe Bol.com en Amazon werken.

---

## 1. Database Migratie

Nieuwe kolommen toevoegen aan de `products` tabel:

```sql
-- eBay listing fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_listing_status TEXT DEFAULT 'not_listed';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_offer_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_item_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_optimized_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_optimized_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_last_synced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_listing_error TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_category_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_condition TEXT DEFAULT 'NEW';

-- Index
CREATE INDEX IF NOT EXISTS idx_products_ebay_listing_status ON products(ebay_listing_status);
```

---

## 2. TypeScript Type Uitbreidingen

### `src/types/product.ts`

Nieuwe velden toevoegen aan de `Product` interface:

```typescript
// eBay listing fields
ebay_listing_status?: string | null;
ebay_offer_id?: string | null;
ebay_item_id?: string | null;
ebay_optimized_title?: string | null;
ebay_optimized_description?: string | null;
ebay_last_synced_at?: string | null;
ebay_listing_error?: string | null;
ebay_category_id?: string | null;
ebay_condition?: string | null;
```

### `src/types/marketplace.ts`

Al aanwezig - de `MarketplaceCredentials` bevat al de eBay-specifieke velden.

---

## 3. useMarketplaceListing Hook Uitbreiden

### `src/hooks/useMarketplaceListing.ts`

Toevoegen aan bestaande hook (~80 regels):

1. **EbayOfferData interface**:
```typescript
export interface EbayOfferData {
  sku: string;
  price: number;
  quantity: number;
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  category_id?: string;
  title?: string;
  description?: string;
}
```

2. **createEbayOffer mutation**:
   - Roept `create-ebay-listing` Edge Function aan
   - Valideert SKU en prijs
   - Update product met eBay listing status

3. **checkEbayListingStatus function**:
   - Controleert status van pending listings
   - Update product met definitieve item ID

4. **MarketplaceSettings interface uitbreiden**:
```typescript
// eBay fields
ebay_optimized_title?: string;
ebay_optimized_description?: string;
ebay_condition?: string;
ebay_category_id?: string;
```

5. **optimizeContent functie**:
   - `'ebay'` toevoegen aan marketplace union type

---

## 4. Edge Function: `create-ebay-listing`

### `supabase/functions/create-ebay-listing/index.ts`

Nieuwe Edge Function (~200 regels):

```typescript
// eBay Inventory API flow:
// 1. Create/Update inventory_item (SKU-based)
// 2. Create offer for the inventory item
// 3. Publish the offer to get listing

const EBAY_API_URL = 'https://api.ebay.com';

// Endpoints:
// PUT /sell/inventory/v1/inventory_item/{sku}
// POST /sell/inventory/v1/offer
// POST /sell/inventory/v1/offer/{offerId}/publish

interface CreateListingRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_data: EbayOfferData;
}
```

**Flow:**
1. Haal credentials op uit marketplace_connections
2. Verkrijg OAuth access token
3. Maak/update inventory item met product details
4. Maak offer aan met prijs en voorraad
5. Publiceer offer naar eBay
6. Update product met listing status en item ID

---

## 5. Edge Function: `check-ebay-listing-status`

### `supabase/functions/check-ebay-listing-status/index.ts`

Nieuwe Edge Function (~80 regels):

```typescript
// Controleer status van eBay listing
// GET /sell/inventory/v1/offer/{offerId}
// GET /sell/fulfillment/v1/order (voor verkochte items)
```

---

## 6. Config.toml Uitbreiden

```toml
[functions.create-ebay-listing]
verify_jwt = false

[functions.check-ebay-listing-status]
verify_jwt = false
```

---

## 7. AI Content Optimalisatie

### `supabase/functions/ai-optimize-marketplace-content/index.ts`

eBay toevoegen aan marketplace-specifieke prompts:

```typescript
case 'ebay':
  return {
    title_max_length: 80,
    description_format: 'html',
    prompt_additions: 'eBay favors clear, searchable titles with brand + key features. Use HTML for descriptions.',
  };
```

---

## 8. ProductMarketplaceTab UI

### `src/components/admin/marketplace/ProductMarketplaceTab.tsx`

Nieuwe eBay sectie toevoegen (~150 regels):

1. **State variabelen**:
```typescript
const [ebayEnabled, setEbayEnabled] = useState(false);
const [ebayCondition, setEbayCondition] = useState('NEW');
const [ebayOptimizedTitle, setEbayOptimizedTitle] = useState('');
const [ebayOptimizedDescription, setEbayOptimizedDescription] = useState('');
const [isPublishingEbay, setIsPublishingEbay] = useState(false);
```

2. **eBay connection check**:
```typescript
const ebayConnection = getConnectionByType('ebay');
const hasEbayConnection = !!ebayConnection;
```

3. **eBay Card sectie** (na Odoo):
   - Enable/disable toggle
   - Conditie selector (Nieuw, Gebruikt, etc.)
   - AI-geoptimaliseerde titel en beschrijving
   - Publiceer naar eBay knop
   - Status badge (pending, listed, error)

4. **eBay specifieke constanten**:
```typescript
const EBAY_CONDITIONS = [
  { value: 'NEW', label: 'Nieuw' },
  { value: 'USED_EXCELLENT', label: 'Gebruikt - Uitstekend' },
  { value: 'USED_VERY_GOOD', label: 'Gebruikt - Zeer goed' },
  { value: 'USED_GOOD', label: 'Gebruikt - Goed' },
  { value: 'USED_ACCEPTABLE', label: 'Gebruikt - Acceptabel' },
];
```

---

## Technische Details

### eBay Inventory API Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    eBay Listing Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PUT /inventory_item/{sku}                               │
│     └─ Product details, images, condition                   │
│                                                             │
│  2. POST /offer                                             │
│     └─ Prijs, voorraad, marketplace, format                 │
│     └─ Returns: offerId                                     │
│                                                             │
│  3. POST /offer/{offerId}/publish                           │
│     └─ Publiceert naar eBay                                 │
│     └─ Returns: listingId (eBay item ID)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### eBay Condition Mapping

| SellQo Condition | eBay Enum |
|------------------|-----------|
| Nieuw | NEW |
| Gebruikt - Uitstekend | USED_EXCELLENT |
| Gebruikt - Zeer goed | USED_VERY_GOOD |
| Gebruikt - Goed | USED_GOOD |
| Gebruikt - Acceptabel | USED_ACCEPTABLE |

### Listing Status Flow

| Status | Betekenis |
|--------|-----------|
| `not_listed` | Niet gepubliceerd |
| `pending` | Wordt verwerkt door eBay |
| `listed` | Actief op eBay |
| `error` | Fout bij publicatie |
| `ended` | Listing beëindigd |

---

## Bestanden Overzicht

| Bestand | Actie | Regels |
|---------|-------|--------|
| Database migratie | Nieuw (eBay kolommen) | ~12 |
| `src/types/product.ts` | Uitbreiden met eBay velden | ~10 |
| `src/hooks/useMarketplaceListing.ts` | createEbayOffer, checkStatus | ~80 |
| `supabase/functions/create-ebay-listing/index.ts` | Nieuw | ~200 |
| `supabase/functions/check-ebay-listing-status/index.ts` | Nieuw | ~80 |
| `supabase/functions/ai-optimize-marketplace-content/index.ts` | eBay prompt | ~20 |
| `src/components/admin/marketplace/ProductMarketplaceTab.tsx` | eBay sectie | ~150 |
| `supabase/config.toml` | 2 entries | ~4 |

---

## Na Implementatie

Merchants kunnen:
1. ✅ eBay account koppelen via SellQo Connect
2. ✅ Orders automatisch importeren  
3. ✅ Voorraad real-time synchroniseren
4. ✅ **Nieuw:** Producten publiceren naar eBay met AI-geoptimaliseerde content
5. ✅ **Nieuw:** Listing status monitoren en errors afhandelen

Dit maakt eBay een **volledig geïntegreerde marketplace** naast Bol.com en Amazon.


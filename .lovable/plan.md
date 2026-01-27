
# Plan: Volledige eBay Marketplace Integratie

## Huidige Status

eBay wordt genoemd op de marketingpagina als "live" integratie, maar er bestaat **geen technische implementatie**:
- ❌ `MarketplaceType` bevat geen `ebay`
- ❌ Geen eBay credentials formulier in ConnectMarketplaceDialog
- ❌ Geen Edge Functions voor sync (orders, inventory, producten)
- ❌ Geen MARKETPLACE_INFO entry voor eBay

## Implementatie Overzicht

De eBay integratie volgt exact hetzelfde patroon als Amazon, met OAuth2 authenticatie.

### 1. Type Uitbreidingen

**Bestand:** `src/types/marketplace.ts`

```typescript
// Regel 1: Uitbreiden
export type MarketplaceType = 'bol_com' | 'amazon' | 'shopify' | 'woocommerce' | 'odoo' | 'ebay';

// Toevoegen aan MarketplaceCredentials interface:
// eBay-specific
ebayAppId?: string;        // Production App ID (Client ID)
ebayDevId?: string;        // Developer ID  
ebayCertId?: string;       // Cert ID (Client Secret)
ebayRefreshToken?: string; // OAuth refresh token
ebayMarketplaceId?: string; // bijv. EBAY_NL, EBAY_BE, EBAY_DE

// Toevoegen aan MARKETPLACE_INFO:
ebay: {
  type: 'ebay',
  name: 'eBay',
  icon: 'ShoppingBag',
  color: 'text-red-600',
  bgColor: 'bg-red-100',
  description: 'Verkoop op eBay Benelux, Duitsland en meer',
  features: [
    { text: 'Automatische order import', available: true },
    { text: 'Realtime voorraad sync', available: true },
    { text: 'Product listing', available: true },
    { text: 'AI geoptimaliseerde titels', available: true },
  ],
},
```

### 2. Connect Dialog Uitbreiden

**Bestand:** `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`

Toevoegingen:
1. **State variabelen** voor eBay credentials:
   ```typescript
   const [ebayAppId, setEbayAppId] = useState('');
   const [ebayCertId, setEbayCertId] = useState('');
   const [ebayRefreshToken, setEbayRefreshToken] = useState('');
   const [ebayMarketplace, setEbayMarketplace] = useState('EBAY_NL');
   ```

2. **Credentials form** (na Odoo, voor default case):
   ```jsx
   : marketplaceType === 'ebay' ? (
     <>
       <div>
         <Label>App ID (Client ID) *</Label>
         <Input ... />
       </div>
       <div>
         <Label>Cert ID (Client Secret) *</Label>
         <Input type="password" ... />
       </div>
       <div>
         <Label>OAuth Refresh Token *</Label>
         <Input type="password" ... />
       </div>
       <div>
         <Label>Marketplace</Label>
         <Select ... >
           <SelectItem value="EBAY_NL">Nederland</SelectItem>
           <SelectItem value="EBAY_BE">België</SelectItem>
           <SelectItem value="EBAY_DE">Duitsland</SelectItem>
         </Select>
       </div>
     </>
   )
   ```

3. **Instructions** voor eBay:
   ```typescript
   case 'ebay':
     return {
       title: 'eBay Developer Program',
       url: 'https://developer.ebay.com/my/keys',
       steps: [
         'Ga naar eBay Developer Program en log in',
         'Maak een Application aan (Production)',
         'Kopieer App ID (Client ID) en Cert ID (Client Secret)',
         'Genereer een OAuth Refresh Token via de OAuth tool',
       ],
     };
   ```

4. **Sync function mapping**:
   ```typescript
   } else if (marketplaceType === 'ebay') {
     syncOrdersFunction = 'sync-ebay-orders';
     syncInventoryFunction = 'sync-ebay-inventory';
   }
   ```

### 3. Edge Functions

Drie nieuwe Edge Functions volgen het Amazon-patroon:

#### `sync-ebay-orders/index.ts`

```typescript
// eBay Sell Fulfillment API - /sell/fulfillment/v1/order
// OAuth2: App ID + Cert ID + Refresh Token → Access Token
const EBAY_MARKETPLACES = {
  'EBAY_NL': 'api.ebay.com',
  'EBAY_BE': 'api.ebay.com',
  'EBAY_DE': 'api.ebay.com',
};

// Token refresh via https://api.ebay.com/identity/v1/oauth2/token
// Order mapping: eBay OrderStatus → SellQo status
```

#### `sync-ebay-inventory/index.ts`

```typescript
// eBay Inventory API - /sell/inventory/v1/inventory_item
// Bulk update voorraad naar eBay listings
```

#### `test-ebay-connection/index.ts`

```typescript
// Test API credentials door /commerce/identity/v1/user te callen
```

### 4. Config.toml

```toml
[functions.sync-ebay-orders]
verify_jwt = false

[functions.sync-ebay-inventory]
verify_jwt = false

[functions.test-ebay-connection]
verify_jwt = false
```

---

## Technische Details

### eBay API Endpoints

| Actie | API | Endpoint |
|-------|-----|----------|
| Orders ophalen | Sell Fulfillment API | `/sell/fulfillment/v1/order` |
| Voorraad updaten | Inventory API | `/sell/inventory/v1/inventory_item` |
| Product aanmaken | Inventory API | `/sell/inventory/v1/offer` |
| Auth token refresh | OAuth | `/identity/v1/oauth2/token` |

### OAuth2 Flow

eBay gebruikt OAuth2 met refresh tokens:
1. Merchant genereert refresh token in eBay Developer Dashboard
2. SellQo wisselt refresh token → access token (1 uur geldig)
3. Access token gebruikt voor API calls

### Order Status Mapping

| eBay Status | SellQo Status |
|-------------|---------------|
| AWAITING_PAYMENT | pending |
| AWAITING_SHIPMENT | processing |
| SHIPPED | shipped |
| DELIVERED | delivered |
| CANCELLED | cancelled |

---

## Bestanden Overzicht

| Bestand | Actie | Regels |
|---------|-------|--------|
| `src/types/marketplace.ts` | Uitbreiden MarketplaceType + credentials + info | ~50 |
| `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx` | State, form, instructions, sync | ~100 |
| `supabase/functions/sync-ebay-orders/index.ts` | Nieuw | ~180 |
| `supabase/functions/sync-ebay-inventory/index.ts` | Nieuw | ~120 |
| `supabase/functions/test-ebay-connection/index.ts` | Nieuw | ~60 |
| `supabase/config.toml` | 3 entries toevoegen | ~6 |

---

## Marketing Pagina

De marketing pagina toont eBay al als "live" (`status: 'live'`) in `IntegrationsShowcaseSection.tsx`. Na deze implementatie is dat **correct**.

---

## Na Implementatie

Merchants kunnen:
1. eBay account koppelen via SellQo Connect
2. Orders automatisch importeren
3. Voorraad real-time synchroniseren
4. (Later) Producten pushen naar eBay

Dit maakt eBay een volwaardige marketplace naast Bol.com, Amazon, Shopify, WooCommerce en Odoo.

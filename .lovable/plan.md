
# Plan: Echte Social Commerce Shop Integraties

## Overzicht

De huidige implementatie genereert alleen product feeds die merchants handmatig moeten uploaden. Dit plan voegt **directe API-koppelingen** toe zodat producten automatisch in de echte "online shops" van deze platforms verschijnen.

## Wat het verschil is

```text
HUIDIGE SITUATIE                          NA IMPLEMENTATIE
─────────────────                          ─────────────────

┌─────────────┐                            ┌─────────────┐
│   SellQo    │                            │   SellQo    │
│  Products   │                            │  Products   │
└──────┬──────┘                            └──────┬──────┘
       │                                          │
       ▼                                          ▼
┌─────────────┐                            ┌─────────────┐
│  Feed URL   │                            │  API Sync   │
│  (Manual)   │                            │ (Automatic) │
└──────┬──────┘                            └──────┬──────┘
       │                                          │
       │ Merchant moet                            │ Automatisch
       │ handmatig URL                            │ doorgestuurd
       │ invoeren                                 │
       ▼                                          ▼
┌─────────────┐                            ┌─────────────────────────┐
│   Google    │                            │   Facebook Shop         │
│  Merchant   │                            │   Instagram Shop        │
│   Center    │                            │   WhatsApp Catalog      │
└─────────────┘                            │   Google Shopping       │
                                           │   TikTok Shop           │
                                           └─────────────────────────┘
```

## Deel 1: Meta Commerce Integratie (Facebook Shop + Instagram Shop + WhatsApp)

### Hoe Meta Shops Werken

Meta gebruikt één centrale **Commerce Manager** voor alle platforms:
- Facebook Shop
- Instagram Shopping
- WhatsApp Business Catalog

Eén productcatalogus = beschikbaar op alle drie platforms.

### Vereiste Aanpassingen

| Component | Wijziging |
|-----------|-----------|
| **OAuth Scopes** | Toevoegen: `catalog_management`, `business_management`, `commerce_account_manage_orders` |
| **Nieuwe Edge Function** | `sync-meta-catalog/index.ts` - Push producten naar Meta Catalog API |
| **Webhook** | `meta-catalog-webhook/index.ts` - Ontvang statusupdates van Meta |
| **UI Update** | Toon synchronisatie status, laatste sync tijd, fouten |

### Meta Catalog API Flow

```text
1. Merchant klikt "Verbind Facebook Shop"
       │
       ▼
2. OAuth flow met catalog_management scope
       │
       ▼
3. SellQo vraagt: "Welke catalogus wil je gebruiken?"
   (Bestaande selecteren of nieuwe aanmaken)
       │
       ▼
4. Sync-edge-function pusht producten naar catalogus:
   POST https://graph.facebook.com/v18.0/{catalog_id}/products
       │
       ▼
5. Producten verschijnen in:
   • Facebook Shop (via je Facebook Page)
   • Instagram Shop (via gekoppelde IG account)
   • WhatsApp Business Catalog (automatisch)
```

### Database Uitbreiding

De `social_channel_connections` tabel krijgt extra velden:

```sql
ALTER TABLE social_channel_connections ADD COLUMN IF NOT EXISTS
  catalog_id TEXT,           -- Meta Catalog ID
  business_id TEXT,          -- Meta Business ID
  sync_status TEXT DEFAULT 'idle',  -- idle, syncing, synced, error
  last_sync_products_count INTEGER DEFAULT 0,
  sync_errors JSONB DEFAULT '[]';
```

## Deel 2: TikTok Shop Integratie

### TikTok Shop API

TikTok Shop is beschikbaar in UK, US en andere markten (nog niet in NL/BE maar komt eraan).

| Component | Beschrijving |
|-----------|--------------|
| **OAuth** | TikTok Shop Seller Center OAuth |
| **API** | `open.tiktokglobalshop.com` |
| **Sync** | Product Create/Update API |
| **Orders** | Order sync (net als Bol.com/Amazon) |

### Nieuwe Edge Function

```typescript
// supabase/functions/sync-tiktok-catalog/index.ts
// POST https://open.tiktokglobalshop.com/product/202309/products
```

## Deel 3: Google Content API (Optioneel)

Voor merchants die **realtime sync** willen in plaats van feed-based:

| Methode | Voordeel | Nadeel |
|---------|----------|--------|
| **Feed (huidige)** | Simpel, geen API setup | Updates duren 24-48u |
| **Content API** | Realtime updates | Vereist API credentials |

### Content API Implementatie

```typescript
// supabase/functions/sync-google-merchant/index.ts
// POST https://shoppingcontent.googleapis.com/content/v2.1/{merchantId}/products
```

## Deel 4: Verbeterde UI

### Connectie Wizard per Kanaal

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Verbind Facebook/Instagram Shop                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Stap 1: Inloggen bij Meta Business                                         │
│  ──────────────────────────────────────                                     │
│  [Login met Facebook]                                                       │
│                                                                             │
│  ────────────────────────────────────────────────────────────────           │
│                                                                             │
│  Stap 2: Selecteer Business Account                                         │
│  ──────────────────────────────────                                         │
│  ○ My Fashion Store (Business ID: 123456)                                   │
│  ○ My Second Brand (Business ID: 789012)                                    │
│                                                                             │
│  ────────────────────────────────────────────────────────────────           │
│                                                                             │
│  Stap 3: Selecteer of maak Catalogus                                        │
│  ───────────────────────────────────                                        │
│  ○ Bestaande catalogus: "Product Catalog 2024"                              │
│  ○ Nieuwe catalogus aanmaken                                                │
│                                                                             │
│  ────────────────────────────────────────────────────────────────           │
│                                                                             │
│  [ ] Sync alle producten automatisch                                        │
│  [ ] Alleen geselecteerde producten                                         │
│                                                                             │
│                                                    [Annuleer] [Verbinden]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Status Dashboard

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Facebook/Instagram Shop                           ● Verbonden              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Catalogus: "SellQo Products"                                               │
│  Business: "My Fashion Store"                                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Sync Status                                                        │   │
│  │  ────────────                                                       │   │
│  │  📦 142 producten gesynchroniseerd                                  │   │
│  │  ✅ Laatste sync: 10 minuten geleden                                │   │
│  │  ⚠️ 3 producten met waarschuwingen                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Beschikbaar op:                                                            │
│  [FB] Facebook Shop    [IG] Instagram Shop    [WA] WhatsApp Catalog         │
│                                                                             │
│                        [Sync Nu]  [Bekijk in Meta]  [Instellingen]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Deel 5: Technische Implementatie

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| **Edge Functions** | |
| `supabase/functions/sync-meta-catalog/index.ts` | Push producten naar Meta Commerce Catalog |
| `supabase/functions/meta-catalog-webhook/index.ts` | Ontvang statusupdates |
| `supabase/functions/sync-tiktok-catalog/index.ts` | TikTok Shop product sync |
| `supabase/functions/sync-google-merchant/index.ts` | Google Content API (optioneel) |
| **Components** | |
| `src/components/admin/marketplace/MetaShopWizard.tsx` | Multi-stap wizard voor Meta koppeling |
| `src/components/admin/marketplace/CatalogSyncStatus.tsx` | Sync status weergave |
| `src/components/admin/marketplace/SelectCatalogDialog.tsx` | Catalogus selectie |
| **Updates** | |
| `supabase/functions/social-oauth-init/index.ts` | Toevoegen Meta Commerce scopes |
| `supabase/functions/social-oauth-callback/index.ts` | Ophalen catalogi na auth |
| `src/types/socialChannels.ts` | Nieuwe sync-gerelateerde types |
| `src/hooks/useSocialChannels.ts` | Sync mutations toevoegen |

### OAuth Scope Uitbreiding (Meta)

```typescript
// Huidige scopes
['pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']

// Nieuwe scopes voor Commerce
[
  'pages_manage_posts', 
  'pages_read_engagement', 
  'instagram_basic', 
  'instagram_content_publish',
  // NIEUW voor Shop functionaliteit:
  'catalog_management',           // Producten toevoegen/bewerken
  'business_management',          // Business accounts ophalen
  'commerce_account_manage_orders', // Orders beheren (optioneel)
  'pages_read_user_content',      // Shop instellingen lezen
]
```

### Meta Catalog API Voorbeeld

```typescript
// POST naar Meta Graph API
const response = await fetch(
  `https://graph.facebook.com/v18.0/${catalogId}/products`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: accessToken,
      retailer_id: product.id,
      data: {
        name: product.name,
        description: product.description,
        price: `${product.price} EUR`,
        availability: product.stock > 0 ? 'in stock' : 'out of stock',
        url: `${storeUrl}/products/${product.slug}`,
        image_url: product.featured_image,
        brand: tenant.company_name,
        condition: 'new',
        // Optionele velden
        gtin: product.barcode,
        mpn: product.sku,
      }
    })
  }
);
```

### Database Migratie

```sql
-- Uitbreiding social_channel_connections
ALTER TABLE social_channel_connections
ADD COLUMN IF NOT EXISTS catalog_id TEXT,
ADD COLUMN IF NOT EXISTS business_id TEXT,
ADD COLUMN IF NOT EXISTS page_id TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS products_in_catalog INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_errors JSONB DEFAULT '[]';

-- Index voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_social_channel_sync_status 
ON social_channel_connections(tenant_id, channel_type, sync_status);
```

## Deel 6: Belangrijke Overwegingen

### API Credentials Nodig

| Platform | Wat nodig is | Hoe te verkrijgen |
|----------|--------------|-------------------|
| **Meta** | App ID + App Secret | developers.facebook.com → Create App → Commerce |
| **TikTok** | App Key + App Secret | partner.tiktokshop.com → Developer Center |
| **Google** | Service Account JSON | console.cloud.google.com → Content API |

Deze worden als secrets opgeslagen en zijn **tenant-overstijgend** (SellQo platform credentials).

### Rate Limits & Sync Strategie

| Platform | Rate Limit | Strategie |
|----------|------------|-----------|
| Meta | 200 calls/user/hour | Batch updates, queue systeem |
| TikTok | 1000 calls/day | Incrementele sync |
| Google | 2500 calls/day | Feed voor bulk, API voor updates |

### Sync Triggers

Producten worden gesynchroniseerd bij:
1. **Handmatige trigger**: Merchant klikt "Sync Nu"
2. **Product wijziging**: Prijs, voorraad, beschrijving
3. **Scheduled**: Dagelijkse volledige sync (cron job)

## Resultaat

Na deze implementatie:

| Kanaal | Functionaliteit |
|--------|-----------------|
| **Facebook Shop** | Producten verschijnen automatisch in je Facebook Shop |
| **Instagram Shop** | Producten kunnen getagd worden in posts/stories |
| **WhatsApp Catalog** | Producten toonbaar in WhatsApp chats |
| **Google Shopping** | Keuze: Feed (standaard) of API (realtime) |
| **TikTok Shop** | Producten koppelbaar aan video's (waar beschikbaar) |

De merchant hoeft niet meer handmatig feeds te uploaden - alles wordt automatisch gesynchroniseerd vanuit SellQo.

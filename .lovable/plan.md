

# Implementatieplan: Social Commerce & Shopping Kanalen

## Overzicht

Dit plan voegt **Social Commerce kanalen** toe naast de bestaande e-commerce marketplaces. Het gaat om platforms waar consumenten direct producten kunnen ontdekken en kopen via sociale media en zoekmachines.

## Welke Kanalen Bestaan Er?

| Categorie | Platform | Type | API Status |
|-----------|----------|------|------------|
| **Google** | Google Merchant Center | Product Feed | ✅ Beschikbaar |
| **Google** | Google Shopping Ads | Advertenties | ✅ Via Merchant Center |
| **Meta** | Facebook Shop | Social Commerce | ✅ Commerce Manager API |
| **Meta** | Instagram Shop | Social Commerce | ✅ Via Facebook |
| **TikTok** | TikTok Shop | Social Commerce | ✅ Beschikbaar (UK/US) |
| **Pinterest** | Pinterest Catalog | Product Pins | ✅ Beschikbaar |
| **Snapchat** | Snapchat Catalog | Dynamic Ads | ✅ Beschikbaar |
| **WhatsApp** | WhatsApp Business Catalog | Messaging Commerce | ⚠️ Beperkt (via Meta) |
| **Microsoft** | Microsoft Merchant Center | Bing Shopping | ✅ Beschikbaar |
| **Amazon** | Amazon Posts | Social op Amazon | ⚠️ Alleen sellers |
| **Etsy** | Etsy Ads | Handmade/Vintage | ✅ Beschikbaar |
| **eBay** | eBay Feed | Marketplace | ✅ Beschikbaar |

## Nieuwe Architectuur

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SELLQO CONNECT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐     │
│  │       E-COMMERCE              │   │      SOCIAL COMMERCE          │     │
│  │       MARKETPLACES            │   │      CHANNELS                 │     │
│  ├───────────────────────────────┤   ├───────────────────────────────┤     │
│  │ ✅ Bol.com                    │   │ 🆕 Google Shopping            │     │
│  │ ✅ Amazon                     │   │ 🆕 Facebook/Instagram Shop    │     │
│  │ ✅ Shopify                    │   │ 🆕 TikTok Shop                │     │
│  │ ✅ WooCommerce                │   │ 🆕 Pinterest Catalog          │     │
│  │ ✅ Odoo                       │   │ 🆕 WhatsApp Business          │     │
│  │                               │   │ 🆕 Microsoft/Bing Shopping    │     │
│  └───────────────────────────────┘   └───────────────────────────────┘     │
│                                                                             │
│                    ▼                              ▼                         │
│              Orders/Inventory                Product Feeds                  │
│              Bi-directioneel                 One-way sync                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Deel 1: Uitbreiding Types & Database

### Nieuw Type: `SocialChannelType`

Naast `MarketplaceType` komt er een apart type voor social channels:

```typescript
export type SocialChannelType = 
  | 'google_shopping'      // Google Merchant Center
  | 'facebook_shop'        // Meta Commerce (FB + IG)
  | 'instagram_shop'       // Via Facebook Shop
  | 'tiktok_shop'          // TikTok Shop
  | 'pinterest_catalog'    // Pinterest Pins
  | 'whatsapp_business'    // WhatsApp Catalog
  | 'microsoft_shopping'   // Bing Shopping
  | 'snapchat_catalog';    // Snapchat Ads
```

### Database Uitbreiding: `social_channel_connections`

Aparte tabel voor social channels omdat ze anders werken dan marketplaces:

```sql
CREATE TABLE public.social_channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  channel_name TEXT,
  
  -- Credentials
  credentials JSONB DEFAULT '{}',
  
  -- Feed settings
  feed_url TEXT,                    -- Gegenereerde feed URL
  feed_format TEXT DEFAULT 'xml',   -- xml, json, csv
  last_feed_generated_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  products_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Product-niveau Kanaal Selectie

Uitbreiding van `products` tabel:

```sql
ALTER TABLE products ADD COLUMN social_channels JSONB DEFAULT '{}';
-- Voorbeeld: {"google_shopping": true, "facebook_shop": true, "pinterest": false}
```

## Deel 2: UI - Marketplaces Pagina Uitbreiding

### Nieuwe Tab Structuur

De Marketplaces pagina krijgt twee secties:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  SellQo Connect                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [E-commerce Marketplaces]  [Social Commerce]                               │
│   ────────────────────────   ─────────────────                              │
│                                                                             │
│  Social Commerce Channels                                                    │
│  ─────────────────────────                                                  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  🛒             │  │  📱             │  │  🎵             │             │
│  │  GOOGLE         │  │  META           │  │  TIKTOK         │             │
│  │  SHOPPING       │  │  FB + IG Shop   │  │  SHOP           │             │
│  │                 │  │                 │  │                 │             │
│  │  ⓘ Toon je     │  │  ⓘ Verkoop via  │  │  ⓘ Bereik Gen-Z│             │
│  │  producten in   │  │  Facebook en    │  │  met shoppable  │             │
│  │  Google zoek-   │  │  Instagram      │  │  video's        │             │
│  │  resultaten     │  │  direct         │  │                 │             │
│  │                 │  │                 │  │  🏷️ Binnenkort │             │
│  │  [Verbinden]    │  │  [Verbinden]    │  │  [Binnenkort]   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  📌             │  │  💬             │  │  🔍             │             │
│  │  PINTEREST      │  │  WHATSAPP       │  │  MICROSOFT      │             │
│  │  CATALOG        │  │  BUSINESS       │  │  SHOPPING       │             │
│  │                 │  │                 │  │                 │             │
│  │  ⓘ Product     │  │  ⓘ Toon je     │  │  ⓘ Bing en     │             │
│  │  pins voor      │  │  catalogus in   │  │  Microsoft Edge │             │
│  │  inspiratie     │  │  WhatsApp chats │  │  shopping       │             │
│  │                 │  │                 │  │                 │             │
│  │  [Verbinden]    │  │  [Verbinden]    │  │  [Verbinden]    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Info Tooltip per Kanaal

Elk kanaal heeft een uitleg-tooltip (ⓘ):

| Kanaal | Uitleg |
|--------|--------|
| **Google Shopping** | Laat je producten zien in Google zoekresultaten en het Shopping-tabblad. Klanten kunnen direct vergelijken en doorklikken. |
| **Facebook/Instagram Shop** | Verkoop direct via je Facebook en Instagram pagina. Klanten kunnen producten taggen en kopen zonder de app te verlaten. |
| **TikTok Shop** | Bereik jongere doelgroepen met shoppable video's. Link producten aan je TikTok content. |
| **Pinterest Catalog** | Maak Product Pins aan voor je hele assortiment. Ideaal voor home, fashion en lifestyle. |
| **WhatsApp Business** | Toon je catalogus direct in WhatsApp gesprekken. Klanten kunnen producten bekijken en vragen stellen. |
| **Microsoft/Bing Shopping** | Bereik Microsoft-gebruikers via Bing en Edge browser. Minder concurrentie dan Google. |

## Deel 3: Product-niveau Integratie

### ProductMarketplaceTab Uitbreiding

Het bestaande ProductMarketplaceTab.tsx krijgt een nieuwe sectie:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🛍️ Verkoopkanalen                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  E-commerce Marketplaces                                                     │
│  ─────────────────────────                                                  │
│  ✅ Bol.com          ✅ Amazon          ❌ Shopify                          │
│                                                                             │
│  Social Commerce Channels                                                    │
│  ────────────────────────                                                   │
│  ☑️ Google Shopping     Sync naar Google Merchant Center                    │
│  ☑️ Facebook Shop       Beschikbaar in FB & IG                              │
│  ☐ Pinterest            Niet geactiveerd                                    │
│  ☐ TikTok Shop          (Binnenkort beschikbaar)                            │
│                                                                             │
│  [Opslaan kanaal selectie]                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bulk Product Selectie

In de productenlijst: actie om meerdere producten tegelijk naar kanalen te pushen.

## Deel 4: Feed Generatie

### Product Feed Edge Function

Voor Google Shopping en andere feed-based kanalen:

```typescript
// supabase/functions/generate-product-feed/index.ts

// Ondersteunde formaten:
// - Google Merchant Center XML (RSS 2.0 met g: namespace)
// - Facebook Catalog CSV
// - Pinterest RSS
// - Generic JSON

// Endpoint: /functions/v1/generate-product-feed?tenant_id=xxx&format=google
```

### Feed URL per Tenant

Elk tenant krijgt een unieke feed URL:

```
https://[project].supabase.co/functions/v1/product-feed/[tenant-id]/google.xml
https://[project].supabase.co/functions/v1/product-feed/[tenant-id]/facebook.csv
https://[project].supabase.co/functions/v1/product-feed/[tenant-id]/pinterest.xml
```

## Deel 5: Google Shopping Integratie

### Setup Flow

1. Merchant maakt Google Merchant Center account aan
2. Voert Merchant ID in bij Sellqo
3. Sellqo genereert feed URL
4. Merchant voegt feed toe in Merchant Center
5. Optioneel: API koppeling voor directe sync

### Vereiste Product Velden

| Google Veld | Sellqo Veld | Verplicht |
|-------------|-------------|-----------|
| id | product.id | ✅ |
| title | name (of google_title) | ✅ |
| description | description (of google_description) | ✅ |
| link | webshop URL + slug | ✅ |
| image_link | featured_image | ✅ |
| price | price + currency | ✅ |
| availability | stock > 0 ? in_stock : out_of_stock | ✅ |
| brand | brand of tenant name | ✅ |
| gtin | barcode (EAN/UPC) | ⚠️ Aanbevolen |
| condition | altijd "new" of instelbaar | ✅ |
| google_product_category | category mapping | ⚠️ Aanbevolen |

## Deel 6: Meta (Facebook/Instagram) Shop

### Setup Flow

1. Koppeling via bestaande OAuth (SocialConnectionsManager)
2. Selecteer Facebook Business Page
3. Maak Commerce Catalog aan (of koppel bestaande)
4. Sync producten naar catalogus
5. Activeer Shop op Facebook/Instagram

### API Integratie

```typescript
// supabase/functions/sync-meta-catalog/index.ts
// Gebruikt Facebook Marketing API voor catalog management

// POST /[catalog_id]/batch
// - product_type: PRODUCT_ITEM
// - requests: [{ method: CREATE, retailer_id, data: {...} }]
```

## Technische Implementatie

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Database** | | |
| Migratie | SQL | `social_channel_connections` tabel |
| Migratie | SQL | `products.social_channels` JSONB kolom |
| **Types** | | |
| `socialChannels.ts` | Nieuw | Type definities en kanaal info |
| **Components** | | |
| `SocialChannelCard.tsx` | Nieuw | Kaart per social channel met tooltip |
| `SocialChannelList.tsx` | Nieuw | Grid van alle social channels |
| `ConnectSocialChannelDialog.tsx` | Nieuw | Connect wizard per kanaal |
| `ProductSocialChannels.tsx` | Nieuw | Per-product kanaal selectie |
| `FeedPreviewDialog.tsx` | Nieuw | Preview van gegenereerde feed |
| **Edge Functions** | | |
| `generate-product-feed/index.ts` | Nieuw | Multi-format feed generator |
| `sync-meta-catalog/index.ts` | Nieuw | Facebook/Instagram sync |
| `sync-google-merchant/index.ts` | Nieuw | Google Merchant Center (optioneel, kan ook via feed) |
| **Hooks** | | |
| `useSocialChannels.ts` | Nieuw | CRUD voor social channel connections |
| **Updates** | | |
| `Marketplaces.tsx` | Update | Tabs toevoegen voor social channels |
| `ProductMarketplaceTab.tsx` | Update | Social channels sectie toevoegen |

## UI Flow Samenvatting

```text
                    Merchant Journey
                         │
     ┌───────────────────┴───────────────────┐
     │                                       │
     ▼                                       ▼
┌─────────────┐                       ┌─────────────┐
│ SellQo      │                       │ Product     │
│ Connect     │                       │ Detail      │
│ Pagina      │                       │ Pagina      │
└──────┬──────┘                       └──────┬──────┘
       │                                     │
       │ Kies kanaal                         │ Kies per product
       │ + Verbind                           │ welke kanalen
       ▼                                     ▼
┌─────────────┐                       ┌─────────────┐
│ Connect     │                       │ Checkbox    │
│ Wizard      │                       │ per kanaal  │
│ (OAuth/Feed)│                       │ ☑️ Google   │
└──────┬──────┘                       │ ☑️ Facebook │
       │                              └─────────────┘
       ▼
┌─────────────┐
│ Feed URL of │
│ API Sync    │
│ actief      │
└─────────────┘
```

## Resultaat

Na implementatie kan de merchant:

| Feature | Beschrijving |
|---------|-------------|
| **Google Shopping** | Producten in Google zoekresultaten |
| **Facebook Shop** | Verkopen via Facebook pagina |
| **Instagram Shop** | Taggen en verkopen in posts |
| **Pinterest** | Product Pins voor inspiratie |
| **WhatsApp Catalog** | Producten tonen in chats |
| **Per-product selectie** | Kies welke producten waar verschijnen |
| **Automatische feeds** | Realtime feed URLs voor elk platform |
| **Centrale controle** | Alles beheren vanuit Sellqo |

De architectuur is schaalbaar: nieuwe kanalen kunnen eenvoudig worden toegevoegd door een nieuwe `SocialChannelType` en bijbehorende feed formatter.


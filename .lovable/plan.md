
# Plan: SellQo Connect, AI Hubs & Socials - Samenhang Optimalisatie

## Huidige Situatie Analyse

Na analyse van de codebase zie ik de volgende structuur en overlappingen:

### Wat We Hebben

```text
HUIDIGE STRUCTUUR (Met Overlappingen)
─────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│  SELLQO CONNECT (/admin/connect)                                            │
│  ─────────────────────────────────                                          │
│  ├── E-commerce Tab (Bol.com, Amazon, Shopify, WooCommerce, Odoo)           │
│  └── Social Commerce Tab (Google Shopping, FB/IG Shop, TikTok, etc.)        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  INSTELLINGEN > SOCIAL MEDIA (/admin/settings?section=social)               │
│  ───────────────────────────────────────────────────────────────            │
│  ├── Website Links Tab (Footer links voor webshop)                          │
│  └── Autopost Tab (OAuth voor FB, X, LinkedIn content posting) ◄── OVERLAP │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PRODUCT > MARKETPLACES TAB                                                  │
│  ───────────────────────────                                                │
│  ├── Bol.com sectie (EAN, titel, bullets, publish)                          │
│  ├── Amazon sectie (ASIN, titel, bullets, publish)                          │
│  ├── Shopify sectie                                                         │
│  ├── WooCommerce sectie                                                     │
│  └── Odoo sectie                                                            │
│                                                                             │
│  ❌ MIST: Social Commerce kanalen (Google Shopping, FB Shop, etc.)          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AI MARKETING HUB (/admin/marketing/ai)                                      │
│  ────────────────────────────────────────                                   │
│  ├── Content Generator (posts, emails, promo kits)                          │
│  ├── Content Calendar                                                       │
│  └── Content Library                                                        │
│                                                                             │
│  AI ACTIE CENTRUM (/admin/marketing/ai-center)                               │
│  ────────────────────────────────────────────────                           │
│  └── AI Suggesties (purchase orders, campaigns, etc.)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Geïdentificeerde Problemen

| # | Probleem | Locatie |
|---|----------|---------|
| 1 | **Social Commerce mist in ProductMarketplaceTab** | Product edit pagina toont alleen e-commerce marketplaces, niet de social channels (Google Shopping, FB Shop, etc.) |
| 2 | **Overlap Social Autopost & Social Commerce** | Settings > Social Media > Autopost = OAuth voor content posting. Dit overlapt met SellQo Connect > Social Commerce OAuth (beide connecteren Facebook/Instagram) |
| 3 | **Navigatie verwarring** | Sidebar heeft "Marketplaces" (→ Connect) EN "Integraties > SellQo Connect" - beide gaan naar dezelfde pagina |
| 4 | **Social Links vs Social Commerce** | "Social Links" (footer URLs) en "Social Commerce" (shopping channels) zijn verschillende dingen maar zitten bij elkaar |

## Gewenste Structuur

```text
NIEUWE SAMENHANGENDE STRUCTUUR
──────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│  SELLQO CONNECT (/admin/connect)                                            │
│  ══════════════════════════════                                             │
│  De centrale hub voor ALLE verkoopkanaal integraties                        │
│                                                                             │
│  [E-commerce]  [Social Commerce]  [Autopost]                                │
│                                                                             │
│  E-commerce:      Bol.com, Amazon, Shopify, WooCommerce, Odoo               │
│  Social Commerce: Google Shopping, FB/IG Shop, TikTok, Pinterest, WhatsApp  │
│  Autopost:        Auto-posten naar FB, X, LinkedIn (verplaatst van Settings)│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  INSTELLINGEN > SOCIAL MEDIA (/admin/settings?section=social)               │
│  ═══════════════════════════════════════════════════════════                │
│  Alleen: Website/Footer Links (geen Autopost meer)                          │
│                                                                             │
│  + Link naar "SellQo Connect" voor geavanceerde koppelingen                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PRODUCT > VERKOOPKANALEN TAB (hernoemd van "Marketplaces")                 │
│  ═════════════════════════════════════════════════════════                  │
│                                                                             │
│  E-commerce Marketplaces                                                    │
│  ─────────────────────────                                                  │
│  ✅ Bol.com, ✅ Amazon, ✅ Shopify, ✅ WooCommerce, ✅ Odoo                  │
│                                                                             │
│  Social Commerce Channels  ◄── NIEUW                                        │
│  ─────────────────────────                                                  │
│  ☑️ Google Shopping    ☑️ Facebook Shop    ☑️ Instagram Shop               │
│  ☐ Pinterest           ☐ TikTok            ☐ WhatsApp                       │
│                                                                             │
│  (Alleen kanalen tonen die verbonden zijn in SellQo Connect)                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AI MARKETING (/admin/marketing/ai) - Ongewijzigd                           │
│  ════════════════════════════════════════════════                           │
│  AI Content Hub + AI Actie Centrum blijven apart                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Wijzigingen

### 1. SellQo Connect: Autopost Tab Toevoegen

Verplaats de Autopost functionaliteit van Settings naar SellQo Connect als derde tab:

```text
SellQo Connect
├── E-commerce (bestaand)
├── Social Commerce (bestaand)
└── Autopost (NIEUW - verplaatst van Settings)
```

**Bestanden:**
- `src/pages/admin/Marketplaces.tsx` - Nieuwe tab toevoegen met SocialConnectionsManager

### 2. Settings Social Media: Vereenvoudigen

De Social Media settings worden vereenvoudigd naar alleen footer links:

**Bestanden:**
- `src/components/admin/settings/SocialMediaHub.tsx` - Verwijder tabs, alleen SocialLinksEditor tonen
- Voeg link toe naar "SellQo Connect" voor koppelingen

### 3. ProductMarketplaceTab: Social Channels Toevoegen

Nieuwe sectie in de product marketplace tab voor social channel selectie:

```text
ProductMarketplaceTab.tsx
├── Bestaande marketplace secties (Bol, Amazon, etc.)
└── NIEUW: ProductSocialChannels component
    └── Checkboxes voor elk verbonden social channel
```

**Bestanden:**
- `src/components/admin/marketplace/ProductSocialChannels.tsx` (nieuw)
- `src/components/admin/marketplace/ProductMarketplaceTab.tsx` - Integratie

### 4. Sidebar: Opruimen Duplicatie

Verwijder "Marketplaces" uit Verkoop sectie (dupliceert "Integraties > SellQo Connect"):

**Bestanden:**
- `src/components/admin/sidebar/sidebarConfig.ts`

### 5. Tab Hernoemen (Optioneel)

Overweeg "Marketplaces" tab in product te hernoemen naar "Verkoopkanalen" voor duidelijkheid.

## Technische Details

### Nieuwe Component: ProductSocialChannels.tsx

```typescript
// Toont checkboxes voor social channels
// Leest verbonden kanalen uit useSocialChannels()
// Slaat selectie op in products.social_channels JSONB
```

Features:
- Alleen verbonden kanalen tonen (niet alle mogelijke)
- Sync status per kanaal
- Bulk sync knop
- Link naar SellQo Connect als geen kanalen verbonden

### Updated Marketplaces.tsx

Drie tabs in plaats van twee:
1. E-commerce (bestaand)
2. Social Commerce (bestaand)
3. Autopost (nieuw - bevat SocialConnectionsManager)

### Updated SocialMediaHub.tsx

Vereenvoudigd naar:
- Alleen SocialLinksEditor (footer links)
- Infobox met link naar SellQo Connect voor koppelingen

### Updated sidebarConfig.ts

```typescript
// VERWIJDER uit salesItems:
// { id: 'marketplaces', title: 'Marketplaces', url: '/admin/connect', icon: Store, featureKey: 'marketplaces' },

// BEHOUD in systemItems:
// { id: 'integrations-connect', title: 'SellQo Connect', url: '/admin/connect' },
```

## Resultaat Na Implementatie

| Gebied | Voor | Na |
|--------|------|-----|
| **SellQo Connect** | 2 tabs (E-commerce, Social) | 3 tabs (E-commerce, Social Commerce, Autopost) |
| **Settings > Social** | 2 tabs (Links, Autopost) | 1 sectie (alleen Links) + link naar Connect |
| **Product > Marketplaces** | 5 marketplaces | 5 marketplaces + Social Channels sectie |
| **Sidebar** | Dubbele link naar Connect | Eén duidelijke plek onder "Integraties" |

## Flow Diagram

```text
MERCHANT WILT VERKOPEN VIA FACEBOOK SHOP
─────────────────────────────────────────

1. Ga naar SellQo Connect
   └── Social Commerce tab
       └── Verbind Facebook/Instagram Shop

2. Ga naar Product Edit
   └── Verkoopkanalen tab
       └── Social Commerce sectie
           └── ☑️ Facebook Shop activeren

3. Product wordt gesynchroniseerd naar Meta Catalog
   └── Verschijnt in Facebook Shop + Instagram Shop

─────────────────────────────────────────

MERCHANT WILT AUTO-POSTEN NAAR SOCIAL
─────────────────────────────────────────

1. Ga naar SellQo Connect
   └── Autopost tab
       └── Verbind Facebook account (voor content)

2. Ga naar AI Marketing Hub
   └── Genereer content
       └── Publiceer naar Facebook

─────────────────────────────────────────

MERCHANT WILT SOCIAL LINKS IN FOOTER
─────────────────────────────────────────

1. Ga naar Instellingen
   └── Social Media sectie
       └── Vul Facebook URL in
           └── Verschijnt in webshop footer
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `Marketplaces.tsx` | Update | 3e tab "Autopost" toevoegen |
| `SocialMediaHub.tsx` | Update | Vereenvoudigen, tabs verwijderen |
| `ProductSocialChannels.tsx` | Nieuw | Per-product social channel selectie |
| `ProductMarketplaceTab.tsx` | Update | Social channels sectie integreren |
| `sidebarConfig.ts` | Update | Duplicaat sidebar item verwijderen |

Dit plan zorgt voor een logische scheiding:
- **SellQo Connect** = Alle externe verkoopkanalen & koppelingen
- **Product Verkoopkanalen** = Per-product activeren/deactiveren
- **AI Marketing** = Content generatie & automatisering
- **Settings** = Configuratie (footer links, etc.)


# Plan: Advertentie-integraties (Ads Manager)

## Samenvatting

Dit plan voegt een **Ads Manager** toe aan SellQo waarmee merchants betaalde advertenties kunnen aanmaken en beheren op meerdere platforms. We beginnen met de meest haalbare integraties en bouwen uit.

---

## Haalbaarheidsanalyse

### Realistische Beoordeling per Platform

| Platform | Status | Complexiteit | Timeline |
|----------|--------|--------------|----------|
| **Bol.com Ads** | ✅ Retailer API beschikbaar | Laag | 1-2 weken |
| **Meta Ads (FB/IG)** | ✅ Catalog sync bestaat | Medium | 2-3 weken |
| **Google Ads** | ⚠️ Developer Token nodig | Medium-Hoog | 3-4 weken |
| **Amazon Ads** | ⚠️ Aparte API approval | Hoog | 4-6 weken |

### Wat wel en niet kan

**Kan WEL:**
- Campagnes aanmaken met doelgroep-selectie
- Segmenten uploaden als Custom Audiences
- Budget en biedingen instellen
- Performance metrics ophalen
- AI-suggesties voor campagnes

**Kan NIET (platform beperkingen):**
- Betaling via SellQo (gaat altijd naar merchant's eigen ad account)
- 100% automatisch zonder OAuth goedkeuring per merchant
- Realtime bidding (dat doen de platforms zelf)

---

## 1. Database Ontwerp

### Nieuwe Tabellen

```sql
-- Ad Platform Connections (OAuth tokens per merchant)
CREATE TABLE public.ad_platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- 'google_ads', 'meta_ads', 'bol_ads', 'amazon_ads'
  
  -- Account info
  account_id TEXT,
  account_name TEXT,
  currency TEXT DEFAULT 'EUR',
  
  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Platform-specific config
  config JSONB DEFAULT '{}',
  -- Google: { customer_id, developer_token }
  -- Meta: { ad_account_id, pixel_id, catalog_id }
  -- Bol: { retailer_id } (uses existing JWT)
  -- Amazon: { profile_id, marketplace_id }
  
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ad Campaigns (unified across platforms)
CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.ad_platform_connections(id),
  
  -- Basic info
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  -- Types: 'sponsored_products', 'dynamic_product_ads', 'remarketing', 'prospecting'
  
  -- Targeting
  segment_id UUID REFERENCES public.customer_segments(id),
  audience_type TEXT,  -- 'custom', 'lookalike', 'interest', 'retargeting'
  audience_config JSONB DEFAULT '{}',
  -- { lookalike_source: 'vip_customers', interest_categories: [...] }
  
  product_ids UUID[],  -- Specific products to advertise
  category_ids UUID[], -- Or entire categories
  
  -- Budget
  budget_type TEXT DEFAULT 'daily',  -- 'daily', 'lifetime'
  budget_amount DECIMAL(10,2),
  bid_strategy TEXT,  -- 'auto', 'manual_cpc', 'target_roas'
  target_roas DECIMAL(5,2),
  
  -- Schedule
  status TEXT DEFAULT 'draft',
  -- 'draft', 'pending_approval', 'active', 'paused', 'ended', 'rejected'
  start_date DATE,
  end_date DATE,
  
  -- Platform reference
  platform_campaign_id TEXT,  -- ID on the ad platform
  platform_status TEXT,
  
  -- Performance (synced from platform)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(5,2),
  
  -- AI-generated
  ai_suggested BOOLEAN DEFAULT false,
  ai_suggestion_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ad Creatives (images, copy per campaign)
CREATE TABLE public.ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  
  creative_type TEXT NOT NULL,  -- 'image', 'carousel', 'video', 'text'
  headline TEXT,
  description TEXT,
  call_to_action TEXT,
  
  image_urls TEXT[],
  video_url TEXT,
  
  platform_creative_id TEXT,
  status TEXT DEFAULT 'draft',
  
  -- A/B testing
  variant_label TEXT,  -- 'A', 'B', etc.
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audience Sync Log (track uploaded audiences)
CREATE TABLE public.ad_audience_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.ad_platform_connections(id),
  segment_id UUID REFERENCES public.customer_segments(id),
  
  platform TEXT NOT NULL,
  platform_audience_id TEXT,
  audience_name TEXT,
  audience_size INTEGER,
  
  sync_type TEXT,  -- 'upload', 'update', 'delete'
  sync_status TEXT,  -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  
  synced_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2. Architectuur Overzicht

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SELLQO ADS MANAGER                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────────────────────┐    │
│  │   Admin UI          │     │   Edge Functions                        │    │
│  │   /admin/ads        │     │                                         │    │
│  │                     │     │   ads-connect-platform                  │    │
│  │   • Platform Setup  │────▶│   ads-create-campaign                   │    │
│  │   • Campagne Wizard │     │   ads-sync-audience                     │    │
│  │   • Performance     │     │   ads-sync-performance                  │    │
│  │   • AI Suggesties   │     │   ads-suggest-campaign (AI)             │    │
│  └─────────────────────┘     └───────────────┬─────────────────────────┘    │
│                                              │                               │
│  ┌───────────────────────────────────────────┼───────────────────────────┐  │
│  │                     PLATFORM ADAPTERS     │                           │  │
│  │                                           ▼                           │  │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │   │ Bol.com  │  │   Meta   │  │  Google  │  │  Amazon  │             │  │
│  │   │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │             │  │
│  │   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘             │  │
│  │        │             │             │             │                    │  │
│  └────────┼─────────────┼─────────────┼─────────────┼────────────────────┘  │
│           │             │             │             │                       │
│           ▼             ▼             ▼             ▼                       │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│   │ Bol.com   │  │ Meta      │  │ Google    │  │ Amazon    │               │
│   │ Adv. API  │  │ Mktg API  │  │ Ads API   │  │ Adv. API  │               │
│   └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fase 1: Bol.com Sponsored Products (Meest Haalbaar)

### Waarom eerst Bol.com?
- Bestaande Retailer API koppeling (JWT token)
- Eenvoudige API (v11)
- Geen aparte OAuth nodig
- Nederlandse focus past bij SellQo

### Functionaliteit

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOL.COM SPONSORED PRODUCTS                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Campagne Type:                                                             │
│  ◉ Automatisch (AI-gestuurde keywords)                                      │
│  ○ Handmatig (eigen keywords kiezen)                                        │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Producten selecteren:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [✓] Premium Koptelefoon XR-500          EAN: 8712345678901         │   │
│  │  [✓] Bluetooth Speaker Pro               EAN: 8712345678902         │   │
│  │  [ ] Oordopjes Basic                     EAN: 8712345678903         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Alleen producten die actief zijn op Bol.com worden getoond                 │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Budget:                                                                    │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │  Dagbudget           │  │  Totaalbudget        │                        │
│  │  €___[25.00]_____    │  │  €___[500.00]____    │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
│                                                                             │
│  ACoS Doel (Advertising Cost of Sale):                                      │
│  [═══════════○═══════] 15%                                                  │
│  Bol.com optimaliseert biedingen om dit doel te bereiken                    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  [Concept opslaan]                        [Campagne starten →]              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edge Function: ads-bol-campaign

```typescript
// supabase/functions/ads-bol-campaign/index.ts
// Maakt campagnes aan via Bol.com Advertising API v11

// Stap 1: Haal JWT token uit bestaande bol.com connection
// Stap 2: Maak Campaign met AUTO of MANUAL type
// Stap 3: Maak Ad Group onder de campaign
// Stap 4: Voeg producten toe als Ads
// Stap 5: Sla platform_campaign_id op in ad_campaigns tabel
```

---

## 4. Fase 2: Meta Ads (Facebook & Instagram)

### Vereisten
- Meta Business Manager account (merchant)
- Facebook Pixel geïnstalleerd (voor remarketing)
- Product Catalog gesynchroniseerd (bestaand)

### Doelgroep Opties

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  META ADS - DOELGROEP                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Kies je doelgroep type:                                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  📋 CUSTOM AUDIENCE (jouw klanten)                                    │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │  Upload een SellQo segment naar Meta                                  │ │
│  │                                                                       │ │
│  │  Selecteer segment:                                                   │ │
│  │  [▼ VIP Klanten (€1000+ besteed) - 234 klanten              ]        │ │
│  │                                                                       │ │
│  │  ℹ️ Email adressen worden versleuteld (hashed) geüpload              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  👥 LOOKALIKE AUDIENCE (vergelijkbare mensen)                         │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │  Vind mensen die lijken op je beste klanten                           │ │
│  │                                                                       │ │
│  │  Bron segment:                                                        │ │
│  │  [▼ Herhaalaankopen (3+ orders)                             ]        │ │
│  │                                                                       │ │
│  │  Lookalike grootte:                                                   │ │
│  │  [═══○═══════════════] 1% (meest vergelijkbaar)                       │ │
│  │                                                                       │ │
│  │  Geschat bereik: ~50.000 - 100.000 mensen                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  🔄 RETARGETING (website bezoekers)                                   │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │  Bereik mensen die je webshop hebben bezocht                          │ │
│  │                                                                       │ │
│  │  [✓] Product bekeken maar niet gekocht (laatste 7 dagen)              │ │
│  │  [✓] Winkelwagen verlaten (laatste 14 dagen)                          │ │
│  │  [ ] Alle bezoekers (laatste 30 dagen)                                │ │
│  │                                                                       │ │
│  │  ⚠️ Vereist Facebook Pixel installatie                               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edge Function: ads-meta-sync-audience

```typescript
// supabase/functions/ads-meta-sync-audience/index.ts
// Upload SellQo segment als Meta Custom Audience

// Stap 1: Haal klant emails uit segment
// Stap 2: Hash emails met SHA256 (Meta vereiste)
// Stap 3: Upload naar Meta Custom Audiences API
// Stap 4: Optioneel: Maak Lookalike Audience
// Stap 5: Sla platform_audience_id op
```

---

## 5. Fase 3: Google Ads

### Vereisten
- Google Ads Developer Token (Basic of Standard)
- OAuth2 consent van merchant
- Customer Match goedkeuring

### Campagne Types

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  GOOGLE ADS - CAMPAGNE TYPE                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  🛒 SHOPPING (Performance Max)                                        │ │
│  │  Automatische productadvertenties in Google Shopping                  │ │
│  │  Vereist: Google Merchant Center koppeling                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  🔍 SEARCH (Tekstadvertenties)                                        │ │
│  │  Verschijn in Google zoekresultaten                                   │ │
│  │  AI genereert keywords op basis van producten                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  📺 DISPLAY (Banner advertenties)                                     │ │
│  │  Visuele ads op websites in het Google Display Network                │ │
│  │  Doelgroep: Remarketing of Interesses                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Fase 4: Amazon Ads (Toekomst)

### Complexiteit
- Aparte Amazon Advertising API credentials
- Beperkt tot sellers met Amazon Seller Central
- Sponsored Products, Sponsored Brands, Sponsored Display

### Gepland
- Later implementeren na succesvolle Google/Meta integratie

---

## 7. AI-Gestuurde Campagne Suggesties

### Integratie met Proactive Monitor

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 AI CAMPAGNE SUGGESTIE                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  💡 Bestseller Promotie                                                     │
│  ──────────────────────────────────────────────────────                     │
│  "Premium Koptelefoon XR-500" heeft 45 verkopen deze week.                  │
│  Een Bol.com Sponsored Products campagne kan dit versterken.                │
│                                                                             │
│  Geschatte impact:                                                          │
│  • +15-25% extra verkopen                                                   │
│  • Aanbevolen budget: €10/dag                                               │
│  • Verwachte ACoS: 12-18%                                                   │
│                                                                             │
│  [Campagne aanmaken]  [Later]  [Niet meer tonen]                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 Win-back Campagne                                                       │
│  ──────────────────────────────────────────────────────                     │
│  123 klanten hebben 90+ dagen niet besteld.                                 │
│  Een Facebook retargeting campagne kan ze terugbrengen.                     │
│                                                                             │
│  Voorgestelde doelgroep: "Inactieve klanten (90+ dagen)"                    │
│  Aanbevolen type: Custom Audience + Dynamic Product Ads                     │
│                                                                             │
│  [Campagne aanmaken]  [Later]  [Niet meer tonen]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Admin UI: /admin/ads

### Navigatie Structuur

```text
/admin/ads
├── /overview          - Dashboard met alle campagnes
├── /platforms         - Platform koppelingen beheren
├── /campaigns
│   ├── /new          - Nieuwe campagne wizard
│   └── /:id          - Campagne detail/edit
├── /audiences        - Audience syncs beheren
└── /insights         - Cross-platform analytics
```

### Ads Dashboard

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📢 Advertenties                                                                        │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  [+ Nieuwe Campagne]                                                                    │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  📊 OVERZICHT (afgelopen 30 dagen)                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  Totaal Bereik   │  │    Clicks        │  │    Uitgaven      │  │     ROAS       │  │
│  │    125.4K        │  │     3.2K         │  │    €1,245        │  │     4.2x       │  │
│  │    ↑ 12%         │  │    ↑ 8%          │  │    ↑ 15%         │  │    ↑ 0.3x      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  🔗 GEKOPPELDE PLATFORMS                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  [Bol.com ✓]     [Meta (FB/IG) ✓]     [Google Ads ○]     [Amazon ○]            │   │
│  │  2 campagnes     1 campagne           Niet gekoppeld      Niet gekoppeld        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  📋 ACTIEVE CAMPAGNES                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Platform  │  Naam                    │  Status  │  Budget  │  Spend  │  ROAS   │   │
│  │  ──────────┼──────────────────────────┼──────────┼──────────┼─────────┼─────────│   │
│  │  [Bol]     │  Bestsellers Q1          │  ● Actief│  €25/dag │  €312   │  5.2x   │   │
│  │  [Bol]     │  Nieuwe Collectie        │  ● Actief│  €15/dag │  €98    │  3.8x   │   │
│  │  [Meta]    │  VIP Retargeting         │  ● Actief│  €20/dag │  €145   │  4.1x   │   │
│  │  [Meta]    │  Lookalike Campagne      │  ○ Gepauzeerd │  -   │  €89    │  2.9x   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  💡 AI SUGGESTIES                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🔥 "Premium Koptelefoon XR-500" is trending (+45% views)                       │   │
│  │     Overweeg een Bol.com Sponsored Products campagne  [Maken →]                 │   │
│  │                                                                                 │   │
│  │  👥 123 inactieve klanten kunnen worden bereikt via Meta Retargeting            │   │
│  │     Segment: "90+ dagen inactief"  [Maken →]                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_ads.sql` | Nieuw | Ad platforms, campaigns, creatives, syncs |
| **Types** | | |
| `src/types/ads.ts` | Nieuw | Ad campaign & platform types |
| **Hooks** | | |
| `src/hooks/useAdPlatforms.ts` | Nieuw | Platform connections CRUD |
| `src/hooks/useAdCampaigns.ts` | Nieuw | Campaign management |
| `src/hooks/useAudienceSync.ts` | Nieuw | Segment → Audience sync |
| **Edge Functions** | | |
| `supabase/functions/ads-bol-campaign/index.ts` | Nieuw | Bol.com campaign CRUD |
| `supabase/functions/ads-meta-campaign/index.ts` | Nieuw | Meta campaign CRUD |
| `supabase/functions/ads-meta-sync-audience/index.ts` | Nieuw | Upload segments to Meta |
| `supabase/functions/ads-google-campaign/index.ts` | Nieuw | Google Ads campaign |
| `supabase/functions/ads-sync-performance/index.ts` | Nieuw | Pull metrics from platforms |
| `supabase/functions/ads-suggest-campaign/index.ts` | Nieuw | AI campaign suggestions |
| **Pages** | | |
| `src/pages/admin/Ads.tsx` | Nieuw | Main ads dashboard |
| **Components** | | |
| `src/components/admin/ads/AdsDashboard.tsx` | Nieuw | Overview component |
| `src/components/admin/ads/PlatformConnections.tsx` | Nieuw | Platform setup |
| `src/components/admin/ads/CampaignWizard.tsx` | Nieuw | Step-by-step creator |
| `src/components/admin/ads/AudienceBuilder.tsx` | Nieuw | Targeting UI |
| `src/components/admin/ads/CampaignCard.tsx` | Nieuw | Campaign list item |
| `src/components/admin/ads/PerformanceChart.tsx` | Nieuw | ROAS, spend charts |
| `src/components/admin/ads/AISuggestions.tsx` | Nieuw | AI campaign ideas |

---

## 10. Implementatie Volgorde

1. **Database Migration** - Alle ads-gerelateerde tabellen
2. **Types & Hooks** - TypeScript types en React Query hooks
3. **Bol.com Integratie** - Eerste platform (bestaande token)
4. **Admin UI Basis** - Dashboard, platform connections
5. **Campaign Wizard** - Stap-voor-stap campagne maken
6. **Meta Integratie** - Custom & Lookalike audiences
7. **Performance Sync** - Automatisch metrics ophalen
8. **AI Suggesties** - Proactive campaign recommendations
9. **Google Ads** (Fase 2) - Na Developer Token approval

---

## 11. Belangrijke Overwegingen

### OAuth Flow per Platform
```text
Merchant klikt "Koppelen" → Redirect naar platform OAuth → 
Terug naar SellQo met tokens → Opslaan in ad_platform_connections
```

### Rate Limiting
- Bol.com: 15.000 campagnes max
- Meta: Varieert per ad spend
- Google: 15.000 ops/dag (Basic token)

### Kosten
- **Bol.com**: Geen extra kosten (onderdeel Retailer API)
- **Meta**: Gratis API, ads betaald door merchant
- **Google**: Gratis API (met goedkeuring), ads betaald door merchant

### Privacy
- Email hashing (SHA256) voor Custom Audiences
- Geen opslag van ruwe advertentie data
- GDPR-compliant audience uploads

---

## 12. Conclusie

**Ja, dit is haalbaar!** De infrastructuur voor segmenten, catalog sync, en tracking pixels is al aanwezig. We kunnen starten met Bol.com (bestaande koppeling) en Meta (catalog sync bestaat) voordat we Google Ads toevoegen.

De grootste uitdaging is niet technisch, maar het OAuth-proces voor elke merchant. Dit is echter standaard voor alle marketing platforms en gebruikers zijn dit gewend van tools als Mailchimp, Klaviyo, etc.

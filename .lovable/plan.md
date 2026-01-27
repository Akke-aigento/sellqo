

# Plan: Feature Gating, Sidebar Filtering & Pricing Herziening

## Analyse Huidige Situatie

### 1. Feature Gating - Bevindingen

**Wat WEL werkt:**
- `FeatureGate` component blokkeert UI met lock-icoon
- `checkFeature()` controleert features uit `pricing_plans.features`
- Limieten (products, orders, customers, users) worden gecontroleerd

**Wat NIET werkt:**
| Probleem | Impact |
|----------|--------|
| Sidebar toont ALLE items ongeacht plan | Verwarrend voor Free users |
| `featureKey` in sidebarConfig wordt **NIET** gebruikt | Items altijd zichtbaar |
| AI credits staan op **0** voor alle plannen | Geen AI beschikbaar |
| Slechts 11 features gedefinieerd in `PricingPlanFeatures` | Veel functies ongegated |
| Geen `pos`, `ai_copywriting`, `bol_vvb`, `shop_health` etc. | Nieuwe features niet geblokkeerd |

**Huidige `PricingPlanFeatures` interface (beperkt):**
```
customDomain, removeWatermark, prioritySupport, apiAccess, 
webhooks, advancedAnalytics, whiteLabel, multiCurrency, 
facturX, peppol, ai_marketing
```

**Ontbrekende feature keys voor gating:**
- `pos` - POS Kassa
- `ai_copywriting` - AI voor storefront teksten
- `ai_images` - AI afbeelding generatie
- `bol_vvb_labels` - Bol.com VVB verzendlabels
- `shop_health` - Shop Health Dashboard
- `ai_coach` - Proactieve AI Business Coach
- `gamification` - Badges & Milestones
- `live_activity` - Live Activity Feed
- `whatsapp_integration` - WhatsApp berichten
- `multi_warehouse` - Multi-warehouse management
- `seo_tools` - SEO analyse tools
- `social_commerce` - Meta/Google Shop sync

### 2. Sidebar Filtering - Bevindingen

**Probleem:** De `AdminSidebar` controleert alleen:
- `isItemHidden()` - user preference (personaliseer menu)
- `isItemRoleHidden()` - role-based (warehouse, staff, etc.)

**NIET gecontroleerd:**
- `featureKey` property wordt genegeerd in de render logic
- Geen subscription-based filtering geïmplementeerd

**Resultaat:** Een Free user ziet POS, AI Tools, etc. in sidebar maar krijgt lock-scherm bij klikken.

### 3. AI Credits - Bevindingen

**Database status:**
```
ai_credits_monthly = 0 voor ALLE plannen (Free, Starter, Pro, Enterprise)
```

Dit betekent dat niemand AI credits heeft, ongeacht plan!

### 4. Marketing Pagina - Ontbrekende Features

**Niet vermeld op landing/pricing:**
- 5-minuten launch wizard
- Shop Health Score dashboard
- Proactieve AI Business Coach
- "Vandaag verdien je..." gamification
- Live Activity Feed
- WhatsApp Support + Order Alerts
- Bol.com VVB labels
- Bank Transfer QR-codes (geen transactiekosten)

---

## Voorgestelde Nieuwe Pricing Structuur

### Kernfilosofie

| Plan | Strategie |
|------|-----------|
| **Free** | Proefversie met upsell overal - laat waarde zien, blokkeer uitvoering |
| **Starter** | Basis functionaliteit + modules als add-ons kopen |
| **Pro** | Alle kernfuncties + AI - "sweet spot" voor groeiende shops |
| **Enterprise** | Alles onbeperkt + white-label + dedicated support |

### Gedetailleerde Plan Matrix

```
┌─────────────────────────────┬──────────┬──────────┬──────────┬─────────────┐
│ Feature                     │ Free     │ Starter  │ Pro      │ Enterprise  │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ CORE LIMITS                 │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Producten                   │ 25       │ 250      │ 2500     │ Onbeperkt   │
│ Bestellingen/maand          │ 50       │ 500      │ 5000     │ Onbeperkt   │
│ Klanten                     │ 100      │ 1000     │ 10000    │ Onbeperkt   │
│ Teamleden                   │ 1        │ 3        │ 10       │ 50          │
│ Opslag (GB)                 │ 1        │ 10       │ 50       │ 250         │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ DAGELIJKS                   │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Dashboard                   │ ✅       │ ✅       │ ✅       │ ✅          │
│ Shop Health Score           │ Beperkt  │ ✅       │ ✅       │ ✅          │
│ Gamification & Badges       │ ❌       │ ✅       │ ✅       │ ✅          │
│ Live Activity Feed          │ ❌       │ ❌       │ ✅       │ ✅          │
│ Klantgesprekken Inbox       │ 10/maand │ 100/m    │ Onbep.   │ Onbeperkt   │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ VERKOOP                     │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ POS Kassa                   │ ❌       │ Add-on   │ ✅       │ ✅          │
│ Webshop Builder             │ ❌       │ Add-on   │ ✅       │ ✅          │
│ Visual Editor               │ ❌       │ ❌       │ ✅       │ ✅          │
│ Premium Themes              │ ❌       │ ❌       │ 1 gratis │ Alle        │
│ Promoties (basis)           │ 1 type   │ 4 types  │ Alle 8   │ Alle 8      │
│ Kortingscodes               │ ✅       │ ✅       │ ✅       │ ✅          │
│ Bundels/BOGO/Volume         │ ❌       │ ✅       │ ✅       │ ✅          │
│ Cadeaubonnen                │ ❌       │ ✅       │ ✅       │ ✅          │
│ Loyaliteitsprogramma        │ ❌       │ ❌       │ ✅       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ AI CAPABILITIES             │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ AI Credits/maand            │ 0        │ 50       │ 500      │ Onbeperkt   │
│ AI Marketing Content        │ ❌       │ ✅       │ ✅       │ ✅          │
│ AI Productbeschrijvingen    │ ❌       │ ✅       │ ✅       │ ✅          │
│ AI Storefront Copy          │ ❌       │ ❌       │ ✅       │ ✅          │
│ AI A/B Test Variaties       │ ❌       │ ❌       │ ✅       │ ✅          │
│ AI SEO Analyse              │ ❌       │ Basis    │ ✅       │ ✅          │
│ AI Afbeelding Generatie     │ ❌       │ ❌       │ ✅       │ ✅          │
│ AI Business Coach           │ ❌       │ ❌       │ ✅       │ ✅          │
│ AI Chatbot (storefront)     │ ❌       │ ❌       │ ✅       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ INTEGRATIES                 │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Bol.com Sync                │ ❌       │ Add-on   │ ✅       │ ✅          │
│ Bol.com VVB Labels          │ ❌       │ ❌       │ ✅       │ ✅          │
│ Amazon/eBay                 │ ❌       │ ❌       │ Add-on   │ ✅          │
│ Sendcloud/MyParcel          │ ❌       │ ✅       │ ✅       │ ✅          │
│ Social Commerce (Meta/Google)│ ❌       │ ❌       │ ✅       │ ✅          │
│ WhatsApp Berichten          │ ❌       │ Add-on   │ ✅       │ ✅          │
│ API Toegang                 │ ❌       │ ✅       │ ✅       │ ✅          │
│ Webhooks                    │ ❌       │ ✅       │ ✅       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ FACTURATIE                  │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Handmatige Facturen         │ ✅       │ ✅       │ ✅       │ ✅          │
│ Factur-X (PDF/A)            │ ❌       │ ✅       │ ✅       │ ✅          │
│ Peppol e-Invoicing          │ ❌       │ ❌       │ ✅       │ ✅          │
│ Multi-valuta                │ ❌       │ ❌       │ ✅       │ ✅          │
│ Offertes                    │ ✅       │ ✅       │ ✅       │ ✅          │
│ Creditnota's                │ ❌       │ ✅       │ ✅       │ ✅          │
│ Abonnementen (recurring)    │ ❌       │ ❌       │ ✅       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ TRANSACTIEKOSTEN            │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Stripe Transacties Incl.    │ 0        │ 100      │ 1000     │ Onbeperkt   │
│ Overage fee per extra       │ €2,50    │ €0,50    │ €0,25    │ €0,00       │
│ Bank Transfer (QR) - GRATIS │ ✅       │ ✅       │ ✅       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ SUPPORT                     │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ Community/Docs              │ ✅       │ ✅       │ ✅       │ ✅          │
│ Email Support               │ ❌       │ ✅       │ ✅       │ ✅          │
│ Priority Support            │ ❌       │ ❌       │ ✅       │ ✅          │
│ Phone Support (NL/BE)       │ ❌       │ ❌       │ ❌       │ ✅          │
│ Dedicated Account Manager   │ ❌       │ ❌       │ ❌       │ ✅          │
│ SLA 99.9%                   │ ❌       │ ❌       │ ❌       │ ✅          │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ BRANDING                    │          │          │          │             │
├─────────────────────────────┼──────────┼──────────┼──────────┼─────────────┤
│ SellQo Watermerk            │ ✅       │ ❌       │ ❌       │ ❌          │
│ Eigen Domein                │ ❌       │ ✅       │ ✅       │ ✅          │
│ White-label                 │ ❌       │ ❌       │ ❌       │ ✅          │
│ Gratis Migratie             │ ❌       │ ❌       │ ❌       │ ✅(€2000)   │
└─────────────────────────────┴──────────┴──────────┴──────────┴─────────────┘
```

### Add-on Prijzen (voor Free & Starter)

| Add-on | Prijs | Beschikbaar voor |
|--------|-------|------------------|
| **AI Credit Pack** (500 credits) | €19/maand | Starter |
| **POS Kassa Module** | €29/maand | Starter |
| **Webshop Builder** | €19/maand | Starter |
| **Bol.com Kanaal** | €15/maand | Starter |
| **WhatsApp Berichten** | €9/maand | Starter |
| **Extra Marketplace** | €15/maand/kanaal | Pro |

---

## Technische Implementatie

### Fase 1: Database & Types Updaten

**1.1 Uitbreiden `PricingPlanFeatures` interface:**

```typescript
export interface PricingPlanFeatures {
  // Bestaand
  customDomain: boolean;
  removeWatermark: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  advancedAnalytics: boolean;
  whiteLabel: boolean;
  multiCurrency: boolean;
  facturX: boolean;
  peppol: boolean;
  ai_marketing: boolean;
  
  // NIEUW - Modules
  pos: boolean;
  webshop_builder: boolean;
  visual_editor: boolean;
  
  // NIEUW - AI Capabilities
  ai_copywriting: boolean;
  ai_images: boolean;
  ai_seo: boolean;
  ai_coach: boolean;
  ai_chatbot: boolean;
  ai_ab_testing: boolean;
  
  // NIEUW - Integraties
  bol_com: boolean;
  bol_vvb_labels: boolean;
  amazon: boolean;
  ebay: boolean;
  social_commerce: boolean;
  whatsapp: boolean;
  
  // NIEUW - Geavanceerd
  shop_health: boolean;
  gamification: boolean;
  live_activity: boolean;
  loyalty_program: boolean;
  recurring_subscriptions: boolean;
  multi_warehouse: boolean;
  
  // NIEUW - Promoties
  promo_bundles: boolean;
  promo_bogo: boolean;
  promo_volume: boolean;
  promo_giftcards: boolean;
}
```

**1.2 Database migratie:**

```sql
-- Update pricing_plans met uitgebreide features
UPDATE pricing_plans SET features = jsonb_build_object(
  -- Bestaande features
  'customDomain', false,
  'removeWatermark', false,
  -- ... etc
  
  -- Nieuwe AI features
  'ai_copywriting', false,
  'ai_images', false,
  'ai_coach', false,
  
  -- Nieuwe modules
  'pos', false,
  'webshop_builder', false,
  'bol_vvb_labels', false
  -- etc
), ai_credits_monthly = 0
WHERE slug = 'free';

-- Herhaal voor starter, pro, enterprise met juiste waarden
```

### Fase 2: Sidebar Feature Gating Implementeren

**2.1 Update `AdminSidebar.tsx` - Toevoegen subscription check:**

```typescript
const { subscription } = useTenantSubscription();

const isItemFeatureHidden = (item: NavItem): boolean => {
  if (!item.featureKey) return false;
  
  const features = subscription?.pricing_plan?.features;
  if (!features) return true; // Free plan: feature niet beschikbaar
  
  return !features[item.featureKey as keyof typeof features];
};

const shouldHideItem = (item: NavItem): boolean => {
  return isItemHidden(item.id) || 
         isItemRoleHidden(item) || 
         isItemFeatureHidden(item); // NIEUW
};
```

**2.2 Update `sidebarConfig.ts` met feature keys:**

```typescript
const salesItems: NavItem[] = [
  { id: 'pos', title: 'Kassa (POS)', url: '/admin/pos', icon: Monitor, featureKey: 'pos' },
  { id: 'storefront', title: 'Webshop', url: '/admin/storefront', icon: Globe, featureKey: 'webshop_builder' },
  // ...
];

const marketingItems: NavItem[] = [
  { id: 'ai-tools', title: 'AI Tools', url: '/admin/marketing/ai', icon: Sparkles, featureKey: 'ai_marketing' },
  // ...
];
```

### Fase 3: Marketing Pagina Uitbreiden

**3.1 Nieuwe sectie: "SellQo Voordelen vs Concurrenten"**

Toevoegen aan `ComparisonSection.tsx`:

| Feature | SellQo | Shopify | Lightspeed |
|---------|--------|---------|------------|
| 5-minuten setup | ✅ | ❌ | ❌ |
| Shop Health Score | ✅ | ❌ | ❌ |
| Proactieve AI Coach | ✅ | ❌ | ❌ |
| Gamification | ✅ | ❌ | ❌ |
| WhatsApp Alerts | ✅ | Via app | Via app |
| Bol.com VVB Labels | ✅ | ❌ | ❌ |
| Bank Transfer QR | ✅ | ❌ | ❌ |

**3.2 Update `PricingSection.tsx` met nieuwe features**

**3.3 Nieuwe "Unique Features" sectie**

---

## Bestanden Overzicht

### Database Migratie

| Actie | Details |
|-------|---------|
| Update `pricing_plans.features` | Alle nieuwe feature keys toevoegen |
| Update `pricing_plans.ai_credits_monthly` | 0/50/500/-1 per plan |
| Update `pricing_plans.included_transactions_monthly` | Correcte waarden |

### Aangepaste Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/types/billing.ts` | Uitbreiden `PricingPlanFeatures` interface |
| `src/components/admin/AdminSidebar.tsx` | Subscription-based filtering |
| `src/components/admin/sidebar/sidebarConfig.ts` | Feature keys toevoegen |
| `src/hooks/useUsageLimits.ts` | Nieuwe feature checks |
| `src/components/landing/PricingSection.tsx` | Nieuwe pricing tabel |
| `src/components/landing/ComparisonSection.tsx` | Nieuwe vergelijkingsrijen |
| `src/pages/Pricing.tsx` | Sync met database |

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `src/components/landing/UniqueAdvantagesSection.tsx` | "Wat maakt SellQo uniek" sectie |
| `src/components/admin/billing/UpgradePrompt.tsx` | Contextuele upgrade suggesties |

---

## Verwacht Resultaat

### Voor Merchants

| Voorheen | Nu |
|----------|-----|
| Alle sidebar items zichtbaar | Alleen toegankelijke items zichtbaar |
| Lock-scherm bij klikken | Geen verwarrende items |
| Geen AI credits | Duidelijke AI quota per plan |
| Onduidelijk verschil tussen plannen | Glashelder wat je krijgt |

### Voor Marketing

| Voorheen | Nu |
|----------|-----|
| Generieke feature lijst | Concrete USPs (5-min setup, Shop Health) |
| Geen vergelijking | "SellQo vs Rest" tabel |
| Ontbrekende nieuwe features | VVB labels, AI Coach, etc. prominent |

### Voor Conversie

| Metric | Verwacht Effect |
|--------|-----------------|
| Free → Starter | +15% door duidelijke upsells |
| Starter → Pro | +20% door AI features |
| Bounce rate pricing | -10% door helderheid |


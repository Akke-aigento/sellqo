

# Plan: Complete Marketing Page Uitbreiding - Alle Features In de Verf

## Analyse: Ontdekte Features Die NIET Vermeld Worden

Na grondige analyse van de hele codebase ontdek ik dat jullie app **veel rijker is** dan de huidige marketing page laat zien. Hier is wat ik gevonden heb:

### Marketplace Integraties (Ondervertegenwoordigd)
| Feature | Status op Marketing |
|---------|---------------------|
| Bol.com met VVB labels & auto-accept | Alleen VVB genoemd in UniqueAdvantages |
| **Amazon sync** | Alleen in Pricing als Enterprise feature |
| **Odoo ERP sync** | NIET vermeld |
| Shopify/WooCommerce import | Alleen in FAQ |
| eBay sync | Alleen in Pricing |

### AI Capabilities (Te Zwak Gepresenteerd)
| Feature | Status op Marketing |
|---------|---------------------|
| AI Marketing Hub (posts, emails, images) | Alleen "AI Marketing Assistent" |
| **AI SEO Dashboard** (Quick Wins, Score, Technische SEO) | NIET vermeld |
| **AI Vertaal Hub** (EN/DE/FR bulk translate) | NIET vermeld |
| **AI Chatbot voor webshop** (24/7 support) | NIET vermeld |
| **AI Reply Suggestions** (inbox) | NIET vermeld |
| AI Business Coach (proactieve alerts) | Alleen in UniqueAdvantages |
| A/B testing variations | NIET vermeld |

### Ads & Social (Volledig Ontbrekend)
| Feature | Status op Marketing |
|---------|---------------------|
| **Bol.com Sponsored Products** | NIET vermeld |
| **Meta Ads manager** | NIET vermeld |
| **Social Commerce** (Facebook/Instagram Shop sync) | NIET vermeld |
| **WhatsApp Business** (catalogs, transactional messages) | NIET vermeld |
| Autopost naar X/LinkedIn/Facebook | NIET vermeld |

### Fulfillment & Operations (Ondervertegenwoordigd)
| Feature | Status op Marketing |
|---------|---------------------|
| **Fulfillment Queue dashboard** | NIET vermeld |
| 14+ internationale carriers | NIET vermeld |
| **POS Kassasysteem** (multi-terminal) | NIET vermeld |
| Recurring Subscriptions | NIET vermeld |
| Multi-warehouse support | NIET vermeld |

### Storefront Builder (Ondervertegenwoordigd)
| Feature | Status op Marketing |
|---------|---------------------|
| Visual WYSIWYG Editor | NIET vermeld |
| Theme gallery & customizer | NIET vermeld |
| Homepage drag-and-drop builder | NIET vermeld |
| **Reviews Hub** (Google, Trustpilot, etc.) | NIET vermeld |
| Legal pages generator | NIET vermeld |

### Unified Inbox (Volledig Ontbrekend)
| Feature | Status op Marketing |
|---------|---------------------|
| Email + WhatsApp unified inbox | NIET vermeld |
| Bol.com/Amazon message routing | NIET vermeld |
| AI reply suggestions | NIET vermeld |

---

## Voorgestelde Wijzigingen

### 1. Nieuwe Sectie: "IntegrationsShowcaseSection"

**Doel**: Visueel laten zien welke platformen je kunt koppelen - dit is vaak HET beslismoment voor merchants.

**Nieuw bestand**: `src/components/landing/IntegrationsShowcaseSection.tsx`

```text
┌─────────────────────────────────────────────────────────────────┐
│ "Verbind Met Alle Platformen Die Je Gebruikt"                   │
│                                                                  │
│ [E-COMMERCE ROW]                                                │
│ [Bol.com] [Amazon] [Shopify] [WooCommerce] [Odoo]              │
│                                                                  │
│ [ADVERTISING ROW]                                               │
│ [Meta Ads] [Bol Sponsored] [Google Ads*] [Amazon Ads*]         │
│                                     *Binnenkort                  │
│                                                                  │
│ [SOCIAL COMMERCE ROW]                                           │
│ [Facebook Shop] [Instagram Shopping] [WhatsApp Business]       │
│ [Google Shopping] [Pinterest*]                                  │
│                                                                  │
│ [OPERATIONS ROW]                                                │
│ [PostNL] [DHL] [Sendcloud] [Resend] [Stripe] [Peppol]          │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Update FeaturesSection - Uitbreiding naar 9 Core Categories

**Bestaand bestand**: `src/components/landing/FeaturesSection.tsx`

**Huidige 6 features -> Nieuwe 9 features:**

| # | Huidige Feature | Actie |
|---|-----------------|-------|
| 1 | Multi-Channel Verkoop | Update: voeg Odoo, Amazon, Meta toe |
| 2 | Real-Time Voorraadsync | Behouden |
| 3 | AI Marketing Assistent | Update: uitbreiden met specifieke capabilities |
| 4 | 8 Promotietypen | Behouden |
| 5 | Slimme Financiën | Update: Peppol prominent |
| 6 | Groei-Insights | Behouden |
| **7** | **NIEUW: AI SEO & Vertalingen** | SEO Dashboard + Translation Hub |
| **8** | **NIEUW: Unified Inbox** | Email + WhatsApp + AI suggestions |
| **9** | **NIEUW: Webshop Builder** | Visual Editor + Themes + Reviews |

**Nieuwe features array:**

```typescript
const features: Feature[] = [
  {
    icon: Store,
    title: 'Verkoop Overal, Beheer Centraal',
    subtitle: 'Multi-Channel Verkoop',
    description: 'Koppel je Shopify, WooCommerce, Bol.com, Amazon én Odoo. Alle bestellingen, voorraad en klanten op één dashboard.',
    badge: '20+ integraties',
    gridSpan: 2,
  },
  {
    icon: Package,
    title: 'Nooit Meer Uitverkocht',
    subtitle: 'Real-Time Voorraadsync',
    description: 'Automatische sync tussen al je kanalen. Verkoop je iets op Amazon? Je Bol.com en webshop worden direct bijgewerkt.',
    gridSpan: 1,
  },
  {
    icon: Sparkles,
    title: 'Complete AI Marketing Suite',
    subtitle: 'Content, SEO & Campagnes',
    description: 'Genereer social posts, productbeschrijvingen, email content én afbeeldingen. Plan advertenties op Bol.com en Meta.',
    badge: 'AI-powered',
    features: [
      'AI Content Hub met agenda',
      'Automatisch posten naar social media',
      'Bol.com & Meta Ads manager',
    ],
    gridSpan: 2,
  },
  {
    icon: Search,
    title: 'AI SEO & Vertalingen',
    subtitle: 'Gevonden Worden',
    description: 'SEO Dashboard met Quick Wins, technische checks en AI Search optimalisatie. Bulk-vertaal naar EN/DE/FR met één klik.',
    badge: 'Exclusief',
    gridSpan: 1,
  },
  {
    icon: Gift,
    title: '8 Promotietypen',
    subtitle: 'Kortingen & Loyaliteit',
    description: 'Kortingscodes, BOGO, bundels, staffelkorting, cadeaubonnen, klantgroepen en een compleet loyaliteitsprogramma.',
    features: [
      'Cadeaubonnen met QR-codes',
      'Stapelbare kortingen met regels',
      'VIP tiers met punten multipliers',
    ],
    gridSpan: 2,
  },
  {
    icon: MessageSquare,
    title: 'Unified Inbox',
    subtitle: 'Alle Communicatie Op Één Plek',
    description: 'Email en WhatsApp in één inbox. Bol.com en Amazon berichten worden automatisch gerouteerd. AI stelt antwoorden voor.',
    badge: 'WhatsApp Business',
    gridSpan: 1,
  },
  {
    icon: Paintbrush,
    title: 'Drag & Drop Webshop Builder',
    subtitle: 'Geen Code Nodig',
    description: 'Kies een theme, pas kleuren aan, bouw je homepage visueel. Reviews van Google, Trustpilot en meer op één plek.',
    features: [
      'WYSIWYG Visual Editor',
      'Multi-platform Reviews Hub',
      'AI Chatbot voor 24/7 support',
    ],
    gridSpan: 2,
  },
  {
    icon: FileText,
    title: 'Slimme Financiën',
    subtitle: 'Facturen & BTW',
    description: 'Factur-X PDF\'s in 4 talen, automatische BTW/OSS berekening, credit notes en Peppol e-invoicing voor B2B.',
    badge: 'Peppol 2026',
    gridSpan: 1,
  },
  {
    icon: TrendingUp,
    title: 'Groei-Insights & POS',
    subtitle: 'Data & Fysieke Verkoop',
    description: 'Real-time inzicht in omzet, winstmarges per product, best sellers. Plus een volledig POS kassasysteem voor je winkel.',
    badge: 'Omnichannel',
    gridSpan: 1,
  },
];
```

### 3. Update UniqueAdvantagesSection - Meer AI & Social Focus

**Bestaand bestand**: `src/components/landing/UniqueAdvantagesSection.tsx`

**Huidige 6 advantages -> Nieuwe 6 met betere focus:**

| # | Huidig | Nieuw |
|---|--------|-------|
| 1 | 5-Minuten Setup | Behouden |
| 2 | Shop Health Score | Behouden |
| 3 | Proactieve AI Coach | Behouden |
| 4 | Gamification & Badges | **Vervangen: AI Chatbot 24/7** |
| 5 | €0 Transactiekosten | Behouden |
| 6 | Bol.com VVB Labels | **Vervangen: Unified Inbox** |

**Rationale**: Gamification en VVB labels zijn niche features. AI Chatbot en Unified Inbox zijn grotere selling points.

```typescript
const advantages = [
  // ... eerste 3 behouden ...
  {
    icon: MessageSquare,
    emoji: '🤖',
    title: 'AI Chatbot 24/7',
    description: 'Je webshop heeft een slimme chatbot die vragen beantwoordt op basis van je producten, FAQ en policies.',
    highlight: 'Klantenservice op automatische piloot',
  },
  {
    icon: Wallet,
    emoji: '💸',
    title: '€0 Transactiekosten',
    description: 'Met Bank Transfer QR-codes betalen klanten direct via iDEAL/Bancontact zonder Stripe fees.',
    highlight: 'Bespaar honderden euro\'s',
  },
  {
    icon: Inbox,
    emoji: '📬',
    title: 'Unified Inbox',
    description: 'Email, WhatsApp én marketplace berichten in één inbox. AI stelt antwoorden voor, jij keurt goed.',
    highlight: 'Nooit meer schakelen',
  },
];
```

### 4. Update SolutionOverviewSection - Meer Integratie Focus

**Bestaand bestand**: `src/components/landing/SolutionOverviewSection.tsx`

**Nieuwe solutions array:**

```typescript
const solutions = [
  {
    icon: LayoutDashboard,
    title: 'Alles In Één Dashboard',
    description: 'Bol, Amazon, Shopify, Odoo - alles op één plek.',
  },
  {
    icon: Zap,
    title: 'Live In 5 Minuten',
    description: 'Setup wizard importeert je producten automatisch.',
  },
  {
    icon: Brain,
    title: 'AI Die Meedenkt',
    description: 'SEO, content, vertalingen, chatbot - allemaal AI-powered.',
  },
  {
    icon: Globe,
    title: 'Gebouwd Voor EU',
    description: 'Peppol, BTW/OSS, GDPR, lokale betaalmethoden ingebakken.',
  },
];
```

### 5. Update ComparisonSection - Nieuwe Features Toevoegen

**Bestaand bestand**: Zoeken naar `ComparisonSection.tsx`

Voeg toe aan de vergelijkingstabel:
- AI SEO Dashboard: SellQo ✅, Shopify ❌, Lightspeed ❌
- Unified Inbox: SellQo ✅, Shopify ❌, Lightspeed ❌
- Odoo Integration: SellQo ✅, Shopify ❌, Lightspeed ❌
- Bol.com Ads: SellQo ✅, Shopify ❌, Lightspeed ❌
- AI Chatbot: SellQo ✅, Shopify Plugin, Lightspeed ❌

---

## Bestanden Overzicht

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `IntegrationsShowcaseSection.tsx` | Visuele integratie-grid met alle platformen |

### Aangepaste Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `Landing.tsx` | Voeg IntegrationsShowcaseSection toe (na SolutionOverview) |
| `FeaturesSection.tsx` | Uitbreiden van 6 naar 9 core features |
| `UniqueAdvantagesSection.tsx` | Vervang Gamification + VVB met AI Chatbot + Unified Inbox |
| `SolutionOverviewSection.tsx` | Update teksten voor meer integratie focus |
| `ComparisonSection.tsx` | Voeg 5 nieuwe vergelijkingsrijen toe |

---

## Nieuwe Landing Page Flow

```text
1. HeroSection
2. SocialProofSection
3. ProblemSection
4. SolutionOverviewSection (updated)
5. IntegrationsShowcaseSection (NIEUW)
6. UniqueAdvantagesSection (updated)
7. FeaturesSection (expanded to 9)
8. ComparisonSection (expanded)
9. TestimonialsSection
10. PricingSection
11. FaqSection
12. FinalCtaSection
```

---

## Technische Details

### IntegrationsShowcaseSection Component Structure

```typescript
interface IntegrationCategory {
  title: string;
  integrations: {
    name: string;
    logo?: string; // Of icon component
    status: 'live' | 'coming-soon';
    badge?: string; // bijv. "Nieuw" of "Pro"
  }[];
}

const categories: IntegrationCategory[] = [
  {
    title: 'E-commerce & ERP',
    integrations: [
      { name: 'Bol.com', status: 'live', badge: 'VVB Labels' },
      { name: 'Amazon', status: 'live' },
      { name: 'Shopify', status: 'live' },
      { name: 'WooCommerce', status: 'live' },
      { name: 'Odoo', status: 'live', badge: 'Nieuw' },
      { name: 'eBay', status: 'live' },
    ],
  },
  {
    title: 'Advertenties',
    integrations: [
      { name: 'Bol.com Sponsored Products', status: 'live' },
      { name: 'Meta Ads', status: 'live' },
      { name: 'Google Ads', status: 'coming-soon' },
      { name: 'Amazon Advertising', status: 'coming-soon' },
    ],
  },
  {
    title: 'Social Commerce',
    integrations: [
      { name: 'Facebook Shop', status: 'live' },
      { name: 'Instagram Shopping', status: 'live' },
      { name: 'WhatsApp Business', status: 'live' },
      { name: 'Google Shopping', status: 'live' },
    ],
  },
  {
    title: 'Operations & Payments',
    integrations: [
      { name: 'PostNL', status: 'live' },
      { name: 'DHL', status: 'live' },
      { name: 'Sendcloud', status: 'live' },
      { name: 'Stripe Connect', status: 'live' },
      { name: 'Peppol', status: 'live', badge: 'B2B' },
      { name: 'Resend', status: 'live' },
    ],
  },
];
```

### Imports Toevoegen aan FeaturesSection

```typescript
import { 
  Store, Package, TrendingUp, FileText, Sparkles, Gift, Check,
  Search, MessageSquare, Paintbrush // Nieuwe icons
} from 'lucide-react';
```

---

## Verwachte Impact

| Metric | Verwachting |
|--------|-------------|
| Feature awareness | +40% - bezoekers zien nu ALLE capabilities |
| Integration confidence | +50% - visuele grid bewijst compatibiliteit |
| AI perception | +35% - prominentere AI positioning |
| Competitor differentiation | +25% - meer unieke features in comparison |


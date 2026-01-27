
# SellQo Super Admin Platform

## Overzicht

Dit plan beschrijft de uitbreiding van het huidige platform admin systeem naar een volwaardig "Super Admin" dashboard voor het SellQo-team. Hiermee kunnen jullie:

1. **SellQo onboarden als eigen tenant** - Gebruik alle features zelf
2. **Gecentraliseerd feedback ontvangen** - Van alle merchants
3. **Klantsupport bieden** - Via een support inbox
4. **Platform-updates monitoren** - Changelogs van Bol.com, Amazon, Stripe etc.
5. **Proactief bugs detecteren** - Voordat ze impact hebben
6. **Betalingen beheren** - Via Stripe (maandabonnementen)
7. **Juridische pagina's beheren** - Voor SellQo zelf

---

## Module 1: SellQo Tenant + Super Admin Account

### Wat wordt gemaakt
- **Nieuwe tenant**: `sellqo` slug met alle Enterprise features
- **Nieuw account**: info@sellqo.ai met platform_admin + tenant_admin rollen
- **Feature flag**: `is_internal_tenant` voor SellQo-specifieke features

### Database wijzigingen
```text
┌─────────────────────────────────────────────────┐
│ tenants                                         │
├─────────────────────────────────────────────────┤
│ + is_internal_tenant BOOLEAN DEFAULT false      │
│                                                 │
│ Nieuwe row:                                     │
│   slug: sellqo                                  │
│   name: SellQo                                  │
│   owner_email: info@sellqo.ai                   │
│   is_internal_tenant: true                      │
└─────────────────────────────────────────────────┘
```

**Belangrijk**: Wachtwoorden kunnen niet in code worden opgeslagen. Je moet het account aanmaken via de normale auth flow, daarna voeg ik de rollen toe.

---

## Module 2: Centraal Feedback Dashboard

### Wat wordt gemaakt
- **Nieuwe pagina**: `/admin/platform/feedback`
- **Feedback overzicht** met filters op:
  - Rating (1-5 sterren)
  - Tenant
  - Datum
  - Feature requests

### UI Componenten
- `PlatformFeedbackDashboard.tsx` - Hoofdpagina
- `FeedbackMetrics.tsx` - NPS score, average rating, trends
- `FeedbackList.tsx` - Doorzoekbare lijst van feedback
- `FeatureRequestBoard.tsx` - Kanban-achtige view van feature requests

### Data Flow
```text
app_feedback (alle tenants) 
    ↓ 
Platform Admin RLS policy (kan alles zien)
    ↓
PlatformFeedbackDashboard
    ↓
Metrics + List + Feature Board
```

---

## Module 3: Support Inbox

### Wat wordt gemaakt
- **Nieuwe pagina**: `/admin/platform/support`
- **Unified inbox** voor:
  - Inbound emails naar support@sellqo.ai
  - Merchant vragen via in-app chat
  - Escalaties van AI chatbot

### Database uitbreiding
```text
┌─────────────────────────────────────────────────┐
│ support_tickets (nieuw)                         │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ tenant_id UUID (nullable - kan ook non-tenant)  │
│ subject TEXT                                    │
│ status: 'open' | 'in_progress' | 'resolved'     │
│ priority: 'low' | 'medium' | 'high' | 'urgent'  │
│ category: billing | technical | feature | other │
│ assigned_to UUID (SellQo team member)           │
│ created_at, updated_at                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ support_messages (nieuw)                        │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ ticket_id UUID REFERENCES support_tickets       │
│ sender_type: 'merchant' | 'support' | 'system'  │
│ message TEXT                                    │
│ attachments JSONB                               │
│ created_at                                      │
└─────────────────────────────────────────────────┘
```

### UI Componenten
- `SupportInbox.tsx` - Overzicht van alle tickets
- `SupportTicketDetail.tsx` - Chat-achtige interface
- `SupportQuickActions.tsx` - Templates, AI suggesties

---

## Module 4: Platform Changelog Monitor

### Wat wordt gemaakt
- **Nieuwe pagina**: `/admin/platform/changelog`
- **Automatische tracking** van:
  - Bol.com Plaza API versies
  - Amazon SP-API updates
  - Stripe API wijzigingen
  - eBay API deprecations
  - Shopify/WooCommerce versies

### Database
```text
┌─────────────────────────────────────────────────┐
│ platform_changelogs (nieuw)                     │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ platform: bol_com | amazon | stripe | ebay etc. │
│ version TEXT                                    │
│ change_type: breaking | feature | deprecation   │
│ title TEXT                                      │
│ description TEXT                                │
│ impact_level: none | low | medium | high        │
│ affected_features TEXT[]                        │
│ source_url TEXT                                 │
│ detected_at TIMESTAMPTZ                         │
│ acknowledged_at TIMESTAMPTZ                     │
│ acknowledged_by UUID                            │
│ action_taken TEXT                               │
└─────────────────────────────────────────────────┘
```

### Edge Function: `check-platform-changelogs`
- Dagelijkse cron job
- Checkt RSS feeds en API endpoints van platforms
- Parst changelogs en detecteert breaking changes
- Creëert notificaties voor het SellQo team

### UI
- Timeline view van alle platform updates
- Impact assessment per wijziging
- Action items en status tracking

---

## Module 5: Bug Detection System

### Wat wordt gemaakt
- **Nieuwe pagina**: `/admin/platform/health`
- **Proactieve monitoring** van:
  - Edge function error rates
  - Sync failures per platform
  - API response times
  - Database performance
  - User-reported issues

### Database
```text
┌─────────────────────────────────────────────────┐
│ platform_health_metrics (nieuw)                 │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ metric_type TEXT                                │
│ component TEXT (edge_function, sync, api, db)   │
│ value NUMERIC                                   │
│ threshold_warning NUMERIC                       │
│ threshold_critical NUMERIC                      │
│ status: healthy | warning | critical            │
│ recorded_at TIMESTAMPTZ                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ platform_incidents (nieuw)                      │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ title TEXT                                      │
│ severity: low | medium | high | critical        │
│ status: detected | investigating | resolved     │
│ affected_tenants UUID[]                         │
│ root_cause TEXT                                 │
│ resolution TEXT                                 │
│ detected_at TIMESTAMPTZ                         │
│ resolved_at TIMESTAMPTZ                         │
└─────────────────────────────────────────────────┘
```

### Edge Function: `platform-health-monitor`
- Aggregeert sync_activity_log failures
- Monitort edge function error rates
- Detecteert anomalieën (spike in errors)
- Creëert automatisch incidents

### UI Componenten
- `PlatformHealthDashboard.tsx` - Status overview
- `HealthMetricsGrid.tsx` - Real-time metrics
- `IncidentTimeline.tsx` - Historische incidenten
- `AlertConfiguration.tsx` - Threshold settings

---

## Module 6: SellQo Juridische Pagina's

### Wat wordt gemaakt
- **Publieke pagina's** op sellqo.lovable.app:
  - `/terms` - Algemene Voorwaarden
  - `/privacy` - Privacybeleid
  - `/cookies` - Cookiebeleid
  - `/sla` - Service Level Agreement
  - `/acceptable-use` - Acceptable Use Policy
  - `/dpa` - Data Processing Agreement

### Belangrijke clausules
1. **Prijsindexatie clausule**:
   > "SellQo behoudt zich het recht voor om tarieven jaarlijks te indexeren conform de CBS consumentenprijsindex (CPI). Bestaande klanten worden minimaal 60 dagen vooraf geïnformeerd."

2. **Aansprakelijkheid**:
   > Platform-as-a-service disclaimer, uptime garantie (99.5%), data eigendom

3. **Fair use policy**:
   > Limieten op API calls, storage, transacties per plan

### Database
```text
┌─────────────────────────────────────────────────┐
│ sellqo_legal_pages (nieuw)                      │
├─────────────────────────────────────────────────┤
│ id UUID PRIMARY KEY                             │
│ page_type TEXT UNIQUE                           │
│ title TEXT                                      │
│ content TEXT (Markdown)                         │
│ version INTEGER                                 │
│ effective_date DATE                             │
│ published BOOLEAN                               │
│ created_at, updated_at                          │
└─────────────────────────────────────────────────┘
```

### Admin pagina
- `/admin/platform/legal` - Beheer van SellQo's eigen juridische docs
- Markdown editor met preview
- Versie historie

---

## Module 7: Betalingen (Stripe Integratie)

### Huidige situatie
De Stripe integratie is **al volledig geïmplementeerd**:
- `platform-stripe-webhook` handelt maandelijkse betalingen af
- `create-platform-checkout` maakt checkout sessies
- `tenant_subscriptions` en `platform_invoices` tabellen bestaan

### Waarom Stripe noodzakelijk is
Je vraag over QR-codes vs Stripe:
- **QR-codes (SEPA)**: Alleen voor eenmalige betalingen, geen automatische maandelijkse incasso
- **Stripe Subscriptions**: Automatische maandelijkse facturatie, retry bij failed payments, customer portal

### Wat nog ontbreekt
- **Stripe Product/Price IDs** in de `pricing_plans` tabel
- Je moet deze aanmaken in het Stripe dashboard

### Actie vereist
1. Ga naar Stripe Dashboard → Products
2. Maak producten aan voor Free, Starter, Pro, Enterprise
3. Voeg de `stripe_price_id_monthly` en `stripe_price_id_yearly` toe aan de database

---

## Sidebar Uitbreiding

### Huidige Platform sectie
```text
Platform
├── Tenants
└── Platform Billing
```

### Na implementatie
```text
Platform
├── Dashboard (nieuw - overzicht)
├── Tenants
├── Platform Billing
├── Feedback (nieuw)
├── Support (nieuw)
├── Changelog (nieuw)
├── Health Monitor (nieuw)
└── Legal (nieuw)
```

---

## Implementatie Volgorde

| Fase | Module | Geschatte complexiteit |
|------|--------|----------------------|
| 1 | SellQo Tenant + Account | Laag |
| 2 | Feedback Dashboard | Medium |
| 3 | Support Inbox | Medium-Hoog |
| 4 | Platform Changelog | Medium |
| 5 | Health Monitor | Hoog |
| 6 | Legal Pages | Laag |

---

## Technische Details

### Nieuwe Edge Functions
1. `check-platform-changelogs` - Cron job voor changelog monitoring
2. `platform-health-monitor` - Cron job voor health metrics
3. `ingest-support-email` - Webhook voor inbound support emails

### Nieuwe React Pagina's
- `src/pages/platform/PlatformDashboard.tsx`
- `src/pages/platform/PlatformFeedback.tsx`
- `src/pages/platform/PlatformSupport.tsx`
- `src/pages/platform/PlatformChangelog.tsx`
- `src/pages/platform/PlatformHealth.tsx`
- `src/pages/platform/PlatformLegal.tsx`
- `src/pages/SellqoLegal.tsx` (publieke pagina's)

### Nieuwe Hooks
- `usePlatformFeedback.ts`
- `useSupportTickets.ts`
- `usePlatformChangelogs.ts`
- `usePlatformHealth.ts`
- `useSellqoLegal.ts`

---

## Veiligheidsnota

Het aanmaken van een account met een hardcoded wachtwoord in de code is een **beveiligingsrisico**. In plaats daarvan:

1. Ik maak de SellQo tenant aan
2. Je registreert jezelf via de normale signup flow met info@sellqo.ai
3. Ik voeg de `platform_admin` en `tenant_admin` rollen toe via database
4. Of: je gebruikt je bestaande account (vanxcel@outlook.com) dat al platform_admin is

Wil je doorgaan met dit plan?

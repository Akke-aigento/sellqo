
# Plan: Betalingen & Synchronisatie Logica Optimalisatie

## Overzicht

Dit plan richt zich op twee kritieke gebieden waar logica ontbreekt of verbeterd moet worden:
1. **Betalingen**: Upgrade/downgrade flows, proration previews, en automatische add-on migratie
2. **Synchronisatie**: Marketplace listing bescherming met slimme defaults per platformtype

---

## Deel 1: Betalingslogica

### 1.1 Huidige Situatie

| Aspect | Status | Probleem |
|--------|--------|----------|
| Plan upgrades | Via Stripe Billing Portal | Geen in-app preview van proration |
| Plan downgrades | Automatisch via webhook | Geen waarschuwing over feature-verlies |
| Add-on migratie | Niet geimplementeerd | Betaalde add-ons blijven actief na upgrade naar plan waar feature inbegrepen is |
| Yearly naar Monthly | Via Stripe Portal | Geen duidelijke restwaarde communicatie |

### 1.2 Implementatieplan

#### A. In-App Upgrade Preview Flow

Nieuwe Edge Function `calculate-plan-switch`:

```text
┌─────────────────────────────────────────────────────────┐
│  calculate-plan-switch                                   │
├─────────────────────────────────────────────────────────┤
│  Input: current_plan_id, target_plan_id, interval       │
│                                                          │
│  1. Haal huidige subscription op via Stripe API         │
│  2. Gebruik stripe.subscriptions.retrieveUpcoming()     │
│     om proration preview te berekenen                   │
│  3. Bereken:                                            │
│     - Resterende waarde huidige periode                 │
│     - Kosten nieuwe plan (pro rata)                     │
│     - Te betalen bedrag NU                              │
│     - Tegoed indien downgrade                           │
│                                                          │
│  Output: { credit, debit, net_amount, next_invoice }    │
└─────────────────────────────────────────────────────────┘
```

Frontend component `PlanSwitchPreview.tsx`:
- Toont visueel overzicht van proration berekening
- Duidelijke uitleg van wat er gebeurt met resterende dagen
- "Bevestig Wijziging" knop die direct via Stripe API switcht (niet via Portal)

#### B. Automatische Add-on Migratie

Webhook uitbreiding in `platform-stripe-webhook`:

```text
Bij event "customer.subscription.updated":

1. Detecteer plan upgrade (old_plan → new_plan)
2. Voor elke feature in nieuwe plan:
   - Check of feature nu inbegrepen is
   - Als ja, check tenant_addons voor actieve add-on
   - Als add-on actief:
     a. Cancel add-on subscription in Stripe
     b. Update tenant_addons.status = 'migrated_to_plan'
     c. Stuur notificatie: "Peppol is nu inbegrepen in je Pro plan"
```

Database update:
- Nieuw veld `tenant_addons.migrated_at` (timestamp)
- Nieuwe status `migrated_to_plan` in add-on status enum

#### C. Downgrade Feature Waarschuwing

Nieuwe component `DowngradeWarningDialog.tsx`:
- Vergelijkt features tussen huidige en doel plan
- Toont lijst van features die verloren gaan
- Toont actieve add-ons die opnieuw gekocht moeten worden
- Bevestigingsscherm met "Ik begrijp dat ik toegang verlies tot..."

---

## Deel 2: Synchronisatie Logica

### 2.1 Huidige Architectuur (Reeds Goed)

| Platform | Orders | Producten | Voorraad | Risico |
|----------|--------|-----------|----------|--------|
| Bol.com | Import | Export | Export | Laag (eenrichtingsverkeer) |
| Amazon | Import | Export | Export | Laag (eenrichtingsverkeer) |
| eBay | Import | Export | Export | Laag (eenrichtingsverkeer) |
| Shopify | Bidirectioneel | Bidirectioneel | Bidirectioneel | Hoog (conflict mogelijk) |
| WooCommerce | Bidirectioneel | Bidirectioneel | Bidirectioneel | Hoog (conflict mogelijk) |

### 2.2 Identificeerde Gaps

1. **Geen Conflict Review UI**: Bij `manual` strategy worden conflicten gemarkeerd maar er is geen dashboard om ze te reviewen
2. **Geen Sync History Logging**: Geen audit trail van sync activiteiten
3. **Geen Field-Level Conflict Resolution**: Alles is record-level, niet per veld
4. **Marketplace Listing Bescherming**: Geen "soft lock" na succesvolle publish

### 2.3 Implementatieplan

#### A. Sync Conflict Queue & Review Dashboard

Database tabel `sync_conflicts`:
```text
id, tenant_id, connection_id, data_type, record_id
sellqo_data (JSONB), platform_data (JSONB)
detected_at, resolved_at, resolved_by, resolution (sellqo|platform|merged)
```

Nieuwe pagina `/admin/connect/conflicts`:
- Lijst van openstaande conflicten per kanaal
- Side-by-side vergelijking van beide versies
- Per-veld selectie mogelijkheid (merge mode)
- Bulk resolve optie

#### B. Sync Activity Logging

Database tabel `sync_activity_log`:
```text
id, tenant_id, connection_id, data_type, direction
records_processed, records_created, records_updated, records_failed
started_at, completed_at, status, error_message
```

UI integratie:
- Recent sync log in connection detail pagina
- Filter op data type en status
- Retry failed syncs knop

#### C. Marketplace Listing Protection

Nieuwe velden in `products` tabel:
```text
marketplace_lock_[platform]: boolean
marketplace_lock_reason: 'live_listing' | 'pending_review' | 'manual'
marketplace_last_synced_hash: text (content hash voor change detection)
```

Beschermingslogica:
1. Na succesvolle publish naar Bol.com/Amazon/eBay → zet `marketplace_lock_bol_com = true`
2. Bij export sync: 
   - Vergelijk content hash
   - Als lock actief en data gewijzigd: toon bevestigingsdialoog
   - "Deze wijziging wordt naar je live Bol.com listing gestuurd. Doorgaan?"
3. Override mogelijk met expliciete bevestiging

#### D. Smart Conflict Defaults per Data Type

Uitbreiding van `getDefaultSyncRules()`:

```text
Voor bidirectionele platforms (Shopify/WooCommerce):

orders:
  conflictStrategy: 'platform_wins'  # Platform is bron van bestellingen
  reason: "Klant bestelt via webshop, die is leading"

products:
  conflictStrategy: 'sellqo_wins'    # SellQo is productmaster
  reason: "Centrale productbeheer in SellQo"

inventory:
  conflictStrategy: 'newest_wins'    # Meest recente voorraadstand
  reason: "Voorraad kan van beide kanten wijzigen"

customers:
  conflictStrategy: 'platform_wins'  # Klant data komt van webshop
  reason: "Klanten registreren zich op webshop"
```

UI verbetering:
- Toon "aanbevolen" badge bij smart default strategy
- Tooltip met uitleg waarom dit de beste keuze is

---

## Deel 3: Technische Specificaties

### 3.1 Nieuwe Edge Functions

| Functie | Doel |
|---------|------|
| `calculate-plan-switch` | Proration preview voor plan wijzigingen |
| `execute-plan-switch` | Directe plan switch zonder portal redirect |
| `cancel-redundant-addons` | Annuleer add-ons die nu in plan zitten |

### 3.2 Database Migraties

```sql
-- Add-on migratie tracking
ALTER TABLE tenant_addons 
ADD COLUMN migrated_at TIMESTAMPTZ,
ADD COLUMN migrated_to_plan TEXT;

-- Sync conflict queue
CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES marketplace_connections(id),
  data_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  sellqo_data JSONB NOT NULL,
  platform_data JSONB NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution TEXT CHECK (resolution IN ('sellqo', 'platform', 'merged', 'dismissed'))
);

-- Sync activity log
CREATE TABLE sync_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES marketplace_connections(id),
  data_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  error_details JSONB
);

-- Marketplace listing protection
ALTER TABLE products
ADD COLUMN marketplace_lock_bol_com BOOLEAN DEFAULT false,
ADD COLUMN marketplace_lock_amazon BOOLEAN DEFAULT false,
ADD COLUMN marketplace_lock_ebay BOOLEAN DEFAULT false,
ADD COLUMN marketplace_lock_reason TEXT,
ADD COLUMN marketplace_last_sync_hash TEXT;
```

### 3.3 Nieuwe UI Componenten

| Component | Locatie | Doel |
|-----------|---------|------|
| `PlanSwitchPreview.tsx` | `/admin/billing` | Proration overzicht |
| `DowngradeWarningDialog.tsx` | `/admin/billing` | Feature verlies waarschuwing |
| `SyncConflictQueue.tsx` | `/admin/connect/conflicts` | Conflict review dashboard |
| `SyncActivityLog.tsx` | `/admin/connect/[id]` | Sync geschiedenis |
| `ListingProtectionBadge.tsx` | Product editor | Lock indicator |
| `ListingUpdateConfirmDialog.tsx` | Product editor | Bevestiging bij locked listing |

---

## Deel 4: Samenvatting Prioriteiten

### Hoge Prioriteit (Direct Implementeren)

1. **Add-on Migratie bij Upgrade** - Voorkomt dubbele facturatie
2. **Marketplace Lock na Publish** - Voorkomt onbedoelde listing wijzigingen
3. **Smart Conflict Defaults** - Betere UX bij nieuwe verbindingen

### Medium Prioriteit

4. **In-App Proration Preview** - Betere transparantie
5. **Sync Activity Logging** - Audit trail en debugging
6. **Downgrade Feature Warning** - Voorkomt onverwachte feature verlies

### Lagere Prioriteit

7. **Conflict Review Dashboard** - Alleen relevant bij bidirectionele sync
8. **Field-Level Merge** - Geavanceerde feature voor power users


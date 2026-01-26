
# Plan: Proactieve AI Business Coach met Notificatie-integratie

## Samenvatting

Dit plan transformeert de bestaande AI-suggesties naar een **proactieve Business Coach** die:
1. **Conversational is** - spreekt de merchant persoonlijk aan ("Hey! Ik zie dat...")
2. **Diep geïntegreerd is met notificaties** - alle AI-suggesties worden notificaties met klikbare links
3. **Uitvoerbare acties biedt** - direct vanuit de notificatie kunnen merchants actie ondernemen
4. **Slimmer is** - analyseert meer datapunten en geeft contextrijkere suggesties

---

## Huidige Situatie Analyse

### Wat al bestaat (en goed werkt):
| Component | Status | Locatie |
|-----------|--------|---------|
| `ai-proactive-monitor` Edge Function | ✅ Aanwezig | Analyseert voorraad, inactieve klanten, trending producten |
| `ai_action_suggestions` tabel | ✅ Aanwezig | Slaat suggesties op met prioriteit, reasoning, action_data |
| `DashboardAIWidget` | ✅ Aanwezig | Toont top 3 suggesties op dashboard |
| `NotificationCenter` | ✅ Aanwezig | Popover met notificaties, klikbare `action_url` |
| Database triggers | ✅ Uitgebreid | Bestellingen, voorraad, facturen, klanten, etc. |
| Realtime notifications | ✅ Aanwezig | Via Supabase Realtime + toast |

### Wat verbeterd moet worden:
| Probleem | Impact |
|----------|--------|
| AI-suggesties zijn generiek, niet conversational | Mist emotionele connectie |
| Notificaties linken naar `/admin/ai-center` (generiek) | Niet direct actionable |
| Geen directe actie vanuit notificatie | Extra klikken nodig |
| Beperkte analyse (alleen stock, inactieve klanten, trending) | Mist veel kansen |
| Geen "coach" persona | Voelt als systeem, niet als assistent |

---

## Oplossing: De AI Business Coach

### 1. Conversational Persona

```text
VAN (huidige situatie):
┌─────────────────────────────────────────────────────────────────┐
│  🔔 AI Suggestie: Herbestelling Premium Koptelefoon XR-500      │
│  ─────────────────────────────────────────────────────────────  │
│  Voorraad van 8 stuks is over 5 dagen uitverkocht bij           │
│  huidige verkoop van 1.6/dag.                                   │
│  [Bekijk AI Center]                                             │
└─────────────────────────────────────────────────────────────────┘

NAAR (nieuwe situatie):
┌─────────────────────────────────────────────────────────────────┐
│  👋 Hey! Even een heads-up over je bestseller                   │
│  ─────────────────────────────────────────────────────────────  │
│  Je "Premium Koptelefoon XR-500" vliegt de deur uit! 🚀         │
│  Nog maar 8 op voorraad - over 5 dagen is 'ie uitverkocht.      │
│                                                                 │
│  Zal ik een bestelling klaarzetten bij AudioSupply?             │
│                                                                 │
│  [✓ Bestel 50 stuks]  [📦 Bekijk voorraad]  [Later]            │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Uitgebreide Analyse Triggers

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  NIEUWE ANALYSE PUNTEN                                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  📈 SALES ANOMALIES                                                                    │
│  ├── Product verkoopt 3x zoveel als normaal → Marketing suggestie                     │
│  ├── Weekend verkopen hoger dan doordeweeks → POS opening suggestie                   │
│  └── Plotselinge daling in verkopen → Review/concurrentie check                       │
│                                                                                        │
│  👥 KLANT GEDRAG                                                                       │
│  ├── VIP klant 30+ dagen inactief → Persoonlijke outreach                             │
│  ├── Klant met 3+ achtergelaten winkelmandjes → Abandoned cart email                  │
│  └── Nieuwe klant met hoge eerste order → VIP potentieel                              │
│                                                                                        │
│  💰 FINANCIEEL                                                                         │
│  ├── Factuur 7 dagen over datum → Herinnering suggestie                               │
│  ├── Hoge waarde quote niet geaccepteerd → Follow-up call                             │
│  └── Abonnement verloopt over 7 dagen → Renewal campagne                              │
│                                                                                        │
│  📦 OPERATIONEEL                                                                       │
│  ├── Veel orders met zelfde product → Bulk shipping                                   │
│  ├── Leverancier levertijd overschreden → Escalatie                                   │
│  └── Retour percentage hoog bij product → Kwaliteitscheck                             │
│                                                                                        │
│  🏪 MARKETPLACE                                                                        │
│  ├── Bol.com buy box verloren → Prijs aanpassing                                      │
│  ├── Slechte review → Reactie suggestie                                               │
│  └── Concurrerende prijs lager → Alert                                                │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Notificatie + Inline Actie Systeem

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  NOTIFICATION CENTER (UITGEBREID)                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  🔔 Notificaties                                          [Alles gelezen]              │
│  ─────────────────────────────────────────────────────────────────────────────────     │
│                                                                                         │
│  [Alle]  [Ongelezen (3)]  [Urgent]  [🤖 AI Coach]                                      │
│  ─────────────────────────────────────────────────────────────────────────────────     │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 AI COACH                                                              2 min │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  Wauw! 🎉 "Premium Koptelefoon XR-500" verkocht dit weekend 3x zoveel         │   │
│  │  als normaal (45 vs 15). Dit is een perfect moment voor een boost!            │   │
│  │                                                                               │   │
│  │  Mijn suggestie:                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ○ Maak een Instagram post over deze bestseller                          │ │   │
│  │  │ ○ Stuur een email naar VIP klanten die dit product nog niet hebben      │ │   │
│  │  │ ○ Start een Bol.com Sponsored Products campagne                         │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                               │   │
│  │  [Maak social post]  [Email VIPs]  [Bol.com Ads]  [Later]                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ URGENT                                                                5 min │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  3 klanten wachten al 24+ uur op een antwoord in je inbox.                    │   │
│  │  [Bekijk berichten →]                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  💰 FACTUREN                                                             1 uur │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  Factuur INV-2025-0042 (€1,250) is 7 dagen over datum.                        │   │
│  │  [Stuur herinnering]  [Bekijk factuur →]                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technische Implementatie

### Database Uitbreiding

```sql
-- Nieuwe notification_type voor AI Coach
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'ai_coach';

-- Uitbreiding ai_action_suggestions voor conversational content
ALTER TABLE ai_action_suggestions ADD COLUMN IF NOT EXISTS 
  conversational_message TEXT,  -- De "Hey! ..." tekst
  quick_actions JSONB DEFAULT '[]',  -- Inline actie buttons
  related_entity_type TEXT,  -- 'product', 'order', 'customer', etc.
  related_entity_id UUID,
  analysis_context JSONB DEFAULT '{}';  -- Extra context voor de AI

-- AI Coach personalisatie per tenant
CREATE TABLE IF NOT EXISTS ai_coach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coach_name TEXT DEFAULT 'Coach',  -- "Hey! Dit is Coach..."
  personality TEXT DEFAULT 'friendly',  -- 'friendly', 'professional', 'casual'
  proactive_level TEXT DEFAULT 'balanced',  -- 'aggressive', 'balanced', 'minimal'
  analysis_frequency_hours INTEGER DEFAULT 6,
  enabled_analyses TEXT[] DEFAULT ARRAY['stock', 'sales', 'customers', 'invoices'],
  muted_suggestion_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);
```

### Edge Function: ai-business-coach (Uitgebreid)

```typescript
// supabase/functions/ai-business-coach/index.ts
// Vervangt/verbetert ai-proactive-monitor

// ANALYSE TYPES:
// 1. sales_spike - Product verkoopt abnormaal goed
// 2. sales_drop - Verkopen plots gedaald
// 3. stock_critical - Voorraad bijna op
// 4. vip_inactive - Waardevolle klant inactief
// 5. invoice_overdue - Factuur achterstallig
// 6. quote_expiring - Offerte verloopt
// 7. review_negative - Slechte review ontvangen
// 8. abandoned_carts - Veel verlaten winkelmandjes
// 9. subscription_expiring - Abonnement loopt af
// 10. marketplace_alert - Buy box verloren / prijs concurrentie

// GENEREER CONVERSATIONAL MESSAGE:
// Gebruik Lovable AI om vriendelijke, persoonlijke berichten te maken
```

### Nieuwe Notification Action Types

```typescript
// src/types/notification.ts uitbreiding

export interface NotificationQuickAction {
  id: string;
  label: string;
  icon?: string;  // Lucide icon name
  action_type: 'navigate' | 'execute' | 'dismiss';
  action_url?: string;  // Voor navigate
  action_function?: string;  // Voor execute (edge function naam)
  action_params?: Record<string, unknown>;
  variant?: 'default' | 'primary' | 'destructive';
}

export interface AICoachNotification extends Notification {
  conversational_message: string;
  quick_actions: NotificationQuickAction[];
  suggestion_id?: string;  // Link naar ai_action_suggestions
}
```

### NotificationCenter Uitbreiding

```typescript
// AI Coach tab toevoegen met speciale rendering
// Inline actie buttons die direct edge functions aanroepen
// "Later" optie die de notificatie snoozed voor X uur
// Feedback loop: "Was dit nuttig?" na actie
```

---

## 5. Notificatie Dekking Audit

### Huidige Triggers (Volledig)

| Trigger | Notificatie | Klikbare Link | Status |
|---------|-------------|---------------|--------|
| Nieuwe bestelling | ✅ | `/admin/orders/:id` | ✅ Werkt |
| Bestelling betaald | ✅ | `/admin/orders/:id` | ✅ Werkt |
| Betaling mislukt | ✅ | `/admin/orders/:id` | ✅ Werkt |
| Hoge waarde bestelling | ✅ | `/admin/orders/:id` | ✅ Werkt |
| Stock uitverkocht | ✅ | `/admin/products?id=:id` | ⚠️ Query param, niet direct |
| Stock kritiek | ✅ | `/admin/products?id=:id` | ⚠️ Query param |
| Stock laag | ✅ | `/admin/products?id=:id` | ⚠️ Query param |
| Nieuwe klant | ✅ | `/admin/customers/:id` | ✅ Werkt |
| VIP klant | ✅ | `/admin/customers/:id` | ✅ Werkt |
| Nieuwe offerte | ✅ | `/admin/quotes/:id` | ✅ Werkt |
| Offerte geaccepteerd | ✅ | `/admin/quotes/:id` | ✅ Werkt |
| Factuur betaald | ✅ | `/admin/invoices?invoice=:id` | ⚠️ Query param |
| Peppol afgewezen | ✅ | `/admin/invoices?invoice=:id` | ⚠️ Query param |
| Abonnement opgezegd | ✅ | `/admin/subscriptions` | ⚠️ Niet specifiek |
| Team member joined | ✅ | `/admin/settings?tab=team` | ✅ Werkt |
| Campagne bounce | ✅ | `/admin/marketing/campaigns/:id` | ✅ Werkt |
| AI suggestie | ✅ | `/admin/ai-center` | ⚠️ Te generiek |
| Marketplace order | ✅ | `/admin/orders/:id` | ✅ Werkt |

### Te Verbeteren Links

```sql
-- Fix action_url patterns
-- VAN: '/admin/products?id=' || NEW.id
-- NAAR: '/admin/products/' || NEW.id (directe route)

-- VAN: '/admin/invoices?invoice=' || NEW.id
-- NAAR: '/admin/invoices/' || NEW.id

-- VAN: '/admin/ai-center'
-- NAAR: '/admin/ai-center?suggestion=' || suggestion.id (scroll to)
```

---

## 6. Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `xxx_ai_coach.sql` | Nieuw | Coach settings, suggestion uitbreiding |
| **Edge Functions** | | |
| `supabase/functions/ai-business-coach/index.ts` | Nieuw | Uitgebreide proactieve analyse |
| `supabase/functions/execute-quick-action/index.ts` | Nieuw | Handler voor inline acties |
| `supabase/functions/ai-proactive-monitor/index.ts` | Update | Conversational messages |
| **Types** | | |
| `src/types/notification.ts` | Update | QuickAction types |
| `src/types/aiActions.ts` | Update | Conversational fields |
| **Hooks** | | |
| `src/hooks/useAICoach.ts` | Nieuw | Coach settings + snooze |
| `src/hooks/useNotifications.ts` | Update | Quick action execution |
| **Components** | | |
| `src/components/admin/NotificationCenter.tsx` | Update | AI Coach tab, inline actions |
| `src/components/admin/notifications/AICoachNotificationItem.tsx` | Nieuw | Speciale rendering |
| `src/components/admin/notifications/QuickActionButton.tsx` | Nieuw | Inline actie buttons |
| **Settings** | | |
| `src/components/admin/settings/AICoachSettings.tsx` | Nieuw | Coach personalisatie |

---

## 7. Implementatie Volgorde

1. **Database Migration** - Coach settings + suggestion uitbreiding
2. **Fix action_url patterns** - Alle notificaties direct linkbaar
3. **Quick Action types** - Nieuwe TypeScript types
4. **Execute Quick Action Edge Function** - Handler voor inline acties
5. **NotificationCenter Update** - AI Coach tab + inline buttons
6. **AI Business Coach Edge Function** - Uitgebreide analyse + conversational
7. **Coach Settings UI** - Personalisatie opties
8. **Dashboard Widget Update** - Conversational preview

---

## 8. Conversational Message Templates

```text
STOCK ALERT:
"Hey! 👋 Even een heads-up: je {product_name} vliegt de deur uit! 
Nog maar {current_stock} op voorraad, en bij {daily_sales}/dag ben je over 
{days_until_stockout} dagen uitverkocht. Zal ik een bestelling klaarzetten?"

SALES SPIKE:
"Wauw! 🎉 {product_name} verkocht dit weekend {sales_increase}x zoveel als 
normaal ({current} vs {average}). Perfect moment voor een boost!"

VIP INACTIVE:
"Even checken: {customer_name} - een van je beste klanten - is al 
{inactive_days} dagen niet actief. Tijd voor een persoonlijk berichtje?"

INVOICE OVERDUE:
"Factuur {invoice_number} van €{amount} is nu {days_overdue} dagen over 
datum. Zal ik een vriendelijke herinnering sturen?"

ABANDONED CARTS:
"Interessant: {cart_count} klanten hebben hun winkelwagen achtergelaten 
deze week. Samen goed voor €{potential_revenue}. Een klein duwtje kan helpen!"
```

---

## 9. Conclusie

Dit plan transformeert de AI van een "koude suggestie machine" naar een **warme, proactieve business partner** die:
- Persoonlijk communiceert
- Direct actionable is (geen extra klikken)
- Slimmer analyseert (meer datapunten)
- Volledig geïntegreerd is met het notificatiesysteem

De bestaande infrastructuur is solide - we bouwen erop voort met conversational UI en inline acties.

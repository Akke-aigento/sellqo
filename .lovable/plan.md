

# Plan: Peppol als Upsell Module voor Free & Starter

## Strategische Analyse

### Waarom dit slim is

| Factor | Impact |
|--------|--------|
| **Wettelijk verplicht** | België B2B vanaf 2026 - elke ondernemer MOET dit |
| **Jouw kosten** | €7,50/maand basis + €5/gebruiker (via Billit) |
| **Weinig concurrenten bieden dit** | Shopify/Lightspeed hebben dit niet standaard |
| **FOMO marketing** | "Bereid je voor op de verplichting" urgentie |

### Voorgestelde Pricing

| Plan | Peppol Status | Prijs |
|------|---------------|-------|
| **Free** | ❌ Niet beschikbaar (kan upgraden naar Starter of add-on) | - |
| **Starter** | 🔒 Add-on beschikbaar | **€12/maand** |
| **Pro** | ✅ Inbegrepen | Gratis |
| **Enterprise** | ✅ Inbegrepen | Gratis |

**Marge berekening bij Starter add-on (€12/maand):**
- Jullie betalen: ~€7,50 + €5 = €12,50 basis
- Per extra gebruiker: +€5
- **Marge:** Minimaal als standalone, maar de waarde zit in de upsell naar Pro waar het gratis is

**Alternatief: €15/maand** voor betere marge of koppelen aan Pro upgrade incentive.

---

## Technische Implementatie

### Fase 1: Database - Add-on Systeem

**Nieuwe tabel: `tenant_addons`**

```sql
CREATE TABLE public.tenant_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  addon_type text NOT NULL, -- 'peppol', 'pos', 'whatsapp', etc.
  status text DEFAULT 'active', -- 'active', 'cancelled'
  stripe_subscription_id text,
  stripe_price_id text,
  price_monthly numeric(10,2),
  activated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, addon_type)
);
```

**RLS Policies:**
- Tenants kunnen alleen hun eigen add-ons zien
- Service role kan alles beheren

### Fase 2: Feature Check Uitbreiden

**Update `useUsageLimits.ts`:**

Huidige `checkFeature()` kijkt alleen naar plan features. We breiden dit uit:

```typescript
const checkFeature = (featureKey: string): boolean => {
  // 1. Check plan features eerst
  const planHasFeature = subscription?.pricing_plan?.features?.[featureKey];
  if (planHasFeature) return true;
  
  // 2. Check actieve add-ons
  const hasAddon = addons?.some(
    addon => addon.addon_type === featureKey && addon.status === 'active'
  );
  return hasAddon;
};
```

**Nieuwe hook: `useTenantAddons.ts`:**

```typescript
export function useTenantAddons() {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ['tenant-addons', currentTenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_addons')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!currentTenant?.id
  });
}
```

### Fase 3: Peppol Add-on Purchase Flow

**Nieuwe component: `PeppolUpgradeCard.tsx`**

In `PeppolSettings.tsx`, als feature niet beschikbaar:

```
┌─────────────────────────────────────────────────────────────┐
│ 🇧🇪 Peppol e-Invoicing                                      │
│                                                              │
│ ⚠️ Vanaf 2026 verplicht voor alle B2B facturen in België    │
│                                                              │
│ [📋 Wat is Peppol?]                                         │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Twee opties om Peppol te activeren:                     │ │
│ │                                                         │ │
│ │ 💎 Upgrade naar Pro                                     │ │
│ │    Peppol + alle AI features + VVB labels              │ │
│ │    €79/maand                                            │ │
│ │    [Upgrade naar Pro]                                   │ │
│ │                                                         │ │
│ │ ─────────── OF ───────────                              │ │
│ │                                                         │ │
│ │ 📦 Peppol Add-on                                        │ │
│ │    Alleen Peppol e-invoicing voor je huidige plan       │ │
│ │    €12/maand                                            │ │
│ │    [Activeer Peppol Add-on]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Edge Function: `create-addon-checkout`**

```typescript
// supabase/functions/create-addon-checkout/index.ts
// Maakt Stripe Checkout voor add-on subscriptions
// Parameters: tenantId, addonType, priceId
// Returns: Stripe checkout URL
```

**Webhook handler uitbreiden:**
- Bij succesvolle betaling: `tenant_addons` record aanmaken
- Bij annulering: status naar 'cancelled'

### Fase 4: Admin Add-on Management

**Nieuwe component: `TenantAddonsTab.tsx`**

In admin settings, een overzicht van actieve add-ons:

```
┌─────────────────────────────────────────────────────────────┐
│ Actieve Add-ons                                             │
├─────────────────────────────────────────────────────────────┤
│ ✅ Peppol e-Invoicing          €12/maand    [Beheren]       │
│ ✅ WhatsApp Berichten          €9/maand     [Beheren]       │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Beschikbare Add-ons                                         │
│ 🔒 POS Kassa                   €29/maand    [Activeren]     │
│ 🔒 Bol.com Kanaal              €15/maand    [Activeren]     │
└─────────────────────────────────────────────────────────────┘
```

### Fase 5: Marketing Update

**Update `PricingSection.tsx` add-ons:**

```typescript
const addons = [
  // ... existing
  {
    icon: FileText, // of Network
    name: 'Peppol e-Invoicing',
    price: 12,
    proPricing: 0, // Gratis bij Pro
    description: 'Verplicht vanaf 2026 in BE',
    features: [
      'Officiële Peppol koppeling',
      'Automatische e-factuurverzending',
      'Ontvangstbevestigingen',
      'B2B compliance'
    ],
    availableFor: 'Starter (Pro: gratis)',
    urgencyBadge: '🇧🇪 Verplicht 2026' // Nieuwe property voor FOMO
  },
];
```

---

## Bestanden Overzicht

### Database Migratie

| Actie | Details |
|-------|---------|
| Nieuwe tabel `tenant_addons` | Add-on tracking per tenant |
| RLS policies | Tenant isolation |
| Indexes | Performance op tenant_id + addon_type |

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `src/hooks/useTenantAddons.ts` | Hook voor add-on data ophalen |
| `src/components/admin/billing/PeppolUpgradeCard.tsx` | Upgrade prompt voor Peppol |
| `src/components/admin/billing/TenantAddonsTab.tsx` | Add-on management UI |
| `supabase/functions/create-addon-checkout/index.ts` | Stripe checkout voor add-ons |

### Aangepaste Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useUsageLimits.ts` | Add-on check in `checkFeature()` |
| `src/components/admin/settings/PeppolSettings.tsx` | Upgrade prompt integratie |
| `src/components/landing/PricingSection.tsx` | Peppol add-on toevoegen |
| `supabase/functions/stripe-webhook/index.ts` | Add-on subscription handling |

---

## UI Flow

```text
Free/Starter user opent Facturatie → Peppol Settings
    │
    ├─► Ziet: "🔒 Peppol niet beschikbaar"
    │
    └─► Twee knoppen:
         │
         ├─► "Upgrade naar Pro" → /pricing
         │
         └─► "Activeer Peppol Add-on" 
              │
              └─► Stripe Checkout (€12/maand)
                   │
                   └─► Webhook → tenant_addons record
                        │
                        └─► Peppol settings nu beschikbaar!
```

---

## Marketing Messaging

### In-app upsell tekst

> **🇧🇪 Peppol e-Invoicing wordt verplicht**
> 
> Vanaf 1 januari 2026 zijn alle Belgische ondernemingen verplicht om B2B facturen via Peppol te versturen.
> 
> **Bereid je nu voor:**
> - Ontvang automatische bevestigingen
> - Voldoe aan de wetgeving
> - Bespaar tijd op administratie

### Landing page add-on card

> **Peppol e-Invoicing** - €12/maand
> 
> 🇧🇪 *Verplicht vanaf 2026 in België*
> 
> - Officiële Peppol-koppeling
> - Automatische verzending aan B2B klanten
> - Ontvangstbevestigingen
> - Gratis bij Pro plan!

---

## Implementatie Volgorde

```text
Week 1: Basis
├── Database: tenant_addons tabel + RLS
├── Hook: useTenantAddons
├── Uitbreiden: checkFeature() met add-on check
└── Edge function: create-addon-checkout

Week 2: UI & Marketing
├── Component: PeppolUpgradeCard
├── Update: PeppolSettings met upgrade prompt
├── Update: PricingSection met Peppol add-on
└── Component: TenantAddonsTab voor beheer

Week 3: Stripe Integratie
├── Webhook: add-on subscription events
├── Stripe products/prices aanmaken
└── Testen end-to-end flow
```

---

## Alternatieve Pricing Opties

### Optie A: Pure add-on (huidige voorstel)
- Starter: €12/maand add-on
- Pro+: Gratis

### Optie B: Bundel met Factur-X
- "Compliance Pack": Peppol + Factur-X + Credit Notes = €19/maand
- Meer waarde, hogere marge

### Optie C: Per-factuur pricing
- €0,15 per Peppol factuur (pay-as-you-go)
- Minder commitment, maar onvoorspelbare revenue

**Aanbeveling:** Optie A (pure add-on €12/maand) met sterke upsell naar Pro waar het gratis is. Dit creëert de incentive om naar Pro te upgraden.


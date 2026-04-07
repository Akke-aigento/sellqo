

## Fix: Upgrade faalt voor trialing tenants zonder Stripe abonnement

### Oorzaak

De tenant Mancini Milano zit op een **trial** (`status: trialing`) met `stripe_subscription_id: NULL` en `stripe_customer_id: NULL`. 

Wanneer je op "Upgrade" klikt, roept de code altijd `calculate-plan-switch` aan. Die functie zoekt een **actieve Stripe subscription** (`.eq("status", "active")`) en faalt met "No active Stripe subscription found".

De juiste flow is:
- **Heeft Stripe subscription** → plan-switch (huidige flow)
- **Geen Stripe subscription** (trial/free) → checkout sessie starten via `create-platform-checkout`

Daarnaast heeft `create-platform-checkout` dezelfde `.single()` bug op `user_roles` die we eerder in de plan-switch functies hebben gefixt — platform admins met meerdere rollen laten die ook crashen.

### Oplossing

**1. Billing.tsx — routing op basis van subscription status**

In `PlanComparisonCards` `onSelectPlan`:
- Als `subscription?.stripe_subscription_id` bestaat → huidige `handlePreviewPlanSwitch` flow
- Anders → `createCheckout.mutate({ planId, interval })` om een Stripe checkout te starten

**2. `create-platform-checkout` — multi-role fix**

Dezelfde fix als bij plan-switch: `.not("tenant_id", "is", null).limit(1).maybeSingle()` in plaats van `.single()`.

**3. `platform-customer-portal` — zelfde fix**

Ook hier `.single()` vervangen door de multi-role-safe variant.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Billing.tsx` | Checkout vs plan-switch routing |
| `supabase/functions/create-platform-checkout/index.ts` | Multi-role user_roles fix |
| `supabase/functions/platform-customer-portal/index.ts` | Multi-role user_roles fix |


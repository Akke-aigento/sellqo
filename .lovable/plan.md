
# Stripe Webhook Testing Plan

## Huidige Status: ✅ Configuratie Correct

Je Stripe webhook is correct ingesteld met alle 11 events:

| Event | Functie |
|-------|---------|
| checkout.session.completed | Checkout afgerond → subscription created |
| customer.subscription.created | Abonnement aangemaakt |
| customer.subscription.updated | Abonnement gewijzigd |
| customer.subscription.deleted | Abonnement geannuleerd |
| customer.subscription.trial_will_end | Trial eindigt binnenkort |
| invoice.paid | Factuur betaald |
| invoice.payment_failed | Betaling mislukt |
| **payout.created** | Uitbetaling gepland (nieuw) |
| **payout.paid** | Uitbetaling ontvangen (nieuw) |
| **payout.failed** | Uitbetaling mislukt (nieuw) |
| **payout.canceled** | Uitbetaling geannuleerd (nieuw) |

---

## Belangrijke Bevinding

Er is een kleine bug in de webhook code. De `sendPayoutNotification` functie zoekt naar `stripe_customer_id` in de `tenants` tabel als fallback, maar dit veld bestaat daar niet.

**Oplossing nodig**: De fallback moet zoeken in `tenant_subscriptions` tabel (waar `stripe_customer_id` wél staat).

---

## Testing Stappen

### Stap 1: Fix de Tenant Lookup

De webhook code moet worden aangepast om correct de tenant te vinden:

```text
HUIDIG (fout):
1. Zoek tenant via tenants.stripe_account_id ✅
2. Zoek tenant via tenants.stripe_customer_id ❌ (bestaat niet)

NIEUW (correct):
1. Zoek tenant via tenants.stripe_account_id ✅
2. Zoek tenant via tenant_subscriptions.stripe_customer_id ✅
```

### Stap 2: Test via Stripe Dashboard

1. Ga naar **Developers > Webhooks** in Stripe
2. Klik op je "Sellqo Platform" webhook
3. Klik op **"Test webhook verzenden"**
4. Selecteer `payout.paid` event
5. Klik **"Test webhook verzenden"**

### Stap 3: Verifieer in Edge Function Logs

Na de test check je de logs voor:
- `[PLATFORM-STRIPE-WEBHOOK] Processing event - {"type":"payout.paid"}`
- `[PLATFORM-STRIPE-WEBHOOK] Sending payout notification`

### Stap 4: Check Notificatie in Database

Verifieer dat de notificatie is aangemaakt in de `notifications` tabel.

---

## Jouw Test Tenants

Je hebt 2 tenants met Stripe Connect accounts die payout notificaties kunnen ontvangen:

| Tenant | Stripe Account ID |
|--------|-------------------|
| SellQo | acct_1SuIYTRziCKgbo3A |
| Demo Bakkerij | acct_1Sq805Rwtif7i2ny |

---

## Implementatie Wijzigingen

### Bestand: `supabase/functions/platform-stripe-webhook/index.ts`

**Huidige code (regel 46-52):**
```typescript
// Fallback to stripe_customer_id for platform payouts
const { data: platformTenant } = await supabase
  .from("tenants")
  .select("id")
  .eq("stripe_customer_id", stripeAccountId)
  .single();
```

**Nieuwe code:**
```typescript
// Fallback to stripe_customer_id via tenant_subscriptions
const { data: subscription } = await supabase
  .from("tenant_subscriptions")
  .select("tenant_id")
  .eq("stripe_customer_id", stripeAccountId)
  .single();
tenantId = subscription?.tenant_id || null;
```

---

## Bonus: Test Notificatie Knop (Optioneel)

Na de fix kunnen we een "Test Payout Notificatie" knop toevoegen in de admin settings, zodat merchants hun notificatie-instellingen kunnen verifiëren zonder echte Stripe events.

---

## Samenvatting Acties

| # | Actie | Status |
|---|-------|--------|
| 1 | Webhook events toegevoegd in Stripe | ✅ Klaar |
| 2 | Payout handlers in webhook | ✅ Klaar |
| 3 | Fix tenant lookup fallback | 🔧 Nodig |
| 4 | Test via Stripe Dashboard | ⏳ Na fix |
| 5 | Verifieer notificaties | ⏳ Na test |

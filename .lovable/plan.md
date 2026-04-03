
## Fix: Checkout kapot op alle 3 custom frontends

### Root cause

**`checkoutGetPaymentMethods`** (regel 1356-1370) selecteert `bank_account_iban` en `bank_account_name` uit de `tenants` tabel, maar deze kolommen bestaan niet. De echte kolomnamen zijn `iban` en `name`. Resultaat: de query faalt stil en retourneert altijd een lege array `[]` — geen betaalmethoden beschikbaar.

Dit breekt:
- **Mancini**: multi-step checkout kan geen payment methods tonen
- **Vanxcel & Loveke**: gebruiken single-call flow die `checkout_start` aanroept → krijgen geen `checkout_url` terug

### Twee fixes

**Fix 1: Column names in `checkoutGetPaymentMethods`**

Wijzig de select van `bank_account_iban, bank_account_name` naar `iban, stripe_account_id, stripe_charges_enabled`. Check `tenant.iban` i.p.v. `tenant.bank_account_iban`.

**Fix 2: `checkout_start` verrijken voor single-call frontends**

Als `success_url` en `cancel_url` meegegeven worden in params, retourneert `checkout_start` ook `payment_methods` en `shipping_methods` — zodat de frontend in één call alle checkout-info krijgt en daarna een betaalmethode-keuze kan tonen.

De frontend stuurt dan een tweede call (`checkout_place_order` of `checkout_create_session`) met de gekozen `payment_method`. Dit behoudt de betaalmethode-stap (Stripe vs bankoverschrijving met QR-code).

### Technische aanpak

**`supabase/functions/storefront-api/index.ts`**

1. `checkoutGetPaymentMethods`: fix column names `iban` i.p.v. `bank_account_iban`
2. `checkoutStart`: als `success_url`/`cancel_url` aanwezig → ook `payment_methods` en `shipping_methods` mee retourneren

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Fix column names + enrich checkout_start response |

### Geen database wijzigingen nodig

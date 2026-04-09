

## Feature: Tenant kiest zelf welke Stripe betaalmethodes actief zijn

### Huidige situatie
- De checkout session (regel 621) maakt **geen** `payment_method_types` aan — Stripe bepaalt automatisch welke methodes verschijnen
- Tenants hebben alleen een hoog-niveau toggle: "Stripe aan/uit" en "Bankoverschrijving aan/uit"
- Er is geen `stripe_payment_methods` kolom in de database

### Plan

#### Stap 1: Database — nieuw veld
Migratie: voeg `stripe_payment_methods` jsonb kolom toe aan `tenants` met default `["card", "ideal", "bancontact"]`.

#### Stap 2: Admin UI — Stripe sub-methode selector
In `TransactionFeeSettings.tsx`, wanneer Stripe actief is, toon een uitklapbare sectie met checkboxes voor elke methode:

| Methode | Code | Beschrijving | Regio |
|---------|------|-------------|-------|
| Creditcard / Apple Pay / Google Pay | `card` | Standaard kaartbetalingen + wallets | Internationaal |
| iDEAL | `ideal` | Directe bankoverschrijving | 🇳🇱 NL |
| Bancontact | `bancontact` | Belgisch betaalsysteem | 🇧🇪 BE |
| Klarna | `klarna` | Achteraf betalen / gespreid | EU |
| PayPal | `paypal` | PayPal checkout | Internationaal |
| SOFORT | `sofort` | Directe bankoverschrijving | 🇩🇪 DE/AT |
| EPS | `eps` | Oostenrijks betaalsysteem | 🇦🇹 AT |
| Giropay | `giropay` | Duits betaalsysteem | 🇩🇪 DE |

Elke methode toont een icoon, naam, kostenindicatie en regio-badge. Minimaal 1 methode vereist.

#### Stap 3: Edge function — respecteer tenant keuzes
In `create-checkout-session/index.ts`, haal `stripe_payment_methods` op uit de tenant data en zet `payment_method_types` expliciet op de checkout session in plaats van Stripe's automatische modus.

**Let op**: bij destination charges (transfer_data) worden niet alle methodes ondersteund. De code filtert automatisch methodes die niet compatibel zijn.

#### Stap 4: Storefront API
Pas `checkoutGetPaymentMethods` aan zodat de response de actieve Stripe sub-methodes teruggeeft (voor eventuele UI-hints in de checkout).

### Bestanden die wijzigen
1. **Migratie** — nieuw veld `stripe_payment_methods` op `tenants`
2. **`src/components/admin/settings/TransactionFeeSettings.tsx`** — checkbox UI onder de Stripe toggle
3. **`supabase/functions/create-checkout-session/index.ts`** — `payment_method_types` dynamisch zetten
4. **Storefront API** (indien nodig) — methodes doorgeven

### Scope eerste versie
Start met **card, ideal, bancontact** (standaard aan) en **klarna** (standaard uit). Overige methodes als uitbreiding later.


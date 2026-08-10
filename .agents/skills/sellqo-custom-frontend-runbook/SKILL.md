---
name: sellqo-custom-frontend-runbook
description: Verplichte patronen bij het bouwen of wijzigen van een SellQo custom frontend (tenant-storefront op de storefront-api) — cart self-healing, B2B-checkout met btw-verlegging, dynamische verzendlandenlijst, en normalizeCart/CheckoutState-uitbreidingen.
---

# SellQo Custom Frontend Build Runbook

Elke nieuwe SellQo custom frontend (Lovable-project voor een specifieke tenant) MOET bij aanmaak de volgende drie patronen correct implementeren. Dit runbook voorkomt dat bekende bugs opnieuw moeten worden uitgevogeld.

---

## PATROON 1 — Cart self-healing (CART-HEAL-1)

**Root cause:** De SellQo storefront-api antwoordt bij een verlopen/verwijderde cart met HTTP 200 + `{success:true, data:null}`. Zonder fix leidt dit tot een permanent lege winkelmand totdat de klant localStorage wist.

### Architectuur A: `src/integrations/sellqo/hooks.ts` (Loveke/VanXcel-stijl)
- Voeg `clearStoredCartId()` toe naast `getStoredCartId`/`storeCartId`.
- `useCartQuery`: bij `extractSingle(result) === null` → `clearStoredCartId()` + lege mand (geen `|| result` fallback).
- `useAddToCart`: bij `data:null` → wis dode id → nieuwe cart → retry 1× → bij aanhoudend falen `throw new Error('CART_ADD_FAILED')`. Voeg `storeCartId` + `invalidateQueries` toe in `onSuccess`.

### Architectuur B: `src/lib/storefrontApi.ts` + `cart-context` (Astra-stijl)
- In `callCart`: na `call()` → `if (!raw) throw new StorefrontApiError({ code: "cart_not_found" })`.
- De bestaande cart-context-recovery (bij `cart_not_found`: id wissen + verse cart) slaat dan automatisch aan.

---

## PATROON 2 — B2B-checkout met BTW-verlegging

**Vereiste backend-support:** aanwezig in SellQo-core. `checkout_customer` accepteert `is_b2b`, `company_name`, `vat_number`, `vat_verified`, `vat_country`, `vat_company_name`. `checkout_validate_vat` doet VIES-lookup. Bij verlegging geeft elke cart-response netto `subtotal`/`total`/`items` + `reverse_charge:true`/`vat_text`/`vat_regime`.

### 2a — VIES-aanroep
- **Met proxy** (Loveke/VanXcel): gebruik het pad `/checkout/validate_vat` met **underscore**. De proxy-fallback doet `segments.join('_')` → action `checkout_validate_vat`. Een streepje (`validate-vat`) mapt verkeerd.
- **Direct** (Astra): gebruik `call("checkout_validate_vat", { vat_number })`. NIET via `callCart` — VIES geeft geen cart terug en triggert anders de cart-heal.

### 2b — Netto-totalen (server-response is bron van waarheid)
De checkout-response na `checkout_customer` + `checkout_shipping` bevat netto bedragen bij verlegging. Gebruik die als bron van waarheid. Nooit `state.subtotal` gebruiken als fallback in de shipping-autoselect-berekening — die kan stale/bruto zijn. Patroon:
```js
const src = shipTotals || custTotals; // beide uit readCartTotals(response)
const nextSubtotal = src?.subtotal != null ? Number(src.subtotal) : s.subtotal;
const nextTotal = src?.total != null ? Number(src.total) : (nextSubtotal + nextShipping);
```

### 2c — B2B-status normaliseren (nooit "vast" laten hangen)
- De backend normaliseert nu al bij elke `checkout_customer`-call: `is_b2b !== true` → reset alle BTW-velden op de cart.
- Als extra vangnet: stuur bij uitgevinkte toggle altijd expliciet `is_b2b: false` mee (niet de velden weglaten).
- Init-state op `isB2B: !!customer?.is_b2b` (niet hardcoded `false`) zodat rehydratie werkt.

### 2d — Rehydratie bij terugkeer in de checkout
- De backend levert nu in elk cart/checkout-response het `customer`-object met B2B-velden (`is_b2b`, `company_name`, `vat_number`, `vat_verified`, `vat_country`, `vat_company_name`).
- Lees die uit bij `startCheckout`/`checkoutStart` en zet ze in de state → de toggle, het BTW-nummer en de ✓-status tonen correct bij terugkeer.
- Lees ook `reverse_charge`/`vat_text`/`vat_regime` uit de start-response → de verleggingsmelding toont direct zonder opnieuw te hoeven submitten.

### 2e — UX-patroon
- Toggle "Ik bestel zakelijk" tussen contactgegevens en bezorgadres.
- VIES-validatie **on blur** (niet per toetsaanslag) — backend-rate-limit is 10/min.
- Bij geldig nummer: groene ✓ + VIES-bedrijfsnaam; bij ongeldig: melding "je kunt doorgaan, je betaalt dan incl. btw" — NOOIT blokkeren (`block_invalid_vat_orders = false` is standaard).
- Bedrijfsnaam-veld is verplicht als isB2B; BTW-nummer optioneel.
- Prefill adres-bedrijfsveld met de B2B-bedrijfsnaam als dat nog leeg is.

### 2f — OrderSummary / CartSummary bij verlegging
- Toon "Alle prijzen zijn exclusief btw" + `vat_text` ("Btw verlegd - intracommunautaire levering - art. 39bis WBTW").
- Toon geen apart btw-bedrag bij verlegging (dat is correct — klant betaalt netto, btw verlegd naar hen).

---

## PATROON 3 — normalizeCart / CheckoutState uitbreiden

Bij Astra-architectuur (storefrontApi.ts met normalizeCart): voeg bij uitbreiding altijd de nieuwe top-level velden toe aan de return van `normalizeCart`. Velden die normalizeCart niet expliciet doorgeeft, verdwijnen. Bijzonder belangrijk voor: `reverse_charge`, `vat_text`, `vat_regime`, `checkout.customer` (B2B-velden).

Bij Loveke/VanXcel-architectuur (CheckoutContext): voeg nieuwe state-velden (`reverseCharge`, `vatText`, `vatRegime`) ook toe aan `initialState`, de context-interface en de `startCheckout`-setState.

---

## CHECKLIST bij elke nieuwe custom frontend

---

## PATROON 4 — Dynamische verzendlandenlijst (SHIP-GEO-2)

**Root cause:** custom frontends hebben vaak een hardcoded `<select>` met landen (BE/NL/FR/DE/LU/...). De tenant kan in SellQo verzendlanden beperken (`shipping_methods.countries` + `tenants.shipping_allowed_countries`), maar de frontend blijft landen tonen waar niet naar verzonden wordt → checkout faalt pas bij het kiezen van een verzendmethode ("geen verzendmethodes beschikbaar"), of de klant bestelt naar een land dat de tenant niet bedient.

### 4a — API-contract

`POST` action `get_shipping_countries` (publiek, geen cart nodig, `Cache-Control: public, max-age=300`):

```json
{ "countries": ["BE","NL"], "unrestricted": false, "default_country": "BE" }
```

- `unrestricted: true` → geen beperking; toon de volledige eigen landenlijst.
- `unrestricted: false` → toon UITSLUITEND `countries` (ISO-2, alfabetisch).
- `default_country` → preselectie in de dropdown (kan `null` zijn).

### 4b — Frontend-regels

- Nooit een hardcoded landenlijst in een checkout-adresstap. Altijd `get_shipping_countries` bij mount, met de eigen lijst enkel als fallback bij `unrestricted`.
- Preselecteer `default_country`; is de huidige selectie niet in `countries`, corrigeer automatisch naar `default_country` (geen stille ongeldige staat).
- Bij precies één land: geen dropdown maar een vast label (leest als bevestiging, niet als keuze).
- Bij een lege lijst (`countries: []` en `unrestricted: false`): duidelijke melding "momenteel geen verzending mogelijk" en checkout blokkeren.
- Landnamen lokaliseren via `Intl.DisplayNames` met NL-fallback; sorteer op de gelokaliseerde naam, stuur altijd de ISO-2 code naar de API.
- Referentie-implementatie: SellQo-core `src/lib/shippingRegions.ts` (`localizedCountryOptions`) + `ShopCheckout.tsx`.

### 4c — Effect op tenants

Zodra de landenlijst dynamisch is, wordt de tenant-configuratie leidend. Controleer per tenant of `shipping_allowed_countries` en de landen per verzendmethode kloppen — een lege configuratie bij een methode betekent "geen beperking", niet "geen landen".

---

## CHECKLIST bij elke nieuwe custom frontend

- [ ] Cart self-healing (patroon 1) — afhankelijk van architectuur
- [ ] B2B-toggle + VIES on-blur (patroon 2a-2e)
- [ ] Netto-totalen uit server-response (patroon 2b)
- [ ] `is_b2b: false` bij uitgevinkte toggle (patroon 2c)
- [ ] Rehydratie uit `customer` + `reverse_charge` in startCheckout (patroon 2d)
- [ ] Verleggingsmelding in order summary (patroon 2f)
- [ ] Proxy-underscore-truc of directe call voor VIES (patroon 2a)
- [ ] `normalizeCart` laat alle nieuwe velden door (patroon 3)
- [ ] Landenlijst uit `get_shipping_countries`, geen hardcoded landen (patroon 4)

---

## Referentie-implementaties

| Frontend | Architectuur | Commit cart-heal | Commit B2B |
|---|---|---|---|
| Loveke | `src/integrations/sellqo/hooks.ts` + `CheckoutContext` | `05adda1` | `edt-c3ced3fe` + `08e4bfe` |
| VanXcel | idem, eigen storage-key/events | `38729e9` | `028bd92` + `64cc7d4` |
| Astra Sleep | `src/lib/storefrontApi.ts` + `cart-context` + routes | `308774d` | `3f4964e` |

Backend-fixes (SellQo-core, alle tenants):
- `ec2a933` — reverse-charge op Stripe-bedrag (`checkoutComplete`)
- `5d6d7d0` — B2B-status normaliseren (`checkoutCustomer`)
- `cddba0a` — B2B-velden in `buildCartResponse` customer-object (rehydratie)



## Plan: BTW-nummer (VIES) + Kortingscode integratie in Checkout & Winkelwagen

### Analyse

**Probleem 1: BTW-nummer ontbreekt in checkout**
Er bestaat al een volledig uitgewerkte `CheckoutForm.tsx` component met B2B/B2C toggle, BTW-nummer invoer, VIES-validatie en BTW-preview. Deze component wordt echter **niet gebruikt** in `ShopCheckout.tsx`. De checkout pagina heeft enkel een simpel bedrijfsnaam-veld zonder BTW-nummer.

**Probleem 2: Kortingscode werkt niet**
- In `ShopCart.tsx` staat een kortingscode-veld, maar de `applyDiscount` functie is een dummy (wacht 1 seconde en geeft altijd "Ongeldige kortingscode")
- In `ShopCheckout.tsx` is er **geen** kortingscode-veld
- De backend API's bestaan al volledig: `validate_discount_code` en `cart_apply_discount` in de storefront-api edge function
- Het promotiesysteem (`src/lib/promotions/`) is uitgebouwd maar nergens verbonden met de storefront UI

**Probleem 3: Kortingen niet zichtbaar in overzicht**
Het besteloverzicht in zowel cart als checkout toont geen kortingsregels, enkel subtotaal + verzending = totaal.

---

### Oplossing

#### 1. ShopCheckout.tsx -- BTW-nummer + VIES validatie

- **B2B/B2C toggle** toevoegen in het klantgegevens-formulier (alleen als `enable_b2b_checkout` aan staat in tenant settings)
- Bij "Zakelijk": toon BTW-nummer veld met "Valideer" knop
- VIES-validatie via bestaande `validate-vat` edge function
- Bij geldig BTW + ander EU-land: reverse charge (0% BTW) tonen in overzicht
- Tenant settings `require_vies_validation` en `block_invalid_vat_orders` respecteren
- BTW-nummer + validatiestatus meesturen naar de checkout/betaal edge functions
- `CustomerData` interface uitbreiden met `vatNumber`, `customerType` (`b2b`/`b2c`), `vatValidated`

#### 2. ShopCart.tsx -- Werkende kortingscode

- De dummy `applyDiscount` functie vervangen door een echte API-call naar `storefront-api` met action `validate_discount_code`
- Bij succesvolle validatie: de korting opslaan in lokale state (code, type, waarde, beschrijving)
- Korting tonen als groene regel in het overzicht met verwijder-knop (X)
- Totaal herberekenen met korting
- De kortingscode meegeven aan checkout (via URL parameter of CartContext)

#### 3. ShopCheckout.tsx -- Kortingscode in checkout

- Kortingscode-veld toevoegen in het besteloverzicht (sidebar + mobile bar)
- Zelfde validatielogica als in de cart
- Als er al een code is meegegeven vanuit de cart, deze automatisch toepassen
- Kortingsregel tonen in de totaalberekening
- Korting meesturen naar de checkout/betaal edge functions (`create-checkout-session`, `create-bank-transfer-order`)

#### 4. CartContext uitbreiden

- `discountCode` state toevoegen (code + berekende korting)
- `applyDiscountCode` en `removeDiscountCode` functies
- Zodat de korting bewaard blijft tussen cart en checkout

#### 5. Mobile-first

- B2B/B2C toggle: full-width knoppen gestapeld op mobiel (`flex-col sm:flex-row`)
- BTW-nummer veld + valideer knop: `flex-col sm:flex-row` layout
- Kortingscode veld: compacte layout met "Toepassen" knop, past in de sticky mobile bar
- Kortingsregel in overzicht: groene tekst met `-` prefix, responsive

---

### Technische details

**Bestanden die worden aangepast:**

| Bestand | Wijziging |
|---|---|
| `src/context/CartContext.tsx` | `discountCode` state + `applyDiscountCode`/`removeDiscountCode` functies toevoegen |
| `src/pages/storefront/ShopCheckout.tsx` | BTW-nummer sectie (B2B/B2C toggle, VIES-validatie), kortingscode veld, kortingsregels in overzicht, data meesturen naar edge functions |
| `src/pages/storefront/ShopCart.tsx` | Dummy `applyDiscount` vervangen door echte API-call, korting tonen in overzicht, verwijder-optie |

**Bestaande code die hergebruikt wordt:**
- `CheckoutForm.tsx` -- de BTW-logica (VIES-validatie, VAT preview berekening, EU landen lijst) wordt gekopieerd/geintegreerd in `ShopCheckout.tsx` (niet het hele component, want de checkout heeft al zijn eigen formulierstructuur)
- `validate-vat` edge function -- al bestaand, wordt aangeroepen vanuit checkout
- `storefront-api` `validate_discount_code` -- al bestaand, wordt aangeroepen vanuit cart en checkout
- `src/lib/promotions/calculators/discountCode.ts` -- berekening client-side

**Data flow kortingscode:**
```text
ShopCart: gebruiker voert code in
  -> API call: storefront-api/validate_discount_code
  -> Bij succes: opslaan in CartContext (code + discount info)
  -> Tonen in overzicht als kortingsregel

ShopCheckout: code uit CartContext laden
  -> Tonen in overzicht
  -> Meesturen naar create-checkout-session / create-bank-transfer-order
  -> Edge function past korting toe op order
```

**Data flow BTW:**
```text
ShopCheckout: B2B toggle -> BTW-nummer invoer
  -> "Valideer" knop -> validate-vat edge function
  -> Bij geldig: reverse charge preview (0% BTW)
  -> Bij ongeldig + block_invalid_vat_orders: bestelling blokkeren
  -> BTW-data meesturen naar checkout edge functions
```

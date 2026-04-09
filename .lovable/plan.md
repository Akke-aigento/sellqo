
## Permanente fix: Stripe-methodes fail closed maken + stale defaults verwijderen

### Waardoor het nu blijft terugkomen
Dit is geen enkelvoudige bug meer, maar een combinatie van 3 dingen:

1. **De checkout vertrouwt `preferred_payment_method` blind**
   In `supabase/functions/create-checkout-session/index.ts` wordt de gekozen methode direct gebruikt zodra de klant bv. `ideal` of `bancontact` kiest, ook als die methode op het connected account niet echt actief is.

2. **Er zitten nog harde fallbacks in de code**
   Op meerdere plekken wordt bij ontbrekende data teruggevallen op:
   `['card', 'ideal', 'bancontact']`
   Daardoor kunnen oude of ongeldige methodes opnieuw in beeld komen.

3. **De admin-instellingen tonen tenant-keuzes, niet de live Stripe-capabilities**
   Daardoor kan de UI nog steeds methodes laten aanvinken of tonen die Stripe uiteindelijk niet accepteert.

### Plan

#### 1. Checkout backend fail closed maken
**Bestand:** `supabase/functions/create-checkout-session/index.ts`

Ik maak van de edge function de enige bron van waarheid:

- tenant-configuratie saneren naar alleen ondersteunde codes
- live account-capabilities ophalen
- daaruit een **definitieve `availableMethods` lijst** berekenen
- `preferred_payment_method` alleen accepteren als die in `availableMethods` zit
- anders een nette **400 response** teruggeven met:
  - foutcode
  - duidelijke melding
  - lijst van wel beschikbare methodes

Belangrijk:
- de huidige harde fallback op `['card', 'ideal', 'bancontact']` bij het aanmaken van de Stripe session gaat eruit
- Stripe wordt alleen nog aangeroepen als `payment_method_types` al 100% gevalideerd is
- als er geen geldige methodes overblijven: **geen redirect naar kapotte Stripe-pagina**, maar een duidelijke fout terug naar de app

#### 2. Alle riskante defaults centraliseren en versmallen
**Bestanden:**
- `supabase/functions/create-checkout-session/index.ts`
- `src/pages/storefront/ShopCheckout.tsx`
- `src/components/storefront/PaymentMethodSelector.tsx`
- `src/components/admin/settings/TransactionFeeSettings.tsx`

Ik haal de losse fallbacks naar `['card', 'ideal', 'bancontact']` weg en vervang ze door een veilige aanpak:

- ofwel `['card']` als minimale fallback
- of liever: geen impliciete extra methodes meer, alleen wat echt geconfigureerd en gevalideerd is

Zo voorkom je dat iDEAL/Bancontact/Klarna “spontaan” terugkeren door null/stale data.

#### 3. Admin betaalinstellingen koppelen aan live account-status
**Bestand:** `src/components/admin/settings/TransactionFeeSettings.tsx`

Ik laat deze settings ook rekening houden met de echte Stripe-capabilities:

- live capabilities ophalen via de bestaande connect-status
- methodes die niet actief zijn:
  - visueel markeren als “niet actief”
  - disable’en in de checklist
- oude ongeldige waardes bij laden direct saneren
- opslaan alleen met methodes die zowel:
  - door de tenant gekozen zijn
  - als live actief beschikbaar zijn

Zo kan de merchant zichzelf niet opnieuw in een kapotte toestand zetten.

#### 4. Storefront foutafhandeling verbeteren
**Bestand:** `src/pages/storefront/ShopCheckout.tsx`

Als de backend zegt dat de gekozen methode niet beschikbaar is:

- duidelijke toast tonen
- niet generiek “er ging iets mis”
- klant op checkout houden
- indien mogelijk automatisch eerste geldige methode selecteren

Dat voorkomt doodlopende flows.

### Verwacht resultaat
- Geen Stripe errorpagina meer met “There are no valid payment methods available”
- Geen console-foutlus meer rond `payment_method_types`
- EPS komt niet meer terug via stale defaults
- alleen methodes die echt actief zijn worden nog getoond/gebruikt
- Apple Pay blijft onder `card` vallen, maar wordt correct gelabeld

### Technische details
**Belangrijkste logische wijziging:**
```text
tenant voorkeurslijst
→ sanitize
→ intersect met live Stripe capabilities
→ availableMethods

if preferred method ∉ availableMethods:
  return 400 + availableMethods

else:
  create checkout session with exact payment_method_types
```

### Bestanden die wijzigen
1. `supabase/functions/create-checkout-session/index.ts`
2. `src/components/admin/settings/TransactionFeeSettings.tsx`
3. `src/pages/storefront/ShopCheckout.tsx`
4. `src/components/storefront/PaymentMethodSelector.tsx`

### Waarom dit de permanente oplossing is
Omdat we dan niet langer vertrouwen op:
- oude databasewaarden
- impliciete defaults
- frontend-selecties zonder backend-validatie

De checkout wordt dan gestuurd door **live gevalideerde betaalmethodes**, niet door aannames.

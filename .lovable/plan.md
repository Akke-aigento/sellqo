

## Fix: Kortingscode input focus verlies + validatie

### Twee bugs gevonden

**Bug 1: Input verliest focus na elk karakter**

De `OrderSummaryContent` component is gedefinieerd als een functie **binnenin** de render van `ShopCheckout`. Elke keer dat je een letter typt, verandert de `discountCode` state, waardoor de hele pagina opnieuw rendert. React ziet `OrderSummaryContent` als een **nieuwe** component (want de functie wordt opnieuw aangemaakt), unmount de oude, mount een nieuwe -- en het input-veld verliest focus.

Oplossing: de discount-code logica (input + applied badge) uit `OrderSummaryContent` halen en als apart, stabiel blok renderen.

**Bug 2: Kortingscode wordt niet herkend**

De edge function retourneert:
```json
{ "success": true, "data": { "valid": true, "discount_type": "percentage", "discount_value": 99 } }
```

Maar de checkout-code controleert `data?.valid` in plaats van `data?.data?.valid`. Het resultaat zit een niveau dieper genest. Dezelfde bug zit ook in de CartDrawer.

Ik heb TEST99 handmatig getest via de backend -- het werkt perfect, 99% korting wordt correct berekend. Het probleem is puur de response-parsing in de frontend.

### Aanpassingen

| Bestand | Wijziging |
|---|---|
| `src/pages/storefront/ShopCheckout.tsx` | (1) Discount input uit `OrderSummaryContent` halen naar een apart blok dat niet bij elke keystroke opnieuw gemount wordt. (2) Response-parsing fixen: `data?.data?.valid` i.p.v. `data?.valid`, en `data.data.discount_type` etc. |
| `src/components/storefront/CartDrawer.tsx` | Zelfde response-parsing fix: `data?.data?.valid` i.p.v. `data?.valid` |

### Technisch detail

De fix voor het focus-probleem verplaatst het discount input-veld naar buiten `OrderSummaryContent`, zodat het als stabiel element op de pagina blijft staan en niet opnieuw gemount wordt bij elke state-wijziging. De `OrderSummaryContent` functie wordt zo simpeler en herrendert alleen voor items en totalen.


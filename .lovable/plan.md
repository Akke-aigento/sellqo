

## Cadeaukaart prijs: "Vanaf €X,00" in plaats van "€0,00"

### Probleem

De cadeaukaart toont €0,00 in het productoverzicht omdat:
1. De `price` van een gift card product is `0` (het werkelijke bedrag wordt gekozen door de klant via denominations)
2. De query in `usePublicProducts` haalt `product_type` en `gift_card_denominations` niet op
3. `ProductCard` weet niet dat het een cadeaukaart is en toont gewoon `price`

### Oplossing

De prijs voor cadeaukaarten wordt "Vanaf €X,00" waarbij X het laagste beschikbare bedrag is (uit de denominaties of `gift_card_min_amount`).

### Technische wijzigingen

**1. `src/hooks/usePublicStorefront.ts` -- query uitbreiden**

De `usePublicProducts` select-query uitbreiden met `product_type, gift_card_denominations, gift_card_min_amount` en deze doorgeven in de return mapping.

**2. `src/components/storefront/ProductCard.tsx` -- interface + weergave**

- Interface uitbreiden met optionele velden: `product_type?`, `gift_card_denominations?`, `gift_card_min_amount?`
- In de prijs-sectie: als `product_type === 'gift_card'`, bereken het laagste bedrag uit denominations of min_amount en toon "Vanaf €X,00"
- Als er geen denominations of min_amount is, toon geen prijs (of een fallback)

### Voorbeeld resultaat

| Was | Wordt |
|---|---|
| € 0,00 | Vanaf € 10,00 |

| Bestand | Wijziging |
|---|---|
| `src/hooks/usePublicStorefront.ts` | `product_type`, `gift_card_denominations`, `gift_card_min_amount` toevoegen aan query + mapping |
| `src/components/storefront/ProductCard.tsx` | Gift card prijs-logica: "Vanaf €X" tonen |


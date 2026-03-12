

## Bugfix: Gift cards in checkout — shipping & display

### Analyse

De checkout gebruikt `cartItems` uit de client-side `CartContext`. Gift cards worden herkend via het `giftCard` veld op `CartItem` (niet `product_type`). De items worden momenteel **niet** uitgefilterd — ze verschijnen wel in het overzicht. Maar er zijn twee echte problemen:

1. **Verzendkosten**: Als de cart alleen gift cards bevat, worden verzendkosten nog steeds berekend — dit moet €0 zijn
2. **Adres/verzendmethode**: Bij een pure gift card bestelling is verzendadres en verzendmethode irrelevant maar wordt nog steeds vereist
3. **Display**: Gift card items tonen geen ontvanger-info in het besteloverzicht

### Wijzigingen in `src/pages/storefront/ShopCheckout.tsx`

**1. Detectie: alle items zijn gift cards**
```typescript
const allGiftCards = cartItems.length > 0 && cartItems.every(item => !!item.giftCard);
const hasGiftCards = cartItems.some(item => !!item.giftCard);
```

**2. Verzendkosten forceren naar €0 bij pure gift card orders**
- Als `allGiftCards === true`: `shipping = 0`, ongeacht de geselecteerde verzendmethode
- Verberg de verzendmethode-selector

**3. Adresvalidatie versoepelen**
- Als `allGiftCards === true`: skip de adres-verplichte-velden check in `validateForm()`

**4. Order summary verbeteren**
- Bij gift card items: toon "(Cadeaukaart)" label en optioneel de ontvanger naam
- Geen variant-label tonen

**5. Verzendmethode-selector verbergen**
- De shipping method `RadioGroup` sectie (regel 882-928) wrappen met `!allGiftCards &&`

### Bestanden
- `src/pages/storefront/ShopCheckout.tsx` — alle wijzigingen in dit ene bestand


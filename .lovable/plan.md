

## Fix: CartDrawer prijzen afgeknipt + quantity bug bij varianten

### Probleem 1: Quantity wijzigt ALLE items van hetzelfde product

`updateQuantity(productId, quantity)` en `removeItem(productId)` matchen op `productId`. Wanneer hetzelfde product met verschillende varianten (bijv. XS en L) in het mandje zit, delen ze dezelfde `productId`. Gevolg: het aanpassen van de hoeveelheid van 1 variant wijzigt ALLE varianten.

**Oplossing**: Gebruik het unieke `item.id` in plaats van `productId` als identifier voor updateQuantity en removeItem.

**Bestand: `src/context/CartContext.tsx`**
- `updateQuantity`: parameter hernoemen naar `itemId` en matchen op `item.id`
- `removeItem`: parameter hernoemen naar `itemId` en matchen op `item.id`

**Bestand: `src/components/storefront/CartDrawer.tsx`**
- Alle aanroepen van `updateQuantity` en `removeItem` wijzigen van `item.productId` naar `item.id`

### Probleem 2: Prijs afgeknipt aan rechterkant

De regeltotaal ("€ 89,00") wordt afgeknipt. De 3-kolom layout (afbeelding 80px + info flex-1 + prijs) laat niet genoeg ruimte.

**Oplossing**: Verplaats de regeltotaal naar binnen de info-kolom (onder de stukprijs en knoppen) zodat er geen aparte derde kolom nodig is. Dit voorkomt overflow volledig.

**Bestand: `src/components/storefront/CartDrawer.tsx`**
- Verwijder de aparte prijs-paragraaf (regel 75-77)
- Voeg de regeltotaal toe binnen de info-div, bovenaan naast de productnaam als een flex-row

### Technische details

```text
CartContext.tsx:

updateQuantity (regel 93-104):
  Was:  updateQuantity(productId: string, quantity: number)
        item.productId === productId
  Wordt: updateQuantity(itemId: string, quantity: number)
         item.id === itemId

removeItem (regel 106-108):
  Was:  removeItem(productId: string)
        item.productId !== productId
  Wordt: removeItem(itemId: string)
         item.id !== itemId

CartDrawer.tsx:

- updateQuantity(item.productId, ...) -> updateQuantity(item.id, ...)
- removeItem(item.productId) -> removeItem(item.id)
- Regeltotaal verplaatsen van aparte kolom naar flex-row met productnaam
```

### Resultaat
- Quantity knoppen wijzigen alleen het specifieke item, niet alle varianten van hetzelfde product
- Prijzen worden volledig weergegeven zonder afknippen

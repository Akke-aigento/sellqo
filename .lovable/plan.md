

## Bundel Kortingen: Huidige Werking + Verbetermogelijkheden

### Hoe het nu werkt ✅
1. Klant voegt individuele producten toe aan winkelmand
2. `useCartPromotions` hook roept `calculate_promotions` aan (server-side)
3. Edge function checkt of alle vereiste bundel-producten in de cart zitten met voldoende hoeveelheid
4. Zo ja → korting wordt berekend en geretourneerd als `type: 'bundle'`
5. CartDrawer en Checkout tonen de korting als groene regel (bijv. "Bundel: Starter Pakket — -€15,00")

**Dit werkt dus al.** De korting verschijnt automatisch zodra de bundel compleet is in de cart.

### Wat ontbreekt
Er is geen manier voor de klant om te **weten** dat een bundel-deal bestaat, tenzij ze toevallig de juiste producten toevoegen. Mogelijke verbeteringen:

**Optie A: Bundel als koopbaar product op de webshop**
- Producten met `product_type = 'bundle'` tonen op de productpagina met hun samenstellende producten
- "Voeg bundel toe" knop → voegt alle bundel-items in één keer toe aan de cart
- Klant ziet direct de bundelprijs vs. losse prijs

**Optie B: Cross-sell hint op productpagina's**
- Als een product deel uitmaakt van een actieve bundel, toon een banner: "Koop samen met X en Y en bespaar 15%"
- Link naar de andere bundel-producten

**Optie C: Bundel-badge in cart**
- Als een bundel bijna compleet is (bijv. 2 van 3 producten), toon hint in de cart: "Voeg nog Product Z toe voor €15 korting"

### Aanbeveling
**Optie A** is het meest impactvol en sluit aan bij de bestaande `product_type = 'bundle'` die we net gebouwd hebben. De productpagina kan de bundel-inhoud tonen met een "Voeg alles toe" knop. Dit vereist:

1. **Storefront productpagina**: detecteer `product_type === 'bundle'`, laad bundel-items, toon ze als lijst met individuele prijzen + bundelprijs
2. **"Voeg bundel toe" actie**: één klik voegt alle bundel-producten toe aan de cart
3. **Cart**: bestaande promotie-engine berekent automatisch de korting (werkt al)

Wil je dat ik één of meerdere van deze opties uitwerk?


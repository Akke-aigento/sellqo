

## Fix: CartDrawer prijzen + Add-to-cart positie op productpagina

### Probleem 1: CartDrawer prijzen afgeknipt

De `overflow-hidden` op de item-rij (regel 43) knipt de regeltotaal-prijs af aan de rechterkant. De prijs "€ 89,00" wordt weergegeven als "€ 89,0" omdat de laatste karakters buiten het zichtbare vlak vallen.

**Oplossing**: Verwijder `overflow-hidden` van de item-rij en beperk de breedte via de middelste kolom (`min-w-0` op flex-1 is al aanwezig). Voeg `pr-1` toe aan de ScrollArea om extra ruimte rechts te geven voor de prijs.

**Bestand: `src/components/storefront/CartDrawer.tsx`**
- Regel 43: `overflow-hidden` verwijderen van item container
- Regel 40: `pr-1` toevoegen aan ScrollArea padding

### Probleem 2: Add-to-cart knop te ver naar beneden

Op de productdetailpagina staat de volgorde nu: varianten -> voorraadstatus -> beschrijving -> add-to-cart. De gebruiker wil de add-to-cart knop direct na de varianten, zodat je niet hoeft te scrollen.

**Oplossing**: Verplaats het add-to-cart blok (regels 317-345) naar direct na de variant selector (na regel 275), voor de stock status en beschrijving.

**Bestand: `src/pages/storefront/ShopProductDetail.tsx`**

Nieuwe volgorde:
1. Categorie + titel + rating + prijs
2. Viewers count
3. Variant selector
4. Add-to-cart (quantity + knop + wishlist) -- verplaatst omhoog
5. Stock status
6. Beschrijving
7. SKU

### Technische details

```text
CartDrawer.tsx:
- Regel 40: className="flex-1 px-6" -> className="flex-1 px-6 pr-7"
- Regel 43: className="py-4 flex gap-3 overflow-hidden" -> className="py-4 flex gap-3"

ShopProductDetail.tsx:
- Regels 317-345 (add-to-cart blok) verplaatsen naar na regel 275 (na variant selector)
- Regels 347-349 (opties hint) mee verplaatsen
```


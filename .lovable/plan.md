
# Storefront Premium Upgrade: Van Basis naar Boutique-niveau

De huidige storefront werkt, maar voelt als een statisch template. Er ontbreken de **interactieve, modale ervaringen** die moderne webshops zoals Shopify, Coolblue en Zalando bieden. Dit plan upgradet de winkelervaring naar een premium niveau.

---

## Wat er nu ontbreekt (en waarom het ertoe doet)

| Huidige situatie | Probleem | Premium oplossing |
|-----------------|----------|-------------------|
| Klik op product = volledige page load | Klant verliest context, hogere bounce rate | **Quick View Modal** met variant selector en add-to-cart |
| Winkelwagen = aparte pagina | Onderbreekt het winkelproces | **Cart Drawer** (slide-in zijpaneel) |
| Zoeken = klein inputveld | Onzichtbaar, geen feedback | **Full-screen Search Modal** met live resultaten en trending producten |
| Product afbeeldingen = simpele gallery | Geen navigatie, geen swipe | **Lightbox Gallery** met pijlnavigatie en thumbnail strip |
| ProductCard hover = alleen zoom | Geen interactie mogelijk | **Hover overlay** met tweede afbeelding + Quick Add knop |
| Wishlist knop = doet niets | Gebroken feature, frustratie | **Werkende Wishlist** met localStorage + eigen pagina |
| "Toevoegen aan winkelwagen" = toast | Koud, geen dopamine | **Animated feedback** met vloeiende overgang naar cart badge |
| Announcement bar = statische tekst | Eentonig | **Carousel** met meerdere berichten die roteren |

---

## De 8 Upgrades

### 1. Quick View Modal
ProductCard krijgt een "oog" icoon bij hover. Klik opent een Dialog modal met:
- Productafbeelding (met gallery)
- Naam, prijs, korting
- Variant selector (respecteert `product_variant_style` instelling)
- Aantal selector + "Toevoegen" knop
- Link naar volledige productpagina

Dit is DE feature die conversie verhoogt -- klanten kunnen browsen en toevoegen zonder de productenpagina te verlaten.

### 2. Cart Drawer (Slide-in Zijpaneel)
Bij "Toevoegen aan winkelwagen" schuift een Sheet van rechts open met:
- Alle items in de wagen met thumbnail, naam, prijs
- Inline quantity aanpassing (+/- knoppen)
- Verwijder knop per item
- Subtotaal berekening
- "Afrekenen" knop (primary color)
- "Verder winkelen" knop (sluit drawer)

De huidige cart pagina blijft bestaan als fallback, maar de primaire flow wordt de drawer.

### 3. Full-Screen Search Modal
De zoekknop opent een full-screen overlay (of grote centered modal) met:
- Groot zoekveldinput met autofocus
- Live zoekresultaten terwijl je typt (debounced, na 2+ karakters)
- Productkaarten met thumbnail, naam en prijs in resultaten
- "Geen resultaten" state met suggesties
- ESC of klik buiten sluit

### 4. Lightbox Gallery met Navigatie
De productdetailpagina lightbox wordt een volwaardige gallery:
- Pijlknoppen links/rechts om door afbeeldingen te navigeren
- Thumbnail strip onderaan
- Keyboard navigatie (pijltjestoetsen, ESC)
- Teller "2 / 5" indicator
- Achtergrond blur/dim

### 5. ProductCard Hover Upgrade
Bij hover over een ProductCard:
- **Tweede afbeelding**: als het product meerdere images heeft, crossfade naar de tweede
- **Quick Add knop**: transparante overlay onderaan met "Toevoegen" of "Bekijk opties" (als er varianten zijn)
- **Wishlist hart**: rechtsboven een hartje dat togglet

### 6. Werkende Wishlist
Het hartje icoon dat nu al in de UI staat maar niets doet, wordt functioneel:
- localStorage-gebaseerde wishlist per tenant
- WishlistContext (zoals CartContext)
- Gevuld hart = in wishlist, leeg hart = niet
- Nieuwe pagina `/shop/{slug}/wishlist` met alle opgeslagen producten
- Badge op hartje in header met aantal items
- Route toevoegen in App.tsx

### 7. Add-to-Cart Animatie
Na het toevoegen van een product:
- De cart badge in de header springt/bounced kort (scale animatie)
- De Cart Drawer opent automatisch
- Optioneel: een subtiele "vinkje" animatie op de knop zelf (knoptekst verandert kort naar "Toegevoegd!")

### 8. Announcement Bar Carousel
Als er meerdere announcement teksten zijn (gescheiden door `|` in het tekstveld), worden ze geroteerd:
- Smooth slide-up animatie tussen berichten
- Automatische rotatie elke 4 seconden
- Enkele tekst = statisch (huidige gedrag)

---

## Technische Details per Bestand

### Nieuwe bestanden

| Bestand | Beschrijving |
|---------|-------------|
| `src/components/storefront/QuickViewModal.tsx` | Dialog modal met productdetails, variant selector, add-to-cart |
| `src/components/storefront/CartDrawer.tsx` | Sheet (rechts) met cart items, totaal en checkout link |
| `src/components/storefront/SearchModal.tsx` | Full-screen/centered zoekmodal met live resultaten |
| `src/components/storefront/ImageLightbox.tsx` | Gallery lightbox met navigatie en thumbnails |
| `src/context/WishlistContext.tsx` | Context provider voor wishlist state (localStorage) |
| `src/pages/storefront/ShopWishlist.tsx` | Wishlist pagina |

### Gewijzigde bestanden

| Bestand | Wijzigingen |
|---------|-------------|
| `src/components/storefront/ProductCard.tsx` | Hover overlay met tweede afbeelding, Quick View knop, Quick Add knop, Wishlist hart |
| `src/components/storefront/ShopLayout.tsx` | CartDrawer integratie, SearchModal integratie (vervangt inline search), Announcement carousel, Wishlist icoon in header |
| `src/pages/storefront/ShopProductDetail.tsx` | ImageLightbox verbeteren met navigatie, werkende wishlist knop, cart drawer na add-to-cart |
| `src/context/CartContext.tsx` | `isDrawerOpen` state toevoegen + `openDrawer`/`closeDrawer` functies zodat add-to-cart de drawer automatisch opent |
| `src/App.tsx` | WishlistProvider toevoegen, route voor `/shop/:tenantSlug/wishlist` |
| `src/pages/storefront/ShopProducts.tsx` | Quick View modal integratie |

### Interactie Flow

```text
Klant bezoekt homepage
    |
    v
Browst producten --> Hover over ProductCard
    |                     |
    |                     +--> Ziet tweede afbeelding + Quick Add overlay
    |                     |
    |                     +--> Klikt "Quick View" oog icoon
    |                           |
    |                           v
    |                     QuickViewModal opent
    |                     Selecteert variant + aantal
    |                     Klikt "Toevoegen"
    |                           |
    v                           v
CartDrawer schuift open <-------+
    |
    +--> Klant past aantal aan of verwijdert items
    +--> Klikt "Afrekenen" --> Checkout pagina
    +--> Klikt "Verder winkelen" --> Drawer sluit
```

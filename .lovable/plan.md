
# Storefront Admin Redesign + Ontbrekende Instellingen Fixen

## Probleem 1: Rommelige Layout

De huidige Theme-tab is een stapeling van losse componenten:
- ThemeGallery (Card) bovenaan
- ThemeCustomizer (Card) eronder, met daarin:
  - Mood Presets sectie
  - 5 sub-tabs (Branding, Kleuren, Typografie, Layout, Geavanceerd)
  - Live Preview sidebar

Dit voelt als "bij elkaar geknipt en geplakt" omdat er twee niveaus van tabs zijn (hoofd-tabs + sub-tabs), twee niveaus van Cards, en de thema-selectie los staat van de customizer.

### Nieuwe Layout: Twee-kolommen Design Studio

De Theme-tab wordt vervangen door een **split-screen layout**:

```text
+-----------------------------------------------+
| [Theme Gallery - horizontale strip met 3 kaarten] |
+-----------------------------+------------------+
| Sidebar Navigator           | Live Preview     |
| - Mood Presets (collapsed)  | (altijd zichtbaar)|
| - Branding                  |                  |
| - Kleuren                   | Desktop/Tablet/  |
| - Typografie                | Mobile toggle    |
| - Layout                    |                  |
| - Geavanceerd               |                  |
|                             |                  |
| [Opslaan] [Reset]           |                  |
+-----------------------------+------------------+
```

Kenmerken:
- ThemeGallery wordt een compacte horizontale strip bovenaan (geen aparte Card)
- Daaronder een twee-kolommen layout: links de instellingen als scrollbare accordion-secties (geen tabs!), rechts de Live Preview die altijd zichtbaar is
- Mood Presets worden een collapsible sectie bovenaan de linkerkant
- Opslaan/Reset knoppen sticky onderaan de linkerkolom
- Geen geneste tabs meer - alles is vlak en direct toegankelijk via scroll

## Probleem 2: Instellingen die NIET worden toegepast

Na grondig onderzoek zijn dit de ontbrekende implementaties:

| Instelling | Status | Fix |
|-----------|--------|-----|
| `products_per_row` | **Niet gebruikt** - ShopProducts grid is hardcoded op `grid-cols-2 md:grid-cols-3` | Dynamisch grid op basis van instelling |
| `product_card_style` | **Niet gebruikt** - ProductCard heeft geen variatie (minimal/standard/detailed) | ProductCard krijgt 3 stijlen |
| `show_wishlist` | Alleen op productdetail, **niet** op ProductCard of header | Conditie toevoegen in ShopProducts en headers |
| Header kleuren | Header gebruikt `bg-background` (Tailwind) i.p.v. thema kleuren | Thema `background_color` en `primary_color` toepassen |
| CenteredHeader/MinimalHeader | Linken naar `/cart` pagina i.p.v. CartDrawer te openen | `openDrawer` gebruiken |
| CenteredHeader/MinimalHeader | Geen wishlist icoon, geen search modal | Toevoegen |

## Technische Wijzigingen

### 1. Storefront.tsx - Theme tab layout
De Theme tab content verandert van:
```
<ThemeGallery />
<ThemeCustomizer />
```
Naar een geintegreerde "Design Studio" component.

### 2. ThemeCustomizer.tsx - Complete herstructurering
- Verwijder de Card wrapper en sub-tabs
- Maak het een scrollbare linkerkolom met accordion-secties
- ThemeGallery wordt inline bovenaan getoond (compact)
- Mood Presets als collapsible sectie
- Branding, Kleuren, Typografie, Layout, Geavanceerd als accordion items
- Live Preview altijd zichtbaar rechts (sticky)
- Sticky footer met Opslaan/Reset

### 3. ShopProducts.tsx - Grid respecteert `products_per_row`
Het hardcoded `grid-cols-2 md:grid-cols-3` wordt dynamisch:
- Leest `themeSettings.products_per_row` (2-5)
- Past grid-template-columns toe via inline style

### 4. ProductCard.tsx - Respecteert `product_card_style`
Drie stijlen:
- **minimal**: Alleen afbeelding + naam (geen prijs, geen categorie)
- **standard**: Afbeelding + naam + prijs (huidige stijl)
- **detailed**: Afbeelding + categorie + naam + prijs + korte beschrijving

ProductCard krijgt een `cardStyle` prop.

### 5. ShopProducts.tsx - `show_wishlist` conditie
De wishlist-gerelateerde props op ProductCard worden alleen doorgegeven als `themeSettings.show_wishlist` true is.

### 6. ShopLayout.tsx - Headers fixen
- CenteredHeader en MinimalHeader: cart-knop opent CartDrawer i.p.v. navigatie naar `/cart`
- CenteredHeader en MinimalHeader: wishlist icoon toevoegen (als `show_wishlist` aan)
- CenteredHeader en MinimalHeader: search modal knop toevoegen
- Header styling: thema-kleuren correct toepassen

### Overzicht gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/Storefront.tsx` | Theme tab: verwijder ThemeGallery + ThemeCustomizer, vervang door geintegreerde DesignStudio |
| `src/components/admin/storefront/ThemeCustomizer.tsx` | Complete herstructurering: split-screen met accordion-secties links, preview rechts, ThemeGallery inline bovenaan |
| `src/components/admin/storefront/ThemeGallery.tsx` | Compacte inline variant (geen Card wrapper), exporteer als herbruikbaar |
| `src/pages/storefront/ShopProducts.tsx` | Dynamisch grid op `products_per_row`, conditie `show_wishlist` |
| `src/components/storefront/ProductCard.tsx` | `cardStyle` prop met minimal/standard/detailed varianten |
| `src/components/storefront/ShopLayout.tsx` | CenteredHeader + MinimalHeader: CartDrawer, wishlist, search modal, thema-kleuren |

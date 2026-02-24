

## Fix: Mobiele bugs in de storefront (scroll, afgekapte tekst, knoppen)

### Gevonden problemen

**Bug 1: Scrollen blokkeert na tikken op een product**
In `ProductCard.tsx` wordt een hover-overlay met knoppen (Quick View, Toevoegen) getoond via `onMouseEnter`/`onMouseLeave`. Op mobiel triggert een touch-event `mouseenter` maar niet betrouwbaar `mouseleave`, waardoor de overlay "blijft hangen" en scroll-events blokkeert.

**Bug 2: Afgekapte productnamen ("Loveke Cadeaukaa...")**
De productgrid in `ShopProducts.tsx` (regel 238) gebruikt een inline `gridTemplateColumns` op basis van `products_per_row` (bv. 3) zonder responsieve breakpoints. Op mobiel worden 3 kolommen in een smal scherm geperst, waardoor kaarten te smal zijn en tekst hard wordt afgekapt.

**Bug 3: Knoppen over de afbeelding (Quick View / Toevoegen)**
De hover-overlay knoppen (Quick View + winkelwagen) verschijnen bij touch op de afbeelding en bedekken deze. Op mobiel is dit verwarrend en onbruikbaar, zoals te zien in de screenshot.

---

### Oplossingen

**1. ProductCard.tsx -- Hover overlay uitschakelen op mobiel**
- De hover-overlay met knoppen (regels 120-146) wordt alleen getoond op apparaten die hover ondersteunen (desktop)
- Op mobiel wordt de hele kaart klikbaar naar de productpagina (zoals nu), zonder overlay-knoppen
- De wishlist-knop blijft altijd zichtbaar op mobiel (geen hover nodig)
- Technisch: CSS `@media (hover: hover)` of een `touch-action` aanpak gebruiken, en de `onMouseEnter`/`onMouseLeave` alleen op non-touch apparaten activeren

**2. ShopProducts.tsx -- Responsieve grid**
- De inline `gridTemplateColumns` (regel 238) wordt vervangen door Tailwind responsive classes
- Mobiel: altijd 2 kolommen
- Tablet (md): 3 kolommen
- Desktop (lg): de geconfigureerde `products_per_row` waarde (standaard 3, max 4)
- Dezelfde fix voor de skeleton loader (regel 219)

**3. ProductCard.tsx -- Betere tekst-afhandeling op smalle kaarten**
- Productnaam: `line-clamp-2` behouden maar `break-words` toevoegen zodat lange woorden netjes afbreken
- Wishlist-knop: altijd zichtbaar op mobiel (niet alleen bij hover)

---

### Technische details

**ProductCard.tsx wijzigingen:**

```text
- Verwijder onMouseEnter/onMouseLeave (of maak ze touch-aware)
- Hover overlay: voeg "hidden md:flex" toe (verberg op mobiel, toon op desktop bij hover)
- Wishlist knop: verander "opacity-0 group-hover:opacity-100" naar "md:opacity-0 md:group-hover:opacity-100" (altijd zichtbaar op mobiel)
- Voeg "break-words" toe aan productnaam
```

**ShopProducts.tsx wijzigingen:**

```text
- Vervang inline gridTemplateColumns door Tailwind classes:
  "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-{products_per_row} gap-4 md:gap-6"
- Zelfde aanpassing voor skeleton loader grid
```

### Bestanden die worden aangepast

| Bestand | Wijziging |
|---|---|
| `src/components/storefront/ProductCard.tsx` | Hover overlay verbergen op mobiel, wishlist altijd zichtbaar, break-words |
| `src/pages/storefront/ShopProducts.tsx` | Responsieve grid met Tailwind classes i.p.v. inline style |




## POS Sneltik Layout Overnemen van De Fiere Margriet

### Probleem

Het huidige Sellqo POS-productpaneel is desktop-only: een vast linkerpaneel met zoekbalk + kleine categorie-chips + productgrid naast een fixed-width 384px cart-paneel. Op mobiel en tablet is dit compleet onbruikbaar — alles klapt over elkaar.

De Fiere Margriet heeft een bewezen POS-navigatiepatroon dat perfect werkt op alle schermformaten:

1. **Super-categorieën** → grote tik-tegels (2×3 grid) als startscherm (bijv. "Bieren 🍺", "Food 🍴")
2. **Subcategorieën** → doorklikkken naar verfijnde categorieën met terug-knop
3. **Productgrid** → items als tikbare kaarten met quantity-badge, +/- knoppen, line-clamp titels
4. **Zoeken** → apart zoekscherm met dezelfde kaart-layout
5. **Floating cart summary** → sticky balk onderaan met totaal + checkout-knop

### Plan

#### 1. Nieuw view-state systeem in POSProductPanel

Vervang de huidige flat layout door een **view-state machine** zoals De Fiere Margriet:
- `super` → Toon top-level categorieën als grote tegels (2 kolommen mobiel, 3 desktop)
- `sub` → Toon subcategorieën van geselecteerde parent
- `items` → Productgrid van geselecteerde categorie
- `search` → Zoekresultaten in dezelfde grid-layout
- `quickButtons` → Snelknoppen als aparte view (optioneel, of als tegel op het startscherm)

Elke view heeft een header met terug-knop. Navigatie is altijd: Super → Sub → Items.

#### 2. Productkaarten (touch-optimized)

Elk product wordt een tikbare kaart (min-h 100px) met:
- Productafbeelding of fallback-icoon
- Naam met `line-clamp-2` (max 2 regels, nooit overflow)
- Prijs gecentreerd onderaan
- **Quantity badge** (ronde badge rechtsboven als qty > 0)
- **+/- knoppen** linksonder op de kaart
- `active:scale-95` voor touch-feedback
- `border-2` highlight als item in cart zit

#### 3. Mobiele layout: full-screen product + floating cart

Op mobiel/tablet (`< lg` breakpoint):
- Productpaneel neemt **het hele scherm** in
- Cart-paneel wordt **verborgen** — vervangen door een **floating cart summary bar** onderaan (fixed bottom, z-50)
- Klik op de cart-bar opent een **Drawer** (vaul) van onderen met de volledige winkelwagen + betalingsknoppen
- Header wordt compacter: alleen terminalnaam + terug + essentiële knoppen

Op desktop (`≥ lg`):
- Bestaande side-by-side layout blijft werken (product links, cart rechts)

#### 4. Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `POSProductPanel.tsx` | Compleet herschrijven: view-state navigatie, tikbare kaarten, search als aparte view |
| `POSCartPanel.tsx` | Onveranderd (wordt op desktop nog steeds getoond) |
| `POSTerminal.tsx` | Responsive layout: `lg:flex` voor side-by-side, full-screen product op mobiel, floating cart bar + drawer |
| Nieuw: `POSMobileCartDrawer.tsx` | Drawer-component met cart-inhoud voor mobiel |

#### 5. Startscherm-tegels

Het startscherm toont:
- **Favorieten / Snelknoppen** als speciale tegel (bovenaan, prominent)
- **Zoeken** als tegel met zoek-icoon + dashed border
- **Top-level categorieën** als grote tegels met icoon/emoji + naam + productcount
- Grid: `grid-cols-2 sm:grid-cols-3` met `min-h-[100px]`, `rounded-xl`, `border-2`

Dit vervangt de huidige vlakke chips+placeholder aanpak door een intuïtief tikscherm dat werkt op elk apparaat.


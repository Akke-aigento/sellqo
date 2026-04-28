## Probleem

Op de `/admin/orders` pagina wordt de tabel rechts afgesneden bij viewports rond 768–1100px (tablet). De "Datum"-kolom toont alleen "D..." en de acties-knop (⋮) is niet bereikbaar.

**Oorzaken:**
1. `useIsMobile` schakelt om bij `<768px`. Vanaf 768px wordt de volledige 9-koloms tabel gerenderd, terwijl daar simpelweg geen ruimte voor is.
2. De wrapper `<div className="overflow-x-auto">` om de tabel werkt niet zichtbaar omdat de parent `<Card>` (shadcn) standaard `overflow-hidden` heeft → horizontaal scrollen onmogelijk.
3. De Tailwind responsive-prefixes op de kolommen (`hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell`) zijn te agressief: alle kolommen verschijnen al op `md` (768px) terwijl er pas vanaf ~1100px voldoende ruimte is.

## Oplossing (kaartlayout blijft zoals nu)

Ik wijzig **niets** aan de kaart of de mobiele card-view. Alleen de tabel-rendering tussen ~768px en ~1100px wordt repareert zodat alles past of netjes scrollt.

### Wijzigingen in `src/pages/admin/Orders.tsx`

1. **Card horizontaal laten scrollen indien nodig**  
   Zet `overflow-hidden` op de `<Card>` om naar `overflow-x-auto` (of voeg een wrapper toe), zodat de bestaande `overflow-x-auto` op de tabel-wrapper daadwerkelijk werkt als laatste vangnet.

2. **Kolom-breakpoints opschuiven** zodat ze pas verschijnen wanneer er ruimte is:
   - `Bron`: `hidden lg:table-cell` → `hidden xl:table-cell`
   - `Betaling`: `hidden md:table-cell` → `hidden lg:table-cell`
   - `Datum`: `hidden sm:table-cell` → `hidden xl:table-cell`
   
   Resultaat bij ~840px (tablet): checkbox, Bestelling, Klant, Status, Totaal, ⋮ → past comfortabel zonder afsnijden.

3. **Klein veiligheidsnet**: `min-w-0` op de tabel-cellen die lange tekst kunnen bevatten (klant-email staat al getrunceerd, dus alleen verifiëren).

### Geen wijzigingen
- `MobileOrderCard` blijft identiek.
- De Card-styling, header, filter-rij blijven zoals ze zijn.
- `useIsMobile` breakpoint blijft 768px.

## Verificatie

Browser openen op de bestellingen-pagina bij viewport 839×620 (huidige situatie van de gebruiker) en checken:
- Geen afgeknipte kolomkop meer ("D..." weg)
- ⋮ acties-knop zichtbaar en klikbaar
- Tabel toont logische subset: Bestelling / Klant / Status / Totaal / acties
- Bij desktop (>1280px) verschijnen Bron / Betaling / Datum weer

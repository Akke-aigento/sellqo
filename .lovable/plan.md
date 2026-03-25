

## Fix: ScrollArea in SEO Preview Dialog

Het probleem is dat `ScrollArea` geen expliciete hoogte krijgt. De `flex-1` class werkt alleen als de parent een vaste hoogte heeft met `overflow: hidden`. De `DialogContent` heeft `max-h-[85vh]` maar mist `overflow-hidden`, waardoor de ScrollArea niet weet hoeveel ruimte beschikbaar is en dus niet scrollt.

### Aanpassing in `src/components/admin/seo/SEOPreviewDialog.tsx`

1. Voeg `overflow-hidden` toe aan `DialogContent` (regel 80) zodat flex-1 correct werkt
2. Geef de `ScrollArea` een expliciete `max-h` als fallback, bijv. `max-h-[calc(85vh-12rem)]` (85vh minus header + footer ruimte)
3. Voeg `min-h-0` toe aan de ScrollArea voor correcte flex-shrink

Dit is een 1-bestand fix, puur CSS classes.


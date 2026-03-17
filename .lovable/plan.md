

## Probleem

De `Table` component wrapper heeft `overflow-hidden` — dit knipt de rechterkolom (Acties) af zodat de knoppen onzichtbaar en onbereikbaar zijn. De stats header is er wel maar verschijnt pas na data-load.

## Oplossing

### 1. Table component fixen: `overflow-hidden` → `overflow-auto`
In `src/components/ui/table.tsx` regel 7: verander `overflow-hidden` naar `overflow-auto`. Dit maakt de tabel horizontaal scrollbaar wanneer kolommen niet passen, zodat de Acties-kolom bereikbaar wordt.

### 2. Fulfillment tabel compacter maken
De tabel heeft te veel kolommen voor het scherm. Aanpassingen in `Fulfillment.tsx`:
- **Tracking kolom verbergen** onder `lg:` breakpoint (ipv `md:`) — die info is toch in het detail-sheet
- **Acties kolom compacter**: gebruik een enkele `DropdownMenu` knop (⋮) met daarin alle acties (status toggle, pakbon, tracking, details) in plaats van 4-5 losse knoppen naast elkaar
- **Rij klikbaar maken**: hele rij opent het detail-sheet (net als mobile), actieknoppen zijn extra

### 3. Resultaat
- Tabel past op 1013px zonder horizontaal scrollen
- Alle acties bereikbaar via compact dropdown menu per rij
- Klikbare rijen voor snel detail-sheet openen
- Stats header blijft bovenaan (werkt al, laadt async)


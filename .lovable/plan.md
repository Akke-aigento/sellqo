

## Bulk actiebalk floatend onderaan maken

### Probleem
De bulk-actiebalk staat nu vast boven de tabel (regel 497-525). Bij 1000+ producten scrollt de gebruiker naar beneden en ziet de balk niet meer — moet helemaal terug scrollen om een actie uit te voeren.

### Oplossing
De balk wordt een floating bar onderaan het scherm (sticky/fixed bottom), vergelijkbaar met hoe `AdminBottomNav` werkt maar dan voor desktop+mobiel.

### Wijzigingen

**`src/pages/admin/Products.tsx`** (regel 497-525)

1. Verplaats de bulk-actiebalk van inline naar een `fixed bottom-0` positie:
   - `fixed bottom-0 left-0 right-0 z-40` (onder modals maar boven content)
   - Op desktop: `lg:left-[var(--sidebar-width)]` zodat hij niet over de sidebar valt
   - Styling: `bg-background border-t shadow-lg` voor duidelijke scheiding
   - `animate-in slide-in-from-bottom` voor subtiele entrance animatie
   - Padding-bottom: `pb-[env(safe-area-inset-bottom)]` voor iOS

2. Content-padding toevoegen aan de productlijst wanneer de balk zichtbaar is, zodat laatste rijen niet achter de balk verdwijnen (`pb-20` op de tabel-container wanneer `selectedIds.size > 0`)

3. Op mobiel: de `AdminBottomNav` bulk-mode wordt al getriggerd via `BulkSelectionContext` — die balk verbergen wanneer desktop-balk actief is (of vice versa, afhankelijk van breakpoint)

### Bestanden
- `src/pages/admin/Products.tsx` — balk repositioneren + padding toevoegen




## Floating Actieknoppen bij Product Bewerken

### Wat nu
De "Annuleren" en "Opslaan" knoppen staan statisch in de header (regel 507-524). Ze zijn altijd zichtbaar, ook als er geen wijzigingen zijn.

### Wat we bouwen
Zodra het formulier "dirty" is (wijzigingen gedetecteerd), verschijnt een floating actiebalk onderaan het scherm — consistent met het bestaande patroon van bulk-actiebalken (orders, producten).

### Aanpak (1 bestand)

**`src/pages/admin/ProductForm.tsx`**:

1. Haal `formState.isDirty` uit het `form` object (react-hook-form biedt dit standaard)
2. Verwijder de "Annuleren" en "Opslaan" knoppen uit de statische header (regels 507-524)
3. Voeg onderaan de pagina een floating bar toe die alleen verschijnt als `isDirty === true`:
   - `fixed bottom-0 left-0 right-0 z-40 lg:left-[var(--sidebar-width)]`
   - Slide-in animatie (bestaand patroon)
   - "Annuleren" knop (reset form) + "Opslaan" knop
   - Toon indicator "Onopgeslagen wijzigingen"
4. Voeg `pb-20` padding toe aan de main container wanneer `isDirty` zodat content niet afgedekt wordt

### Visueel resultaat
- Geen wijzigingen → geen balk, schone header
- Wijziging gemaakt → floating balk glijdt omhoog met "Onopgeslagen wijzigingen • Annuleren | Opslaan"



## Fixplan: Bundel-wijzigingen moeten ook als “unsaved product changes” tellen

### Probleem
Bij product bewerken worden wijzigingen in **bundelinhoud** (`bundleItems`) niet gezien door `form.formState.isDirty`, omdat die state buiten React Hook Form staat.  
Gevolg: geen floating opslaabalk, dus gebruiker kan bundelwijzigingen niet opslaan.

### Root cause
In `ProductForm.tsx` wordt de floating actiebalk + bottom padding alleen getoond op:
- `form.formState.isDirty`

Maar bundelacties (toevoegen/verwijderen/aantal/verplicht) updaten enkel:
- `bundleItems` via `setBundleItems(...)`

### Implementatie-aanpak

1. **Voeg aparte dirty-detectie toe voor bundelitems**
   - In `src/pages/admin/ProductForm.tsx`:
     - `initialBundleItems` state toevoegen (snapshot van geladen bundelitems)
     - `isBundleItemsDirty` berekenen via vergelijking `bundleItems` vs `initialBundleItems` (bijv. JSON signature)
     - `hasUnsavedChanges = form.formState.isDirty || isBundleItemsDirty`

2. **Gebruik gecombineerde dirty flag overal voor de floating save UX**
   - Vervang voorwaarden:
     - container padding: `form.formState.isDirty` → `hasUnsavedChanges`
     - floating action bar: `form.formState.isDirty` → `hasUnsavedChanges`

3. **Zorg dat “Annuleren” ook bundelwijzigingen reset**
   - Huidig: `form.reset()`  
   - Nieuw: `form.reset()` + `setBundleItems(initialBundleItems)`  
   Zo worden bundelwijzigingen ook echt teruggedraaid.

4. **Initialisatie/snapshot correct zetten bij edit**
   - In bestaande load-effect voor bundels:
     - na ophalen van `bundle_products` zowel `bundleItems` als `initialBundleItems` vullen
     - ook expliciet `[]` zetten als geen records, zodat dirty check stabiel blijft

### Bestanden
- `src/pages/admin/ProductForm.tsx` (enkel dit bestand)

### Verwacht resultaat
- Wijzig je bundelinhoud (items, qty, verplicht): **floating opslaabalk verschijnt meteen**
- Klik op **Opslaan**: bundelwijzigingen worden opgeslagen via bestaande submit-flow
- Klik op **Annuleren**: formulier én bundelinhoud gaan terug naar laatst geladen staat

### Technische details
- Geen databasewijziging nodig
- Geen aanpassing nodig in `BundleProductsSection.tsx` of backend
- Fix is puur state/dirty-detectie in ProductForm, zodat bundelwijzigingen als volwaardige productwijzigingen behandeld worden

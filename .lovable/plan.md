

## Fix: Grid/lijst direct updaten na bulk bewerking

### Probleem
Na sluiten van de bulk-modal blijft de productlijst stale. `handleBulkEdit` roept geen `refetch()` aan op de products query — pas bij page refresh worden wijzigingen zichtbaar.

### Fix

**`src/pages/admin/Products.tsx`**

1. **`refetch` destructuren uit `useProducts()`** — staat al in de hook maar wordt niet opgehaald (regel 75-85).

2. **Na succesvolle bulk edit `refetch()` aanroepen** — op regel 349 (na de success toast), `await refetch()` toevoegen. Dit herlaadt de products query inclusief de category join, waardoor zowel lijst als grid meteen actuele data tonen.

3. **`refreshProductCategoryMap` wordt al aangeroepen** maar hangt af van `products` state — door `refetch()` toe te voegen triggert de `useEffect` op `[products]` automatisch een map-refresh.

### Concrete wijzigingen
- Regel 85: `refetch` toevoegen aan destructuring
- Regel 349: `await refetch()` na success toast, vóór `setSelectedIds` reset

### Bestanden
- `src/pages/admin/Products.tsx`


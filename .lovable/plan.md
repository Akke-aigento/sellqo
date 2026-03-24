

## Fix: Bulk bewerker wijzigingen worden niet opgeslagen

### Diagnose

Na grondige analyse van de code zijn er **twee problemen** gevonden:

1. **Geen error handling in `handleBulkEdit`** — De functie roept meerdere mutaties sequentieel aan met `await`. Als de eerste mutatie faalt (bijv. `bulkAdjustPrices`), stopt de hele functie en worden **alle volgende mutaties overgeslagen** — zonder duidelijke foutmelding. De dialog toont kort "Bezig..." en stopt dan zonder feedback.

2. **`handleApply` in de dialog heeft geen `catch`** — Als `onApply` een error gooit, wordt de error niet afgevangen door de dialog. De dialog blijft open maar de gebruiker ziet geen duidelijke melding wat er fout ging.

3. **Mogelijke stille fouten bij categorie-updates** — De categorie bulk-update gebruikt `(supabase as any).from('product_categories')` wat type-checking omzeilt. Als de upsert of delete faalt, wordt de error niet getoond.

### Fix

**`src/pages/admin/Products.tsx` — `handleBulkEdit` robuust maken**

- Wrap elke mutatie-groep in een individuele try/catch
- Bijhoud hoeveel operaties slaagden vs faalden
- Toon een samenvattende toast aan het einde ("X van Y operaties geslaagd")
- Als alles slaagt: sluit dialog + clear selectie
- Als iets faalt: toon foutmelding maar voer resterende operaties WEL uit

**`src/components/admin/products/ProductBulkEditDialog.tsx` — error handling toevoegen**

- Voeg een `catch` block toe aan `handleApply`
- Toon een toast bij errors zodat de gebruiker weet wat er misging
- Dialog NIET sluiten bij fouten

### Technisch

```text
handleBulkEdit flow (nu):
  mutatie 1 → FAIL → STOP (rest wordt overgeslagen, geen feedback)

handleBulkEdit flow (nieuw):
  mutatie 1 → FAIL → log error, ga door
  mutatie 2 → OK → log success, ga door
  ...
  einde → toon "2 van 3 operaties geslaagd" of "Alle wijzigingen opgeslagen"
```

### Bestanden
- `src/pages/admin/Products.tsx` — `handleBulkEdit` met per-operatie error handling
- `src/components/admin/products/ProductBulkEditDialog.tsx` — catch block + foutfeedback


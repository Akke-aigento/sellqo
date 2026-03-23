

## "Meer" knop met drop-up menu in bulk-actiebalk

### Wat
De laatste knop in de bulk-actiebalk ("Annuleer") vervangen door een "Meer" knop die een drop-up menu opent met alle beschikbare acties — inclusief minder gebruikte opties zoals verwijderen, printen, etc.

### Aanpak

**`src/contexts/BulkSelectionContext.tsx`**:
- `BulkAction` interface uitbreiden met optioneel `primary?: boolean` veld om onderscheid te maken tussen primaire (direct in balk) en secundaire (in "Meer" menu) acties.

**`src/components/admin/AdminBottomNav.tsx`**:
- Bulk acties splitsen: acties met `primary: true` direct tonen, de rest achter een "Meer" knop met `DropdownMenu` (richting omhoog via `side="top"`)
- "Meer" knop krijgt hetzelfde icon-over-label patroon: `MoreHorizontal` icon + "Meer" label
- DropdownMenu items tonen icon + label horizontaal

**`src/pages/admin/Orders.tsx`**:
- De eerste 2 acties (Verzonden, Afgeleverd) markeren als `primary: true`
- Overige acties (Annuleer, Verwijderen, evt. Printen) worden secundair en verschijnen in het "Meer" menu

### Layout

```text
Footer bij selectie:
[ ✕ 2 ]  [ 📦 Verzonden ]  [ ✓ Afgeleverd ]  [ ··· Meer ▲ ]

Drop-up menu bij "Meer":
┌─────────────────┐
│ ⊘ Annuleren     │
│ 🗑 Verwijderen   │
└─────────────────┘
```

### Bestanden
- `src/contexts/BulkSelectionContext.tsx` — `primary` veld toevoegen aan `BulkAction`
- `src/components/admin/AdminBottomNav.tsx` — split primary/secondary + DropdownMenu drop-up
- `src/pages/admin/Orders.tsx` — acties taggen met `primary: true/false`


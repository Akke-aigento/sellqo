

## Orders bulk-actiebalk → floating bottom bar

### Probleem
Exact hetzelfde als bij producten: de bulk-balk staat inline boven de tabel (regel 166-171 in `Orders.tsx`). Bij 100+ orders scrollt de gebruiker weg en ziet de balk niet meer.

### Oplossing
Dezelfde aanpak als de producten floating bar.

### Wijzigingen

**`src/components/admin/OrderBulkActions.tsx`** (regel 236-325)
- De wrapper `div` veranderen van inline `p-3 bg-muted rounded-lg border` naar:
  - `fixed bottom-0 left-0 right-0 z-40 lg:left-[var(--sidebar-width)]`
  - `bg-background/95 backdrop-blur-sm border-t shadow-lg`
  - `p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`
  - `animate-in slide-in-from-bottom-2 duration-200`
- Op mobiel (`lg:hidden`): balk verbergen — wordt afgehandeld door `AdminBottomNav` via het bestaande `BulkSelectionContext`

**`src/pages/admin/Orders.tsx`** (rond regel 173-174)
- `pb-20` toevoegen aan de Card/tabel-container wanneer `selectedOrderIds.length > 0`, zodat onderste rijen niet achter de floating bar verdwijnen

### Bestanden
- `src/components/admin/OrderBulkActions.tsx`
- `src/pages/admin/Orders.tsx`


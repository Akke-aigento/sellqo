

## Plan: Orders Bulk Selectie op Mobiel + Live Status Update + Dynamische Footer

### Drie problemen gevonden

1. **Mobiele kaartweergave heeft geen selectie** — De desktop tabel heeft checkboxes, maar de compacte kaartweergave (mobiel) mist ze volledig. Je kunt op mobiel geen orders selecteren voor bulk acties.

2. **Status update zonder visuele feedback** — Op de OrderDetail pagina wordt `updateOrderStatus` aangeroepen, die query key `['orders']` invalidated. Maar de detail pagina gebruikt query key `['order', orderId]`. Resultaat: de Select dropdown springt terug naar de oude waarde totdat je handmatig refresht.

3. **Dynamische bottom nav bij selectie** — Jouw idee: wanneer orders geselecteerd zijn op mobiel, transformeer de vaste footer naar een actiebalk met bulk-opties (status wijzigen, verwijderen, etc).

### Aanpak

#### 1. Checkboxes toevoegen aan mobiele kaartweergave
In `src/pages/admin/Orders.tsx`, de compacte card view uitbreiden met:
- Een checkbox links in elke kaart
- Long-press of tap op checkbox om te selecteren
- "Alles selecteren" optie bovenaan wanneer in selectie-modus

#### 2. Fix: Query key invalidatie op OrderDetail
In `src/hooks/useOrders.ts`, de `onSuccess` callbacks van `updateOrderStatus` en `updatePaymentStatus` uitbreiden:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order'] }); // <-- toevoegen
}
```
Dit zorgt ervoor dat de detail pagina direct de nieuwe status toont.

#### 3. Dynamische AdminBottomNav bij selectie
In `src/components/admin/AdminBottomNav.tsx`:
- Accepteer optionele props: `selectionCount`, `onBulkAction`, `bulkActions`
- Wanneer `selectionCount > 0`: toon een actiebalk in plaats van navigatie (bijv. "3 geselecteerd" + knoppen voor Status, Verwijderen, Deselecteer)
- Animeer de transitie tussen navigatie en actiemodus
- Dit wordt aangestuurd vanuit de Orders pagina via een context/callback pattern

Concreet:
- Maak een `BulkSelectionContext` die de AdminBottomNav kan lezen
- Orders pagina vult deze context wanneer items geselecteerd zijn
- AdminBottomNav rendert bulk acties in plaats van navigatie links wanneer selectie actief is

### Bestanden

- `src/hooks/useOrders.ts` — query invalidation fix
- `src/pages/admin/Orders.tsx` — checkboxes in compacte weergave + context provider
- `src/components/admin/AdminBottomNav.tsx` — dynamische modus
- `src/contexts/BulkSelectionContext.tsx` — nieuw: gedeelde selectie-state tussen pagina en footer


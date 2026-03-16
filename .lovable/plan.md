

## Plan: Dedicated Kassaweergave + Mobiele Checkout Fix

### Probleem 1: Geen dedicated kassaweergave
Het POS-scherm draait nu binnen `AdminLayout` (sidebar, header, trial banner, AI widget). Op een tablet aan de kassa is dat allemaal overbodige rompslomp. Kassabedienden willen alleen de kassa zien.

### Probleem 2: Bestelling afwerken onmogelijk op mobiel/tablet
De floating cart bar gebruikt `sticky bottom-0` maar zit genest in een `overflow-hidden` flex-container met `AdminLayout`'s `<main>` padding eromheen. Hierdoor wordt de bar niet correct gepositioneerd of is deze niet zichtbaar/bereikbaar.

---

### Oplossing

#### 1. Dedicated kassa-route (buiten AdminLayout)
- Nieuwe route: `/kassa/:terminalId` — **buiten** de `<AdminLayout>` wrapper, maar **binnen** `<ProtectedRoute>` + `<TenantProvider>`
- Hergebruikt exact dezelfde `POSTerminalPage` component, maar zonder sidebar/header/banner
- De bestaande `/admin/pos/:terminalId` route blijft bestaan voor admin-toegang
- Op de POS-pagina (`/admin/pos`) een "Open kassaweergave" knop toevoegen die naar `/kassa/:terminalId` navigeert (opent in een nieuw tabblad, of fullscreen)

#### 2. POSTerminal.tsx aanpassen voor standalone modus
- Detecteer of de pagina binnen AdminLayout draait (via route-prefix check of een prop)
- Wanneer standalone (`/kassa/...`):
  - Header toont een vergrendelicoon i.p.v. terug-knop (of terug naar kassa-selectie)
  - Geen navigatie naar admin-pagina's
  - Optioneel: fullscreen API activeren
- Wanneer admin (`/admin/pos/...`): huidige gedrag behouden

#### 3. Fix floating cart bar op mobiel
- Verander `sticky bottom-0` naar `fixed bottom-0 left-0 right-0` op de cart bar
- Voeg `pb-[60px]` padding-bottom toe aan de product panel container zodat content niet achter de bar verdwijnt
- Zorg dat de `POSMobileCartDrawer` correct opent boven de fixed bar

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/App.tsx` | Nieuwe route `/kassa/:terminalId` buiten AdminLayout |
| `src/pages/admin/POSTerminal.tsx` | Standalone modus detectie, fix floating cart `fixed` ipv `sticky` |
| `src/pages/admin/POS.tsx` | "Open kassaweergave" knop per terminal |


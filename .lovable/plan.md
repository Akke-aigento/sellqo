

## Herstel: Floating actiebalk onderaan op mobiel + desktop

### Probleem

De floating bulk-actiebalk onderaan het scherm (`fixed bottom-0`) was eerder geïmplementeerd voor Products en Orders (rond 24 maart), maar is verloren gegaan bij latere edits. Nu zijn alle bulk-actiebalken weer inline `bg-muted rounded-lg` divs die op mobiel buiten beeld vallen bij scrollen.

### Pagina's die aangepast moeten worden

| Pagina | Bulk-component | Huidige stijl |
|---|---|---|
| Products.tsx | Inline div (regel 390-418) | `rounded-lg border bg-muted/50 p-3` |
| Orders.tsx | `OrderBulkActions` (regel 236) | `p-3 bg-muted rounded-lg border` |
| Fulfillment.tsx | `FulfillmentBulkActions` | Inline |
| Categories.tsx | `CategoryBulkActions` | Inline |

### Aanpak

**1. Products.tsx** — Bulk-actiebalk naar `fixed bottom-0`
- Wrapper: `fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg animate-in slide-in-from-bottom-2`
- Desktop offset: `lg:left-[var(--sidebar-width,280px)]`
- Content padding: `pb-20` op de grid/tabel container wanneer `selectedIds.size > 0`
- "Deselecteer" knop toevoegen

**2. OrderBulkActions.tsx** — Zelfde floating patroon
- Wrapper van `p-3 bg-muted rounded-lg border` → `fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg`
- Desktop offset voor sidebar
- Content padding in Orders.tsx

**3. FulfillmentBulkActions + CategoryBulkActions** — Zelfde patroon toepassen als ze inline zijn

**4. Customers.tsx** — Heeft momenteel geen bulk-selectie, hoeft niet

### Visueel

```text
┌─────────────────────────────┐
│  Sidebar  │   Content       │
│           │                 │
│           │   (scroll)      │
│           │                 │
│           ├─────────────────┤
│           │ ■ 5 geselecteerd│
│           │ [Acties] [X]    │
└───────────┴─────────────────┘
  ↑ fixed bottom-0, offset sidebar
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Products.tsx` | Bulk bar → fixed bottom + pb-20 |
| `src/components/admin/OrderBulkActions.tsx` | Wrapper → fixed bottom |
| `src/pages/admin/Orders.tsx` | Content pb-20 wanneer selectie actief |
| `src/components/admin/FulfillmentBulkActions.tsx` | Wrapper → fixed bottom |
| `src/pages/admin/Fulfillment.tsx` | Content pb-20 |
| `src/components/admin/CategoryBulkActions.tsx` | Wrapper → fixed bottom |
| `src/pages/admin/Categories.tsx` | Content pb-20 |

### Geen database wijzigingen nodig


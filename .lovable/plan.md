

## Drie aanpassingen: Help-widget, Inbox badge, Order acties-pijl

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/help/AIHelpWidget.tsx` | Knop naar boven verplaatsen (boven bottom nav), minimaliseerbaar maken met localStorage |
| `src/components/admin/AdminMobileBottomNav.tsx` | Inbox badge: cijfer vervangen door rood bolletje |
| `src/components/admin/OrderBulkActions.tsx` | ChevronDown → ChevronUp, dropdown opent naar boven, bar boven bottom nav |

### Detail

**1. AIHelpWidget.tsx**
- Positie: `bottom-20 md:bottom-4 right-4` (boven de mobile bottom nav)
- Nieuwe state `isMinimized` met `localStorage.getItem('ai-help-minimized')` — default `false` (eerste keer open/zichtbaar)
- Als geminimaliseerd: toon een klein rond icoontje (kleiner, subtiel) dat je kunt aanklikken om te openen
- Na eerste interactie (sluiten): sla `'true'` op in localStorage zodat hij bij volgende loads geminimaliseerd start
- Chat window positie ook aanpassen voor mobiel: `bottom-20 md:bottom-20`

**2. AdminMobileBottomNav.tsx — Inbox badge**
- Verwijder het cijfer uit de badge
- Toon alleen een klein rood bolletje (`h-2.5 w-2.5`) zonder tekst als `count > 0`
- Positie: rechtsboven op het icoon (`absolute -top-1 -right-1`)

**3. OrderBulkActions.tsx — Acties dropdown**
- `ChevronDown` → `ChevronUp` import en gebruik
- `DropdownMenuContent`: voeg `side="top"` toe zodat het menu naar boven opent
- Bar positie: `bottom-14 md:bottom-0` (boven mobile bottom nav, consistent met FloatingSaveBar)


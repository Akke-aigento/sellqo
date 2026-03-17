

## Plan: Sidebar Logo Sluit Mobiel + Header Logo Gecentreerd

### 1. Sidebar logo sluit mobiel bij klik
In `AdminSidebar.tsx` — de `<Link>` rond het Sellqo logo (regel 195-200) krijgt een `onClick={closeMobile}` handler, zodat klikken op het logo de sidebar sheet sluit op mobiel.

### 2. Header logo + winkelnaam centreren
In `AdminHeader.tsx` — de mobiele `<Link>` met logo + winkelnaam (regel 39-46) verplaatsen naar het midden van de header met `absolute left-1/2 -translate-x-1/2` positionering zodat het gecentreerd staat tussen de linker-knoppen en rechter-iconen.

### Bestanden

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/components/admin/AdminSidebar.tsx` — `onClick={closeMobile}` op logo Link |
| Wijzig | `src/components/admin/AdminHeader.tsx` — centreer logo+naam met absolute positioning |




## Categorie status toggle via badge-klik

### Wat wordt er gebouwd

De "Online" / "Inactief" / "Alleen winkel" badge op elke categorie-rij wordt klikbaar. Klikken cyclet door de statussen: **Online → Alleen winkel → Inactief → Online**.

### Aanpak

**`src/components/admin/CategoryTreeItem.tsx`**

1. Voeg `onToggleStatus` callback toe aan de props interface
2. Maak de drie Badge-elementen (regels 192-205) klikbaar met `onClick` + `cursor-pointer`
3. Bij klik: cycle naar volgende status en roep `onToggleStatus(category.id, nextStatus)` aan
   - Online (`is_active=true, hide_from_storefront=false`) → klik → Alleen winkel (`is_active=true, hide_from_storefront=true`)
   - Alleen winkel → klik → Inactief (`is_active=false, hide_from_storefront=false`)
   - Inactief → klik → Online
4. `e.stopPropagation()` om drag/expand niet te triggeren

**`src/pages/admin/Categories.tsx`**

1. Geef `onToggleStatus` door aan `CategoryTreeItem`
2. De handler roept `updateCategory.mutate({ id, data: { is_active, hide_from_storefront } })` aan

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/CategoryTreeItem.tsx` | Badge klikbaar maken met status-cycle |
| `src/pages/admin/Categories.tsx` | `onToggleStatus` handler doorgeven |

### Geen database wijzigingen nodig


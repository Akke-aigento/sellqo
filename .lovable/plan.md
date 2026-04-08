

## Fix: Inbox link 404 + Return Home route

### Probleem 1: Inbox → 404
De bottom nav linkt naar `/admin/inbox` (regel 18), maar de route is `/admin/messages` (App.tsx regel 162).

### Probleem 2: Return Home → marketingpagina
De 404/NotFound pagina linkt waarschijnlijk naar `/` wat de storefront/marketingpagina is. Vanuit admin context zou "Return Home" naar `/admin` moeten gaan.

### Wijzigingen

| Bestand | Fix |
|---------|-----|
| `src/components/admin/AdminMobileBottomNav.tsx` | Regel 18: `/admin/inbox` → `/admin/messages` |

Eén regel, klaar.


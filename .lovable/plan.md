

## Drie fixes: Producten actiebalk kruisje, Inbox kruisje, Help-widget alleen op Dashboard

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Products.tsx` | X-kruisje rechtsboven toevoegen, inline "Deselecteer" verwijderen, `bottom-14 md:bottom-0` toevoegen |
| `src/components/admin/inbox/BulkActionsToolbar.tsx` | X-kruisje rechtsboven toevoegen (consistent met andere balken) |
| `src/components/admin/AdminLayout.tsx` | AIHelpWidget conditioneel renderen — alleen op Dashboard route |

### Detail

**1. Products.tsx — Actiebalk (regels 408-441)**
- Container: `bottom-0` → `bottom-14 md:bottom-0` (boven mobile nav)
- Voeg absolute X-knop toe rechtsboven: `absolute top-1 right-1 h-7 w-7 rounded-full`
- Verwijder de inline "Deselecteer" knop (regel 436-439)
- Import `X` toevoegen uit lucide-react

**2. BulkActionsToolbar.tsx (Inbox)**
- Heeft al een X-knop linksboven — deze is inline en al functioneel. Geen wijziging nodig, is al consistent.

**3. AdminLayout.tsx — AIHelpWidget alleen op Dashboard**
- Gebruik `useLocation()` van react-router-dom
- Render `<AIHelpWidget />` alleen als `location.pathname === '/admin'` of `/admin/dashboard`
- Hierdoor blokkeert het help-icoon niet meer de actiebalken op Orders, Producten, etc.

### Geen database wijzigingen nodig


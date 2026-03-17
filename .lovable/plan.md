

## Plan: 6 Bugfixes — Mobiel UX Verbeteringen

### 1. POS fullscreen sluiten op mobiel
**Probleem:** Op standalone `/kassa/` route is er geen back-button (`!standalone` check verbergt hem). In fullscreen is er geen manier om terug te gaan.
**Fix:** In `POSTerminal.tsx` — wanneer `standalone && isFullscreen`, toon de fullscreen-verlaat knop altijd prominent. Wanneer `standalone && !isFullscreen`, voeg een "Terug naar admin" knop toe.

### 2. Sidebar auto-sluiten bij klik
**Probleem:** Op mobiel opent de sidebar als Sheet, maar sluit niet automatisch bij navigatie.
**Fix:** In `AdminSidebar.tsx` — gebruik `useSidebar()` om `setOpenMobile(false)` aan te roepen bij elke `NavLink` klik. Wrap de renderNavItem links met een onClick handler.

### 3. Orders tabel layout op breed mobiel
**Probleem:** De Orders tabel zit in een `<div>` zonder `overflow-x-auto`, waardoor brede tabellen uit het scherm lopen.
**Fix:** In `Orders.tsx` — voeg `overflow-x-auto` toe aan de tabel-wrapper div en een `min-w-[600px]` op de tabel zelf, consistent met het patroon in andere pagina's (Customers, Shipping, etc.).

### 4. Terug-pijl navigeert naar parent in plaats van history
**Probleem:** `navigate(-1)` gedraagt zich onvoorspelbaar (gaat soms naar externe pagina's of loopt vast).
**Fix:** In `AdminHeader.tsx` — vervang `navigate(-1)` door `navigate('/admin')` zodat de terug-knop altijd naar het dashboard gaat. Dit is voorspelbaarder en logischer.

### 5. Logo + winkelnaam klikbaar als home-link
**Probleem:** Alleen het kleine logo-icoon is klikbaar, geen hover-feedback, en winkelnaam is niet klikbaar.
**Fix:** In `AdminHeader.tsx` — combineer logo en winkelnaam in één `<Link to="/admin">` met `active:scale-95` feedback voor een "klik-gevoel".

### 6. App-refresh gevoel verminderen (PWA optimalisatie)
**Probleem:** Bij terugkeren naar de app (tab-switch, app-switch) doet de browser een visuele refresh.
**Fix:** Twee dingen:
- `index.html`: voeg `background-color` toe aan het body element zodat er geen witte flash is
- `index.css`: voeg een `body` achtergrondkleur toe die matcht met de app-achtergrond, zodat de overgang vloeiend is
- Voeg `<meta name="mobile-web-app-capable" content="yes">` toe voor Android PWA

### Bestanden

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/pages/admin/POSTerminal.tsx` — fullscreen exit op standalone |
| Wijzig | `src/components/admin/AdminSidebar.tsx` — auto-close bij nav-klik |
| Wijzig | `src/pages/admin/Orders.tsx` — overflow-x-auto wrapper |
| Wijzig | `src/components/admin/AdminHeader.tsx` — terug-knop + logo+naam klikbaar |
| Wijzig | `index.html` — PWA meta + body bg |
| Wijzig | `src/index.css` — body achtergrondkleur |


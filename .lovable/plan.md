

## Admin Mobile Bottom Navigation Bar

### Probleem
Op mobiel verdwijnt de sidebar achter een hamburgermenu. Er is geen snelle navigatiebalk onderaan het scherm — gebruikers moeten altijd het menu openen om te navigeren. De storefront heeft al een `MobileBottomNav`, maar het admin panel mist dit volledig.

### Oplossing
Een vaste bottom navigation bar voor het admin panel op mobiel (md:hidden), met de 4-5 meest gebruikte secties als snelkoppeling.

### Navigatie-items (5 tabs)

| Tab | Icoon | Route |
|-----|-------|-------|
| Dashboard | LayoutDashboard | /admin |
| Bestellingen | ShoppingCart | /admin/orders |
| Producten | Package | /admin/products |
| Inbox | MessageSquare | /admin/inbox (met unread badge) |
| Menu | Menu (hamburger) | Opent de sidebar |

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/AdminMobileBottomNav.tsx` | **Nieuw** — Bottom nav component met 5 tabs, active state highlighting, inbox badge |
| `src/components/admin/AdminLayout.tsx` | Import + render `AdminMobileBottomNav`, padding-bottom toevoegen aan main voor mobiel |

### Detail

**AdminMobileBottomNav.tsx**
- `fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden`
- 5 tabs: Dashboard, Bestellingen, Producten, Inbox, Menu
- Active state via `useLocation()` met `text-primary` highlight
- Inbox tab toont unread count badge (hergebruik bestaande unread query of InboxBadge logica)
- "Menu" tab triggert `useSidebar().toggleSidebar()` om de sidebar te openen
- Hoogte: `h-14` (consistent met storefront bottom nav)

**AdminLayout.tsx**
- `<main>` krijgt `pb-16 md:pb-0` zodat content niet achter de nav verdwijnt
- `<AdminMobileBottomNav />` renderen na de main content div
- FloatingSaveBar en andere fixed-bottom elementen moeten `bottom-14 md:bottom-0` krijgen op mobiel (of z-index regeling)

### Aandachtspunten
- FloatingSaveBar, BulkActions bars etc. zitten ook `fixed bottom-0` — deze moeten `bottom-14` krijgen op mobiel zodat ze boven de nav bar verschijnen. Dit doen we via een kleine CSS class aanpassing in AdminMobileBottomNav die een CSS variable set, of we passen de bestaande bars aan met `md:bottom-0 bottom-14`.


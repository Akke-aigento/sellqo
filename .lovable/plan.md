

## Plan: Mobile Bottom Navigation Bar + Responsiviteitsverbeteringen

### Wat we gaan doen

Een vaste navigatiebalk onderaan het scherm toevoegen voor de admin-app op mobiel/tablet (< 1024px). Dit geeft een echt "app-gevoel" — precies zoals de storefront al heeft met `MobileBottomNav`. De sidebar blijft beschikbaar via het hamburger-menu, maar de meest gebruikte secties zijn direct bereikbaar via de bottom nav.

### Bottom Nav — Snelkoppelingen

```text
┌────────────────────────────────────────┐
│  🏠        📦        🛒        ⚙️     │
│ Dashboard  Producten  Orders  Meer     │
└────────────────────────────────────────┘
```

- **Dashboard** — `/admin`
- **Producten** — `/admin/products`
- **Bestellingen** — `/admin/orders`
- **Meer** — Opent de sidebar (bestaande `SidebarTrigger` logica)

Actieve tab wordt gehighlight op basis van huidige route.

### Responsiviteitsverbeteringen

1. **Main content padding** — minder padding op mobiel, extra `pb-16` voor ruimte onder de bottom nav
2. **AIHelpWidget** — verschuif de floating button omhoog zodat hij niet achter de bottom nav verdwijnt (`bottom-20` i.p.v. `bottom-4` op mobiel)
3. **AdminHeader** — compacter op mobiel (al grotendeels goed, maar we checken de spacing)

### Bestanden

| Actie | Bestand |
|-------|---------|
| Nieuw | `src/components/admin/AdminBottomNav.tsx` — bottom nav component |
| Wijzig | `src/components/admin/AdminLayout.tsx` — bottom nav toevoegen + padding aanpassen |
| Wijzig | `src/components/admin/help/AIHelpWidget.tsx` — positie aanpassen voor bottom nav |


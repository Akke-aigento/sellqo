

## Fix: Inbox "0" verwijderen uit bottom nav

### Probleem
De Inbox tab in de mobile bottom nav toont "0" naast het icoon. Er zou geen getal moeten staan — alleen het icoon + "Inbox" label, en bij ongelezen berichten een klein rood bolletje rechtsboven op het icoon.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/AdminMobileBottomNav.tsx` | `badge: count` verwijderen uit tabs array, badge rendering vereenvoudigen |

### Detail

**Regel 18**: Verwijder `badge: count` van de Inbox tab — het getal wordt nergens meer gebruikt.

**Regel 33-37**: De notificatie-indicator direct koppelen aan de `count` variabele i.p.v. via `tab.badge`:
- Voor de Inbox tab (check op `tab.path === '/admin/messages'`), toon het rode bolletje als `count > 0`
- Geen cijfer, alleen een `h-2 w-2 rounded-full bg-destructive` dot

Concreet wordt de render-logica:
```tsx
<div className="relative">
  <tab.icon className="h-5 w-5" />
  {tab.path === '/admin/messages' && count > 0 && (
    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
  )}
</div>
<span>{tab.label}</span>
```

De `badge` property wordt volledig verwijderd uit de tabs array.

### Geen database wijzigingen nodig




# Fix: Layout Overflow Chain - Alle Admin Pagina's

## Kernprobleem

De vorige fix voegde `min-w-0 overflow-hidden` toe aan SidebarInset en main, maar er zijn twee resterende problemen:

### 1. Ontbrekende constraint op de wrapper div
De buitenste `div.min-h-screen.flex.w-full` in AdminLayout mist `min-w-0` en `overflow-hidden`. Hierdoor kan de hele flex container breder worden dan het scherm, ongeacht de constraints op de kinderen.

```text
div.min-h-screen.flex.w-full    <-- GEEN min-w-0, GEEN overflow control
  ├── AdminSidebar
  └── SidebarInset (min-w-0 overflow-hidden)  <-- constraint werkt niet 
        └── main (min-w-0 overflow-hidden)      als parent niet meedoet
```

### 2. overflow-hidden op main blokkeert verticaal scrollen
De inner `main` heeft `flex-1` waardoor het een vaste hoogte krijgt (resterende ruimte na header). Met `overflow-hidden` wordt content die langer is dan het scherm simpelweg afgekapt -- gebruikers kunnen niet naar beneden scrollen.

## Oplossing

Twee wijzigingen in `AdminLayout.tsx`:

1. **Wrapper div**: Voeg `min-w-0 overflow-hidden` toe zodat de hele layout correct constrained wordt
2. **Inner main**: Wijzig `overflow-hidden` naar `overflow-y-auto overflow-x-hidden` zodat:
   - Verticaal scrollen WEL werkt (pagina-inhoud kan langer zijn dan het scherm)
   - Horizontaal overflow NIET de layout breekt (tabellen scrollen binnen hun eigen CardContent container)

### Resultaat

```text
div.min-h-screen.flex.w-full.min-w-0.overflow-hidden   <-- constrained
  ├── AdminSidebar
  └── SidebarInset (min-w-0 overflow-hidden)            <-- constrained
        └── main (min-w-0 overflow-y-auto overflow-x-hidden)  <-- scrollbaar
              └── Pagina met overflow-x-auto tabellen          <-- horizontaal scrollbaar
```

## Technische Details

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/AdminLayout.tsx` | 2 regels aanpassen: wrapper div + main element |

### Code wijziging

Regel 18 (wrapper div):
- Van: `className="min-h-screen flex w-full"`
- Naar: `className="min-h-screen flex w-full min-w-0 overflow-hidden"`

Regel 24 (inner main):
- Van: `className="flex-1 p-4 lg:p-6 min-w-0 overflow-hidden"`
- Naar: `className="flex-1 p-4 lg:p-6 min-w-0 overflow-y-auto overflow-x-hidden"`

Dit fixt de hele overflow chain in 1 keer voor alle 26+ admin pagina's.


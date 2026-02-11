

# Fix: Root Layout Overflow (alle admin pagina's)

## Oorzaak

Het probleem zit niet in de individuele tabellen, maar in de **layout container** zelf. In `AdminLayout.tsx`:

```text
div.flex.w-full
  ├── AdminSidebar (vaste breedte)
  └── SidebarInset (flex-1, GEEN min-w-0)  ← PROBLEEM
        └── main.flex-1 (GEEN min-w-0)     ← PROBLEEM
              └── Outlet (pagina-content)
```

CSS Flex regel: een `flex-1` kind krimpt **niet** kleiner dan zijn content-breedte, tenzij `min-w-0` of `overflow-hidden` wordt gezet. Hierdoor duwt brede tabel-content de hele layout voorbij het scherm — ongeacht `overflow-x-auto` op de tabel zelf.

## Oplossing

Twee kleine wijzigingen in `AdminLayout.tsx`:

1. **SidebarInset**: voeg `min-w-0 overflow-hidden` toe aan de className
2. **main element**: voeg `min-w-0 overflow-hidden` toe

Dit zorgt ervoor dat de flex container correct krimpt en de `overflow-x-auto` op tabellen/cards daadwerkelijk scrollbars toont in plaats van de hele pagina te verbreden.

## Bestand

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/AdminLayout.tsx` | `min-w-0 overflow-hidden` toevoegen aan SidebarInset en main element |

Dit is een fix van 2 regels die **alle 26+ admin pagina's tegelijk** oplost.


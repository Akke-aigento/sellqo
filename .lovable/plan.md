

## Fullscreen Mode voor POS Terminal

### Wat

Een fullscreen-knop toevoegen aan de POS terminal header die de browser Fullscreen API gebruikt. Hiermee kan de kassabediende vanuit de bestaande admin-route (`/admin/pos/:terminalId`) of de standalone kassa-route (`/kassa/:terminalId`) het volledige scherm activeren — geen nieuw tabblad nodig.

### Hoe

**1. `POSTerminal.tsx` — Fullscreen toggle knop**
- Voeg een `Maximize`/`Minimize` knop toe in de header (naast de settings-knop)
- Gebruik `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`
- Track fullscreen-status via een `fullscreenchange` event listener in een `useEffect`
- Knop toont `Maximize` icoon als niet fullscreen, `Minimize` als wel

**2. `POS.tsx` — "Fullscreen" optie op terminal kaarten**
- Naast of i.p.v. de "Open kassaweergave" (external link) knop, een "Fullscreen" knop toevoegen
- Navigeert naar `/admin/pos/:terminalId` en triggert direct fullscreen (via URL param `?fullscreen=1`)

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/POSTerminal.tsx` | Fullscreen toggle knop + `useEffect` voor state tracking + auto-fullscreen bij `?fullscreen=1` |
| `src/pages/admin/POS.tsx` | Fullscreen launch-knop op terminal kaarten |




## Plan: Sellqo PWA — Installeerbaar op hoofdscherm

Dezelfde aanpak als bij De Fiere Margriet: een `manifest.json` + meta tags zodat de app direct vanuit de browser op het hoofdscherm geïnstalleerd kan worden. De bestaande `favicon.png` wordt gebruikt als app-icoon (op witte achtergrond — dat regelt het OS automatisch).

### Wat er moet gebeuren

**1. `public/manifest.json` aanmaken**
- `name`: "Sellqo"
- `short_name`: "Sellqo"
- `start_url`: "/admin" (admin dashboard als startpunt)
- `display`: "standalone"
- `background_color`: "#ffffff" (witte achtergrond)
- `theme_color`: "#1E3A5F" (bestaande theme-color)
- Icons: `favicon.png` in 192x192 en 512x512 formaat

**2. `index.html` updaten**
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<meta name="apple-mobile-web-app-title" content="Sellqo">`
- `<link rel="apple-touch-icon" href="/favicon.png">`

**3. PWA icon**
- De bestaande `favicon.png` wordt hergebruikt. Voor optimale weergave op alle apparaten maken we er een grotere versie van (512x512) als `public/pwa-icon-512.png` — maar als de favicon al groot genoeg is, gebruiken we die direct.

Dat is het. Geen extra dependencies, geen `vite-plugin-pwa` nodig voor deze fase — precies zoals bij De Fiere Margriet.

### Bestanden

| Actie | Bestand |
|-------|---------|
| Nieuw | `public/manifest.json` |
| Wijzig | `index.html` — manifest link + Apple meta tags |

### Later (fase 2)
Als je er een echte App Store / Play Store app van wilt maken, voegen we Capacitor toe. Maar dat is een volgende stap.


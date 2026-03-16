

## Plan: App-icoon vervangen door custom SVG

De gebruiker heeft een eigen SVG-icoon aangeleverd (`Sellqo_App_icon_SVG_Vector.svg`). Dit wordt het nieuwe app-icoon voor de PWA.

### Wijzigingen

1. **SVG kopiëren naar `public/`** als `sellqo-icon.svg`
2. **PWA-iconen genereren** — de 192x192 en 512x512 PNG's opnieuw maken vanuit de SVG (via een script)
3. **`index.html`** — `apple-touch-icon` updaten naar het nieuwe icoon
4. **`manifest.json`** — eventueel SVG als extra icon-formaat toevoegen (naast de PNG's)
5. **Favicon** — ook de `favicon.png` vervangen met het nieuwe icoon

| Actie | Bestand |
|-------|---------|
| Kopieer | `user-uploads://Sellqo_App_icon_SVG_Vector.svg` → `public/sellqo-icon.svg` |
| Genereer | `public/pwa-icon-192.png` en `public/pwa-icon-512.png` vanuit SVG |
| Vervang | `public/favicon.png` met het nieuwe icoon |
| Wijzig | `index.html` — favicon verwijst naar nieuw icoon |


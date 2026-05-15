# Favicon pakket installeren

Het door jou geüploade favicon-pakket (Sellqo tasje-logo) wordt overal gebruikt waar nu nog de oude/Lovable favicon zichtbaar is — inclusief in Google zoekresultaten.

## Wat er gebeurt

1. **Bestanden kopiëren naar `public/`** (zo blijven ze op root-URL bereikbaar, wat Google nodig heeft):
   - `favicon.ico` (overschrijft oude)
   - `favicon.svg`
   - `favicon-96x96.png`
   - `apple-touch-icon.png`
   - `web-app-manifest-192x192.png`
   - `web-app-manifest-512x512.png`
   - `site.webmanifest`
   - Oude `public/favicon.png` verwijderen (om conflicten te vermijden)

2. **`index.html` `<head>` updaten** met de standaard RealFaviconGenerator tags:
   ```html
   <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   <link rel="shortcut icon" href="/favicon.ico" />
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   <meta name="apple-mobile-web-app-title" content="Sellqo" />
   <link rel="manifest" href="/site.webmanifest" />
   ```
   De huidige `<link rel="icon" href="/favicon.png">` wordt vervangen.

3. **`SellqoLogo.tsx`** blijft ongemoeid — dat gaat over de in-app logo's (light/dark/tagline), niet de favicon.

## Over Google

Google haalt favicons op via `/favicon.ico` (en de `<link rel="icon">` tags). Door de root-`favicon.ico` te vervangen + correcte tags in `index.html` zal Google bij de volgende crawl het nieuwe icoon tonen in zoekresultaten. Dat kan enkele dagen tot weken duren — niets dat we kunnen forceren behalve via Search Console "Request indexing" op de homepage.

## Niet aangepast

- Tenant storefront favicons (die gebruiken `faviconUrl` per webshop via `BrandingUploader` — dat is bewust per-tenant).
- In-app logo componenten.

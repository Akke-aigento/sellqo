# SellQo telefoon/WhatsApp-nummer updaten

## Bevinding
Na een full-text sweep (`+32`, `wa.me`, `tel:`, `123 45 67 89`, `3212345678`) staat het placeholder-nummer maar op één plek in de codebase: `src/pages/public/Contact.tsx` (publieke SellQo-contactpagina). De rest van de "WhatsApp"-treffers gaan over de tenant WhatsApp Business-integratie (`whatsapp_connections`, edge functions, templates, opt-in) — daar wordt niets aan gewijzigd.

Geen treffers in landing, footer, e-mailtemplates (`supabase/functions/_shared/email-templates/_brand.tsx` toont enkel `support@sellqo.app`), `index.html`, of marketing-pagina's. Dus één bestand volstaat.

## Wijziging
**`src/pages/public/Contact.tsx`** (regels 28-41) — vervang het placeholdernummer in zowel het WhatsApp- als het Telefoon-blok:

- WhatsApp
  - `value`: `+32 490 39 75 44`
  - `href`: `https://wa.me/32490397544`
- Telefoon
  - `value`: `+32 490 39 75 44`
  - `href`: `tel:+32490397544`

E-mail (`hello@sellqo.app`) en openingstijden blijven ongewijzigd.

## Buiten scope
- Alle tenant-gerichte WhatsApp-code (connections, templates, opt-in, send-whatsapp-message edge function, settings-UI). Die gebruiken het nummer van de winkelier zelf — niet aanraken.
- E-mailtemplates (verwijzen naar `support@sellqo.app`, geen telefoonnummer).

## Verificatie
Na de wijziging één extra `rg` op `3212345678|123 45 67 89` om te bevestigen dat er geen placeholder meer overblijft.

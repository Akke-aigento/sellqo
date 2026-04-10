

## Fix: Betaalmethodes correct filteren wanneer uitgeschakeld

### Probleem
De database voor Mancini Milano bevat momenteel `["stripe", "bank_transfer"]` in `payment_methods_enabled`, terwijl de admin UI de QR/bankoverschrijving toggle als uitgeschakeld toont. Dit kan twee oorzaken hebben:
1. De toggle is uitgezet maar niet opgeslagen
2. De toggle-status wordt bij het laden niet correct weergegeven

Daarnaast is er een structureel probleem: zowel de ShopCheckout als de Storefront API behandelen een **lege** `payment_methods_enabled` array als "toon alles", wat een onveilige fallback is.

### Oplossing

#### 1. Database fix — `bank_transfer` verwijderen voor Mancini
Een migratie die `bank_transfer` uit de `payment_methods_enabled` array verwijdert voor deze tenant, zodat het direct effect heeft.

#### 2. `ShopCheckout.tsx` — Fallback-logica fixen (regel 126)
```
// NU (onveilig):
if (rawMethods.includes('stripe') || rawMethods.length === 0) {
// WORDT:
if (rawMethods.includes('stripe')) {
```
Als `rawMethods` leeg is, toon alleen de default `['card']` (regel 139 doet dit al).

#### 3. `storefront-api/index.ts` — `noFilter` fallback verwijderen (regel 1998)
```
// NU:
const noFilter = enabledMethods.length === 0;
// WORDT: verwijderd — lege lijst = geen methodes
```
Als er geen methodes geconfigureerd zijn, toon alleen Stripe als fallback (als het account actief is).

#### 4. `TransactionFeeSettings.tsx` — Auto-save bij toggle of duidelijker UX
De toggle wijzigt alleen lokale state; pas na "Opslaan" wordt het opgeslagen. Controleren of de save-knop duidelijk zichtbaar is na een toggle-wijziging, zodat gebruikers niet vergeten op te slaan.

### Bestanden
| Bestand | Wat |
|---------|-----|
| Migratie (nieuw) | `bank_transfer` verwijderen uit Mancini's config |
| `src/pages/storefront/ShopCheckout.tsx` | Lege-array fallback verwijderen |
| `supabase/functions/storefront-api/index.ts` | `noFilter` fallback verwijderen |
| `src/components/admin/settings/TransactionFeeSettings.tsx` | Save-indicator bij unsaved changes |


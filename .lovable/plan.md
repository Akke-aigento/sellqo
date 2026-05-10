## Aanpak

### 1. `TrialExpiredBlocker.tsx` — platform-admin dismiss
- `useAuth()` → `isPlatformAdmin` ophalen
- Lokale `dismissed` state (sessionStorage key `trial_blocker_dismissed_<tenantId>` zodat het per tenant onthouden wordt tijdens de sessie)
- Als `isPlatformAdmin && dismissed` → return `null`
- Als `isPlatformAdmin && !dismissed` → toon hetzelfde scherm + extra **"Sluiten (platform admin)"** knop bovenaan rechts (X icoon) én een secundaire knop onderaan naast Uitloggen: *"Doorgaan zonder upgrade (admin)"*
- Voor gewone tenant users: ongewijzigd gedrag (geen dismiss-knop)
- Belangrijk: Kiezen-knoppen blijven werken zodat je de upgrade-flow ook kan testen

### 2. `TrialBanner.tsx` — geen wijziging nodig
Banner heeft al een dismiss-knop, dus platform admin kan die ook gewoon wegklikken.

### 3. Test-trigger voor platform admin
Zodat je het scherm opnieuw kan oproepen na dismiss:
- Voeg in **`/admin/platform`** (Platform Tools sectie) een dev-knop toe: **"Test Trial Expired Blocker"**
- Knop wist `sessionStorage.removeItem('trial_blocker_dismissed_<currentTenantId>')` en forceert een re-render door `window.location.reload()` of door een query refetch
- Alleen zichtbaar voor `isPlatformAdmin`

Alternatief simpeler (default): in plaats van een aparte testknop een kleine *"Reset trial blocker dismiss"* link tonen in de **Account-dropdown / user menu** voor platform admins. Geef aan welke je wil.

## Niet aangeraakt
- Trial-logica, subscription-state, RLS, edge functions
- Gewone tenant-flow blijft 100% identiek

## Vraag
Waar wil je de testknop?
1. In `/admin/platform` (Platform Tools) — netter, hoort bij admin-tooling
2. In het user-menu rechtsboven — sneller bereikbaar tijdens testen
3. Allebei

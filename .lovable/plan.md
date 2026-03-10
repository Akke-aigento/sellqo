

## Analyse

Er zijn twee problemen:

### 1. Foutief account `info@sellqo.ai`
Er bestaat een auth-gebruiker `info@sellqo.ai` (ID: `b999f17d`) naast het correcte account `info@sellqo.app` (ID: `be6f2a43`). Dit account heeft een `tenant_admin` role voor de SellQo tenant maar mist de `platform_admin` role. Dit account kan verwarring veroorzaken.

**Fix**: Verwijder de `user_roles` van het foute account `info@sellqo.ai`. Het auth-account zelf kan niet via SQL verwijderd worden (dat zit in het `auth` schema), maar we kunnen de rol-koppeling opruimen zodat het account geen toegang meer heeft.

### 2. Trial blocker verschijnt ondanks enterprise subscription
De "trial verlopen" melding verschijnt waarschijnlijk omdat je momenteel de tenant **"Loveke"** geselecteerd hebt (in de tenant-switcher). De Loveke tenant (`info@loveke.be`) heeft een enterprise trial die op 9 maart is verlopen. De blocker verschijnt voor de GESELECTEERDE tenant, niet specifiek voor SellQo.

**Fix**: Twee aanpassingen:
- De `TrialExpiredBlocker` moet platform admins ALTIJD doorlaten (zij beheren het platform en moeten nooit geblokkeerd worden, ongeacht welke tenant ze bekijken)
- De `useTrialStatus` hook aanpassen zodat platform admins nooit als "trial expired" worden gezien

### Wijzigingen

**Database migratie**: Verwijder de `user_roles` record voor het foute account `info@sellqo.ai` (user_id `b999f17d-0f67-4809-8112-6d012f27b49e`).

**`src/hooks/useTrialStatus.ts`**: Voeg een check toe voor `isPlatformAdmin` (via `useAuth`) — als de gebruiker platform admin is, geef altijd active/paid status terug, ongeacht welke tenant geselecteerd is.

**`src/components/admin/TrialExpiredBlocker.tsx`**: Voeg een extra guard toe: als de gebruiker `isPlatformAdmin` is, render nooit de blocker.


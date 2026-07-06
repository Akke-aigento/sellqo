## Wat er écht gebeurd is met Sander (reconstructie uit DB)

Chronologisch:

```text
12:50:16  revocation rij aangemaakt op Zona Dorata voor sander.mancini@hotmail.be
          → jij had hem al eens toegevoegd + verwijderd (test)
13:04:01  invite verstuurd naar Zona Dorata      (invitation_id 9c68826a...)
13:04:34  invite verstuurd naar Mancini Milano   (invitation_id 7c2efa80...)
13:38     Sander logt succesvol in (auth log toont 'Login' event)
??:??     accept-team-invitation is nooit uitgevoerd (geen 'accepted' audit-rij)
```

**Diagnose:** Sander heeft wél een werkend account (wachtwoord aanwezig, ingelogd vandaag). Zijn error zat dus **niet** in sign-in, maar in de acceptance-stap ná login. Beide invites staan nog `pending`, 0 user_roles.

De meest waarschijnlijke oorzaak: hij landde op de invite-pagina zonder ingelogd te zijn → login-formulier → succesvol ingelogd → maar de `useEffect` die naar `kind: 'accepting'` overspringt heeft mogelijk een race met de useAuth-hydratie, of hij landde na login op `/admin` i.p.v. terug op de invite-pagina (omdat de sign-in flow niet weet dat er een invite-context is).

---

## Audit — bevindingen in de huidige flow

### KRITIEK — moet gefixed voor vrijdag

**F1. `send-team-invitation` ruimt `tenant_access_revocations` niet op**  
Wanneer je iemand opnieuw uitnodigt na eerdere verwijdering, blijft de revocation rij staan. Dat blokkeert auto-repair paden (`repair-tenant-access`) en is een landmijn. Fix: na `insert` van invite ook `DELETE FROM tenant_access_revocations WHERE tenant_id=... AND email=...`.

**F2. Post-login jump in `AcceptInvitation.tsx` heeft race met AuthProvider**  
Regel 254: direct na `signInWithPassword` staat `setState({ kind: 'accepting', invite })`. De `doAccept` useEffect vuurt dan meteen `supabase.functions.invoke('accept-team-invitation')`. De supabase-client heeft z'n sessie wél al, dus de call zelf lukt — maar als de call slaagt, doet stap 219–239 een `refreshSession` + `refetchRoles` + navigate. Als `useAuth` net op dat moment een nieuwe fetch triggert, kan er een korte flicker naar `/no-access` optreden. Fix: kleine `await new Promise(r => setTimeout(r, 100))` na signIn + expliciete null-check op sessie voor `accepting`.

**F3. `AcceptInvitation` foutstate te generiek**  
Bij een error krijgt Sander alleen "Er ging iets mis" + `state.message`. Geen fase-info (login? otp? accept?), geen support-context. Voor vrijdag: elke fase moet z'n eigen error-toast + logging via console.error hebben, plus een "Kopieer diagnose" knop met tenant/email/invite-id.

### AANDACHTSPUNTEN — niet kritiek voor vrijdag maar goed om te weten

**A1.** `fetch-invitation` bepaalt `accountExists` via `profiles` tabel. Als een user wél in `auth.users` staat maar geen `profiles` row (legacy), zou hij in OTP-flow belanden en dan via `updateUser({password})` z'n eigen wachtwoord overschrijven. Voor Sander niet relevant (heeft profile), maar in het plan wil ik dit hardenen door tegen `auth.admin.getUserById` te checken.

**A2.** `send-team-invitation` gebruikt `RESEND_API_KEY` direct — geen queue, geen retry. Als Resend even hikt, faalt het versturen. Voor vrijdag: als de email niet aankomt, kan je hem opnieuw versturen via de UI (auto-replace).

**A3.** In `AcceptInvitation.tsx` regel 289 `signInWithOtp({ shouldCreateUser: true })` — de `shouldCreateUser: true` is correct voor nieuwe users, maar we vertrouwen `accountExists=false` uit fetch-invitation. Combinatie met A1 = risico.

---

## Plan

### Stap 1 — Soft-reset voor Sander (behoudt zijn account + wachtwoord)

Via `supabase--insert`:
```sql
-- Wis stale revocation rij op Zona Dorata
DELETE FROM public.tenant_access_revocations
WHERE email ILIKE 'sander.mancini@hotmail.be';

-- Wis beide pending invites zodat we vrijdag verse verzenden
DELETE FROM public.team_invitations
WHERE email ILIKE 'sander.mancini@hotmail.be'
  AND status = 'pending';
```
Auth-user, profile, wachtwoord blijven staan. Audit-log rijen behouden.

### Stap 2 — Fix F1: `send-team-invitation` ruimt revocations op

Na de `INSERT` van de nieuwe invitation, best-effort delete:
```ts
await supabase
  .from("tenant_access_revocations")
  .delete()
  .eq("tenant_id", tenantId)
  .ilike("email", email);
```
Deploy: `send-team-invitation`.

### Stap 3 — Fix F2: race na login in `AcceptInvitation.tsx`

In `handleLogin`:
- na succesvolle `signInWithPassword`, wacht 150ms + refresh session, DAN pas `setState('accepting')`
- expliciete guard in `doAccept`: als `user?.id` nog niet gezet is, wait-and-retry (max 3× 200ms) voordat `functions.invoke` gedaan wordt

### Stap 4 — Fix F3: betere error handling in AcceptInvitation

- Elke handler (`handleLogin`, `handleSendOtp`, `handleVerifyOtp`, `handleSetPassword`, `doAccept`) logt naar console met een fase-prefix `[AcceptInvitation/<fase>]`
- Bij `state.kind === 'error'`: toon `phase`, `message`, `invite.tenantName`, `invite.email`, en een "Kopieer diagnose" knop die deze info + timestamp naar clipboard schrijft
- Extra: `AcceptInvitation` state uitbreiden met `errorPhase?: 'fetch' | 'login' | 'otp' | 'set_password' | 'accept'`

### Stap 5 — Hardening (Aandachtspunt A1) — quick win

In `fetch-invitation`: als `profiles` een hit geeft, extra check via `supabase.auth.admin.getUserById(profile.id)` en response verrijken met `hasUsablePassword` boolean. AcceptInvitation gebruikt dat: als bestaand account maar geen password → forceer OTP → set_password i.p.v. login-required.

Deploy: `fetch-invitation`.

### Stap 6 — Testplan vrijdag (verificatie live)

Voer in deze volgorde uit, met Sander:

1. Jij (Akke) opent Zona Dorata → Team → uitnodigen `sander.mancini@hotmail.be` als Admin  
   ✅ Verifieer: email arriveert bij Sander, invite-rij `pending` in DB, revocation rij weg.
2. Sander klikt link → landt op `/invite/<token>` → ziet **login_required** (want account bestaat)  
   ✅ Verifieer: card toont tenantnaam + rol + inviter-naam.
3. Sander logt in met bestaand wachtwoord → auto-accept  
   ✅ Verifieer: success-card verschijnt, redirect naar `/admin`, `user_roles` heeft 1 rij, audit-log heeft `accepted` event.
4. Sander ziet Zona Dorata in de sidebar (single tenant, geen switcher zichtbaar).
5. Jij switcht naar Mancini Milano → Team → uitnodigen zelfde email als Admin  
   ✅ Verifieer: 2e email arriveert.
6. Sander klikt 2e link → **one_click_accept** (want al ingelogd, email matcht)  
   ✅ Verifieer: 1 klik = success, `user_roles` heeft 2 rijen.
7. Sander refresht → sidebar toont **tenant-switcher** (want `tenants.length === 2`).
8. Sander wisselt tussen beide tenants → `currentTenant` blijft correct in localStorage.

### Rollback

Als iets stukloopt tijdens de call vrijdag: `DELETE FROM user_roles WHERE user_id=<sander>`; `DELETE FROM team_invitations WHERE email='sander.mancini@hotmail.be'`; en herstart vanaf stap 1. Zijn auth-account raken we niet aan.

---

## Bestanden die wijzigen

- `supabase/functions/send-team-invitation/index.ts` — revocation cleanup (F1)
- `supabase/functions/fetch-invitation/index.ts` — `hasUsablePassword` toevoegen (A1)
- `src/pages/AcceptInvitation.tsx` — race fix (F2), betere errors (F3), gebruikt `hasUsablePassword`
- Deploy: `send-team-invitation`, `fetch-invitation`

**Niet aangeraakt:**
- `accept-team-invitation` (al hardened met revocation-cleanup)
- `repair-tenant-access` (guards zijn goed)
- `check-invite-email`, `resend-team-invitation`, `revoke-team-invitation`, `remove-team-member`
- Beide tenants' owner_email of teams

Akkoord met dit plan, dan zet ik het om vrijdagochtend in werking (of nu al, jij zegt het maar)?

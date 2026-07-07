
## Probleem

De invite-flow van een eerder verwijderd teamlid loopt op drie plekken vast:

1. **Login-scherm i.p.v. "nieuw wachtwoord"**  
   `fetch-invitation` markeert de auth-user als `hasUsablePassword=true` zodra
   `last_sign_in_at` gezet is. Voor een eerder verwijderde gebruiker die zijn
   oude wachtwoord niet meer weet is dat een dead-end: hij komt op het
   password-login-scherm en niet op "kies een nieuw wachtwoord".

2. **`/reset-password` bestaat niet → 404**  
   `handleForgotPassword` stuurt de user via `resetPasswordForEmail` naar
   `${origin}/reset-password`, maar die route staat NIET in `src/App.tsx`.
   Vandaar de 404 na klikken op de reset-mail.

3. **`wrong_account`-scherm blijft hangen na uitloggen**  
   Na "Uitloggen en opnieuw beginnen" verandert `user` maar de key-guard
   `resolvedTokenRef` re-resolvet correct — behalve dat de fallback dan alsnog
   in `login_required` belandt (zie punt 1) i.p.v. `new_account_setup`.

## Oplossing (alleen team-invite / auth — géén andere modules)

### A. Nieuwe route + pagina `/reset-password`

- `src/pages/ResetPassword.tsx` (nieuw):
  - Publieke route, Shell-styling gelijk aan `AcceptInvitation`.
  - Detecteert Supabase recovery-sessie: reageert op `onAuthStateChange`
    event `PASSWORD_RECOVERY` (Supabase v2 pattern) én controleert
    `getSession()` fallback.
  - Als geen recovery-sessie: toont "Deze link is verlopen of ongeldig,
    vraag een nieuwe reset aan" met link naar `/auth`.
  - Als recovery-sessie actief: formulier met `password` +
    `passwordConfirm` (min 8 tekens, match), submit doet
    `supabase.auth.updateUser({ password })`.
  - Bij succes: toast + redirect naar `/admin` (of `/auth` als er geen
    role is — bestaande ProtectedRoute regelt dat verder).
- `src/App.tsx`: `<Route path="/reset-password" element={<ResetPassword />} />`
  toevoegen bij de andere public auth-routes (naast `/auth`).

### B. Re-invite van verwijderde user → altijd "nieuw wachtwoord"-pad

Twee kleine, defensieve wijzigingen samen:

1. **`send-team-invitation` (edge function)** — wanneer bij het versturen
   van een nieuwe invite een matching `tenant_access_revocations`-rij
   bestaat voor `(tenant_id, email)` ("verse start"):
   - Zoek de auth-user via `profiles.email`.
   - Als die bestaat en `email` matcht: roep
     `supabase.auth.admin.updateUserById(userId, { password: <random 32-byte>, email_confirm: true })`
     aan. Dit invalideert het oude wachtwoord zonder de user te verwijderen.
   - Log als audit-event `password_reset_on_reinvite` in
     `invite_audit_log` (metadata: `{ reason: 'revocation_present' }`).
   - Idempotent: als er geen auth-user of geen revocation is, skip.

2. **`fetch-invitation`** — als er een `tenant_access_revocations`-rij
   bestaat voor de invite-`(tenant_id, email)` combinatie, forceer
   `hasUsablePassword = false` in het response. Zo landt zowel een niet-
   ingelogde als een ingelogde-verkeerde user na uitloggen op
   `new_account_setup` (die pakt `create-invite-account` en zet meteen
   het nieuwe wachtwoord). Bestaande accept-team-invitation opruimt de
   revocation-rij al bij success.

Deze twee samen sluiten de race: zelfs als iemand nog een oude sessie
in localStorage heeft, of Supabase toch `last_sign_in_at` teruggeeft,
volgt de UI het correcte "kies-nieuw-wachtwoord"-pad.

### C. `wrong_account` copy + auto re-resolve

Kleine UX-fix in `src/pages/AcceptInvitation.tsx`:

- Bij klik op "Uitloggen": na `signOut()` expliciet
  `resolvedTokenRef.current = null` zetten zodat `resolveFlow` opnieuw
  draait. Nu blijft de state soms hangen tot de auth-listener tikt.
- Copy in `wrong_account`-card verduidelijken: "Log uit en ga verder
  als {invite.email}" (was ambigu — leek te suggereren dat de user
  het oude wachtwoord moet invoeren).

## Files

- **Nieuw**: `src/pages/ResetPassword.tsx`
- **Edit**: `src/App.tsx` (route toevoegen), `src/pages/AcceptInvitation.tsx` (2× kleine tweak)
- **Edit edge**: `supabase/functions/send-team-invitation/index.ts`, `supabase/functions/fetch-invitation/index.ts`
- Redeploy: beide edge functions

## Niet in scope

- Auth email templates / branding
- Andere modules (marketing, storefront, promoties)
- OTP-flow refactor (blijft zoals in `docs/team-invite-eindrapport.md`)

## Acceptance

1. Verwijder teamlid → re-invite → klik accept-link (uitgelogd of andere user):
   krijgt "Kies wachtwoord" (min 8), niet het login-scherm. Na submit direct ingelogd + toegevoegd.
2. Als de user tóch op login-scherm zou landen en op "Wachtwoord vergeten" klikt:
   reset-mail werkt, klikken opent `/reset-password`, formulier zet nieuw wachtwoord,
   redirect naar `/admin`.
3. Normale (nieuwe) invites en bestaande accepted invites blijven ongewijzigd werken.

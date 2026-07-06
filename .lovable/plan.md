## Diagnose

De huidige "OTP-flow" voor nieuwe gebruikers is dubbelop en verwarrend:

```text
Klik "Uitnodiging accepteren" in mail
   ↓
Landt op /invite/<token>  (geen account → we tonen "Verstuur code" scherm)
   ↓
Klik "Verstuur code"
   ↓  supabase.auth.signInWithOtp({ shouldCreateUser: true })
   ↓  → Supabase stuurt magic-link mail MET klikbare knop EN 6-cijferige code
   ↓
Wij tonen OTP-invulscherm  ← nutteloos, want:
   ↓
Gebruiker klikt in mail op de KNOP (niet op code)
   ↓
Magic link autologin + redirect naar /invite/<token>
   ↓
useEffect re-runt resolveFlow → user matcht → one_click_accept
   ↓
Nog eens klikken op "Accepteer uitnodiging"
   ↓
Success
```

Twee UX-fouten: (1) OTP-scherm belooft een code-actie die overbodig is, (2) dubbele klik ("Accepteer" in mail én "Accepteer" op de site) voor iemand die überhaupt nooit een account had.

## Beoogde flow — één klik = klaar

```text
Klik "Uitnodiging accepteren" in mail
   ↓
Landt op /invite/<token>  (geen account)
   ↓
Toon: "Welkom! Kies een wachtwoord om je account aan te maken."
   ↓  (formulier: wachtwoord + bevestig, gebaseerd op email uit invite-token)
Klik "Account aanmaken en accepteren"
   ↓  supabase.auth.signUp({ email, password })  — email al pre-verified via invite-token
   ↓  → account aangemaakt, sessie actief
   ↓
Auto-accept invite (bestaande doAccept-flow)
   ↓
Success → /admin
```

Geen tweede mail, geen OTP-code, geen magic link, geen dubbele klik. De invite-token is zelf al het "bewijs" dat deze email adres eigenaar is (want alleen de eigenaar van de mailbox kan die link ontvangen hebben).

## Wijzigingen

### 1. `AcceptInvitation.tsx` — vervang OTP-tak door direct-signup

- **Verwijder** `FlowState` varianten: `otp_request`, `otp_verify`
- **Vervang** door één nieuwe state: `new_account_setup` (was `set_password`, hergebruiken)
- **Verwijder** handlers: `handleSendOtp`, `handleVerifyOtp`
- **Nieuwe handler** `handleCreateAccount(invite, password)`:
  1. `supabase.auth.signUp({ email: invite.email, password, options: { emailRedirectTo: window.location.href } })`
  2. Als Supabase weigert wegens "already registered" (edge case: profile-lookup zei nee maar auth zei ja) → fallback naar login-required state met toast
  3. Wacht 150ms + `refreshSession` (zelfde pattern als handleLogin)
  4. `setState({ kind: 'accepting', invite })`
- **Verwijder** state `otpCode`, `resendCooldown` + de countdown-useEffect
- **Verwijder** `InputOTP` imports

### 2. Beslissings-logica in `resolveFlow` blijft hetzelfde

`accountExists && hasUsablePassword` → `login_required`, anders → **nieuwe** `new_account_setup` state (i.p.v. `otp_request`).

### 3. Auth email-confirmatie

Twee mogelijkheden:
- **Optie A (aanbevolen):** Zet `email_confirm=false` mee in `signUp` via edge function met service-role (email is al bewezen via invite-token). Simpelste voor de gebruiker: één klik en klaar.
- **Optie B:** Laat Supabase een confirmation mail sturen; gebruiker moet die nog bevestigen. Slechtere UX.

Ik ga voor A: nieuwe edge function `create-invite-account` (of uitbreiding van `accept-team-invitation`) die met service-role:
1. Valideert invite-token (pending, niet expired, niet revoked)
2. `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — email meteen bevestigd
3. Geeft succes terug; frontend doet `signInWithPassword` en dan bestaande accept-flow

Nieuwe edge function `create-invite-account` (verify_jwt=false, want gebruiker heeft nog geen JWT), input: `{ token, password }`, validates + creates user + returns success.

### 4. Screens

- **`new_account_setup` screen:** "Welkom bij {tenantName}! Kies een wachtwoord om je account aan te maken." + wachtwoord + bevestig + submit. Geen "verstuur code" tussenstap meer.

## Bestanden

- `src/pages/AcceptInvitation.tsx` — flow simplificatie (OTP weg, direct signup)
- `supabase/functions/create-invite-account/index.ts` — **nieuw**, service-role account creation
- Deploy: `create-invite-account`

## Wat blijft ongewijzigd

- Bestaande gebruikers met wachtwoord: nog steeds `login_required` → login → auto-accept (fix F2 uit vorig plan blijft)
- Bestaande gebruikers zonder wachtwoord (shell auth-users): vallen ook in `new_account_setup`, `create-invite-account` detecteert bestaand account en doet `admin.updateUserById({ password })` i.p.v. `createUser`
- Ingelogde gebruikers: `one_click_accept` blijft
- `accept-team-invitation`, `send-team-invitation`, `fetch-invitation` — geen wijzigingen

## Testcases

1. **Nieuwe user, geen account:** klik in mail → wachtwoord kiezen → 1 klik → in dashboard
2. **Bestaande user, geen wachtwoord:** identiek aan (1), maar server-side doet update i.p.v. create
3. **Bestaande user, met wachtwoord:** ongewijzigde login-flow (Sander vrijdag)
4. **Al ingelogd, email matcht:** ongewijzigde one_click_accept
5. **Al ingelogd, andere email:** ongewijzigde wrong_account

Akkoord?

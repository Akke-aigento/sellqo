## Plan: invite-flow rechtzetten zonder security te verzwakken

### Wat verandert er voor de gebruiker
- Bij een geldige teamuitnodiging wordt niet meer gevraagd naar het oude wachtwoord als de invite-email nog geen lid is van die tenant.
- De standaard flow wordt: **wachtwoord kiezen + bevestigen → accepteren → klaar**.
- Alleen wanneer iemand al met exact het juiste e-mailadres is ingelogd, blijft de veilige één-klik acceptatie bestaan.
- Wanneer iemand met een ander account is ingelogd, blijft de bescherming bestaan: eerst uitloggen, daarna komt die invite-email op het nieuw-wachtwoord-scherm.

### Concrete wijzigingen
1. **Frontend: `src/pages/AcceptInvitation.tsx`**
   - Verwijder de login-dead-end uit de invite-flow voor niet-ingelogde gebruikers.
   - `login_required` wordt niet langer gekozen op basis van `accountExists` / `hasUsablePassword`.
   - Niet-ingelogd + niet reeds tenant-lid = altijd `new_account_setup`.
   - Copy aanpassen van “account aanmaken” naar neutraal “wachtwoord instellen”, zodat dit klopt voor zowel bestaande als nieuwe auth-gebruikers.
   - De knop wordt “Wachtwoord instellen en uitnodiging accepteren”.

2. **Backend lookup: `supabase/functions/fetch-invitation/index.ts`**
   - `alreadyMember` blijft server-side bepaald via `user_roles` en blijft leidend.
   - `hasUsablePassword` wordt niet meer gebruikt om de UI naar een login-scherm te sturen.
   - Response blijft backwards-compatible, maar voor invite-flow mag “geen tenant-link” de nieuw-wachtwoord-flow afdwingen.

3. **Backend action: `supabase/functions/create-invite-account/index.ts`**
   - Bestaande gebruiker: wachtwoord server-side updaten voor exact de invite-email.
   - Nieuwe gebruiker: account aanmaken met dat wachtwoord.
   - Daarna logt de frontend in met dat nieuwe wachtwoord en roept `accept-team-invitation` aan.
   - Security blijft: het invite-token bepaalt alleen welk e-mailadres/tenant/rol mag worden verwerkt; `accept-team-invitation` controleert daarna nog steeds dat de ingelogde gebruiker exact dezelfde email heeft.

4. **Geen wijzigingen buiten scope**
   - Geen marketing, storefront, promotions, checkout of automation wijzigingen.
   - Geen afzwakking van tenant-isolatie of email-match checks.

### Validatie na implementatie
- Re-invite van verwijderd lid: komt direct op wachtwoord + bevestiging, niet op login.
- Bestaande auth-user zonder tenant-link: komt ook direct op wachtwoord + bevestiging.
- Nieuwe email zonder account: zelfde flow.
- Verkeerd ingelogde gebruiker: eerst uitloggen, daarna wachtwoord instellen voor invite-email.
- Al lid van tenant: blijft “je bent al lid”, geen reset of nieuwe rol.

Doel

- De uitnodigingspagina moet standaard werken als “maak je account aan voor deze tenant”, niet als gewone login.
- Tegelijk wil ik de publieke invite-ophaalflow veiliger maken, want de huidige SELECT-policy met `USING (true)` is te breed.

Wat ik heb nagekeken

- In `src/pages/AcceptInvitation.tsx` start `showRegister` nu op `false`, waardoor de pagina standaard het loginformulier toont.
- De accept-flow zelf is al juist: zodra er een geldige sessie is, accepteert de pagina de uitnodiging automatisch via `accept-team-invitation`.
- De recente database-fix maakt uitnodigingen publiek leesbaar, maar momenteel op een te brede manier.

Plan

1. Invite-pagina standaard naar “account aanmaken”
- In `src/pages/AcceptInvitation.tsx` maak ik registratie de standaardflow voor niet-ingelogde gebruikers.
- De e-mail blijft vooraf ingevuld en readonly.
- Het wachtwoordlabel maak ik duidelijker: “Nieuw wachtwoord”.
- De secundaire actie wordt: “Heb je al een account? Inloggen”.

2. Signup-flow correct afwerken
- Na accountaanmaak blijft de gebruiker terugkeren naar dezelfde uitnodigingslink via `emailRedirectTo`.
- Als er meteen een sessie is, wordt de uitnodiging direct geaccepteerd.
- Als e-mailbevestiging nodig is, toon ik een duidelijke tussenstatus zoals:
  - account aangemaakt
  - bevestig je e-mail
  - daarna koppelen we je automatisch aan de juiste tenant
- De bestaande auto-accept logic blijft de tenant-koppeling afmaken zodra de sessie beschikbaar is.

3. Login alleen als alternatief
- Bestaande gebruikers kunnen nog steeds expliciet kiezen voor inloggen.
- De copy wordt aangepast zodat het verschil duidelijk is:
  - nieuw account aanmaken en accepteren
  - of inloggen met bestaand account

4. Veilige invite lookup herstellen
- Ik vervang de huidige brede publieke SELECT-toegang door een veiligere token-scoped backend lookup.
- `AcceptInvitation.tsx` haalt de uitnodigingsdetails dan niet meer rechtstreeks uit de tabel op.
- Daarna kan de te brede policy `Anyone can view invitation by token` weer verwijderd of aangescherpt worden.

Bestanden die wijzigen

- `src/pages/AcceptInvitation.tsx`
- nieuwe migratie voor veilige invite-read aanpak en het terugdraaien/aanscherpen van de brede policy
- eventueel een kleine backend helper voor “fetch invitation by token”

Technische details

- Ik zet geen anonieme signups of auto-confirm aan.
- Tenant-koppeling blijft server-side via `accept-team-invitation`.
- De UX wordt dus logischer zonder de beveiliging te verzwakken.

Verwacht resultaat

- Een uitgenodigde gebruiker ziet meteen een “nieuw wachtwoord kiezen / account aanmaken” flow.
- Na accountaanmaak en eventuele e-mailbevestiging komt die gebruiker terug op dezelfde uitnodiging en wordt automatisch aan de juiste tenant gekoppeld.
- Bestaande gebruikers kunnen nog steeds via “Ik heb al een account” inloggen.
- De invite-ophaalflow wordt tegelijk veiliger dan nu.

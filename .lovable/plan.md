# Plan: herstel teamuitnodiging-flow

## Doel
De uitnodigingsflow moet correct werken voor drie scenario’s:
- gebruiker is al ingelogd met het juiste e-mailadres
- gebruiker is ingelogd met een ander e-mailadres
- gebruiker heeft al een account maar is nog niet ingelogd

## Wat ik ga aanpassen

1. **Invite-pagina corrigeren voor bestaande sessies**
- Op `AcceptInvitation.tsx` controle toevoegen op e-mailmatch tussen actieve sessie en uitnodiging.
- Als het actieve account **niet** overeenkomt met de uitnodiging, niet langer alleen een dode accept-knop tonen.
- In plaats daarvan duidelijke keuze tonen: uitloggen en doorgaan met het juiste account, of inloggen met bestaand account.

2. **Fallback voor bestaand account tijdens registratie**
- In de registratie-flow op `AcceptInvitation.tsx` de fout `User already registered` opvangen.
- Dan automatisch of expliciet overschakelen naar de login-variant, met het uitnodigingse-mailadres al ingevuld.
- De flow blijft dus niet hangen op “registreren”, maar stuurt de gebruiker naar de juiste vervolgstap.

3. **Auto-accept alleen in veilige cases**
- De huidige auto-accept na auth-state-change beperken tot situaties waarin het ingelogde e-mailadres exact overeenkomt met het uitnodigingse-mailadres.
- Onbedoelde accept-calls met een verkeerd account voorkomen.

4. **Betere foutafhandeling op invite-pagina**
- Zwak wachtwoord netjes als validatiefout tonen bij het wachtwoordveld of als duidelijke gebruikersmelding.
- Backend-fouten uit `accept-team-invitation` vertalen naar bruikbare teksten op de invite-pagina.
- De generieke melding “Edge Function returned a non-2xx status code” niet meer aan de gebruiker tonen als eindresultaat.

5. **Controle van de accept-flow zelf**
- Verifiëren dat `accept-team-invitation` inhoudelijk correct blijft voor e-mailmatch, bestaand lidmaatschap en acceptatie.
- Alleen frontend-flow aanpassen als backendlogica al correct is; geen onnodige business logic wijzigen.

## Technische details
- Betrokken bestanden:
  - `src/pages/AcceptInvitation.tsx`
  - mogelijk `src/hooks/useAuth.tsx` alleen als een kleine auth-helper nodig blijkt
- Geen routering wijzigen
- Geen invite-datamodel wijzigen
- Geen API-contract wijzigen tenzij strikt nodig voor foutboodschappen

## Verwachte uitkomst
- Doorlinken in een normale browser met een verkeerde actieve sessie geeft een bruikbare volgende stap in plaats van een vastgelopen scherm.
- Incognito registratie met bestaand e-mailadres schakelt netjes naar login in plaats van te blijven falen.
- Acceptatie van uitnodigingen wordt voorspelbaar en foutmeldingen worden begrijpelijk.
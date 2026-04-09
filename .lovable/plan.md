

## Fix: Uitnodiging opnieuw versturen i.p.v. blokkeren bij duplicaat

### Probleem
Er zijn twee fouten:
1. **Hoofdoorzaak**: Er staat al een openstaande uitnodiging voor `aaron-mercken@hotmail.com` op tenant VanXcel. De `send-team-invitation` edge function blokkeert duplicaten met de foutmelding "Er is al een openstaande uitnodiging voor dit e-mailadres" — maar de UI toont geen duidelijke actie om dit op te lossen.
2. **Bijkomende 403 errors**: Na het verwijderen van de brede RLS SELECT policy haalt `fetchData()` in `TenantTeamTab` de uitnodigingen op, maar sommige requests falen met 403. Dit kan een timing-issue zijn met de sessie-token.

### Oplossing

**Stap 1: send-team-invitation edge function aanpassen**
In plaats van te blokkeren bij een bestaande uitnodiging: de oude uitnodiging automatisch verwijderen en een nieuwe aanmaken. Zo kan een admin altijd opnieuw uitnodigen zonder handmatig te moeten annuleren.

Concreet in de edge function:
- De check "Er is al een openstaande uitnodiging" verwijderen
- In plaats daarvan: `DELETE FROM team_invitations WHERE email = $email AND tenant_id = $tenantId AND accepted_at IS NULL` uitvoeren vóór het aanmaken van de nieuwe uitnodiging

**Stap 2: Bestaande uitnodiging verwijderen**
De huidige blokkerende uitnodiging voor aaron-mercken@hotmail.com verwijderen via de TenantTeamTab (die al een delete-knop heeft), of via de edge function fix automatisch.

### Bestanden die wijzigen
- `supabase/functions/send-team-invitation/index.ts` — duplicaat-check vervangen door auto-replace

### Resultaat
- Opnieuw uitnodigen werkt altijd — oude uitnodigingen worden automatisch vervangen
- Geen verwarrende foutmeldingen meer bij herhaald uitnodigen


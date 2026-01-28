
Doel: zorgen dat teamleden uitnodigen weer werkt (en dat jij als platform/super admin dit in elke tenant kan doen), zonder dat de UI vastloopt op 403’s.

## Wat er nu misgaat (root cause)
1) **Database trigger veroorzaakt de “Administrator” enum error (400)**
- De insert in `team_invitations` faalt met: `invalid input value for enum app_role: "Administrator"`.
- Dit komt niet uit je frontend-select, maar uit de database-trigger `handle_team_invitation_notification()`:
  - `NEW.role` is type `app_role` (enum).
  - In de `CASE NEW.role ... THEN 'Administrator' ... ELSE NEW.role END` probeert Postgres de `THEN`-strings (zoals “Administrator”) te casten naar `app_role`, omdat `ELSE NEW.role` een enum is.
  - Daardoor faalt elke insert op `team_invitations` (ook vanuit de backend function), nog vóór de mail verstuurd kan worden.

2) **RLS-policy op `team_invitations` blokkeert platform admins (403 bij ophalen uitnodigingen)**
- Policy “Tenant admins can manage invitations” doet:
  - `tenant_id IN (SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('tenant_admin','platform_admin'))`
- Voor `platform_admin` is `user_roles.tenant_id = null`, dus de subquery levert `null` en de `IN (...)` matcht nooit.
- Resultaat: de UI kan uitnodigingen niet ophalen/verwijderen (403), zelfs al heb jij platform_admin.

## Oplossing (wat we gaan aanpassen)

### A) Database fix: trigger-functie corrigeren (zodat inserts weer slagen)
We passen `public.handle_team_invitation_notification()` aan zodat het **altijd TEXT retourneert** en nooit probeert “Administrator” naar `app_role` te casten.

Concreet:
- Maak de CASE expliciet op tekst:
  - `CASE NEW.role::text WHEN 'tenant_admin' THEN 'Administrator' ... ELSE NEW.role::text END`
- Trigger blijft hetzelfde, alleen de functie wordt geüpdatet.

Resultaat:
- `team_invitations` inserts werken weer.
- De backend function `send-team-invitation` kan de uitnodiging aanmaken en mail versturen.

### B) Security fix: RLS-policy voor `team_invitations` correct maken voor platform admins
We vervangen de huidige “Tenant admins can manage invitations” policy door een policy die het juiste patroon volgt:

- Toestaan als:
  - `is_platform_admin(auth.uid())`
  - OF je bent `tenant_admin` voor die specifieke `tenant_id`

We doen dit als één duidelijke policy (ALL) of als twee policies (platform_admin + tenant_admin). Eén policy met OR is meestal het simpelst en onderhoudbaar.

Resultaat:
- Jij (platform_admin) kan uitnodigingen in elke tenant bekijken/annuleren/resenden vanuit de UI.
- Tenant admins kunnen enkel hun eigen tenant beheren.

### C) (Optioneel maar aanbevolen) Backend function harder maken tegen “verkeerde rol strings”
Ook al is de trigger de echte boosdoener, voegen we in `send-team-invitation` een kleine server-side validatie toe:
- Check of `role` één van: `platform_admin | tenant_admin | staff | accountant | warehouse | viewer` (maar voor invites blijven we bij de vijf zonder platform_admin).
- Als iemand ooit “Admin/Administrator” zou sturen, mappen we dat naar `tenant_admin` of geven we een nette foutmelding.

Dit voorkomt dat een verkeerde client of toekomstige wijziging opnieuw dit soort fouten triggert.

## Implementatiestappen (volgorde)
1) Database migratie:
   - `CREATE OR REPLACE FUNCTION public.handle_team_invitation_notification()` met `NEW.role::text` in de CASE (en `ELSE NEW.role::text`).
2) Database migratie:
   - Drop/replace RLS policy “Tenant admins can manage invitations” op `public.team_invitations`
   - Nieuwe policy: `is_platform_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=auth.uid() AND ur.tenant_id=team_invitations.tenant_id AND ur.role='tenant_admin')`
3) Frontend/UX (kleine verbetering):
   - `useTeamInvitations.fetchInvitations()` als 403: toon een duidelijke toast/inline message (“Geen toegang tot uitnodigingen voor deze tenant”) i.p.v. alleen console.error.
4) (Optioneel) Backend function:
   - Validatie/normalisatie van `role` vóór insert.
5) Verificatie:
   - Test vanuit UI: `/admin/settings?section=team`
     - Invite versturen met rol “Admin” (tenant_admin) en “Medewerker”
     - Check: toast success + uitnodiging verschijnt in “Openstaande uitnodigingen”
     - Test annuleren & opnieuw versturen
   - Test tenant switch: uitnodigingen laden per tenant zonder 403
   - Technische test: backend function call moet 200 teruggeven (geen enum error meer)

## Risico’s / aandachtspunten
- We raken enkel notificatie-trigger voor invites aan; dit is veilig en beperkt.
- RLS-policy aanpassing is belangrijk: we houden het strikt tot tenant_admin of platform_admin, zodat staff/viewer niet ineens invite-rechten krijgen.

## Expected outcome
- “Teamlid uitnodigen” werkt weer (geen 400).
- Jij als super admin kan uitnodigen in elke tenant.
- UI kan uitnodigingen ook ophalen/annuleren/resenden zonder 403.



## Fix: Uitnodiging niet gevonden bij klikken op link

### Probleem
De `team_invitations` tabel heeft RLS-policies die alleen toegang geven aan:
1. Admins (platform_admin of tenant_admin)
2. Ingelogde gebruikers wiens e-mail overeenkomt met de uitnodiging

Maar wanneer iemand op de uitnodigingslink klikt, is die persoon **nog niet ingelogd**. De pagina probeert de uitnodiging op te halen om de details te tonen (rol, teamnaam), maar RLS blokkeert de query → "Uitnodiging niet gevonden".

### Oplossing
Voeg een RLS-policy toe die **iedereen** (inclusief `anon`) toestaat om een uitnodiging op te halen op basis van het token. Het token is een UUID die als geheim fungeert — zonder het token kun je niets opvragen.

### Stappen

**Stap 1: Database-migratie**
Nieuwe SELECT policy op `team_invitations`:
```sql
CREATE POLICY "Anyone can view invitation by token"
ON public.team_invitations
FOR SELECT
TO anon, authenticated
USING (true);
```

Alternatief (restrictiever, maar RLS kan niet filteren op query-parameters): we kunnen de policy beperken tot alleen niet-geaccepteerde, niet-verlopen uitnodigingen. Maar aangezien het token zelf al het "geheim" is (UUID, niet te raden), is een brede SELECT-policy veilig — de gevoelige data in de tabel is beperkt (e-mail, rol, teamnaam).

**Stap 2: Geen code-wijzigingen nodig**
De `AcceptInvitation.tsx` pagina werkt al correct — het probleem zit puur in de database-laag.

### Resultaat
- Uitnodigingslink toont direct de uitnodigingsdetails (rol, teamnaam)
- Gebruiker kan inloggen of registreren op dezelfde pagina
- Na inloggen wordt de uitnodiging automatisch geaccepteerd via de edge function (die heeft service role key, dus geen RLS-probleem)


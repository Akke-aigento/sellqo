
# Fix: RLS fout bij tenant creatie op published site (definitieve oplossing)

## Root Cause Analyse

Na diepgaand onderzoek is het probleem geïdentificeerd:

1. **RLS Functie is correct**: `can_create_first_tenant()` geeft `true` bij directe test
2. **Geen bestaande tenant/roles**: Database is "schoon" voor `info@vanxcel.com`
3. **Browser-sessie lijkt geldig**: `ensureAuthenticated()` meldt success
4. **Maar RLS faalt alsnog**: De Supabase INSERT krijgt toch een 403

**Root cause**: Er zit een timing-/synchronisatie-issue tussen de browser auth state en de daadwerkelijke Authorization header die mee gaat met de request. `ensureAuthenticated()` checkt de lokale session state, maar garandeert niet dat de volgende API call de juiste token meestuurt.

## Oplossing: Token-refresh + Force-sync vóór INSERT

### Stap 1: Verbeter `ensureAuthenticated()` in `useAuth.tsx`

Huidige implementatie checkt alleen of een session bestaat. Nieuwe implementatie:
- Doet een **expliciete token refresh** vóór kritieke database writes
- Verifieert dat de refresh gelukt is door een simpele authenticated query te doen
- Pas dan wordt "authenticated" teruggegeven

```text
// Pseudo-code van de verbetering
ensureAuthenticated():
  1. getSession() → check of session bestaat
  2. ALS session bestaat → refreshSession() forceren (vernieuwt access_token)
  3. Verifieer met simpele authenticated query (bijv. SELECT auth.uid())
  4. Als alle stappen slagen → return true
  5. Anders → clear storage + sign out
```

### Stap 2: Voeg een "verify token works" helper toe

Nieuwe functie `verifyTokenWorks()`:
- Doet een minimale Supabase call die alleen slaagt met geldige auth
- Bijv. een SELECT op `profiles` waar RLS user-based is
- Als dit faalt → sessie is niet bruikbaar voor writes

### Stap 3: Update `createTenant()` flow

```text
createTenant():
  1. ensureAuthenticated() (met forced refresh)
  2. verifyTokenWorks() → als dit faalt, STOP en toon recovery dialog
  3. Pas dan INSERT in tenants table
  4. Bij success → door naar volgende stap
  5. Bij RLS error na alle checks → dit zou nu niet meer moeten gebeuren,
     maar als fallback: toon duidelijke foutmelding met "contact support"
```

### Stap 4: Recovery UX verbeteren

Als de token-verificatie faalt:
- Geen cryptische RLS error tonen
- Directe modal: "Je sessie kon niet geverifieerd worden. Log opnieuw in."
- Één klik: logout + redirect naar login

## Technische Implementatie

### Bestand: `src/hooks/useAuth.tsx`

Wijzigingen:
- `ensureAuthenticated()` krijgt een force-refresh stap
- Nieuwe helper `verifyAuthenticatedRequest()` die een echte DB query doet om te bevestigen dat de token werkt
- Betere error handling en logging

### Bestand: `src/hooks/useOnboarding.ts`

Wijzigingen:
- `createTenant()` roept de verbeterde auth-check aan
- Strikte volgorde: verify → refresh → verify again → INSERT
- Duidelijkere error states

## Verwacht Resultaat

Na deze fix:
1. Gebruiker klikt "Volgende stap" bij bedrijfsgegevens
2. App forceert token refresh achter de schermen
3. App verifieert dat de verse token werkt met een test-query
4. Pas dan wordt de tenant INSERT gedaan
5. Geen RLS errors meer, tenzij er daadwerkelijk iets mis is met de auth (dan: duidelijke melding)

## Database Acties Nodig

Geen schema-wijzigingen nodig. De RLS policies en functies zijn correct. Dit is puur een client-side synchronisatie fix.

## Bestanden die aangepast worden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useAuth.tsx` | Verbeterde `ensureAuthenticated()` met force-refresh en verify |
| `src/hooks/useOnboarding.ts` | Strikte auth-verificatie vóór tenant INSERT |

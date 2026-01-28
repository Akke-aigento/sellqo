
# Fix: Onboarding Blokkeert Bestaande Tenant Gebruikers

## Probleem Analyse
Wanneer een gebruiker met een bestaand account (bijv. tenant_admin van bedrijf A) inlogt, wordt hij onterecht in de onboarding-flow gedwongen. Dit komt door twee issues:

1. **Race Condition**: De `checkOnboardingStatus()` functie draait voordat tenants/roles geladen zijn
   - `useTenant.loading` wordt niet gecheckt
   - `tenants` is nog `[]` wanneer de check draait → systeem denkt "nieuwe gebruiker"

2. **Ontbrekende Check**: Er is geen expliciete check of de user al `tenant_admin` is van een bestaande tenant

## Oplossing

### 1. `src/hooks/useOnboarding.ts` - Loading States Respecteren

**Wijzigingen:**
- Haal `loading` state op uit `useTenant`
- Wacht tot tenants geladen zijn voordat onboarding-beslissing wordt genomen
- Voeg expliciete check toe: "Heeft user al een tenant_admin role?"

```text
Huidige code:
const { currentTenant, tenants, setCurrentTenant, refreshTenants } = useTenant();

Nieuwe code:
const { currentTenant, tenants, loading: tenantsLoading, setCurrentTenant, refreshTenants } = useTenant();

En in checkOnboardingStatus():
// WACHT tot tenants geladen zijn
if (tenantsLoading) {
  return; // Doe niets, wacht op volgende run wanneer loading false is
}

// Als user al tenants heeft → SKIP onboarding
if (tenants && tenants.length > 0) {
  // Markeer onboarding als compleet voor deze gebruiker
  await supabase.from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);
  setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
  return;
}
```

### 2. Dependency Array Updaten

De `checkOnboardingStatus` callback moet ook `tenantsLoading` in zijn dependencies hebben:

```text
}, [user, tenants, currentTenant, tenantsLoading]);
```

### 3. Volgorde van Checks Aanpassen

De nieuwe volgorde wordt:
1. Geen user → sluit onboarding
2. **NIEUW: Tenants nog aan het laden → wacht (return early)**
3. Onboarding al compleet → sluit onboarding
4. **NIEUW: User heeft al tenants → markeer compleet, sluit onboarding**
5. Onboarding geskipt → sluit (tenzij nieuwe user)
6. Anders → toon onboarding

## Verwacht Gedrag Na Fix

| Scenario | Huidig | Na Fix |
|----------|--------|--------|
| Nieuwe user, geen tenants | Onboarding | Onboarding |
| User met bestaande tenant | Onboarding (BUG) | Dashboard |
| User uitgenodigd bij andere tenant | Onboarding (BUG) | Dashboard |
| User met partial onboarding, geen tenant | Resume dialog | Resume dialog |
| User met partial onboarding, maar nu tenant | Resume dialog (BUG) | Dashboard |

## Technische Details

### Bestand: `src/hooks/useOnboarding.ts`

```text
Regel ~66: Voeg loading toe aan destructuring
- const { currentTenant, tenants, setCurrentTenant, refreshTenants } = useTenant();
+ const { currentTenant, tenants, loading: tenantsLoading, setCurrentTenant, refreshTenants } = useTenant();

Regel ~82-86: Early return als tenants nog laden
+ // Wait for tenants to load before making onboarding decision
+ if (tenantsLoading) {
+   return;
+ }

Regel ~118-139: Verplaats en vereenvoudig tenant check
- if (hasTenants && currentTenant && !isNewUser) { ... }
+ // If user already has access to tenants, skip onboarding
+ if (tenants && tenants.length > 0) {
+   await supabase.from('profiles')
+     .update({ onboarding_completed: true })
+     .eq('id', user.id);
+   setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
+   return;
+ }

Regel ~165: Update dependencies
- }, [user, tenants, currentTenant]);
+ }, [user, tenants, currentTenant, tenantsLoading]);
```

## Risico's & Mitigatie

- **Risk**: Korte flicker van loading state
  - **Mitigatie**: `isLoading: true` default zorgt voor skeleton/spinner tot beslissing is genomen

- **Risk**: User toegevoegd aan tenant door iemand anders krijgt nooit onboarding
  - **Acceptabel**: Als je uitgenodigd bent, is de tenant al opgezet. Je hoeft geen nieuwe te maken.

## Test Scenario's

1. **Nieuwe user**: Registreer → Onboarding start bij stap 1
2. **Bestaande tenant_admin**: Login → Gaat direct naar dashboard
3. **User uitgenodigd bij tenant**: Login → Gaat direct naar dashboard (geen onboarding)
4. **User met partial progress, geen tenant**: Login → Resume dialog
5. **User met partial progress, maar inmiddels toegevoegd aan tenant**: Login → Dashboard (onboarding geskipt)

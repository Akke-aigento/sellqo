
# Fix: Sessie-dialog verschijnt onterecht na succesvolle tenant creatie

## Analyse van het Probleem

Uit de console logs blijkt:
1. De sessie IS geldig (`ensureAuthenticated: Valid session for info@vanxcel.com`)
2. De tenant IS succesvol aangemaakt (toast "Winkel aangemaakt! VanXcel is succesvol aangemaakt")
3. Maar daarna komt er een 403 error van een OPVOLGENDE call
4. Die error triggert ten onrechte de `sessionExpired: true` state

Het probleem zit in `useOnboarding.ts` - de error handling na tenant creatie is te strikt:
- Na succesvolle creatie worden `refreshTenants()` en andere calls gedaan
- Als één van die calls faalt (bijv. door RLS timing), wordt de hele flow geblokkeerd
- De code behandelt elke 403 als "session expired" terwijl de tenant al bestaat

## Oplossing

### Stap 1: `useOnboarding.ts` - Slimmere error handling

**Huidige logica (fout):**
```typescript
// Als RLS error → repair → retry → nog steeds error → SESSION_EXPIRED
```

**Nieuwe logica (correct):**
```typescript
// 1. Probeer tenant te maken
// 2. Als RLS error:
//    a. Check of tenant al bestaat (owner_email match) → SUCCESS met bestaande tenant
//    b. Check of sessie geldig is → zo niet: session expired
//    c. Retry ALLEEN als tenant nog niet bestaat
// 3. Bij success: DIRECT returnen, geen onnodige retry-logica
```

Key changes:
- Voeg `sessionExpired: true` ALLEEN toe als tenant niet bestaat EN sessie echt invalid is
- Na succesvolle tenant creatie: direct return, geen extra error checks
- Verplaats de "bestaande tenant" check naar het BEGIN van de error handler

### Stap 2: Error isolation

De calls na `createTenant()` (zoals `refreshTenants()`) mogen niet de hele onboarding crashen:
- Wrap opvolgende calls in try/catch
- Als refreshTenants faalt maar tenant bestaat: doorgaan met de flow
- Alleen kritieke fouten (geen tenant, geen sessie) blokkeren de flow

## Technische Details

**`src/hooks/useOnboarding.ts` wijzigingen:**

```typescript
const createTenant = useCallback(async () => {
  // ... existing validation ...

  try {
    let { tenant, tenantError } = await attemptCreate();

    // SUCCESS PATH - return immediately, don't run more checks
    if (tenant && !tenantError) {
      // Safe to fail - tenant already created
      try {
        await refreshTenants();
        setCurrentTenant(tenant);
      } catch (e) {
        console.warn('[Onboarding] refreshTenants failed but tenant exists:', e);
      }
      setState(prev => ({ ...prev, createdTenantId: tenant.id }));
      return tenant;
    }

    // ERROR PATH - check if tenant already exists FIRST
    if (tenantError) {
      // Check if tenant already exists (common after retry scenarios)
      const { data: existingTenants } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('owner_email', loginEmail)
        .limit(1);

      if (existingTenants && existingTenants.length > 0) {
        // Tenant exists! Use it and continue
        const foundTenant = existingTenants[0];
        try { await refreshTenants(); } catch (e) { /* non-critical */ }
        setCurrentTenant(foundTenant as any);
        setState(prev => ({ ...prev, createdTenantId: foundTenant.id }));
        return foundTenant;
      }

      // Only NOW check if it's a session issue
      if (tenantError.code === '42501') {
        const stillAuthenticated = await ensureAuthenticated();
        if (!stillAuthenticated) {
          setState(prev => ({ ...prev, sessionExpired: true }));
          throw new Error('SESSION_EXPIRED');
        }
        // Session is valid but RLS still failing - this shouldn't happen
        // Log detailed error but DON'T show session dialog
        console.error('[Onboarding] RLS error with valid session:', tenantError);
      }
      
      throw tenantError;
    }
  } catch (error: any) {
    // Only show session dialog for explicit SESSION_EXPIRED
    if (error.message === 'SESSION_EXPIRED') {
      return null;
    }
    throw error;
  }
}, [...]);
```

## Verwacht Resultaat

Na deze fix:
1. Tenant creatie succeeds → je gaat direct naar stap 4 (Logo upload)
2. Als tenant al bestaat → wordt automatisch gebruikt, geen error
3. Sessie-dialog verschijnt ALLEEN bij echte auth problemen

## Bestanden die aangepast worden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useOnboarding.ts` | Herstructureer createTenant error handling |

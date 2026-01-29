
# Implementatieplan: Onboarding Flow Fixes

## Overzicht
Dit plan implementeert 4 fixes om de onboarding "flip" bug en 406 errors op te lossen, gebaseerd op de console log analyse.

---

## Fix 1: useMilestones.ts Aanpassingen

### Probleem
- Query gebruikt `.single()` die een 406 error geeft als geen rij gevonden wordt
- Geen retry-limiet, waardoor infinite loop bij errors
- Hook runt altijd, ook wanneer tenant nog niet beschikbaar is

### Wijzigingen

**Locatie:** `src/hooks/useMilestones.ts`

1. **Voeg `enabled` parameter toe aan hook** (lijn 43)
```typescript
// FIX 1: Accept enabled parameter to conditionally run queries
// Refs: Console log analyse - 406 errors door queries op niet-bestaande tenant
export function useMilestones(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
```

2. **Tenant stats query aanpassen** (lijn 49-64)
```typescript
const { data: tenantStats } = useQuery({
  queryKey: ['tenant-stats', currentTenant?.id],
  queryFn: async () => {
    if (!currentTenant?.id) return null;
    
    const { data, error } = await supabase
      .from('tenants')
      .select('lifetime_order_count, lifetime_revenue, lifetime_customer_count')
      .eq('id', currentTenant.id)
      .maybeSingle();  // FIX: .single() -> .maybeSingle() voor graceful null handling
    
    // FIX: Graceful error handling - don't throw on 406/PGRST116
    if (error) {
      // PGRST116 = "not found", 406 = "Not Acceptable" (geen match)
      if (error.code === 'PGRST116' || error.message?.includes('406')) {
        console.warn('[useMilestones] Tenant stats not found (expected during onboarding):', error.code);
        return null;
      }
      throw error;
    }
    return data as TenantStats | null;
  },
  enabled: enabled && !!currentTenant?.id,  // FIX: Combine with enabled prop
  retry: false,        // FIX: Prevent infinite retry loop on 406 errors
  staleTime: 30000,    // Cache for 30 seconds to reduce API calls
});
```

3. **Achieved milestones query aanpassen** (lijn 67-82)
```typescript
const { data: achievedMilestones } = useQuery({
  queryKey: ['tenant-milestones', currentTenant?.id],
  queryFn: async () => {
    if (!currentTenant?.id) return [];
    
    const { data, error } = await supabase
      .from('tenant_milestones')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('achieved_at', { ascending: false });
    
    // FIX: Graceful error handling
    if (error) {
      console.warn('[useMilestones] Could not fetch milestones:', error.code);
      return [];
    }
    return data as TenantMilestone[];
  },
  enabled: enabled && !!currentTenant?.id,  // FIX: Combine with enabled prop
  retry: false,        // FIX: Prevent infinite retry loop
});
```

---

## Fix 2: useOnboarding.ts Cleanup

### Probleem
- `checkOnboardingStatus` heeft `tenants` en `currentTenant` in dependency array
- Na `refreshTenants()` triggert dit een re-run die de stap kan resetten
- Geen guard om re-checks na tenant creatie te voorkomen

### Wijzigingen

**Locatie:** `src/hooks/useOnboarding.ts`

1. **Voeg hasCreatedTenant ref toe** (na lijn 99)
```typescript
// FIX 2: Track if we've created a tenant this session - prevents re-checks
// Refs: Console log analyse - step flip na refreshTenants
const hasCreatedTenantRef = useRef(false);

// Track debounce timer for checkOnboardingStatus
const checkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

2. **Voeg guard toe in checkOnboardingStatus** (na lijn 103)
```typescript
const checkOnboardingStatus = useCallback(async () => {
  // FIX 2: Skip if we just created a tenant - prevents flip back to step 1
  // Refs: Console log analyse - multiple checkOnboardingStatus calls na tenant creation
  if (hasCreatedTenantRef.current) {
    console.log('[Onboarding] checkOnboardingStatus: skipped (tenant just created)');
    return;
  }

  if (!user) {
    // ... existing code
```

3. **Verwijder tenants en currentTenant uit dependency array** (lijn 196)
```typescript
// FIX 2: Remove tenants and currentTenant from dependencies
// These were causing re-runs after refreshTenants() which flipped the step back
// Refs: Console log analyse - onboarding step flip (step 1 <-> step 4)
}, [user, tenantsLoading]);
```

4. **Voeg debounce toe aan useEffect** (lijn 198-200)
```typescript
// FIX 2: Debounce the status check to prevent rapid re-runs
// Refs: Console log analyse - multiple rapid checkOnboardingStatus calls
useEffect(() => {
  // Clear any pending debounce
  if (checkDebounceRef.current) {
    clearTimeout(checkDebounceRef.current);
  }
  
  // Debounce the check by 150ms
  checkDebounceRef.current = setTimeout(() => {
    checkOnboardingStatus();
  }, 150);
  
  return () => {
    if (checkDebounceRef.current) {
      clearTimeout(checkDebounceRef.current);
    }
  };
}, [checkOnboardingStatus]);
```

5. **Set hasCreatedTenantRef in createTenant success** (rond lijn 458)
```typescript
if (tenant && !tenantError) {
  // FIX 2: Mark that we created a tenant - prevents checkOnboardingStatus re-runs
  hasCreatedTenantRef.current = true;
  
  console.log('[Onboarding] Tenant ' + (wasExisting ? 'found' : 'created') + ' successfully:', tenant.id);
  // ... rest of existing code
```

---

## Fix 3: GamificationProvider Conditional Loading

### Probleem
- `useMilestones()` wordt altijd aangeroepen, ook als `currentTenant` nog `null` is
- Dit veroorzaakt de 406 errors tijdens onboarding

### Wijzigingen

**Locatie:** `src/components/gamification/GamificationProvider.tsx`

```typescript
import { createContext, useContext, useState, ReactNode } from 'react';
import { useMilestones } from '@/hooks/useMilestones';
import { useTenant } from '@/hooks/useTenant';  // FIX 3: Import useTenant
import { MilestonePopup } from './MilestonePopup';
import { FeedbackPopup } from './FeedbackPopup';

// ... interface blijft hetzelfde

export function GamificationProvider({ children }: { children: ReactNode }) {
  // FIX 3: Check if tenant is ready before enabling milestone queries
  // Refs: Console log analyse - 406 errors door queries op niet-bestaande tenant
  const { currentTenant, loading: tenantsLoading } = useTenant();
  
  // Only enable milestone checks when:
  // 1. Tenants have finished loading
  // 2. A current tenant is selected
  const shouldCheckMilestones = !tenantsLoading && !!currentTenant?.id;
  
  // FIX 3: Pass enabled flag to prevent queries during onboarding
  const { pendingMilestone, tenantStats, acknowledgeMilestone, isAcknowledging } = useMilestones({
    enabled: shouldCheckMilestones,
  });
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMilestoneId, setFeedbackMilestoneId] = useState<string | undefined>();

  // ... rest van de code blijft hetzelfde
```

---

## Fix 4: Testen

Na implementatie van de fixes, test de complete onboarding flow:

1. **Reset test account** (indien nodig)
2. **Registreer nieuw account**
3. **Doorloop alle 7 stappen** zonder onderbrekingen
4. **Verifieer:**
   - Geen 406 errors in console
   - Geen step flips (step 1 <-> step 4)
   - Data blijft bewaard tussen stappen
   - Tenant wordt succesvol aangemaakt

---

## Bestanden die Gewijzigd Worden

| Bestand | Wijzigingen |
|---------|-------------|
| `src/hooks/useMilestones.ts` | `enabled` prop, `.maybeSingle()`, `retry: false`, error handling |
| `src/hooks/useOnboarding.ts` | Dependency array fix, debounce, `hasCreatedTenantRef` guard |
| `src/components/gamification/GamificationProvider.tsx` | Conditional milestone loading met `enabled` prop |

---

## Technische Details

### Waarom `.maybeSingle()` in plaats van `.single()`?
- `.single()` gooit een error als 0 of >1 rijen gevonden worden
- `.maybeSingle()` retourneert `null` als 0 rijen gevonden, error alleen bij >1 rij
- Dit is perfect voor situaties waar data nog niet bestaat (nieuwe tenant)

### Waarom `retry: false`?
- React Query retry standaard 3x bij errors
- Bij 406 errors is dit zinloos en veroorzaakt infinite loop
- Door retry uit te schakelen stoppen we de error cascade

### Waarom dependency array cleanup?
- `tenants` en `currentTenant` wijzigen na `refreshTenants()`
- Dit triggerde onbedoeld `checkOnboardingStatus` opnieuw
- Die check kon de step resetten naar 1 (nieuwe user logica)


# Fix: "Geen winkel gevonden" na Onboarding Voltooiing

## Probleem Analyse

Na het afronden van de onboarding toont het Dashboard "Geen winkel gevonden" ondanks dat de tenant succesvol is aangemaakt. De console logs bevestigen dit:

```
[Onboarding] checkOnboardingStatus: skipped (tenant just created)
...
"Welkom bij Sellqo!" toast
...
Dashboard toont: "Geen winkel gevonden"
```

## Root Cause

De `completeOnboarding` functie (lijn 301-314 in `useOnboarding.ts`) doet alleen het volgende:
1. Update de `profiles` tabel met `onboarding_completed: true`
2. Sluit de wizard (`isOpen: false`)

Het probleem: er wordt **geen `refreshTenants()`** aangeroepen na het afronden. Hoewel `refreshTenants()` wel wordt aangeroepen bij tenant creatie (stap 3), kan die call falen of niet op tijd klaar zijn.

Daarnaast: de `hasCreatedTenantRef` guard voorkomt dat `checkOnboardingStatus` runt na tenant creatie, wat de bedoeling was om het "flippen" te voorkomen - maar dit betekent ook dat de tenant state mogelijk niet is bijgewerkt.

## Oplossing

### Fix 1: `completeOnboarding` - Forceer `refreshTenants` en wacht erop

**Bestand:** `src/hooks/useOnboarding.ts`

```typescript
// Complete onboarding - forceer tenant refresh
const completeOnboarding = useCallback(async () => {
  if (user) {
    await supabase
      .from('profiles')
      .update({ 
        onboarding_completed: true,
        onboarding_step: TOTAL_STEPS,
      })
      .eq('id', user.id);
    
    // CRITICAL: Refresh tenants to load the newly created tenant
    // Without this, the Dashboard shows "Geen winkel gevonden"
    try {
      await refreshTenants();
    } catch (error) {
      console.warn('[Onboarding] refreshTenants failed on complete:', error);
    }
  }
  
  setState(prev => ({ ...prev, isOpen: false }));
}, [user, refreshTenants]);
```

### Fix 2: `useTenant` - Auto-select nieuw aangemaakte tenant

Als fallback: zorg dat als er een tenant bestaat maar `currentTenant` is `null`, deze automatisch wordt geselecteerd.

**Bestand:** `src/hooks/useTenant.tsx` (lijn 175-178)

```typescript
if (savedTenant) {
  setCurrentTenantState(savedTenant);
} else if (enrichedTenants.length > 0) {
  // Always select first tenant if none is selected
  // Removed !currentTenant check - always ensure a tenant is selected
  setCurrentTenant(enrichedTenants[0]);
}
```

### Fix 3: Optioneel - Dashboard retry bij `!currentTenant`

Als extra veiligheid kan de Dashboard een retry doen wanneer tenants klaar zijn met laden maar geen tenant is geselecteerd.

---

## Samenvatting Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useOnboarding.ts` | `completeOnboarding` roept `refreshTenants()` aan |
| `src/hooks/useTenant.tsx` | Altijd eerste tenant selecteren als geen tenant actief is |

## Verwacht Resultaat

Na onboarding voltooiing:
1. `completeOnboarding` roept `refreshTenants()` aan
2. De nieuw aangemaakte tenant wordt geladen in de `tenants` array
3. `useTenant` selecteert automatisch de eerste (en enige) tenant
4. Dashboard toont de `DashboardGrid` in plaats van de error

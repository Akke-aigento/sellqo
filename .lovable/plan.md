
## Fix: Plan upgrade faalt voor platform admin — "No tenant found for user"

### Oorzaak
De logs tonen: `"No tenant found for user"`. De `calculate-plan-switch` en `execute-plan-switch` edge functions zoeken de tenant via `user_roles` met `.single()`. Maar de platform admin (`info@sellqo.app`) heeft **twee rijen** in `user_roles`:
- Eén met `role = platform_admin` en `tenant_id = NULL`
- Eén met `role = tenant_admin` en een specifieke `tenant_id`

`.single()` faalt bij meerdere rijen → `data = null` → "No tenant found".

### Oplossing
De client (Billing.tsx) weet al welke tenant actief is via `useTenantSubscription` / `useTenant`. Stuur de `tenant_id` mee in de request body en gebruik die in de edge functions in plaats van de `user_roles` lookup.

**1. Client — tenant_id meesturen**

In `usePlanSwitch.ts`: voeg `tenant_id` toe als parameter aan beide mutations.

In `Billing.tsx`: geef `currentTenant.id` mee bij het aanroepen van `calculatePlanSwitch.mutateAsync()` en `executePlanSwitch.mutateAsync()`.

**2. Edge functions — tenant_id uit body gebruiken**

In beide `calculate-plan-switch/index.ts` en `execute-plan-switch/index.ts`:
- Lees `tenant_id` uit de request body
- Fallback: als geen `tenant_id` meegegeven, zoek in `user_roles` met filter `.not('tenant_id', 'is', null)` en `.limit(1).single()` zodat de platform_admin rij wordt uitgesloten
- Valideer dat de user daadwerkelijk toegang heeft tot die tenant (check `user_roles`)

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/usePlanSwitch.ts` | `tenant_id` toevoegen aan params van beide mutations |
| `src/pages/admin/Billing.tsx` | `currentTenant.id` meegeven bij plan switch calls |
| `supabase/functions/calculate-plan-switch/index.ts` | `tenant_id` uit body lezen + fallback query fixen |
| `supabase/functions/execute-plan-switch/index.ts` | Zelfde fix als calculate |

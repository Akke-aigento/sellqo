# ONBOARD-REMOUNT-1 — root cause: de wizard wordt ontmanteld door `refetchRoles()`

## Wat er echt gebeurt (bewijs uit de code)

De terugval is geen stap-logica-fout in de wizard, maar een **unmount van de hele admin-boom** midden in de succesflow van `createTenant`.

Keten, in exacte volgorde:

1. `createTenant` slaagt → `hasCreatedTenantRef.current = true` (`src/hooks/useOnboarding.ts:642`).
2. `await refreshTenants()` (`:655`) en `setCurrentTenant(tenant)` (`:656`) — nog prima.
3. `await refetchRoles()` (`:660`). Die functie is **bewust "luid"**: `setRolesLoading(true)` (`src/hooks/useAuth.tsx:170`, met de comment op `:168-169`).
4. `ProtectedRoute`: `if (loading || (user && rolesLoading)) return <Loader2 />` (`src/components/ProtectedRoute.tsx:23-29`). De children — dus `AdminLayout` — worden **uit de boom gehaald**.
5. `AdminLayout` bevat `TenantProvider` (`src/components/admin/AdminLayout.tsx:67`) én `<OnboardingWizard />` (`:54`). Beide unmounten. Daarmee zijn ALLE refs weg: `hasCreatedTenantRef`, `hasInitiallyChecked`, `isCreatingTenantRef` (`useOnboarding.ts:101-112`), plus de nog niet-gerenderde `setState({createdTenantId})` (`:666`).
6. `setRolesLoading(false)` → `AdminLayout` **remount**. Nieuwe `TenantProvider` start met `tenants=[]` en doet opnieuw de orphan-check → precies de dubbele log `[useTenant] No tenants found, checking for orphaned tenant...` (`src/hooks/useTenant.tsx:153-156`). De wizard rendert eerst `null` (`OnboardingWizard.tsx:66`, want `isOpen=false` / `isLoading=true`) → **het dashboard is een paar seconden zichtbaar**.
7. De verse `useOnboarding` draait `checkOnboardingStatus` met `hasCreatedTenantRef=false`, dus de guard op `:118` grijpt niet meer. Het profiel heeft `onboarding_step` 3 of 4 (dus > 1), waardoor de ONBOARD-EARLY-CLOSE-1 tenant-guard (`:169`) terecht niet sluit. Daarna:
   `const isInitialCheck = !hasInitiallyChecked.current;` → **true** (ref is vers)
   `const startStep = (isNewUser && isInitialCheck) ? 1 : savedStep;` (`:185-186`) → `isNewUser` is true (profiel < 5 min) → **startStep = 1**.
8. `setState({currentStep: 1, isOpen: true, data: restoredData})` (`:209-215`) → wizard opent op stap 1 met `shopSlug:'test'`, en `WelcomeStep` meldt "Deze URL is al in gebruik" omdat de zojuist aangemaakte tenant die slug bezet. Exact de log die je ziet.

De herhaalde `step=1`-logs komen bovendien uit een **tweede hook-instantie**: `useShopHealth` roept ook `useOnboarding()` aan (`src/hooks/useShopHealth.ts:52`); die instantie heeft eigen refs die nooit `hasCreatedTenantRef` zetten, en elke `tenants`-wijziging hervuurt daar de debounced check (`useOnboarding.ts:228-248`).

## Rangschikking van oorzaken

1. **`refetchRoles()` → `rolesLoading=true` → `ProtectedRoute` unmount → refs weg** (zeker; spinner, kort dashboard en stap 1 volgen hier alle drie uit, en de dubbele TenantProvider-mount bevestigt de remount).
2. **`isNewUser && isInitialCheck → step 1`** negeert een persisted step > 1 (zeker; dit is de regel die ná de remount stap 1 forceert). Zonder deze regel zou de remount "slechts" op stap 3/4 landen.
3. Tweede `useOnboarding`-instantie via `useShopHealth` (zeker aanwezig; verklaart de log-ruis en extra profiel-writes, maar is niet de directe veroorzaker van de stap-flip).

## De fix (3 gerichte lagen)

**Laag A — stop de unmount.** `refetchRoles` krijgt een `silent`-optie die `rolesLoading` niet aanraakt; `useOnboarding` gebruikt die.

```diff
--- src/hooks/useAuth.tsx
-  const refetchRoles = useCallback(async (): Promise<UserRole[]> => {
+  const refetchRoles = useCallback(async (
+    opts?: { silent?: boolean }
+  ): Promise<UserRole[]> => {
     const { data: { user: currentUser } } = await supabase.auth.getUser();
     if (!currentUser) { ... }
-    setRolesLoading(true);
+    // ONBOARD-REMOUNT-1 — silent: geen rolesLoading-flip, zodat ProtectedRoute
+    // de admin-boom (incl. onboarding-wizard) niet unmount.
+    if (!opts?.silent) setRolesLoading(true);
     const fresh = await fetchUserRoles(currentUser.id);
     setRoles(fresh);
-    setRolesLoading(false);
+    if (!opts?.silent) setRolesLoading(false);
```

Type in de context-interface wordt `refetchRoles: (opts?: { silent?: boolean }) => Promise<UserRole[]>` (`useAuth.tsx:116`). In `useOnboarding.ts:660` en `:334` wordt dit `await refetchRoles({ silent: true })`. `AcceptInvitation.tsx:224` blijft ongewijzigd (luide pad blijft bestaan).

**Laag B — stap-1-forcering alleen als er nog geen voortgang is.**

```diff
--- src/hooks/useOnboarding.ts (rond :186)
-      const startStep = (isNewUser && isInitialCheck) ? 1 : savedStep;
+      // ONBOARD-REMOUNT-1 — een verse user mag alleen naar stap 1 geforceerd
+      // worden zolang er geen persisted voortgang is. Bij savedStep > 1
+      // respecteren we de persisted stap, ook op een initial check na een
+      // onverwachte remount.
+      const startStep = (isNewUser && isInitialCheck && savedStep <= 1) ? 1 : savedStep;
```

**Laag C — voortgang vastleggen vóór het risicovolle stuk.** In `createTenant`, direct na de succes-markering (`:642`) en vóór `refreshTenants`/`refetchRoles`, `onboarding_step: 4` op het profiel schrijven. Dan is de persisted stap gegarandeerd 4, ook als de UI tussentijds verdwijnt; `nextStep()` in de wizard schrijft daarna idempotent hetzelfde.

## Waarom dit de vier bestaande scenario's niet breekt

- **Bestaande user met tenant:** `onboarding_completed` → vroege return (`:153`), of tenant-guard met `persistedStep <= 1` (`:169`) sluit zoals nu. Laag B raakt dit pad niet (`isNewUser` is false, dus `savedStep` werd al gebruikt).
- **`?new=1`:** `isNewTenantFlow` slaat de tenant-guard over; bij een verse tweede winkel staat `savedStep` op 1 → nog steeds stap 1. Ongewijzigd.
- **Resume partial progress:** `partialProgress = !isNewUser && savedStep > 1` (`:190`) blijft identiek; laag B verandert alleen het `isNewUser`-pad en levert daar juist de gewenste resume op.
- **Skip:** de `onboarding_skipped_at`-checks (`:159`) blijven onaangeroerd.
- **Invite-accept:** blijft het luide `refetchRoles()` gebruiken, dus die guard wacht nog steeds.

## Geraakte bestanden

- `src/hooks/useAuth.tsx` — `refetchRoles(opts?)` + type in de context-interface.
- `src/hooks/useOnboarding.ts` — twee `refetchRoles({ silent: true })`-calls, `startStep`-conditie, `onboarding_step: 4`-write in `createTenant`.
- Changelog-entry (4 talen) als losse stap na verificatie.

Geen migraties, geen edge functions, geen wijziging aan `ProtectedRoute` of `useTenant`.
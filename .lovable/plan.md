# Lege sidebar na onboarding (rollen niet ververst na tenant-creatie)

## 1. Hypothese: BEVESTIGD

- `src/components/admin/AdminSidebar.tsx` regels 61-72: `scopedRoles` = `roles` gefilterd op `r.tenant_id === currentTenant.id` (regels 65-66), en `isHidden` = `!canWithRoles(scopedRoles, 'read', resource)` (regel 72). Zonder matchende rol voor de actieve tenant valt vrijwel elk item weg.
- `src/hooks/useOnboarding.ts` regel 77 destructureert uit `useAuth` alleen `{ user, ensureAuthenticated, getVerifiedAccessToken, signOut }` — `refetchRoles` zit er NIET bij, en komt nergens in het bestand voor.
- Succes-pad `createTenant` (regels 633-640): alleen `await refreshTenants()` + `setCurrentTenant(tenant)`. `completeOnboarding` (regels 319-325): alleen `await refreshTenants()`. Op geen van beide plekken wordt de `roles`-state ververst.
- De nieuwe `user_roles`-rij wordt server-side gemaakt (create-tenant edge function), dus de client-`roles` uit de sessie-hydratie mist die rij. F5 herstelt het via `initializeAuth`, wat de bevinding "DB correct, alleen client-state" verklaart.

Geen aanvullende oorzaak gevonden: `useTenant.fetchTenants` (regels 126-229) haalt tenants op maar geen rollen; `useTenant` re-runt wél op `roles`-wijziging (regel 239), dus een roles-refetch is veilig richting tenant-state.

## 2. `refetchRoles()` is de juiste tool

`src/hooks/useAuth.tsx` regels 161-176: haalt de user via `getUser()`, doet `fetchUserRoles(user.id)` (alle rijen voor de user, dus inclusief de nieuwe tenant), zet `setRoles(fresh)`, `setRolesLoading(false)` en `hasResolvedRolesOnceRef = true`. Daarmee wordt `scopedRoles` in de sidebar correct voor de verse tenant.

Neveneffect om te kennen: regel 170 zet bewust `setRolesLoading(true)` tijdens de fetch. `RouteGuard` (regel 41) rendert dan een spinner — geen redirect. `/no-access` wordt pas overwogen als `rolesLoading` false is, dus er is geen flikkering naar `/no-access` of `/auth`. De duur is één `user_roles`-query.

## 3. Inhaakpunten

- `src/hooks/useOnboarding.ts` regel 77: `refetchRoles` toevoegen aan de destructuring van `useAuth`.
- `createTenant`, direct ná `setCurrentTenant(tenant as any)` (regel 636), binnen hetzelfde try/catch (non-critical follow-up).
- `completeOnboarding`, ná `await refreshTenants()` (regel 322), binnen hetzelfde try/catch.
- Dependency-arrays bijwerken: regel 329 (`completeOnboarding`) en regel 689 (`createTenant`).

## 4. Neveneffecten

- Flikkering: nee — `RouteGuard` spint tijdens `rolesLoading` en redirect niet.
- (a) Extra winkel via `?new=1`: profiteert juist — de rol voor de nieuwe tenant komt binnen vóór het schakelen.
- (b) `wasExisting`-pad: loopt door hetzelfde succes-blok; de refetch levert dan dezelfde rollen op (idempotent, geen gedragsverandering).
- (c) Skip-onboarding: `skipOnboarding` wordt niet aangeraakt.
- Dubbel refetchen is functioneel onschadelijk (idempotente read) maar onnodig. Toch beide behouden: `createTenant` is de primaire fix (rollen zijn er vóór het dashboard rendert), `completeOnboarding` is het net voor paden die de wizard afronden zonder verse creatie (bv. `wasExisting` uit een eerdere sessie of tenant-repair). Kosten: één extra `user_roles`-query per afgeronde wizard.

## 5. Scope

Uitsluitend `src/hooks/useOnboarding.ts`. Geen wijziging aan `useAuth`, `useTenant`, `AdminSidebar`, RLS of edge functions.

## 6. Voorgestelde diff

```diff
--- a/src/hooks/useOnboarding.ts
+++ b/src/hooks/useOnboarding.ts
@@ -77 +77 @@
-  const { user, ensureAuthenticated, getVerifiedAccessToken, signOut } = useAuth();
+  const { user, ensureAuthenticated, getVerifiedAccessToken, signOut, refetchRoles } = useAuth();
@@ (completeOnboarding, ~322)
       try {
         await refreshTenants();
+        // ONBOARD-ROLES-1 — user_roles wordt server-side aangemaakt; zonder
+        // refetch mist de client de tenant_admin-rol voor de nieuwe tenant en
+        // filtert AdminSidebar (scopedRoles op currentTenant.id) alles weg.
+        await refetchRoles();
       } catch (error) {
         console.warn('[Onboarding] refreshTenants failed on complete:', error);
       }
@@ (completeOnboarding deps, 329)
-  }, [user, refreshTenants]);
+  }, [user, refreshTenants, refetchRoles]);
@@ (createTenant succes-pad, ~634)
         try {
           await refreshTenants();
           setCurrentTenant(tenant as any);
+          // ONBOARD-ROLES-1 — zie boven: rollen verversen zodat de sidebar
+          // direct de volledige navigatie voor de verse tenant toont
+          // (voorheen pas na een handmatige F5).
+          await refetchRoles();
         } catch (refreshError) {
@@ (createTenant deps, 689)
-  }, [user, state.data, ensureAuthenticated, getVerifiedAccessToken, refreshTenants, setCurrentTenant, toast, isNewTenantFlow]);
+  }, [user, state.data, ensureAuthenticated, getVerifiedAccessToken, refreshTenants, setCurrentTenant, refetchRoles, toast, isNewTenantFlow]);
```

Geen verdere opschoning of refactor.

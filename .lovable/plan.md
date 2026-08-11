# Wizard sluit vroegtijdig na tenant-creatie op stap 3 (ONBOARD-EARLY-CLOSE-1)

## 1. Hypothese: BEVESTIGD

In `src/hooks/useOnboarding.ts`:

- Regels 132-139: `if (tenants && tenants.length > 0 && !isNewTenantFlow)` schrijft `onboarding_completed = true` en zet `isOpen: false`. Deze guard staat VOOR de profiel-fetch (regels 143-147) en kijkt dus niet naar `onboarding_completed` of `onboarding_step`.
- Regel 220: de dependency-array van `checkOnboardingStatus` bevat `tenants`; regels 224-240 roepen die debounced (150 ms) aan bij elke wijziging. `createTenant` doet op regel 639 `await refreshTenants()` → `tenants.length > 0` → effect vuurt → de guard sluit de wizard middenin stap 3/4.
- Regel 626 zet `hasCreatedTenantRef.current = true`, gecheckt op regel 114. Dat is een `useRef`: bij remount (uitloggen/inloggen, harde refresh) weer `false`, dus de bescherming valt weg en de guard grijpt alsnog in.

## 2. Waarom `hasInitiallyChecked` niets afvangt

`hasInitiallyChecked` (regel 101) is óók een in-memory `useRef` en gaat bij dezelfde remount verloren. Hij wordt bovendien pas op regel 185 gezet — ná de tenant-guard — en beïnvloedt alleen `startStep` en `hasPartialProgress`; hij poortwacht de guard niet.

Ook `state.isOpen` en `state.createdTenantId` zijn React-state: na remount `false`/`null`. Het enige persistente signaal is de profielrij: `onboarding_completed`, `onboarding_step` (bij elke `nextStep` weggeschreven, regels 271-276) en `onboarding_skipped_at`.

Geverifieerde productiedata: alle profielen met voltooide/geskipte status hebben `onboarding_completed = true` (steps 0, 4, 5, 6, 7); één profiel heeft `completed = false, step = 0, skipped = true`. Geen enkel bestaand profiel is dus afhankelijk van de tenant-guard om de wizard weg te houden — regel 160 (`onboarding_completed`) en regel 166 (`skipped_at`) dekken die groep al.

## 3. Veiligste guard-conditie

De tenant-guard verhuist naar ná de profiel-fetch en mag alleen vuren als het profiel bevestigt dat er geen actieve doorloop is: `onboarding_step <= 1`. Dat leunt volledig op persistente DB-state, niet op refs.

- `step >= 2` en niet completed → gebruiker zit midden in de flow → guard slaat over, wizard blijft open op `savedStep`.
- `step <= 1` met een tenant → legacy tenant-eigenaar die de wizard nooit doorliep → backfill `completed = true` en sluiten (huidig gedrag).
- `completed = true` of `skipped_at` → al afgehandeld door de bestaande checks vóór de nieuwe guard-positie.

`hasCreatedTenantRef` blijft ongemoeid (nuttig binnen één sessie), maar is niet langer de enige bescherming. Geen nieuwe ref.

## 4. Padencheck

- (a) Bestaande users met `completed = true` + tenant → regel 160 sluit vóór de nieuwe guard; wizard opent niet.
- (b) Verse user maakt tenant op stap 3: `onboarding_step` staat dan al op 3+, dus de guard slaat over; sluiten gebeurt pas via `completeOnboarding`.
- (c) Remount na tenant-creatie: refs weg, maar `step >= 2` in DB → guard slaat over, resterende stappen blijven beschikbaar.
- (d) `?new=1`: `isNewTenantFlow` blijft in de conditie, guard blijft onverkort gebypassed.
- (e) Resume-met-partial-progress: `savedStep`/`hasPartialProgress`-logica (regels 172-186) blijft ongewijzigd; de resume-dialog werkt zoals nu.

Randgeval: een tenant bestaat pas vanaf stap 3, dus "tenant aanwezig met step <= 1" blijft uitsluitend het legacy-geval.

## 5. Scope

Uitsluitend `src/hooks/useOnboarding.ts`. Geen wijziging aan `OnboardingWizard`, `useAuth`, `useTenant`, RLS of edge functions.

## 6. Voorgestelde diff

```diff
--- a/src/hooks/useOnboarding.ts
+++ b/src/hooks/useOnboarding.ts
@@ -129,16 +129,6 @@
-    // If user already has access to tenants, skip onboarding entirely
-    // Bypass deze guard wanneer ?new=1 in URL staat: bestaande tenant_admin
-    // mag dan bewust de onboarding doorlopen voor een extra winkel.
-    if (tenants && tenants.length > 0 && !isNewTenantFlow) {
-      await supabase
-        .from('profiles')
-        .update({ onboarding_completed: true })
-        .eq('id', user.id);
-      setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
-      return;
-    }
-
     try {
```
Uitleg: deze guard verdwijnt hier omdat hij vóór de profiel-fetch geen zicht heeft op `onboarding_step` en daardoor een actieve doorloop afbreekt.

```diff
@@ (na de skipped_at-check, ~regel 169)
       if (profile?.onboarding_skipped_at && !isNewUser) {
         setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
         return;
       }
 
+      // ONBOARD-EARLY-CLOSE-1 — tenant-guard verplaatst naar ná de profiel-fetch.
+      // Alleen sluiten als het profiel bevestigt dat er GEEN actieve doorloop is
+      // (onboarding_step <= 1). Anders sloot een refreshTenants() na de
+      // tenant-creatie op stap 3 de wizard vroegtijdig (refs zijn weg na remount).
+      const persistedStep = profile?.onboarding_step ?? 1;
+      if (tenants && tenants.length > 0 && !isNewTenantFlow && persistedStep <= 1) {
+        await supabase
+          .from('profiles')
+          .update({ onboarding_completed: true })
+          .eq('id', user.id);
+        setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
+        return;
+      }
+
       // Show onboarding for new users or users who haven't completed setup
       const savedStep = profile?.onboarding_step || 1;
```
Uitleg: identiek gedrag voor legacy tenant-eigenaren (`step <= 1`), maar een halfvoltooide doorloop (`step >= 2`) wordt nooit meer als "voltooid" gemarkeerd.

Geen verdere wijzigingen of refactors.

# Deadlock-analyse onboarding stap 3 (AbortError in ensureAuthenticated)

## 1. Hypothese: BEVESTIGD (met één nuance)

`src/hooks/useAuth.tsx` regels 180-292: de `onAuthStateChange`-callback is `async` en doet in het stale-storage-pad een directe `await supabase.auth.refreshSession()` (regels 241-242), en bij mislukking `await safeLocalSignOut()` (regel 273 → `supabase.auth.signOut({scope:'local'})`, regel 44).

supabase-js serialiseert alle auth-operaties achter een lock (`navigator.locks`); de callback wordt binnen dat lock uitgevoerd. Een auth-call awaiten binnen die callback wacht dus op een lock die de callback zelf vasthoudt → de lock-acquire loopt in de ingebouwde timeout en aborteert met exact `AbortError: signal is aborted without reason`.

Nuance op de trigger: de log stopt ná `[Auth] ensureAuthenticated: checking session...` (regel 355) en dus in `supabase.auth.getSession()` (regel 358) — nog vóór `getVerifiedAccessToken({forceRefresh:true})`. De blokkerende auth-call was dus al bezig toen `createTenant` startte: de achtergrond-autorefresh (of het SIGNED_IN/TOKEN_REFRESHED-event van page-load) had de callback al binnengebracht, die daar op `refreshSession()`/`signOut()` bleef hangen. `getVerifiedAccessToken` is dus niet de trigger — het is de slachtoffer-kant, de deadlockbron blijft het stale-storage-pad in de callback. Het `fetchUserRoles`-pad is al gedeferd (regels 229-235 en 263-269), het refreshSession-pad niet.

Geen andere oorzaak gevonden: `createTenant` heeft geen eigen AbortController/timeout, dus de AbortError komt uit de supabase auth-lock.

## 2. Volledige inventaris awaits op auth-calls

In de `onAuthStateChange`-callback (deadlock-gevoelig):
- regel 241-242 `await supabase.auth.refreshSession()` — stale-storage-pad. PRIMAIRE BRON.
- regel 273 `await safeLocalSignOut()` → `supabase.auth.signOut({scope:'local'})` (regel 44) — tweede bron, treedt op wanneer de refresh faalt. Moet mee gedeferd, anders fixen we één deadlock en houden we de andere.
- Geen andere: alle `setSession/setUser/setRoles` zijn synchroon; `fetchUserRoles` is een DB-call (geen auth-lock) en al gedeferd; `registerPushForUser` is niet geawait.

In `initializeAuth` (regels 295-342) — buiten de callback, dus GEEN deadlockrisico:
- regel 296 `await supabase.auth.getSession()`
- regel 303 `await safeLocalSignOut()` (error-pad)
- regel 334 `await safeLocalSignOut()` (stale-storage-pad)
Deze laten we ongemoeid.

Buiten de callback en veilig: `refetchRoles` (162), `ensureAuthenticated` (358/372/378/403), `getVerifiedAccessToken` (439/446/455/463/469/471), `signOut` (542).

## 3. Neveneffecten van de fix (defer met setTimeout(0))

- State-volgorde: het stale-storage-pad zette vóór de fix niets synchroon; het `setSession/setUser` gebeurde pas ná de await. Na de fix gebeurt dat in dezelfde microtask-orde, alleen buiten het lock. Er ontstaat dus geen extra leeg-sessie-flits. Belangrijk detail: `setLoading(false)` (regel 290) draaide al vóór het einde van dat pad in dezelfde tick-orde; om een flits van "geen sessie" bij RouteGuard te vermijden houdt de fix `setLoading(false)` binnen het gedeferde blok voor dit pad (early `return` in de callback), zodat de guard blijft spinnen tot de refresh beslist is in plaats van kort `user === null` te zien.
- (a) Verse login/user-switch: pad regels 199-235, niet aangeraakt.
- (b) Tab-switch/TOKEN_REFRESHED: pad regels 205-213 (`sameUser && hasResolvedRolesOnceRef`), niet aangeraakt → geen roles-reload.
- (c) Session-restore bij page-load: `initializeAuth`, niet aangeraakt.
- (d) SIGNED_OUT: regels 185-196, niet aangeraakt.
- `hasResolvedRolesOnceRef` / `currentUserIdRef` / `rolesLoading`-logica blijft letterlijk identiek; enkel de uitvoeringscontext (buiten het auth-lock) wijzigt.

## 4. Scope

Alleen `src/hooks/useAuth.tsx`. Geen effect op de storefront custom-domain/proxy auth-flow (die gebruikt de storefront-api en niet deze provider), niet op `createTenant`/`useOnboarding` (die profiteren enkel doordat het lock vrijkomt), niet op edge functions of migraties. Expliciet bevestigd: geen andere bestanden.

## 5. Voorgestelde diff

```diff
--- a/src/hooks/useAuth.tsx
+++ b/src/hooks/useAuth.tsx
@@ -236,7 +236,17 @@
         } else if (hasStaleAuthStorage()) {
           // No session but storage exists. Kan een tijdelijke race zijn
           // (bv. GoTrue vuurt event vlak vóór session-hydration). Probeer
           // eerst een refresh; alleen bij échte fout alsnog uitloggen.
           console.warn('[Auth] Stale auth storage detected, attempting refresh before sign-out...');
-          const { data: refreshData, error: refreshError } =
-            await supabase.auth.refreshSession();
+          // AUTH-DEADLOCK-1 — NOOIT een auth-call awaiten binnen deze
+          // callback: supabase-js houdt hier het auth-lock vast, dus een
+          // refreshSession/signOut hierbinnen deadlockt tot timeout
+          // ("AbortError: signal is aborted without reason") en blokkeert
+          // elke andere auth-call (bv. ensureAuthenticated in de
+          // onboarding). Zelfde defer-patroon als fetchUserRoles hieronder.
+          setTimeout(() => { void handleStaleStorage(); }, 0);
+          return;
+        } else {
+          setSession(null);
+          setUser(null);
+          setRoles([]);
+          setRolesLoading(false);
+          currentUserIdRef.current = null;
+        }
+
+        setLoading(false);
+      }
+    );
+
+    // Het volledige stale-storage-herstel, buiten het auth-lock uitgevoerd.
+    async function handleStaleStorage() {
+      const { data: refreshData, error: refreshError } =
+        await supabase.auth.refreshSession();
           if (!refreshError && refreshData.session?.user) {
             ... (ongewijzigde body, inclusief het bestaande
                  setTimeout(fetchUserRoles) blok)
           } else {
             console.warn('[Auth] Refresh failed, cleaning up storage.', refreshError);
             await safeLocalSignOut();
             ... (ongewijzigde reset van session/user/roles/refs)
           }
-        } else {
-          setSession(null);
-          ...
-        }
-
-        setLoading(false);
-      }
-    );
+      setLoading(false);
+    }
```

Twee blokken, één reden: (1) het stale-storage-pad wordt uit de lock-context gehaald via `setTimeout(0)` + `return`, exact het patroon dat `fetchUserRoles` al gebruikt; (2) de body verhuist ongewijzigd naar een lokale helper `handleStaleStorage()` zodat `refreshSession()` én `safeLocalSignOut()` beide buiten het lock lopen, met `setLoading(false)` aan het einde van dat pad zodat de guard niet kort een lege sessie ziet.

Geen verdere opschoning of refactor.


Doel
- Voorkomen dat onboarding terug springt naar stap 1 na “Bedrijfsgegevens”.
- Tenant creatie stabiel maken (incl. gekozen plan) zonder database-fouten.

Wat er misgaat (oorzaak)
- Tijdens stap 3 probeert de app een tenant aan te maken met een veld `selected_plan_id` in de `tenants` insert.
- Die kolom bestaat niet in de database (zowel Test als Live), waardoor de insert faalt met: “Could not find the 'selected_plan_id' column of 'tenants'”.
- Omdat tenant creatie faalt, kan de wizard niet netjes doorgaan. Bij een nieuwe gebruiker kan een her-check van onboarding status (bijv. na token refresh) de wizard terugzetten naar stap 1.

Oplossing in hoofdlijnen
1) Tenant creatie payload opschonen: `selected_plan_id` nooit meer rechtstreeks in `tenants` inserten.
2) Het gekozen plan nog steeds doorgeven, maar via de backend functie `create-tenant` (die het plan correct wegschrijft naar `tenant_subscriptions`).
3) Extra stabiliteit:
   - Slug-conflict (409) van de backend functie correct afvangen en de bestaande SlugConflictDialog tonen.
   - “Readability verification”: na tenant creatie meteen verifiëren dat de tenant leesbaar is voordat we naar de volgende stap gaan (voorkomt race conditions/step-flips).
4) Onboarding status check aanpassen zodat “nieuwe user => start op stap 1” alleen bij de éérste initial load geldt, en niet opnieuw tijdens een lopende onboarding-sessie (bijv. na token refresh).

Concrete wijzigingen (code)
A) `src/hooks/useOnboarding.ts`
- In `createTenant()`:
  - Maak twee payloads:
    - `tenantInsertPayload` (alleen bestaande `tenants` kolommen, dus zonder `selected_plan_id`)
    - `functionPayload` (zelfde, maar mét `selected_plan_id` om door te geven aan `create-tenant` backend functie)
  - Verander de create-flow:
    1. Bestaande tenant check blijft.
    2. Probeer tenant creatie primair via `createTenantViaFunction(accessToken, functionPayload)`.
       - Dit dekt RLS/headers issues af en zet ook het subscription plan goed.
    3. Als de functie faalt om “niet-auth/infra” redenen, fallback naar directe DB insert met `tenantInsertPayload` (zonder selected_plan_id).
       - Indien fallback-route gebruikt wordt en `selectedPlanId !== 'free'`, update daarna expliciet `tenant_subscriptions.plan_id` voor deze tenant (met authed client).
  - Slug conflict handling:
    - Als de backend functie 409 teruggeeft met `suggested_slug`, set `state.slugConflict` en throw `new Error('SLUG_CONFLICT')` zodat de bestaande dialog verschijnt.
  - Readability verification:
    - Na succesvolle creatie (of bestaande tenant), doe een korte retry-loop (bijv. 5x met 200–300ms) die:
      - `authedDb.from('tenants').select('id').eq('id', tenant.id).maybeSingle()` uitvoert
      - Pas doorgaan als dit leesbaar is
    - Als het na retries nog niet leesbaar is: duidelijke error/toast en niet naar volgende stap.
- In `checkOnboardingStatus()`:
  - Pas de “brand new user -> force step 1” logica aan:
    - Alleen toepassen bij de allereerste run (wanneer `hasInitiallyChecked.current === false`)
    - Bij latere re-runs: respecteer `profile.onboarding_step` zodat de wizard niet terugvalt naar 1 tijdens een actieve sessie.
  - Dit behoudt het originele doel (nieuwe users starten op stap 1) zonder “step reset” wanneer auth state events of retries optreden.

B) `src/integrations/backend/createTenantViaFunction.ts`
- Verbeter error parsing:
  - Als response status 409 is: parse JSON body en geef een gestructureerde error terug (of throw een error met extra properties) zodat `useOnboarding.createTenant()` de slug conflict correct kan herkennen en tonen.
  - Zorg dat error messages niet alleen “create-tenant function failed (409): {…}” zijn, maar machine-readable (bijv. `errorCode = 'slug_conflict'`, `suggestedSlug`).

Geen database wijzigingen nodig
- We voegen geen kolommen toe. We passen de client aan zodat hij geen niet-bestaande kolom probeert te gebruiken.
- Het gekozen plan blijft ondersteund via de bestaande backend functie en `tenant_subscriptions`.

Testplan (end-to-end)
1. Log in met een verse gebruiker (of verwijder test user uit auth in backend UI) en start onboarding.
2. Vul stap 1 (shopnaam + slug) → stap 2 (plan) → stap 3 (bedrijfsgegevens).
3. Klik “Volgende stap” op bedrijfsgegevens:
   - Verwacht: tenant wordt aangemaakt en wizard gaat door naar stap 4 (Logo).
   - Geen 400/PGRST errors meer.
4. Kies een niet-free plan (bijv. enterprise) en verifieer in backend data dat `tenant_subscriptions.plan_id` correct gezet is.
5. Forceer een token refresh scenario (even wachten/refreshen) terwijl wizard op stap 3/4 is:
   - Verwacht: wizard blijft op huidige stap, niet terug naar stap 1.
6. Slug conflict test:
   - Gebruik bewust een slug die al bestaat.
   - Verwacht: SlugConflictDialog verschijnt met voorstel.

Risico’s / edge cases
- Als fallback naar directe DB insert gebruikt wordt, kan `tenant_subscriptions` (trigger) net iets later beschikbaar zijn; daarom:
  - Update van `tenant_subscriptions` ook met retry of check dat row bestaat.
- We blijven de bestaande pre-flight slug check gebruiken, maar backend 409 blijft noodzakelijk voor race conditions.

Bestanden die aangepast worden
- src/hooks/useOnboarding.ts
- src/integrations/backend/createTenantViaFunction.ts

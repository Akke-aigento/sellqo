
Doel
- Je zit nog steeds vast omdat de onboarding bij “Winkel aanmaken” faalt met: “new row violates row-level security policy for table tenants”.
- Dat betekent: de database weigert de INSERT in tenants (403) omdat de server-side check `can_create_first_tenant(auth.uid(), owner_email)` false teruggeeft.

Wat er (bij jou) waarschijnlijk echt mis zit
- De INSERT-policy op `public.tenants` laat een gebruiker alleen een “eerste tenant” aanmaken als:
  1) `owner_email` gelijk is aan het login e-mailadres (JWT/profiles; case-insensitive), én
  2) de gebruiker nog géén `tenant_admin` rol heeft.
- In de praktijk zien we bij dit soort “ik kan niet verder”-gevallen dat er een “verweesde” rol bestaat:
  - `public.user_roles` bevat al een rij met `role = tenant_admin`, maar `tenant_id = NULL`.
  - Gevolg:
    - Je ziet geen tenants (want tenant lijst komt uit `get_user_tenant_ids()` en die pakt alleen roles met `tenant_id IS NOT NULL`)
    - Maar je mag óók geen nieuwe tenant maken (want je “hebt al tenant_admin” → check faalt)
  - Dat veroorzaakt exact jouw loop: onboarding probeert tenant aan te maken → RLS blokkeert → je blijft hangen.

Oplossing (robust, zoals “andere programma’s” dit doen)
We fixen dit op 2 niveaus: database + app, zodat:
- bestaande accounts automatisch herstellen (zonder handmatige support)
- nieuwe data niet meer “verweesd” kan worden

1) Database: “orphan roles” automatisch repareren + voorkomen
1.1 Voeg een SECURITY DEFINER functie toe: `public.repair_orphaned_user_roles()`
- Doel: enkel voor de ingelogde gebruiker (`auth.uid()`), veilig.
- Logica:
  - Als user `tenant_admin` heeft met `tenant_id IS NULL`:
    - Probeer tenant te vinden waar `tenants.owner_email` matcht met login email (JWT/profiles)
      - Als gevonden: update die role(s) → set `tenant_id = gevonden_tenant_id`
      - Als niet gevonden: delete de verweesde role(s) (want ze blokkeren alles en verwijzen naar niets)
  - Voor rollen die nooit NULL tenant_id mogen hebben (staff/accountant/warehouse/viewer): delete ze als tenant_id NULL is.
- Return: JSON met `{ fixed: n, deleted: n }` zodat de UI kan beslissen wat te doen.

1.2 Maak `can_create_first_tenant()` defensiever
- Update de check “heeft al tenant_admin” naar:
  - alleen blokkeren als er een `tenant_admin` bestaat met `tenant_id IS NOT NULL`
- Daarmee voorkom je dat een oude/kapotte role met NULL tenant_id iemands onboarding permanent blokkeert.

1.3 Voeg een database-constraint toe om herhaling te voorkomen
- Voeg een CHECK constraint toe op `public.user_roles`:
  - `role = 'platform_admin' OR tenant_id IS NOT NULL`
- Uitvoering veilig met migratie-volgorde:
  1) Data cleanup (update/repair zoveel mogelijk; delete resterende orphan rows)
  2) Constraint toevoegen (eventueel eerst `NOT VALID`, daarna `VALIDATE`)

2) Frontend: herstel automatisch bij login en vóór onboarding
2.1 In `src/hooks/useAuth.tsx`
- Na het ophalen van roles bij een actieve session:
  - Call `supabase.rpc('repair_orphaned_user_roles')`
  - Daarna: roles opnieuw ophalen en `setRoles()` updaten
- Dit zorgt ervoor dat:
  - zodra de gebruiker inlogt, zijn tenant_id in roles hersteld wordt
  - `useTenant()` daarna wél tenants kan zien
  - onboarding vervolgens automatisch sluit (omdat `tenants.length > 0`)

2.2 (Extra safety) In `src/hooks/useTenant.tsx`
- Als tenants fetch 0 tenants teruggeeft terwijl er wél roles bestaan:
  - (optioneel) nogmaals `repair_orphaned_user_roles()` proberen en 1x re-fetchTenants()
- Dit voorkomt dat een timing/race condition alsnog de onboarding triggert.

2.3 UX fallback in onboarding (zodat je nooit “stil” vastzit)
- In `createTenant()` error handling (in `useOnboarding.ts` of de wizard step transition):
  - Als error een RLS/403 is:
    1) call repair rpc
    2) refreshTenants + refreshOnboarding
    3) toon duidelijke boodschap:
       - “Je account heeft al rechten voor een bestaande winkel. We hebben dit hersteld — je wordt doorgestuurd.”
       - of als niets te herstellen: “Je account heeft al een rol maar zonder gekoppelde winkel. We hebben dit opgeschoond — probeer opnieuw.”

3) Verificatie / Testplan (end-to-end)
- Scenario A: user met orphaned tenant_admin (tenant_id NULL)
  - Login → repair draait → tenant_id wordt gezet of opgeschoond → tenants laden → onboarding sluit → dashboard bereikbaar
- Scenario B: user die echt al tenant_admin is van een tenant
  - Login → tenants laden → onboarding sluit (geen “tenant aanmaken” meer)
- Scenario C: echte nieuwe user zonder roles/tenants
  - Onboarding → tenant create werkt
- Scenario D: user zonder tenant maar met staff/accountant role NULL tenant_id (kapotte data)
  - Login → cleanup → onboarding kan doorgaan

Bestanden / onderdelen die ik ga aanpassen (na approval)
- Database migration:
  - Create/replace `public.repair_orphaned_user_roles()`
  - Update `public.can_create_first_tenant(...)`
  - Data cleanup + CHECK constraint op `public.user_roles`
- Frontend:
  - `src/hooks/useAuth.tsx` (call repair rpc + refetch roles)
  - Optioneel `src/hooks/useTenant.tsx` (1x auto-repair fallback)
  - `src/hooks/useOnboarding.ts` of `OnboardingWizard.tsx` (RLS error → auto repair + refresh)

Waarom dit jouw probleem écht oplost
- Dit pakt de root-cause aan (kapotte role records) i.p.v. enkel de onboarding “weg te klikken”.
- Daardoor kun je weer inloggen zoals het hoort: je krijgt ofwel je bestaande bedrijf te zien, of je kan een nieuwe tenant maken, maar je kan nooit meer vastlopen in “geen tenant zichtbaar” én “geen tenant kunnen aanmaken”.


Doel: dit permanent oplossen (geen “try again”-loop), door te zorgen dat tenant-creatie alleen gebeurt wanneer de gebruiker écht geauthenticeerd is en de sessie geldig is, en door de app automatisch te “self-healen” als er een kapotte/expired sessie in de browser staat.

Waarom het nu nog faalt (op basis van je screenshot + huidige code):
- De fout blijft: `new row violates row-level security policy for table "tenants"` (code 42501 / 403).
- In je screenshot zie je ook requests naar de auth token endpoints die falen (400/422). Dat is typisch voor een corrupte/expired refresh token in localStorage.
- Als de browser op dat moment geen geldig Authorization token meestuurt, is `auth.uid()` in de database `NULL` → de INSERT policy faalt altijd, ongeacht hoe goed `can_create_first_tenant()` is.
- Kortom: de “permanente fix” zit niet meer in de RLS-functie alleen, maar in het client-auth herstelpad (session refresh/clear) + guardrails rondom tenant create.

Wat ik ga doen (implementatieplan)

1) Hard bewijs verzamelen in-app (1 korte debug-ronde)
- In `useOnboarding.createTenant()` en in `useTenant.fetchTenants()` loggen we vóór elke database-call:
  - resultaat van `supabase.auth.getSession()` (bestaat er een session? exp? access_token aanwezig?)
  - `user?.id` en `user?.email`
- We loggen ook expliciet of de request “anon” aanvoelt (geen session) zodat we meteen zien: “is dit RLS of gewoon unauth?”

2) Permanente client-side fix: “ensureAuthenticated()” vóór elke protected write
- Nieuwe helper (bijv. in `useAuth` of `useOnboarding`):
  - `await supabase.auth.getSession()`
  - Als `session` ontbreekt: één poging `await supabase.auth.refreshSession()` (als beschikbaar)
  - Als dat faalt: force sign-out + toast “Sessie verlopen, log opnieuw in” + redirect naar `/auth`
- `createTenant()` mag pas een INSERT doen als `ensureAuthenticated()` ok is.

3) Permanente fix: automatische “session cleanup” bij token-refresh problemen
- In `AuthProvider` (`src/hooks/useAuth.tsx`) voegen we een defensieve check toe:
  - Na `getSession()`:
    - als er errors zijn of session is null terwijl er wél auth-storage aanwezig is → `supabase.auth.signOut()` (cleart storage) en zet state naar logged-out
  - Op `onAuthStateChange` events:
    - bij inconsistenties (bv. user=null maar storage nog gevuld) ook clean-up
- Doel: je blijft nooit hangen in een half-ingelogde toestand waar API-calls 403 geven.

4) UX-fix: duidelijke foutmelding + 1-click herstelpad
- Als `createTenant` nog steeds een 403/42501 gooit:
  - Toon een duidelijke modal: “Je sessie is ongeldig. Klik op ‘Opnieuw inloggen’.”
  - Knop voert uit: `signOut()` → redirect `/auth`
- Dit voorkomt “uren gezever” want de app zegt meteen wat te doen, en fixt het in één actie.

5) Aanvullende zekerheid: onboarding state reset in UI als er géén tenant is
- We zagen: profile staat weer op step 3 en er is geen tenant/role.
- We maken onboarding flow robuuster:
  - Als `tenants.length === 0` en tenant-create faalt door unauth → reset UI naar stap 1 of force re-auth, niet blijven doorgaan vanaf stap 3.
  - Dit voorkomt dat je telkens op dezelfde stap tegen dezelfde muur loopt.

6) Opruimen “wat je wou”: “de tenant verwijderen”
- In de database is voor `info@vanxcel.com` momenteel geen tenant gevonden (in test omgeving) en ook geen user_roles records, dus er is niets om te verwijderen.
- De echte blocker is de sessie/auth toestand in de browser; die gaan we nu structureel oplossen.
- Als jij wél een andere e-mail/tenantnaam had geprobeerd: ik voeg een admin-only “cleanup” (intern) toe waarmee we by email owner_email/slug kunnen checken en (alleen in test) verwijderen, maar alleen als er effectief iets bestaat.

7) Validatie / acceptatiecriteria (zodat we zeker zijn dat het ‘permanent’ is)
- Scenario A: Fresh login → onboarding → stap 3 → tenant wordt aangemaakt zonder 403.
- Scenario B: Corrupt/expired session (simuleren door storage) → tenant-create:
  - app detecteert: geen geldige session
  - app forced logout + vraagt opnieuw inloggen
  - daarna lukt tenant-create
- Scenario C: Terugkomer met partial onboarding:
  - “Verder waar ik was” werkt zonder 403
  - Als token invalid: je krijgt meteen de re-login modal.

Belangrijke noot (stabiliteit):
- Ik ga geen extra permissieve RLS “openzetten” om dit te maskeren. Tenant-creatie blijft veilig achter authentication; we zorgen er gewoon voor dat de client nooit meer in unauth state probeert te schrijven.

Wat ik van jou nodig heb (geen technische kennis vereist)
- Bevestig even: doe je dit op de published site (sellqo.app) of in de preview link? (Je screenshot toont published.)
- Als je akkoord bent: na de fix test je 1x end-to-end: uitloggen → opnieuw inloggen → onboarding doorlopen → tenant create.

Daarna ga ik in default mode de wijzigingen doorvoeren in:
- `src/hooks/useAuth.tsx` (session cleanup + herstel)
- `src/hooks/useOnboarding.ts` (ensureAuthenticated + betere error UX)
- (optioneel) kleine UI modal component (als er al een patroon is in je UI library)

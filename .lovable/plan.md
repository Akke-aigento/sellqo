
Context & diagnosis (why it still fails)
- In Live staat de juiste INSERT-policy op `public.tenants`:
  - “Authenticated users can insert their own tenant” met `WITH CHECK (can_create_first_tenant(auth.uid(), owner_email) OR is_platform_admin(auth.uid()))`.
- De live `can_create_first_tenant()` is ook robuust en zou “true” moeten teruggeven zodra `auth.uid()` niet null is en er een profile bestaat.
- Dus als de INSERT tóch faalt met `42501 new row violates row-level security`, is de meest waarschijnlijke oorzaak:
  - De daadwerkelijke POST naar `/rest/v1/tenants` komt binnen zónder geldige Bearer token → `auth.uid()` wordt `NULL` in Postgres → policy faalt altijd.
- Jouw screenshot ondersteunt dit: `ensureAuthenticated` zegt “valid session”, maar de INSERT call eindigt toch in 403/42501. Dat is exact het verschil tussen “session in browser state” vs “Authorization header op de request”.

Doel van deze fix
- We stoppen met vertrouwen op “supabase-js zal wel de token meesturen”.
- We forceren bij de tenant-creatie een expliciete, geverifieerde access token, en we sturen die zelf mee op de write-call. Daardoor is `auth.uid()` gegarandeerd beschikbaar en kan de RLS policy slagen.

Implementatie (code changes)

1) Versterk auth-verificatie in `src/hooks/useAuth.tsx`
- Pas `ensureAuthenticated()` aan zodat het niet alleen “session bestaat” checkt, maar ook “server accepteert token”.
- Nieuwe flow:
  1. `getSession()`
  2. Als geen session → (optioneel) `refreshSession()` als storage bestaat
  3. Daarna: `getUser()` (server-side check). Dit faalt als de token niet geldig/meegestuurd kan worden.
  4. Alleen als `getUser()` ok is → return true
  5. Bij fail → clear storage + signOut + return false
- Voeg (optioneel) een helper toe in dezelfde hook: `getVerifiedAccessToken({ forceRefresh?: boolean })` die:
  - (optioneel) eerst `refreshSession()` doet
  - vervolgens `getSession()` pakt
  - `getUser()` valideert
  - access_token teruggeeft of null

Waarom: hiermee detecteren we de “valid session maar request is anon”-situatie sneller en betrouwbaarder.

2) Maak een “hard-authenticated” client/request voor kritieke writes (tenant create)
Keuze (we implementeren 1 van deze, voorkeur A):

A) Authed Supabase client per call (meest netjes binnen bestaande stack)
- Maak een helper (bijv. `src/integrations/supabase/authedClient.ts`):
  - `getAuthedClient(accessToken)` → `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { global: { headers: { Authorization: 'Bearer ...' } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`
- Gebruik die authed client alleen voor:
  - `tenants.insert(...)`
  - `tenants.select(...)` check “bestaat tenant al?”
- Hierdoor zit de Authorization header altijd op de request, onafhankelijk van supabase-js internal state.

B) Directe fetch naar REST endpoint met headers (fallback als A om een of andere reden niet kan)
- Gebruik `fetch(`${VITE_SUPABASE_URL}/rest/v1/tenants?select=*`, { method:'POST', headers:{ apikey, Authorization:'Bearer ...', 'Content-Type':'application/json', Prefer:'return=representation' }, body: JSON.stringify(row) })`
- Zelfde idee: token gegarandeerd aanwezig.

3) Update `createTenant()` in `src/hooks/useOnboarding.ts`
- Nieuwe flow (belangrijk: token ophalen en authed client gebruiken vóór de insert):
  1. `await ensureAuthenticated()`; als false → sessionExpired dialog
  2. `const token = await getVerifiedAccessToken({ forceRefresh: true })` (forceRefresh alleen voor deze kritieke write)
  3. `const db = getAuthedClient(token)`
  4. Doe “bestaat tenant al?” check met `db.from('tenants')...eq('owner_email', loginEmail).limit(1)`
     - Als bestaat → gebruik die tenant en ga door
  5. Doe `db.from('tenants').insert({...}).select().single()`
  6. Op 42501:
     - Log expliciet: “insert failed; token present? yes/no”
     - Als token null / getUser faalt → sessionExpired dialog
     - Anders → toon echte RLS misconfig error (maar dat verwachten we hier niet meer)

Waarom dit het probleem oplost
- De policy is correct; ze faalt alleen als `auth.uid()` null is.
- Door de Authorization header expliciet te forceren op de request, is `auth.uid()` niet null → `can_create_first_tenant(auth.uid(), owner_email)` kan slagen.

4) Extra observability (tijdelijk) voor Live debugging
- Voeg 3 logs toe (allemaal vóór de insert):
  - `session?.user?.id`, `session?.user?.email`
  - “token present: true/false”
  - “getUser() ok: true/false”
- Voeg 1 log toe op de insert response:
  - status/err code/message
- We laten deze logs staan tot we bevestigd hebben dat Live consistent werkt; daarna kunnen we ze reduceren.

Bestanden die we aanpassen / toevoegen
- Wijzigen:
  - `src/hooks/useAuth.tsx` (ensureAuthenticated + helper getVerifiedAccessToken)
  - `src/hooks/useOnboarding.ts` (createTenant gebruikt authed client + forceRefresh token)
- Nieuw (als we keuze A doen):
  - `src/integrations/supabase/authedClient.ts` (kleine helper rond createClient)

Testplan (acceptatie)
- Live (published):
  1. Uitloggen → opnieuw inloggen als `info@vanxcel.com`
  2. Onboarding → Bedrijfsgegevens → “Volgende stap”
  3. Verwacht: tenant INSERT slaagt, je gaat door naar volgende stap, geen 42501 meer.
- Confirmatie:
  - In DevTools Network: request naar `/rest/v1/tenants` bevat `Authorization: Bearer ...`
  - Console logs tonen “token present: true” en “getUser ok: true”.

Risico’s / edge cases
- Als browser/extensie requests strippen (zeer zeldzaam): fallback B (direct fetch) blijft werken zolang fetch headers niet gestript worden.
- Als user daadwerkelijk niet ingelogd is (session echt weg): we tonen netjes de sessionExpired dialog en forceren re-login (geen eindeloze retries).

Wat ik daarna (optioneel) kan doen als dit nog 1% flaky is
- Tenant creatie volledig naar een backend function verplaatsen die de token valideert en dan insert doet; dit vereist meestal een server secret (service key). Eerst proberen we de client-side “header guaranteed” fix, omdat die geen extra secrets nodig heeft en perfect past bij de huidige RLS setup.

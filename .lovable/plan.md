# Tenant action links — deelbare onboarding-links op eigen domein

Doel: een platform_admin genereert één lang-levende link op ons domein (`/actie/<token>`) die bij elk bezoek een **verse** Stripe Connect onboarding-link mint. De rauwe Stripe-URL (levensduur ~enkele minuten) verdwijnt uit de communicatie met de tenant.

## Wat er gebouwd wordt

### 1. Migratie (los .sql-bestand, idempotent)
`supabase/migrations/<ts>_tenant_action_tokens.sql`

- Enums `tenant_action_type` ('connect_onboarding','sepa_mandate') en `tenant_action_status` ('pending','completed','expired','revoked') via `DO $$ ... IF NOT EXISTS` guards op `pg_type`.
- Tabel `public.tenant_action_tokens` exact volgens spec (id, tenant_id fk `tenants(id) on delete cascade`, action_type, token unique, status default 'pending', context jsonb, expires_at default `now() + interval '30 days'`, completed_at, created_by, created_at).
- GRANTs vóór RLS: `GRANT SELECT, INSERT ON public.tenant_action_tokens TO authenticated;` en `GRANT ALL ... TO service_role;` — géén anon-grant (de publieke resolver leest met service-role).
- RLS aan. Twee policies, beide `TO authenticated` met `public.is_platform_admin(auth.uid())`: één SELECT, één INSERT. Geen UPDATE/DELETE-policy — statuswijzigingen gebeuren uitsluitend server-side.
- Indexen: `idx_tenant_action_tokens_token` op `(token)` en `idx_tenant_action_tokens_tenant_status` op `(tenant_id, status)`, beide `IF NOT EXISTS`.
- Commentaar bovenaan met de handmatige terugdraai-stappen (geen DOWN-migratie).

### 2. `create-tenant-action-link` (nieuw, platform_admin only)
`supabase/functions/create-tenant-action-link/index.ts`

- `authenticateRequest(req)` + expliciete check `auth.is_platform_admin` → anders 403. (`requireRole` is tenant-gebonden; hier is platform_admin de enige toegestane rol, dus de check staat expliciet.)
- Input `{ tenant_id, action_type }`, gevalideerd; onbekend action_type → 400.
- `sepa_mandate`: `fetch` naar `create-platform-mandate-setup` met de **Authorization-header van de aanroeper doorgegeven** (platform_admin bypasst daar `requireRole`) en de `origin`-header doorgegeven, zodat die functie exact dezelfde `/betaling/machtiging/<token>`-URL bouwt als vandaag. Het antwoord wordt onveranderd doorgegeven. Geen eigen token, geen rij in `tenant_action_tokens`.
- `connect_onboarding`: token via `crypto.getRandomValues` (32 bytes hex, zelfde helper-vorm als de mandaatflow), insert in `tenant_action_tokens` met `created_by = auth.user_id`, response `{ success: true, url: "<origin>/actie/<token>", token }`.
- `verify_jwt = false` in config.toml (JWT wordt in code gevalideerd, conform de rest van het project).

### 3. `resolve-tenant-action` (nieuw, publiek)
`supabase/functions/resolve-tenant-action/index.ts`

- Geen auth; het token is de autorisatie. Patroon van `mandate-setup-info`: service-role client, token uit query (`?token=`) of body.
- Validatie: token bestaat, `status='pending'`, `expires_at > now()`. Anders JSON-fout met eigen status (404 `invalid_token`, 410 `token_expired` / `token_used`). Verlopen tokens worden bij aanraking op `expired` gezet (idempotent, alleen vanuit 'pending').
- `connect_onboarding`: tenant laden, Stripe-client via `getStripeForTenant` (respecteert demo/test-key), Express-account minten indien `stripe_account_id` leeg, dan `accountLinks.create` met `type: 'account_onboarding'`, `refresh_url = <origin>/actie/<token>`, `return_url = <origin>/actie/<token>/gelukt`. HTTP 302 naar `accountLink.url`.
- `sepa_mandate` op deze route → 400 (die flow heeft zijn eigen publieke pagina).

### 4. Connect-mint hergebruiken zonder `create-connect-account` te breken
De mint-logica (capabilities per land, `business_type`, metadata, foutvertaling van Connect-platformprofiel-fouten, tenant-update met `stripe_account_id`) wordt verplaatst naar een nieuwe `supabase/functions/_shared/connectAccount.ts` als `ensureConnectAccount(supabase, tenantId)`. `create-connect-account/index.ts` roept die helper aan in plaats van zijn eigen inline-blok; zijn publieke contract (input, response `{ url, account_id }`, auth, foutteksten, redirect-URL's) blijft byte-voor-byte gelijk. Zo bestaat er één bron van waarheid voor accountaanmaak. Alternatief zou zijn de logica te kopiëren in de resolver — dat garandeert drift zodra Stripe-capabilities wijzigen, dus dat doen we niet.

Verificatie hierop: diff van `create-connect-account` moet aantoonbaar alleen de extractie zijn, plus een handmatige smoke via de bestaande Instellingen-knop op een testtenant.

### 5. Webhook-uitbreiding
In `stripe-connect-webhook`, case `account.updated`, ná de bestaande tenant-update: als `account.charges_enabled` true is, tenant_id opzoeken via `stripe_account_id` en `tenant_action_tokens` updaten waar `tenant_id = ...` en `action_type='connect_onboarding'` en `status='pending'` → `status='completed'`, `completed_at=now()`. De `status='pending'`-filter maakt het idempotent: een tweede event raakt niets. Fouten worden gelogd, niet gethrowd — de bestaande tenant-statusupdate mag hier nooit door falen.

### 6. Frontend (minimaal, additief)
- Nieuwe pagina `src/pages/public/TenantAction.tsx`: leest `:token`, redirect direct naar de edge-function-URL (met `?token=`), toont ondertussen een spinner en bij fout een nette melding met de vier foutgevallen. De 302 naar Stripe gebeurt in de edge function.
- Route `/actie/:token` (en `/actie/:token/gelukt` voor de succespagina) toegevoegd in `src/App.tsx`, in het publieke blok naast `/betaling/machtiging/:token`. Alle teksten via i18next-keys in de vijf locale-bestanden.
- Genereerknop: uitbreiding in de bestaande platform-admin tenant-detailweergave (`src/pages/platform/TenantDetail.tsx`) — link genereren, tonen, kopiëren. Deze wordt pas gebouwd nadat de backend geverifieerd is.

## Hoe de resolver veilig blijft zonder auth
- Het token is 32 bytes CSPRNG (256 bit) — niet raadbaar, zelfde sterkte als de bestaande mandaattokens.
- De resolver accepteert **alleen** een token en leidt tenant en actie daar volledig uit af. Geen enkel veld uit het request (geen tenant_id, geen e-mail, geen bedragen) beïnvloedt wat er gebeurt.
- De enige bereikbare zijeffecten zijn: een Connect-account minten voor precies die tenant, en een onboarding-link minten voor precies dat account. Er is geen pad naar geld verplaatsen, geen pad naar een andere tenant, geen pad dat data leest die niet aan het token hangt.
- Het antwoord is een 302; de resolver geeft nooit tokens, Stripe-keys of tenantdata terug in de body.
- `status='pending'` + `expires_at`-check bij elke aanraking; de webhook zet 'completed' zodra de tenant live is, waarna de link dood is.
- RLS: geen enkele client-rol kan `tenant_action_tokens` lezen behalve platform_admin; tenant_admins zien de tabel niet.

## Wat bewust niet aangeraakt wordt
`storefront-resolve`, `storefront-api`, `checkout-engine`, de gedeelde theme-tabellen, `create-platform-mandate-setup`, `mandate-setup-info`, `mandate-setup-complete`. De vijf custom frontends kunnen deze batch niet zien: geen bestaande kolom, view of contract verandert.

## Verificatie & slottaken
1. Migratie draaien, daarna rol-impersonatie-diff: als anon en als tenant-user 0 rijen op `tenant_action_tokens`, als platform_admin wel.
2. Kolom-audit van beide nieuwe functies tegen `types.ts` vóór deploy.
3. `create-tenant-action-link` aanroepen voor beide action_types op een testtenant; resolver-URL in de browser openen en vaststellen dat er een 302 naar `connect.stripe.com` volgt, en dat een tweede bezoek een nieuwe, verse link geeft.
4. `tsc` + build tegen baseline; lint-diff.
5. Slottaken: entry in `docs/role-audit.md`, changelog-entry in alle talen uit `SUPPORTED_LANGUAGES` + `i18n-parity`, `doc_articles`-insert op `context_path` van de platform-tenantpagina, item in `docs/newsletter-queue.md`.

## Open punt
Voor `return_url` ga ik uit van `/actie/<token>/gelukt` als eigen succespagina. Wil je liever terug naar de platform-tenantpagina of naar `/admin/settings?stripe=success` (zoals `create-connect-account` nu doet), zeg het dan — dat is één regel.

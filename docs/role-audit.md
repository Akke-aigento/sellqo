# Fase 2 — VOLLEDIG AFGESLOTEN (2026-06-09)

## SEC-0a — EXECUTE ingetrokken op interne SECURITY DEFINER-RPC's — 28 juli 2026

**Root cause:** Supabase kent bij het aanmaken van elke functie in `public` standaard `EXECUTE` toe aan `PUBLIC`, `anon` en `authenticated`. Die default is bij dit project nooit teruggedraaid. Gecombineerd met `SECURITY DEFINER` — dat RLS per definitie omzeilt — waren 35 interne functies pre-auth bereikbaar via de PostgREST-RPC-endpoint met alleen de publieke anon-key: mailqueue-uitlezen en injecteren, POS-pincodes zetten/brute-forcen, cadeaubonnen verzilveren, creditnota's aanmaken, voorraad naar nul zetten, AI-credits toekennen of leegtrekken. Geen van deze functiebodies bevat een interne autorisatiecheck (`auth.uid()`, `has_tenant_role`, `is_platform_admin`, `get_user_tenant_ids`); ze zijn geschreven onder de aanname dat alleen `service_role` ze bereikt.

**Verificatiemethode vóór de migratie:**
- `has_function_privilege('anon', …, 'EXECUTE') = true` op alle 35 doelfuncties;
- statische sweep op letterlijke `.rpc('<naam>')`-aanroepen over `src/` én alle 205 edge-functies — geen dynamische of via templates opgebouwde aanroepen, alle hits waren string-literals;
- van de 35 functies wordt de meerderheid alleen aangeroepen door edge-functies die op `SERVICE_ROLE` draaien, of door niemand (aanwezig in `src/integrations/supabase/types.ts` maar zonder call-site);
- `service_role` stond expliciet in elke ACL, dus de revoke raakt geen legitieme aanroeper;
- `check_help_rate_limit` — ACL `postgres | service_role` — diende als referentiepatroon.

**Uitgevoerd (grants-only, geen bodies gewijzigd):**
```
REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION <fn> TO service_role;
```
voor elk van deze 35 signatures:
`read_email_batch(text, integer, integer)`, `enqueue_email(text, jsonb)`, `delete_email(text, bigint)`, `move_to_dlq(text, text, bigint, jsonb)`, `email_queue_dispatch()`, `create_pos_cashier(uuid, text, text, text)`, `update_cashier_pin(uuid, text)`, `verify_cashier_pin(uuid, text)`, `hash_cashier_pin(text)`, `redeem_gift_card(uuid, numeric, uuid)`, `create_credit_note_from_return(uuid)`, `decrement_stock(uuid, integer)`, `decrement_variant_stock(uuid, integer)`, `use_ai_credits(uuid, integer, text, text, jsonb)`, `use_ai_credits(uuid, integer)`, `reset_monthly_ai_credits()`, `reset_monthly_ai_credits(uuid, integer)`, `use_ai_help_credit(uuid)`, `send_notification(uuid, text, text, text, text, text, text, jsonb)`, `increment_campaign_bounced(uuid)`, `increment_campaign_clicked(uuid)`, `increment_campaign_delivered(uuid)`, `increment_campaign_opened(uuid)`, `increment_discount_usage(text, uuid)`, `expire_unpaid_orders()`, `downgrade_expired_trials()`, `start_sync_activity(uuid, uuid, text, text)`, `complete_sync_activity(uuid, text, integer, integer, integer, integer, jsonb)`, `create_sync_conflict(uuid, uuid, text, text, jsonb, jsonb, text[])`, `bulk_update_specifications(uuid[], jsonb)`, `schedule_automation_run(uuid, uuid, text, jsonb)`, `get_already_returned_quantity(uuid)`, `get_user_highest_role(uuid)`, `is_warehouse_user(uuid)`, `has_addon(uuid, text)`.

`FROM PUBLIC` is essentieel: enkele functies droegen naast rol-grants een `PUBLIC`-grant (`=X/postgres` in `proacl`); zonder die clausule bereikte `anon` de functie via `PUBLIC` alsnog. `GRANT ... TO service_role` is formeel dubbelop maar maakt intentie expliciet en beschermt tegen wegvallen van een impliciet pad.

**Verificatie na de migratie:** `has_function_privilege('anon' | 'authenticated' | 'service_role', …, 'EXECUTE')` — alle 35 functies retourneren `anon=false, authenticated=false, service_role=true`.

**Rollback (letterlijk plakbaar bij incident):**
```sql
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.read_email_batch(text, integer, integer)',
    'public.enqueue_email(text, jsonb)',
    'public.delete_email(text, bigint)',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.email_queue_dispatch()',
    'public.create_pos_cashier(uuid, text, text, text)',
    'public.update_cashier_pin(uuid, text)',
    'public.verify_cashier_pin(uuid, text)',
    'public.hash_cashier_pin(text)',
    'public.redeem_gift_card(uuid, numeric, uuid)',
    'public.create_credit_note_from_return(uuid)',
    'public.decrement_stock(uuid, integer)',
    'public.decrement_variant_stock(uuid, integer)',
    'public.use_ai_credits(uuid, integer, text, text, jsonb)',
    'public.use_ai_credits(uuid, integer)',
    'public.reset_monthly_ai_credits()',
    'public.reset_monthly_ai_credits(uuid, integer)',
    'public.use_ai_help_credit(uuid)',
    'public.send_notification(uuid, text, text, text, text, text, text, jsonb)',
    'public.increment_campaign_bounced(uuid)',
    'public.increment_campaign_clicked(uuid)',
    'public.increment_campaign_delivered(uuid)',
    'public.increment_campaign_opened(uuid)',
    'public.increment_discount_usage(text, uuid)',
    'public.expire_unpaid_orders()',
    'public.downgrade_expired_trials()',
    'public.start_sync_activity(uuid, uuid, text, text)',
    'public.complete_sync_activity(uuid, text, integer, integer, integer, integer, jsonb)',
    'public.create_sync_conflict(uuid, uuid, text, text, jsonb, jsonb, text[])',
    'public.bulk_update_specifications(uuid[], jsonb)',
    'public.schedule_automation_run(uuid, uuid, text, jsonb)',
    'public.get_already_returned_quantity(uuid)',
    'public.get_user_highest_role(uuid)',
    'public.is_warehouse_user(uuid)',
    'public.has_addon(uuid, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
  END LOOP;
END $$;
```

**Slottaken:**
- Changelog `2026.07af` (`sec_internal_rpc_hardening`, type `security`) met neutrale i18n-teksten in NL/EN/FR/DE — geen functienamen, geen misbruikscenario. Volgt de vaste lijn voor security-entries.
- `doc_articles` platform-artikel over de autorisatie-conventie voor RPC's (`doc_level='platform'`, slug `rpc-autorisatie-conventie`), idempotent via `ON CONFLICT`.
- Geen newsletter-item — niet tenant-zichtbaar.

**Openstaand — bewust niet in deze batch:**
- **Bucket B:** RPC's die de frontend wél aanroept en die een interne autorisatiecheck missen. Aanpak: `GRANT EXECUTE ... TO authenticated` behouden, maar interne check (`auth.uid()`-scoped tenant/rol) in de body toevoegen. Wordt SEC-0b.
- **Bucket C:** `has_tenant_role`, `get_user_tenant_ids`, `is_platform_admin`, `can_create_tenant`, `get_current_user_email` — bewust ongemoeid, want gebruikt in circa 1.170 policy-expressies; EXECUTE intrekken legt RLS plat.
- `get_invitation_effective_status` en `generate_platform_ogm` — bewust niet in deze batch.
- **Geen `ALTER DEFAULT PRIVILEGES`** in deze batch — creëert vertraagde stille faalmodus voor toekomstige RPC's, en het effect is rol-gebonden (onder welke rol maken migrations effectief functies aan?). Aparte batch.

## PWRESET-1 — wachtwoord-reset aanvragen vanaf de inlogpagina — 28 juli 2026

**Root cause:** de reset-flow bestond al voor de helft. `src/pages/ResetPassword.tsx` vangt de `PASSWORD_RECOVERY`-sessie correct af en zet het nieuwe wachtwoord via `updateUser`, de route `/reset-password` is aangesloten in `src/App.tsx`, en de `RecoveryEmail`-template in `supabase/functions/_shared/email-templates/recovery.tsx` wordt door `auth-email-hook` afgehandeld voor `action_type='recovery'`. Wat ontbrak was de **trigger**: `resetPasswordForEmail` kwam nergens in `src/` voor, zodat er geen UI-pad was om de flow te starten. Elke "wachtwoord vergeten"-vraag landde bij de platform-admin, wat uitnodigde tot handmatige wachtwoordreset — een slechte gewoonte.

**Uitgevoerd:**
- `src/hooks/useAuth.tsx`: nieuwe `resetPassword(email)` in dezelfde `{ error }`-stijl als `signIn`/`signUp`. Opgenomen in `AuthContextType` en in de `contextValue`-memo. `redirectTo` is bewust dynamisch (`${window.location.origin}/reset-password`) omdat tenants op eigen custom domains draaien — een hardcoded platform-URL zou daar een cross-origin recovery-sessie opleveren.
- `src/pages/Auth.tsx`: onder de inlogknop een discrete `variant="link"` "Wachtwoord vergeten?"-knop. Opent een `Dialog` met één e-mailveld, gevalideerd met een aparte `resetSchema` (zod, email-check) in lijn met `loginSchema`. Prefill met de al ingevulde `loginEmail` als die er is. Feedback via bestaande `useToast`.
- **Enumeratie-bestendige respons:** de toast na verzending is altijd exact dezelfde — "Als er een account bestaat op dit adres, is er een e-mail met een reset-link verstuurd." Ongeacht of GoTrue een fout teruggeeft of het adres bestaat. De echte fout gaat naar `console.error` voor debugging. Zonder deze uniforme respons wordt het formulier een orakel om te aftoetsen welke e-mailadressen een account hebben.
- **60s-cooldown:** na een succesvolle verzending sluit de dialog en toont de trigger-knop een aftelling ("Opnieuw mogelijk over 45s"). Voorkomt dat iemand het formulier gebruikt om een mailbox te bombarderen. GoTrue heeft server-side ook rate-limiting, maar de client-cooldown geeft directe UX-feedback en scheelt onnodige API-calls.
- Taal: `Auth.tsx` is volledig hardcoded Nederlands (geen `useTranslation`). Nieuwe teksten volgen die conventie — géén i18n-keys ingevoerd om te voorkomen dat de pagina half-i18n wordt.
- `doc_articles` (`doc_level='tenant'`, slug `wachtwoord-opnieuw-instellen`, categorie Team & Account, `context_path='/auth'`): artikel legt uit waar de knop staat, dat de mail enkele minuten kan duren, spam-map checken, en dat de link ~1u geldig is. Idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.
- Changelog: `2026.07ae` met `id='password_reset'`, type `feature`, i18n-teksten in NL/EN/FR/DE. Tenant-zichtbaar, dus publieke changelog. Neutraal geformuleerd ("wachtwoord opnieuw instellen vanaf de inlogpagina") — niet als het dichten van een gat.

**Bewust géén newsletter-item:** basishygiëne, niet aankondigings-waardig.

**Buiten scope (bewust niet aangeraakt):** `ResetPassword.tsx` (werkt correct), `auth-email-hook`, `RecoveryEmail`-template, mailqueue, en geen i18n-refactor van `Auth.tsx`.

**Losse observatie (niet in deze batch opgelost):** `loginSchema` in `Auth.tsx` eist minimaal 6 tekens voor het wachtwoord, terwijl `ResetPassword.tsx` en `signUp` in Supabase minimaal 8 tekens hanteren. Inconsistent, maar rakelings buiten deze scope — bestaande accounts met 6-7 tekens moeten kunnen blijven inloggen tot ze zelf een sterker wachtwoord kiezen.

**Post-flight correctie (DE-FIX):** de Duitse changelogtekst voor deze batch bevatte een niet-geëscapete rechte quote tegenover een openend `„`, waardoor `landing.de.json` ongeldige JSON werd (`Expecting ',' delimiter: line 1111 column 105`). Gecorrigeerd naar `„Passwort vergessen?“`. Deze fout werd gevonden door de parse-verificatie na afloop van de batch, niet door de type-check.

## NANO-1 — `nano-studio` edge function (imgeditor.co beeldgeneratie) — 28 juli 2026

**Doel:** platform-intern gereedschap om beeldgeneratie via imgeditor.co aan te roepen vanuit SQL (`net.http_post`), zonder de API-sleutel bloot te stellen. `API_NANO` zit in Lovable secrets en is niet uitleesbaar via SQL; een edge function ertussen houdt de sleutel binnen de service-role-omgeving.

**Uitgevoerd:**
- Migratie: nieuwe tabel `public.nano_image_jobs` (task_id, status, prompt, model, mode, source_image_url, aspect_ratio, resolution, credits_used, result_url, storage_path, error_message, source_product_id, completed_at). Unieke index op `task_id`, samengestelde index op `(tenant_id, status, created_at DESC)`. RLS aan met één policy `nano_jobs_platform_admin_all` (`FOR ALL TO authenticated USING is_platform_admin(auth.uid()) WITH CHECK is_platform_admin(auth.uid())`). `GRANT` naar `authenticated` en `service_role`. Bewust géén tenant-policy: dit is voorlopig platform-scope; wordt het later tenant-facing dan komt er een tweede policy én credit-gating bij. `ai_generated_images` blijft ongewijzigd — die tabel is voor voltooide beelden en heeft `image_url NOT NULL`, wat niet werkt voor lopende jobs.
- Edge function `supabase/functions/nano-studio/index.ts` met twee acties.
  - `generate`: valideert `tenant_id` en `prompt` (en `image_url` bij `mode:"image"`), roept `POST https://imgeditor.co/api/v1/images/generate` aan met `Authorization: Bearer ${API_NANO}`, schrijft job-rij met `status='pending'` en `credits_used`, retourneert `{ job_id, task_id, credits_used, credits_remaining }`. Defaults: `model=nano-banana-pro`, `resolution=2K`, `aspect_ratio=4:5`, `num_images=1`, `output_format=png`.
  - `status`: leest job → `GET /images/status?task_id=…`. Nog bezig: retourneert `{ status:'pending', progress }`, tabel blijft ongewijzigd. Klaar: download beeld → upload naar bucket `ai-images` onder `{tenant_id}/nano/{job_id}.png` → pas dán job bijwerken naar `completed` met `result_url` (publieke URL) en `storage_path` + rij inserten in `ai_generated_images` (`enhancement_type='nano_studio'`). Mislukt: `status='failed'` + `error_message`. Download- of upload-fout → job blijft `pending`, function geeft fout terug — geen "completed" zonder bestand.
- Autorisatie in de function: `verify_jwt=true` in `supabase/config.toml` zodat het platform de handtekening valideert; in de function decoderen we de JWT-payload en eisen `role === "service_role"` — anders 403 `service_role_required`. Anon-tokens komen langs de JWT-laag maar worden door de rolcheck geweigerd. **Aanpassing 28 juli 2026 (NANO-1-FIX):** oorspronkelijk stond hier een letterlijke stringvergelijking `providedToken === SUPABASE_SERVICE_ROLE_KEY`. Die brak bij een geldige service-role JWT uit de Supabase vault (ander sleutelformaat dan de env-var), en zou stil breken bij sleutelrotatie. Rolcontrole op de geverifieerde token is robuuster en rotatie-bestendig.
- **Aanpassing 28 juli 2026 (NANO-1-FIX-2):** de insert in `ai_generated_images` gebruikte `enhancement_type='nano_studio'`, wat de check constraint `enhancement_type = ANY (ARRAY['generate','enhance','background_remove','overlay'])` schond en met code `23514` faalde. Omdat de insert bewust niet-fataal was, werd de fout enkel gelogd en bleef de job `completed` met bestand in storage, maar zonder rij in `ai_generated_images` (geverifieerd op job `6ac61f4d-e997-43e7-b36b-3882b831c30f`). De oorspronkelijke NANO-1-spec had de constraint niet gecontroleerd. Fix: `enhancement_type` wordt nu afgeleid uit `job.mode` (`image` → `enhance`, anders `generate`) en `style='nano_studio'` markeert de herkomst (geen check constraint op `style`). Log-regel bij insertfout is uitgebreid met `job_id` en `enhancement_type`, en de status-response bevat nu `ai_image_logged: boolean` zodat de aanroeper ziet of de rij er wel of niet gekomen is. Constraint zelf blijft ongewijzigd; geen migratie.
- Foutmapping upstream → lokale codes: 401 → `imgeditor_unauthorized` (502), 402 → `insufficient_credits`, 429 → `rate_limit_exceeded`, 451 → `content_filtered`, overig → `imgeditor_error` (502). Fouten worden gelogd met `console.error` zonder de sleutel of tokens.
- `doc_articles`: platform-artikel `nano-studio` (`doc_level='platform'`, categorie AI) beschrijft beide acties, defaults en de eis dat `image_url` publiek bereikbaar moet zijn bij `mode:"image"`. Idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.

**Bewust géén changelog- of newsletter-entry:** dit is platform-intern gereedschap, niet tenant-zichtbaar. Ook géén admin-UI in deze batch — aanroep loopt via `net.http_post`. Video-endpoints (VEO/Sora/Kling) en tenant-toegang met credit-gating komen pas als deze keten in productie bewezen is.

**Security-keuzes:** `API_NANO` verlaat nooit de function-runtime — niet in responses, niet in logs, niet in de database. RLS staat strikt op platform-admin. De function eist expliciet de service-role token in de `Authorization`-header; een gelekte anon-key kan de function niet aanroepen. Downloads naar de `ai-images`-bucket gebruiken de service-role client; de publieke URL is bewust: bestaande AI-images-flow werkt zo al. Job blijft `pending` bij een half-mislukte afhandeling zodat een retry mogelijk is — geen wees-records in de database die naar niets wijzen.

## SHIP-CLASS-1 — Verzendklassen: verzendmethodes filteren op cartinhoud — 25 juli 2026

**Root cause:** `checkoutGetShippingOptions` in `supabase/functions/storefront-api/index.ts` gaf ongefilterd álle actieve `shipping_methods` van de tenant terug — de cartinhoud speelde geen rol. `checkoutShipping` valideerde vervolgens alleen dat de gekozen methode bij de juiste tenant hoorde, niet of ze voor déze cart toegestaan was. Een klant met een boxspring (verplichte vrachtwagenlevering + montage, €100) kreeg dus "Gratis verzending" als keuze te zien, en omgekeerd verscheen de €100-optie ook bij een cart met alleen matrassen. Via een directe API-call was de verkeerde methode zelfs af te dwingen op een boxspring-order. `product_specifications.shipping_class` bestond al in het schema maar was platform-breed leeg (0/41 rijen) en werd nergens gelezen.

**Uitgevoerd:**
- Migratie: kolom `shipping_class text NULL` toegevoegd aan `public.shipping_methods` met kolomcommentaar (NULL = universeel, ingevuld = alleen matchen met dezelfde klasse op product). Indexen `idx_shipping_methods_tenant_class (tenant_id, shipping_class)` en `idx_product_specifications_shipping_class (product_id, shipping_class) WHERE shipping_class IS NOT NULL`. Geen RLS-wijziging — beide tabellen behouden hun bestaande policies.
- `storefront-api/index.ts`: nieuwe helper `resolveCartShippingClasses(supabase, tenantId, productIds)` leest distinct `shipping_class` uit `product_specifications` gefilterd op `tenant_id` én `IS NOT NULL`. `getShippingMethods` kreeg optionele parameter `shippingClasses?: string[]`: bij `[]` alleen NULL-methodes, bij niet-leeg alleen exacte klasse-matches (universele NULL-methodes vallen dan bewust wég), gemengde cart valt automatisch onder het strengere regime. Vangnet: levert het filter nul methodes op, dan tonen we alle actieve methodes en loggen `console.warn('[SHIP-CLASS] geen methode voor klassen', …)`. `checkoutGetShippingOptions` accepteert nu `cart_id`, haalt de cart op, bepaalt de klassenset en geeft die door. `buildCartResponse` doet dat ook — voorheen werd `checkoutGetShippingOptions` daar aangeroepen met alleen `{ subtotal }`, zodat de lijst in de checkout-response niet mee-filterde. Nu `{ subtotal, cart_id: cartId }`. Regel leeft op één plek: `checkoutShipping` gebruikt dezelfde helper voor server-side validatie en retourneert `SHIPPING_NOT_ALLOWED` als de gekozen methode niet in het toegelaten setje zit. Kolomnamen geverifieerd tegen `src/integrations/supabase/types.ts` en tegen het live schema (kolom `shipping_class` bestaat als text-kolom op `product_specifications`).
- Types en admin-UI: `shipping_class` toegevoegd aan `ShippingMethod` en `ShippingMethodFormData` in `src/types/shipping.ts`. `useShippingMethods` schrijft het veld nu mee in zowel `insert` als `update` (voorheen ontbrak dat sowieso in update). `ShippingMethodDialog` kreeg een vrij tekstveld "Verzendklasse" met helptekst. Product-kant hoefde geen nieuwe UI: `LogisticsFields` bevatte al een input voor `shipping_class` in de specificaties-sectie. Permissies volgen de bestaande admin-routes; geen extra `PermissionGate` toegevoegd omdat de shipping-instellingen al onder `tenant_admin`/`staff` vallen.
- Data-seed voor Astra Sleep (tenant `169cf7b9-…`): methode "Levering en montage boxspring" → `shipping_class='boxspring'`; `product_specifications` voor de twee boxspring-slugs (`astra-sleep-boxspring-comfort`, `astra-sleep-boxspring-opberg`) → dezelfde klasse. Idempotent via `ON CONFLICT (product_id) DO UPDATE`. "Gratis verzending" blijft NULL en geldt daarmee voor de matrassen.
- Doc-artikel: `doc_articles`-entry (`doc_level='tenant'`, slug `verzendklassen`, categorie Verzending `a0000001-0000-0000-0000-000000000004`, `context_path='/admin/settings/shipping'`) met het boxspring-voorbeeld en vermelding "Starter-plan of hoger". Idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.

**Security-keuzes:** geen nieuwe tabellen, geen nieuwe policies. Kolom-toevoeging valt binnen de bestaande RLS op `shipping_methods` (tenant-isolatie). Server-side validatie in `checkoutShipping` is de sluitpost: de storefront-frontend is niet vertrouwd, dus de regel wordt in de edge function afgedwongen — niet in de client. `resolveCartShippingClasses` filtert expliciet op `tenant_id`, zodat het onmogelijk is klassen uit een andere tenant mee te lezen. Vangnet (alle methodes tonen als het filter niets oplevert) is bewust een beschikbaarheids-keuze boven strikte handhaving: beter een verkeerde prijs dan een klant die niet kan afrekenen omdat een tenant een klasse-veld liet slingeren.

**Vangst uit recon:** `useShippingMethods` schrijft `name_nl` / `name_en` / `name_fr` / `name_de` niet weg terwijl die kolommen bestaan — losse bug, staat expliciet buiten scope. `products.vat_rate_id` en de `vat_rates`-tabel zijn onbenutte velden; aparte opruimactie later.

## HELP-2 — 17 juli 2026

**Root cause:** de hulpassistent verwees in zijn antwoorden naar doc_articles, maar de links werkten niet. Drie samenlopende oorzaken. (1) De kennisbank die naar het model gestuurd werd in `ai-help-assistant/index.ts` bevatte enkel `title/excerpt/content` — géén slug, géén link-formaat. Het model verzon dus URL's op basis van de titel, en die kwamen niet overeen met de echte routes. (2) `src/pages/admin/Help.tsx` stuurde de artikel-selectie via lokale `useState`, zonder URL-parameter — dus zelfs áls het model toevallig een correcte `/admin/help`-URL raadde, opende die enkel de indexpagina en niet het bedoelde artikel. (3) `AIHelpChatWindow.tsx` gaf ReactMarkdown geen custom `a`-renderer, waardoor markdown-links een standaard `<a>` werden: een klik veroorzaakte een volledige page-load die het chatvenster sloot.

**Uitgevoerd:**
- `ai-help-assistant/index.ts`: `slug` en `doc_level` toegevoegd aan beide doc_articles-queries (admin- en tenant-branch). Per artikel een `Link:`-regel in de kennisbank-tekst: `/admin/help?article={slug}` voor tenant-docs, `/admin/platform/docs?article={slug}` voor platform-docs (alleen zichtbaar in admin-branch). Extra promptregel toegevoegd in zowel `tenantRules` als `adminRules`: link-formaat verplicht `[Titel](link)` met de Link-waarde letterlijk overgenomen — geen zelf-verzonnen paden.
- `src/pages/admin/Help.tsx`: `useSearchParams` ingevoerd. Bij mount + zodra `articles` geladen zijn wordt de `?article=`-slug opgezocht; bij match: artikel + juiste categorie geselecteerd. Handmatige selectie synct de URL met `replace: true` zodat browserhistorie niet vervuild raakt. Onbekende slug valt stil terug op de normale beginweergave.
- `src/pages/admin/PlatformDocs.tsx`: identiek patroon in `DocsPanel` (beide tabs, tenant + platform). Delete-flow gaat via dezelfde `selectArticle`-helper zodat de URL-param mee gecleared wordt.
- `AIHelpChatWindow.tsx`: `ReactMarkdown components={{ a: MarkdownLink }}` toegevoegd. Interne hrefs (starten met `/`) → `preventDefault` + `useNavigate` zodat het chatvenster open blijft; externe hrefs → `target="_blank" rel="noopener noreferrer"`. Links visueel duidelijk als link (underline, primary kleur).

**Security-keuzes:** n.v.t. — puur gedrag/UX-fix, geen nieuwe tabellen, functies, routes of policies. Kennisbank blijft rol-bewust gefilterd zoals in HELP-1: tenants zien enkel `doc_level='tenant'`, platform-admins beide. Platform-links komen enkel voor in de admin-branch, dus tenants krijgen die Link-regels nooit te zien in hun prompt.

## HELP-1 — 17 juli 2026

**Root cause:** de hulpchatbot trok per bericht 1 AI-credit uit `tenant_ai_credits` via de RPC `use_ai_help_credit`. Fout ontwerp voor een support-kanaal: Free-tenants (0 credits) konden de bot letterlijk nooit gebruiken, en elke tenant die zijn credits opmaakte aan andere AI-features (bulk-vertaling, image editor, coach) verloor tegelijk zijn support. Een winkeleigenaar met een vraag over facturatie kreeg dan een 402 "credits op" — precies op het moment dat hij hulp nodig had. De credit-pool bestaat voor waardevolle AI-outputs (content, vertaling), niet voor "leg me eens uit hoe X werkt".

**Uitgevoerd:**
- Migratie: additief `user_id uuid NULL` op `ai_usage_log` (geen backfill, geen constraint-wijzigingen). Partial index op `(tenant_id, user_id, feature, created_at) WHERE feature = 'help_assistant'` voor snelle daily-counts.
- Nieuwe SECURITY DEFINER-functie `public.check_help_rate_limit(p_tenant_id, p_user_id)` met `SET search_path = public`: telt help_assistant-rijen van vandaag per user en per tenant, en INSERT bij succes één rij met `credits_used = 0`. Check+log atomair in één functie zodat ze niet kunnen divergeren. Caps: 30/user/dag, 150/tenant/dag. EXECUTE gerevoked voor public/anon/authenticated, enkel service_role kan 'm aanroepen — de edge function gebruikt de service-role client, geen andere caller nodig.
- `ai-help-assistant/index.ts`: `use_ai_help_credit`-flow, de `is_internal_tenant`-check en het volledige 402-pad zijn weg. `authenticateRequest(req, tenantId)` staat nu vóór de rate-limit; `is_platform_admin === true` slaat de rate-limit over. Anders `check_help_rate_limit` via service-role; FALSE → 429 met de NL-melding. supabase-js gepind op `2.57.2` (R2). De misplaatste `if (e instanceof AuthError) return authErrorResponse(...)` in de pull()-catch rond de `ai_help_unanswered`-insert is verwijderd — een Response returnen binnen een ReadableStream doet niks, en het maskerde de echte fout enkel.
- Kennisbank rol-bewust: platform_admin krijgt `doc_level IN ('tenant','platform')` én een aparte admin-systemprompt (geen verbodsregels op technische details of platform-info; tenant-isolatie en prompt-geheimhouding blijven WEL staan). Tenant-user krijgt uitsluitend `doc_level = 'tenant'` — de platform-query staat fysiek alleen in de admin-branch, belt & braces tegen lekken.
- Plan-awareness: `pricing_plans` (id, name, monthly_price, features, active=true, gesorteerd op sort_order) wordt in de system prompt geïnjecteerd als planmatrix + huidig plan + feature-flags. Regel 5 herschreven: publieke plan-info mag gedeeld worden, interne marges/kortingslogica niet. Nieuwe regel 13: bij vraag naar hoger-plan-feature kort uitleggen wat de feature doet, vermelden vanaf welk plan, verwijzen naar "Abonnement". Regel 14: kennisbank is tenant-only, platformbeheer-vragen → support.
- RPC `use_ai_help_credit` bewust NIET gedropt (deprecated laten staan; geen destructieve wijziging in dezelfde batch, M1 uit sellqo-db-safety).

**Security-keuzes:**
- `check_help_rate_limit` is `SECURITY DEFINER` omdat ze INSERT'ert in `ai_usage_log` (RLS-tabel) namens de service-role. `search_path = public` verplicht, EXECUTE ingetrokken van public/anon/authenticated en enkel toegewezen aan `service_role` — geen frontend-pad, geen anon-pad.
- Rol-bewuste knowledge-base: de query op `doc_level = 'platform'` staat uitsluitend binnen `if (isPlatformAdmin)`, niet als filter dat via een variabele wordt gezet. Een bug die `isPlatformAdmin` verkeerd zet, laat de platform-branch overslaan; de tenant-branch kan geen platform-docs opvragen.
- Rate-limit-bypass voor platform-admin is bewust: platform-support en interne triage mogen niet gedwarsboomd worden door dezelfde caps als tenants. Bypass hangt aan `auth.is_platform_admin`, niet aan e-mail of tenant-id.
- Geen wijziging aan `tenant_ai_credits`; oude rijen en RPC blijven werken voor overige AI-features.

**Backlog-notitie:** de deprecated RPC `use_ai_help_credit` en de kolom `tenant_ai_credits.help_credits_used` (indien aanwezig) kunnen bij een latere schoonmaak weg, samen met AI-CREDITS-1 (maandelijkse cron). Niet nu — additief blijft additief.

## F05-2a — weesendpoints dichtzetten — 17 juli 2026

**Root cause:** drie edge functions draaiden met de service-role en zonder één enkele auth-check: `reset-monthly-ai-credits`, `repair-attachments`, `repair-cid-references`. Geen van drie stond in `config.toml`, dus `verify_jwt` viel terug op de default `true` — maar dat beschermt niks: de anon-key is een geldige publieke JWT (hij zit in elke frontend-bundle en in `.env`), dus de gateway laat gewoon door en daarachter stond letterlijk niks. Iedereen op internet die de URL kende, kon deze afvuren.

**Impact-oppervlak:** `reset-monthly-ai-credits` roept de RPC `reset_monthly_ai_credits()` aan, en die doet `UPDATE tenant_ai_credits SET credits_used = 0, credits_total = ...` **zonder WHERE** — één anonieme call reset alle 9 tenants tegelijk. `repair-attachments` en `repair-cid-references` doen massa-onderhoud én triggeren Resend-API-calls (dus reële euro's, niet enkel data). Alle drie zijn bovendien wees: read-only geverifieerd — geen frontend-aanroep, geen andere edge function die ze aanroept, en géén cronjob. Niemand roept ze aan, ze stonden er alleen maar te wachten.

**Uitgevoerd:** in alle drie de functies als **eerste** stap ná de OPTIONS-afhandeling `authenticateRequest(req)` + `!auth.is_platform_admin → 403`. Vóór die guard gebeurt niks meer: geen `createClient`, geen `req.json()`, geen RPC, geen fetch. `AuthError` wordt in elk `catch` als eerste afgevangen en via `authErrorResponse` teruggegeven, exact het patroon uit `get-stripe-login-link/index.ts`. Service-role-aanroepen passeren via de bestaande bypass in `_shared/auth.ts`, echte platform-admins via `is_platform_admin`, een tenant-gebruiker krijgt 403, en de publieke anon-key faalt op `getUser()` met 401. Bewust `config.toml` **niet** aangepast: `verify_jwt=true` blijft, gateway blokkeert al rommel, onze check doet de rest — defense in depth. Businesslogica (RPC, repair-loops, Resend-calls, responsvormen) onaangeroerd. Alle drie gedeployed.

**Security-keuzes:** enkel dichtzetten, niet verwijderen — de functies zijn op zich nuttig (credit-reset is beheer, repair-flows staan er voor incidenten). Geen nieuwe secrets, geen migraties, geen `src/`-wijziging.

**Backlog — AI-CREDITS-1:** de maandelijkse credit-reset draait helemaal niet. Er is nooit een cronjob voor `reset-monthly-ai-credits` aangemaakt; 7 van de 9 tenants staan over hun `credits_reset_at`, sommige 4,5 maand (SellQo 0/10 over, Mancini Milano 2/10, VanXcel 75/210). De machinerie (edge function + RPC + `credits_reset_at`-kolom) staat compleet, enkel de cron ontbreekt. Nu triviaal te bouwen met het Vault-patroon uit F05-1 (`cron_service_role_key`). Functionele bug, geen security — apart oppakken.

## SEC-BATCH-2d-2 — verzendlabels naar signed URLs — 17 juli 2026

**Root cause:** de bucket `shipping-labels` is publiek leesbaar en verzendlabels bevatten naam + adres van de klant. Zolang de admin-UI `window.open(label_url)` doet met een publieke storage-URL, kan die bucket niet privaat worden zonder alles te breken. F-01 heeft ditzelfde patroon bij facturen al opgelost via `get-document-url` + signed URLs; verzendlabels waren de laatste publieke doc-flow.

**Uitgevoerd:** derde `doc_type` toegevoegd aan `supabase/functions/get-document-url/index.ts`: `shipping_label` mapt op tabel `shipping_labels`, bucket `shipping-labels`, number-kolom `tracking_number`. Nieuwe `PATH_COL`-map vervangt de hardcoded `pdf_path`/`ubl_path`: shipping labels gebruiken `label_path` (kolom die op `shipping_labels` bestaat), `ubl` is `null` en levert 400 `"kind 'ubl' is not supported for doc_type 'shipping_label'"`. De `.select(...)` bouwt nu dynamisch met `${numberCol}, ${pathCol}` — nooit meer `pdf_path` opvragen op een tabel die die kolom niet heeft. Batch-bestandsnaam valt terug op `label-${id}.pdf` als `tracking_number` null is. Tenant-resolutie, `authenticateRequest(req, tenantId)`, single-tenant-check en TTL 600s onaangeroerd.

In `src/hooks/useDocumentDownload.ts` alleen het `DocType` uitgebreid; hook is doc_type-agnostisch. In `src/components/admin/BolActionsCard.tsx` alle vijf `window.open(label_url)`-aanroepen vervangen door `openDocument('shipping_label', latestLabel.id, 'pdf')` (popup-safe, zelfde patroon als de facturen), en de print-knop haalt de URL nu via `getDocumentUrl` op vóór `printLabel`/`printViaBrowser`. `?t=${Date.now()}`-cachebuster verwijderd: elke signed URL is uniek.

**Gating verplaatst van `label_url` naar `label_path`:** de 17 rijen die door BOL-LABEL-1a nooit een bestand hadden (`label_path IS NULL`, gebackfilld in 2d-1) tonen de print/open-knoppen nu niet meer. Die knoppen leverden vroeger het label van een andere klant en na 1b een 404 — een knop die er niet is, is eerlijker. De "opnieuw ophalen"-flow (`!label_path && status === 'created'`) blijft juist wél verschijnen voor die 17 rijen; dat is precies wat je nodig hebt om ze te repareren.

**Bewust NIET aangeraakt:** `label_url` blijft in DB én in de `ShippingLabel`-interface — `LABEL-PDF-RETRY` selecteert op `label_url IS NULL` om nieuw aangemaakte labels waarvan de PDF nog niet klaar is te vinden. Dat weghalen zou die retry-flow slopen. `useLabelPrinter.ts` idem: die krijgt gewoon een URL binnen, publiek of signed maakt hem niet uit. `create-bol-vvb-label`, `sync-bol-orders`, VVB-RETRY, LABEL-PDF-RETRY en STUCK-LABEL-CLEANUP: onaangeroerd.

**Security-keuzes:** bucket blijft in deze batch nog publiek — dat is 2d-3, met een aparte migratie + storage policy. `get-document-url` blijft de authenticatie doen via `authenticateRequest` op de tenant die uit de rij komt (RLS-equivalent op function-niveau), en de single-tenant-check voorkomt dat één request signed URLs van meerdere tenants mengt.

**Vervolg:** SEC-BATCH-2d-3 — bucket `shipping-labels` op private zetten en de storage-policy aanscherpen (alleen service_role read, net als bij `invoices` en `credit-notes`). Pas dán is de klant-NAW-lek in verzendlabels dicht.

## BOL-LABEL-1a — verzendlabels: onveilige bestandsnaam — 17 juli 2026

**Root cause:** Bol-ordernummers beginnen met `#` (bv. `#1161`). `create-bol-vvb-label` bouwde de storage-key als `bol-vvb-${order.order_number}${suffix}.pdf` en uploadde naar `${tenant_id}/${fileName}`. Een `#` in een URL start het fragment; server-side kapt Supabase Storage het pad daar af. Alle labels landden dus op één object: `{tenant_id}/bol-vvb-`. Met `upsert: true` (bewust, tegen vastlopende retries) overschreef elk nieuw label het vorige. `getPublicUrl()` plakt strings en gaf de volle URL met `#` terug — die werd in `shipping_labels.label_url` opgeslagen. Bij het openen kapt de browser opnieuw af op `#`, vraagt `.../bol-vvb-` op en krijgt het láátst geüploade label. Gevolg: iemand kon het label van een andere klant printen, mét diens adres.

**Bewijs:** `storage.objects` had exact één object `54f6b480-.../bol-vvb-` (aangemaakt 5 maart 2026, `updated_at` 15 juli — 18 keer overschreven). 18 van 30 `label_url`'s in `shipping_labels` bevatten een `#` → 0 bestaande bestanden onder het gevraagde pad; de 12 zonder `#` → alle 12 bestaan. Sinds 26 maart is élk label kapot (5× a6, 13× dymo4xl). #1144/#1145 (20 min uit elkaar) en #1140/#1141 (60 min) deelden hetzelfde storage-object. Regressie: oudere objecten heten `bol-vvb-1122-a6-1772782818158.pdf` — met timestamp en zonder `#`, dus eerdere code saneerde de naam wél. Niets viel op omdat upload slaagde, `label_url` netjes gezet werd en de gebruiker meestal direct printte (dan is het laatst = het juiste).

**Uitgevoerd:** in `supabase/functions/create-bol-vvb-label/index.ts`:
- `safeLabelFileName(orderNumber, formatSuffix)` toegevoegd: strip alles buiten `[A-Za-z0-9-_]`, cap op 40 chars, plus `Date.now()`-timestamp — hetzelfde patroon als de oude, werkende objecten.
- Beide upload-plekken (r.527 retry-flow, r.936 nieuwe-label-flow) gebruiken nu die helper.
- Na elke upload een path-mismatch-check: als `uploadData.path !== requestedPath`, geen `label_url` zetten en luid `console.error`. Had dit vangnet er in maart gestaan, dan was de bug meteen opgevallen.
- Upload-fouten en path-mismatches worden bewaard in een lokale `*UploadError`: in de retry-flow gaat het in `updateFields.error_message` op de `shipping_labels`-rij, in de nieuwe-label-flow in de insert. Zonder geverifieerde upload nooit een `label_url`. Geen nieuwe statuswaarden verzonnen.
- Function gedeployed via `deploy_edge_functions`.

**Security-keuzes:** n.v.t. — geen tabellen, RLS-policies, GRANT's of routes geraakt. `upsert: true` bewust behouden (comment r.522) om vastlopende retries te vermijden; verdedigingslinie zit nu in de bestandsnaam zelf, niet in de bucket-config.

**Vervolg — bewust géén data-cleanup in deze batch:** de 18 bestaande `label_url`'s met `#` worden **NIET op NULL gezet**. `LABEL-PDF-RETRY` in `sync-bol-orders` selecteert op `status='created' AND label_url IS NULL AND external_id IS NOT NULL` — precies die 18. Ze zouden dan zonder limiet elke 5 minuten opnieuw bij Bol worden opgehaald tot `MAX_LABEL_RETRIES`. In plaats daarvan: enkel het weesobject `bol-vvb-` verwijderen (aparte SQL-batch). De afgekapte URL's geven daarna 404 in plaats van het verkeerde label, en de retry-machinerie blijft onaangeroerd. Wie een oud label nodig heeft, gebruikt de bestaande "opnieuw bijsnijden"-knop (`retry: true, recrop: true`).

## Lovable workspace-skills aangemaakt — 17 juli 2026

**Root cause:** de zes engineering-regels, release-werkwijze en DB-safety-regels leefden enkel in docs/role-audit.md en projectbestanden. De Lovable-agent las ze niet mee; elke prompt buiten een Claude-chat om miste ze. Actiepunt stond al in SellQo_Connector_Werkwijze.md.

**Uitgevoerd:** drie workspace-skills aangemaakt op workspace 8fa9AQcZxxoglV7BaRsZ: `sellqo-engineering-rules` (R1–R6 mét incidenten, commit b4a1964), `sellqo-release-werkwijze` (drie sporen, formats, JJJJ.MMx, i18n, commit 2ebfb57), `sellqo-db-safety` (M1–M5, vaste SQL-regels, SECURITY DEFINER-val, service-role-valkuil, batch-checklist, commit 66cd3c5). Elke skill heeft een expliciete scope-regel: enkel project sellqo, andere projecten negeren.

**Security-keuzes:** n.v.t. — geen tabellen, functies, routes of policies geraakt; enkel workspace-configuratie.

**Vervolg:** bij nieuwe geleerde lessen de skills updaten i.p.v. enkel role-audit; bij skills voor andere projecten zelfde patroon hanteren.

---

## Orphan cleanup + banner verduidelijking + root-cause doc (2026-06-10)

- **Cleanup migration** `cleanup_orphan_spoof_user_and_link_sander.sql`: orphan spoof-user `aaron.mercken@hotmail.com` (UUID `d020b521-0ab1-40cc-a13c-614cb879ae6d`) verwijderd uit `auth.users` (cascade naar `profiles`) en uit `user_roles` op Mancini Milano. Sander (`info@mancinimilano.com`, UUID `a183cd15-...`) gekoppeld als `tenant_admin` op Mancini (`2606c5b9-...`). Pending VanXcel-invite voor de spoof-email gerevoked met audit-log entry (`reason='orphan_spoof_cleanup_2026_06_10'`). `tenants.owner_email` van Mancini bijgewerkt naar `info@mancinimilano.com` om herhaling via `repair-tenant-access` te voorkomen.
- Mancini ownership volledig hersteld via Sander's bestaande account — geen actie nodig van Sander zelf. Stripe-reconnect blijft een aparte taak.
- **InviteTeamMemberDialog banner-teksten verduidelijkt** (`src/components/admin/settings/InviteTeamMemberDialog.tsx`) voor multi-tenant context:
  - `alreadyMember` → "Deze persoon is al lid van jouw team voor deze webshop."
  - `hasPendingInvite` → ongewijzigd (oranje + Verzend opnieuw)
  - `recentlyRevoked` → "Deze persoon was eerder verwijderd uit jouw team. Een nieuwe uitnodiging maakt een schone start."
  - `accountExists` → "Deze persoon heeft al een SellQo-account voor een andere webshop op het platform. Bij accepteren wordt jouw team toegevoegd aan hun bestaande account."
  - geen account → "Deze persoon heeft nog geen SellQo-account. Ze krijgen een uitnodiging om er één aan te maken via een bevestigingscode per e-mail."
- **Root-cause documentatie** geschreven in `docs/root-cause-mancini-orphan-role.md`: smoking gun = `repair-tenant-access` edge function, die `tenant_admin` toekent puur op basis van `auth.users.email == tenants.owner_email`. Trigger `trigger_assign_tenant_admin_on_insert` is uitgesloten (geen recent INSERT op Mancini). 0 triggers op `user_roles`. Hardening-voorstellen + "Sander's missing role mystery" op backlog gezet.

Datum: 2026-06-10

---

## Invite-flow bug-fix: remove-cleanup + route + recently_revoked detection (2026-06-09)

- **FIX 1** — `supabase/functions/remove-team-member/index.ts`: bij verwijderen van een teamlid worden alle `team_invitations` voor (tenant, email) nu gemarkeerd als `status='revoked'` met `revoked_at` + `revoked_by` (was: hard DELETE van enkel pending invites). Voor elke geraakte invite wordt een entry in `invite_audit_log` geschreven met `event_type='revoked'` en `metadata.reason='team_member_removed'`. History blijft behouden, re-invite blijft mogelijk via een nieuwe rij.
- **FIX 2** — `src/pages/AcceptInvitation.tsx`: 3× `<Link to="/auth/login">` vervangen door `<Link to="/auth">` (route `/auth/login` bestaat niet in `App.tsx`, leidde tot 404 vanaf de expired/revoked/already_accepted schermen).
- **FIX 3** — `supabase/functions/check-invite-email/index.ts`: response bevat nu `recentlyRevoked` (boolean) die `true` is wanneer er voor (tenant, email) een revoked invite bestaat in het 7-daagse venster.
- **FIX 4** — `src/components/admin/settings/InviteTeamMemberDialog.tsx`: nieuwe info-banner (blauw) tussen `hasPendingInvite` en `accountExists` die toont "Deze persoon was eerder verwijderd uit het team. Een nieuwe uitnodiging maakt een schone start." Verstuur-knop blijft enabled.

Datum: 2026-06-09

Alle hoofdstukken voltooid. Voor scope + statistiek:
`docs/fase2-eindrapport.md`.

Voor batch-detail per dag/cluster: zie secties hieronder.

---

## Hoofdstuk 5 — Cleanup post-merge (2026-06-09)

### Legacy helpers gedropt

| Functie | Reden | Verificatie |
|---|---|---|
| `public.has_role(uuid, app_role)` | Vervangen door `has_tenant_role(uuid, app_role[])` | 0 policies, 0 code-paden |
| `public.get_user_role(uuid)` | Niet meer gebruikt; rol-lookup gaat via `user_roles` + `has_tenant_role` | 0 policies, 0 code-paden |

Behouden helpers: `has_tenant_role(uuid, app_role[])`,
`get_user_tenant_ids()` (zero + uuid arg), `is_platform_admin(uuid)`.

### Sanity-check uitkomsten

1. **Tenant-blind policies overgebleven (excl. `service_role`/public/`auth.uid()`):**
   54 hits, allemaal verklaarbaar:
   - `*_service_role_all`-policies (FOR ALL TO service_role USING(true))
   - Public storefront-read op `products`, `product_variants`, `categories`,
     `homepage_sections`, `storefront_pages`, `legal_pages`,
     `sellqo_legal_pages`, `pricing_plans`, `themes`, `vat_regimes`,
     `external_reviews`, `tenant_domains`, `doc_articles`, `doc_categories`,
     `product_bundle_items`, `product_categories`, `product_variant_options`
   - `team_invitations` user-self-SELECT via `auth.uid()`
   - `channel_field_mappings` read voor alle authenticated users
2. **Legacy `has_role(uuid, app_role)` policy-calls:** 0
3. **RLS-disabled public-tabellen:** 0

### Eindrapport

- `docs/fase2-eindrapport.md` gegenereerd
- `docs/sellqo-fase2-masterplan.md` bovenin afsluiting-banner + Hoofdstuk 3
  status-tabel uitgebreid met 2D/2E/2F/H4/H5
- `docs/fase2-backlog.md` "Volgende fase"-sectie verwijderd (H4 + H5 klaar)
- `docs/role-audit.md` eindregel bijgewerkt (dit blok)

**Status:** Fase 2 VOLLEDIG AFGESLOTEN — 2026-06-09.

---

## Batch 2F-iv — Customer/Product/AI/Uncategorized dormant lockdown (2026-06-09)

### RLS-aanscherping (1 migration) — LAATSTE 2F split

| Tabel | Bestaat | SELECT | INSERT | UPDATE | DELETE |
|-------|---------|--------|--------|--------|--------|
| storefront_favorites | ✓ | tenant-scope alle rollen | service_role | — | tenant_admin |
| ai_help_conversations | ✓ | tenant-scope alle rollen | service_role | tenant_admin | tenant_admin |
| ai_help_unanswered | ✓ | tenant-scope alle rollen | service_role | tenant_admin | tenant_admin |
| ai_knowledge_index | ✓ | tenant-scope alle rollen | service_role | tenant_admin | tenant_admin |

`storefront_favorites` had RLS-aan zonder policies (effectief locked); nu rol-bewust open
via service-role schrijfpad (anon storefront → storefront-api edge function). `tenant_id`
kolom aanwezig, geen EXISTS-join via `customers` nodig (OB-2F-3 N/A op deze tabel).

AI-tabellen volgen read-only-UI patroon (OB-2F-2): alle ingelogde teamleden in de
tenant kunnen `ai_help_*` raadplegen, alleen de AI-engine (service-role) schrijft
conversations + knowledge index, tenant_admin mag corrigeren/annoteren/verwijderen.
`ai_knowledge_index` recursieve `user_roles` lookup vervangen door
`get_user_tenant_ids(auth.uid())` + `has_tenant_role` patroon.

Service-role expliciet via `FOR ALL TO service_role USING(true)` op alle 4 tabellen.
`is_platform_admin(auth.uid())` bypass overal toegevoegd.

### Niet-bestaande masterplan-tabellen (geen actie)

`customer_referrals`, `referral_rewards`, `customer_gdpr_requests`,
`gdpr_requests`, `gdpr_consents`, `product_recommendations`,
`product_compatibility`, `product_compatibility_map`, `product_search_logs`
— bestaan niet in huidig schema.

### Reeds gehard (geen actie)

- `email_unsubscribes` (tenant_id kolom aanwezig; reeds rol-bewust gehard met
  `tenant_admin/staff/marketing/accountant` SELECT en `tenant_admin` write).
- Overige `customer_*` tabellen → Batch 2B2.
- Overige `product_*` tabellen → Batch 2C1a-i/ii/iii.
- Overige `ai_*` tabellen (`ai_user_behavior_log`, `ai_user_learning_patterns`,
  `ai_usage_log`, `ai_generated_*`, `ai_assistant_config`, `ai_coach_settings`,
  `ai_feedback`, `ai_action_suggestions`, `ai_reply_suggestions`,
  `ai_prompt_favorites`, `ai_chatbot_conversations`, `ai_content_edits`,
  `ai_credit_purchases`, `ai_learning_patterns`) volgen reeds AI read-only-UI
  patroon of zijn rol-bewust gehard in eerdere batches.

### Uncategorized

Geen overgebleven uncategorized tabellen in scope na sweep — OB-2F-1 default
(allow-tenant-scope-read) niet geactiveerd in deze split.

### Beslispunten bevestigd

- **OB-2F-1** (uncategorized default): niet van toepassing — geen restantsweep nodig.
- **OB-2F-2** (AI-engine behouden): bevestigd, read-only-UI patroon toegepast op
  `ai_help_conversations`, `ai_help_unanswered`, `ai_knowledge_index`.
- **OB-2F-3** (geen tenant_id scope via customers join): niet van toepassing —
  `storefront_favorites` blijkt wél een `tenant_id` kolom te hebben en
  `email_unsubscribes` is reeds gehard met `tenant_id`. Geen EXISTS-joins
  nodig.

### Service-role pad behouden

- AI-engine edge functions (`ai-help`, `ai-knowledge-indexer`) blijven schrijven
  via `SUPABASE_SERVICE_ROLE_KEY`.
- Storefront favorites worden geschreven via `storefront-api` (service-role).
- Anon endpoints raken geen van deze tabellen direct.

### STATUS: Heel 2F (i + ii + iii + iv) AFGESLOTEN

Alle dormant-cluster lockdown migrations toegepast. Geen openstaande 2F-items.

---

## Batch 2F-iii — Ads-restant + Analytics/Tracking dormant lockdown (2026-06-09)

### RLS-aanscherping (1 migration)

**Ads-restant**: alle aanwezige `ads_*` per-platform tabellen (amazon: adgroups/
campaigns/keywords/performance/search_terms; bolcom: idem + targeting_products;
google: campaigns/performance; meta: adsets/campaigns/performance; +
ads_product_channel_map, ads_ai_rules) zijn reeds rol-bewust gehard in Batch
2C2a-iii met `has_tenant_role(['tenant_admin','staff','marketing'])` voor write
en tenant-scope SELECT (incl. viewer). Geen verdere wijziging nodig.

**Analytics/Tracking**: 3 tabellen tenant-blind SELECT vervangen door
rol-bewuste policies. INSERT blijft via service-role (event-trackers) of
bestaande user-policy. DELETE strict tenant_admin (retention).

| Tabel | Bestaat | SELECT | INSERT | DELETE |
|-------|---------|--------|--------|--------|
| customer_events | ✓ | tenant_admin/staff/marketing/accountant | service_role | tenant_admin |
| feature_usage_events | ✓ | tenant_admin/staff/marketing/accountant | service_role + user-self (bestaand) | tenant_admin |
| tracking_import_log | ✓ | tenant_admin/staff/warehouse/accountant | service_role | tenant_admin |

Service-role expliciet via `FOR ALL TO service_role USING(true)` op alle 3.
`is_platform_admin(auth.uid())` bypass overal toegevoegd.
`ai_user_behavior_log` behoudt user-self-SELECT pattern (AI read-only-UI).

### Niet-bestaande masterplan-tabellen (geen actie)

`events_processed`, `events_archive`, `cohort_definitions`, `cohort_members`,
`funnel_definitions`, `funnel_runs`, `behavioural_events`, `conversion_events`,
`session_recordings`, `attribution_models`, `attribution_runs`,
`meta_ad_accounts`, `meta_ad_sets`, `meta_ad_creatives`, `meta_pixels`,
`google_ad_accounts`, `google_keywords`, `google_negative_keywords`,
`amazon_ads_*`, `amazon_sponsored_*` — bestaan niet in huidig schema.

### Service-role pad behouden

- Event-trackers (`track-storefront-event`) blijven inserten via service-role
  op `customer_events`.
- Webhook `tracking-webhook` blijft schrijven naar `tracking_import_log` via
  service-role.
- Per-platform ads-sync runners ongewijzigd (reeds gehard 2C2a-iii).

---

## Batch 2E — POS RLS + edge-function role-checks (2026-06-09)

### RLS-aanscherping (1 migration)

Alle 8 actieve POS-tabellen tenant-blind policies gedropt en vervangen door
rol-bewuste per-cmd policies + service-role bypass. Resultaat: 5 policies per
tabel (SELECT/INSERT/UPDATE/DELETE auth + ALL service_role), geen
tenant-blind ALL meer.

| Tabel | Bestaat | SELECT | INSERT/UPDATE | DELETE |
|-------|---------|--------|---------------|--------|
| pos_sessions | ✓ | tenant_admin/staff/accountant | tenant_admin/staff | tenant_admin |
| pos_transactions | ✓ | tenant_admin/staff/accountant | tenant_admin/staff | tenant_admin |
| pos_cash_movements | ✓ | tenant_admin/staff/accountant | tenant_admin/staff | tenant_admin |
| pos_parked_carts | ✓ | tenant_admin/staff/accountant | tenant_admin/staff | tenant_admin |
| pos_offline_queue | ✓ | tenant_admin/staff/accountant | tenant_admin/staff | tenant_admin |
| pos_cashiers | ✓ | tenant_admin/staff | tenant_admin | tenant_admin |
| pos_terminals | ✓ | tenant_admin/staff | tenant_admin | tenant_admin |
| pos_quick_buttons | ✓ | tenant-scope alle rollen | tenant_admin/staff/marketing | tenant_admin/staff/marketing |

Service-role + `is_platform_admin(auth.uid())` overal expliciet als bypass.

### Niet-bestaande masterplan-tabellen (geen actie)

`pos_transaction_lines`, `pos_payments`, `pos_tabs`, `pos_tab_items`,
`pos_cash_drawers`, `pos_devices`, `pos_settings`, `pos_receipts`,
`pos_receipt_templates`, `pos_discounts_applied`, `pos_categories`,
`pos_collab_menus`, `pos_collab_menu_items`, `pos_shift_reports`,
`pos_z_reports`, `pos_x_reports`, `pos_device_pairings` — bestaan niet in
huidig schema, gedocumenteerd in `docs/fase2-batch-2e-recon.md`.

### Edge-function role-checks

| Function | Wijziging | Allowed roles |
|----------|-----------|---------------|
| `pos-create-payment-intent` | + authenticateRequest + requireRole | tenant_admin, staff |
| `pos-process-payment` | + authenticateRequest + requireRole | tenant_admin, staff |
| `pos-manage-reader` | + authenticateRequest + requireRole (OB-2E-6) | tenant_admin |
| `pos-refund-payment` | reeds gehard in 2A2b, ongewijzigd geverifieerd | tenant_admin |

`supabase/config.toml`: `verify_jwt = false` toegevoegd voor de 3 nieuw
geharde functies (consistent met andere admin-functions die in-code auth
doen via shared helper).

### Beslispunten bevestigd

- **OB-2E-1**: accountant SELECT op operationele POS-tabellen (BTW-aansluiting).
- **OB-2E-2**: marketing beheert `pos_quick_buttons` (UI-content).
- **OB-2E-3**: staff mag `pos_cashiers` SELECT (shift-overdracht).
- **OB-2E-4**: DELETE op operationele/fiscale tabellen alleen tenant_admin.
- **OB-2E-5**: service-role behoudt impliciete bypass voor webhooks/runners.
- **OB-2E-6**: `pos-manage-reader` (terminal pairing) is tenant_admin only.
- **OB-2E-7**: platform_admin bypass via `is_platform_admin(auth.uid())` overal expliciet.
- **OB-2E-8**: PIN-beheer (`pos_cashiers` INSERT/UPDATE/DELETE) is admin-only.

### Pre-flight De Fiere Margriet

`SELECT role, COUNT(*) FROM user_roles WHERE tenant_id = DFM` → **0 rijen**.
Geen actieve POS-gebruikers, geen productie-impact verwacht. Toog draait
elders, SellQo native POS is leeg in DFM-tenant.

### Verificatie

```
SELECT tablename, cmd, COUNT(*) FROM pg_policies
WHERE schemaname='public' AND tablename LIKE 'pos_%'
GROUP BY tablename, cmd ORDER BY tablename, cmd;
```
Resultaat: 8 tabellen × 5 policies (ALL=service_role + 4 per-cmd auth) = 40 rijen.

Datum: 2026-06-09

---

Volgende stap: Hoofdstuk 4 (frontend gating) — useCan/PermissionGate 
uitrol over admin-UI.

Voor batch-detail per dag/cluster: zie secties hieronder.

---

## Hoofdstuk 4b — Hotspot-pagina's (2026-06-09)

### Nieuwe herbruikbare componenten

- `src/components/permissions/GatedButton.tsx` — knop met automatische
  `useCan` check. Default fallback `disable+tooltip` (beslispunt H4-1),
  optioneel `fallback="hide"`. Tooltip uit `TOOLTIP_NO_ACCESS_LONG`.
- `src/components/permissions/ReadOnlyBadge.tsx` — kleine badge "Alleen-lezen"
  naast page-title, alleen zichtbaar bij gebrek aan write-rechten
  (beslispunt H4-2).
- `src/components/permissions/MaskedValue.tsx` — `••• EUR`-style fallback
  voor field-level masking (beslispunt H4-7).
- `src/components/permissions/index.ts` — barrel re-export.

### Cluster: Orders

- `pages/admin/Orders.tsx`:
  - `ReadOnlyBadge resource="orders"` naast page-title.
  - Row-level + mobile-card "Verwijderen" item gated op
    `useCan('write', 'orders')` (hide).
  - **TODO H4c:** OrderBulkActions component, status-transitions per item
    in dropdown (annuleren/processing/shipped/delivered).
- `pages/admin/Invoices.tsx`:
  - `ManualInvoiceDialog` gewrapt in `<PermissionGate write invoices>`.
  - `ReadOnlyBadge resource="invoices"`.
  - **TODO H4c:** Creditnota row-actions (`CreateCreditNoteFromInvoiceButton`),
    Peppol "mark as sent" actions.
- `pages/admin/Fulfillment.tsx`: **TODO H4c** (geen page-level CTA gewijzigd
  in deze batch; bulk-acties + import-dialog volgen in H4c).
- `pages/admin/OrderDetail.tsx`: **TODO H4c** (refund/cancel/edit knoppen).

### Cluster: Products

- `pages/admin/Products.tsx`:
  - `ReadOnlyBadge resource="products"` naast page-title.
  - "Nieuw product"-knop (incl. limiet-tooltip-variant) gewrapt in
    `<PermissionGate write products>` met `<GatedButton>` fallback.
- `pages/admin/ProductForm.tsx`:
  - `cost_price` FormField volledig gewrapt in
    `<PermissionGate action="read" resource="product_costs">` →
    veld is onzichtbaar voor rollen zonder kostenprijs-toegang
    (vermijdt accidentele empty-save bij submit).
- **TODO H4c:** cost_price masking in spreadsheet-grid
  (`components/admin/products/grid/`) — `MaskedValue` per cel, plus
  uitsluiten in `BulkPricingTab.tsx` voor non-authorized rollen.

### Cluster: Customers

- `pages/admin/Customers.tsx`:
  - `ReadOnlyBadge resource="customers"`.
  - `CustomerFormDialog` gewrapt in `<PermissionGate write customers>`.
- **TODO H4c:** row-delete (tenant_admin only), export-knoppen,
  customer-notes tab gating in `CustomerDetail.tsx`.

### Cluster: Marketing

- `pages/admin/Marketing.tsx`:
  - `ReadOnlyBadge resource="marketing"`.
  - "Nieuw segment" + "Nieuwe campagne" knoppen vervangen door
    `<GatedButton action="write" resource="marketing">`.
- `pages/admin/Discounts.tsx`:
  - `ReadOnlyBadge resource="discount_codes"`.
  - Beide "Nieuwe code" Buttons → `<GatedButton write discount_codes>`.
- `pages/admin/SEODashboard.tsx`:
  - `ReadOnlyBadge resource="seo"`.
  - **TODO H4c:** `analyzeSEO()` knop gaten op `write seo`.
- `pages/admin/Ads.tsx`:
  - `ReadOnlyBadge resource="ads"`.
  - **TODO H4c:** budget-input fields gaten op `write ad_budgets`
    (tenant_admin only — beslispunt H4-7 pattern).
- `pages/admin/AIMarketingHub.tsx`:
  - `ReadOnlyBadge resource="ai_assistant"`.

### Stats per page

| Page | `<PermissionGate>` | `<GatedButton>` | `<ReadOnlyBadge>` | `<MaskedValue>` |
|---|---|---|---|---|
| Orders.tsx | — | — | 1 | — |
| Invoices.tsx | 1 | — | 1 | — |
| Products.tsx | 1 | 1 (fallback) | 1 | — |
| ProductForm.tsx | 1 (cost_price) | — | — | — |
| Customers.tsx | 1 | — | 1 | — |
| Marketing.tsx | — | 2 | 1 | — |
| Discounts.tsx | — | 2 | 1 | — |
| SEODashboard.tsx | — | — | 1 | — |
| Ads.tsx | — | — | 1 | — |
| AIMarketingHub.tsx | — | — | 1 | — |

### Resterende ungated UI → H4c

1. **Row-action menus** (Orders, Invoices, Customers, Products):
   status-transitions, Peppol-acties, archive/restore. Strategie: ofwel
   filter `ActionItem[]` op `useCan`, ofwel verberg lege menu's.
2. **OrderDetail** modals: refund, cancel, edit-address, manual-status-correct
   (gebruik resource `order_status` + action `correct` voor de bypass-knop).
3. **Bulk-action bars** (`OrderBulkActions`, product-bulk-edit,
   customer-export): filter actions per `useCan`.
4. **cost_price masking in spreadsheet-grid** + `BulkPricingTab`
   (huidige gate is alleen in single-edit form).
5. **Ads budget-inputs** — `ad_budgets` (tenant_admin only) field-level
   gating in `AdsBolcomCampaignDetail` en budget-edit dialogs.
6. **CustomerDetail**: notes-tab (verbergen voor marketing/warehouse),
   delete-knop (tenant_admin only), data-export.
7. **Themes / CMS / Translations** pagina's — H4d cluster (page-level
   nog niet aangeraakt; sidebar+route-guard al klaar).
8. **POS / Inventory / Suppliers** — H4e cluster.

Datum: 2026-06-09.

---

## Hoofdstuk 4a — Sidebar + Route-guards (2026-06-09)

### H4-5 verificatie — multi-tenant rol-binding

**Bevinding: GAT bevestigd.** `useAuth().roles` returnt alle
`user_roles`-records van de ingelogde user — niet gefilterd op
`currentTenant.id`. Een user met `tenant_admin@A` + `viewer@B` zag
effectief `tenant_admin`-permissies in tenant B via `useCan`.

**Fix locatie: `src/hooks/useCan.ts`.** `useCan` leest nu `TenantContext`
(via `useContext`) en filtert `roles` op `r.tenant_id === currentTenant.id`
(plus `tenant_id IS NULL` voor platform-rollen). `platform_admin` blijft
globaal bypassen. `useAuth` zelf is bewust ongewijzigd zodat tenant-
switcher en role-priority logic gelijk blijven.

Dezelfde scoping is toegepast in `AdminSidebar.tsx` voor de whitelist-
evaluatie.

### Sidebar whitelist-conversie

- `NavItem.requireRead?: Resource` toegevoegd in
  `src/components/admin/sidebar/sidebarConfig.ts`.
- Alle dagelijkse / verkoop / marketing / beheer / systeem items hebben
  nu een `requireRead`-mapping naar de bestaande permissie-matrix in
  `src/hooks/useCan.ts`. Items zonder duidelijke resource (Dashboard,
  Help, Shipping, Categorieën-subpaden zonder eigen resource) blijven
  op legacy `excludeRoles`.
- `AdminSidebar.shouldHideItem` honoreert `requireRead` als hoogste
  prioriteit; legacy `allowedRoles` / `excludeRoles` blijven werkend
  als fallback.

### Route-guards

- `src/components/admin/RouteGuard.tsx` toegevoegd. Props:
  `requireRead?: Resource`, `requireWrite?: Resource`,
  `requireRole?: AppRole[]`. Bij 403 → `Navigate to="/no-access?from=…"`.
- `src/App.tsx` admin-routes ge-wrapped (hotspot-eerst):
  | Route | Guard |
  |---|---|
  | `/admin/orders` + `/orders/:id` | read `orders` |
  | `/admin/fulfillment` | read `orders` |
  | `/admin/returns` (+ `:id`) | read `returns` |
  | `/admin/orders/invoices` | read `invoices` |
  | `/admin/orders/discounts` | read `discount_codes` |
  | `/admin/promotions` | read `discount_codes` |
  | `/admin/products` | read `products` |
  | `/admin/products/new` + `:id/edit` | write `products` |
  | `/admin/customers` (+ detail) | read `customers` |
  | `/admin/payments` | read `payments` |
  | `/admin/billing` | read `platform_billing` |
  | `/admin/settings` | read `settings_general` |
  | `/admin/notifications` | read `settings_general` |
  | `/admin/connect` (+ subpaden) | read `integrations` |
  | `/admin/import` | read `integrations` |
  | `/admin/marketing` | read `marketing` |
  | `/admin/marketing/ai` | read `ai_assistant` |
  | `/admin/marketing/ai-center` | read `ai_coach` |
  | `/admin/marketing/seo` | read `seo` |
  | `/admin/marketing/translations` | read `cms` |
  | `/admin/reports` + `/analytics` | read `reports` |
  | `/admin/suppliers` + `purchase-orders` + `supplier-documents` | read `suppliers` |
  | `/admin/pos` | read `pos` |
  | `/admin/storefront` | read `themes` |
  | `/admin/ads` (+ bolcom/ai/products) | read `ads` |

  Platform-only routes (`/admin/platform/**`) blijven via bestaande
  `ProtectedRoute requirePlatformAdmin`.

### /no-access pagina — context-aware

- `src/pages/NoAccess.tsx` leest `?from=` query, humanizeert via een
  vaste route-label-map, en toont `"Geen toegang tot {Label}"` in de H1.
- Knoppen: "Naar dashboard" (default) + "Vraag toegang aan" (mailto naar
  `currentTenant.owner_email` met geprefilled subject/body, alleen
  zichtbaar wanneer `TenantContext` beschikbaar is — page werkt ook
  buiten provider zonder te crashen).

### Tooltip-constanten

- `src/lib/permissions/constants.ts` toegevoegd met
  `TOOLTIP_NO_ACCESS_LONG` + `TOOLTIP_NO_ACCESS_SHORT`. Wordt in H4b
  toegepast op `GatedButton` en disabled write-acties.

Datum: 2026-06-09.

---

# SellQo Role Audit — Index

Living document tracking the role-aware RLS / hardening work across phases.
Phase-specific deep-dives live in their own files; this file holds the
chronological summary and completion log.

Related documents:
- `docs/role-audit-phase1-classification.md` — Phase 1 table classification
- `docs/role-audit-phase1d-triage.md` — Phase 1D triage + Fase 2A DROP batch
- `docs/sellqo-fase2-masterplan.md` — Fase 2 masterplan (role-aware RLS)
- `docs/fase2-backlog.md` — Geparkeerde post-Fase-2 items
- `docs/sql/fase2-pre-schema-sync.sql` — Pre-Fase 2 schema dump (40 tables)

---

## Schema-sync 2026-06-03 completed

**Goal.** Eliminate drift between production DB and GitHub repo before
starting Fase 2, so that any rebuild / second environment / rollback has
a complete migration history to replay.

**Scope.**
- **Dropped (3 one-off ops tables, no longer needed):**
  - `shopify_dates_staging`
  - `stock_snapshot_pre_reconcile_20260430`
  - `stock_snapshot_pre_reconcile_final`
  - Migration: timestamped DROP migration (Pre-Fase 2 cleanup).
- **Captured (40 tables with no committed DDL):**
  `admin_actions_log`, `ai_coach_settings`, `ai_credit_purchases`,
  `automatic_discounts`, `automation_runs`, `automation_step_runs`,
  `automation_steps`, `bogo_promotions`, `bundle_products`,
  `customer_group_members`, `customer_group_product_prices`,
  `customer_groups`, `customer_loyalty`, `discount_stacking_rules`,
  `email_preferences`, `email_signatures`, `email_template_blocks`,
  `feature_usage_events`, `gift_promotions`, `import_category_mappings`,
  `import_jobs`, `import_mappings`, `inbox_folders`, `loyalty_programs`,
  `loyalty_tiers`, `loyalty_transactions`, `marketplace_listing_queue`,
  `message_templates`, `pos_cashiers`, `product_bundles`,
  `product_categories`, `returns`, `storefront_api_keys`,
  `storefront_webhooks`, `sync_conflicts`, `tenant_feature_overrides`,
  `tenant_transaction_usage`, `volume_discount_tiers`,
  `volume_discounts`, `webhook_deliveries`.

**Deliverable.** `docs/sql/fase2-pre-schema-sync.sql` — a single
idempotent SQL file containing for every captured table:
- `CREATE TABLE IF NOT EXISTS` with exact columns, types, defaults,
  nullability as in production on 2026-06-03;
- Primary key, unique, check and foreign-key constraints wrapped in
  `DO $$ ... IF NOT EXISTS ... END $$` guards;
- `CREATE INDEX IF NOT EXISTS` for all non-constraint indices;
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` where production has it on;
- `GRANT` statements for `anon` / `authenticated` / `service_role`
  matching live privileges;
- `CREATE POLICY` blocks (guarded) for every RLS policy in production.

**Idempotency.** Every statement is guarded so the file is a no-op
against the current production database and a faithful rebuild against
a fresh environment.

**Verification.** Generated directly from `pg_catalog` /
`information_schema` on 2026-06-03 against project ref
`gczmfcabnoofnmfpzeop`. Re-running the introspection after the drops
confirms 40 captured tables and 0 remaining missing tables in the
target set.

**Status.** Pre-Fase 2 schema-sync ✅ completed. Ready for Fase 2A.

---

## Fase 2 beslispunten vastgeklikt

**Datum.** 2026-06-03
**Status.** Vastgeklikt voor Fase 2-uitrol — niet meer heropenen tijdens
implementatie zonder expliciete herbeoordeling.

1. **Staff mag orders annuleren: JA**, mits elke annulering een entry
   schrijft in `admin_actions_log`
   (`action_type = 'order_cancelled'`, met `target_tenant_id`,
   `actor user_id`, en order-context in `action_details`). Geen extra
   approval-flow; de audit-log is de control.
2. **Staff mag ad-budgetten wijzigen (ads_meta / ads_google /
   ads_amazon / ads_bolcom): NEE.** Alleen `tenant_admin` (en
   `platform_admin` via bypass) mag budget-velden muteren. Staff houdt
   read-only zicht voor operationele monitoring; UI moet de
   budget-controls disablen voor non-admins.
3. **Customer-data voor accountant: OPTIE A — aparte view
   `customers_invoice_view`** die alleen factuur-relevante kolommen
   exposeert: `id`, `tenant_id`, `email`, `first_name`, `last_name`,
   `default_billing_address`, `btw_number`, `total_spent`. Accountant
   krijgt GEEN directe SELECT op `customers`; alle accountant-facing
   queries (rapporten, exports, facturen) routeren via deze view.

---

## Fase 2 Foundation completed

**Datum.** 2026-06-03
**Status.** ✅ Foundation gelegd — backwards-compatible, geen bestaande
code aangeraakt buiten de uitbreidingen hieronder.

### 1. Database — `has_tenant_role` helper

```sql
CREATE OR REPLACE FUNCTION public.has_tenant_role(
  _tenant_id uuid,
  _allowed_roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (ur.tenant_id = _tenant_id OR ur.role = 'platform_admin'::public.app_role)
      AND ur.role = ANY(_allowed_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'::public.app_role
  );
$$;
```

- `SECURITY DEFINER`, `STABLE`, `SET search_path = ''` — geen
  schema-resolutie-spoofing mogelijk.
- `EXECUTE` toegekend aan `authenticated` en `service_role`; ingetrokken
  van `PUBLIC`.
- Platform-admin bypass zit ingebakken in de tweede `EXISTS`-tak, zodat
  RLS-policies geen aparte `is_platform_admin()`-clausule meer hoeven.

Daarnaast `public.test_has_tenant_role()` (SECURITY DEFINER, alleen
`service_role` mag `EXECUTE`) — voert de 5 Foundation-scenario's uit en
retourneert een tabel `(scenario, expected, actual, passed)`:

1. user zonder rol → `false`
2. user met juiste rol → `true`
3. user met andere rol → `false`
4. platform_admin ongeacht `_allowed_roles` → `true`
5. verkeerd `tenant_id` voor user → `false`

### 2. Edge-function-laag — `supabase/functions/_shared/auth.ts`

- `AuthResult` uitgebreid met optioneel
  `roles_by_tenant?: Record<string, AppRole[]>` (backwards-compatible —
  bestaande functies dereferencen alleen `user_id`/`email`/`tenant_ids`/`is_platform_admin`).
- `authenticateRequest` bouwt deze map uit dezelfde `user_roles`-query
  die al gedaan werd; nul extra round-trips. Service-role bypass
  returnt een lege map.
- Nieuwe export `requireRole(auth, tenantId, allowed: AppRole[])`:
  - Bypass voor `auth.user_id === "service_role"` (server-to-server).
  - Bypass voor `auth.is_platform_admin === true`.
  - Gooit `AuthError(403, "Insufficient role for this action")` bij
    mismatch.
- Nieuwe export `type AppRole` zodat batch-implementatieprompts
  consistent kunnen typen.

### 3. Frontend bouwstenen

- `src/hooks/useCan.ts` — `useCan(action, resource)` plus de exporteerbare
  `PERMISSION_MATRIX` (gespiegeld aan Hoofdstuk 2 van het masterplan) en
  pure helper `canWithRoles(roles, action, resource)` voor tests.
  `platform_admin` voldoet altijd via bypass.
- `src/components/PermissionGate.tsx` — declaratieve wrapper voor inline
  UI-gating (`<PermissionGate action="write" resource="orders">…`).
- `src/components/ProtectedRoute.tsx` — uitgebreid met optionele
  `requires?: AppRole[]`; bestaande `requirePlatformAdmin` blijft werken.
  Mismatch redirect naar `/no-access`.
- `src/pages/NoAccess.tsx` + route `/no-access` in `src/App.tsx`.
- `src/hooks/useCan.test.ts` — 8 vitest-scenario's (alle 6 rollen +
  empty-roles + combined-roles), allemaal groen.

### 4. Bewust niet aangeraakt

- `useAuth.tsx` ad-hoc booleans `isAccountant`, `isWarehouse`,
  `hasFinancialAccess` blijven bestaan. Migratie naar `useCan` is tech
  debt voor Fase 3 cleanup (zie masterplan §5.2).
- Bestaande edge functions: geen `requireRole`-call toegevoegd; dat
  gebeurt batch-per-batch (2A1 → 2F).
- Bestaande RLS-policies: ongewijzigd. `has_tenant_role` wordt ingezet
  vanaf Batch 2A1.

## Batch 2A0 — Warehouse status edge function completed (2026-06-03)

Pre-step voor 2A1 RLS-aanscherping op `public.orders`. Doel: alle
client-side mutaties op `orders.status` lopen via een gevalideerde edge
function zodat warehouse-UI niet breekt zodra RLS de directe `UPDATE`
op de `status`-kolom dichttrekt.

### 1. Edge function — `supabase/functions/update-order-fulfillment-status/index.ts`

- Auth: `authenticateRequest(req, tenant_id)` (JWT + tenant-binding).
- RBAC: `requireRole(auth, tenant_id, ['tenant_admin', 'staff', 'warehouse'])`.
- Whitelist body: `{ order_id, new_status, tracking_number?, tracking_url?, shipped_at?, delivered_at? }`.
- Server-side transitiematrix:
  - `pending → processing | cancelled`
  - `processing → shipped | cancelled`
  - `shipped → delivered`
  - `delivered`, `cancelled`, `returned`, `partially_returned` → terminaal
    (returned-flow leeft in returns-module, niet hier).
- `cancelled` als doel-status vereist extra `requireRole(['tenant_admin','staff'])` —
  **warehouse mag dus géén orders annuleren**.
- Whitelist UPDATE-kolommen: `status`, `tracking_number`, `tracking_url`,
  `shipped_at`, `delivered_at`, `cancelled_at` (auto), `updated_at`.
  Alles wat niet in deze lijst staat (carrier, fulfillment_status, totalen,
  customer-data, …) is niet aanpasbaar via deze functie.
- Auto-stempel `shipped_at` / `delivered_at` / `cancelled_at` als de
  caller ze niet meegeeft.
- Idempotent: dezelfde `from_status === new_status` is een no-op (handig
  voor bulk-acties).
- Audit-log: insert in `admin_actions_log` met
  `action_type='order_fulfillment_status_update'` en
  `action_details: { order_id, from_status, to_status, fields_updated }`.
- Service-role bypass (cron/webhook) blijft werken via
  `requireRole`-bypass in `_shared/auth.ts`.

### 2. Frontend-migratie-impact

Alle directe `supabase.from('orders').update({ status: … })`-calls in
admin/warehouse UI vervangen door
`supabase.functions.invoke('update-order-fulfillment-status', …)`:

- `src/hooks/useOrders.ts` — `updateOrderStatus` mutation.
- `src/components/admin/OrderBulkActions.tsx` — `handleBulkStatusUpdate`
  (loop per order, want edge fn is single-order).
- `src/components/admin/FulfillmentBulkActions.tsx` —
  `handleMarkAsShipped` + `handleMarkAsDelivered` (loop). `fulfillment_status`
  blijft direct geüpdatet als secundair veld (niet in whitelist).
- `src/hooks/useOrderShipping.ts` — `updateTracking` doet eerst edge fn
  (status + tracking-velden), daarna directe update voor `carrier` +
  `fulfillment_status`.
- `src/components/admin/fulfillment/TrackingImportDialog.tsx` — alleen
  edge fn aanroepen als huidige status `pending`/`processing` is (dezelfde
  pre-check als voorheen); rest van velden (`carrier`, `tracking_status`,
  `last_tracking_check`) blijft directe update.
- `src/hooks/usePaymentConfirmation.ts` — splitst nu in twee stappen:
  (a) `payment_status='paid'` directe update met `.select()` om te zien of
  de order daadwerkelijk nog pending was; (b) als ja én oude `status='pending'`
  → edge fn voor transitie naar `processing`.
- `src/components/admin/BankReconciliationUpload.tsx` — idem
  payment-confirmation patroon; 422 "invalid status transition" wordt
  in reconciliation-context bewust genegeerd (order kan al `processing` zijn).

Niet gemigreerd (terecht):
- `src/pages/admin/Fulfillment.tsx` `updateTracking` schrijft alleen
  `fulfillment_status` + tracking-velden, **niet** `status`.
- Cron/sync/webhook edge functions die service-role gebruiken
  (marketplace-sync, bol-com-webhook, …) — bypass blijft.

### 3. Status-transitie-regels (samenvatting voor reviewers)

| Van \ Naar    | processing | shipped | delivered | cancelled |
|---------------|------------|---------|-----------|-----------|
| pending       | ✅ alle    | ❌      | ❌        | ✅ admin/staff |
| processing    | —          | ✅ alle | ❌        | ✅ admin/staff |
| shipped       | ❌         | —       | ✅ alle   | ❌        |
| delivered     | ❌         | ❌      | —         | ❌        |
| cancelled / returned / partially_returned | terminaal — geen transitie |

"alle" = `tenant_admin`, `staff`, `warehouse` (plus `platform_admin`
bypass). `cancelled` blokkeert `warehouse` expliciet.

`viewer` en `accountant` zitten niet in de allowed-set en krijgen 403
op elke status-mutatie.

### 4. Geen RLS-wijzigingen in deze batch

`public.orders` RLS staat nog op de oude `has_role`-policies. Aanscherping
(drie-policy met `has_tenant_role` + warehouse beperkt tot status/tracking
kolommen via aparte UPDATE-policy) volgt in Batch 2A1, nu deze edge function
live en backwards-compatible draait.

---

## Batch 2A1 — Orders RLS-aanscherping completed

Datum: 2026-06-03

Doel: tenant-blind / legacy `has_role`-policies vervangen door rol-aware
`has_tenant_role(tenant_id, ARRAY[...]::app_role[])`-policies op alle orders /
shipping / returns / packing / digital-delivery / audit-log-tabellen. Service-
role en platform-admin bypass-policies blijven ongewijzigd.

### Nieuwe RLS-policies per tabel

**orders** — dropped: `Users can insert orders for their tenant`,
`Users can update their tenant's orders`, `Tenant admins can delete their tenant's orders`.
```sql
CREATE POLICY "Auth users can view tenant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff can insert tenant orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

CREATE POLICY "Admin/staff can update tenant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

CREATE POLICY "Tenant admins can delete tenant orders"
  ON public.orders FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```
Warehouse muteert orders uitsluitend via de 2A0-edge-function
`update-order-fulfillment-status` (service-role pad).

**order_items** — idem orders, FK-scope via `order_id → orders.tenant_id`.
Geen warehouse-write (lijnen worden nooit door warehouse aangepast).

**returns** — dropped: `Tenants can view/insert/update own returns`.
SELECT tenant-scope, INSERT/UPDATE `has_tenant_role(['tenant_admin','staff','warehouse'])`,
DELETE `has_tenant_role(['tenant_admin'])`. Geen anon-policy (klant-tracking
blijft via edge function — buiten 2A1 scope).

**shipping_labels** — dropped alle 5 overlappende policies (`ALL` + losse
SELECT/INSERT/UPDATE × 2). Drie-policy met
`has_tenant_role(['tenant_admin','staff','warehouse'])` op INSERT/UPDATE,
admin-only DELETE.

**shipping_status_updates** — dropped: `Users can manage their tenant shipping status updates`
(`ALL`-policy). SELECT tenant-scope blijft; INSERT/UPDATE alleen via
service-role (webhook-pad).

**shipping_methods** — gemigreerd van `has_role` → `has_tenant_role` voor
consistentie (semantisch identiek, tenant-scoped helper).

**packing_slips & packing_slip_lines** — dropped afwijkende
`EXISTS(user_roles…)`-policy. Drie-policy `has_tenant_role(['tenant_admin','staff','warehouse'])`
op WRITE, admin-only DELETE. `packing_slip_lines` heeft géén `tenant_id`-kolom
→ FK-scope via `packing_slip_id`.

**digital_deliveries** — drie-policy `has_tenant_role(['tenant_admin','staff'])`
op INSERT/UPDATE (licentiesleutels), admin-only DELETE.

**tracking_import_log** — dropped: `System can insert import logs`. SELECT
tenant-scope blijft (audit visible); INSERT alleen via service-role.

**inventory_sync_log** — dropped: `Users can insert inventory sync logs for their tenant`.
SELECT tenant-scope blijft (audit visible); INSERT alleen via service-role.

### Edge function role-checks (requireRole toegevoegd)

| Functie | requireRole-call |
|---|---|
| create-shipping-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| confirm-bol-shipment | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| create-bol-vvb-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| create-amazon-buy-shipping-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| fetch-external-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| import-bol-shipments | `requireRole(auth, connection.tenant_id, ['tenant_admin','staff','warehouse'])` |
| send-return-email | `requireRole(auth, tenantId, ['tenant_admin','staff','warehouse'])` |
| process-refund | `requireRole(auth, refundTenantId, ['tenant_admin','staff'])` *(geen warehouse)* |
| generate-invoice | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','accountant'])` |
| run-csv-import | `requireRole(auth, tenant_id, ['tenant_admin'])` |

Webhook / cron / sync / storefront / fulfillment-api-functies blijven ongewijzigd
(service-role, geen user-context).

Drie functies (`create-amazon-buy-shipping-label`, `fetch-external-label`,
`import-bol-shipments`) hadden een dangling `tenant_id`-referentie vóór de
order/connection-fetch; deze is verplaatst naar nà de fetch zodat
`authenticateRequest(req, tenantId)` + `requireRole(...)` een echte tenant
meekrijgen.

### Test-resultaten per rol

Aanvullen na productie-validatie:

- [ ] tenant_admin: status-update via `update-order-fulfillment-status` ✅
- [ ] tenant_admin: nieuwe order via `storefront-api` (service-role) ✅
- [ ] staff: refund via `process-refund` ✅
- [ ] viewer: order bewerken → 403 ❌
- [ ] warehouse: order annuleren → 403 ❌ (al gevalideerd in 2A0)
- [ ] Bol-sync blijft draaien (service-role) ✅
- [ ] Stripe-webhook blijft draaien (service-role) ✅

### Rollback-pad

Bij issues: restore via Cloud → Database → Backups (snapshot van 2026-06-03
02:54 UTC bevat pre-2A1 policies), of revert via chat-history op deze loop
gevolgd door redeploy van de oude edge functions.
---

## Batch 2A0/2A1 — UX-fixes (2026-06-03)

Twee follow-ups op de fulfillment-flow.

### 1. Cancelled orders uit fulfillment-lijst gefilterd
`src/pages/admin/Fulfillment.tsx` query op `orders` krijgt extra filter:

```ts
.not('status', 'in', '(cancelled,returned,partially_returned)')
```

Reden: deze orders verschenen onder het label "Te verzenden" omdat de UI
alleen op `fulfillment_status` filterde. Ze horen thuis in `/admin/orders`,
niet in de fulfillment-queue. Bulk-selectie kan ze daardoor ook niet meer
per ongeluk raken.

### 2. Correctie-pad voor tenant_admin
Edge function `update-order-fulfillment-status` accepteert nu:

- `is_correction?: boolean` (default `false`)
- `reason?: string` (verplicht zodra `is_correction === true`, min 3 chars)

Gedrag bij `is_correction === true`:

- `requireRole(auth, tenant_id, ['tenant_admin'])` — geen staff/warehouse
- TRANSITIONS-matrix wordt **gebypassed**, elke status → elke status mag
- Audit-log entry: `action_type = 'order_status_correction'` met
  `action_details.is_correction = true` en `action_details.reason = <trimmed>`

Normale (niet-correctie) flow ongewijzigd: matrix + rol-check zoals 2A0.

### 3. UI
- `src/components/admin/OrderStatusCorrectionDialog.tsx` — nieuwe dialog met
  read-only huidige status, dropdown alle statussen, verplichte textarea voor
  reden, bevestig-knop. Roept `supabase.functions.invoke('update-order-fulfillment-status', { body: { …, is_correction: true, reason } })` aan.
- `src/pages/admin/OrderDetail.tsx` — ActionsMenu naast de "Retour aanmaken"
  knop, alleen gerenderd als `useCan('correct', 'order_status')` true is.

### 4. useCan-matrix uitbreiding
`src/hooks/useCan.ts`:

- `PermissionAction` uitgebreid met `'correct'`
- `Resource` uitgebreid met `'order_status'`
- `Matrix` is nu `Record<Resource, Partial<Record<PermissionAction, AppRole[]>>>`
- Entry:
  ```ts
  order_status: {
    correct: ['platform_admin', 'tenant_admin'],
  }
  ```
- `platform_admin` voldoet sowieso via bestaande bypass in `canWithRoles`.

### Test-checklist
- [ ] tenant_admin opent order-detail → ActionsMenu zichtbaar, dialog werkt,
      audit-log bevat `order_status_correction` + reason.
- [ ] staff/warehouse/accountant/viewer openen order-detail → geen
      ActionsMenu (knop is niet gerenderd).
- [ ] staff probeert `is_correction: true` via curl → 403 (rol-check edge fn).
- [ ] Correctie `cancelled → processing` werkt zonder 422 transition-error.
- [ ] `/admin/fulfillment` toont geen cancelled / returned orders meer.
- [ ] Normale bulk-action "Markeer als verzonden" blijft werken
      (niet-correctie pad ongewijzigd).

---

## Batch 2A2a — Refund / Invoice / Quote RLS-aanscherping completed

Datum: 2026-06-08
Scope: één migration die legacy `has_role`-policies en rolloze ALL-policies
vervangt door drie-policy templates met `has_tenant_role`. Platform-admin en
service-role bypasses ongewijzigd.

### Bevestigde beslispunten
- ✅ Refund-write (`credit_notes` + `credit_note_lines`) strikt `tenant_admin` — staff/accountant uitgesloten tot cap-feature bestaat.
- ✅ Accountant heeft **read + write** op `invoices`, `invoice_lines`, `invoice_archive` (append-only), `invoice_discounts`, `invoice_duplicates`, `payment_reminders` voor BTW-correcties.
- ✅ Staff mag quotes en proforma's aanmaken/bewerken; delete blijft `tenant_admin`.
- ✅ `payment_confirmations` writes nu service-role-only (Stripe/bank-webhook pad). UI behoudt SELECT.
- ✅ `invoice_archive` blijft append-only (geen UPDATE/DELETE policies aangemaakt).

### Gedropte policies per tabel
- `credit_notes`: "Users can view/insert/update/delete credit notes in their tenants"
- `credit_note_lines`: "Users can view/insert/update/delete credit note lines in their tenants"
- `invoices`: "Users can view/insert/update their tenant's invoices", "Tenant admins can delete their tenant's invoices"
- `invoice_lines`: "Users can view/insert/update/delete their tenant's invoice lines"
- `invoice_archive`: "Users can view/insert archive for their tenant"
- `invoice_discounts`: "Users can view/manage invoice discounts for their tenant"
- `invoice_duplicates`: "Tenant users can manage invoice duplicates"
- `proforma_invoices`: "Users can view/manage proforma invoices for their tenant"
- `proforma_invoice_lines`: "Users can view/manage proforma lines for their tenant"
- `quotes`: "Users can view/insert/update their tenant's quotes", "Tenant admins can delete their tenant's quotes"
- `quote_items`: "Users can view/insert/update their tenant's quote items", "Tenant admins can delete their tenant's quote items"
- `payment_confirmations`: "Users can view own tenant confirmations", "Staff+ can insert confirmations"
- `payment_reminders`: "Users can view/manage payment reminders for their tenant"

Platform-admin policies en service-role ALL-policies bleven onaangetast.

### Nieuwe policies (samenvatting per tabel)

Volledige SQL leeft in de migration `Batch 2A2a — Refund/Invoice/Quote RLS hardening`. Patroon per tabel:

**credit_notes** (refund write strikt admin)
- SELECT `authenticated`: `tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))`
- INSERT/UPDATE/DELETE `authenticated`: `public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])`

**credit_note_lines** (parent-FK scope)
- SELECT: parent `credit_note.tenant_id` in user tenants
- INSERT/UPDATE/DELETE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin'])`

**invoices, invoice_duplicates**
- SELECT: tenant-scope
- INSERT/UPDATE/DELETE: `has_tenant_role(tenant_id, ['tenant_admin','staff','accountant'])`

**invoice_lines, invoice_discounts** (parent-FK via invoices)
- SELECT: parent invoice tenant-scope
- INSERT/UPDATE/DELETE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin','staff','accountant'])`

**invoice_archive** (append-only)
- SELECT: tenant-scope
- INSERT: `has_tenant_role(tenant_id, ['tenant_admin','staff','accountant'])`
- Geen UPDATE / DELETE policies → effectief immutable voor authenticated.

**proforma_invoices, quotes** (sales workflow)
- SELECT: tenant-scope
- INSERT/UPDATE: `has_tenant_role(tenant_id, ['tenant_admin','staff'])`
- DELETE: `has_tenant_role(tenant_id, ['tenant_admin'])`

**proforma_invoice_lines, quote_items** (parent-FK scope)
- SELECT: parent tenant-scope
- INSERT/UPDATE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin','staff'])`
- DELETE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin'])`

**payment_confirmations** (service_role-only writes)
- SELECT: tenant-scope
- INSERT/UPDATE/DELETE: **geen** authenticated policy → alleen service_role (Stripe / bank-webhook pad) kan schrijven.

**payment_reminders** (parent-FK via invoices)
- SELECT: parent invoice tenant-scope
- INSERT/UPDATE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin','staff','accountant'])`
- DELETE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin'])`

### Test-checklist (productie, platform_admin bypass)
- [ ] `/admin/credit-notes` lijst laadt; "Creditnota aanmaken" werkt voor tenant_admin.
- [ ] `/admin/invoices` lijst laadt; nieuwe factuur via `create-manual-invoice` of `generate-invoice` slaagt voor admin/staff/accountant.
- [ ] `/admin/proforma` en `/admin/quotes`: aanmaken/bewerken voor admin/staff; delete alleen admin.
- [ ] `/admin/invoices/:id` betaalherinnering toevoegen werkt voor admin/staff/accountant.
- [ ] Stripe refund-webhook → `process-refund` → updates op `returns` + Stripe blijven slagen (service-role pad).
- [ ] Stripe payment-webhook schrijft `payment_confirmations` (service_role) — geen RLS-block.
- [ ] Warehouse-user kan facturen/credit notes alleen lezen, geen schrijfacties.

### Wat NIET in deze sub-batch zit (volgt in 2A2b/Hoofdstuk 4)
- Edge-function `requireRole`-calls op `pos-refund-payment`, `create-manual-invoice`, `send-invoice-email`, `send-quote-email`, `create-quote-payment-link`, plus aanscherping `process-refund` naar `['tenant_admin']`.
- Frontend gating in `useCan` voor `credit_note` / `invoice` / `quote` / `payment_reminder` resources.



---

## Batch 2A2b — Edge-function role-checks completed (2026-06-08)

Aanvulling op tabellen-RLS uit 2A2a: write-paden voor refunds, invoicing en quotes
worden nu ook in de edge-laag gegated met `requireRole`. Platform_admin en
service_role behouden automatische bypass via de shared `requireRole`-helper.

### Functie-wijzigingen

**process-refund**
- Aanscherping t.o.v. Batch 2A1: `['tenant_admin','staff']` → `['tenant_admin']`.
- Reden: cap-feature voor staff-refunds bestaat nog niet; refund-write blijft strikt
  admin tot Fase 3 (Hoofdstuk 4 / capabilities).
- Audit-log: bij elke refund wordt nu een `admin_actions_log`-record geschreven met
  `action_type='refund_processed'` + `{return_id, refund_method, refund_amount}`.

**pos-refund-payment**
- Vervangen: `supabase.auth.getUser()`-flow → `authenticateRequest(req, tenant_id)`.
- Toegevoegd: `requireRole(auth, tenant_id, ['tenant_admin'])`.
- Service-role DB-client gebruikt voor data-access; client-JWT puur voor identity.
- Audit-log: `action_type='pos_refund_processed'` + `{transaction_id, stripe_refund_id, amount, reason}`.
- POS-frontend (`usePOS.ts`) stuurt al automatisch het user-JWT via `supabase.functions.invoke`,
  consistent met `pos-process-payment`.

**create-manual-invoice**
- Toegevoegd: `requireRole(auth, tenant_id, ['tenant_admin','staff','accountant'])`.
- Accountant moet handmatig kunnen factureren tijdens BTW-correcties.

**send-invoice-email**
- Toegevoegd: `requireRole(auth, invoice.tenant_id, ['tenant_admin','staff','accountant'])`
  na invoice-fetch.

**send-quote-email**
- Toegevoegd: `requireRole(auth, quote.tenant_id, ['tenant_admin','staff'])`.
- Accountant niet nodig — sales workflow.

**create-quote-payment-link**
- Toegevoegd: `requireRole(auth, quote.tenant_id, ['tenant_admin','staff'])`.

### config.toml

- `[functions.process-refund] verify_jwt = false` toegevoegd (auth gebeurt in-code
  via `authenticateRequest`, consistent met andere admin-write-functies).
- `pos-refund-payment`, `create-manual-invoice`, `send-invoice-email`,
  `send-quote-email`, `create-quote-payment-link` hadden reeds `verify_jwt = false`.

### Niet aangeraakt (service-role / cron / webhooks)

- `auto-invoice-cron`, `repair-cid-references`, `repair-attachments`, `sync-odoo-invoices`
- Alle Stripe-webhooks (`stripe-webhook`, `stripe-connect-webhook`, `pos-process-payment`, …)
- Platform-billing functies (out-of-scope 2A2)

### Test-checklist (productie)

- [ ] `tenant_admin`: `process-refund` op een return → success + audit-log entry.
- [ ] `staff`: `process-refund` → 403 (cap-feature pending).
- [ ] `tenant_admin`: POS-refund via `/admin/pos` → success + audit-log entry.
- [ ] `staff`: POS-refund → 403.
- [ ] `tenant_admin` / `staff` / `accountant`: `create-manual-invoice` werkt.
- [ ] `staff`: `send-quote-email` + `create-quote-payment-link` werkt.
- [ ] `accountant`: `send-quote-email` → 403, `send-invoice-email` → 200.
- [ ] `warehouse`: alle bovenstaande functies → 403.
- [ ] Stripe refund-webhook (service_role pad) blijft draaien.
- [ ] Bol/Amazon sync (service_role pad) blijft draaien.
- [ ] `platform_admin`: bypass werkt op alle functies.

---

## Feature — Credit Note PDF generation (2026-06-08)

### Edge function
- **`generate-credit-note`** (new, `verify_jwt = false` in `config.toml`).
  - `authenticateRequest(req, tenant_id)` resolves tenant from the credit_note record.
  - `requireRole(auth, tenant_id, ['tenant_admin','staff','accountant'])`.
  - Input: `{ credit_note_id, language? ('nl'|'en'|'fr'|'de') }`.
  - Default language: explicit param ▸ `customer.preferred_language` ▸ `tenant.default_invoice_language` ▸ `'nl'`.
  - Renders a 4-language fiscal PDF via `pdf-lib` (header "CREDITNOTA / CREDIT NOTE / NOTE DE CRÉDIT / GUTSCHRIFT", reference to original invoice with date + original amount, positive line amounts under "Te crediteren" label, totals as "Totaal te crediteren", VAT-regime notice reused from the original invoice's `vat_regime`, refund status line).
  - Uploads to private bucket `credit-notes` at `<tenant_id>/<credit_note_number>.pdf`, returns 24h signed URL.
  - Updates `credit_notes.pdf_url` and `credit_notes.language`.
  - Returns `{ success, pdf_url, credit_note: <full record with original_invoice, customer, lines> }`.
  - Logs `admin_actions_log` entry with `action_type = 'credit_note_pdf_generated'`.

### Bucket & schema
- New private storage bucket `credit-notes` (workspace blocks public buckets, so signed URLs are used).
- Storage RLS on `storage.objects`:
  ```sql
  CREATE POLICY "credit-notes tenant read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'credit-notes'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_tenant_role(
        ((string_to_array(name,'/'))[1])::uuid,
        ARRAY['tenant_admin','staff','accountant']::app_role[]
      )
    )
  );
  ```
  Writes are service_role only (no policy needed).
- `public.credit_notes`: added `language TEXT NOT NULL DEFAULT 'nl'` + `CHECK language IN ('nl','en','fr','de')`. `pdf_url` and `reason` already existed.

### Frontend
- `src/pages/admin/CreditNotes.tsx`: action menu entry "PDF genereren / Download PDF" per row. If `pdf_url` is null it invokes `generate-credit-note` first, then opens the returned signed URL. Spinner via `generatingId` state.
- `src/hooks/useCreditNotes.ts`: after a successful `createCreditNote` insert, auto-invokes `generate-credit-note` (best-effort, never blocks creation).
- `useCan` matrix: no new permission — `requireRole` in the edge function is the source of truth; `tenant_admin`, `staff` and `accountant` keep read access to the PDF.

### Production test checklist
- [ ] `platform_admin`: download PDF for an existing credit note works.
- [ ] `tenant_admin` / `staff` / `accountant`: download/generate PDF works for their tenant.
- [ ] `warehouse` / `viewer`: edge function returns 403; signed URL would also be rejected by storage RLS.
- [ ] Cross-tenant: user from tenant A cannot generate PDF for credit_note of tenant B (`authenticateRequest` returns 403).
- [ ] Generated PDF shows header "CREDITNOTA", reference to original invoice with original amount, positive amounts, correct VAT-regime text reused from the original invoice.

---

## Batch 2B1a — Integrations RLS-aanscherping

Datum: 2026-06-08
Scope: 8 integratie-tabellen (marketplace, ads, reviews, shipping, fulfillment-keys, Shopify-requests, OAuth-creds, custom domains).
Migration: zie `supabase/migrations/` — laatste 2026-06-08 entry.

### Open beslispunten bevestigd (recon §9, 2026-06-08)
1. `test-*-connection` → tenant_admin only ✅
2. `check-connect-status` → tenant_admin + staff ✅ (uitwerking in 2B1b)
3. `tenant_oauth_credentials.SELECT` → tenant_admin only (secrets-tabel) ✅
4. `disconnect-stripe-account` → migreren naar `requireRole(['tenant_admin'])` ✅ (in 2B1b)
5. `shopify_connection_requests.INSERT` → beperken tot tenant_admin ✅

### Patroon
Per tabel: `is_platform_admin() OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])` voor write,
`is_platform_admin() OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))` voor read (behalve `tenant_oauth_credentials` en `fulfillment_api_keys` — daar SELECT óók admin-only).
Service-role bypassen RLS by default → webhook/sync-paden ongewijzigd.
`tenant_domains`: anon-SELECT op `is_active=true AND dns_verified=true` behouden voor storefront multi-domain routing.

### Per tabel — gedropte + nieuwe policies

#### marketplace_connections
- DROP: `Users can view their tenant's marketplace connections` (SELECT), `Users can insert marketplace connections for their tenant` (INSERT — gunde staff write), `Users can update their tenant's marketplace connections` (UPDATE — idem), `Tenant admins can delete their tenant's marketplace connections` (DELETE).
- CREATE: `mc_select_tenant_members` (SELECT), `mc_insert_tenant_admin`, `mc_update_tenant_admin`, `mc_delete_tenant_admin`.

#### shopify_connection_requests
- DROP: `Tenants can view their own requests` (SELECT), `Tenants can insert their own requests` (INSERT — gunde alle rollen).
- KEEP: `Platform admins can manage all requests` (ALL, is_platform_admin).
- CREATE: `scr_select_tenant_members`, `scr_insert_tenant_admin`, `scr_update_tenant_admin`, `scr_delete_tenant_admin`.

#### ad_platform_connections
- DROP: `Tenant users can view their ad connections` (SELECT), `Tenant admins can manage ad connections` (ALL — gebruikte user_roles direct).
- CREATE: `apc_select_tenant_members`, `apc_insert_tenant_admin`, `apc_update_tenant_admin`, `apc_delete_tenant_admin`.

#### tenant_oauth_credentials (stricter — SELECT óók admin-only)
- DROP: `Tenant members can view own credentials` (SELECT — lekte token-metadata aan alle rollen), `Tenant admins can manage credentials` (ALL).
- CREATE: `toc_select_tenant_admin`, `toc_insert_tenant_admin`, `toc_update_tenant_admin`, `toc_delete_tenant_admin`.

#### tenant_domains
- DROP: `Users can view own tenant domains` (SELECT), `Tenant admins can insert domains` (INSERT), `Tenant admins can update domains` (UPDATE), `Tenant admins can delete domains` (DELETE).
- KEEP: `Public can read active domains` (anon SELECT, `is_active=true AND dns_verified=true`) — storefront routing.
- CREATE: `td_select_tenant_members`, `td_insert_tenant_admin`, `td_update_tenant_admin`, `td_delete_tenant_admin`.

#### review_platform_connections (dormant — security-bug gefixt)
- DROP: `Public can view enabled platform connections` (anon SELECT — lekte OAuth-tokens zodra is_enabled=true), `Users can view their tenant's review connections`, `Users can insert their tenant's review connections` (rol-blind), `Users can update their tenant's review connections` (rol-blind), `Users can delete their tenant's review connections` (rol-blind).
- CREATE: `rpc_select_tenant_members`, `rpc_insert_tenant_admin`, `rpc_update_tenant_admin`, `rpc_delete_tenant_admin`.

#### shipping_integrations (dormant)
- DROP: `Tenant admins can manage shipping integrations` (ALL — naam misleidend, was rol-blind), `Users can view their tenant shipping integrations` (SELECT).
- CREATE: `si_select_tenant_members`, `si_insert_tenant_admin`, `si_update_tenant_admin`, `si_delete_tenant_admin`.

#### fulfillment_api_keys (was al rol-aware, genormaliseerd)
- DROP: `Tenant admins can manage their API keys` (ALL — voortaan SELECT óók admin-only voor consistency met secrets-tabellen).
- CREATE: `fak_select_tenant_admin`, `fak_insert_tenant_admin`, `fak_update_tenant_admin`, `fak_delete_tenant_admin`.

### Niet in scope (komt in 2B1b)
- Edge-function `requireRole`-checks (`*-oauth-init`, `connect-*`, `disconnect-*`, `test-*-connection`, `verify-domain`, `check-domain-ssl`, `cloudflare-api-connect`, `create-connect-account`, `disconnect-stripe-account`, `check-connect-status`).
- Frontend gating op connect/disconnect-knoppen (komt in H4).

### Productie-test checklist (platform_admin via bypass)
- [ ] `/admin/settings/integrations` → marketplace & ad connections laden
- [ ] `/admin/settings/domains` → domains laden
- [ ] Marketplace-tab → bestaande Bol/Shopify connections leesbaar
- [ ] Storefront op custom domain → multi-domain routing werkt (anon SELECT op `tenant_domains`)
- [ ] Stripe Connect / Bol / Meta webhooks blijven draaien (service-role bypass)

## Feature — Odoo B2C dummy aggregation (Pieter-requirement #6) — 2026-06-08

### Nieuwe tabel `public.tenant_odoo_settings`
- Kolommen: `tenant_id` (PK → tenants), `aggregate_b2c_customers` (bool, default false), `b2c_dummy_partner_name` (text, default `Diverse particulieren`), `b2c_dummy_partner_odoo_id` (int, cache), `aggregate_per_channel` (bool, default false, future-use), timestamps + updated_at trigger.
- GRANT `SELECT,INSERT,UPDATE,DELETE` aan `authenticated`; `ALL` aan `service_role`.
- RLS:
  - `tos_select_tenant_members` — SELECT: alle tenant-leden (+ platform_admin bypass).
  - `tos_insert_admin_accountant` — INSERT: `has_tenant_role(['tenant_admin','accountant'])` (+ platform_admin).
  - `tos_update_admin_accountant` — UPDATE: idem.
  - `tos_delete_admin_accountant` — DELETE: idem.

### Edge-function wijzigingen
- `sync-odoo-customers`: leest `tenant_odoo_settings.aggregate_b2c_customers`. Wanneer `true` én `customer.customer_type !== 'b2b'` → klant wordt overgeslagen (status `skipped` + reason `B2C customer aggregated (anonymized)`). B2B en aggregation-uit blijven onveranderd individueel pushen.
- `sync-odoo-invoices`: bij `aggregate=true` + B2C-klant wordt de Odoo `res.partner` voor "Diverse particulieren" eenmalig opgezocht/aangemaakt (`ensureDummyPartner`), de ID gecached in `tenant_odoo_settings.b2c_dummy_partner_odoo_id`, en hergebruikt voor alle vervolgsyncs. De originele klantnaam/e-mail + ordernummer worden in `account.move.narration` opgenomen als audit-trail. B2B / aggregation-uit pad ongewijzigd.
- Customer-type bepaling: primair via gekoppelde `customers.customer_type`, fallback op `orders.customer_vat_number`/`customer_company_name`.

### Admin UI
- Nieuwe sectie `OdooB2CAggregationSettings` op de Odoo-marketplace-detail (`/admin/marketplaces/:id`, tab Instellingen), alleen zichtbaar wanneer Odoo-connectie + `odooModuleAccounting=true`.
- Toggle + naam-veld + read-only info over de gecachte Odoo partner ID.
- Gating via `useCan('write','integrations')` → tenant_admin (en platform_admin via bypass) mag wijzigen, andere rollen alleen lezen.

### Effect
- SellQo-customers tabel onaangetast (marketing/CRM blijft individueel).
- Odoo-boekhouding krijgt één verzamelklant voor consumer-omzet wanneer ingeschakeld; B2B blijft altijd individueel.
- Pieter-requirement #6 vervuld.

---

## Feature — Credit-notes volledige flow (2026-06-08)

### Doel
Creditnota's voortaan volledig bruikbaar maken in admin UI, met email-pad
(incl. CC naar boekhouder), auto-send-bij-creatie en correcte verwerking
in alle boekhoudings-exports.

### Wijzigingen

**Sidebar & permissies**
- `src/components/admin/sidebar/sidebarConfig.ts`: nieuwe entry "Creditnota's"
  onder Bestellingen → na "Facturen", path `/admin/orders/creditnotes`,
  icon `FileMinus`, `excludeRoles: ['warehouse']`.
- `src/hooks/useCan.ts`: nieuwe resource `credit_notes`.
  - read = alle rollen behalve warehouse (accountant/viewer mogen inkijken).
  - write = platform_admin / tenant_admin / staff / accountant.

**Order-detail integratie**
- Nieuwe component `src/components/admin/OrderCreditNotesSection.tsx`.
- `src/pages/admin/OrderDetail.tsx`: renderen onder Documenten-card wanneer
  een factuur bestaat. Toont per credit-note nummer, datum, bedrag, status
  (Concept / Verzonden), download- en resend-knoppen. "Nieuwe creditnota"
  via `<PermissionGate action="write" resource="credit_notes">`.

**Nieuwe edge function `send-credit-note-email`**
- `supabase/functions/send-credit-note-email/index.ts`
- `authenticateRequest` + `requireRole(['tenant_admin','staff','accountant'])`.
- Body: `{ credit_note_id, language? }`.
- Taalvolgorde: body → `customer.preferred_language` → `tenant.default_invoice_language`
  → `'nl'`.
- Onderwerp per taal: nl/en/fr/de variant van "Creditnota {nr} - {tenant}".
- Genereert PDF on-the-fly indien `pdf_url` ontbreekt door
  `generate-credit-note` opnieuw aan te roepen.
- Verstuurt naar `customer.email`, hergebruikt `tenant.invoice_cc_email`
  + `tenant.invoice_bcc_email` voor Pieter/boekhouder-kopie (zelfde adressen
  als factuur-flow).
- Update na succes: `credit_notes.sent_at = now()`, `status = 'sent'`.
- Audit: `admin_actions_log.action_type = 'credit_note_email_sent'`
  met `{credit_note_id, recipient, cc, bcc, language}`.
- `supabase/config.toml`: `[functions.send-credit-note-email] verify_jwt = false`.

**Auto-send parameter**
- `supabase/functions/generate-credit-note/index.ts`: accepteert nu
  `{ credit_note_id, language?, auto_send_email? }`. Bij `auto_send_email=true`
  roept de functie na PDF-persist `send-credit-note-email` aan; failures
  worden gelogd maar laten de PDF-generatie zelf niet falen (zelfde
  best-effort patroon als `generate-invoice`).
- Response bevat extra `email_sent: boolean` flag.

**Dialog UX**
- `src/components/admin/CreditNoteDialog.tsx`: nieuwe checkbox
  "Direct verzenden naar klant per e-mail" (default `aan`).
- `src/hooks/useCreditNotes.ts`: nieuw `auto_send_email` veld in payload,
  toast-tekst varieert ("Creditnota aangemaakt en verzonden" vs
  "Creditnota aangemaakt").

**Lijst-pagina actions**
- `src/pages/admin/CreditNotes.tsx`: ActionsMenu krijgt extra item
  "E-mail (opnieuw) versturen" achter `useCan('write','credit_notes')`.
  Statusbadge per row was reeds aanwezig (`getStatusBadge`).

**Schema-aanvulling**
- Migration `20260608161220_*` (tenant-ref `gczmfcabnoofnmfpzeop`):
  ```sql
  ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_credit_notes_sent_at ON public.credit_notes(sent_at);
  ```
- `credit_notes.status` bestond al (`draft`/`sent`/`processed`); de UI
  blijft die enum gebruiken — geen CHECK-rewrite om historisch
  data-conflict te vermijden.
- `src/types/creditNote.ts`: `sent_at: string | null` toegevoegd.

**Boekhouding-rapportages**
| Export | Credit-notes meegenomen? | Status |
|---|---|---|
| `vat-report-engine` | Ja — `aggregator.ts` walks `credit_notes + credit_note_lines`, markeert rijen met `is_credit_note: true` en negatieve base/vat in `audit_trail`. | Reeds aanwezig — geverifieerd. |
| `export-vat-xlsx` | Ja — filtert `audit_trail.is_credit_note` voor aparte detail (regel 436-438) + meta-teller "Aantal creditnota's verwerkt". | Reeds aanwezig. |
| `export-vat-pdf`  | Ja — sectie "Creditnota's" gebouwd uit `audit_trail` met `meta.credit_note_count`. | Reeds aanwezig. |
| `export-ic-listing-xml` | Engine zelf bouwt IC-listing uit invoices + credit-note correcties; credit-notes met IC-leveringen worden via `audit_trail` netto verrekend in de engine-output (geen aparte XML-tag nodig). | Reeds aanwezig via engine. |
| `export-q-bundle` | **Nieuw toegevoegd** — extra `fetchCreditNotePdfs()` haalt credit-note PDFs en stopt ze in `06_Factuur_PDFs/creditnotas/` van de ZIP wanneer `include_invoice_pdfs=true`. | Nieuw deze release. |
| `generate-peppol-ubl` | Credit-notes nog niet als UBL CreditNote (BIS 3.0) — open follow-up, niet in deze batch. | Open. |

### Permissie-matrix recap
| Actie | tenant_admin | staff | accountant | warehouse | viewer |
|---|---|---|---|---|---|
| Creditnota inzien | ✅ | ✅ | ✅ | ❌ | ✅ |
| Creditnota aanmaken | ✅ | ✅ | ✅ | ❌ | ❌ |
| PDF genereren / downloaden | ✅ | ✅ | ✅ | ❌ | ✅ (download) |
| E-mail (opnieuw) versturen | ✅ | ✅ | ✅ | ❌ | ❌ |

### Open follow-ups
- Peppol UBL CreditNote-generatie voor B2B-uitsturing.
- Bulk-export van credit-notes in eigen ZIP (los van Q-bundle).

---

## Feature — Credit-note volledige flow (UX + auto-trigger + PDF parity + Peppol UBL) — 2026-06-08

### Fix A — Gecombineerde view facturen + creditnota's
- `/admin/orders/invoices` heeft nu tabs **Alle | Facturen | Creditnota's** (default Alle).
- "Alle" toont gecombineerde lijst met type-badge, klant, datum, bedrag (negatief voor CN) en status.
- Bestaande zoek + statusfilter + Peppol-toggle blijven op de **Facturen**-tab werken.
- Nieuwe component `CreateCreditNoteFromInvoiceButton` — laadt `invoice_lines` on-demand en opent `CreditNoteDialog` met preselectie (volledige creditering). Beschikbaar in zowel de combined-view rij-actie als de Facturen-tab acties.
- Nieuwe component `NewCreditNoteDialog` — invoice-selector op `/admin/orders/creditnotes`. Knop "Nieuwe creditnota" is werkend.
- `CreditNoteDialog` ondersteunt nu een controlled `open`/`onOpenChange` + `hideTrigger` voor hergebruik vanuit andere triggers.
- Permission-gate: `useCan('write', 'credit_notes')` → `tenant_admin`, `staff`, `accountant`.

### Fix B — Auto-trigger retour → creditnota
- DB-functie `public.create_credit_note_from_return(_return_id uuid)` (SECURITY DEFINER):
  - Zoekt invoice via `returns.order_id`.
  - Maakt CN met status `'draft'`, reden `Automatisch gegenereerd voor retour {rma_number}`.
  - Insert samengevatte `credit_note_lines`-regel ter waarde van `refund_amount`, met behoud van BTW-ratio van originele factuur.
  - **Idempotent**: skipt als CN met "Automatisch ...{rma_number}" al bestaat.
- Trigger `trg_returns_auto_credit_note` (AFTER UPDATE OF status): vuurt wanneer `status='completed'` AND `status` veranderd AND `refund_amount > 0`.
- PDF + email afhandeling: bestaande `generate-credit-note(auto_send_email=true)` kan handmatig of via toekomstige scheduler op concept-CN's worden gedraaid.
- Backfill: niet uitgevoerd (CN-2026-0001 was handmatig opgelost).

### Fix C — PDF + UBL parity met invoices
- **`generate-credit-note` PDF rewrite**:
  - Logo embed (PNG/JPG van `tenants.logo_url`) of fallback tenant-naam in header.
  - Tenant info-blok (links): naam, adres, postcode/stad, land, BTW-nummer, **IBAN**, e-mail, telefoon.
  - Klant info-blok (rechts): naam (first+last) → `company_name` → "Particuliere klant" (per taal); GEEN dubbele e-mail meer.
  - Referentie-blok naar originele factuur + reden.
  - Line-table met positieve bedragen ("Te crediteren"), BTW-rij **per tarief** uit `credit_note_lines.vat_rate`.
  - VAT-regime artikel-tekst (Art. 138 / 196 / 146 / OSS) — hergebruikt van factuur, mapping inclusief aliassen `ic_supply_*`, `oss_b2c_eu`, `export_outside_eu`.
  - Refund-status onder totals: "Terugbetaald" of "in behandeling".
  - Footer: `tenant.invoice_footer_text` + Peppol-label indien `peppol_status` in `accepted`/`archive_only`.
  - GEEN QR-code (refund context).
- **`generate-peppol-ubl` extensie**:
  - Accepteert nu `{ document_type: "invoice" | "credit_note", document_id }` (back-compat: `invoice_id` blijft werken).
  - Bij `credit_note`: laadt `credit_notes` + `credit_note_lines`, ophaalt `vat_regime` van originele factuur, schrijft naar `credit_notes.ubl_url` + `peppol_status='archive_only'`.
  - Storage key onderscheidt CN's: `{tenant_id}/credit-notes/{cn_id}.xml`.
  - `invoice_archive` rij geschreven met `document_type='credit_note'`.
- **`generate-credit-note`** roept na PDF-persist `generate-peppol-ubl` aan (best-effort). UBL altijd gegenereerd indien regime Peppol-relevant + B2B VAT, ook zonder `peppol_required`.
- **UI**:
  - CreditNotes-lijst: Peppol-badge (✓ verzonden / ⏱ pending / ⚠ mislukt) naast status.
  - UBL-download blijft beschikbaar via ActionsMenu zodra `ubl_url` is ingevuld.

---

## Credit-notes: async worker + UI consolidation
**Datum:** 2026-06-08

### FIX 1 — status='draft' (no-op, scheme bevestigd)
- Verifieerd: huidige `credit_notes_status_check` = `('draft','sent','processed')`.
- Trigger insert `'draft'` is reeds geldig; geen migratie nodig. Pieter-keuze: huidige scheme behouden (zie prompt-respons "A").
- TypeScript types, i18n keys (NL/EN/FR/DE), Select-opties consistent met DB.

### FIX 2 — pg_net async worker in `create_credit_note_from_return`
- `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;` (idempotent).
- Na `INSERT INTO credit_notes`: niet-blokkerende `PERFORM net.http_post(...)` naar `/functions/v1/generate-credit-note` met body `{credit_note_id, language, auto_send_email:true}`.
- URL + auth gehaald uit bestaande `public.internal_config` (`supabase_url` + `supabase_anon_key`), zelfde pattern als notification-trigger.
- Wrapped in `BEGIN ... EXCEPTION WHEN OTHERS` zodat dispatch-fouten de retour-flow niet breken; status blijft `draft`, admin kan handmatig "Email opnieuw versturen" via Actions-menu.
- `language` valt terug op `'nl'` als `invoices.language` NULL/empty.
- `generate-credit-note` heeft `verify_jwt=false` (config.toml), dus anon-key dispatch werkt zonder service-role exposure.

### FIX 3 — UI eenbron-van-waarheid: tabs inline in Invoices, aparte pagina redirect
- **Nieuwe component** `src/components/admin/CreditNotesTable.tsx`: hergebruikbare filters + ResponsiveDataTable + ActionsMenu (download/UBL/email opnieuw/originele factuur). Prop `hideNewButton` om dubbele CTA te onderdrukken.
- **`src/pages/admin/Invoices.tsx`**:
  - Tab "Creditnota's" rendert nu `<CreditNotesTable />` inline (geen redirect-card meer).
  - `useSearchParams` synchroniseert actieve tab met `?tab=invoices|creditnotes` (replace, geen history-spam). Default tab = "all" → geen query-param.
  - Tab "Alle" combineert invoices + credit_notes ongewijzigd (badge "Factuur"/"Creditnota", negatieve bedragen in `text-destructive`).
  - `Minus` icon verwijderd (niet langer gebruikt).
- **`src/App.tsx`**: `/admin/orders/creditnotes` route is nu `<Navigate to="/admin/orders/invoices?tab=creditnotes" replace />`. `CreditNotesPage` import verwijderd. Bestaande deeplinks blijven werken via redirect.
- **`src/components/admin/sidebar/sidebarConfig.ts`**: entry `orders-creditnotes` verwijderd; entry `orders-invoices` hernoemd naar `"Facturen & creditnota's"` (page-titel toonde dit al).
- **`src/pages/admin/CreditNotes.tsx`**: deprecation-comment bovenaan toegevoegd. Bestand blijft staan als safety-net voor stale imports; cleanup-batch volgt.

### Verificatie
- ✅ `/admin/orders/invoices` opent direct op tab "Alle"; klik op "Creditnota's" → inline tabel zichtbaar zonder redirect.
- ✅ URL `/admin/orders/invoices?tab=creditnotes` opent direct op CN-tab.
- ✅ Oude URL `/admin/orders/creditnotes` → 302 client-side redirect naar `/admin/orders/invoices?tab=creditnotes`.
- ✅ Sidebar: "Creditnota's" entry weg; "Facturen & creditnota's" zichtbaar onder Bestellingen.
- ✅ Migratie pg_net dispatch test: na nieuwe retour `status=completed` met `refund_amount>0` verschijnt credit_note rij; HTTP-call zichtbaar in `net._http_response`.

---

## Role expansion — `marketing` (2026-06-08)

**Goal.** Specialist marketing-rol voor grotere teams die campagnes, promoties,
ads-configs, SEO en CMS-content beheren zonder toegang tot fiscale data,
integrations of platform-settings.

**Enum.** Nieuwe migration voegt `marketing` toe aan `public.app_role`
(`ALTER TYPE ... ADD VALUE IF NOT EXISTS 'marketing'`). Geen verdere
DB-policy-wijzigingen in deze stap: bestaande RLS draait op `app_role[]`
arrays — marketing valt automatisch buiten alle write-arrays
(`tenant_admin/staff/accountant/warehouse`) en krijgt via `tenant_id IN
get_user_tenant_ids()` automatisch tenant-scoped read op alles wat al
publiek-leesbaar is binnen de tenant.

**useCan matrix (`src/hooks/useCan.ts`).**
- RW: `marketing`, `cms`, `seo`, `discount_codes`, `ads`, `volume_discounts`,
  `social_channels`, `inbox`.
- R: `orders` (campaign analytics), `customers` (segmentatie, geen schrijfrechten),
  `products`, `reports`, `global_lookups`, `sellqo_legal`.
- Geen toegang: `invoices`, `credit_notes`, `refunds`, `payments`, `vat`,
  `returns`, `pos`, `themes`, `integrations`, `webhooks_api`, `team`,
  `settings_general`, `settings_financial`, `platform_billing`,
  `customer_notes`, `product_costs`, `suppliers`, `ops_helpers`,
  `automations`, `ai_assistant`, `ai_coach`.
- Nieuwe resource `ad_budgets` (gescheiden van `ads`): write blijft expliciet
  bij `tenant_admin`; marketing kan campagnes configureren maar geen budget
  vrijgeven.
- `order_status.correct` (correction-pad) blijft `tenant_admin` only.

**Sidebar (`src/components/admin/sidebar/sidebarConfig.ts`).**
- Toegevoegd: `MARKETING_ALLOWED_ITEMS` als referentielijst.
- Hidden voor marketing via `excludeRoles: ['marketing']`: fulfillment,
  retouren, facturen, offertes, POS, webshop builder, betalingen,
  categorieën, inkoop, verzending, notificaties, SellQo Connect, billing,
  instellingen.
- Zichtbaar: Dashboard, Inbox, Bestellingen (alleen lijst), Producten (R),
  Klanten (R), Campagnes + AI Tools + SEO, Promoties (full group), Ads
  (full group, budget-vrijgave UI-side te gaten via `useCan('write','ad_budgets')`),
  Vertalingen, Rapporten/Analytics, Help.

**Note voor Batch 2C2 (Marketing & CMS).** Bij het schrijven van expliciete
RLS policies voor marketing-tabellen (campaigns, email_*, discount_codes,
ads_*, automatic_discounts, automation_*, bogo_promotions, gift_promotions,
volume_discounts, content_translations, storefront_pages, legal_pages,
homepage_sections, seo_*, ab_test_configs, ad_creatives, ad_campaigns,
ad_audience_syncs, ad_platform_connections (read-only), social_*) MOET de
marketing-rol meegenomen worden in de policy-arrays — voorgeschreven
pattern: `array['tenant_admin','staff','marketing']` voor write,
`array['tenant_admin','staff','accountant','viewer','marketing']` voor read.
Uitzondering: `ad_platform_connections` blijft `['tenant_admin']` write
(geen credentials-management voor marketing).

**Tests.** `src/hooks/useCan.test.ts` uitgebreid met `marketing role` suite:
RW op campaigns/discount_codes/ads/seo/cms, R-only op orders, geen toegang
tot invoices/credit_notes/payments/vat, geen `order_status.correct`, geen
`ad_budgets` write, platform_admin bypass-check.

**Seed.** Geen migration-seed; toewijzing via team-management UI.

---

## Batch 2B1b — Integration edge-function role-checks

**Datum:** 2026-06-08
**Scope:** OAuth-init / connect / disconnect / test / Stripe Connect / custom-domain edge-functies krijgen `requireRole` op basis van `_shared/auth.ts`.
**Bron:** `docs/fase2-batch-2b1-recon.md` §2.

### Gewijzigde functies

| Function | `requireRole` allowed | Opmerking |
|---|---|---|
| `shopify-oauth-init` | `['tenant_admin']` | `authenticateRequest` + role-check toegevoegd |
| `social-oauth-init` (meta/whatsapp/twitter/linkedin) | `['tenant_admin']` | bestaande `authenticateRequest` aangevuld met `requireRole` |
| `test-marketplace-connection` (bol/amazon) | `['tenant_admin']` | tenantId nu verplicht in body |
| `test-shopify-connection` | `['tenant_admin']` | tenantId nu verplicht in body |
| `test-ebay-connection` | `['tenant_admin']` | imports gefixt + tenantId verplicht |
| `test-odoo-connection` | `['tenant_admin']` | tenantId verplicht |
| `test-shipping-connection` | `['tenant_admin']` | tenant_id afgeleid uit `shipping_integrations.tenant_id` row |
| `create-connect-account` | `['tenant_admin']` | handmatige `getUser` vervangen door `authenticateRequest` |
| `check-connect-status` | `['tenant_admin','staff']` | read-only status — staff mag inzien (§9-2) |
| `disconnect-stripe-account` | `['tenant_admin']` | **vervangt** legacy `tenant_users.role='owner'` check (§9-4); `owner` is geen `app_role` |
| `get-stripe-login-link` | `['tenant_admin']` | handmatige auth vervangen door `authenticateRequest` |
| `verify-domain` | `['tenant_admin']` | eerder ongeauthenticeerd — nu hard gated |
| `check-domain-ssl` | `['tenant_admin']` | tenant_id verplicht in body |
| `detect-domain-provider` | `['tenant_admin']` | tenant_id toegevoegd aan body (frontend hooks bijgewerkt) |
| `cloudflare-api-connect` | `['tenant_admin']` | `getClaims` vervangen door `authenticateRequest` + tenant-scoped check |

### Niet gewijzigd (bewust)

- `shopify-oauth-callback`, `social-oauth-callback`: anonieme provider-redirects, auth via signed state-token in `oauth_states` (service-role-only sinds Fase 1D). Recon §3.
- Alle `sync-*`, `import-*`, `lookup-*`, `confirm-*`, `accept-*`, `marketplace-sync-scheduler`, `tracking-webhook`, `sync-platform-reviews`: service-role cron/sync.
- `stripe-connect-webhook`, `platform-stripe-webhook`, `meta-messaging-webhook`, `whatsapp-webhook`, `shipping-webhook`, `process-email-webhook`: webhooks met provider-signature verificatie.
- `fulfillment-api`: externe 3PL API met eigen API-key auth (`fulfillment_api_keys`).
- `cleanup-connected-accounts`: platform-admin only, behoudt bestaande check.
- `storefront-api`, `storefront-customer-api`, `storefront-resolve`, `sellqo-proxy`, `sellqo-customer-proxy`: publieke / proxy-paden.

### Config.toml audit

Alle gewijzigde functies hebben `verify_jwt = false` (expliciet in `supabase/config.toml` of via default deployment). JWT-validatie gebeurt in code via `authenticateRequest`. Geen nieuwe `[functions.*]` blokken nodig.

**Config.toml — vijf `verify_jwt = false` entries toegevoegd (CORS-fix)**  
Datum: 2026-06-08. De volgende functies ontbraken in `config.toml` waardoor browser-calls faalden met een CORS-preflight error (zelfde patroon als `update-order-fulfillment-status` uit Batch 2A0):
- `[functions.create-shipping-label]`
- `[functions.send-return-email]`
- `[functions.disconnect-stripe-account]`
- `[functions.test-odoo-connection]`
- `[functions.test-shipping-connection]`

Reden: alle vijf hebben `requireRole` + `authenticateRequest` in de function-body (eigen auth-pad), dus `verify_jwt = false` is correct en consistent met `process-refund`, `generate-invoice`, `generate-credit-note`, en alle andere admin-write-functies.

### `AppRole` shared type

`supabase/functions/_shared/auth.ts` `AppRole` union uitgebreid met `'marketing'` om in sync te blijven met de DB-enum (Batch marketing-rol).

### Frontend-aanpassingen

- `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`: `useTenant` + `tenantId` in `test-marketplace-connection` body.
- `src/components/admin/marketplace/shopify/ShopifyInstantConnect.tsx`: `useTenant` + `tenantId` in `test-shopify-connection` body.
- `src/hooks/useDomainVerification.ts` en `src/hooks/useDomainVerificationMulti.ts`: `tenant_id` toegevoegd aan `detect-domain-provider` body.

### Beslispunten geadresseerd

- **§9-1 (test-* role)**: gekozen voor `tenant_admin` (credentials & rate-limits).
- **§9-2 (check-connect-status)**: read-allowed voor `staff` zodat dashboard-widgets renderen zonder admin-rechten.
- **§9-4 (disconnect-stripe-account)**: `tenant_users.role='owner'` legacy-pad volledig verwijderd; nu uitsluitend `app_role='tenant_admin'` (en `platform_admin` bypass).

---

## Audit-log kolom-mismatch fix — 2026-06-08

**Bug**: `generate-credit-note` en `send-credit-note-email` insertten in `admin_actions_log` met kolomnamen `tenant_id` + `user_id`, terwijl het schema `target_tenant_id` + `admin_user_id` gebruikt. Insert faalde stilletjes (geen error-capture), waardoor de credit-note flow geen audit-trail produceerde.

**Gefixte functions**:
- `supabase/functions/generate-credit-note/index.ts` (regel ~445): kolomnamen gecorrigeerd, service_role-skip vervangen door null-fallback, error wordt nu opgevangen + `console.warn`.
- `supabase/functions/send-credit-note-email/index.ts` (regel ~207): zelfde fix.

**Sweep `admin_actions_log` over `supabase/functions/`**:
- `update-order-fulfillment-status/index.ts` — ✅ correct (admin_user_id / target_tenant_id)
- `process-refund/index.ts` — ✅ correct
- `pos-refund-payment/index.ts` — ✅ correct
- `generate-credit-note/index.ts` — ❌ → gefixt
- `send-credit-note-email/index.ts` — ❌ → gefixt

**Backfill**: niet uitgevoerd. Bestaande audit-gap (o.a. CN-2026-0001) blijft historisch leeg; vanaf nu wordt elk PDF-generated / email-sent event correct gelogd.

---

## Batch 2B2a — Customers RLS-aanscherping — 2026-06-08

Eén migration; alle customer-cluster policies herschreven naar `has_tenant_role(tenant_id, ARRAY[...]::app_role[])` met expliciete rol-arrays. Service-role en `is_platform_admin()` policies blijven onveranderd.

### Gedropte → herbouwde policies per tabel

**customers** — `Users can insert customers for their tenant` (INSERT), `Users can update their tenant's customers` (UPDATE), `Tenant admins can delete their tenant's customers` (DELETE). Nieuw: write/update = `['tenant_admin','staff']`, delete = `['tenant_admin']`. SELECT-policy onaangeroerd (al tenant-scoped, alle rollen lezen).

**customer_communication_settings** — alle 4 policies (inline `user_roles`-subquery vervangen door `get_user_tenant_ids`). Write = `['tenant_admin','staff','marketing']`.

**customer_events** — SELECT herbouwd (alleen casing-fix naar `authenticated`-role); writes blijven service-role.

**customer_groups** — alle 4. Write = `['tenant_admin','staff','marketing']`.

**customer_group_members** — alle 4, FK-scope via `customer_groups`. Write = `['tenant_admin','staff','marketing']`.

**customer_group_product_prices** — alle 4, FK-scope via `customer_groups`. Write = `['tenant_admin','staff','marketing']`.

**customer_loyalty** — alle 4, FK-scope via `loyalty_programs`. Write = `['tenant_admin','staff']`, delete = `['tenant_admin']`.

**customer_messages** (inbox) — alle 4. SELECT = `['tenant_admin','staff','marketing','viewer']` (geen warehouse/accountant). Write = `['tenant_admin','staff','marketing']`.

**customer_message_attachments** — SELECT (inline `user_roles`-subquery weg). Rollen = same as messages.

**customer_segments** — alle 4. Write = `['tenant_admin','staff','marketing']`.

**segment_members** — SELECT/INSERT/DELETE (geen UPDATE bestond), FK-scope via `customer_segments`.

### Cross-tenant staff hard cap sweep (§9-7)

Alle resterende `has_role(auth.uid(), 'X')` policies in public-schema gemigreerd naar `has_tenant_role(tenant_id, ARRAY['X']::app_role[])`:

- `categories` — INSERT/UPDATE/DELETE
- `products` — INSERT/UPDATE/DELETE
- `product_variants` — ALL (FK-scope via `products.tenant_id`)
- `product_variant_options` — ALL (behoudt `is_platform_admin` OR-tak)
- `vat_rates` — INSERT/UPDATE/DELETE
- `vat_validations` — INSERT
- `tenant_tracking_settings` — ALL
- `tenants` — UPDATE
- `user_roles` — UPDATE/DELETE (behoudt `is_platform_admin` OR-tak)

Post-migration verificatie: `pg_policies` bevat geen `has_role(auth.uid()` calls meer voor RLS van publieke tabellen.

### Open beslispunten — definitief bevestigd
- §9-1 Marketing READ customers → ✅ ja
- §9-2 Accountant NIET inbox → ✅ bevestigd
- §9-3 Viewer READ PII → ✅ ja
- §9-4 customer_gdpr_requests → ⏸ Fase 3
- §9-5 customer_notes inline → ⏸ Fase 3
- §9-6 customer_tags inline → ⏸ Fase 3
- §9-7 Cross-tenant cap → ✅ gemigreerd
- §9-8 `sync-shopify-customers` → bewaar voor 2B2b (admin-trigger + cron-pad)

### Niet in scope (zoals afgesproken)
- Geen edge-function changes — komt in 2B2b
- Geen nieuwe tabellen (customer_addresses/notes/tags/preferences/gdpr) — niet aanwezig in schema, postponed to Fase 3

## Customer-data integriteit hersteld (2026-06-08)

### Probleem
- Order #1149 (webshop, bieke.derdeyn@gmail.com) had customer_id=NULL — storefront-api skip zonder log.
- Order #1150 + alle Bol/Shopify-orders hadden customer_id=NULL — sync-functies deden geen find-or-create.
- Customers-tabel was incompleet → segmentatie/marketing/reports onvolledig.

### Fix A — Backfill (SQL-migration)
- Loop over alle `orders WHERE customer_id IS NULL AND customer_email <> ''`.
- Find-or-create per (tenant_id, email) op `public.customers` (gebruikt `vat_number` ipv `btw_number` — kolom-naam in dit schema).
- Resultaat: orphan-count 39 → 0 (129 orders met email, allen gekoppeld).
- Tweede pass: ontbrekende `first_name`/`last_name` afgeleid uit `orders.customer_name` (split_part).
- Geverifieerd: bieke.derdeyn@gmail.com → "Bieke Derdeyn" (b2c); bol-klant 24e34e5... → "Kevin Sterk" (b2c).

### Fix B — sync-functies find-or-create
- `supabase/functions/sync-bol-orders/index.ts` (~regel 411): customer lookup + insert toegevoegd vóór order-insert; `customer_id` gezet in order payload; fallback-email `bol-{orderId}@noreply.bol.com` als shipment.email leeg is.
- `supabase/functions/sync-shopify-orders/index.ts`: zelfde patroon, names uit `shopifyOrder.customer` of `shipping_address`.
- `sync-shopify-customers` doet al volledige customer-create — geen wijziging nodig.
- Geen amazon/ebay sync edge functions actief in dit project.

### Fix C — storefront-api defensieve logging
- `supabase/functions/storefront-api/index.ts` (regel ~1594 en ~2244): beide customer-creation paden krijgen nu:
  - `console.warn` als `cart.customer_email` leeg/null is (incl. tenant_id-context).
  - `console.error` op `lookupErr` van de SELECT.
  - `console.error` op `insertErr` van de INSERT (met email + tenant_id).
- Geen functionele change — alleen traceability voor toekomstige incidents.

### Datum
2026-06-08

---

## Batch 2B2b — Customer-cluster edge-function role-checks

### Sweep — gevonden customer-cluster functies
Grep `supabase/functions/` op `customer|segment|marketing|gdpr|merge|dedupe|odoo`:

| Function | Auth-pad | Actie |
|---|---|---|
| `sync-shopify-customers` | tenant-user (admin UI + trigger-manual-sync via service-role) | ✅ requireRole `['tenant_admin','staff']` |
| `sync-odoo-customers` | tenant-user (admin UI via ConnectMarketplaceDialog) | ✅ requireRole `['tenant_admin']` |
| `send-customer-message` | tenant-user (klantenservice UI) | ✅ requireRole `['tenant_admin','staff','accountant']` |
| `storefront-customer-api` | service-role / cart-session | ⛔ niet aanraken |
| `platform-customer-portal` | Stripe customer portal (platform-niveau) | ⛔ buiten scope (platform billing, niet tenant) |
| `run-csv-import` | tenant-user (al `tenant_admin`) | ⛔ ongewijzigd — bulk import van producten/orders/klanten valt onder tenant_admin |
| `ai-marketing-context` | tenant-user (AI helper) | ⛔ buiten scope (geen write naar customer-data) |
| `sync-bol-orders`, `sync-odoo-orders`, `sync-odoo-invoices`, `sync-odoo-inventory`, `import-bol-csv`, `import-bol-shipments`, `run-csv-import` | order/product/invoice-context, geen customer-cluster | ⛔ buiten 2B2b-scope |

Niet aanwezig in dit project (skip):
- `import-customers`, `bol-import-customers`, `shopify-import-customers`
- `merge-customers`, `dedupe-customers`, `bulk-delete-customers`
- `gdpr-export-customer`, `gdpr-delete-customer`
- `send-marketing-email`, `send-customer-segment-email`
- `create-customer-segment`, `update-customer-segment`, `delete-customer-segment` (gaan via RLS direct op `customer_segments`)

### Gewijzigde functies

**`sync-shopify-customers/index.ts`**
- Import `authenticateRequest, requireRole, AuthError, authErrorResponse`.
- Na connection-lookup: `requireRole(auth, connection.tenant_id, ['tenant_admin','staff'])`.
- Catch-block: `AuthError` → `authErrorResponse(error, corsHeaders)`.
- Service-role bypass (trigger-manual-sync) blijft werken via `requireRole`-bypass voor `service_role`.

**`sync-odoo-customers/index.ts`**
- Import `authenticateRequest, requireRole, AuthError, authErrorResponse`.
- Na connection-lookup: `requireRole(auth, connection.tenant_id, ['tenant_admin'])`.
- Catch-block: `AuthError` → `authErrorResponse(error, corsHeaders)`.

**`send-customer-message/index.ts`**
- Import-regel: `requireRole` toegevoegd.
- Vervangt `await authenticateRequest(req, tenant_id)` met `const auth = await authenticateRequest(...)` + `requireRole(auth, tenant_id, ['tenant_admin','staff','accountant'])`.
- Bestaand `AuthError` catch-pad blijft.

### Config.toml wijzigingen
- `[functions.sync-odoo-customers]` `verify_jwt = false` toegevoegd (preflight-fix, function was eerder niet expliciet geconfigureerd).
- `[functions.send-customer-message]` `verify_jwt = false` toegevoegd.
- `sync-shopify-customers` was al aanwezig — ongewijzigd.

### Beslispunten
- §9-8 bevestigd: `sync-shopify-customers` is admin-triggered → `['tenant_admin','staff']`.

### Datum
2026-06-08

---

## Batch 2C1a-i — Core catalog RLS-aanscherping

Datum: 2026-06-08
Migration: `core catalog RLS hardening` (zie supabase/migrations).

### Gedropte policies
- `products`: "Users can update their tenant's products"
- `product_variants`: "Tenant staff can manage product_variants" (ALL)
- `categories`: insert/update/delete-trio van tenant_admin+staff
- `product_categories`: "Tenant users can manage product categories" (ALL)
- `product_bundles`: insert/update/delete tenant-blind
- `product_bundle_items`: insert/update/delete tenant-blind
- `bundle_products`: insert/update/delete tenant-blind
- `content_translations`: "Users can manage translations for their tenant" (ALL)

### Nieuwe policies
- `products` UPDATE: `tenant_admin`+`staff`+`warehouse` (warehouse mag stock muteren — §4 bevestigd)
- `product_variants`: split in INSERT (`admin`+`staff`), UPDATE (`admin`+`staff`+`warehouse`), DELETE (`admin`) via parent-product join
- `categories` INSERT/UPDATE/DELETE: `admin`+`staff`+`marketing` (merchandising — §3 bevestigd)
- `product_categories` INSERT/UPDATE/DELETE: `admin`+`staff`+`marketing` via parent product
- `product_categories` SELECT: tenant-scope alle rollen
- `product_bundles` INSERT/UPDATE: `admin`+`staff`, DELETE: `admin`
- `product_bundle_items` INSERT/UPDATE: `admin`+`staff`, DELETE: `admin` via parent product
- `bundle_products` INSERT/UPDATE: `admin`+`staff`, DELETE: `admin` via parent bundle
- `content_translations` INSERT/UPDATE/DELETE: `admin`+`staff`+`marketing`

### Beslispunten bevestigd
- §4 warehouse mag products UPDATEN (stock-mutatie pad).
- §3 marketing mag categories beheren.
- §11 cost_price-lek geaccepteerd tot 2C1d (column-masking via view).
- §7 bundle_products behandeld als actief.

### Open backlog
- 2C1d: views `products_safe` + `product_variants_safe` zonder `cost_price`.
- `bundle_products` legacy-onderzoek of nog effectief gebruikt naast `product_bundle_items`.

---

## Batch 2C1a-ii — Suppliers & purchase orders RLS-aanscherping

Datum: 2026-06-08
Migration: `suppliers + purchase orders RLS hardening`.

### Gedropte policies (per tabel, alle tenant-blind / geen rol-check)
- `suppliers`: view/create/update/delete in tenant
- `supplier_documents`: view/create/update/delete in tenant
- `product_suppliers`: view/create/update/delete in tenant
- `purchase_orders`: view/create/update/delete in tenant
- `purchase_order_items`: view/create/update/delete via order

### Nieuwe policies
- `suppliers` / `supplier_documents` / `product_suppliers`:
  - SELECT: `admin`+`staff`+`accountant`+`warehouse`
  - INSERT/UPDATE: `admin`+`staff`+`accountant`
  - DELETE: `admin`
- `purchase_orders`:
  - SELECT: `admin`+`staff`+`accountant`+`warehouse`
  - INSERT: `admin`+`staff`+`accountant`
  - UPDATE: `admin`+`staff`+`accountant`+`warehouse` (warehouse boekt ontvangst — §5)
  - DELETE: `admin`
- `purchase_order_items` (FK-scope op parent):
  - SELECT/UPDATE: `admin`+`staff`+`accountant`+`warehouse`
  - INSERT: `admin`+`staff`+`accountant`
  - DELETE: `admin`

### Beslispunten bevestigd
- §2 marketing+viewer mogen GEEN suppliers/inkoop zien.
- §5 warehouse mag `purchase_orders` UPDATEN voor ontvangst-boekingen.

### Frontend-impact
- `src/pages/admin/Suppliers.tsx`, `usePurchaseOrders`, `useSuppliers`,
  `useProductSuppliers`: marketing/viewer krijgen vanaf nu 403/empty. Frontend gating
  in batch H4 om routes te verbergen.

---

## Batch 2C1a-iii — External reviews RLS-aanscherping

Datum: 2026-06-08
Migration: `external reviews RLS hardening`.

### Gedropte policies
- `external_reviews`: "Users can view/insert/update/delete their tenant's external reviews"
  (allen tenant-blind, geen rol-check)

### Nieuwe policies
- `external_reviews` SELECT (auth): `admin`+`staff`+`marketing`+`viewer`
- `external_reviews` INSERT/UPDATE/DELETE: `admin`+`staff`+`marketing` (moderatie)
- Public-SELECT op `is_visible=true` **niet aangeraakt** (storefront leest blijft werken)

### Beslispunten bevestigd
- §6 GEEN anon-INSERT-policy. Klant-reviews lopen later via dedicated edge function
  met rate-limit + spam-check (batch 2C1c).

### Open backlog
- 2C1b: edge-function role-checks (`ai-product-field-assistant`, `ai-product-promo-kit`,
  `ai-optimize-marketplace-content`, `ai-translate-content`, `ai-generate-image`,
  `sync-platform-reviews`, marketplace create/update-product functies).
- 2C1c: anon-INSERT-pad voor `external_reviews` via edge function met rate-limit.
- 2C1d: column-masking views voor `cost_price` (`products_safe`, `product_variants_safe`).

## Batch 2C1b — Catalog edge-function role-checks

Datum: 2026-06-08

### Sweep-rapport

Grep `supabase/functions/` op `product|catalog|inventory|supplier|purchase|review|category|bundle`.
Gevonden functies + classificatie:

| Functie | Pad | Actie |
| --- | --- | --- |
| `create-shopify-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `update-shopify-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `create-woocommerce-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `update-woocommerce-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `create-odoo-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `update-odoo-product` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `sync-meta-catalog` | Admin (tenant-user JWT) | requireRole toegevoegd (+ bug-fix: `tenant_id` werd uit lege scope gehaald) |
| `sync-platform-reviews` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `ai-product-promo-kit` | Admin (tenant-user JWT) | requireRole toegevoegd |
| `ai-product-field-assistant` | Admin (tenant-user JWT, bespoke auth) | Vervangen door `authenticateRequest` + `requireRole` |
| `sync-shopify-products` | Service-role cron + `trigger-manual-sync` (JWT-gated upstream) | NIET aangeraakt — upstream auth voldoende; service-role pad mag niet breken |
| `sync-woocommerce-products` | idem | NIET aangeraakt |
| `sync-bol-inventory` | Service-role cron via `marketplace-sync-scheduler` | NIET aangeraakt (recon §7) |
| `sync-shopify-inventory` | Service-role cron | NIET aangeraakt (recon §7) |
| `sync-woocommerce-inventory` | Service-role cron | NIET aangeraakt |
| `sync-amazon-inventory` | Service-role cron | NIET aangeraakt |
| `sync-ebay-inventory` | Service-role cron | NIET aangeraakt |
| `sync-odoo-inventory` | Service-role cron | NIET aangeraakt |
| `generate-product-feed` | Public XML feed (anon) | NIET aangeraakt |
| `fetch-meta-catalogs` | Admin (JWT zonder tenant-scope) | NIET aangeraakt — alleen catalog listing op token |
| `ads-inventory-watch` | Admin/cron, geen schrijfacties op products | NIET aangeraakt |
| `import-bol-csv` / `run-csv-import` | Order/shipment-import, valt buiten catalog | NIET aangeraakt in deze batch |

Functies uit de opdracht die **niet bestaan** (overgeslagen):
`sync-bol-products`, `sync-odoo-products`, `import-product-csv`, `upload-product-image`,
`generate-product-thumbnail`, `bulk-stock-update`, `margin-calculator`, `pricing-calculator`,
`delete-product`, `archive-product`, `bulk-delete-products`.

### Per gewijzigde functie

Allen volgen het patroon `const auth = await authenticateRequest(req, tenant_id);
requireRole(auth, tenant_id, [...]);` met `AuthError`-catch in de outer try/catch.

- `create-shopify-product` → `['tenant_admin','staff']`
- `update-shopify-product` → `['tenant_admin','staff']`
- `create-woocommerce-product` → `['tenant_admin','staff']`
- `update-woocommerce-product` → `['tenant_admin','staff']`
- `create-odoo-product` → `['tenant_admin','staff']`
- `update-odoo-product` → `['tenant_admin','staff']`
- `sync-meta-catalog` → `['tenant_admin','staff']` (auth verplaatst tot ná connection-lookup, gebruikt `connection.tenant_id` — bestaande `tenant_id`-referentie was buggy)
- `sync-platform-reviews` → `['tenant_admin','staff','marketing']`
- `ai-product-promo-kit` → `['tenant_admin','staff','marketing']`
- `ai-product-field-assistant` → `['tenant_admin','staff','marketing']` (bespoke auth weggehaald, vervangen door shared helper; `AuthError`-handler toegevoegd)

### config.toml wijzigingen

Toegevoegd (`verify_jwt = false`):
- `[functions.create-odoo-product]`
- `[functions.update-odoo-product]`

Bestaand en bevestigd: `ai-product-promo-kit`, `ai-product-field-assistant`,
`create-shopify-product`, `update-shopify-product`, `create-woocommerce-product`,
`update-woocommerce-product`, `sync-meta-catalog`, `sync-platform-reviews`.

### Bevestigde beslispunten (recon §8)

- §1 / §2 — `cost_price` masking geparkeerd voor 2C1d.
- §3 — admin product-management beperkt tot `tenant_admin`+`staff`.
- §4 — warehouse-rol mag stock muteren via `products`/`product_variants` UPDATE (RLS in 2C1a-i). Inventory-cron functies blijven service-role; user-triggered warehouse-acties lopen via PostgREST.
- §9 — `marketing`-rol toegevoegd aan AI-content-functies en review-sync (campaign/UGC scope).
- §7 — service-role/cron-functies (`sync-*-inventory`, `sync-*-products`, `generate-product-feed`) blijven onaangeroerd; upstream `trigger-manual-sync` blijft enige JWT-gated entry-point voor handmatige sync.

### Backlog

- Aparte beslissing of `import-bol-csv` / `run-csv-import` (order/shipment) in batch 2D (orders) een role-check krijgen.
- `delete-product` / `bulk-delete-products` ontbreken; destructieve product-acties lopen nu direct via PostgREST (RLS-gated). Edge-function laag pas bouwen als bulk-flow nodig is.

---

## Hardening — Stripe disconnect type-to-confirm

**Datum:** 2026-06-08

### Reden
Tijdens Batch 2B1b-testing is per ongeluk de Stripe-koppeling van een
productie-tenant (Mancini Milano) verwijderd via de eenmalige "Ontkoppelen"
knop in `TenantOverviewTab`. De bestaande `AlertDialog` met enkel een "Weet
je het zeker?" prompt biedt onvoldoende friction voor een destructieve actie
op een live Express-account (niet ongedaan te maken).

### Mitigatie — type-to-confirm pattern (GitHub repo-delete stijl)

**Frontend** — nieuw gedeeld component `src/components/admin/settings/StripeDisconnectDialog.tsx`:
- Toont tenant-naam + exacte `stripe_account_id` string + expliciete
  destructieve waarschuwing.
- Admin moet de tenant-naam letterlijk intypen voordat de "Definitief
  ontkoppelen"-knop activeert (case + whitespace insensitive matching).
- Bij annuleren/sluiten wordt het tekstveld gereset.

Toegepast op alle 3 disconnect-callsites:
- `src/components/platform/TenantOverviewTab.tsx` (platform-admin per-tenant)
- `src/components/admin/settings/PaymentSettings.tsx` (tenant self-disconnect, 2 paden: actief + onboarding-incomplete)

**Edge function** — `supabase/functions/disconnect-stripe-account/index.ts`:
- Nieuwe verplichte body-parameter `confirmed_tenant_name: string`.
- Server-side double-check tegen live `tenants.name` (case + whitespace
  insensitive) ná de tenant-fetch en vóór `stripe.accounts.del`.
- Mismatch → 400 `{ error: "Bevestigingsnaam matcht niet" }`.
- Ontbrekend/leeg → 400 `{ error: "Bevestigingsnaam ontbreekt" }`.
- Bestaande auth (`requireRole(['tenant_admin'])`) blijft ongewijzigd.

### Gewijzigde bestanden
- `src/components/admin/settings/StripeDisconnectDialog.tsx` (nieuw)
- `src/components/platform/TenantOverviewTab.tsx`
- `src/components/admin/settings/PaymentSettings.tsx`
- `supabase/functions/disconnect-stripe-account/index.ts`

---

## Batch 2C2a-i — Email marketing engine RLS-aanscherping

**Datum:** 2026-06-08
**Migration:** Cluster 1 (recon §1) — één migration met alle email-marketing tabellen.
**Beslispunten bevestigd:** §7-1 (viewer uitgesloten op sends/clicks), §7-3 (anon-INSERT `campaign_link_clicks` drop → service-role only), §7-4 (email_unsubscribes INSERT service-role only via signed-token edge), §7-5 (`email_automations`+`automation_steps`+`automation_runs` bestaan — geen separate drips/triggers tabellen).

### Aanpak per tabel

Voor elke tabel: bestaande tenant-blind policies gedropt en vervangen door role-aware policies via `public.has_tenant_role(tenant_id, ARRAY[...]::app_role[])`. Service-role behoudt impliciete `BYPASS RLS` (geen expliciete policy nodig).

#### `email_campaigns`, `email_templates`, `email_signatures`, `customer_segments`, `email_automations`, `automation_runs`
- **Gedropte policies:** `Users can {view,insert,update,delete} {campaigns,templates,…} for their tenant(s)`
- **Nieuwe policies:**
  - SELECT (auth): `tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))` — alle rollen.
  - INSERT/UPDATE/DELETE (auth): tenant-scope + `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])`.

#### `email_template_blocks` (geen `tenant_id` kolom)
- Policies geschreven via EXISTS-subquery op `email_templates.tenant_id`.
- Zelfde rolverdeling (SELECT alle rollen; writes marketing/staff/admin).

#### `segment_members` (junction)
- Policies via EXISTS op `customer_segments.tenant_id`.
- SELECT tenant-scoped, INSERT/DELETE marketing/staff/admin.

#### `automation_steps` (sub-tabel)
- Policies via EXISTS op `email_automations.tenant_id`.
- SELECT tenant-scoped, writes marketing/staff/admin.

#### `automation_step_runs`
- **Ongewijzigd** — bestaande SELECT-policy is al tenant-scoped via `automation_runs`; writes blijven service-role only.

#### `campaign_sends` — **viewer uitgesloten (§7-1)**
- **Gedropte policies:** `Users can {view,insert,update,delete} campaign sends for their tenants`.
- **Nieuwe policies:**
  - SELECT: `has_tenant_role(... ARRAY['tenant_admin','staff','marketing','accountant'])` — viewer geweigerd om performance-snooping te voorkomen.
  - INSERT: **geen auth-policy** → impliciete deny voor auth-clients. Send-flow loopt via `send-campaign-batch` edge function met service-role.
  - UPDATE/DELETE: marketing/staff/admin.

#### `campaign_link_clicks` — **KRITIEKE FIX §7-3**
- **Gedropte policies:**
  - `Service role can insert link clicks` — had `with_check = true`, liet cross-tenant click-poisoning toe via authenticated users.
  - `Tenant users can view own link clicks` — tenant-blind SELECT.
- **Nieuwe policies:**
  - SELECT (auth): tenant-scope + `has_tenant_role(... ARRAY['tenant_admin','staff','marketing','accountant'])` — viewer uitgesloten.
  - INSERT: **geen auth-policy** → impliciete deny voor auth/anon. Click-tracker draait via edge function met service-role (BYPASS RLS).
  - UPDATE/DELETE: marketing/staff/admin.
- **Verificatie:** `SELECT cmd, COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='campaign_link_clicks' GROUP BY cmd;` — geen INSERT-policy met `qual = true` aanwezig.

#### `newsletter_subscribers`
- **Gedropte policies:** inclusief de anon-policy `Public newsletter signup` (was `with_check = true` voor anon).
- **Nieuwe policies:**
  - SELECT (auth): tenant-scope alle rollen.
  - INSERT/UPDATE/DELETE: marketing/staff/admin. Storefront-subscribe loopt nu uitsluitend via `newsletter-subscribe` edge function (service-role).

#### `email_unsubscribes` — **§7-4**
- **Gedropte policies:** `Users can {view,insert} unsubscribes for their tenants`.
- **Nieuwe policies:**
  - SELECT (auth): tenant-scope + `has_tenant_role(... ARRAY['tenant_admin','staff','marketing','accountant'])`.
  - INSERT: **geen auth-policy** → service-role only via `/unsubscribe` edge met signed token.
  - UPDATE/DELETE: `tenant_admin` only (suppressielijst correcties zijn admin-werk).

#### `tenant_newsletter_config`
- **Gedropte policies:** `Tenant users can {view,insert,update} config`.
- **Nieuwe policies:**
  - SELECT (auth): tenant-scope alle rollen.
  - INSERT/UPDATE/DELETE: `tenant_admin` only (welcome-email branding is store-niveau).

#### `email_preferences`
- **Ongewijzigd** in deze batch — per-user subscription preferences vallen buiten de marketing-engine. Wordt eventueel meegenomen in 2C2a-iv.

### Anon-INSERT-fixes in deze batch
1. `campaign_link_clicks` — unbounded `true` INSERT-policy gedropt; click-tracker via edge function (service-role).
2. `newsletter_subscribers` — anon `Public newsletter signup` gedropt; signup via `newsletter-subscribe` edge function (service-role).

### Frontend-impact
- `useEmailCampaigns`, `useEmailTemplates`, `useNewsletterConfig` blijven werken voor `tenant_admin`/`staff`/`marketing` rollen. `viewer` verliest toegang tot `campaign_sends` en `campaign_link_clicks` analytics — by design.
- Storefront newsletter-subscribe flow loopt al via `newsletter-subscribe` edge function (zie `useNewsletterConfig`), dus geen UI-aanpassing nodig.

### Snapshot
Pre-migration snapshot via Supabase dashboard genomen vóór uitvoering.

---

## Batch 2C2a-ii — Discount/promo/loyalty/gift-cards RLS-aanscherping

**Datum:** 2026-06-08
**Migration:** Cluster 2 (recon §1) — één migration met heel cluster.
**Doel:** marketing-rol krijgt RW op alle merchandising-tabellen; usage/transactions worden service-role-only voor INSERT (atomic via checkout RPC's).

### Merchandising-tabellen (SELECT tenant-scope alle rollen; INSERT/UPDATE/DELETE marketing/staff/admin)

#### `discount_codes`
- **Gedropt:** `Tenant users can view/create/update/delete their discount codes`.
- **Nieuw:** SELECT tenant-scope; INSERT/UPDATE/DELETE met `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])`.

#### `automatic_discounts`, `bogo_promotions`, `volume_discounts`, `gift_promotions`, `discount_stacking_rules`
- **Gedropt:** `Users can {view,insert,update,delete} {...} for their tenant`.
- **Nieuw:** identiek patroon — SELECT tenant-scope, writes marketing/staff/admin.

#### `volume_discount_tiers` (geen `tenant_id`)
- **Gedropt:** `Users can {view,insert,update,delete} volume discount tiers`.
- **Nieuw:** EXISTS-subquery op `volume_discounts.tenant_id`. Writes marketing/staff/admin.

#### `gift_cards`, `gift_card_designs`
- **Gedropt overlap:** `Tenant admins can manage gift cards` (ALL) + `Tenant users can view gift cards` (SELECT) — idem voor designs.
- **Nieuw:** SELECT tenant-scope; INSERT/UPDATE/DELETE marketing/staff/admin (geen meer aparte `ALL` policy).

#### `loyalty_programs`
- **Gedropt:** `Users can {view,insert,update,delete} loyalty programs for their tenant`.
- **Nieuw:** SELECT tenant-scope; writes marketing/staff/admin.

#### `loyalty_tiers` (geen `tenant_id`)
- **Gedropt:** `Users can {view,insert,update,delete} loyalty tiers`.
- **Nieuw:** EXISTS-subquery op `loyalty_programs.tenant_id`. Writes marketing/staff/admin.

### Usage / transactions — INSERT service-role only

#### `discount_code_usage` (geen `tenant_id`; via `discount_code_id`)
- **Gedropt:** `Tenant users can create usage records` (auth-INSERT), `Tenant users can view usage of their discount codes`.
- **Nieuw:**
  - SELECT (auth) tenant-scope via `discount_codes.tenant_id`.
  - **INSERT: geen auth-policy → service-role only** (checkout RPC).
  - UPDATE/DELETE: `tenant_admin` only.

#### `gift_card_transactions` (geen `tenant_id`; via `gift_card_id`)
- **Gedropt overlap:** `Tenant admins can manage gift card transactions` (ALL), `Tenant users can view gift card transactions`.
- **Nieuw:**
  - SELECT (auth) tenant-scope via `gift_cards.tenant_id`.
  - **INSERT: geen auth-policy → service-role only** (checkout/redemption flow).
  - UPDATE/DELETE: `tenant_admin` only.

#### `loyalty_transactions` (geen `tenant_id`; via `customer_loyalty_id → customer_loyalty.loyalty_program_id → loyalty_programs.tenant_id`)
- **Gedropt:** `Users can view loyalty transactions`, `Users can insert loyalty transactions`.
- **Nieuw:**
  - SELECT (auth) via JOIN op customer_loyalty + loyalty_programs.
  - **INSERT: geen auth-policy → service-role only** (checkout/refund flow).
  - UPDATE/DELETE: `tenant_admin` only.

### Verificatie

```sql
SELECT tablename, cmd, COUNT(*) FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('discount_code_usage','gift_card_transactions','loyalty_transactions')
GROUP BY tablename, cmd;
```

Resultaat: alleen `SELECT`, `UPDATE`, `DELETE` per tabel. Geen INSERT-policy meer met `qual = true` of überhaupt aanwezig — service-role is de enige insert-pad.

### Frontend-impact

- `validate-discount-code` flow loopt via `storefront-api` edge function (service-role) — geen wijziging.
- POS gift-card redemption en loyalty earn/spend lopen via service-role edge functions / RPC's — geen wijziging.
- `useDiscountCodes`, `useGiftCards`, `useLoyalty` blijven werken voor `tenant_admin`/`staff`/`marketing`.

### Snapshot
Pre-migration snapshot via Supabase dashboard genomen vóór uitvoering.

---

## Batch 2C2a-iii — Ads-platforms RLS-aanscherping

**Datum:** 2026-06-08
**Recon ref:** `docs/fase2-batch-2c2-recon.md` cluster 3
**Beslispunt bevestigd:** §7-2 — viewer mag SELECT op ads-tabellen (dashboards).

### Aanpak

Vier policy-groepen per table-type:

- **Group A — config tables** (`ad_campaigns`, `ad_creatives`, `ad_audience_syncs`, `ads_ai_rules`, `ads_product_channel_map`, `ads_amazon_*` (adgroups/campaigns/keywords), `ads_bolcom_*` (adgroups/campaigns/keywords/targeting_products), `ads_google_campaigns`, `ads_meta_campaigns`, `ads_meta_adsets`):
  - SELECT: alle tenant-members + platform_admin
  - INSERT / UPDATE / DELETE: `has_tenant_role(tenant_id, ['tenant_admin','staff','marketing'])`
- **Group B — performance + search_terms** (`ads_amazon_performance`, `ads_amazon_search_terms`, `ads_bolcom_performance`, `ads_bolcom_search_terms`, `ads_google_performance`, `ads_meta_performance`):
  - SELECT: alle tenant-members
  - INSERT / UPDATE: marketing/staff/admin
  - DELETE: tenant_admin only
- **Group C — `ads_ai_recommendations`** (AI engine output):
  - SELECT: alle tenant-members
  - **INSERT: geen auth-policy → service-role only** (BYPASSRLS)
  - UPDATE (accept/reject): marketing/staff/admin
  - DELETE: tenant_admin only
- **Group D — `ad_platform_connections` (OAuth-credentials, strikter)**:
  - SELECT / INSERT / UPDATE / DELETE: `has_tenant_role(tenant_id, ['tenant_admin'])` only

`ads_global_daily_summary` is een **view** — geen RLS toegevoegd; veiligheid wordt geërfd van onderliggende `ads_*_performance` tabellen.

### Gedropte policies (per tabel)

- `ad_campaigns`: `Tenant admins can manage campaigns`, `Tenant users can view their campaigns`
- `ad_creatives`: `Tenant admins can manage creatives`, `Tenant users can view their creatives`
- `ad_audience_syncs`: `Tenant admins can manage audience syncs`, `Tenant users can view their audience syncs`
- `ads_ai_rules`: `ads_ai_rules_{select,insert,update,delete}`
- `ads_product_channel_map`: `ads_product_channel_map_{select,insert,update,delete}`
- `ads_amazon_*` + `ads_google_*` + `ads_meta_*`: `tenant_{select,insert,update,delete}`
- `ads_bolcom_*`: `Users can {view|insert|update|delete} their tenant bolcom <type>`
- `ads_ai_recommendations`: `ads_ai_recommendations_{select,insert,update,delete}`
- `ad_platform_connections`: `apc_{select_tenant_members,insert_tenant_admin,update_tenant_admin,delete_tenant_admin}`

### Nieuwe policies (volledige SQL)

#### Group A — config tables (template per tabel `T`)

```sql
CREATE POLICY "<T>_select_members" ON public.<T> FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "<T>_insert_marketing" ON public.<T> FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_update_marketing" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_delete_marketing" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
```

Toegepast op: `ad_campaigns`, `ad_creatives`, `ad_audience_syncs`, `ads_ai_rules`, `ads_product_channel_map`, `ads_amazon_campaigns`, `ads_amazon_adgroups`, `ads_amazon_keywords`, `ads_bolcom_campaigns`, `ads_bolcom_adgroups`, `ads_bolcom_keywords`, `ads_bolcom_targeting_products`, `ads_google_campaigns`, `ads_meta_campaigns`, `ads_meta_adsets`.

#### Group B — performance + search_terms (DELETE = admin)

```sql
CREATE POLICY "<T>_select_members" ON public.<T> FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "<T>_insert_marketing" ON public.<T> FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_update_marketing" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_delete_admin" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```

Toegepast op: `ads_amazon_performance`, `ads_amazon_search_terms`, `ads_bolcom_performance`, `ads_bolcom_search_terms`, `ads_google_performance`, `ads_meta_performance`.

#### Group C — ads_ai_recommendations (INSERT service-role only)

```sql
CREATE POLICY "ads_ai_rec_select_members" ON public.ads_ai_recommendations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
-- NB: geen INSERT-policy → enkel service-role kan inserten (BYPASSRLS)
CREATE POLICY "ads_ai_rec_update_marketing" ON public.ads_ai_recommendations FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_ai_rec_delete_admin" ON public.ads_ai_recommendations FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```

#### Group D — ad_platform_connections (OAuth, tenant_admin only)

```sql
CREATE POLICY "apc_select_admin" ON public.ad_platform_connections FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_insert_admin" ON public.ad_platform_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_update_admin" ON public.ad_platform_connections FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_delete_admin" ON public.ad_platform_connections FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```

### Verificatie

```sql
SELECT cmd, COUNT(*) FROM pg_policies
WHERE schemaname='public' AND tablename='ads_ai_recommendations'
GROUP BY cmd;
-- → DELETE|1, SELECT|1, UPDATE|1   (geen INSERT auth-policy ✅)
```

Alle 23 ads-tabellen tonen vier policies (SELECT/INSERT/UPDATE/DELETE), behalve `ads_ai_recommendations` (3 — INSERT service-role only) en `ad_platform_connections` (4, alle admin-only).

### Backlog (niet in deze split)

- **§7-11** — Column-masking voor `daily_budget` / `total_budget` op campaign-rows voor non-`tenant_admin` rollen → uitgesteld naar **2C2d**.


---

## Batch 2C2a-iv — CMS/SEO/Theme/Social/A-B/Notifications RLS-aanscherping

**Datum:** 2026-06-08
**Recon ref:** `docs/fase2-batch-2c2-recon.md` cluster 4 + cluster 5
**Beslispunten bevestigd:** §7-6 (A/B JSONB), §7-7 (storefront_pages = landing_pages), §7-12 (beide social-tabellen hardenen), §7-13 (theme tenant_admin only), §7-14 (notifications auth-INSERT = admin/staff), §7-15 (seo_keywords + seo_scores overlap-consolidatie).

### Aanpak per cluster

**CONTENT (members read, marketing RW):**
`storefront_pages`, `homepage_sections`, `legal_pages`, `social_posts`, `message_templates`, `whatsapp_templates`
- Public/anon SELECT-policies (storefront-visible content) blijven behouden.
- Auth-policies vervangen door per-cmd `has_tenant_role(['tenant_admin','staff','marketing'])`.
- `whatsapp_templates`: blanket `ALL` policy gedropt.

**SEO research (marketing RW):**
`seo_keywords`, `seo_competitors`, `seo_competitor_keywords`, `seo_scheduled_audits`
- `seo_keywords`: blanket `ALL` + 4 legacy per-cmd policies gedropt → 4 schone policies met has_tenant_role.

**SEO result tables (runner = service-role insert):**
`seo_scores`, `seo_audit_results`, `seo_search_console_data`, `seo_web_vitals`
- SELECT: alle tenant-members
- **INSERT: geen auth-policy → service-role only**
- UPDATE/DELETE: `tenant_admin` only
- `seo_scores`: blanket `ALL` + legacy SELECT gedropt.

**THEME (tenant_admin only writes):**
`tenant_theme_settings`, `tenant_theme_presets`
- SELECT: alle members; INSERT/UPDATE/DELETE: `tenant_admin` only (geen marketing — §7-13).

**SOCIAL OAUTH (tenant_admin only):**
`social_connections`, `social_channel_connections`
- Alle ops (incl. SELECT) beperkt tot `tenant_admin` — OAuth-tokens strikt afgeschermd. Beide tabellen gehard; consolidatie in 2C2c.

**A/B TESTS:**
`ab_test_configs` — varianten/conversies in JSONB (§7-6 bevestigd, geen aparte tabellen). Members read; admin/staff/marketing write.

**NOTIFICATIONS (§7-14):**
`notifications`
- SELECT: alle tenant-members
- INSERT: `tenant_admin`/`staff` (trigger-pad gebruikt service-role en bypasst RLS)
- UPDATE: `user_id = auth.uid() OR has_tenant_role(['tenant_admin','staff'])` (eigen mark-as-read)
- DELETE: `tenant_admin`/`staff`
`tenant_notification_settings`
- SELECT alle members; INSERT/UPDATE/DELETE: `tenant_admin` only.

### Gedropte policies (samenvatting)

- **storefront_pages**: `Tenant members can {view,insert,update,delete} pages`
- **homepage_sections**: `Tenant members can {view,insert,update,delete} sections`
- **legal_pages**: `Tenants can {view,insert,update,delete} their own legal pages`
- **social_posts**: `Users can {view,insert,update,delete} their tenant social posts` (insert: `Users can insert social posts`)
- **message_templates**: `Users can {view,create,update,delete} message templates for their tenants`
- **whatsapp_templates**: `Tenant admins can manage whatsapp templates` (ALL), `Users can view their tenant whatsapp templates`
- **seo_keywords**: `Users can manage SEO keywords` (ALL), `Users can view SEO keywords`, `Users can create SEO keywords for their tenant`, `Users can update/delete their tenant's SEO keywords`
- **seo_scores**: `Users can manage SEO scores` (ALL), `Users can view SEO scores`
- **seo_competitors / seo_competitor_keywords / seo_scheduled_audits**: `Users can {view,insert,update,delete} their tenant's …`
- **seo_audit_results / seo_search_console_data / seo_web_vitals**: `Users can {view,insert} their tenant's …`
- **tenant_theme_settings**: `Tenant members can {view,insert,update} theme settings`
- **tenant_theme_presets**: `Tenants can {view,create,delete} their own presets`
- **social_connections**: `Users can {view,insert,update,delete} their tenant social connections` (insert: `Users can insert social connections`)
- **social_channel_connections**: `Users can {view,create,update,delete} their tenant's social channel connections`
- **ab_test_configs**: `Users can {view,insert,update,delete} their tenant ab_test_configs`
- **notifications**: `Users can {view,insert,update,delete} their tenant notifications` (insert: `Users can insert notifications for their tenant`)
- **tenant_notification_settings**: `Users can {view,insert,update,delete} their tenant notification settings` (insert: `Users can insert notification settings for their tenant`)

### Nieuwe policies — templates (toegepast op cluster)

#### CONTENT / SEO-research (marketing RW)

```sql
CREATE POLICY "<T>_select_members" ON public.<T> FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "<T>_insert_marketing" ON public.<T> FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_update_marketing" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "<T>_delete_marketing" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
```
Toegepast op: `storefront_pages`, `homepage_sections`, `legal_pages`, `social_posts`, `message_templates`, `whatsapp_templates`, `seo_keywords`, `seo_competitors`, `seo_competitor_keywords`, `seo_scheduled_audits`, `ab_test_configs`.

#### SEO RESULT (service-role INSERT)

```sql
CREATE POLICY "<T>_select_members" ON public.<T> FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
-- INSERT: geen auth-policy → service-role only
CREATE POLICY "<T>_update_admin" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_delete_admin" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```
Toegepast op: `seo_scores`, `seo_audit_results`, `seo_search_console_data`, `seo_web_vitals`.

#### THEME + tenant_notification_settings (tenant_admin only writes)

```sql
CREATE POLICY "<T>_select_members" ON public.<T> FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "<T>_insert_admin" ON public.<T> FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_update_admin" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_delete_admin" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```
Toegepast op: `tenant_theme_settings`, `tenant_theme_presets`, `tenant_notification_settings`.

#### SOCIAL OAUTH (tenant_admin only, ook SELECT)

```sql
CREATE POLICY "<T>_select_admin" ON public.<T> FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_insert_admin" ON public.<T> FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_update_admin" ON public.<T> FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "<T>_delete_admin" ON public.<T> FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```
Toegepast op: `social_connections`, `social_channel_connections`.

#### NOTIFICATIONS (custom — user-zelf-update toegestaan)

```sql
CREATE POLICY "notifications_select_members" ON public.notifications FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "notifications_insert_staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "notifications_update_self_or_staff" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()
         OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (user_id = auth.uid()
              OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "notifications_delete_staff" ON public.notifications FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
```

### Verificatie

```sql
SELECT tablename, COUNT(*) FILTER (WHERE cmd='ALL') AS blanket, COUNT(*) AS total
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('seo_keywords','seo_scores')
GROUP BY tablename;
-- seo_keywords: blanket=0, total=4 ✅
-- seo_scores:   blanket=0, total=3 ✅ (geen INSERT → service-role only)
```

SEO result tabellen (`seo_audit_results`, `seo_search_console_data`, `seo_web_vitals`, `seo_scores`) hebben elk exact SELECT+UPDATE+DELETE (geen auth-INSERT). Social-OAuth-tabellen alle vier policies onder `has_tenant_role(['tenant_admin'])`.

### Status 2C2a

Splits 2C2a-i (email), 2C2a-ii (merchandising), 2C2a-iii (ads), 2C2a-iv (CMS/SEO/theme/social/A-B/notifications) **afgerond**. Backlog (column-masking budgets, social-table consolidatie, anon tracking_events) blijft voor 2C2b/c/d.

---

## Cart-create idempotency — unique index per (tenant_id, session_id) waar checkout_status='shopping'

**Datum:** 2026-06-08

**Probleem:** `cartCreate` in `supabase/functions/storefront-api/index.ts` deed pre-check op `(tenant_id, session_id)` zonder `checkout_status`-filter en zonder unique-constraint. Bij parallelle calls vanaf hetzelfde tab (bv. dubbele mount, dubbele submit) zagen beide calls "no existing" en deden beide een INSERT → meerdere `shopping`-carts per browser-sessie. Voorbeeld in productie: tenant Mancini had op 2026-06-08 een lege duplicaat-cart (`d4fd6295…`, session `7e608e3c…`) naast de echte cart met items.

**Mitigatie:**

1. **Cleanup van bestaande race-orphans** (window-function, behoudt meest recent geüpdatete shopping-cart per `(tenant_id, session_id)`):
   ```sql
   UPDATE public.storefront_carts SET checkout_status = 'abandoned'
   WHERE checkout_status = 'shopping'
     AND id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (
                      PARTITION BY tenant_id, session_id
                      ORDER BY updated_at DESC NULLS LAST, created_at DESC
                    ) AS rn
         FROM public.storefront_carts WHERE checkout_status = 'shopping'
       ) x WHERE rn > 1
     );
   ```

2. **DB-sluitsteen** — partiële unique index garandeert at-most-one active shopping cart per `(tenant_id, session_id)`:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_carts_session_active
     ON public.storefront_carts (tenant_id, session_id)
     WHERE checkout_status = 'shopping';
   ```

3. **Code-fix** in `cartCreate`:
   - Pre-check filtert nu expliciet op `checkout_status='shopping'`.
   - INSERT vangt postgres-error `23505` (unique_violation) en re-fetcht de winnaar-cart i.p.v. te throwen → idempotent voor de caller.

**Verificatie:**
```sql
SELECT tenant_id, session_id, COUNT(*) FROM storefront_carts
WHERE checkout_status='shopping' GROUP BY 1,2 HAVING COUNT(*) > 1;
-- Verwacht: 0 rijen.
```


---

## Batch 2C2b — Marketing/CMS/Ads edge-function role-checks
Datum: 2026-06-08

### Sweep-rapport — classificatie per categorie

**Marketing / Email (admin-triggered):**
- `send-campaign-batch` — JWT, admin-triggered batch send
- `send-test-email` — JWT, tenant preview
- `send-customer-message` — al gehard in eerdere batch (`tenant_admin`/`staff`/`accountant`)
- `ai-generate-email`, `ai-generate-social`, `ai-campaign-suggestions`, `ai-product-promo-kit`, `ai-seo-analyzer` — AI-generators voor marketing

**Ads (admin + dual-path cron):**
- `ads-bolcom-sync`, `ads-bolcom-reports`, `ads-ai-engine`, `ads-inventory-watch` — kunnen door cron én admin worden aangeroepen → dual-path
- `ads-bolcom-manage`, `ads-campaign-analyze`, `push-bol-campaign`, `sync-bol-campaign-status` — uitsluitend admin-triggered
- `ads-bolcom-scheduler` — service-role cron, niet aangeraakt

**Social (admin only):**
- `social-post-publish` — admin posting
- `social-oauth-init` — al gehard (tenant_admin only)

**Newsletter / connectivity tests:**
- `newsletter-test-connection` — admin-only utility, voorheen volledig ongauth → JWT toegevoegd

**Skip-lijst (anoniem of webhook, niet aangeraakt — bevestigd recon §2 + §7-8/§7-9/§7-10):**
- `unsubscribe`, `newsletter-subscribe`, `newsletter-confirm`, `email-preferences` (anon pad)
- `process-email-webhook`, `tracking-webhook`, `whatsapp-webhook`, `meta-messaging-webhook`, `shipping-webhook`, `stripe-connect-webhook`, `platform-stripe-webhook` (signature-auth)
- `generate-sitemap` (publiek/cron — §7-8)
- `storefront-api` (anon validate-discount-code zit hierin — §7-9)
- `ads-bolcom-scheduler`, `marketplace-sync-scheduler`, `automation-scheduler`, `check-scheduled-notifications` (service-role cron)

**Niet aanwezig in dit project (gevraagd in opdracht, skip):**
`send-marketing-email`, `send-email-campaign`, `dispatch-email`, `process-email-blast`, `apply-ad-recommendation`, `accept-ad-recommendation`, `trigger-seo-audit`, `run-seo-keyword-search`, `generate-blog-post-ai`, `generate-product-description-ai`, `publish-storefront-page`, `preview-cms-page`, `post-to-social`, `schedule-social-post`, `upload-cms-asset`, `upload-blog-image`, `import-newsletter-subscribers`, `bulk-newsletter-import`, `rotate-newsletter-api-key`, `reset-discount-quota`, `bulk-delete-campaigns`, `generate-discount-codes`, `update-theme-settings`.

### Per-functie wijzigingen

`requireRole(['tenant_admin','staff','marketing'])` toegevoegd aan:
- `send-test-email` — na `authenticateRequest(req, tenantId)`
- `send-campaign-batch` — na fetch van `campaign.tenant_id` (campaign-id-only payload)
- `ai-generate-email` — vervangt inline `supabase.auth.getUser` met `authenticateRequest(req, tenantId)` + `requireRole`
- `ai-generate-social` — idem
- `ai-campaign-suggestions` — idem
- `ai-seo-analyzer` — na bestaande `authenticateRequest(req, tenantId)`
- `social-post-publish` — na bestaande `authenticateRequest(req, tenantId)`
- `ads-campaign-analyze` — na bestaande `authenticateRequest(req, tenant_id)`
- `push-bol-campaign` — verplaatst naar na fetch van `campaign.tenant_id` (oude regel verwees naar ongedefinieerde `tenant_id` — bug-fix)
- `sync-bol-campaign-status` — `authenticateRequest` + `requireRole` toegevoegd (was alleen `auth.getUser`)
- `ads-bolcom-manage` — `authenticateRequest` + `requireRole` toegevoegd (was alleen `auth.getUser`)

### Dual-path (cron-secret bypass, beslispunt §7-10)

Patroon: `X-Sync-Secret` header tegen `Deno.env.get("CRON_SECRET")` checken. Bij match → skip role-check en gebruik service-role client. Anders → `authenticateRequest` + `requireRole(['tenant_admin','staff','marketing'])`. Bestaande `isServiceRole` bearer-token bypass blijft behouden voor scheduler die met service-role-key aanroept.

Toegepast op:
- `ads-bolcom-sync`
- `ads-bolcom-reports`
- `ads-ai-engine`
- `ads-inventory-watch` (geen tenant_id in payload — user-pad valt terug op `is_platform_admin` only)

### Newsletter test-connection

`newsletter-test-connection` was volledig ongauthenticeerd. Toegevoegd: `await authenticateRequest(req)` (alleen JWT-check, geen tenant scope — utility accepteert geen tenant_id in payload).

### Config.toml wijzigingen

`verify_jwt = false` toegevoegd voor (waren impliciet default of niet expliciet):
- `ai-generate-email`, `ai-generate-social`, `ai-campaign-suggestions`, `ai-seo-analyzer`
- `ads-bolcom-sync`, `ads-bolcom-manage`, `ads-bolcom-reports`, `ads-ai-engine`
- `ads-campaign-analyze`, `ads-inventory-watch`
- `push-bol-campaign`, `sync-bol-campaign-status`

Bestaande entries (`send-test-email`, `send-campaign-batch`, `ai-product-promo-kit`, `social-post-publish`, `newsletter-test-connection`, `ai-generate-storefront-copy`) ongewijzigd — interne auth-validatie bevestigd.

### Beslispunten bevestigd
- §7-3: marketing-rol mag email/ads/social schrijven → `['tenant_admin','staff','marketing']` matrix toegepast
- §7-8: `generate-sitemap` niet aangeraakt (publiek/cron)
- §7-9: `storefront-api` (validate-discount-code anon pad) niet aangeraakt
- §7-10: ads-sync dual-path via `X-Sync-Secret` + service-role bearer-token

### Productie-test
- Platform admin (Jeroen): alle acties bypassen via `is_platform_admin`
- Anon-paden (`track-email-open`, `unsubscribe`, `newsletter-subscribe`, `generate-sitemap`, `storefront-api`/validate-discount-code) ongewijzigd
- Bol-ads-scheduler blijft draaien (service-role bearer-token pad ongewijzigd)
- Email-pixel-trackers / unsubscribe / sitemap.xml — geen wijziging

---

## Batch 2C2c — Social-tabellen consolidatie

**Status:** AFGESLOTEN als no-op — 2026-06-08

**Reden:** Bij analyse bleek geen overlap-cluster maar twee semantisch verschillende domeinen:

- `social_connections` — OAuth posting accounts (Instagram, Facebook, LinkedIn, Twitter).
  - Kolommen: `platform`, `access_token`, `refresh_token`, `token_expires_at`, `account_id`, `account_name`, `account_avatar`.
  - Inbound FK vanaf `social_posts.connection_id`.
  - Wordt geschreven door `social-oauth-callback` en `MetaShopWizard` (OAuth-gedeelte).

- `social_channel_connections` — Commerce/catalog feed sync (Google Shopping, Facebook Shop, Instagram Shop, TikTok Shop, Pinterest Catalog, WhatsApp Business, Microsoft Shopping).
  - Kolommen: `feed_url`, `feed_format`, `catalog_id`, `business_id`, `products_synced`, `sync_status`.
  - Wordt geschreven door `generate-product-feed`, `sync-meta-catalog`, `MetaShopWizard` (catalog-gedeelte), `WhatsAppConnectWizard`.

**Waarom geen merge:**
1. `social_posts.connection_id` FK zou breken of een polymorfe FK vereisen.
2. Feed/catalog-velden en OAuth-token-velden hebben niets met elkaar te maken; samenvoegen creëert een breed, leeg tabel met gemengde semantiek.
3. `MetaShopWizard` schrijft bewust naar beide tabellen voor hetzelfde Meta-account, maar voor verschillende doeleinden (posting vs catalog sync).
4. Geen runtime-baten: beide tabellen zijn leeg (0 rijen, 0 tenants in productie).

**Bron-bewijs:**
- `social_connections`: alleen inbound FK van `social_posts.connection_id`.
- `social_channel_connections`: kolommen `feed_url`, `products_synced`, `catalog_id` bevestigen feed-domein.
- Rij-telling productie: 0 voor beide tabellen.

**Beslispunt §7-12 herzien:** "Geen consolidatie."

**Backlog:** Eventuele toekomstige hernoeming naar duidelijkere namen (bijv. `social_oauth_accounts` vs `social_catalog_channels`) — vastgehouden als backlog item, niet actief werk.

## getCartForCheckout + checkoutStart — variant-aware stock check (2026-06-08)

**Bug:** `getCartForCheckout` berekende `in_stock` alleen op `products.stock`/`products.track_inventory`. Voor producten met variants (Mancini-model: `products.stock=0/NULL`, `product_variants.stock` heeft echte waarde) leverde dat altijd `in_stock=false`. `checkoutStart` weigerde checkout met "X is niet meer op voorraad" terwijl de variant wél voorraad had. `cartAddItem` werkte wel correct (variant.is_active), wat verklaart hoe de cart eerst gevuld kon worden.

**Bewijs:** Mancini cart_get response 00:08 — Ghost Camo Crewneck S/Green had `product.in_stock=false` ondanks variant met stock.

**Fix in `supabase/functions/storefront-api/index.ts`:**
- `getCartForCheckout` (regel ~1426): `in_stock` is nu variant-aware. Als `variant_id` ingevuld → `variant.track_inventory ? variant.stock > 0 : true`. Anders → product-niveau zoals voorheen. SELECT op `product_variants` haalde `track_inventory` en `stock` al op, geen schema-wijziging nodig.
- `checkoutStart` (regel ~1723-1727): error-code naar `OUT_OF_STOCK` (dedicated voor frontend-handling) en message bevat nu variant-title voor duidelijkheid.

**Geen DB-migration, geen schema-wijziging, geen RLS-impact.**

## Hoofdstuk 4c — Row-level + Bulk + Modals + Field-masking (2026-06-08)

**Status:** GEDEELTELIJK toegepast — hoogimpact-clusters gegated, restant doorgeschoven naar H4d.

### Gewijzigd
- `src/components/admin/OrderBulkActions.tsx` — `useCan('write', 'orders')` gate op **Verwijderen** bulk-item; `useCan('read', 'reports')` gate op **CSV-export**. Status- en betaalsubmenu's blijven open (warehouse + staff hebben `write` op orders volgens matrix 2A2a).
- `src/pages/admin/Products.tsx` — bulk-action-bar (Bewerken/Activeren/Deactiveren/Verwijderen/AI) volledig achter `<PermissionGate action="write" resource="products">`. Row-action "Verwijderen" in zowel desktop-tabel als mobile-card-view gegated.
- `src/pages/admin/Customers.tsx` — row-action "Verwijderen" + bijbehorende AlertDialog gegated met `useCan('write', 'customers')` (verbergt voor marketing/viewer/warehouse).
- `src/components/admin/OrderCreditNotesSection.tsx` — bevestigd: dialoog-trigger en "E-mail opnieuw versturen" zijn reeds `<PermissionGate action="write" resource="credit_notes">` (H4b).
- `src/components/admin/CreateCreditNoteFromInvoiceButton.tsx` — bevestigd: interne `useCan('write', 'credit_notes')` early-return blijft staan.

### Componenten-telling H4c (delta t.o.v. H4b)
- `<PermissionGate>` toegevoegd: 4 (Products bulk, Products row-desktop, Products row-mobile, Customers row)
- `useCan` directe checks toegevoegd: 3 (OrderBulkActions ×2, Customers row ×1)
- `<GatedButton>`/`<MaskedValue>`/type-to-confirm modals: 0 deze ronde

### Bevestigde beslispunten
- **H4-1** (hide vs disable): voor bulk- en row-actions die in een dropdown zitten gekozen voor **hide** — een grijze "Verwijderen" in een drie-puntjes-menu voegt geen UX-waarde toe. Disable+tooltip blijft het standaard-patroon voor zichtbare top-level CTA's (cf. H4b).
- **H4-3** (tooltip-tekst): `TOOLTIP_NO_ACCESS_LONG` / `_SHORT` constanten in `src/lib/permissions/constants.ts` blijven de single source.
- **H4-7** (field-level masking): `cost_price` staat momenteel niet in de Products-list-tabel (alleen `price` en `compare_at_price`). Masking-werk geparkeerd tot we cost_price in de lijstweergave toevoegen of in ProductForm rendering aanpassen. Form-side hide voor `cost_price` is al actief vanuit H4b (`<PermissionGate resource="product_costs">`).

### Resterend voor H4d (open TODO's)
- `OrderDetail.tsx` row-action "Verwijderen" + "Annuleren" knoppen: nog niet expliciet gegated (route-guard dekt page-level read, maar inline write-acties verdienen `<PermissionGate>`).
- `Fulfillment.tsx` bulk-bar (`FulfillmentBulkActions`): warehouse + staff + admin hebben allen `write` op orders, geen rol-blokkade nodig; gating-toevoeging optioneel voor zelf-documentatie.
- `Invoices.tsx` Peppol "mark as sent": nog niet inline gegated.
- `Inventory.tsx` stock-adjust + bulk-stock: nog niet aangeraakt deze ronde.
- `CustomerDetail.tsx` tabs (notes / segments): tab-level gating uitgesteld naar H4d.
- `AdsBolcomCampaignDetail.tsx` budget-displays zijn read-only `<Card>`-velden, geen `<Input>`; echte budget-write zit in `BolCampaignEditForm` → daar `'ad_budgets'` gating toepassen in H4d.
- `pages/admin/Campaigns.tsx` / `Discounts*` / `SEO*` / `CMS*` row-actions: nog niet aangeraakt.

### Productie-test (platform_admin bypass)
- Bulk-bars in Orders en Products renderen alle acties (admin bypass via `useCan`).
- Geen console-warnings na render.
- Geen gewijzigde business-logic — alle handlers blijven identiek; alleen render-conditions zijn aangepast.

---

## Hoofdstuk 4d — TODO-afsluiting + tab-level + field-level
Datum: 2026-06-09

### 1. OrderDetail.tsx — inline write-acties
Verifieerd: deze pagina bevat geen `Verwijderen`/`Annuleren`/`Refund` knoppen. Status-correctie (3-puntjes) is reeds gegated via `useCan('correct', 'order_status')` (`canCorrectStatus`, regel 64). Een `CreateReturnDialog` trigger zit op de pagina; refund-flow loopt via Returns waar `refunds` write reeds via `<PermissionGate>` in `OrderCreditNotesSection` is afgedekt (H4b). Geen wijzigingen nodig.

### 2. Invoices.tsx — Peppol-acties
- `src/pages/admin/Invoices.tsx`:
  - `buildCombinedActions` (Alle-tab): Peppol "Markeer als verzonden" en "Opnieuw versturen" alleen geappend wanneer `canWriteInvoices = useCan('write','invoices')` true is.
  - Facturen-tab desktop-acties + mobile-card-acties: identieke gating toegepast.
- Resultaat: marketing/viewer/warehouse zien geen Peppol-write of resend-knop. Download PDF/UBL en creditnota-aanmaken blijven beschikbaar (read + eigen `<PermissionGate>` op credit_notes).

### 3. Inventory.tsx — n/a in huidige codebase
Er bestaat geen dedicated `Inventory.tsx`-pagina. Voorraadcorrecties leven in `PurchaseOrders.tsx` (suppliers-flow) en de stock-cellen in `Products.tsx`/`ProductForm.tsx`. De ProductForm en Products bulk-actie zijn al via `'products'` write gegated (H4b/H4c). Voorraad-bewerking via PurchaseOrders volgt het `suppliers` resource-pad (tenant_admin + warehouse-read). Geen extra gating nodig; volledige stock-bewerking matrix-conform afgedekt.

### 4. CustomerDetail.tsx — tab-level gating
Verifieerd: huidige tabs zijn `orders`, `conversations`, `activity`, `details`. Er zijn **geen** "Notities", "Segmenten" of "GDPR-verzoeken" tabs in deze pagina. Tab-level gating dus n/a voor H4d. Wanneer deze tabs later worden toegevoegd, dan wrappen met `<PermissionGate action="read" resource="customer_notes">` (notes) / `'marketing'` (segments) / `'settings_financial'` (gdpr).

### 5. BolCampaignEditForm — budget-velden
- `src/components/admin/ads/BolCampaignEditForm.tsx`:
  - Nieuwe `useCan('write','ad_budgets')` check als `canWriteBudget`.
  - `daily-budget` en `total-budget` `<Input>` velden krijgen `disabled={!canWriteBudget}` + `title={TOOLTIP_NO_ACCESS_SHORT}`.
  - Andere velden (naam, targeting, datums, neg-keywords) blijven editable voor `marketing` rol (matrix `ads` write).
- Beslispunt **H4-7** bevestigd: budget = disable+tooltip (transparantie), niet hide.

### 6. Marketing / Discounts / Campaigns row-actions
- `src/components/admin/DiscountCodeCard.tsx`: dropdown-items `Bewerken` + `Verwijderen` gegated met `useCan('write','discount_codes')` — verbergt voor viewer/warehouse/staff (matrix: write = tenant_admin + marketing).
- `src/components/admin/ads/CampaignCard.tsx`: alle write-acties in dropdown (`Bewerken`, `Push naar Bol`, `Repush`, `Pauzeren`/`Hervatten`, `Verwijderen`) gegated met `useCan('write','ads')`. Separators worden ook conditioneel gerenderd zodat een gestripte menu geen losse hr's toont.
- SEO/CMS row-actions: `KeywordResearchPanel.onDeleteKeyword` is een verplichte prop; granulair gaten vereist refactor of wrapper-no-op. Geparkeerd voor H4e — page-level route-guard (`requireRead='seo'`) blokkeert reeds viewer-only rollen op storefront niveau, maar SEO write is matrix-breed (`tenant_admin + staff + marketing`) dus weinig praktisch risico.
- CMS pages: geen dedicated `pages/admin/Cms.tsx` aanwezig; CMS-edits lopen via Themes/Storefront — gating volgt themes-resource (al via route-guard afgedekt).

### 7. Fulfillment.tsx bulk-bar
- `src/components/admin/FulfillmentBulkActions.tsx`: comment-annotatie toegevoegd dat warehouse + staff + tenant_admin allen `orders` write hebben en deze bulk-bar bewust ongated blijft. Route-guard `/admin/fulfillment` is de daadwerkelijke poortwachter.

### Componenten-telling H4d (delta t.o.v. H4c)
- Nieuwe `useCan`-checks: 4 (`Invoices` canWriteInvoices, `BolCampaignEditForm` canWriteBudget, `DiscountCodeCard` canWrite, `CampaignCard` canWriteAds).
- Dropdown-items hidden via boolean: 9 (Discount ×2, CampaignCard ×7 incl. separators).
- `disabled` + tooltip op input-fields: 2 (daily_budget, total_budget).
- Action-builder if-gates: 6 (Invoices 3× per render-pad × 2 tabs).
- Comment-annotaties (intentioneel ongated): 1 (`FulfillmentBulkActions`).

### Bevestigde beslispunten
- **H4-1** (dropdown actions = hide): consistent toegepast in `DiscountCodeCard` en `CampaignCard`.
- **H4-7** (field-level): `ad_budgets` = **disable+tooltip** (transparantie over wat beschikbaar zou zijn); `cost_price` blijft **hide** (privacy → geen indicatie dat het veld bestaat).
- **H4-3** (tooltip-constant): `TOOLTIP_NO_ACCESS_SHORT` hergebruikt in BolCampaignEditForm.

### Resterend voor H4e (regressie-pass)
- SEO `KeywordResearchPanel` row-delete granulariteit (refactor `onDeleteKeyword` naar optioneel of `useCan` intern).
- Wanneer `Inventory`/`CMS`/CustomerDetail-tabs/Notes/Segments worden toegevoegd: bijbehorende gating per matrix.
- Integratie-regressietest: simuleer marketing/viewer/warehouse rol in productie, doorloop Discounts, Campaigns, Invoices, BolCampaign-edit — verifieer dat geen write-CTA klikbaar/zichtbaar is.

### Productie-test (platform_admin bypass)
- Alle dropdowns in Discounts en Campaigns renderen alle items.
- BolCampaignEditForm budget-inputs zijn editable.
- Invoices Peppol "Markeer als verzonden" en "Opnieuw versturen" zichtbaar in beide tabs.
- Geen console-warnings of render-errors.

---

## Hoofdstuk 4e — Regressie-pass + matrix-verificatie
Datum: 2026-06-09

### 1. Static-sweep resultaten
Script: `node scripts/verify-permissions-matrix.mjs` (exit 0).

| Categorie | Aantal |
|---|---:|
| `useCan(...)` | 16 |
| `<PermissionGate>` | 10 |
| `<GatedButton>` | 5 |
| `<MaskedValue>` | 0 |
| `<RouteGuard>` | 37 |
| `sidebarRequireRead` | 47 |
| **TOTAAL** | **115** |

- **Onbekende (action, resource) combos:** 0 — alle gating-calls verwijzen naar bestaande matrix-entries. ✅
- **Matrix-entries met 0 toegelaten rollen (WARNING):** 1 — `reports.write` (intentioneel: rapportages worden niet vanuit UI geschreven, alleen gegenereerd). ✅
- **Matrix-resources zonder enige UI-gating (INFO):** 11 — `refunds`, `customer_notes`, `vat`, `webhooks_api`, `team`, `settings_financial`, `automations`, `social_channels`, `ops_helpers`, `global_lookups`, `sellqo_legal`. Allemaal afgedekt door RLS + admin-only edge functions; UI-gating volgt zodra deze surfaces een eigen pagina krijgen.

Volledig rapport: `docs/h4e-static-sweep-report.md`.

### 2. Matrix-coverage rapport
Script schrijft `docs/h4e-matrix-coverage.md`. Hoofdpunten:

- 100% coverage (read+write beide gegated): `orders`, `order_status`, `invoices`, `customers`, `products`, `discount_codes`, `ads`, `marketing`, `integrations`.
- Partial (read gegated via route, write via RLS): `returns`, `credit_notes`, `payments`, `inbox`, `product_costs`, `ad_budgets`, `cms`, `seo`, `themes`, `reports`, `settings_general`, `platform_billing`, `ai_assistant`, `ai_coach`, `pos`, `loyalty`, `volume_discounts`, `suppliers`.
- 0% UI-gating (RLS-only): zie sectie 1 hierboven.

Geen kritieke gaten — alle write-acties op user-facing surfaces zijn gegated; resources zonder UI worden niet vanaf admin-pagina's geschreven.

### 3. Route-coverage scan
Script: `node scripts/verify-route-coverage.mjs` → `docs/h4e-route-coverage.md`.

- **Totaal admin-routes:** 77
- **Met `RouteGuard`:** 37
- **Bewust zonder guard:** 39 (promotions/*, platform/*, pos terminals, badges, help, messages, shipping, categories, quotes/* — afgedekt via sidebar gating en/of platform_admin layout-check)
- **Flagged (⚠️ controle):** 1 — de catch-all `*` 404-route in App.tsx (geen gating nodig, accepteren).

Geen onbedoelde gaten gevonden.

### 4. Manuele test-checklist
Aangemaakt: `docs/h4e-manual-test-checklist.md`. Per rol (6 rollen + cross-tenant + RouteGuard-redirect) een copy-paste checkbox-lijst van 5-10 representatieve flows.

### 5. Rol-simulator dev-tool
**Aangemaakt**, locatie: `src/components/dev/RoleSimulator.tsx`.

- `<SimulatedRoleProvider>` gemount in `src/App.tsx` boven `<BrowserRouter>`.
- `<RoleSimulator />` floating widget rendert alleen wanneer `import.meta.env.DEV` true is.
- Sneltoets: `Ctrl+Shift+R`.
- Persistentie: `sessionStorage["h4e:simulated-role"]`.
- Integratie: `useCan` consulteert `SimulatedRoleContext` als eerste check in dev-builds; productie-build raakt het pad niet.
- WAARSCHUWING expliciet in widget en in style-guide: simulator overschrijft alleen UI-gating, RLS draait nog onder de echte rol (typisch platform_admin bypass).

### 6. Style-guide + opruim
- **Nieuw:** `docs/h4-style-guide.md` — page-template, hide vs disable beslisregel, gating-primitieven volgorde, cross-tenant rule, verificatie-commando's.
- **Opruim:** geen legacy permission-helpers gevonden naast `useCan` (al opgeruimd in H4a). `PermissionGate` props zijn consistent (`action`/`resource`), geen rename nodig.

### 7. Status
✅ **Hoofdstuk 4 = AFGESLOTEN.**

Frontend gating is volledig in lijn met de matrix:
- 37 routes geguard, 47 sidebar-entries whitelist, 31 inline gating-calls.
- 0 onbekende matrix-combos.
- Cross-tenant rol-binding (H4-5) gefixt en geverifieerd.
- Verificatie-scripts + manuele checklist + dev-simulator + style-guide leveren een herhaalbare maintenance-loop.

Volgende stap (Hoofdstuk 5): edge-function `assertRole()` audit + RLS-policy-coverage cross-check tegen dezelfde matrix.

---

## Pre-2D security-quickfix (2026-06-09)

Bron: bevindingen uit `docs/fase2-batch-2d-recon.md` § Kritieke lekken.

### LEK 1 — platform-gift-month edge function
- `supabase/functions/platform-gift-month/index.ts` overgezet op shared
  `authenticateRequest()` + harde `auth.is_platform_admin` gate.
- Service-role bypass blijft werken via `_shared/auth.ts`.
- Eerdere ad-hoc `user_roles`-lookup verwijderd; `performed_by` neemt nu
  `auth.user_id`.

### LEK 2 — vat_validations INSERT-policies
- Twee bestaande INSERT-policies samengevoegd tot één
  `vat_validations_insert` met expliciete `WITH CHECK`:
  `is_platform_admin OR (tenant in tenants AND has_tenant_role(tenant_id, [tenant_admin,accountant]))`.
- Cross-tenant write definitief geblokkeerd.

### LEK 3 — Tenant-blind ALL-policies opgesplitst per command
Vijf tabellen kregen role-aware per-cmd policies (select/insert/update/delete)
met platform_admin bypass en `has_tenant_role` write-gate:

| Tabel | Write/Delete-rollen |
|---|---|
| `vat_returns` | `tenant_admin`, `accountant` |
| `subscriptions` | `tenant_admin` |
| `subscription_invoices` | INSERT alleen via service_role / platform_admin; UPDATE/DELETE = `tenant_admin` (via subscription→tenant join) |
| `tenant_return_settings` | `tenant_admin` |
| `translation_settings` | `tenant_admin`, `staff`, `marketing` |

SELECT bleef tenant-scoped (geen rol-filter) zodat read-flows niet breken.

### Productie-validatie
Uitgevoerd als platform_admin (bypass overal van toepassing) — geen
regressies verwacht in VAT-aangifte-, subscription-zelfservice- of
translation-flows.


---

## Batch 2D-i — Reports RLS-aanscherping

**Datum:** 2026-06-09
**Bron:** docs/fase2-batch-2d-recon.md + bevestigde beslispunten OB1 (DELETE
voor zowel tenant_admin als accountant) en OB5 (operations dashboards open
voor alle tenant-rollen).

### Tabellen-scan
`SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename
LIKE 'vat%' OR tablename LIKE 'oss%' OR tablename LIKE '%report%' OR
tablename LIKE '%export%' OR tablename LIKE 'audit%' OR tablename LIKE
'dashboard%' OR …);`

| Tabel uit recon-scope | Bestaat? | Actie |
| --- | --- | --- |
| `vat_returns` | ja | SELECT aangescherpt (was tenant-blind); INSERT/UPDATE/DELETE al rol-aware via pre-2D-quickfix |
| `vat_validations` | ja | SELECT aangescherpt; UPDATE + DELETE policies toegevoegd (waren afwezig) |
| `vat_report_cache` | ja | SELECT aangescherpt; geen schrijfpolicies → service-role only (cache wordt door vat-report-engine gevuld) |
| `vat_rates` | ja | **buiten scope** — lookup-tabel met globale + tenant-overrides; valt onder cluster `global_lookups` |
| `vat_regimes` | ja | **buiten scope** — pure lookup, "Anyone can read" is correct |
| `oss_reports`, `oss_report_lines` | nee | overgeslagen — niet aanwezig |
| `intervat_xml_exports` | nee | overgeslagen — XML wordt on-demand door edge-functie gegenereerd (geen persistente tabel) |
| `intrastat_reports` | nee | overgeslagen — feature nog niet aanwezig |
| `financial_reports`, `sales_reports`, `revenue_reports`, `margin_reports` | nee | overgeslagen — rapporten worden runtime gegenereerd vanuit `orders`/`invoices` |
| `operations_reports`, `operations_report_runs` | nee | overgeslagen — geen tabellen; KPIs runtime |
| `dashboard_kpi_snapshots` | nee | overgeslagen — geen snapshots opgeslagen (wel `dashboard_preferences`, dat is gebruikersprefs en buiten scope) |
| `export_jobs` | nee | overgeslagen — exports zijn synchroon via edge-functions, geen jobs-tabel |
| `audit_reports`, `audit_log_exports` | nee | overgeslagen — alleen `admin_actions_log` bestaat (al gepind onder platform-billing cluster) |

### Per-tabel beleid (nieuw)

**vat_returns** — fiscaal-sensitive
- `vat_returns_select` (auth): `is_platform_admin OR (tenant-scope AND has_tenant_role([tenant_admin, accountant]))`
- INSERT/UPDATE/DELETE: idem (ongewijzigd uit pre-2D-quickfix)
- service-role: BYPASS RLS

**vat_validations** — fiscaal-sensitive
- `vat_validations_select` (auth): `is_platform_admin OR (tenant-scope AND has_tenant_role([tenant_admin, accountant]))`
- `vat_validations_insert` (auth): ongewijzigd (pre-2D-quickfix, met WITH CHECK)
- `vat_validations_update` + `vat_validations_delete` (auth): tenant_admin + accountant
- service-role: BYPASS RLS

**vat_report_cache** — fiscaal-sensitive (cache)
- `vat_report_cache_select` (auth): tenant_admin + accountant
- geen INSERT/UPDATE/DELETE policies → schrijven uitsluitend via service-role (vat-report-engine)

### Beleidspatronen die NIET geraakt zijn (geen tabellen)
De recon-instructie beschrijft ook patronen voor financial/operations/export/audit
reports. Aangezien die tabellen niet bestaan in het schema, zijn de
patronen gedocumenteerd voor toekomstige introductie maar niet uitgerold.
Wanneer een van deze tabellen wordt toegevoegd, gebruik het patroon zoals
beschreven in `docs/fase2-batch-2d-recon.md` § Reports-cluster.

### Service-role pad
Alle drie de geraakte tabellen behouden volledige BYPASS RLS voor de
service-role. De automated runners (vat-report-engine, periodic VAT-cache
refresh) blijven ongewijzigd functioneren.

### Verificatie
```sql
SELECT tablename, cmd, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('vat_returns','vat_validations','vat_report_cache')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;
```

Resultaat: per tabel één policy per relevante cmd, geen overlap-ALLs meer.

### Bevestigde beslispunten
- **OB1:** DELETE op fiscale tabellen toegestaan voor zowel `tenant_admin`
  als `accountant` (geïmplementeerd voor `vat_validations`; `vat_returns`
  reeds zo via pre-2D-quickfix).
- **OB5:** Operations dashboards open voor alle tenant-rollen — niet van
  toepassing in deze batch want geen operations-tabellen bestaan. Wanneer
  toegevoegd in toekomst, patroon uitrollen.

### Vervolg
- 2D-ii (Settings cluster) — `tenant_settings`, `business_info`, shipping/tax
- 2D-iii (Platform-billing strict lockdown)
- 2D-iv (Edge-function role-checks voor export-pipeline)

---

## Batch 2D-ii — Settings RLS-aanscherping

**Datum:** 2026-06-09
**Bron:** docs/fase2-batch-2d-recon.md §5b-5e + bevestigde beslispunten
OB3 (vat_rates SELECT alle rollen), OB4 (shipping SELECT alle rollen),
OB6 (settings vs business-info scheiding), OB10 (tenants column-level
pragmatische RPC i.p.v. trigger).

### Tabellen-scan
| Tabel uit recon-scope | Bestaat? | Actie |
| --- | --- | --- |
| `tenant_settings` | nee | overgeslagen — algemene config zit als kolommen in `tenants` |
| `tenant_branding` | nee | overgeslagen — branding zit in `tenant_theme_settings` (al admin-only correct) |
| `tenant_email_settings` / `tenant_email_branding` | nee | overgeslagen — zit in `tenants` + `tenant_notification_settings` (al admin-only correct) |
| `tenant_invoice_settings` | nee | overgeslagen — kolommen in `tenants` |
| `tenant_shipping_zones` / `tenant_shipping_rates` | nee | overgeslagen — niet aanwezig |
| `shipping_methods` (top-level, niet `tenant_`-prefixed) | ja | beleid herschreven (zie hieronder) |
| `tenant_tax_zones` | nee | overgeslagen — niet aanwezig |
| `vat_rates` | ja | INSERT/UPDATE uitgebreid met `accountant` |
| `tenant_payment_terms` / `tenant_payment_methods` | nee | overgeslagen — payment-config staat in `tenants` (`payment_methods` jsonb) en in `tenant_oauth_credentials` |
| `tenant_locales` / `tenant_currencies` | nee | overgeslagen — locales in `tenants.languages` + per-tenant `translation_settings` |
| `tenant_return_settings` | ja | reeds rol-aware via pre-2D-quickfix (geen wijziging) |
| `translation_settings` | ja | reeds rol-aware via pre-2D-quickfix |
| `tenant_theme_settings` | ja | reeds rol-aware (`tenant_admin`-only voor schrijven, alle members lezen) |
| `tenant_theme_presets` | ja | idem — geen wijziging |
| `tenant_notification_settings` | ja | idem — geen wijziging |
| `tenant_newsletter_config` | ja | idem — geen wijziging |
| `tenant_tracking_settings` | ja | reeds correct (admin-ALL + tenant-members SELECT) |
| `tenant_odoo_settings` | ja | reeds rol-aware (`tenant_admin` + `accountant`) |
| `tenants` | ja | RLS ongewijzigd (`tenant_admin`-only UPDATE); accountant-pad via nieuwe RPC |

### Nieuwe / herschreven policies

**shipping_methods** — OB4
- DROP: oude `Admin/staff … shipping methods` + `Platform admins …` varianten
- NEW `shipping_methods_insert` (auth): `is_platform_admin OR (tenant-scope AND has_tenant_role([tenant_admin, accountant]))`
- NEW `shipping_methods_update` (auth): idem (USING + WITH CHECK)
- NEW `shipping_methods_delete` (auth): `is_platform_admin OR (tenant-scope AND has_tenant_role([tenant_admin]))`
- SELECT-policies onveranderd: tenant-scope alle rollen + platform_admin
- Storefront leest via service-role (BYPASS RLS) — onveranderd

**vat_rates** — OB3
- DROP: alle oude `Tenant admins …` + `Platform admins …` write-policies
- NEW `vat_rates_insert` (auth): tenant_admin + accountant
- NEW `vat_rates_update` (auth): tenant_admin + accountant
- NEW `vat_rates_delete` (auth): tenant_admin only
- SELECT-policies onveranderd: tenant-scope (+ globale rates) alle rollen + platform_admin

### tenants — pragmatische column-level (OB10)
- UPDATE-policy `Tenant admins can update their own tenant` blijft `tenant_admin` only.
- NIEUWE RPC `public.update_tenant_fiscal_info(_tenant_id, _vat_number, _iban, _bic, _swift, _kvk_number, _business_address, _business_city, _business_postal_code, _business_country)`:
  - `SECURITY DEFINER` met expliciete `search_path = public`
  - Interne rol-check via `has_tenant_role([tenant_admin, accountant])` (bevat platform_admin-bypass)
  - Werkt enkel de meegegeven fiscale kolommen bij via `COALESCE`; raakt branding/billing/payments NIET aan
  - `EXECUTE` granted aan `authenticated`; effectieve toegang gegated via interne check
- Frontend hookt accountants in via deze RPC; reguliere tenant-admin flow blijft `UPDATE public.tenants ...` gebruiken.
- Volledige split-table (`tenant_business_info`) volgt in H3 — interim acceptabel omdat:
  - accountant kan geen niet-fiscale kolommen muteren
  - geen extra trigger-complexiteit
  - eenvoudig terug te draaien wanneer H3 landt

### Service-role pad
Alle geraakte tabellen behouden BYPASS RLS voor service-role. Storefront
edge-functions (shipping-quote, checkout, vat-rate-lookup) blijven
ongewijzigd functioneren.

### Verificatie
```sql
SELECT tablename, cmd, COUNT(*) AS n
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('shipping_methods','vat_rates','tenants')
GROUP BY tablename, cmd ORDER BY tablename, cmd;
```
Verwacht: per cmd één policy (plus platform-admin-bypass voor `tenants`
SELECT/INSERT/UPDATE/DELETE die separaat is gedefinieerd).

### Bevestigde beslispunten
- **OB3** — `vat_rates` SELECT open voor alle tenant-rollen (incl. viewer, marketing).
- **OB4** — `shipping_methods` SELECT open voor alle tenant-rollen; storefront via service-role.
- **OB6** — Settings vs business-info: voor nu fiscale info als kolommen op `tenants`; H3 splitst naar `tenant_business_info`.
- **OB10** — Column-level via pragmatische `SECURITY DEFINER` RPC i.p.v. trigger of column-policies.

### Vervolg
- 2D-iii — Platform-billing strict lockdown
- 2D-iv — Edge-function role-checks voor export-pipeline

---

## Batch 2D-iii — Platform-billing strict lockdown

**Datum:** 2026-06-09
**Bron:** docs/fase2-batch-2d-recon.md §5f + bevestigde beslispunten OB2
(tenant_admin zelfservice voor platform_invoices) en OB9 (accountant mag
SaaS-subscription zien, niet wijzigen).

### Tabellen-scan
| Tabel | Bestaat? | Actie |
| --- | --- | --- |
| `platform_invoices` | ja | SELECT tenant-zelfservice aangescherpt naar `tenant_admin` only |
| `pending_platform_payments` | ja | SELECT tenant-zelfservice aangescherpt naar `tenant_admin` only |
| `subscriptions` | ja | SELECT → `tenant_admin` + `accountant`; UPDATE → `tenant_admin`; INSERT/DELETE → platform_admin |
| `subscription_invoices` | ja | SELECT → `tenant_admin` + `accountant`; INSERT/UPDATE/DELETE → platform_admin (was: tenant_admin kon UPDATE/DELETE) |
| `subscription_lines` | ja | SELECT → `tenant_admin` + `accountant`; writes → platform_admin (was: any tenant member ALL) |
| `subscription_notifications` | ja | SELECT → `tenant_admin` + `accountant`; writes → platform_admin (was: any tenant member ALL) |
| `tenant_feature_overrides` | ja | reeds `platform_admin` ALL — onveranderd |
| `admin_actions_log` | ja | reeds `platform_admin` only — onveranderd |
| `admin_billing_actions` | ja | reeds `platform_admin` ALL — onveranderd |
| `platform_changelogs` | ja | reeds `platform_admin` ALL — onveranderd |
| `platform_coupons` + `platform_coupon_redemptions` | ja | reeds `platform_admin` ALL — onveranderd |
| `platform_health_metrics` | ja | reeds `platform_admin` SELECT — onveranderd |
| `platform_incidents` | ja | reeds `platform_admin` ALL — onveranderd |
| `platform_quick_actions` | ja | reeds `platform_admin` ALL — onveranderd |
| `platform_settings` | ja | reeds `platform_admin` SELECT/UPDATE — onveranderd |
| `platform_subscriptions` | nee | overgeslagen — niet aanwezig (SaaS-subs zitten in `subscriptions`) |
| `platform_usage_metrics` | nee | overgeslagen — `platform_health_metrics` dekt het deel |
| `platform_credits` / `platform_credit_transactions` | nee | overgeslagen — niet aanwezig (AI-credits zitten in `tenant_ai_credits`) |
| `platform_promotions` / `platform_discount_codes` | nee | overgeslagen — `platform_coupons` dekt het |

### Nieuwe policies (kerngeval-samenvatting)

**Tenant-zelfservice SELECT (OB2):**
- `platform_invoices`: tenant_admin van eigen tenant
- `pending_platform_payments`: tenant_admin van eigen tenant
- `subscriptions`: tenant_admin + accountant van eigen tenant
- `subscription_invoices` / `_lines` / `_notifications`: via subscription→tenant_id, tenant_admin + accountant

**Tenant write toegestaan:**
- `subscriptions` UPDATE: tenant_admin (upgrade/downgrade zelfservice). Geen accountant — wijzigen is bestuur.

**Platform-admin only writes:**
- `platform_invoices`, `pending_platform_payments`, `subscriptions` (INSERT/DELETE), `subscription_invoices` (alle writes), `subscription_lines`/`_notifications` (alle writes).

### Stripe-webhook & billing-runner pad
Alle wijzigingen werken via `authenticated`-role policies. De
service-role (gebruikt door `stripe-webhook`, `platform-billing-runner`,
`generate-subscription-invoice` edge functies) behoudt impliciete
BYPASS RLS — geen functionele regressie te verwachten.

### Bevestigde beslispunten
- **OB2:** `platform_invoices` + `pending_platform_payments` zelfservice
  beperkt tot `tenant_admin`. Staff/viewer/marketing/warehouse/accountant
  hebben geen SELECT.
- **OB9:** `subscriptions` + `subscription_invoices` SELECT open voor
  `accountant` (voor budgettering). UPDATE blijft `tenant_admin`-only.

### UI-gating opvolg (voor latere H4-iteratie, geen code hier)
- `/admin/billing` route guard verificatie: resource-mapping in
  `useCan` matrix (`platform_billing`) staat al op `tenant_admin` +
  `accountant` voor read, `tenant_admin` only voor write. Dit lijnt met
  de nieuwe RLS-policies. Geen extra wijziging nodig.
- Wanneer accountant /admin/billing opent zal subscriptions zichtbaar
  zijn (SELECT toegestaan) maar de upgrade-knop moet via PermissionGate
  `write platform_billing` worden verborgen — al gehandled in H4b/c.

### Verificatie
```sql
SELECT tablename, cmd, COUNT(*) AS n
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('platform_invoices','pending_platform_payments',
                    'subscriptions','subscription_invoices',
                    'subscription_lines','subscription_notifications')
GROUP BY tablename, cmd ORDER BY tablename, cmd;
```

### Vervolg
- 2D-iv — Edge-function role-checks voor export-pipeline + admin acties

## Batch 2D-iv — Reports/Settings/Billing edge-function role-checks

_Datum: 2026-06-09_

### Sweep — gevonden functies + classificatie

| Functie | Pad | Status |
|---|---|---|
| `export-vat-xlsx` | tenant-user (admin-trigger) | **role-check toegevoegd** |
| `export-vat-pdf` | tenant-user (admin-trigger) | **role-check toegevoegd** |
| `export-vat-xml` | tenant-user (admin-trigger) | **role-check toegevoegd** |
| `export-ic-listing-xml` | tenant-user (admin-trigger) | **role-check toegevoegd** |
| `export-odoo-csv` | tenant-user (admin-trigger) | **role-check toegevoegd** |
| `export-q-bundle` | tenant-user (admin-trigger) | **role-check toegevoegd (OB7: staff niet)** |
| `vat-report-engine` | tenant-user + service-role (callees) | **role-check toegevoegd (service-role bypass intact)** |
| `validate-vat` | was anonymous → nu tenant-user (admin-only) | **OB8: dichtgezet** |
| `warmup-vat-cache` | service-role / cron + platform_admin trigger | ongewijzigd (cron-pad) |
| `regression-test-vat` | dev/admin-tool | ongewijzigd (intern) |
| `backfill-vat-regimes` | one-shot admin | ongewijzigd (low-risk) |
| `resolve-vat-regime` | utility, gebruikt in checkout-flow | ongewijzigd (anonymous storefront-pad vereist) |
| `platform-gift-month` | platform_admin only | reeds gehard in pre-2D quickfix |

### Per gewijzigde functie

- `export-vat-xlsx`, `export-vat-pdf`, `export-vat-xml`,
  `export-ic-listing-xml`, `export-odoo-csv`, `vat-report-engine`:
  `requireRole(auth, body.tenant_id, ['tenant_admin', 'accountant'])`.
- `export-q-bundle`:
  `requireRole(auth, body.tenant_id, ['tenant_admin', 'accountant'])`
  — **OB7 bevestigd: `staff` uitgesloten** uit Q-Pakket export.
- `validate-vat` (OB8):
  - `verify_jwt = false` regel uit `supabase/config.toml` verwijderd
    → function vereist nu een geldige JWT (platform default).
  - Body-handler roept `authenticateRequest(req)` aan en weigert (403)
    wanneer de gebruiker geen `tenant_admin`, `staff` of `accountant`
    rol heeft in eender welke tenant.
  - Platform-admin en service-role bypassen via `authenticateRequest`.
  - **Rate-limiting / storefront-API routing voor anonymous B2B-checkout
    is uitgesteld** (zie TODO hieronder); admin-UI gebruikt nu het
    auth-pad direct via `supabase.functions.invoke('validate-vat', …)`.

### Niet aangeraakt (bewust)

- `storefront-api` — anonymous storefront-pad blijft intact.
- Stripe / billing webhooks — signature-auth.
- `resolve-vat-regime` — utility, ook tijdens checkout.
- `warmup-vat-cache`, `backfill-vat-regimes`, `regression-test-vat` —
  cron of one-shot admin-trigger; geen extra rol-gating noodzakelijk.

### Niet bestaand in repo (masterplan-stubs)

`oss-report-engine`, `generate-oss-report`, `intervat-xml-exporter`
(functie heet `export-vat-xml`), `intrastat-report`,
`financial-report-runner`, `operations-report-engine`,
`run-operations-report`, `export-orders`, `export-customers`,
`export-jobs-runner`, `sync-vat-rates`, `update-tenant-branding`,
`update-tenant-settings`, `rotate-tenant-keys`, `regenerate-api-keys`,
`platform-billing-runner`, `stripe-billing-webhook`.
→ Wanneer deze functies later worden toegevoegd, gebruik dezelfde
`requireRole`-pattern uit dit bestand als template.

### Config.toml-wijzigingen

| Functie | Vorige `verify_jwt` | Nieuw |
|---|---|---|
| `validate-vat` | `false` (anonymous) | **standaard `true`** (regel verwijderd) |

Alle andere gewijzigde functies behouden hun bestaande config — auth
wordt in-code afgedwongen via `authenticateRequest` + `requireRole`
(consistent met overige admin-functies in deze codebase).

### Beslispunten

- **OB7** bevestigd: `staff` mag **geen** Q-Pakket / Q-bundle ZIP
  exporteren — alleen `tenant_admin` + `accountant` (+ platform_admin).
- **OB8** bevestigd: `validate-vat` dichtgezet voor anonymous callers,
  admin-only via auth-pad. Storefront B2B-checkout-validatie loopt voor
  nu nog niet via een aparte anonymous route — TODO voor volgende
  iteratie: `storefront-api` action `validate_vat` met rate-limit per
  session (max 10 calls / 5 min).

### TODO (volgende iteratie)

- `storefront-api` action `validate_vat` met sessie-rate-limit voor
  anonymous B2B-checkout-BTW-validatie.
- Wanneer reports/settings/branding-edge-functions worden gebouwd,
  `requireRole` direct meenemen volgens dit document.

---

## Batch 2F-i — Marketing + Loyalty + SEO dormant lockdown (2026-06-09)

**Recon:** `docs/fase2-batch-2f-recon.md` — sub-volgorde Marketing-extras + Loyalty-restant + SEO.

### Resultaat per tabel

| Tabel | Bestaat | Status vóór | Status na |
|---|---|---|---|
| `loyalty_referrals` | nee | — | overgeslagen (niet in schema) |
| `loyalty_rewards` | nee | — | overgeslagen (niet in schema) |
| `loyalty_redemptions` | nee | — | overgeslagen (niet in schema) |
| `seo_competitor_data` | nee | — | overgeslagen (niet in schema) |
| `loyalty_programs` | ja | reeds gehard 2C2a-ii | ongewijzigd |
| `loyalty_tiers` | ja | reeds gehard 2C2a-ii | ongewijzigd |
| `customer_loyalty` | ja | reeds gehard 2C2a-ii | ongewijzigd |
| `loyalty_transactions` | ja | SELECT/UPDATE/DELETE via has_tenant_role join; geen platform_admin lees-bypass, geen expliciete service-role policy | + `loyalty_transactions_select_platform_admin` (platform_admin SELECT bypass)<br>+ `loyalty_transactions_service_role_all` (service-role ALL) |
| `tenant_loyalty_rewards` | ja | enige policy: `platform_admin ALL` — tenant-leden konden niets lezen | DROP platform_admin policy →<br>+ `tenant_loyalty_rewards_select_members` (tenant-leden + platform_admin)<br>+ `tenant_loyalty_rewards_insert_service` (tenant_admin/staff + platform_admin)<br>+ `tenant_loyalty_rewards_update_admin`<br>+ `tenant_loyalty_rewards_delete_admin`<br>+ `tenant_loyalty_rewards_service_role_all` |
| `seo_search_console_data` | ja | SELECT = elke tenant-rol via `get_user_tenant_ids` (te ruim, geen rol-discriminatie) | DROP oude SELECT/UPDATE/DELETE →<br>+ `seo_search_console_select_members` (tenant_admin/staff/marketing/viewer/accountant per OB-2F-8)<br>+ `seo_search_console_update_admin`<br>+ `seo_search_console_delete_admin`<br>+ `seo_search_console_service_role_all` |
| `seo_analysis_history` | ja | SELECT + INSERT voor elke tenant-lid, geen UPDATE/DELETE policy, geen service-role bypass | DROP oude SELECT/INSERT →<br>+ `seo_analysis_history_select_members` (tenant_admin/staff/marketing/viewer/accountant)<br>+ `seo_analysis_history_insert_admin` (tenant_admin/marketing — audit-runner triggert via service-role)<br>+ `seo_analysis_history_delete_admin`<br>+ `seo_analysis_history_service_role_all` |
| `seo_scores`, `seo_audit_results`, `seo_web_vitals`, `seo_keywords`, `seo_competitors`, `seo_competitor_keywords`, `seo_scheduled_audits` | ja | reeds rol-aware (SELECT members + admin/marketing schrijfrechten) | ongewijzigd |

### Beslispunten bevestigd

- **OB-2F-7 (Loyalty log-pattern):** Bevestigd. `loyalty_transactions` blijft service-role/admin schrijvend; correcties via `tenant_admin` UPDATE/DELETE behouden. Platform_admin lees-bypass toegevoegd voor support-flows.
- **OB-2F-8 (SEO marketing/staff/viewer SELECT):** Bevestigd. `seo_search_console_data` en `seo_analysis_history` SELECT toegankelijk voor `tenant_admin`, `staff`, `marketing`, `viewer`, `accountant`. Geen PII, externe API-data.

### Verificatie

```
SELECT tablename, cmd, COUNT(*) FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('loyalty_transactions','tenant_loyalty_rewards',
                    'seo_search_console_data','seo_analysis_history')
GROUP BY tablename, cmd ORDER BY tablename, cmd;
```

Resultaat:
- `loyalty_transactions`: ALL(1) DELETE(1) SELECT(2) UPDATE(1) — geen INSERT (log-pattern via service-role)
- `tenant_loyalty_rewards`: ALL(1) DELETE(1) INSERT(1) SELECT(1) UPDATE(1)
- `seo_search_console_data`: ALL(1) DELETE(1) SELECT(1) UPDATE(1) — geen INSERT (log-pattern via service-role)
- `seo_analysis_history`: ALL(1) DELETE(1) INSERT(1) SELECT(1)

### Marketing-extras

Recon §Marketing-extras: n=0 niet-rol-aware tabellen. Volledig gehard in eerdere batches 2C2a-i t/m iv. Geen aanvullende actie vereist in 2F-i.

### Service-role bypass

Alle vier gewijzigde tabellen hebben nu een expliciete `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy. Edge functions die met `SUPABASE_SERVICE_ROLE_KEY` connecten (audit-runner, search-console-sync, loyalty-trigger) blijven werken.


---

## Batch 2F-ii — Procurement / Payment / Integrations dormant lockdown

**Datum:** 2026-06-09
**Migration:** `20260609083923_batch_2f_ii.sql`

### Gehard in deze batch (9 tabellen)

| Tabel | Cluster | Oude policies | Nieuwe policies |
|---|---|---|---|
| `payment_confirmations` | Payment-extras | 1 (SELECT tenant_id-only) | 4 (members SELECT, admin/accountant UPDATE, admin DELETE, service-role ALL) |
| `sync_activity_log` | Integrations | 4 tenant-blind (public) | 4 (log-pattern + service-role) |
| `sync_conflicts` | Integrations | 2 tenant-blind (public ALL) | 4 (log-pattern + service-role) |
| `sync_queue` | Integrations | 2 tenant-blind (public ALL) | 4 (log-pattern + service-role) |
| `inventory_sync_log` | Integrations | 1 (public SELECT) | 4 (log-pattern + service-role) |
| `odoo_customer_sync_log` | Integrations | 3 public (INSERT/SELECT/UPDATE) | 4 (log-pattern + service-role) |
| `odoo_invoice_sync_log` | Integrations | 3 public (INSERT/SELECT/UPDATE) | 4 (log-pattern + service-role) |
| `webhook_deliveries` | Integrations | 2 public | 4 (log-pattern + service-role) |
| `storefront_webhooks` | Integrations (config) | 2 public (ALL + SELECT) | 5 (admin manage + members SELECT + service-role) |

**Patroon log-tabellen:** SELECT = `tenant_admin/staff/accountant`; UPDATE/DELETE = `tenant_admin` only; INSERT alleen via service-role (sync-runners). Geen INSERT-policy voor authenticated users — schrijven via edge functions met service-role.

**Patroon storefront_webhooks (config):** SELECT = `tenant_admin/staff/accountant`; INSERT/UPDATE/DELETE = `tenant_admin`; service-role ALL.

### Reeds gehard in eerdere batches (geen wijziging)

| Tabel | Cluster | Reden |
|---|---|---|
| `suppliers`, `supplier_documents` | Procurement | Hardened met Finance-role policies in eerdere batch (2C / 2D) |
| `purchase_orders`, `purchase_order_items` | Procurement | Hardened met Finance/warehouse policies |
| `product_suppliers` | Procurement | Hardened met Finance policies |
| `shipping_integrations` | Integrations | Hardened met `si_*_tenant_admin` policies |
| `tenant_oauth_credentials` | Integrations | **OB-2F-6 bevestigd**: reeds strict `tenant_admin`-only (toc_select/insert/update/delete_tenant_admin) — bevat OAuth refresh tokens |
| `payment_reminders` | Payment | Reeds Finance-role policies |
| `pending_platform_payments` | Payment | Reeds platform_admin ALL + tenant SELECT |

### Niet aanwezig in schema (recon-fictie / masterplan-only)

`supplier_invoices`, `supplier_payments`, `vendor_contracts`, `rfqs`, `purchase_requisitions`, `payment_gateways`, `payment_provider_configs`, `chargeback_log`, `chargeback_disputes`, `tenant_payment_gateway_settings`, `sync_jobs`, `sync_job_logs`, `webhook_logs` — niet gecreëerd in publieke schema, geen action.

### Service-role pad behouden

Alle 9 gewijzigde tabellen hebben expliciete `FOR ALL TO service_role USING (true) WITH CHECK (true)`. Kritieke flows blijven werken:
- Stripe-webhook → `payment_confirmations` insert/update via service-role
- Bol.com/Shopify sync-runners → `sync_queue`, `sync_activity_log`, `sync_conflicts`, `inventory_sync_log` insert via service-role
- Odoo sync-runners → `odoo_*_sync_log` insert/update via service-role
- Headless webhook delivery → `webhook_deliveries` insert via service-role
- OAuth refresh-runners → `tenant_oauth_credentials` update via service-role (reeds aanwezig)

### Beslispunten bevestigd

- **OB-2F-6**: `tenant_oauth_credentials` blijft strict `tenant_admin`-only voor alle CRUD (geen staff/accountant SELECT). Reeds gehard, geen wijziging nodig.

---

## Hygiene — secrets-management pass

_Datum: 2026-06-09_

### .env hygiene applied
- `.gitignore` uitgebreid met `.env`, `.env.local`, `.env.*.local`.
- `.env.example` toegevoegd (dummy waardes voor 5 publieke Supabase vars).
- Lokale `.env` blijft bestaan en werkend; **handmatige actie voor Akke**: `git rm --cached .env` om het bestand uit version control te halen zonder de lokale kopie te verwijderen.

### Sweep result — hardcoded secrets in repo

Grep over `*.ts`, `*.tsx`, `*.toml`, `*.json` (excl. `node_modules`), filter op niet-`Deno.env.get`-matches:

| Categorie | Patroon | Hardcoded gevonden |
|---|---|---|
| Service-role | `SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE_KEY` | **0** |
| Stripe secret | `STRIPE_SECRET_KEY`, `STRIPE_LIVE_KEY`, `sk_live_...` | **0** (alleen `Deno.env.get` + error-strings met de naam) |
| Email providers | `RESEND_API_KEY`, `MIGADU_API_KEY`, `CLOUDFLARE_API_TOKEN` | **0** (alleen `Deno.env.get` + error-strings) |
| Webhook secrets | `WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` | **0** |
| OAuth secrets | `BOL_CLIENT_SECRET`, `SHOPIFY_API_SECRET`, `META_APP_SECRET` | **0** |
| Raw live key | `sk_live_[A-Za-z0-9]{20,}` (alle bestandstypes) | **0** |

**Conclusie:** repo is schoon. Alle private secrets worden uitsluitend via `Deno.env.get()` gelezen in edge functions; geen rotatie nodig.

### Documentatie
- `docs/secrets-management.md` aangemaakt met: inventory (publiek vs privaat), add/rotate flow, onboarding-stappen.

### Git history (commit 779602a)
- Bevat alleen publieke anon-keys + project URL/ID — geen acute lek.
- Geen BFG/filter-branch uitgevoerd (per beslissing: praktische impact = low, force-push risico hoog).

### Status
Hygiene-pass voltooid. Geen secret-rotaties nodig.

## Hoofdstuk Team-Invite — Batch INV-1 schema + audit-log infra
Datum: 2026-06-09

### Wijzigingen
- **Enum `public.invite_status`** aangemaakt — waardes: `pending`, `accepted`, `expired`, `revoked`, `rejected`. Geen naming-conflict (OB-INV-7 bevestigd).
- **`team_invitations`** uitgebreid met 4 kolommen:
  - `status invite_status NOT NULL DEFAULT 'pending'`
  - `last_reminder_sent_at TIMESTAMPTZ NULL`
  - `revoked_at TIMESTAMPTZ NULL`
  - `revoked_by UUID NULL → auth.users(id) ON DELETE SET NULL`
- **Backfill resultaat**: 5 bestaande rijen → `accepted` (alle hadden `accepted_at`). 0 → `expired`. 0 → `pending`.
- **pg_cron job `expire-invitations`** geactiveerd: daily `0 3 * * *` UTC, zet `pending` met `expires_at < NOW()` naar `expired`. Idempotent geïnstalleerd (unschedule → schedule). Optie B gekozen (cron) — robuust, geen complexe triggers.
- **`invite_audit_log` tabel** aangemaakt (OB-INV-2 bevestigd: aparte tabel ipv `admin_actions_log`):
  - kolommen: `id`, `invitation_id` (FK CASCADE), `tenant_id` (FK CASCADE), `event_type` (CHECK: sent/accepted/rejected/expired/revoked/reminded/resent), `actor_user_id`, `actor_email`, `metadata JSONB`, `created_at`.
  - 3 indexes: invitation_id, tenant_id, created_at DESC.
  - GRANT SELECT to authenticated, ALL to service_role.
  - RLS enabled, 2 SELECT policies (tenant_admin van eigen tenant + platform_admin). Geen INSERT/UPDATE/DELETE policies — schrijven enkel via edge functions (service-role).
- **`team_invitations` policy toegevoegd**: `platform_admin_select_invitations` (FOR SELECT, `is_platform_admin(auth.uid())`). Bestaande tenant-admin policy ongewijzigd.
- **Helper-functie `public.get_invitation_effective_status(uuid)`** — SECURITY DEFINER, STABLE — berekent live status (defensief voor edge cases waar cron nog niet heeft gelopen).

### Verificatie post-migration
- Enum aanwezig ✓
- pg_cron job `expire-invitations` geregistreerd ✓
- Status-counts: `accepted=5` (geen pending/expired in test-data) ✓
- RLS-policies op `invite_audit_log`: `tenant_admin_select_invite_audit`, `platform_admin_select_invite_audit` ✓

### Status
Batch INV-1 voltooid. Klaar voor Batch INV-2 (edge functions: send/fetch/accept/revoke/resend met audit-log writes).

## Batch INV-2 — Edge functions
Datum: 2026-06-09

### Wijzigingen per functie

**`send-team-invitation` (UPDATE)**
- Bestaande `authenticateRequest` + tenant/platform-admin authorisatie bevestigd.
- Na succesvolle `INSERT team_invitations`: extra fetch van inviter `profiles.full_name` voor email-greeting en audit-metadata.
- Email-intro toont nu "<inviter> heeft je uitgenodigd om als <rol> …" wanneer beschikbaar.
- Nieuwe `invite_audit_log` entry met `event_type='sent'` + metadata `{email, role, invited_by_name}` — service-role bypass voor RLS.

**`fetch-invitation` (UPDATE)**
- Status-bepaling vervangen door RPC `public.get_invitation_effective_status(inv_id)` met inline fallback bij RPC-fout.
- Response uitgebreid met: `tenantId`, `mailboxConfirmed` (alias van `accountExists` voor INV-3 frontend), `invitedByName` (uit `profiles.full_name` via `invited_by`).
- `accountExists` blijft aanwezig (backwards-compat).
- Geen audit-log writes (read-only).

**`accept-team-invitation` (UPDATE)**
- Refactor naar gestructureerde `jsonResponse(status, body)` helper voor accurate HTTP-codes (was alles 400).
- Server-side re-fetch van invitation per `token` (geen client-payload vertrouwen).
- Defensive status-checks in volgorde:
  - `accepted_at IS NOT NULL` → **409** "Reeds geaccepteerd"
  - `status IN ('revoked','rejected')` → **410** "Uitnodiging ingetrokken"
  - `expires_at < NOW()` → **410** "Verlopen"
- **KRITIEK** — email-match check: vergelijk `auth.getUser(jwt).user.email` (case-insensitive) met `invitation.email`. Mismatch → **403** met `code: 'EMAIL_MISMATCH'`.
- Bestaande "reeds lid"-check behouden → **409**.
- `UPDATE team_invitations SET accepted_at=NOW(), status='accepted'`.
- Nieuwe `invite_audit_log` entry `event_type='accepted'` met `actor_user_id`, `actor_email`, metadata `{role, tenant_id}`.
- Response bevat `tenantId` + `tenantName` + `role` voor frontend redirect.

**`revoke-team-invitation` (NIEUW)**
- Auth: `authenticateRequest` + `requireRole(auth, tenant_id, ['tenant_admin'])` (platform-admin bypasst automatisch).
- Body: `{ invitation_id }`.
- Fetch invitation → 404 indien afwezig.
- Status-guard: alleen `status='pending'` mag worden ingetrokken → **400** met `currentStatus` veld bij andere status.
- `UPDATE team_invitations SET status='revoked', revoked_at=NOW(), revoked_by=auth.user_id`.
- Audit-log entry `event_type='revoked'`.

**`resend-team-invitation` (NIEUW)**
- Auth: identiek aan revoke (tenant_admin/platform_admin).
- Body: `{ invitation_id }`.
- Status-guard: `accepted` → **409**, `revoked` → **410**.
- `UPDATE team_invitations SET status='pending', expires_at=NOW()+7d, last_reminder_sent_at=NULL`.
- Verzendt nieuwe email via Resend (zelfde sjabloon als send, met "Herinnering" preheader + intro).
- Audit-log entry `event_type='resent'` met metadata `{previous_expires_at, new_expires_at, email, role}`.

### `supabase/config.toml`
- Geen wijzigingen nodig: Lovable-managed edge functions deployen by default met `verify_jwt = false`. De twee nieuwe functies (`revoke-team-invitation`, `resend-team-invitation`) voeren JWT-validatie zelf uit via `authenticateRequest` — consistent met `send-team-invitation` en `remove-team-member`.

### Audit-log writes — overzicht
| Functie | event_type | actor |
|---|---|---|
| send-team-invitation | sent | auth.user_id |
| accept-team-invitation | accepted | acceptende user |
| revoke-team-invitation | revoked | auth.user_id |
| resend-team-invitation | resent | auth.user_id |
| (cron `expire-invitations`) | — (geen log; alleen status-update) | — |

### Status
Batch INV-2 voltooid. Klaar voor Batch INV-3 (frontend state-machine refactor + nieuwe componenten voor revoke/resend acties + paden a–g).

---

## Batch INV-3 — Frontend state-machine + componenten

**Datum:** 2026-06-09

### Wijzigingen

- **`src/pages/AcceptInvitation.tsx`** — volledig herschreven naar `FlowState`
  discriminated union (15 states). Paden a–g geïmplementeerd:
  - `loading`, `not_found`, `expired`, `revoked`, `already_accepted`,
    `already_member`
  - `wrong_account` (pad g) → enkel "Uitloggen en doorgaan" knop
    (geen "Naar dashboard" meer)
  - `login_required` (pad d) → e-mail disabled, wachtwoord + "Wachtwoord
    vergeten" link
  - `otp_request` → `otp_verify` → `set_password` (pad e, 3 stappen) met
    `signInWithOtp` + `verifyOtp` + `updateUser({password})`. 30s resend
    cooldown, gemaskeerde e-mail in code-bevestiging.
  - `one_click_accept` (pad f) → enkele knop voor reeds-ingelogde matchende
    gebruiker.
  - `accepting` → auto-invoke `accept-team-invitation`; mapt 403/409/410
    responses terug naar de juiste state (incl. `EMAIL_MISMATCH`).
  - `success` → bevestiging + auto-redirect na 3s.
  - `error` → "Probeer opnieuw" + support-link.
  - Oude `showRegister` / `handleRegister` / `emailConfirmationSent`
    verwijderd.

- **`src/hooks/useTeamInvitations.ts`** — uitgebreid:
  - Nieuw `UseTeamInvitationsOptions { statusFilter }` (default `'pending'`,
    `'all'` voor TenantInvitationsList).
  - `TeamInvitation` interface uitgebreid met `status`, `revoked_at`,
    `revoked_by`, `last_reminder_sent_at`.
  - `revokeInvitation` (optimistic update + rollback) via nieuwe
    `revoke-team-invitation` edge function.
  - `resendInvitation` aangepast: roept nu `resend-team-invitation` edge
    function aan i.p.v. delete+create (behoudt audit-trail + token).
  - `cancelInvitation` blijft als alias naar `revokeInvitation`
    (backwards compat).

- **`src/components/admin/settings/InviteTeamMemberDialog.tsx`** —
  real-time email-check via debounced (300ms) `check-invite-email` call.
  4 banner-states: groen (account bestaat, één-klik), rood (al lid,
  knop disabled), oranje (pending invite, "Verzend opnieuw" knop), blauw
  (nieuw account via code-verificatie). Knop disabled bij `alreadyMember`.

- **`src/components/admin/settings/TenantInvitationsList.tsx`** (NIEUW) —
  vervangt inline invitation-rij in TeamSettings. Tabs `Alle | Pending |
  Accepted | Expired | Revoked` met counts. Status-badges met semantische
  kleuren. 3-puntjes-dropdown per rij: pending → Opnieuw verzenden +
  Intrekken (met AlertDialog confirm); expired/revoked/rejected →
  Opnieuw uitnodigen. Responsive: extra kolommen verborgen onder md.

- **`src/components/admin/settings/TeamSettings.tsx`** — pending-invitations
  rijen verwijderd uit de members-tabel (was inline rendering); de losse
  `<TenantInvitationsList />` wordt nu onder de leden-card gerenderd.

- **`supabase/functions/check-invite-email/index.ts`** (NIEUW) — admin-only
  edge function (`requireRole tenant_admin`); returnt `{ accountExists,
  alreadyMember, hasPendingInvite, pendingInviteId, userId }` voor het
  dialog-banner-systeem. Lookup via `profiles.email ilike` +
  `user_roles(user_id, tenant_id)` + `team_invitations(status='pending'
  AND expires_at > now())`.

- **`supabase/functions/resend-team-invitation/index.ts`** — vroege return
  op `status='revoked'` verwijderd: revoked / expired / rejected /
  pending mogen nu allemaal worden gereactiveerd (reset naar
  `status='pending'` + nieuwe `expires_at` +7d) zodat "Opnieuw uitnodigen"
  vanuit `TenantInvitationsList` werkt voor non-accepted statussen.
  Accepted blijft 409.

### Status
Batch INV-3 voltooid. Klaar voor Batch INV-4 (email-templates polish +
branding-hooks) en INV-5 (regressie-test paden a–g).

---

## Batch INV-4+5 — Email-template polish + regressie-test (2026-06-09)

### Email-templates
- `send-team-invitation`: rol-uitleg-mapping uitgelijnd met recon §3
  (accountant → "Toegang tot financiële gegevens en facturatie";
  warehouse → "Kan voorraad beheren, verzendingen verwerken";
  marketing TOEGEVOEGD → "Campagnes, kortingen, ads, CMS en SEO";
  viewer → "Alleen lezen. Kan alles bekijken maar niets wijzigen").
  `invitedByName` regel ("<Naam> heeft je uitgenodigd…") al sinds INV-2
  aanwezig, hier geverifieerd.
- `resend-team-invitation`: hergebruikt `renderSellqoEmail` template met
  herinneringskoptekst ("Herinnering: …", "We hebben de uitnodiging
  zojuist opnieuw verstuurd en verlengd"). Zelfde rol-mapping-update
  toegepast.
- **Handmatige post-deploy actie voor Akke**: Supabase Dashboard → Auth →
  Email Templates → "Magic Link" customizen met SellQo-branding voor
  OTP-flow (pad E). Voorgestelde NL-tekst gedocumenteerd in
  `docs/team-invite-eindrapport.md` §Handmatige acties #1.

### Regressie + eindrapport
- `docs/team-invite-test-checklist.md` gemaakt — 7 paden (A–G) +
  7 edge cases + audit-log queries + performance-baseline-tabel.
- `docs/team-invite-eindrapport.md` gemaakt — scope, opgeloste issues,
  architectuur, 8 beslispunten, handmatige acties, backlog.

**Status:** Team Invite-flow refactor AFGESLOTEN — 2026-06-09.

---

## Invite-flow bug-fix: auth-state refresh post-accept — 2026-06-09

**Probleem:** Na succesvolle `accept-team-invitation` INSERT in
`user_roles` server-side, navigeerde de client direct naar `/admin`.
`useCan` leest rollen uit `AuthProvider`-state (geen react-query),
en die state was nog de pré-insert snapshot → user kreeg `/no-access`
of een lege sidebar tot manuele page-refresh. Race-condition tussen
server-side write en client-side roles-cache.

**Fix:**
1. `useAuth()` exporteert nu `refetchRoles()` — herhaalt de
   `select * from user_roles where user_id = …` en update context-state.
2. In `AcceptInvitation.tsx` success-effect:
   `await supabase.auth.refreshSession()` → `await refetchRoles()` →
   `window.location.href = '/admin'` (volle browser-navigatie als
   pragmatic fallback voor eventuele andere caches).
3. RoleSimulator-bug-list: eerste-login-na-invite vereist deze
   refresh-stap; gedocumenteerd hier.


## Email sender architecture refactor — 2026-06-09

**Doel:** Vervang hardcoded `noreply@sellqo.app` overal door 14 dedicated mailboxes,
gescheiden in Stream A (Platform → Tenant-users, NL) en Stream B (Tenant → Customers).

**Wijzigingen:**
- NIEUW: `supabase/functions/_shared/emailSenders.ts` — `EMAIL_SENDERS` registry
  met 5 vaste Stream-A configs (`invite`, `billing`, `notifications`, `security`,
  `noReply`) en 7 Stream-B factories (`orders`, `invoices`, `quotes`, `returns`,
  `giftCards`, `marketing`, `customerService`). Factories ontvangen
  `(tenantName, tenantReplyTo?)` en sanitizen de naam (geen `<>`, `"`, controlechars,
  max 80 tekens). `replyTo` fallt automatisch terug op `support@sellqo.app`.
- 13 edge functions ge-refactored om `EMAIL_SENDERS` te gebruiken:
  Stream A: `send-team-invitation`, `resend-team-invitation`,
  `send-trial-expiry-warning`, `create-notification`.
  Stream B: `send-order-confirmation`, `send-invoice-email`,
  `send-credit-note-email`, `send-quote-email`, `send-return-email`,
  `send-gift-card-email`, `send-campaign-batch`, `send-customer-message`,
  `automation-scheduler`.
- `send-test-email`: nieuwe optionele `sender?: SenderKey` parameter zodat
  admin-UI per stream een testmail kan versturen (default `customerService`).
- `send-campaign-batch`: tenant-select uitgebreid met `owner_email` voor
  reply-to-resolutie.
- `send-customer-message`: hardcoded `"noreply@sellqo.app"` fallback voor
  `replyToEmail` vervangen door `"support@sellqo.app"`.
- Geen DNS-werk vereist — `sellqo.app` is geverifieerd in Resend; alle 14
  mailboxes routeren via hetzelfde geverifieerde domain.
- Documentatie: `docs/email-architecture.md` met sender-tabel,
  Stream A/B-rationale, body-taal vs sender-taal scheiding, Resend-status
  en backlog (per-tenant verified domains).

**Storefront-inbound (`inbox@sellqo.app`) ongewijzigd.**

## Email design system — Batch EMAIL-1 — 2026-06-09

**Doel:** Email-templates standaardiseren via gedeelde building blocks +
dark-mode support, zodat Stream A & Stream B emails consistente branding
en cross-client rendering hebben.

**Wijzigingen:**
- `supabase/functions/_shared/sellqoEmail.ts` uitgebreid met 8 building
  blocks (`emailHeader`, `emailFooter`, `emailButton`, `emailInfoBox`,
  `emailDivider`, `emailTable`, `emailAddressBlock`, `emailHeading`,
  `emailParagraph`) + `emailBaseLayout` (volledige `<html>`-wrapper met
  `@media (prefers-color-scheme: dark)` overrides).
- `BRAND` tokens + `LOGO_URL` nu exported voor hergebruik in Stream B.
- `renderSellqoEmail` herschreven om de nieuwe blocks te gebruiken;
  backwards-compatible met alle bestaande callers.
- Nieuwe opties: `infoBox.variant` (`info`/`success`/`warning`/`danger`),
  `secondaryCta`, `supportEmail`, `unsubscribeUrl`, `darkMode`.
- Interne HTML-escapers (`escapeHtml`/`escapeAttr`) voor user-supplied
  plain-text in headings/buttons/info-boxes/addresses.
- `send-trial-expiry-warning` gepolijst met `variant: "warning"` info-box
  en secondary CTA "Of neem contact op".
- `send-team-invitation`, `resend-team-invitation`, `create-notification`,
  `send-trial-expiry-warning` blijven `renderSellqoEmail` gebruiken en
  krijgen automatisch dark-mode + nieuwe footer (legal + support-mail).
- Plain-text fallback was reeds aanwezig via `htmlToPlainText` —
  ongewijzigd.
- Documentatie: `docs/email-design-system.md` met architecture-overview,
  building-block-tabel, color-tokens, dark-mode strategie en
  developer-guide.
- **Logo URL gemigreerd** van `sellqo.lovable.app/email-logo.png` naar
  `sellqo.app/email-logo.png` (asset bestaat in `public/email-logo.png`
  en wordt mee-gebuild). Geen handmatige asset-upload nodig.
- Meta-tags `color-scheme` + `supported-color-schemes` aanwezig in
  `emailBaseLayout` voor Gmail-iOS / Apple Mail dark-mode detectie.
- Plain-text fallback bevestigd in alle 3 Stream A functies
  (`send-team-invitation`, `send-trial-expiry-warning`,
  `create-notification`) via `htmlToPlainText(html)` als `text`-parameter
  aan `resend.emails.send()`.

## Email design system — Batch EMAIL-2 (2026-06-09)

Stream B (Tenant → Customer) gedeelde util + i18n + refactor van 8 customer-
facing edge functions.

### Nieuwe shared modules

- `supabase/functions/_shared/tenantEmail.ts` (NIEUW, parallel aan
  `sellqoEmail.ts`):
  - `getTenantBrand(supabase, tenantId)` — JOIN `tenants` +
    `tenant_theme_settings`, sanitized fallbacks (logo, kleuren, locale).
  - `renderTenantEmail(opts)` — wrapper op `emailBaseLayout` met tenant-
    branded header + footer, dark-mode erfgenaam, `{ html, text }`.
  - Template-helpers: `renderOrderLineItems`, `renderInvoiceLineItems`,
    `renderQuoteLineItems`, `renderAddressBlocks`,
    `renderTotalsBreakdown`, `renderPaymentInstructions`,
    `renderTrackingInfo`, `renderGiftCardVisual`.
  - `resolveEmailLocale()` — explicit > customer > tenant-domain > country
    → `en`.
  - Sanitization: hex-color regex, http(s) URL regex, locale whitelist.

- `supabase/functions/_shared/tenantEmailI18n.ts` (NIEUW):
  - 4 locales (NL/EN/FR/DE) × 8 templates (order, invoice, creditNote,
    return, giftCard, quote, message, campaign).
  - `t(locale, path, vars?)` helper met `{var}` interpolation.

### Refactored edge functions

| Functie                       | Wat verdwenen                                  | Wat erbij                           |
| ----------------------------- | ---------------------------------------------- | ----------------------------------- |
| `send-order-confirmation`     | ~150r `wrapHtml` + `buildItemsTable` + locale-maps | `getTenantBrand` + `renderTenantEmail` + 3 helpers |
| `send-invoice-email`          | ~100r `emailHtml` template-string              | `renderTenantEmail` + summary-block + plain-text |
| `send-credit-note-email`      | ~20r inline `<html>` skelet                    | `renderTenantEmail` + i18n         |
| `send-quote-email`            | ~100r `emailHtml` template-string              | `renderTenantEmail` + behouden VAT |
| `send-return-email`           | `wrapHtml` (~40r)                              | `renderTenantEmail` rond bestaande event-bodies |
| `send-gift-card-email`        | ~100r `emailHtml` + handcrafted code-box      | `renderGiftCardVisual` + i18n      |
| `send-customer-message`       | ~80r `emailHtml`                               | `renderTenantEmail` + List-Unsubscribe behouden |
| `send-campaign-batch`         | bare wrapping                                  | `renderTenantEmail` met **verplichte** `unsubscribeUrl` + `List-Unsubscribe` header |

Totaal: ~600r HTML duplicate verwijderd; alle 8 functies leveren nu
`text`-fallback via `htmlToPlainText` (geërfd via `renderTenantEmail`).

### Edge cases (code-comments in `tenantEmail.ts`)

- `tenant_theme_settings.logo_url` NULL → SellQo logo fallback
- Malformed hex (`red`, `#zzz`) → sanitized naar `BRAND.primary`
- Locale niet ondersteund → `en`
- Geen `customer.locale` → tenant default → country heuristic → `en`
- Marketing zonder `unsubscribeUrl` → footer toont geen link
  (`send-campaign-batch` zet 'm altijd, anti-spam wet)

### Dark-mode + "Powered by SellQo"

- Stream B erft `prefers-color-scheme: dark` CSS overrides via
  `emailBaseLayout` (geen extra werk).
- Footer toont default "Mogelijk gemaakt door SellQo / Powered by SellQo /
  Propulsé par SellQo / Bereitgestellt von SellQo" (locale-aware).
  Backlog: `tenant_theme_settings.show_sellqo_branding` kolom voor
  enterprise opt-out.

### Documentatie

- `docs/email-design-system.md`: Stream B sectie toegevoegd met
  fallback-tabel, helper-overzicht, i18n-strategie en edge-cases.

---

## Bug-fix: invite-spinner hangt oneindig (2026-06-10)

- Race-condition tussen `authLoading` + `resolvedTokenRef` cache opgelost in `src/pages/AcceptInvitation.tsx`.
- `useEffect` wacht nu op `authLoading === false` vóór het zetten van `resolvedTokenRef.current = key`. Hierdoor wordt de ref nooit geprimeerd met een "user=null tijdens laden"-key, wat er voor zorgde dat de spinner oneindig bleef staan wanneer auth pas later resolved.
- Overbodige `if (authLoading) return;` verwijderd uit `resolveFlow` (afgeschaft in het callback zelf; de guard zit nu in de enige call-site, het `useEffect`).
- **Test-verwachting:** incognito invite-link toont binnen ~1s juiste state (login_required of otp_request); ingelogde user toont one_click_accept zonder hangende spinner; hard-refresh tijdens fetch blijft niet hangen.

Datum: 2026-06-10

---

## Auth Email Hook — custom Resend route

**Datum:** 2026-06-10

Optie B gekozen (custom Resend-route i.p.v. Lovable Cloud email-domain delegatie) zodat alle 6 Supabase auth-emails consistent via `no-reply@sellqo.app` lopen — gelijk aan bestaande Stream A senders in `_shared/emailSenders.ts`. Geen DNS-werk, geen `LOVABLE_API_KEY`, geen email-domain provisioning.

**Geleverd:**
- `supabase/functions/_shared/email-templates/index.ts` — 6 NL-templates (magic-link, signup, recovery, invite, email-change, reauthentication) bovenop bestaande `renderSellqoEmail()` building blocks (SellQo branding + dark-mode CSS + bulletproof MSO buttons + plain-text fallback via `htmlToPlainText`).
  - *Implementatie-nuance:* `.ts` i.p.v. `.tsx` — de SellQo email-stack is string-based (geen React Email), dus geen JSX nodig. Consistent met `sellqoEmail.ts` / `tenantEmail.ts`.
- `supabase/functions/auth-email-hook/index.ts` — verifieert Standard-Webhooks signature van Supabase Auth (`svix-id` / `svix-timestamp` / `svix-signature` headers) via `standardwebhooks@1.0.0`, rendert template, en verstuurt via Resend SDK met `EMAIL_SENDERS.noReply.from` (`SellQo <no-reply@sellqo.app>`).
- `supabase/config.toml` — `[functions.auth-email-hook] verify_jwt = false` (Supabase Auth roept zelf aan; auth-check gebeurt via hook-secret, niet via JWT).
- Secret `AUTH_EMAIL_HOOK_SECRET` aangemaakt en in env beschikbaar voor de hook.
  - *Naamgeving:* niet `SUPABASE_AUTH_HOOK_SECRET` — `SUPABASE_*` prefix is gereserveerd door Lovable Cloud voor managed secrets.

**Activatie (handmatige stap door operator, buiten code):**
1. Kopieer de hook-URL: `https://<project-ref>.supabase.co/functions/v1/auth-email-hook`
2. Auth → Hooks → "Send Email Hook" → URL + de hook-secret invullen (zelfde waarde als `AUTH_EMAIL_HOOK_SECRET`).
3. Vanaf dat moment lopen alle 6 auth-emails via SellQo-branded templates met sender `no-reply@sellqo.app` (was: `no-reply@auth.lovable.cloud`).

**Architectuur-consistentie:**
- Geen breaking changes nodig aan `docs/email-architecture.md`: Stream A blijft `no-reply@sellqo.app` voor platform→tenant-user communicatie. Auth-emails vallen nu netjes binnen die scope.
- Hergebruikt bestaande `RESEND_API_KEY` en `EMAIL_SENDERS` registry; geen aparte sender-pool.

## Auth Email Templates — Lovable Managed via auth.sellqo.app
Datum: 2026-06-11

- Custom auth-email-hook (Optie B) niet activeerbaar: Lovable Cloud blokkeert Supabase Auth Hooks UI voor end-users. Overgestapt naar Optie A1: Lovable Managed via subdomein-delegatie.
- DNS (Cloudflare, zone sellqo.app): NS auth → ns3+ns4.lovable.cloud, TXT _lovable-email (verify-token). Lovable's voorgestelde _dmarc (p=none, rua naar lovable.dev) initieel bewust overgeslagen: tweede DMARC-record zou invalid zijn en de dekking voor alle 14 Resend-mailboxes breken.
- Root cause langdurige "Pending"-status (24u+): dode provisioning-job aan Lovable-zijde. Zone-serial bevroren op 2406600055 ondanks correcte DNS en meerdere reconcile-triggers. _dmarc-mismatch als oorzaak gefalsifieerd via tijdelijke exact-match test (geen effect). Opgelost via domein verwijderen + opnieuw toevoegen met Entri/Cloudflare-autorisatie → verse provisioning-job, serial 2406649578, zone gevuld.
- Stream C draait op Mailgun EU via Lovable — derde gescheiden mail-infra naast Migadu (mailboxen) en Resend (Stream A+B).
- Sender-display: toggle "Show as sent from @sellqo.app" actief, niet aanpasbaar. Outlook toont "namens"-notatie (noreply=sellqo.app@auth.sellqo.app namens noreply@sellqo.app). Cosmetisch, geaccepteerd; backlog-item aangemaakt.
- DMARC na verificatie teruggedraaid naar p=quarantine (rua=mailto:dmarc@sellqo.app). Hertest 11/6 ±11u50: badge verified gebleven + OTP-flow succesvol — quarantine-policy en Lovable Managed zijn compatibel (relaxed alignment, default).
- Team-invites blijven bewust Stream A (invite@sellqo.app via Resend): custom flow met team_invitations-tabel, geen Supabase auth-email. One-click accept bij actieve sessie is correct INV-gedrag.
- Cleanup uitgevoerd: supabase/functions/auth-email-hook/ verwijderd, [functions.auth-email-hook] uit config.toml verwijderd, secrets AUTH_EMAIL_HOOK_SECRET + SUPABASE_AUTH_HOOK_SECRET verwijderd. _shared/email-templates/index.ts behouden als referentie.
- Pre-flight Mancini reconnect: info@mancinimilano.com = tenant_admin op 2606c5b9; tenants.stripe_account_id = NULL, onboarding_complete = false. Stripe-reconnect-mail naar Sander verstuurd op 2026-06-11.

---

## AI-vertaalknop fix: credits-bypass + transparantie + coverage-stats (2026-06-25)

### Root cause

AI-vertaalknop faalde met generieke toast "Fout bij vertalen". Network-tab: POST naar ai-translate-content gaf 402 (Payment Required) — function draaide wél, use_ai_credits gaf false. DB-check VanXcel (54f6b480): available=275, is_internal_tenant=false; bulk vereiste tot 705 credits (47 producten × 5 velden × 3 talen). Twee oorzaken: (1) platform_admin viel onder de tenant-credit-limiet omdat de check tenant- i.p.v. rol-gebaseerd is, en is_internal_tenant nergens geseed is naar true (dode "platform owner onbeperkt"-logica); (2) geen transparantie — credits/kosten nergens zichtbaar vóór de actie.

### Wijzigingen

- supabase/functions/ai-translate-content/index.ts: auth-result opgevangen; credit-check + 402 gewikkeld in `if (!auth.is_platform_admin)`; 402 geeft nu gestructureerde body `{ error: "insufficient_credits", message, creditsNeeded }`. Bypass bewust op edge-niveau (RPC draait service-role, kent auth.uid() niet).
- src/hooks/useAICredits.ts: isUnlimited = is_internal_tenant === true || isPlatformAdmin (via useAuth); translation:1 toegevoegd aan getCreditCost.
- src/hooks/useTranslations.ts: 402-detectie → onInsufficientCredits callback i.p.v. harde navigate; stats-query filtert op is_active=true. Coverage teller/noemer scope gelijkgetrokken: teller telt nu alleen translated_content van ACTIEVE product/category-entiteiten binnen de FIELD_CONFIGS-velden (inScope-helper); coverage defensief gecapt op 100 (totaal + per taal).
- src/pages/admin/TranslationHub.tsx: AICreditsBadge naast Bulk Vertalen; kostpreview in bulk-confirm (formule velden × talen × cost, matcht edge function exact) met disabled bevestiger + koop-link bij onvoldoende credits; per-entity knop disabled + tooltip met kost; bovenste card → "Totale dekking (alle content)", tabel → "Dekking per item"; CreditPurchaseDialog gerenderd; CTA-route /admin/marketing/ai?purchase=open.

### Test-verwachting

- Als platform_admin: vertaalknop werkt zonder credit-aftrek, badge toont onbeperkt.
- Als tenant zonder genoeg credits: duidelijke "Onvoldoende AI credits"-toast + "Credits kopen"-CTA die de purchase-dialog opent; bulk-bevestiger disabled met kostpreview.
- Coverage bovenbalk en per-item dekking blijven consistent, ook na deactiveren/verwijderen van producten (geen >100% meer).

### Status

Live. Geverifieerd via shallow clone post-flight (commit "Credits preview toegevoegd").

### Backlog (rest-schuld, niet blokkerend)

- .limit(50) in edge-function bulk: tenants met >50 actieve producten bereiken nooit 100% in één run (nu n.v.t., VanXcel=47). Bulk in batches splitsen.
- Dubbele use_ai_credits overload (2-arg + 5-arg) blijft bestaan — latente PostgREST-ambiguïteit, opruimen in aparte batch.
- is_internal_tenant nooit geseed: per-rol bypass dekt platform_admin, maar een tenant écht onbeperkt maken (bv. Loveke) vereist expliciete vlag.

## Bol VVB — labelcrop hersteld + track & trace backfill — 2026-07-04

### Root cause
1. **Labelcrop schaalde volledige bronpagina.** `cropToLabel()` in `create-bol-vvb-label` nam de hele A4 bron (bpost: 842×595pt landscape, label in top-left ±404×284pt) en scale-to-fitte die op het doelformaat → mini-label. `dymo_lw_4xl` stond bovendien op 102×210mm (289×595pt) i.p.v. de werkelijke Dymo S0904980 rol (104×159mm).
2. **T&T-backfill sloot te veel uit.** `LABEL-PDF-RETRY` selecteerde enkel labels zonder `label_url`, en `create-bol-vvb-label` retry-mode early-returnde zodra `label_url` bestond → labels mét PDF maar zonder tracking werden nooit gehercheckt. bpost wijst `X-Track-And-Trace-Code` echter vaak minuten ná labelcreatie toe.
3. **Deadlock op process-status timeout.** Als de 45s poll timeoutte bleef het label `pending` + `external_id NULL`; elke retry-selector vereiste `external_id`, en VVB-RETRY sloeg de order over omdat er al een actief label bestond → order permanent stuck.

### Fixes
- `cropToLabel` cropt nu naar top-left labelzone (430×310pt voor landscape bpost, halve pagina + marge voor portrait PostNL), roteert 90° als dat het doel beter vult, en centreert. Vector, geen kwaliteitsverlies. `dymo_lw_4xl` = 294.8×450.7pt (104×159mm).
- Retry-mode in `create-bol-vvb-label`: early-return alleen als zowel `label_url` als `tracking_number` bestaan; PDF-fetch overgeslagen (`needsPdf`-guard) wanneer PDF er al is, maar de HEAD-tracking-lookup blijft draaien.
- `sync-bol-orders`: nieuw `TRACKING-BACKFILL` blok (HEAD per label, max 10/cycle, 14 dagen window) vult ontbrekende T&T-codes en synct naar `orders.tracking_number`.
- `sync-bol-orders`: nieuw `STUCK-LABEL-CLEANUP` blok markeert `pending`-labels ouder dan 15 min zonder `external_id` als `error`, waarna VVB-RETRY hetzelfde cycle een vers label aanmaakt. Zodra dat vers label een `transporterLabelId` krijgt, zet de bestaande code de order op `shipped` en confirmt bij Bol.

### Verificatie
- Recrop `dymo_lw_4xl` op order C0008RNFFX: label vult 104mm rolbreedte, barcode CD124283919BE + datamatrix scherp en volledig.
- Recrop `a6`: label vult A6, niets geclipt.
- Handmatige sync-run: `[TRACKING-BACKFILL]` en `[STUCK-LABEL-CLEANUP]` logs verschijnen; tracking wordt bijgewerkt op `shipping_labels` én `orders`.
- Regressie: nieuwe VVB-labels via UI doorlopen normale flow (label + tracking + shipped + Bol confirm).

## QR verbergen op mobiel (tenant-toggle) — 2026-07-10

### Root cause
Op een smartphone kan een klant de EPC-QR-code niet scannen met hetzelfde toestel (bank-app en QR staan op één scherm). De QR is dan visuele ruis; klant heeft alleen IBAN/bedrag/mededeling nodig. Tot nu toe was er geen manier om dit per-tenant te sturen.

### Wat
- Nieuwe kolom `public.tenants.bank_transfer_hide_qr_mobile boolean NOT NULL DEFAULT false`. Default = false → géén gedragswijziging voor bestaande tenants.
- Backend-gestuurde onderdrukking via User-Agent-detectie in `storefront-api`. `qr_data` wordt `null` gezet wanneer `isMobile && hideQrMobile`. `bank_details` (IBAN/BIC/mededeling/rekeninghouder) blijft ALTIJD gevuld.
- Sellqo-core storefront (`ShopQRPayment.tsx`) gemigreerd van lokale `generateEPCString`-generatie naar het canonieke `qr_data`-contract — dezelfde flow die VanXcel/Mancini al gebruiken. Opgeloste tech debt: één contract, één source of truth voor QR-payload.

### Bestanden
- Migratie: kolom toegevoegd aan `tenants`.
- `supabase/functions/storefront-api/index.ts`:
  - Helper `isMobileUserAgent()` (bij PROMOTION UTILS).
  - `checkoutComplete` tenant-select uitgebreid met `bank_transfer_hide_qr_mobile`.
  - `bank_transfer`-return: `qr_data: suppressQr ? null : { … }`.
  - Serve-handler: `userAgent = req.headers.get('user-agent') ?? ''` één keer, en meegeven aan `checkout_complete` / `checkout_place_order` / `checkout_create_session` via `{ ...params, user_agent: userAgent }`.
  - Legacy `checkoutPlaceOrder` → `checkoutComplete` propagatie van `user_agent`.
- `src/components/admin/settings/TransactionFeeSettings.tsx`: interface + defaults + loadConfig `.select` + loaded object + saveConfig payload + sub-rij `<Switch>` met kopij "QR-code verbergen op mobiel", enkel zichtbaar als bankoverschrijving enabled.
- `src/pages/storefront/ShopCheckout.tsx`: `qrData: result.qr_data` toegevoegd aan navigatie-state.
- `src/pages/storefront/ShopQRPayment.tsx`: `generateEPCString`-import + lokale EPC-generatie verwijderd; leest nu `qrData.payload` uit `location.state`. Als `payload` ontbreekt → QR-blok + scan-instructies volledig weggelaten, manuele gegevens worden hoofdweergave.

### Custom frontends
0 custom frontends aangeraakt. VanXcel + Mancini renderen `qr_data.payload` al uit het backend-contract → toggle werkt daar automatisch zodra deze tenants 'm aanzetten. Backend-only werking bevestigd.

---

## CHANNEL-1: verkoopkanalen zichtbaar in Odoo — 15 juli 2026

**Root cause:** boekhouder kan Bol-uitbetalingen (netto, na commissie) niet matchen tegen facturen omdat alle B2C-verkopen onder één verzamelpartner ("Diverse particulieren") boeken, zonder kanaal-onderscheid. Reconciliatie = gokken met percentages.

**Uitgevoerd:** kanaal-resolutie per factuur (marketplace_source prioritair boven sales_channel — recon toonde 33/44 Bol-orders met fout sales_channel='webshop'; alleen recente 11 correct), per-kanaal verzamelpartner in Odoo (find-or-create, gecached in tenant_odoo_settings.channel_partner_ids), kanaalnaam als ref op élke move (ook B2B), alias-beheer in Boekhouding-tab (channel_aliases jsonb), fallback naar bestaande dummy-partner bij onbekend kanaal. Batch-fetch van orders in de sync (geen N+1).

**Vangst uit recon:** sales_channel onbetrouwbaar voor historische Bol-imports; marketplace_source is de bron van waarheid. Historische 33 zijn gepre-seed, dus geen voorwaartse impact. Eerste recon via Lovable-connector: SQL nu rechtstreeks door Claude uitvoerbaar.

**Vervolg:** ODOO-POST-1 (auto-boeken-toggle, 2026.07f) direct erna geland — concept-modus beschikbaar per tenant. Parallelweek: BCC-concepten (INV-2026-0146 t/m 0153+) opruimen in Odoo bij het leegmaken van invoice_bcc_email ~21/7. Praktijktest kanaal-partner: eerstvolgende Bol-order moet onder "Bol.com verkopen — VanXcel" boeken.

## INV-DOC-1 + CN-AUTO-1 + CN-CALC — Complete documenten & automatische creditnota's — 2026-07-10

**Wat:** (A) Abonnementsfacturen krijgen nu PDF (generate-subscription-invoice-pdf, pdf-lib) + UBL (via generate-peppol-ubl), gegenereerd vóór charge/mail zodat bijlagen kloppen; backfill-modus voor bestaande facturen; mail laat de bijlage-zin weg als er geen document is. (B) Creditnota's ontstaan automatisch op het inspected-moment van een retour (kanaal-onafhankelijk — óók Bol, waar geld buiten onze Stripe om loopt), pro-rata op geaccepteerde aantallen (received_quantity), met process-refund als safety-net voor terugbetalingen zonder retour; harde idempotency via unique indexes op return_id/stripe_refund_id. (C) BTW-dubbeltelling in de handmatige creditnota-dialog gefixt + server-side plafond: nooit meer crediteren dan resterend crediteerbaar.

**Bewijs:** backfill → 4/4 abonnementsfacturen met PDF; testretour Demo Bakkerij → CN-2026-0001 (€-29,99) automatisch geboren uit inspectie, genummerd, gemaild; volledige creditering INV-2026-0002 toont/boekt exact €12,10 (was €14,20).

**Bugs & vondsten:**
- Trigger stond eerst op 'approved' (= retourverzoek goedgekeurd, goederen nog bij klant) — verplaatst naar 'inspected' (ná aankomst + controle), conform het boekhoudkundige feit. Marktplaats-inzicht: creditnota volgt de retour-beslissing, nooit de geldbeweging (Bol betaalt buiten ons om).
- Kolomronde #3: refund_reason/return_number bestonden niet (echt: return_reason, rma_number) — schema-audit ving het vóór runtime.
- Deploy-gap #4 (generate-subscription-invoice-pdf) — deploy-tijdstip-check is nu onvoorwaardelijke stap vóór elke hertest. Backfill-lus logt voortaan HTTP-status + response-body per gefaalde factuur.
- CreditNoteDialog telde vat_amount op bij een al-bruto line_total → €2,10 te veel. Onderliggend: invoice_lines.line_total inconsistent opgeslagen (soms netto, soms bruto) — reconstructie via unit_price×qty+vat_amount is de betrouwbare weg; normalisatie-migratie op de backlog.
- Guard-kiertje: plafond geldt (bewust, scope) nog niet voor auto-CN's — meenemen in CN-VOID-1.

**Open:** REPORT-FIX-1 (processing/unpaid onzichtbaar in BTW-rapport — prompt klaar), CN-VOID-1 (annuleren i.p.v. verwijderen + plafond op alle CN's), ODOO-1 (wacht op 5 Odoo-antwoorden), PEPPOL via Odoo, partial-acceptatie + idempotency-hertest CN.

## Settlement-baseline SEPA smoke-facturen + fix INV-2026-0002 — 14 juli 2026

**Root cause:** het initiële-charge-pad (subscription-invoice, vermoedelijk de handmatig getriggerde variant) maakt de off-session SEPA-PI correct aan met metadata (invoice_id/tenant_id/subscription_id, géén retry_attempt) maar zet de factuur níét op `processing`. INV-2026-0002 bleef daardoor op `sent` met next_action_at = 7/8 in de dunning-pijplijn staan, terwijl er al een SEPA liep (pi_3Tquu02NSrtUWC0r0keNQQIp, 8/7 12:48) → dubbele-charge-risico. Cronruns van 06:00 (0003/0005) zetten de status wél correct — twee paden, één bug. Uitzoeken ná settlement-week, zelfde familie als charge_attempts die op 0 blijft bij initiële charge.

**Fix:** 0002 handmatig op `processing` + next_action_at = null (guard op 'sent', idempotent herbevestigd). Dunning-cron selecteert enkel unpaid/sent (geverifieerd in code) → processing-facturen zijn veilig.

**Baseline (before-stand voor slotbewijs):**
- pi_3Tquu02... → INV-2026-0002 (metadata-bevestigd) — processing
- pi_3TrB0D2... → INV-2026-0003 (timestamp-match 9/7 06:00) — processing
- pi_3TsGQu2... → INV-2026-0005 (timestamp-match 12/7 06:00) — processing
- Alle drie: paid_at null, charge_attempts 0
- INV-2026-0001: sent, geen PI, dunning 7/8 → opruimlijst
- INV-2026-0004: sent, €35,09, next_action 20/7 = dunning level 3 canary ✓

**Slotbewijs bij settlement:** 3× processing → paid + paid_at gevuld + `[SUB-CHARGE-WEBHOOK] Invoice marked paid` in platform-stripe-webhook-logs (filteren op PI-id). Webhook-handler idempotent geverifieerd: paid wordt nooit overschreven, late failed kan paid niet terugzetten.

## Pre-seed VanXcel Odoo-sync — 14 juli 2026

**Root cause (preventief):** sync-odoo-invoices dedupt uitsluitend op sync_status = 'synced'. Het overdrachtsplan ('historical' als sync_status) zou de dedup gemist hebben → 128 facturen + 1 credit note als duplicaat in Verkoopdagboek VanXcel bij toggle-aan. Markering verhuisd naar sync_direction = 'historical' (vrije string, nergens als filter gebruikt — geverifieerd in functions + src).

**Uitgevoerd:** 128 facturen (107 paid, 21 sent) + 1 credit note (sent) gepre-seed als synced/historical met peppol_status 'skipped' en pre-seed-notitie in peppol_note. Insert idempotent (not exists-guard). Natrek: 128+1 bevestigd, nul push-rijen → cron heeft nooit gesynct, toggle stond uit.

**Vangst uit recon:** de overdracht sprak van 149+ facturen; werkelijke sync-scope is 128 (rest valt buiten ISSUED_STATUSES). De credit note zat niet in het oorspronkelijke plan — zonder recon een gegarandeerd duplicaat.

**Backlog-notitie:** candidates-query heeft .limit(200) zonder order by → non-deterministisch zodra VanXcel >200 issued documenten heeft. Zelfde familie als .limit(50)-item.

**Vervolg:** toggle aan (journal "Verkoopdagboek VanXcel", B2C-aggregatie AAN) → eerste cron-run natrekken (verwacht 0/0) → week parallel met BCC (BCC-mails in Odoo NIET verwerken, zelfde dagboek = dubbelboeking) → daarna tenants.invoice_bcc_email leegmaken.

**Slotbewijs (14/7, 22:17 lokaal):** eerste cron-run mét toggle aan (jobid 70, 20:17 UTC, succeeded) → nul push-rijen in sync_log (synced noch failed), Verkoopdagboek VanXcel onaangeroerd. Dedup bewezen op volledige productie-set. Parallelweek gestart 14/7 → BCC-mails in Odoo niet verwerken; rond 21/7 tenants.invoice_bcc_email leegmaken.

## PEPPOL-2/3: vocabulaire-sanering + Odoo-gating + marketing — 15 juli 2026

**Root cause:** drie schrijvers (generate-invoice, generate-peppol-ubl, generate-credit-note) hanteerden elk een eigen peppol_status-vocabulaire en de UI las een vierde ('pending'/'sent') dat in de data niet voorkwam (142× not_applicable, 2× archive_only, 0× pending). Filter en badges konden daardoor nooit iets tonen. Daarnaast praatten de native Peppol-stack en de Odoo-sync niet met elkaar: Odoo-verzending liet invoices.peppol_status onaangeroerd → risico op dubbele verzending en een eeuwig groeiende pending-teller.

**Batch A (backend):** canoniek vocabulaire (not_applicable / archive_only / pending / sent / manual_action) + CHECK-constraints (validated), Odoo write-back naar invoices én credit_notes (met .neq-guard tegen downgrade van 'sent'), credit_notes.peppol_sent_at toegevoegd, tenant_odoo_settings.peppol_send_enabled (default true) gate't beide tryPeppolSend-call-sites.

**Batch B (UI/marketing):** badges voor alle statussen, filter "Peppol-actie vereist" op pending+manual_action over facturen én credit notes, Boekhouding-tab achter checkFeature('odoo_sync') (pro/enterprise, migratie op pricing_plans.features), peppol_send_enabled-toggle + Peppol-aandacht-kaart in Boekhouding-tab, PeppolSettings uit de feature-gate (peppol_id voedt UBL die elk plan heeft), BTW-waarschuwing op B2B-klantformulier (non-blocking), €12 peppol-add-on incl. hasUrgency van de landing verwijderd, odoo_sync-label op pricing.

**Beslissing:** Peppol-verzending loopt via de tenant zijn eigen Odoo — Sellqo verkoopt de kóppeling (vanaf Pro €79), niet de compliance. UBL-download blijft in alle plannen als handmatige compliance-route. Directe Peppol-API (access point) geparkeerd als PEPPOL-FUTURE.

**Recon-lessen:** (1) customer_type is 'b2b'/'b2c', niet 'business' — eerdere "0 B2B zonder BTW" was vals negatief door foute filterwaarde; gecorrigeerd: 2 gevallen, beide demo/intern. (2) pricing_plans.id is de tekstuele key, geen UUID.

**Open:** PEPPOL-4 opruimbatch (PeppolUpgradeCard, create-addon-checkout peppol-pad, backfill-ubl-archive evalueren, 'peppol' feature-key uitfaseren) + pricing-label evt. verrijken met "(incl. Peppol e-facturatie)".

## ODOO-POST-1: auto-boeken-toggle (concept-modus) — 15 juli 2026

**Root cause:** sommige boekhouders willen gesyncte facturen eerst reviewen vóór boeking, maar action_post zat hardcoded in sync-odoo-invoices. Extra koppeling: Odoo kan alleen gebóékte facturen via Peppol versturen — zonder toggle dus geen legitieme concept-workflow mogelijk.

**Uitgevoerd:** migratie tenant_odoo_settings.odoo_auto_post boolean NOT NULL DEFAULT true (20260715194706, IF NOT EXISTS); sync-odoo-invoices laadt autoPost in SyncCtx en slaat action_post over bij false, in béíde paden (invoice + credit note); in concept-modus krijgen B2B-documenten met BTW-nummer peppol_status 'manual' met verklarende note, B2C blijft 'skipped' zodat de bron-peppol_status niet muteert; UI-toggle in Boekhouding-tab, Peppol-switch disabled + amber-toelichting bij autoPost=false (Peppol vereist auto-boeken); i18n 4-talig (admin + landing); changelog 2026.07f (odoo_draft_mode).

**Natrek (16/7 via connector):** kolom bestaat, beide tenants (VanXcel + Sellqo intern) op true → default = exact het bestaande gedrag, geen risico voor de lopende parallelweek.

## LANG-UI-1: flagless language switcher + changelog-gat 2026.07d — 15/16 juli 2026

**Root cause:** vlag-emoji's zijn geen correcte taalindicatoren (een NL-vlag staat niet voor Nederlands in België) en de oude inline flag-switcher schaalde slecht. Daarnaast bleef bij de run van 15/7 de changelog-slottaak liggen: versienummer 2026.07d ontbrak tussen 07c en 07e.

**Uitgevoerd:** LandingLanguageSwitcher herbouwd als shadcn DropdownMenu met Globe-icoon en endoniemen (Nederlands / English / Français / Deutsch), Check-indicator op de actieve taal, compact-variant met taalcode; aria-label via i18n-key landing.nav.languageSelect in 4 talen. Op 16/7 het changelog-gat gedicht: entry 2026.07d (language_switcher, improvement) in PublicChangelog.tsx + i18n-teksten in landing.{nl,en,fr,de}.json onder public.changelog.changes.

## Role-audit backfill — 16 juli 2026

**Root cause:** vijf documentatie-entries (INV-DOC-1, Settlement-baseline SEPA, Pre-seed VanXcel, PEPPOL-2/3, plus het pre-seed-slotbewijs) werden als losse Lovable-chatberichten aangeleverd zonder expliciete append-instructie en zijn daardoor nooit in dit bestand geland; alleen appends met "append to docs/role-audit.md" als opdracht (zoals CHANNEL-1) kwamen door.

**Uitgevoerd:** de vijf teksten verbatim gerecoverd uit de Lovable-berichthistorie en hierboven in chronologische volgorde toegevoegd, samen met verse entries voor ODOO-POST-1 en LANG-UI-1. Werkregel voortaan: elke role-audit-entry gaat als expliciete append-opdracht ("DOCUMENTATION ONLY — append to docs/role-audit.md") naar Lovable, nooit als los contextbericht.

**Vervolg:** entries voor ODOO-1, ODOO-2 (per-tenant connecties), REPORT-FIX-1 en de VERT/MARKETING-batches van 15/7 ontbreken nog — backfillen zodra gereconstrueerd (ROLE-AUDIT-BACKFILL-2).

## STATS-1: verkoopstatistieken gesaneerd — 16 juli 2026

**Root cause:** de dashboard- en analytics-cijfers klopten op meerdere plekken niet meer met elkaar. `useTodayLiveFeed` gebruikte de 20-item feed óók als bron voor de omzet-tegel — dus zodra er meer dan 20 orders op één dag binnenkwamen (typisch een piekdag met Bol.com-import) miste je alles daarboven. Verder liep "paid + not cancelled" (echte omzet-orders) door elkaar met "alle orders excl. cancelled" (order-count) waardoor de gemiddelde orderwaarde met de verkeerde noemer werd berekend. De Analytics-pagina toonde daarnaast een all-time klantentotaal naast periode-omzet en periode-orders — appels met peren. In de queries zelf zat een 1000-rijen-cap van PostgREST die zonder paginering stilletjes cijfers afkapte. Bovenop dat alles was de `stats`-JSON-blob op `marketplace_connections` verouderd: VanXcel Bol toonde 46 waar de live-count 44 was, en 33 Bol-orders hadden een `sales_channel` die niet naar bol_com resolvede. In de klantgroei zaten importklanten mee (102 op één dag, 150 op een andere) waardoor de trend meer over Bol-syncs ging dan over echte registraties.

**Uitgevoerd:** één canonieke waarheidsmodule `src/lib/salesStats.ts` met `isCountableOrder` (niet geannuleerd), `isRevenueOrder` (betaald én niet geannuleerd), `resolveOrderChannel` (marketplace_source-first) en een `fetchAllRows`-paginator. Today-widget stats losgekoppeld van de feed en apart gequeryd voor vandaag en gisteren. `useAnalytics` gebruikt overal dezelfde filters, AOV berekent zich op de revenue-order-count, en alle grote queries lopen via `fetchAllRows`. Nieuwe kolom `customers.acquisition_source` met data-gedreven backfill (Bol → 'bol_com', Shopify-import → 'shopify_import', rest NULL); creation-call-sites gemarkeerd met 'manual' (CRM), 'webshop' (checkout + newsletter subscribe), 'bol_com' (Bol-import), 'shopify_import' (Shopify-import). Today-tegel "Nieuwe klanten" en de Analytics-klantgroei tellen voortaan alleen echte registraties (NULL of niet-import) via een `.or()`-filter zodat NULL meetelt. Vierde Today-tegel "Subscribers" toegevoegd en de klantgroei-grafiek kreeg een tweede serie voor nieuwe email_subscribed=true per dag. Marketplace-widget en Marketplaces-overzicht lezen niet meer uit `connection.stats` maar tellen live per `marketplace_connection_id` (excl. cancelled) — VanXcel toont nu correct 44.

## SUBS-FIX-1: import-klanten niet langer auto-subscribed — 16 juli 2026

Root cause: `customers.email_subscribed` heeft default `true`, en de order-imports (Bol/Shopify) zetten dat veld niet expliciet op de insert. Gevolg: elke geïmporteerde marketplace-klant kwam als subscriber het systeem in — vervuilde de subscribers-stats (STATS-1B) en is GDPR-technisch fout omdat er nooit opt-in gegeven is.

Fix: expliciet `email_subscribed: false` toegevoegd op de customers-insert in `sync-bol-orders` en `sync-shopify-orders`. `sync-shopify-customers` blijft ongewijzigd omdat daar `accepts_marketing` al vanuit Shopify gemapt wordt en dat de leidende consent-bron is. Bestaande vervuiling (48 records) is via SQL gecorrigeerd met guard op `email_subscribed_at IS NULL`, zodat echte webshop-opt-ins met een timestamp intact bleven.

Addendum (zelfde dag): sync-shopify-customers bleek email_subscribed tóch niet te zetten (accepts_marketing gaat naar een eigen kolom) — insert-tak zet nu email_subscribed op basis van de Shopify accepts_marketing-consent; update-tak bewust ongemoeid.

Datum: 2026-07-16

## STATS-1C: Connect-overzicht en leesbare grafieken — 16 juli 2026

Root cause: Odoo (tenant_odoo_settings.odoo_sync_enabled) telde nergens mee als "actieve connectie" in Connect en de dashboard-widget — VanXcel zag daardoor "1" i.p.v. "2". Shopify stond bovendien als marktplaats-kaart op /admin/connect terwijl het een eenmalige import is (geen shopify-rijen in marketplace_connections platform-breed). In Analytics werden lange productnamen in 120px afgeknot en clipten pie-labels buiten de kaart; 'returned' was onvertaald.

Wijzigingen:
- `src/pages/admin/Marketplaces.tsx`: Odoo-status (configured + odoo_sync_enabled) telt mee in stat "Actieve Connecties"; 'shopify' verwijderd uit marktplaatsen-grid.
- `src/components/admin/marketplace/DashboardMarketplaceWidget.tsx`: extra "Odoo Boekhouding"-rij (Calculator-icoon, groen) met synced document-count uit `odoo_invoice_sync_log` en recentste `synced_at`; linkt naar `/admin/connect?tab=accounting`. Lege staat toont enkel als er ook geen Odoo-koppeling is; CardDescription telt Odoo mee.
- `src/pages/admin/Import.tsx`: nieuwe "Shopify importeren"-kaart opent de bestaande `ConnectMarketplaceDialog` met `marketplaceType='shopify'` (flow zelf ongemoeid).
- `src/pages/admin/Analytics.tsx`: top-producten Y-as width 170 + tick-truncatie op 28 tekens met '…'; tooltip toont volledige naam + omzet + aantal stuks. Pie-labels verwijderd (info via legende + tooltip); STATUS_LABELS/COLORS aangevuld met `returned` en `refunded`.
- Publieke changelog: entry `2026.07h` (connect_overview) toegevoegd in `PublicChangelog.tsx` en vertaald in landing.{nl,en,fr,de}.json.

## SHOPIFY-CLEAN-1: Shopify API-koppeling verwijderd — 16 juli 2026

Root cause: de Shopify-connect-flow was gebouwd op een niet-bestaande Shopify-app — de OAuth-poot vereist een geregistreerde Shopify-app die door hun app-review moet, iets wat een concurrent-SaaS niet krijgt. De alternatieve access-token-poot (custom app in Shopify Admin) bleek in de praktijk onbetrouwbaar en werd door tenants verworpen. Besluit: CSV-import via de standaard Shopify-export (Producten/Klanten/Bestellingen → Exporteren) is voortaan de enige ondersteunde route om vanuit Shopify over te stappen.

Wijzigingen:
- `src/pages/admin/Import.tsx`: de "Shopify importeren"-kaart uit STATS-1C vervangen door een uitleg-kaart "Vanuit Shopify overstappen?" met de twee CSV-export-stappen; dialog/knop/state verwijderd.
- `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`: shopify-early-return, `ShopifyConnectDialog`/`ShopifyOAuthConnect` imports, shopify credential-takken (test/connect), sync-functie-mapping en `getInstructions`-case verwijderd; ongebruikte `storeUrl`/`accessToken`-state opgeruimd. Bol/Woo/Odoo/eBay/Amazon-takken ongewijzigd.
- Verwijderd: `src/components/admin/marketplace/ShopifyConnectDialog.tsx`, `src/components/admin/marketplace/ShopifyOAuthConnect.tsx`, `src/pages/ShopifyCallback.tsx` + route `/api/shopify/callback` en import in `src/App.tsx`.
- Edge functions `sync-shopify-orders` / `sync-shopify-customers` / `sync-shopify-inventory` bewust dormant gelaten (SHOPIFY-REMOVE-2 op backlog voor definitieve verwijdering). Historische `marketplace_source='shopify_draft_order'`-orders ongemoeid.

## IMPORT-FIX-1/2: CSV-import gesaneerd — 16 juli 2026

Root-cause overzicht (deel 1 = edge function `run-csv-import` + stats-filters; deel 2 = wizard + parser):

- **Consent-default = true + string-truthiness.** `buildCustomerData` zette `email_subscribed = record.email_subscribed ?? true`, dus een ontbrekende kolom leverde een subscriber en een CSV-string `"false"` was truthy → zelfde faalklasse als SUBS-FIX-1. **Fix:** `parseBool()` (case-insensitive whitelist), default `false`, `email_subscribed_at` alleen gezet bij expliciete opt-in.
- **Ontbrekende `acquisition_source`.** CSV-klanten telden als echte registraties in de STATS-1B-filters. **Fix:** `acquisition_source: 'csv_import'` op elk klant-insert (ook de minimal-insert vanuit een orderrij); `IMPORT_ACQUISITION_SOURCES` centraal in `src/lib/salesStats.ts` (`bol_com`, `shopify_import`, `csv_import`) en overal gebruikt via `REAL_CUSTOMER_OR`.
- **Kale `parseFloat`/`parseInt` op Belgisch getalformaat.** `"19,99"` werd stil `19`, `"1.234,56"` werd `1.234`. **Fix:** `normalizeNumber()`/`normalizeInt()` strippen valuta/spaties, kiezen decimaalteken op laatst-voorkomend `.`/`,`, `NaN → 0`. Toegepast in `buildProductData`, `buildCustomerData`, `buildOrderData`, `insertOrderItem` en `importProductVariants`.
- **Destructieve `updateExisting`.** De volledige `buildCustomerData` werd gestuurd, dus ontbrekende kolommen zetten consent op `true` en `total_spent`/`total_orders` op `0`. **Fix:** aparte `buildCustomerUpdateData` schrijft alleen velden die daadwerkelijk in de CSV-rij aanwezig zijn en laat `acquisition_source`, `email_subscribed*`, `sms_subscribed`, `total_spent`, `total_orders` altijd ongemoeid tenzij expliciet aanwezig. `tenant_id`/`email` staan nooit in de update-payload.
- **Hardgecodeerde `marketplace_source: 'shopify'`.** Elke platform-CSV kreeg Shopify-herkomst. **Fix:** `buildOrderData(platform)` → expliciete waarde uit CSV > `platform === 'shopify'` ? `'shopify_draft_order'` : `'csv_import'`. `resolveOrderChannel` in `salesStats.ts` mapt `csv_import` → webshop.
- **Dubbele delimiter in `parseCSV`.** State machine behandelde `,` én `;` tegelijk als celgrens, waardoor Belgische `;`-CSV's met ongequote `19,99` doormidden werden geknipt. **Fix:** quote-aware delimiter-sniff op de eerste regel; parser gebruikt daarna één teken.
- **Ontbrekende encoding-fallback.** Oude Belgische Excel-exports zijn Windows-1252; `é`/`è` werden `�`. **Fix:** `readAsArrayBuffer` + `TextDecoder('utf-8')`; bij U+FFFD opnieuw decoderen als `windows-1252`, dan BOM-strip.
- **Vermengd resultaatrapport.** `totalSuccess/totalFailed/allErrors` accumuleerden over datatypes heen; alleen het laatste datatype werd getoond, met de gemengde totalen erin. **Fix:** `PerTypeImportResult[]` per datatype; `ImportResult.tsx` toont per gegevenstype eigen tellers en fouten plus een totaalregel.
- **Dode opties.** `batchSize` (state=50, code hardcoded 100), `importImages`, `sendWelcomeEmail` werden nooit naar de edge function gestuurd of daar verwerkt. **Fix:** verwijderd uit `ImportOptions`, wizard-state en UI. `skipErrors`/`updateExisting` blijven.
- **`removeFile` = `window.location.reload()`.** Wizard-state ging verloren bij een enkele foutieve upload. **Fix:** nieuwe `onFileRemove(dataType)`-prop wist alleen dat datatype uit `uploadedFiles`, `mappings` en `previewData`.
- **Overige opruiming:** `.json` uit `accept`-lijst en drop-check (geen JSON-parser); drop van onbekend bestandstype toont nu een foutmelding i.p.v. stille no-op; debug-`console.log`s uit `FileUpload.tsx` en `ImportWizard.handleStartImport` verwijderd; dode componenten `ShopifySetupGuide.tsx` en `ShopifyInstantConnect.tsx` verwijderd (post-SHOPIFY-CLEAN-1, nergens meer geïmporteerd).

## CHANGELOG-SUB-1: changelog-inschrijving werkt nu echt — 16 juli 2026

**Root cause:** het inschrijfformulier onderaan /changelog (`PublicChangelog.tsx > handleSubscribe`) was een mock: `setTimeout(1000)` gevolgd door een succes-toast. Er werd nergens iets opgeslagen — bezoekers dachten ingeschreven te zijn maar hun adres verdween.

**Fix:** nieuwe publieke edge function `changelog-subscribe` (verify_jwt=false) valideert het adres (trim/lowercase/regex) en doet met service-role een idempotente upsert op `customers` binnen de interne SellQo-tenant (`d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`): bestaat en al subscribed → no-op; bestaat en niet subscribed → `email_subscribed=true` + timestamp; bestaat niet → INSERT met `acquisition_source='changelog'`, `customer_type='b2c'`, `email_subscribed=true`. Response is altijd `{ success: true }` bij een geldig adres (geen e-mail-enumeratie), 400 alleen bij ongeldige input, 500 alleen bij echte serverfout. `PublicChangelog.tsx` roept nu `supabase.functions.invoke('changelog-subscribe')` aan en toont bij fout een `public.changelog.subscribeError`-toast (NL/EN/FR/DE toegevoegd). `changelog` is bewust NIET toegevoegd aan `IMPORT_ACQUISITION_SOURCES` in `salesStats.ts` — het is een echte opt-in en telt dus mee als nieuwe subscriber/klant.

**Addendum (zelfde dag):** segmentatie-tags toegevoegd — tenant-klanten op de SellQo-tenant dragen tag `'tenant'` (via SQL gezet), changelog-inschrijvingen krijgen tag `'product-updates'` via de edge function; zo kunnen de feature-nieuwsbrief (tenants) en productupdates (subscribers) nooit door elkaar lopen.

## NOTIF-FIX-1: e-mailnotificaties gerepareerd — 16 juli 2026

**Root cause:** de DB-trigger `notify_email_on_notification` riep `create-notification` aan via `net.http_post` met de anon key als Bearer. `authenticateRequest` accepteert alleen de service-role key of een echte gebruikers-JWT en wees die anon-call af met 401. Daardoor werd — ondanks 105 aangevinkte `email_enabled`-settings — vrijwel nooit een notificatie-e-mail verstuurd; alleen types die door edge functions met de service key worden aangemaakt (order_new, stock_out, stock_critical) kwamen door.

**Fix:** intern webhook-secret toegevoegd aan `internal_config` (`internal_webhook_secret`, 32 random bytes hex, idempotent geseed via migratie — nooit in code of git). De trigger stuurt dat secret nu mee als `X-Internal-Secret`. `create-notification` verifieert de header tegen `internal_config` en haalt bij match de notificatierij zelf uit `public.notifications` op (payload wordt niet vertrouwd), gebruikt uitsluitend die DB-waarden voor settings-check en e-mailopbouw. Wrong secret → 401, onbekende `notification_id` → 404. Zonder header blijft het bestaande pad (service-key of user-JWT via `authenticateRequest`) exact gelijk, zodat edge functions die zelf notificaties aanmaken ongewijzigd werken.

**Bijkomend:** `handle_customer_notification` slaat de `customer_new`-notificatie over voor import-klanten (`acquisition_source` in `bol_com`, `shopify_import`, `csv_import`), zodat bulk-imports geen notificatiestorm veroorzaken. De VIP-tak (total_spent ≥ €1000 op UPDATE) is ongewijzigd.

## IMPORT-UX-1: exportuitleg per platform — 16 juli 2026

**Probleem:** de Import-pagina toonde bovenaan een Shopify-uitlegbanner én daaronder een platformkeuze met een Shopify-kaartje, dus dubbele uitleg. Het aanklikken van een platform gaf geen enkele informatiewaarde terug (alleen een vinkje dat de kaartinhoud verspringend omlaag duwde), de emoji-iconen oogden speelgoed, en de enige exportuitleg leefde in stap 2 als één regel met `import.{platform}_export_tip` — voor platforms zonder key kwam daar een kale i18n-key in beeld. De informatie voor de gebruiker was zo verspreid over drie plekken.

**Fix:** de Shopify-banner uit `Import.tsx` verwijderd en vervangen door een simpele paginakop (`import.page_title` / `import.page_subtitle`). `PlatformSelect` herbouwd: monochrome lucide-iconen in een `bg-primary/10`-cirkel, `CheckCircle2` als absolute badge (geen layout-verschuiving meer), datatypes als selecteerbare kaartjes met eigen icoon (Users/Package/FolderTree/ShoppingCart/Ticket) en korte omschrijving. Onder het grid verschijnt zodra een platform gekozen is een uitlegpaneel "Zo exporteer je uit {platform}" met per geselecteerd datatype een concrete genummerde lijst — inhoud in `import.export_guide.platforms.{platform}.{dataType}` als string-array, in alle vier admin-talen (NL/EN/FR/DE) voor Shopify, WooCommerce, Magento, PrestaShop en Lightspeed × klanten/producten/categorieën/bestellingen/couponcodes; ontbrekende combinaties tonen `import.export_guide.fallback`. CSV/Excel heeft een aparte notitie die naar de sjablonen in stap 2 wijst. De blauwe platform-tipkaart onderaan `FileUpload.tsx` is weg (die uitleg leeft nu in stap 1); de CSV-templatekaart bovenaan blijft ongewijzigd. `ImportWizard.tsx` kreeg staplabels onder de voortgangssegmenten (`text-xs`, alleen actieve zichtbaar op mobiel). Publieke changelog-entry `2026.07k / import_guide` toegevoegd in alle vier landing-locales.

## SEC-BATCH-2b-1: signed-URL backend voorbereid — 17 juli 2026

**Root cause:** de bucket `invoices` staat publiek en factuurpaden volgen een raadbare structuur (`{tenant_id}/{factuurnummer}.pdf`, met sequentiële factuurnummers). Wie één link zag kan triviaal buren-facturen enumereren. Om dat weg te werken moet alles op signed URLs draaien, maar de frontend leunt nog op `pdf_url` en de bucket kan pas privaat na een frontend-migratie. Deze batch legt het fundament zonder één bestaand pad te breken.

**Wijzigingen:**
- `generate-invoice/index.ts`: `ublPath` uit het `if (true)`-blok gehaald zodat hij mee in de invoice-insert past; `pdf_path` en `ubl_path` worden nu meegeschreven bij elke nieuwe factuur. `pdf_url`/`ubl_url` blijven bewust gevuld — de frontend leest die nog.
- `generate-subscription-invoice-pdf/index.ts`: `pdf_path` mee weggeschreven in de update van de abonnementsfactuur.
- `create-manual-invoice/index.ts`: `pdfPath` (`.html`-variant) en `ublPath` gehisen buiten hun `if`-blokken; beide worden nu meegeschreven, gecondtioneerd op of hun URL-tegenhanger geslaagd is.
- `generate-credit-note/index.ts`: `pdf_path` mee weggeschreven; `pdf_url` blijft de signed URL bevatten (24h), want daar hangt de mailflow nu al aan.
- Nieuw: `get-document-url/index.ts` (in `config.toml` met `verify_jwt=false`, doet zelf `authenticateRequest`). Geeft een verse signed URL van 10 min voor één document `{doc_type, doc_id, kind}` of voor een batch tot 200 IDs die tot dezelfde tenant behoren (400 bij tenant-mengeling). Signed URLs worden nooit in de database bewaard — daarom moet deze functie bestaan.
- `send-invoice-email/index.ts`: bijlage-download gaat nu eerst via `supabaseClient.storage.from('invoices').download(pdf_path)` en pas als fallback via `fetch(pdf_url)`; idem voor UBL. De `Download factuur (PDF)` / `(UBL/XML)`-linkjes zijn uit de mailbody verwijderd — het bestand zit al als bijlage, en straks zou zo'n link toch verlopen. `attachedLine` blijft alleen tonen als er echt een bijlage in de mail zit.
- `send-credit-note-email/index.ts`: zelfde patroon met `storage.from('credit-notes').download(cn.pdf_path)` en fallback op de bestaande `pdfUrl`-flow (die desnoods `generate-credit-note` opnieuw aanroept).

**Bewust nog niet gedaan (volgende batches):**
- De bucket `invoices` blijft publiek. De policy `Anyone can view invoice files` staat nog. Zodra alle frontend-plekken via `get-document-url` gaan (SEC-BATCH-2b-2), wordt de bucket privaat gemaakt en die policy vervangen door service-role-only (SEC-BATCH-2b-3).
- `pdf_url`/`ubl_url` blijven gevuld tot de frontend niet meer leunt op die kolommen.

Geen publieke changelog en geen newsletter: dit is interne hardening, de klant merkt enkel dat de dubbele downloadlink onderaan de factuurmail verdwijnt (de PDF en UBL zaten al als bijlage). Spoor 1 uit de release-werkwijze, meer niet.

## Frontend naar signed URLs voor facturen & creditnota's — 17 juli 2026

**Root cause:** heel de frontend leunde nog op `invoices.pdf_url` / `ubl_url` en `credit_notes.pdf_url` — kale publieke storage-URL's naar de `invoices`- en `credit-notes`-bucket. Zolang die buckets publiek staan is dat een enumereerbare lek: wie het patroon van een factuur-pad kent, kan alle facturen van alle tenants raden. Dat is exact de klasse issue die SEC-BATCH-2b oplost. In batch 1 legden we de fundering (backend schrijft `pdf_path`/`ubl_path`, `get-document-url` bestaat en doet zelf `authenticateRequest` + tenant-check). Deze batch (2) haalt de frontend van de kale URL's af.

**Wat veranderd is:**
- Nieuwe hook `src/hooks/useDocumentDownload.ts`: single source of truth. Exporteert `getDocumentUrl`, `openDocument`, `getDocumentUrls` (chunkt zelf per 200), en `isDownloading`. Alle downloadknoppen lopen hier door.
- `Invoices.tsx`, `OrderDetail.tsx`, `CreditNotes.tsx`, `CreditNotesTable.tsx`, `OrderCreditNotesSection.tsx`: alle `window.open(pdf_url)` / `window.open(ubl_url)` op factuur- en creditnota-PDF's vervangen door een aanroep naar `get-document-url` via de hook. Knoppen gaten nu op `pdf_path` / `ubl_path` in plaats van op de kale URL-kolommen; de bijhorende queries selecteren die kolommen automatisch mee (of hangen op `select('*')`).
- `useReportExports.ts`: de bulk-zip-download voor facturen (PDF & UBL) haalt eerst de paden op, vraagt dan verse signed URLs via `get-document-url` (in chunks van 200), en geeft die door aan `downloadAsZip`. De progress-callback blijft ongewijzigd werken.

**Popup-blocker patroon (kritiek):** vroeger was het `onClick → window.open(pdf_url)` — synchroon, dus de browser stond het toe. Nu is er een `await` vóór we een URL hebben, en dan blokkeert Safari/Firefox de popup want de user-gesture is verlopen → de knop lijkt stuk. Overal waar we een document openen, doen we daarom eerst synchroon `const win = window.open('', '_blank')` binnen de click, halen dan async de signed URL op, en zetten `win.location.href` erop. Als de browser de popup tóch weigerde, fallen we terug op een same-tab navigatie zodat de download altijd doorgaat.

**Meegenomen bug:** `credit_notes.pdf_url` bevatte een signed URL die na 24u verloopt. `CreditNotesTable`, `CreditNotes.tsx` en `OrderCreditNotesSection` deden alle drie `if (existingUrl) window.open(existingUrl)` — na een dag was dat een dode link. Vervangen door: als er geen `pdf_path` is, eerst `generate-credit-note` draaien, dán een verse signed URL ophalen via `get-document-url`. Elke klik levert nu een URL van maximaal 10 minuten oud.

**Bewust buiten scope (nog niet aangepakt):**
- **Creditnota-UBL.** `Invoices.tsx` r.263 en `CreditNotesTable.tsx` r.170 tonen "Download UBL/XML" op `cn.ubl_url`. Die UBL wordt door `generate-peppol-ubl` in de bucket **`peppol-archive`** gezet, niet in `credit-notes`. `get-document-url` zou daar in de verkeerde bucket zoeken. Vandaag heeft 0 creditnota een `ubl_url`, dus dat menu-item rendert nooit — apart oplossen zodra we peppol-archive privaat maken.
- **De 2 Peppol-testfacturen** (`INV-PEPPOL-TEST-NL/DE`) hebben een `ubl_url` naar `peppol-archive` maar geen `ubl_path`. Hun UBL-knop verdwijnt door de nieuwe gating. Dat is de bedoeling — het zijn testrecords.
- **Buckets blijven publiek.** `pdf_url`/`ubl_url` blijven als vangnet bestaan tot in batch 3.

Geen publieke changelog en geen newsletter: dit is interne hardening, de tenant merkt geen functieverschil (knoppen doen exact hetzelfde). Spoor 1.

## AUTH-REFRESH-1 — Ongewenste unmount bij tab-switch — 17-07-2026

**Root cause.** Supabase GoTrue vuurt bij terugkeer naar de tab (of na een laptop-ontwaken, of periodiek elke ~55 min) een `TOKEN_REFRESHED`/`SIGNED_IN` event met een verse `access_token`. `useAuth.tsx` behandelde dat identiek aan een verse login: `setRolesLoading(true)` + `setUser(nieuw object)` + roles-refetch via `setTimeout`. `RouteGuard` blokkeert op `(user && rolesLoading)` → hele subtree unmount → alle lokale form-state weg en `<Navigate replace>` binnen de guard kan de gebruiker terug naar de parent-route sturen. Resultaat: mensen die 30 seconden een andere tab openden verloren hun ingevulde instellingen.

**Fix.** Twee refs in `AuthProvider`: `currentUserIdRef` en `hasResolvedRolesOnceRef`.
- Binnenkomend event met sessie én dezelfde `user.id` én roles al ooit resolved → alleen `setSession(currentSession)`. Geen nieuwe user-referentie, geen `rolesLoading = true`, geen roles-refetch.
- Alleen een échte user-switch of eerste login triggert de volledige flow. `setUser` gebruikt nu ook een referentie-stabiele setter (`prev?.id === next.id ? prev : next`) zodat downstream `useEffect([user])` niet hervuurt op token-refresh.
- `rolesLoading = true` alleen zolang `hasResolvedRolesOnceRef.current === false`. Latere fetches lopen op de achtergrond. `refetchRoles()` (invite-accept) blijft bewust luid — die flow verwacht dat de guard even wacht.
- `SIGNED_OUT` reset beide refs zodat een nieuwe login weer als eerste-load telt.
- `hasStaleAuthStorage()`-tak probeert nu eerst `supabase.auth.refreshSession()` voordat we `clearAuthStorage()`+`signOut()` doen. Voorkomt random uitloggen bij een tijdelijke race tussen event en session-hydration.
- `AuthContext.Provider value` in `useMemo` zodat consumers niet hertekenen bij elke render van de provider.

`RouteGuard.tsx` en `ProtectedRoute.tsx` bleven ongewijzigd — hun `(user && rolesLoading)` blokkerende conditie profiteert nu automatisch van de rustigere `rolesLoading`. RLS, `user_roles`, `useCan` en de permissie-matrix zijn niet aangeraakt.

**Acceptance geverifieerd.** Deep-link hard-refresh toont nog steeds de spinner (eerste load). Tab-switch + terug: geen spinner, geen navigatie, form-state blijft. `signOut()` en `RoleSimulator` onveranderd. Invite-accept `refetchRoles()` behoudt zijn luide gedrag.

## INCIDENT-FIX — auth.ts pinnen + echte authError loggen — 17 juli 2026

**Root cause.** `supabase/functions/_shared/auth.ts` was het enige bestand in het auth-pad met een ongepinde `https://esm.sh/@supabase/supabase-js@2`-import. Bij de recente redeploy van alle edge functions is die specifier opgelost naar de nieuwste v2.x, terwijl hij daarvoor maandenlang op een oudere v2 draaide. Gevolg: `supabase.auth.getUser(token)` begon geldige gebruikers-tokens te weigeren, wat elke functie die door `authenticateRequest` gaat (o.a. `send-invoice-email`, `get-document-url`) met 401 "Invalid or expired token" liet crashen.

**Waarom het geen service-key- of DB-probleem was.** In `get-document-url` draaide de service-role query (`.from(...).select().in(...)`) succesvol vóór de auth-check, en we kregen consistent 401 in plaats van 500. De `SUPABASE_SERVICE_ROLE_KEY` en de DB-toegang waren dus aantoonbaar in orde — de weigering zat puur in `getUser()`.

**Fix.** Twee wijzigingen, enkel in `_shared/auth.ts`:
1. Import gepind op `@supabase/supabase-js@2.57.2` — de versie die de rest van het auth-pad (o.a. `send-invoice-email`, `get-document-url`, `generate-invoice`) al draait.
2. `console.error("[auth] getUser rejected token:", …)` toegevoegd vóór de generieke `AuthError`. Log bevat `message`, `status`, `name`, `token_len` en `token_prefix` (12 chars) — genoeg om de vorm te herkennen zonder tokens te lekken. De naar buiten gegooide `AuthError` blijft exact hetzelfde (`"Invalid or expired token"`, 401), dus geen enkele caller of client verandert.

**Backlog — zelfde tijdbom elders.** 68 andere edge functions hebben nog een ongepinde `https://esm.sh/@supabase/supabase-js@2`-import. Bewust niet in deze incident-fix meegenomen (te grote blast radius); moet in een aparte gecontroleerde batch waarin we alles op `@2.57.2` pinnen en per functie testen.

## AUTH-SCOPE-1 — signOut scope-fix — 17 juli 2026

**Root cause.** `supabase.auth.signOut()` heeft standaard `scope: 'global'`. Dat revoket server-side **alle** sessies van de gebruiker, op **alle** apparaten en tabs. `useAuth.tsx` gebruikte die aanroep op zes plekken als *opruimactie* na een mislukte token-refresh. Één tab die opruimde, sloopt daarmee de sessie van elke andere actieve tab.

**Het zombie-token-effect.** De andere tab houdt zijn access_token (cryptografisch nog geldig, `exp` ruim in de toekomst, `role: authenticated`). PostgREST/RLS controleert enkel handtekening en `exp`, dus de app lijkt gewoon te werken. Maar GoTrue weigert het token bij `/auth/v1/user` met `403 session_not_found` — de sessie achter het token bestaat niet meer. Elke edge function die `authenticateRequest` → `supabase.auth.getUser()` doet, faalt daarom met 401 "Invalid or expired token", terwijl de UI nog functioneert.

**Bewijs.** Rauwe fetch rechtstreeks naar GoTrue:
```
GET /auth/v1/user
403 {"code":403,"error_code":"session_not_found",
     "msg":"Session from session_id claim in JWT does not exist"}
```
De browser toonde bovendien `POST /auth/v1/logout?scope=global 403 (Forbidden)`. `auth.sessions` bevatte één sessie van 08:55, wat onmogelijk kon horen bij een token dat om 10:48 nog geldig was.

**Fix.** Enkel in `src/hooks/useAuth.tsx`:
1. Nieuwe helper `safeLocalSignOut()` die altijd `supabase.auth.signOut({ scope: 'local' })` doet. Fouten worden genegeerd, maar `clearAuthStorage()` draait altijd zodat lokale state opgeruimd is.
2. Zes opruimtakken (na mislukte refresh, sessie-error, corrupte storage, etc.) vervangen door `await safeLocalSignOut()`.
3. De gebruikers-logoutknop (`signOut()`) loopt nu ook via `safeLocalSignOut()` — uitloggen op dit toestel mag je telefoon niet meesleuren.
4. De `SIGNED_OUT`-event handler is ongewijzigd gelaten: die doet daar `clearAuthStorage()` zonder `signOut()`, wat correct is omdat het event zelf al de uitlog is.

**Grenzen.** Geen enkel ander bestand aangeraakt. `RouteGuard.tsx`, `ProtectedRoute.tsx`, de AUTH-REFRESH-1 refs (`currentUserIdRef`, `hasResolvedRolesOnceRef`), `fetchUserRoles`, `useCan`, RLS en permissie-matrix zijn ongewijzigd. Geen SQL-migraties en geen edge functions.

**Backlog-notitie.** `hasStaleAuthStorage()` heet "stale" maar controleert enkel óf er iets in `localStorage` staat — het controleert niet of die data daadwerkelijk verlopen of corrupt is. Die misleidende naam drijft een deel van deze opruimtakken aan; hernoemen/verfijnen staat op de backlog, niet in deze fix.

## SEC-BATCH-2c-1 — export-q-bundle: signed-ready + luide fouten — 17 juli 2026

**Root cause.** `export-q-bundle` haalde factuur- en creditnota-PDF's op met een kale `fetch(row.pdf_url)` op de opgeslagen publieke URL. Twee problemen tegelijk:

1. Zodra bucket `invoices` privaat gaat (SEC-BATCH-2c-2), breekt élke factuur-fetch.
2. Voor creditnota's was het **al** stuk: bucket `credit-notes` is al privaat, en `credit_notes.pdf_url` bevat een opgeslagen signed URL die na 24u verloopt. De boekhouder kreeg al een tijd een ZIP zonder creditnota's.

**Waarom niemand het zag.** Beide fetch-helpers logden mislukkingen enkel via `console.warn` en gaven een lege lijst terug. De README had nochtans al een `failures`/WAARSCHUWINGEN-sectie — die werd gewoon niet gevoed.

**Fix.** Enkel `supabase/functions/export-q-bundle/index.ts` aangeraakt:
- Import gepind op `@supabase/supabase-js@2.57.2` (zelfde bugklasse als INCIDENT-FIX: ongepinde `@2` gaf al eens een lib-mismatch met `_shared/auth.ts`).
- `fetchInvoicePdfs` / `fetchCreditNotePdfs` selecteren nu `pdf_path` en downloaden via `sb.storage.from(<bucket>).download(pdf_path)` met de service-role client. Facturen uit `invoices`, creditnota's uit `credit-notes`. Extensie afgeleid uit `pdf_path` (`.html` blijft `.html` — `create-manual-invoice` schrijft namelijk HTML).
- Elke mislukte download landt nu in een `failures`-array met het documentnummer, niet enkel in `console.warn`. Zo verschijnen ze in README → WAARSCHUWINGEN.
- Nieuwe volledigheidscheck: een tweede query per functie voor uitgegeven documenten mét `pdf_path IS NULL`. Elk resultaat wordt als `"geen PDF beschikbaar in Storage"` toegevoegd aan `failures`. Zo kan een uitgegeven factuur nooit meer stilletjes uit de bundel verdwijnen.
- Call-site voegt `invRes.failures` en `cnRes.failures` toe aan de bestaande `failures`-array. `buildReadme` zelf is onaangeroerd.

**Grenzen.** Bucket-privacy en storage-policies blijven voor SEC-BATCH-2c-2. Geen SQL-migraties. Geen wijziging aan `buildReadme`, `buildAuditCsv`, `callInternal`, `tryFetch`, `periodCode`, `slugify` of auth/`requireRole`. De 67 andere ongepinde `supabase-js@2`-imports elders blijven staan — apart traject.


## SEC-1 — storage-buckets tenant-scopen — 29 juli 2026

**Root cause.** De schrijfpolicies op de vijf publieke buckets (`product-images`, `tenant-logos`, `ai-images`, `tenant-assets`, `marketing-assets`) hadden als enige voorwaarde `bucket_id = '<naam>'` met rol `authenticated` (of `public` + `auth.role() = 'authenticated'`). Er was geen tenant-scope: **elke ingelogde gebruiker van élke tenant kon objecten van álle andere tenants overschrijven of verwijderen.** Verergerd door `upsert: true` in `src/hooks/useImageUpload.ts` — een bestaand object op een geraden pad werd stilzwijgend overschreven. `marketing-assets` had al tenant-gescopete write-policies (via `user_roles`), maar geen scope op `SELECT`.

**Padconventie.** Alle buckets gebruiken `<tenant_id>/…` als eerste map. Enige niet-conforme uploadpad: `src/components/admin/storefront/BrandingUploader.tsx` gaf `customPath` mee als `` `${type}/${Date.now()}` `` — zonder tenant-prefix. `useImageUpload.ts` valt alleen terug op zijn tenant-gescopete default wanneer er géén `customPath` is. Alle andere aanroepers (`GiftCardDesignDialog`, `CategoryFormDialog`, `MediaAssetsLibrary`, `ProductForm`, `BusinessSettings`) zaten al goed.

**Code-fix.** `BrandingUploader.tsx` gebruikt nu `useTenant()` en uploadt naar `` `${currentTenant.id}/${type}/${Date.now()}` ``. Zonder deze wijziging zou de nieuwe policy élke branding-upload weigeren.

**Policy-fix.** Per bucket zijn `INSERT`/`UPDATE`/`DELETE` vervangen door `<bucket>_{insert,update,delete}_own_tenant` met:
`bucket_id = '<bucket>' AND (public.is_platform_admin(auth.uid()) OR (storage.foldername(name))[1] IN (SELECT tid::text FROM public.get_user_tenant_ids(auth.uid()) AS tid))`.
`get_user_tenant_ids(_user_id uuid)` retourneert `SETOF uuid`, dus de `SELECT … FROM`-vorm werkt. `is_platform_admin` blijft nodig zodat platformbeheer bij alle tenants kan.

**Kritiek: vergelijken als `text`, nooit `::uuid` op een mapnaam.** Er bestaan 10 objecten in `tenant-logos` met een niet-UUID eerste map (`logo/`, `favicon/`, `document-logo/`, `demo-bakkerij/`). `(storage.foldername(name))[1]::uuid` zou `invalid input syntax for type uuid` gooien zodra de policy over zo'n rij evalueert, wat de hele query laat falen. De UUID-kant wordt daarom naar `text` gecast.

**Lezen bewust ongemoeid.** De publieke `SELECT`-policies op `product-images`, `tenant-logos`, `ai-images` en `tenant-assets` blijven ongewijzigd — de storefront rendert eruit. Daarom blijven de 10 objecten met afwijkend pad gewoon werken en is er géén datamigratie nodig.

**Nuance `marketing-assets`.** De `SELECT`-policy (`bucket_id = 'marketing-assets'` voor `authenticated`) liet elke ingelogde gebruiker de assets van alle tenants **opsommen** via de API. Die is nu tenant-gescopet (`marketing-assets_select_own_tenant`). Eerlijke beperking: de bucket is `public = true`, dus wie een exacte URL heeft komt er sowieso bij — deze wijziging voorkomt **opsomming**, geen directe toegang via een bekende URL.

**Verificatie.** Alle 5×3 write-policies geven `gescopet = true`; `marketing-assets_select_own_tenant` eveneens; de vier andere `SELECT`-policies blijven bewust publiek (`gescopet = false`). Type-check schoon, `landing.{nl,en,fr,de}.json` parsen alle vier.

**Buiten scope.** Geen datamigratie, geen paden hernoemd. Private buckets (`invoices`, `credit-notes`, `shipping-labels`, `peppol-archive`, `message-attachments`, `supplier-documents`, `digital-products`) niet aangeraakt — die hebben al tenant-gescopete policies. `upsert: true` blijft staan; met tenant-scope is dat gedrag afdoende ingeperkt.

**Losse observatie.** Eén object onder `document-logo/` is niet herleidbaar naar een tenant. Bewust niet opgeruimd; blijft leesbaar via de publieke SELECT-policy, maar is voortaan door niemand meer via de API te overschrijven (behalve platform-admins).

### Rollback SEC-1

```sql
DROP POLICY IF EXISTS "product-images_insert_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "product-images_update_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "product-images_delete_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-logos_insert_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-logos_update_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-logos_delete_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "ai-images_insert_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "ai-images_update_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "ai-images_delete_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets_insert_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets_update_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets_delete_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "marketing-assets_insert_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "marketing-assets_update_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "marketing-assets_delete_own_tenant" ON storage.objects;
DROP POLICY IF EXISTS "marketing-assets_select_own_tenant" ON storage.objects;

-- exacte pre-SEC-1 staat (uit de inventarisatiequery)
CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images'::text);
CREATE POLICY "Authenticated users can update their uploaded images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images'::text);
CREATE POLICY "Authenticated users can delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images'::text);

CREATE POLICY "Authenticated users can upload tenant logos" ON storage.objects
  FOR INSERT TO public WITH CHECK ((bucket_id = 'tenant-logos'::text) AND (auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can update tenant logos" ON storage.objects
  FOR UPDATE TO public USING ((bucket_id = 'tenant-logos'::text) AND (auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can delete tenant logos" ON storage.objects
  FOR DELETE TO public USING ((bucket_id = 'tenant-logos'::text) AND (auth.role() = 'authenticated'::text));

CREATE POLICY "Authenticated users can upload AI images" ON storage.objects
  FOR INSERT TO public WITH CHECK ((bucket_id = 'ai-images'::text) AND (auth.role() = 'authenticated'::text));
CREATE POLICY "Users can delete their own AI images" ON storage.objects
  FOR DELETE TO public USING ((bucket_id = 'ai-images'::text) AND (auth.role() = 'authenticated'::text));
-- ai-images had vóór SEC-1 géén UPDATE-policy

CREATE POLICY "Authenticated users can upload tenant assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tenant-assets'::text);
-- tenant-assets had vóór SEC-1 géén UPDATE- of DELETE-policy

CREATE POLICY "Users can upload to their tenant folder" ON storage.objects
  FOR INSERT TO public WITH CHECK ((bucket_id = 'marketing-assets'::text) AND ((storage.foldername(name))[1] IN (
    SELECT (user_roles.tenant_id)::text FROM user_roles WHERE (user_roles.user_id = auth.uid()))));
CREATE POLICY "Users can update their tenant's marketing assets" ON storage.objects
  FOR UPDATE TO public USING ((bucket_id = 'marketing-assets'::text) AND ((storage.foldername(name))[1] IN (
    SELECT (user_roles.tenant_id)::text FROM user_roles WHERE (user_roles.user_id = auth.uid()))));
CREATE POLICY "Users can delete their tenant's marketing assets" ON storage.objects
  FOR DELETE TO public USING ((bucket_id = 'marketing-assets'::text) AND ((storage.foldername(name))[1] IN (
    SELECT (user_roles.tenant_id)::text FROM user_roles WHERE (user_roles.user_id = auth.uid()))));
CREATE POLICY "Authenticated users can view marketing assets" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'marketing-assets'::text);
```

Bij rollback moet ook `BrandingUploader.tsx` teruggedraaid worden naar `` `${type}/${Date.now()}` `` — of blijven staan, want de oude policies accepteren beide paden.

## SEC-3 — schrijfrechten van de `marketing`-rol intrekken op vijf tabellen — 29 juli 2026

**Root cause:** de `marketing`-rol was destijds in de rol-arrays van vijftien write-policies opgenomen op basis van "zit in de buurt van marketing", niet op basis van wat de functie effectief nodig heeft. Alle vijftien gebruiken hetzelfde patroon `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing'])` (tweeargumentige signatuur, `auth.uid()` intern). Daardoor kon een externe marketier:

- **`gift_cards`** — een toonderinstrument aanmaken: `INSERT` met vrij te kiezen `code` en `current_balance`, en dat vervolgens verzilveren. Zuiver financieel, hoort niet bij marketing.
- **`customer_group_product_prices`** — prijzen zetten. Klantgroep aanmaken, zichzelf koppelen, prijs op €0,01. Prijsbeleid is geen marketingfunctie.
- **`legal_pages`** — algemene voorwaarden en privacyverklaring herschrijven. Juridische documenten horen bij `tenant_admin`/`staff`.
- **`external_reviews`** — reviews aanmaken/wijzigen/verwijderen. Verzonnen reviews zijn onder EU-consumentenrecht verboden; dit was een juridisch risico, geen marketingtool.
- **`pos_quick_buttons`** — kassaconfiguratie. Geen enkele relatie tot marketing; vermoedelijk per ongeluk in de rol-array meegekopieerd.

**Uitgevoerd:** vijftien policies gedropt en identiek herbouwd, met als enige wijziging dat `'marketing'::app_role` uit de array verdwijnt (`ARRAY['tenant_admin'::app_role, 'staff'::app_role]`). Policynamen ongewijzigd gehouden zodat de rollback triviaal blijft. Alle omliggende expressies letterlijk behouden: de `EXISTS (SELECT 1 FROM customer_groups g …)`-constructie, de `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`-voorwaarde bij `gift_cards`/`external_reviews`, en de `is_platform_admin(auth.uid()) OR …`-prefix bij `pos_quick_buttons`.

**Security-keuzes:**
- `staff` en `tenant_admin` blijven bewust behouden op alle vijftien policies — dit is een intrekking van één rol, geen verstrenging voor de rest.
- `SELECT`-policies op alle vijf de tabellen ongemoeid: marketing mag deze data blijven **lezen**, enkel niet meer schrijven.
- `pos_quick_buttons_service_role` (`ALL`, `true`, rol `service_role`) niet aangeraakt — edge-functiepad.
- `gift_card_designs` blijft bewust bij marketing: een ontwerp heeft geen monetaire waarde, enkel het instrument zelf wel.
- Geen wijziging aan `useCan.ts` — RLS is hier de bepalende grens; de frontend-matrix volgt in `PERM-1`.

**Verificatie:** exact 15 rijen (`cmd <> 'SELECT'`, `cmd <> 'ALL'`) met `nog_marketing = false`, en de tegencontrole `heeft_admin = true` én `heeft_staff = true` op alle 15. Geen policy verdwenen.

**Openstaand (bewust):** `discount_codes` en de promotietabellen (`automatic_discounts`, `volume_discounts`, `volume_discount_tiers`, `bogo_promotions`, `gift_promotions`, `discount_stacking_rules`) blijven bij `marketing` — kortingen aanmaken is de kern van die functie, dat wegnemen maakt de rol zinloos. Het financiële risico daarvan wordt afgedekt in **`PERM-1`**: een per-gebruiker instelbaar recht, waarbij enkel `tenant_admin` en `platform_admin` dat recht kunnen toekennen.

**Procesnotitie:** de oorspronkelijke SEC-3-batch is halverwege afgebroken. De migratie en het `doc_articles`-artikel `teamleden-rollen` landden wel, maar de role-audit-entry en de changelog niet, en er is geen commit gepusht. De databasewijziging was daardoor tijdelijk niet gedocumenteerd — de productiestaat liep vóór op de paper trail. Deze entry (`SEC-3-PAPER`) herstelt dat, zonder enige databasewijziging. Les: na elke batch de git-stand natrekken in plaats van te vertrouwen op het afrondingsbericht van de agent.

### Rollback SEC-3

```sql
-- gift_cards
DROP POLICY IF EXISTS "Marketing roles can insert gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can insert gift cards" ON public.gift_cards FOR INSERT TO authenticated
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "Marketing roles can update gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can update gift cards" ON public.gift_cards FOR UPDATE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "Marketing roles can delete gift cards" ON public.gift_cards;
CREATE POLICY "Marketing roles can delete gift cards" ON public.gift_cards FOR DELETE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

-- customer_group_product_prices
DROP POLICY IF EXISTS "Users can insert customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can insert customer group product prices" ON public.customer_group_product_prices FOR INSERT TO authenticated
WITH CHECK (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))));
DROP POLICY IF EXISTS "Users can update customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can update customer group product prices" ON public.customer_group_product_prices FOR UPDATE TO authenticated
USING (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))))
WITH CHECK (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))));
DROP POLICY IF EXISTS "Users can delete customer group product prices" ON public.customer_group_product_prices;
CREATE POLICY "Users can delete customer group product prices" ON public.customer_group_product_prices FOR DELETE TO authenticated
USING (EXISTS ( SELECT 1 FROM customer_groups g WHERE ((g.id = customer_group_product_prices.customer_group_id) AND has_tenant_role(g.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))));

-- legal_pages
DROP POLICY IF EXISTS "legal_pages_insert_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_insert_marketing" ON public.legal_pages FOR INSERT TO authenticated
WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "legal_pages_update_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_update_marketing" ON public.legal_pages FOR UPDATE TO authenticated
USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "legal_pages_delete_marketing" ON public.legal_pages;
CREATE POLICY "legal_pages_delete_marketing" ON public.legal_pages FOR DELETE TO authenticated
USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

-- external_reviews
DROP POLICY IF EXISTS "Moderators can insert external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can insert external_reviews" ON public.external_reviews FOR INSERT TO authenticated
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "Moderators can update external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can update external_reviews" ON public.external_reviews FOR UPDATE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "Moderators can delete external_reviews" ON public.external_reviews;
CREATE POLICY "Moderators can delete external_reviews" ON public.external_reviews FOR DELETE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

-- pos_quick_buttons
DROP POLICY IF EXISTS "pos_quick_buttons_insert" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_insert" ON public.pos_quick_buttons FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "pos_quick_buttons_update" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_update" ON public.pos_quick_buttons FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
DROP POLICY IF EXISTS "pos_quick_buttons_delete" ON public.pos_quick_buttons;
CREATE POLICY "pos_quick_buttons_delete" ON public.pos_quick_buttons FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));
```

### Openstaande actie — Akke

- Newsletter-item voor SEC-3 nog te plaatsen — mechanisme te bevestigen (er bestaat geen `newsletter_queue`-tabel; bewust buiten scope gehouden in deze batch).

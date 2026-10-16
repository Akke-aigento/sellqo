# SellQo nachtelijke gezondheidscheck, 16-10-2026

- **Repo:** `origin/main` @ `4f51953` ("docs: SOCIAL-4c live in role-audit"), worktree `/home/claude/sellqo-health` (detached, schoon: `git status` leeg)
- **Modus:** volledig read-only. Geen commits of pushes, geen DB-writes (alleen SELECT via de connector). De worktree blijft staan.
- **Install:** `npm ci` faalt (lockfile loopt niet gelijk met package.json, zie B4). Daarna `npm install --no-package-lock --legacy-peer-deps` gebruikt, met supabase-js lokaal (`--no-save`) teruggezet op de gelockte 2.90.1 (zie B3).

## Samenvatting

| Check | Resultaat |
|---|---|
| 1. tsc (lockversies) | **0 fouten**, exit 0 |
| 1b. tsc (nieuwste versies binnen de ranges) | **27 fouten in 25 bestanden**: latente breuk, zie B3 |
| 2. eslint | 1.479 problemen (1.385 errors, 94 warnings) in 359 bestanden. Baseline-script groen: **1.482 → 1.479 (-3)** |
| 3. i18n-parity / skills-sync | groen (5 talen × 7.910 keys) / groen (12 skills, bron = spiegel) |
| 4. CI-stappen lokaal | alles groen, behalve `deno check` (niet lokaal te draaien, sandbox bereikt esm.sh niet). Laatste 5 GitHub-runs op main: **allemaal success** |
| 5. Secrets | geen echte geheimen. Alleen anon/publishable keys en Firebase client-keys |
| 6. RLS | geen tabellen zonder RLS. Anon-leespolicies zijn allemaal storefront-content. **2 SECURITY DEFINER-functies zonder autorisatie, uitvoerbaar door anon** |
| 7. Edge functions | **125 imports van `supabase-js@2` zonder vaste versie in 117 bestanden**, waaronder storefront-api |
| extra: npm audit (prod) | 2 critical (Capacitor 8.5.0), 20 high |

---

## Check 1: TypeScript

```
npx tsc --noEmit -p tsconfig.app.json > tsc.log 2>&1; echo $? > tsc.exit
```

- **Met de gelockte versies** (`@supabase/supabase-js@2.90.1` uit bun.lock): **exit 0, 0 fouten.** Dat klopt met de groene CI.
- **Met een lockloze install** (npm kiest dan supabase-js/postgrest-js **2.118.0**, wat binnen `^2.90.1` valt): **exit 2, 27 × TS2345** in 25 bestanden. De oorzaak is telkens hetzelfde: `Record<string, unknown>` of `Record<string, any>` als argument van `.update()`/`.insert()` past niet op de nieuwe `RejectExcessProperties<…>`-typing van postgrest-js.
  - Bestanden: `ProductPhotosManager.tsx` (3), `useQuotes.ts` (2), `usePlatformPromotions.ts` (2), `TrackingImportDialog.tsx`, `BulkAIGenerateDialog.tsx`, `ProductGridView.tsx`, `PlatformBlog.tsx`, en 16 hooks (`useOrders`, `useInvoices`, `useSubscriptions`, `useStorefront`, `useDiscountCodes`, `useGiftCards`, `useAutoDiscounts`, `useAdCampaigns`, `useImport`, `useProductVariants`, `usePurchaseOrders`, `useMarketplaceConnections`, `useMarketplaceListing`, `useShippingIntegrations`, `useShopifyRequests`, `useCustomerCommunicationSettings`).

## Check 2: ESLint

```
npx eslint . -f json -o eslint.json        # exit 1 (verwacht, baseline)
node scripts/verify-lint-baseline.mjs     # exit 0
```

- Totaal: **1.479** (1.385 errors, 94 warnings) in 359 bestanden. Baseline 1.482, dus 3 beter. De lat kan omlaag met `--update`.
- `react-hooks/rules-of-hooks`: **0** (de nultolerantieregel staat goed).
- Per regel: `no-explicit-any` 1.302 · `exhaustive-deps` 51 · `only-export-components` 40 · `no-case-declarations` 26 · `no-empty` 21 · `prefer-const` 17 · `no-useless-escape` 5 · `no-empty-object-type` 4 · `no-unused-expressions` 3 · ongebruikte eslint-disable 3.
- Top 10 bestanden:

| Bestand | errors | warn |
|---|---|---|
| supabase/functions/storefront-api/index.ts | 240 | 0 |
| supabase/functions/generate-invoice/index.ts | 28 | 0 |
| supabase/functions/storefront-customer-api/index.ts | 28 | 0 |
| src/components/storefront/ShopLayout.tsx | 21 | 1 |
| src/components/admin/marketing/CampaignDialog.tsx | 20 | 1 |
| src/components/admin/storefront/SectionEditor.tsx | 20 | 0 |
| supabase/functions/export-vat-pdf/index.ts | 19 | 0 |
| src/pages/admin/Invoices.tsx | 18 | 0 |
| supabase/functions/sync-tenant-plan/index.ts | 18 | 0 |
| src/pages/storefront/ShopProductDetail.tsx | 16 | 2 |

- Het bekijken waard: `no-unused-expressions` in `SEOCategoryTable.tsx:73`, `SEOProductTable.tsx:72` en `useBolcomKeywords.ts:176`. Dat is vaak een `a && b()`-patroon, maar soms een vergeten aanroep.

## Check 3: i18n en skills

- `node scripts/i18n-parity.mjs`: **exit 0**. Volledige pariteit voor de, en, fr, nl en uk (7.910 keys elk).
- `node scripts/verify-skills-sync.mjs`: **exit 0**. 12 skills, `.claude/skills` = `.agents/skills`. De workspace-kant (Lovable) is niet gecontroleerd, want dat kan het script niet.

## Check 4: CI (`.github/workflows/ci.yml`) lokaal nagedaan

| Stap | Lokaal |
|---|---|
| Typecheck | ✓ (0 fouten met lockversies) |
| Lint-baseline | ✓ (1.479 ≤ 1.482) |
| i18n-pariteit | ✓ |
| check-i18n-used-keys | ✓ |
| check-mail-addresses | ✓ |
| check-customer-messages-writes | ✓ |
| check-notification-sources | ✓ |
| check-dead-buttons | ✓ (2 bekend, baseline 2) |
| verify-capacitor-sync | ✓ |
| verify-skills-sync | ✓ |
| deno check `supabase/functions/*/index.ts` | **niet gedraaid**: de sandbox bereikt esm.sh niet (proxy-tunnel geweigerd) |
| deno test (7 testbestanden) | ✓ **75 passed, 0 failed** (deno 2.9.6 via npm) |
| rooktest storefront-api | **niet lokaal te draaien**: de import map stubt alleen `server.ts`, dus de test haalt `supabase-js@2`, stripe en resend live van esm.sh. Zie B9 |
| Build | ✓ `vite build` in 44 s (naar scratchpad-outDir, zodat sitemap.xml ongemoeid bleef). Chunk-size-waarschuwing is bekend |

`gh run list --repo Akke-aigento/sellqo --limit 5`: alle 5 **completed/success** (laatste: 38814346095, "docs: SOCIAL-4c live in role-audit", 15-10 22:02Z, 1m48s).

## Check 5: Secrets-scan

Gezocht op `eyJhbGci`, `sk_live_`, `sk_test_`, `rk_live_`, `whsec_`, Resend `re_…_…`, `service_role…eyJ`, AWS, `sbp_`, `ghp_`, Google `AIza`, `Bearer <lang>`, plus `secret/password/api_key/token = '<24+>'`, en op gecommitte `.env`/keystores.

| Hit | Bestand:regel | Oordeel |
|---|---|---|
| JWT `eyJhbGciOiJI…` | `supabase/migrations/20260220182558_9a84e760-….sql:20` | payload `role: anon` (ref gczmfcab…). Publiek by design. **Laag** |
| JWT `eyJhbGciOiJI…` | `supabase/migrations/20260714120605_5c71a31e-….sql:47` (cron → sync-odoo-invoices) | `role: anon`. **Laag** |
| `.env` gecommit (staat wel in .gitignore) | `.env` | alleen `SUPABASE_URL` en publishable keys (Lovable-standaard). **Laag** |
| `AIza…` | `android/app/google-services.json:18`, `ios/App/App/GoogleService-Info.plist:6` | Firebase client-keys, publiek by design. Wel checken of ze in GCP beperkt zijn tot de app-ID's. **Laag** |
| `sk_live_` | `generate-storefront-api-key/index.ts:55,61`, `ReviewsPlatformConfig.tsx:216`, `docs/role-audit.md` | prefix-generator, placeholder en doc-tekst. Geen sleutel |

Geen service-role keys, Stripe-, Resend-, webhook- of GitHub-secrets in de repo.

## Check 6: RLS-scan (live, project 9932a7fe…, alleen SELECT)

**(a) Tabellen zonder RLS in `public`:** geen.

**(b) Permissieve anon/public-leespolicies:**
- `qual = true`: alleen `vat_regimes` (referentiedata). OK.
- Alle anon/public SELECT-policies zonder auth-conditie: `blog_posts` (published), `categories`, `external_reviews` (is_visible), `homepage_sections`, `legal_pages`, `sellqo_legal_pages`, `storefront_pages`, `pricing_plans`, `themes`, `products`, `product_variants`, `product_variant_options`, `product_bundle_items`, `product_categories`, `tenant_domains`. **Allemaal storefront-content, terecht publiek.** Geen policy op een tabel met klant-PII (email/phone/address/iban/pin/password/birth).
- Leesbare kolommen voor anon:
  - `products.cost_price` en `product_variants.cost_price` zijn **netjes afgeschermd**.
  - `products` geeft anon wel alle marketplace-interne kolommen (`bol_offer_id`, `amazon_asin`, `*_listing_status`, `*_last_synced_at`, `odoo_product_id`, `shopify_product_id`, `*_optimized_title/description`, `low_stock_threshold`, `marketplace_lock_bol_com`) → **Laag**: geen PII, wel bedrijfsinterne info.
  - `tenant_domains.verification_token` → **Laag** (voor een geverifieerd domein staat de token toch al publiek in de DNS-TXT).
- Views die anon kan lezen: 4 met `security_invoker` (OK). Twee definer-views: `tenant_public_info` (id, name, slug, kleur, logo: OK) en `tenant_theme_public`. In die laatste zit `custom_frontend_config`, met daarin **`api_key_hash`, `api_key_prefix` en `webhook_url`** van de custom-frontend-tenants (2 rijen) → **Laag/middel**, zie B8.

**(c) SECURITY DEFINER-functies in `public` die anon kan uitvoeren: 63**
- 47 zijn triggerfuncties. Die zijn via RPC niet rechtstreeks aan te roepen, dus **laag** (opruimen met REVOKE is netjes, maar niet dringend).
- Niet-triggerfuncties die schrijven:

| Functie | Auth-check | Oordeel |
|---|---|---|
| `update_tenant_fiscal_info(...)` | ✓ `has_tenant_role(_tenant_id, [tenant_admin, accountant])` | OK |
| `admin_adjust_ai_credits` | ✓ `is_platform_admin(auth.uid())` | OK |
| `repair_orphaned_user_roles` | ✓ `auth.uid()`, alleen eigen rijen | OK |
| **`resolve_sync_conflict(p_conflict_id, p_resolution, p_resolution_data)`** | **✗ geen**: `UPDATE sync_conflicts … WHERE id = p_conflict_id` | **Middel**, zie B5 |
| **`log_admin_action(p_target_tenant_id, p_action_type, p_action_details)`** | **✗ geen**: INSERT in `admin_actions_log` | **Middel**, zie B6 |

- Niet-triggerfuncties die lezen: `get_user_tenant_ids(_user_id)` en `is_platform_admin(_user_id)` nemen een willekeurige user-UUID aan → **laag/middel**, enumeratie (B7). `storefront_recent_purchases`, `get_public_events`, `get_event_signup_count` en `check_bundle_capacity` zijn bedoeld als storefront-functies. OK.

## Check 7: Edge functions met supabase-js zonder vaste versie

```
rg -P "supabase-js@2(\.\d+)?['\"/?]" supabase/functions | grep -vP "supabase-js@2\.\d+\.\d+"
```

- **125 imports in 117 bestanden** (115 functies + `_shared/intervat.ts` + `_shared/stockLedger.ts`), van de 249 functiemappen.
- Gevoelige plekken: **`storefront-api`, `storefront-customer-api`, `storefront-resolve`** (alle custom frontends), `send-order-confirmation`, `send-ticket-confirmation`, `send-order-shipped`, `process-gift-card-order` (`@2?bundle`), `handle-inbound-email`, `create-notification`, `auth-email-hook` en `process-email-queue` (`npm:@supabase/supabase-js@2`), plus alle bol/shopify/odoo/woo-syncs.
- De `_shared`-bestanden worden geïmporteerd door: `export-ic-listing-xml`, `export-vat-xml`, `sync-odoo-inventory`, `sync-shopify-inventory`, `sync-woocommerce-inventory`.
- Versiewildgroei bij de vaste imports: 2.57.2 (96×), 2.39.3 (14×), 2.90.1 (7×), 2.45.0 (7×), 2.49.1 (2×), 2.49.4 (1×), 2.95.0 (1×).

---

## Geprioriteerde bevindingen (top 10)

| # | Ernst | Bevinding | Fixvoorstel |
|---|---|---|---|
| **B1** | **Hoog** | **`@capacitor/android` en `@capacitor/ios` 8.5.0 (bun.lock) hebben een critical advisory**: remote content kan via het interne HTTP-proxypad op de app-origin geladen worden. Geldt voor de iOS/Android-apps | Bumpen naar `^8.5.1` (core en alle plugins tegelijk), `npx cap sync`, `verify-capacitor-sync` draaien, nieuwe native build. Buildnummer = max(TestFlight, Play) + 1, vastleggen in role-audit |
| **B2** | **Hoog** | **117 edge-function-bestanden importeren `supabase-js@2` zonder patchversie**, waaronder storefront-api/-customer-api/-resolve. Dit is exact de valkuil van 15-10 (esm.sh bouwt een verse release uren niet → elke deploy faalt en CI flaket) | Codemod `supabase-js@2(['"?])` → `supabase-js@2.57.2$1` (ook de `npm:`- en `?bundle`-varianten). Plus een CI-guard `scripts/check-supabase-js-pin.mjs` die faalt op `@2` zonder patch. Deploy daarna gefaseerd (de storefront-trio apart, met nulmeting en vingerafdruk), anders draaien de live functies gewoon de oude code |
| **B3** | **Middel** | **Latente tsc-breuk**: `package.json` heeft `"@supabase/supabase-js": "^2.90.1"`. Zodra de lockfile ververst (bun update, of de Lovable-agent die een dependency toevoegt) komt postgrest 2.118 binnen en wordt CI rood met 27 × TS2345 | Kort: exact pinnen op `"2.90.1"`. Structureel: de 27 call-sites typen met `TablesUpdate<'x'>`/`TablesInsert<'x'>` in plaats van `Record<string, unknown>`, daarna gecontroleerd upgraden |
| **B4** | **Middel** | **Drie lockfiles, en `package-lock.json` loopt achter** (`npm ci`: "Missing: drizzle-kit@0.31.11 from lock file"). bun.lock en bun.lockb staan er naast elkaar. Elke npm-gebaseerde tooling (sandbox, audit, Dependabot) ziet andere versies dan CI en Lovable | Eén bron kiezen (bun.lock, die CI gebruikt). `package-lock.json` en `bun.lockb` weghalen of in een aparte batch regenereren, en documenteren in CLAUDE.md §6 |
| **B5** | **Middel** | **`resolve_sync_conflict` is SECURITY DEFINER, uitvoerbaar door anon en authenticated, zonder enige check**. Wie een conflict-UUID heeft (bv. een gebruiker van een andere tenant), kan het conflict van elke tenant afsluiten, met willekeurige `resolution_data` | Begin van de functie: `IF NOT has_tenant_role((select tenant_id from sync_conflicts where id=p_conflict_id), ARRAY['tenant_admin'::app_role]) THEN RAISE … 42501`. Plus `REVOKE EXECUTE … FROM public, anon`. Via een migratie, met daarna een natrek op `has_function_privilege` |
| **B6** | **Middel** | **`log_admin_action` is uitvoerbaar door anon**: iedereen kan rijen in `admin_actions_log` schrijven met een willekeurige `target_tenant_id` en `action_type`, waardoor het audit-log vervuild kan worden | `IF NOT is_platform_admin(auth.uid()) THEN RAISE …` plus `REVOKE EXECUTE … FROM public, anon, authenticated`. `admin_adjust_ai_credits` roept hem intern aan als definer, dus dat blijft werken |
| **B7** | **Laag/middel** | `get_user_tenant_ids(_user_id)` en `is_platform_admin(_user_id)` zijn door anon aan te roepen met een vreemde user-UUID → tenant-lidmaatschap en platform-admins enumereren | Eerst nagaan welke anon-policies ze gebruiken (een REVOKE breekt policies die anon evalueert). Dan een variant zonder parameter (`auth.uid()` intern) voor client-gebruik, en de geparametriseerde versie revoken voor anon |
| **B8** | **Laag/middel** | De definer-view `tenant_theme_public` (anon-leesbaar) toont `custom_frontend_config.api_key_hash`, `api_key_prefix` en `webhook_url` van de custom-frontend-tenants. De hash van 192-bit random is niet te kraken, maar dit hoort niet publiek | In de view: `custom_frontend_config - 'api_key_hash' - 'api_key_prefix' - 'webhook_url'`. Strikt additief qua contract: eerst greppen of een frontend die keys uit de view leest (zou niet moeten) |
| **B9** | **Laag** | De CI-rooktest van storefront-api is **niet netwerkloos**: `import_map.smoke.json` stubt alleen `deno.land/std/http/server.ts`. supabase-js@2, stripe@14.21.0 en resend@2.0.0 komen live van esm.sh, dus CI flaket mee bij een esm.sh-storing | Stubs (`stubs/supabase.ts`, `stripe.ts`, `resend.ts`, die er volgens de projectnotities al zijn) opnemen in `import_map.smoke.json`. Lokaal draaien in de sandbox kan dan ook |
| **B10** | **Laag** | npm audit (prod): 20 high. Relevant voor de app: `react-router-dom` 6.30.1 (XSS via open redirect, fix ≥6.30.3), `@tiptap/core` 3.16.0 en `prosemirror-view` (XSS bij plakken in de editor), `xlsx` 0.18.5 (prototype pollution, geen fix op npm), `lodash`. Daarnaast anon-leesbare marketplace-kolommen op `products` en `tenant_domains.verification_token` | Dependency-batch: react-router-dom, tiptap/prosemirror en lodash bumpen. Voor `xlsx` overstappen op de SheetJS-CDN-tarball (0.20.x) of exceljs. Kolom-REVOKE voor anon op de `bol_*/amazon_*/odoo_*/shopify_*/woocommerce_*`-kolommen, zoals bij `cost_price`. Eerst checken of `storefront-api` (service role) of custom frontends ze via anon lezen |

Klein, mag mee in een volgende batch: lint-baseline omlaag (`verify-lint-baseline.mjs --update`, 1.482 → 1.479). Drie ongebruikte `eslint-disable`-regels (`_shared/linkMandate.ts:19`, `handle-inbound-email/index.ts:154,226`). Drie `no-unused-expressions` nalezen (SEO-tabellen, `useBolcomKeywords.ts:176`).

## Efficiëntie-pass

1. **Automatiseren:** B2 en B9 zijn terugkerende valkuilen (esm.sh). Een CI-guard op ongepinde imports kost 20 regels en voorkomt herhaling. Hoort ook in skill `sellqo-engineering-rules` (dependency-imports): "CI faalt op `supabase-js@2` zonder patch".
2. **Deze check zelf:** dit hele rapport is een vast patroon. Kandidaat voor een geplande taak (nachtelijk) met een vast script (`scripts/health-check.mjs`): tsc, lint-baseline, alle check-scripts, deno test, pin-scan, secrets-scan en audit-samenvatting. De RLS-queries uit check 6 kunnen in een `docs/health-queries.sql`, zodat de nachtrun ze letterlijk kan hergebruiken.
3. **Skill/doc klopt niet meer:** CLAUDE.md §6 noemt npm-install niet. In de sandbox faalt `npm ci` (B4), en een lockloze install geeft een vertekende tsc (B3). Voorstel voor §6: "Install in de sandbox: `npm install --no-package-lock --legacy-peer-deps` en daarna `npm install --no-save @supabase/supabase-js@<versie uit bun.lock>`, anders geeft tsc valse TS2345-fouten."

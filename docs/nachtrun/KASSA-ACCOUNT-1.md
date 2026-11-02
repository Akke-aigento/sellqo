# KASSA-ACCOUNT-1 — eigen identiteit per kassatoestel — 2 november 2026

Branch `account-1` (worktree `/home/claude/sellqo-account`, vanaf `origin/main` @ `0e79ce1`). Twee commits:
1a (server) en 1b (frontend + docs). Niet gepusht, niet gedeployed, geen DB-writes. Plan en recon:
`docs/kassa-account-1-plan.md`. Akke koos optie D en alle aanbevelingen (beslispunten 1-4).

## Role-audit-blok (voor `docs/role-audit.md`)

## KASSA-ACCOUNT-1 — eigen identiteit per kassatoestel — 2 november 2026

**Root cause**
- De kassa meldde zich aan met een gewone SellQo-account (`src/kassa/app/KassaApp.tsx` → `screens/SignIn.tsx`,
  `useAuth().signIn`). Live is dat altijd een `tenant_admin` (0× `staff` in `user_roles`). Elk kassatoestel
  draaide dus met eigenaarsrechten: prijzen via REST, klanten, facturen, Odoo-mappings, instellingen.
- `staff` of een nieuwe rol in `user_roles` sluit dat niet: `staff` staat live in 385 policies (128 tabellen met
  schrijfrechten) en 233 policies laten elk lid toe via `get_user_tenant_ids()` zonder rolcheck.
- `p_device_id` in de kassa-RPC's was vrije tekst van de client (geen binding aan de aanroeper).

**Uitgevoerd**
- 1a, migratie `20261102100000_kassa_account_1.sql`:
  - tabellen `kassa_device_accounts` (toestel-user → zaak, kassa, `device_uuid`, `revoked_at`),
    `kassa_pair_codes` (enkel sha256 van code en QR-token, 10 min, eenmalig), `kassa_pair_attempts` (IP gehasht);
  - helpers `kassa_device_tenant()`, `kassa_device_terminal()`, `kassa_can_operate(tenant)` en
    `kassa_can_operate(tenant, device)` (toestel: `p_device_id` moet zijn eigen `device_uuid` zijn);
  - `kassa_pair_code_create` (enkel `tenant_admin`, eigen niet-virtuele kassa; nieuwe code vervangt de open code),
    `kassa_pair_claim` / `kassa_pair_complete` / `kassa_pair_release` (enkel service role; rate limit 5 fouten per
    IP per 15 min en 300 platformbreed; atomaire claim; opnieuw koppelen trekt de vorige koppeling van hetzelfde
    toestel in en geeft die users terug om te bannen);
  - `kassa_device_context()` (zaak: naam, taal, modules, adres/btw voor het ticket, IBAN/BIC voor de
    overschrijvings-QR; kassa; toestel), `kassa_device_unpair_self()`, `kassa_kitchen_orders(tenant)` (smalle
    orderlijst voor het keukenbord: geen e-mail, adres enkel straat/nr/postcode/gemeente bij levering);
  - ankerpatch op 26 kassa-RPC's (het plan telde 27; live nagetrokken: 26), elk anker precies één keer, marker
    `KASSA-ACCOUNT-1`, snapshot `snapshots.sellqo_20261102_fn_kassa_account_1`. 14 functies met `p_device_id`
    binden het toestel (`horeca_apply`, `horeca_pay`, `horeca_pay_begin`, `horeca_table_request_accept`,
    `kassa_approve`, `kassa_product_quick_edit`, `kassa_cash_move`, `kassa_shift`, `kassa_report_begin`,
    `kassa_report_finish`, `kassa_report_source`, `kassa_clock`, `kassa_heartbeat`, `kassa_staff_login`);
    `horeca_snapshot` krijgt `or coalesce(kassa_device_tenant() = p_tenant_id, false)`;
  - 35 additieve policies `kassa_device_<tabel>_<cmd>` (to authenticated, `tenant_id = kassa_device_tenant()`):
    select op de tabellen uit plan §1.2 (+ `printers`, `print_jobs` voor de printwaarschuwing), `pos_terminals`
    enkel de eigen kassa, insert/update `kitchen_tickets` en `table_reservations`, insert `fiscal_events`
    (`created_by = auth.uid()`, horeca-module) en `fiscal_audit_log` (`actor_id = auth.uid()`).
- 1a, edge functions: nieuw `kassa-device-pair` (zonder sessie: code/QR → `auth.admin.createUser` met
  `kassa-<uuid>@toestel.sellqo.app`, willekeurig wachtwoord, `email_confirm`, `app_metadata.kind = 'kassa'`, geen
  `user_roles`; eenmalig e-mail + wachtwoord terug; bij een fout code vrij en user weer weg), nieuw
  `kassa-device-revoke` (enkel `tenant_admin` van die zaak: `revoked_at`, pushtokens weg, ban 876000h),
  nieuw `_shared/kassaDeviceAuth.ts` (`requireRoleOrKassaDevice`) enkel in `horeca-receipt-mail` en
  `send-order-ready`. `_shared/auth.ts` ongewijzigd. Versiestempel `KASSA-ACCOUNT-1` (GET) in alle vier.
  `supabase/config.toml`: twee nieuwe functies, `verify_jwt = false` (ze controleren zelf).
- 1b, kassa (`src/kassa/`, fiscale release `sellqo-kassa-0.21.0`):
  - `KassaApp.tsx`: geen sessie → `PairDevice` (6 cijfers of QR via `html5-qrcode`; ook `/kassa?koppel=<token>`
    vanuit de gewone camera); sessie → `kassa_device_context()` → eigen `TenantContext.Provider` (geen
    `tenants`-select meer); gewone account → `NotADevice` "Dit is geen kassatoestel" met link naar Kassa (POS) ›
    Kassa's en "Afmelden en dit toestel koppelen"; ingetrokken toestel → "Dit toestel is ontkoppeld".
    Offline opstarten met de laatst gekende context (zelfde toestel-user).
  - `runtime.ts`: `deviceUuidForPairing()` geeft de bestaande `deviceUuid` uit `sq_kassa_device` mee bij het
    koppelen (ID-07 blijft gelijk, ook na ontkoppelen); `saveDevice(…, deviceUuid)`.
  - `setup.ts`: KASSA-START-1 (`canCreateTerminal`) vervangen door pure koppelhelpers (`parsePairInput`,
    `pairUrl`, `formatPairCode`, aftelling, foutmapping, `isDeviceUser`).
  - `screens/SignIn.tsx` en `screens/DeviceSetup.tsx` weg (bouw nieuw, sloop oud: kassa aanmaken staat al in
    beheer, `POS.tsx` "Nieuwe Terminal").
  - `KassaHome.tsx`: "Naar SellQo-beheer" opent altijd een nieuw venster na een waarschuwing (zelfde browser =
    gedeelde aanmelding); "Andere kassa kiezen" → "Ontkoppel dit toestel" (enkel eigenaar/verantwoordelijke,
    `kassa_device_unpair_self` + afmelden); de meldingen-dialoog linkt niet meer in hetzelfde venster naar beheer;
    keukenbord met `{ kassaDevice: true }`.
  - `version.ts`: `sellqo-kassa-0.21.0` met kopregel. Geen fiscale berichten gewijzigd.
- 1b, beheer:
  - `src/components/admin/pos/KassaTerminalDevices.tsx` (nieuw) vervangt `KassaDevicesStatus.tsx` (weg): per
    kassa de gekoppelde toestellen met hun hartslag (gezien, wachtend, versie), recente oude aanmeldingen
    ("niet gekoppeld", ≤ 7 dagen), "Toestel koppelen" (code + QR + aftelling 10 min, "Gekoppeld" zodra het
    toestel binnen is, elke 3 s ververst zolang het venster open is) en "Ontkoppelen" (bevestiging →
    `kassa-device-revoke`). Enkel zaakvoerder/platformbeheer ziet de knoppen. Geen nieuw zijbalk-item.
  - `src/hooks/useKassaDevices.ts`: `useKassaDeviceAccounts`, `terminalDeviceRows`.
  - `src/pages/admin/POS.tsx`: de sectie per kassa (horecaspoor).
  - `src/components/admin/kitchen/useKitchenBoard.ts`: optie `kassaDevice` → `kassa_kitchen_orders`; beheer
    ongewijzigd op REST.
  - `src/components/ProtectedRoute.tsx`: een toestelaccount in beheer → `/kassa` (anders zou het als gebruiker
    zonder winkel de onboarding zien).
  - i18n: `kassa.pair.*`, `kassa.notDevice.*`, `kassa.home.{unpair*,toAdminWarning,toAdminOpen}`,
    `admin.pos.kassaDevice.*` in nl/en/fr/de/uk; `kassa.signIn`, `kassa.setup`, `kassa.home.changeTerminal*` weg.
  - `doc_articles` (migratie `20261102100010_kassa_account_1_docs.sql`): nieuw "Een kassatoestel koppelen en
    ontkoppelen" (`/admin/pos`), en in "Kassapersoneel, pincodes …" de zin over aanmelden met je SellQo-account
    vervangen (anker nagetrokken op de live inhoud).

**Security-keuzes**
- Default-deny: de toestel-user staat niet in `user_roles`; `get_user_tenant_ids`/`has_tenant_role` geven niets.
  Geen enkele bestaande policy, functie of enum gewijzigd buiten de 26 ankers; enkel additieve policies.
- Bewezen dicht voor het toestel (SQL-suite): UPDATE `products`/`product_variants` (0 rijen, prijzen
  onaangeroerd), SELECT `tenants`/`customers`/`invoices`/`orders`/`user_roles` (0 rijen), INSERT `user_roles`
  (42501), `kassa_pair_code_create` (42501), andere winkel (RPC's 42501, tabellen 0 rijen), schrijven op
  `kassa_device_accounts` (42501), `fiscal_audit_log` lezen (0), `fiscal_events` als andere user (42501).
- Koppelcode: enkel hashes in de databank, eenmalig, 10 min, nieuwe code vervangt de open code; rate limit per IP
  (advisory lock per IP-hash tegen gelijktijdige pogingen) en platformbreed; de limiet verbruikt de code niet.
  Wachtwoord van de toestel-user wordt nergens bewaard (harnas-test).
- Ontkoppelen werkt meteen (elke controle leest `revoked_at`, ook met een nog geldig toegangstoken) en de user
  wordt gebannen (geen refresh meer).
- Gevonden en gedicht tijdens de bouw: `horeca_snapshot` met `or kassa_device_tenant() = p_tenant_id` zonder
  `coalesce` liet elke ingelogde gebruiker zonder lidmaatschap door (`not (false or null)` = null = geen
  weigering). Test `ok_stranger_snapshot_refused` bewaakt dit.
- Geen secrets in de migraties (grep op `eyJ` leeg).

**Gedeelde-paden-waarschuwing**
- Gedeelde tabellen (`products`, `categories`, `kitchen_tickets`, …): enkel nieuwe policies `to authenticated` met
  `tenant_id = kassa_device_tenant()`; voor elke niet-toestel-user is dat null → geen extra rijen. Geen enkele van
  `tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages` geraakt; `storefront-api`,
  `storefront-customer-api`, `storefront-resolve` ongewijzigd (eerste wet).
- `_shared/auth.ts` ongewijzigd; `_shared/kassaDeviceAuth.ts` wordt enkel door `horeca-receipt-mail` en
  `send-order-ready` geïmporteerd (grep). Hun gedrag voor bestaande aanroepers is gelijk (zelfde 401/403).
- `useKitchenBoard` is gedeeld met beheer: enkel met `kassaDevice: true` (alleen `KassaHome`) loopt de RPC.

**Verificatie**
- `scripts/gks/sql/run.sh` (eigen cluster, poort 54351): alle suites "geslaagd" + nieuw
  `test_kassa_account.sql` (108 controles). Exit 1 komt enkel van de bestaande fout in `test_kaart.sql`
  (ook op de baseline zonder deze batch). Extra run met de migratie vóór `test_kassa_nachtrun.sql`: groen.
- Live read-only natrek (2-11-2026): de 26 ankers staan precies één keer in de live definities; geen botsende
  tabel-/functie-/policynamen.
- `deno test` `scripts/promo-compare/kassaDevicePair.test.ts` (9) + `horecaReceiptMail.test.ts` (5): 14/14.
- `deno check` (`/tmp/im_real.json`) op de 4 functies: exit 0. `node scripts/verify-edge-pins.mjs`: ok.
- `npx tsc --noEmit -p tsconfig.app.json`: exit 0. `npx vite build`: exit 0.
- `npx vitest run src/kassa src/components/admin/kitchen src/test/kassaTerminalDevices.test.ts`: groen.
- `node scripts/i18n-parity.mjs`: 5 talen, volledige pariteit. `check-i18n-used-keys`, `check-dead-buttons`: ok.
- Lint: geen nieuwe fouten in de gewijzigde bestanden; `verify-lint-baseline`: 1457 → 1456.
- Harnas `kassa-koppelen` (nieuw, vervangt `kassa-setup`) op 390/1280: koppelscherm (te kort, foute code, te
  veel pogingen, gelukt + device_uuid bewaard), "geen kassatoestel", "ontkoppeld", beheer (lijst, code + QR +
  aftelling, "Gekoppeld", ontkoppelen met bevestiging). `kassa-home` opnieuw: groen.

**Bewust ongemoeid / Vervolg**
- KASSA-ACCOUNT-2: `tenant_admin`/`staff` uit `kassa_can_operate` halen waar beheer de RPC niet gebruikt
  (eerst grep: `horeca_notify_device_*`, `kassa_report_*`, `horeca_apply` in beheer). Pas dan is "kassa met
  eigenaarsaccount" ook server-side dicht.
- Restrisico: een toestel-user valt onder `"Authenticated users can insert their own tenant"`
  (`can_create_tenant(auth.uid(), owner_email)`): hij zou een nieuwe, lege winkel kunnen aanmaken (geen toegang
  tot de echte zaak). Voorstel KASSA-ACCOUNT-2: `can_create_tenant` weigert `app_metadata.kind = 'kassa'`.
- Restrisico: toestel-users hebben een `profiles`-rij (trigger `handle_new_user`, naam "Kassa · …"); controleer
  of platformlijsten van gebruikers ze moeten filteren.
- Restrisico (plan): `products` select toont ook `cost_price` aan het toestel (tabelbrede grant).
- De drie losse gaten (`bulk_adjust_prices`, `product_variants.price`, `guard_product_commercial_fields`) zitten in
  PRIJS-GATEN-1 (parallel), niet hier.
- `horeca_table_request_*`, `horeca_table_call_handle`, `horeca_notify_device_*` bestaan niet in de lokale
  testdatabank: hun patch is live-anker-nagetrokken, niet lokaal uitgevoerd. Natrekken na de uitrol (zie hieronder).
- Nieuwe vitest: `src/test/kassaTerminalDevices.test.ts` (hoofdsessie: toevoegen aan de Vitest-stap in CI).
  `src/kassa/app/__tests__/setup.test.ts` staat al in CI (inhoud vervangen). Nieuwe deno-test:
  `scripts/promo-compare/kassaDevicePair.test.ts` (toevoegen aan de promo-compare-stap in CI).

## Uitrolvolgorde (per stap Akke's go)

1. Migratie `20261102100000_kassa_account_1.sql`. Natrek (aparte `query_database`-aanroep):
   `select count(*) from pg_proc where pronamespace='public'::regnamespace and position('KASSA-ACCOUNT-1' in pg_get_functiondef(oid))>0`
   → 26 gepatcht + de nieuwe functies; `select count(*) from pg_policies where policyname like 'kassa\_device\_%' and tablename <> 'kassa_device_accounts'` → 35.
   Rol-impersonatie (aparte aanroep, `begin; … rollback;`): een `authenticated` zonder lidmaatschap krijgt 42501
   op `horeca_snapshot(<De Wissel>)`.
2. Edge functions deployen (Lovable-agent, deploy-only, "lukt iets niet: STOP"): **`kassa-device-pair`,
   `kassa-device-revoke`, `horeca-receipt-mail`, `send-order-ready`**. Vingerafdruk: `net.http_get` op elke functie
   → `{"version":"KASSA-ACCOUNT-1"}`.
3. Publish (`deploy_project`) en bundelcheck: nieuwe `/assets/index-*.js` bevat `kassa-device-pair` en
   `sellqo-kassa-0.21.0`.
4. Migratie `20261102100010_kassa_account_1_docs.sql` (na de publish).
5. De Wissel: in beheer Kassa (POS) › Kassa's › Kassa 1 › Toestel koppelen; op de iPhone `/kassa` → "Dit is
   geen kassatoestel" → "Afmelden en dit toestel koppelen" → code. Natrek: `kassa_device_accounts` 1 rij met de
   bestaande `device_uuid` (één van de vijf in `kassa_devices`), `kassa_devices.sw_version = 'sellqo-kassa-0.21.0'`,
   een PIN-aanmelding en een rekening lukken, "Mail bon" en keukenbord werken.
6. Na een paar dagen: KASSA-ACCOUNT-2.

## Changelog-tekst (NL, tweede persoon)

- **Titel:** Elk kassatoestel krijgt een eigen koppeling
- **Beschrijving:** Je koppelt SellQo Kassa voortaan met een code of QR uit Kassa (POS) › Kassa's, in plaats van
  met je eigen SellQo-account. Het toestel krijgt enkel kassarechten (geen prijzen, klanten of facturen) en je
  ontkoppelt het daar met één klik.
- Type: `security`.

## Samenhang

| Plek | Deed | Wat verandert | Gedaan |
|---|---|---|---|
| Kassa › aanmelden (`SignIn.tsx`) | e-mail + wachtwoord van een SellQo-account | koppelscherm (code/QR) | vervangen, oud weg |
| Kassa › kassa kiezen (`DeviceSetup.tsx`, KASSA-START-1) | terminal kiezen of aanmaken in de app | de koppelcode bepaalt de kassa; aanmaken enkel in beheer (bestond al) | weg |
| Kassa › ⋯ › Andere kassa kiezen | lokaal vergeten | "Ontkoppel dit toestel" (eigenaar/verantwoordelijke) | aangepast |
| Kassa › ⋯ › Naar beheer | zelfde venster op web | altijd nieuw venster + waarschuwing | aangepast |
| Kassa › Meldingen › "Beheren" | link naar `/admin/pos` in hetzelfde venster | geen link (tekst "beheer elders") | aangepast |
| Beheer › Kassa (POS) › Kassa's (`KassaDevicesStatus`) | hartslag per toestel | één lijst gekoppelde toestellen + koppelen/ontkoppelen | vervangen, oud weg |
| Helpartikels | "Meld het toestel aan met je SellQo-account" | nieuw artikel + zin vervangen | migratie |
| Harnas `kassa-setup` | DeviceSetup | `kassa-koppelen` | vervangen |
| Eigenaar die `/kassa` opent | kassa met eigenaarsrechten | "Dit is geen kassatoestel" + link | nieuw |
| Toestelaccount in `/admin` | n.v.t. | omleiding naar `/kassa` | nieuw |

Bewust laten staan: knoppen "Open kassa-app"/"Kassa openen" in beheer (leiden naar `/kassa`, dat nu uitlegt hoe
te koppelen); de 5 oude `kassa_devices`-rijen van De Wissel (historiek; enkel die van de laatste 7 dagen tonen in
beheer als "niet gekoppeld").

## Efficiëntie-pass en skill-onderhoud

- Terugkerend patroon (KASSA-RECHTEN-1, KEUKEN-VEILIG-1, nu 26 RPC's): ankerpatch in een `values`-lus met
  tolerante testmodus (`sellqo.kassa_account_test`). Voorstel: helper `scripts/gks/sql/patch_function.sql` + een
  regel in `sellqo-db-safety`.
- Voorstel `sellqo-db-safety` (nieuwe valkuil): "Een extra toegangsvoorwaarde met `or <functie>() = x` in een
  `if not (…) then raise` is lek als die functie null kan geven: `not (false or null)` is null en weigert niet.
  Altijd `coalesce(…, false)`." (gevonden in deze batch, vóór livegang.)
- Voorstel `sellqo-db-safety`: "Een smalle identiteit (toestel, kiosk) nooit via `user_roles`: 233 policies laten
  elk lid toe zonder rolcheck. Eigen tabel + expliciete policies (default-deny)."

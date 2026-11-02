# KASSA-ACCOUNT-1 — recon en plan: een eigen identiteit per kassatoestel — 2 november 2026

Alleen recon. Niets gebouwd, niets gewijzigd, geen DB-writes. Code gelezen op `origin/main` @ `0e79ce1`
(worktree `/home/claude/sellqo-recon`, detached). Alle DB-feiten read-only via `query_database` op
project 9932a7fe op 2-11-2026.

Scope-regel (projectregel 28-10): geen nieuwe feature-sleutel, geen prijzenpagina-label; geldt voor elke
winkel met de kassa (`horeca`-module). Grandfathering n.v.t. (enkel demo/test gebruikt de kassa).

---

## 0. Kernfeiten in vijf regels

1. De kassa meldt zich aan met een gewone SellQo-account (`src/kassa/app/KassaApp.tsx:107` → `SignIn.tsx`,
   e-mail + wachtwoord via `useAuth().signIn`). Personeel werkt daarna enkel met een PIN (`pos_cashiers`),
   zonder eigen JWT. Live: `user_roles` = 16× `tenant_admin` (11 winkels), 1× `marketing`, 1× `platform_admin`,
   **0× `staff`**. Elk toestel draait dus op een eigenaars-JWT.
2. Live toestellen: enkel **Café De Wissel** (`demo-bar`, `is_demo = true`, tenant `dfa62de5-…`): 1 terminal
   (`Kassa 1`, `7126e8b1-…`), 5 rijen in `kassa_devices` (5 verschillende `device_id`'s voor dezelfde terminal,
   versies 0.12.0 → 0.20.0), aangemeld als `akke@studioakke.com` (tenant_admin). 7 open rekeningen, 0
   `fiscal_events`, 2 `fiscal_audit_log`-rijen. **Correctie op de opdracht:** Test Horeca Small
   (`test-horeca-small`, `3d8cf072-…`) heeft **geen** `pos_terminals` en geen `kassa_devices`; daar draait geen
   kassa. Verder bestaan er terminals bij Bistro Mirabelle en VanXcel (geen toestellen). Fiscale modus overal
   `off`/leeg: nergens FDM of simulator live.
3. `staff` is géén smalle rol: live staat `staff` in **385 policies op 157 tabellen, waarvan 128 met
   schrijfrechten** (orders, producten, categorieën, klanten …). "Toestel = staff" sluit het gat dus niet.
4. Daarnaast laten **233 policies** elk lid van de winkel toe via `get_user_tenant_ids()` zonder rolcheck
   (o.a. SELECT op `customers`, `invoice_archive`, `proforma_invoices`, `odoo_*_mappings`, `tenant_domains`,
   `tenant_ai_credits`; schrijven op 30 tabellen o.a. `odoo_tax_mappings`, `license_keys`, `import_jobs`,
   `media_assets`, `kitchen_tickets`, `fiscal_audit_log`). Elke identiteit met een `user_roles`-rij — ook een
   nieuwe rol `kassa` — erft die toegang.
5. `p_device_id` is in alle kassa-RPC's vrije tekst van de client (16 functies, geen enkele bindt hem aan de
   aanroeper; `horeca_apply` controleert hem nergens). Het toestel heeft vandaag geen identiteit, alleen een
   UUID in `localStorage` (`runtime.ts:59-61`).

---

## 1. Inventaris

### 1.1 Aanmelden en koppelen vandaag

| Plek | Doet nu | Wat verandert (aanbevolen optie D) |
|---|---|---|
| `src/kassa/app/KassaApp.tsx:105-117` | Geen sessie → `SignIn`; daarna `TenantProvider` (alle winkels van de account) → `Device` | Geen sessie → **koppelscherm** (code/QR). Tenant komt uit de toestelkoppeling, niet uit `useTenant` |
| `src/kassa/app/screens/SignIn.tsx` (hele bestand) | E-mail + wachtwoord van een SellQo-account ("beheerder of medewerker") | Vervangen door `PairDevice.tsx` (6-cijferige code of QR). Wachtwoord-login verdwijnt uit de kassa |
| `src/kassa/app/screens/DeviceSetup.tsx:26-36` | KASSA-START-1: tenant_admin maakt via REST-insert op `pos_terminals` een kassa aan (`setup.ts canCreateTerminal`) | Verhuist naar beheer: kassa aanmaken + toestel koppelen in **Kassa (POS) › Kassa's** (`src/pages/admin/POS.tsx`). In de kassa-app verdwijnt het; een toestel kiest geen terminal meer, de koppelcode bepaalt hem |
| `DeviceSetup.tsx:43` | Lijst van terminals (REST, `pos_terminals_select` = tenant_admin/staff) | Weg: de koppeling legt de terminal vast |
| `runtime.ts:46-66` `loadDevice/saveDevice` | `sq_kassa_device` in localStorage: tenantId, terminalRowId, deviceUuid (random) | Blijft als cache; bron wordt de serverrij `kassa_device_accounts`. `deviceUuid` blijft behouden bij koppelen (zie GKS) |
| `KassaApp.tsx:36-39` | "toestel van een zaak waar deze account niet bij hoort → opnieuw kiezen" | Wordt: koppeling ingetrokken → terug naar koppelscherm |
| `pos_terminals` (live 3 rijen) | Kassa = terminal; `settings.fiscal` (posId, terminalId, vatNo …) | Ongewijzigd. Nieuwe kolom niet nodig |
| `kassa_devices` (`20261024150000_live_1_kassa_heartbeat.sql:12`) | Hartslag per `(tenant, device_id)`; geen koppeling aan een auth-user | Ongewijzigd (strikt additief). Optioneel: weergave in beheer naast de koppelrij |
| `horeca_notify_devices` (`20261028180000_melding_1.sql:40`) | Meldingsprofiel per `install_id`; `created_by` = auth-user | Werkt door: `created_by` wordt de toestelaccount. RPC's `horeca_notify_device_save/remove/list` moeten het toestel toelaten |
| `device_tokens` (push, `src/lib/webPush.ts`, `src/native/pushRegistration.ts`) | Token per `user_id` = de eigenaar → push "per toestel" hangt nu aan de eigenaarsaccount | Wordt per toestelaccount: beter (persoonlijke meldingen van de eigenaar komen niet meer op de kassa). Policies `auth.uid() = user_id` werken zonder wijziging |
| `KassaHome.tsx:181-185` "naar beheer" (owner/manager-PIN) | Opent `/admin` in hetzelfde venster (web) of extern | Web: zelfde origin = zelfde Supabase-sessie (`client.ts` is Lovable-gegenereerd, één storage-key). Met een toestelsessie opent beheer als toestel → leeg/kapot. Zie beslispunt 3 |
| `useTenant.tsx:156-162` | Geen winkels → `repair-tenant-access` met het e-mailadres | Mag voor een toestelaccount nooit lopen; de kassa gebruikt een eigen `TenantContext.Provider` (export bestaat, `useTenant.tsx:110`) |

### 1.2 Wat de kassa rechtstreeks aanspreekt

Bron: grep op `.from(`, `.rpc(`, `functions.invoke(` in `src/kassa` plus de gedeelde hooks/componenten die de
kassa importeert (`useFloorPlan`, `usePrepStations`, `useKitchenBoard`, `lib/horeca/reservations`,
`lib/deviceAlerts`, `webPush`). Live policies uit `pg_policies`.

**Tabellen (REST)**

| Tabel | Kassa doet | Bestand:regel | Live policy (relevant) | Toestel nodig |
|---|---|---|---|---|
| `pos_terminals` | select (eigen), insert (KASSA-START-1) | `KassaApp.tsx:58`, `DeviceSetup.tsx:29,43` | select admin/staff, insert admin | select eigen terminal |
| `pos_cashiers` | select id/naam/rol | `PinLock.tsx:33`, `ApprovalDialog.tsx:35`, `ProductQuickEdit.tsx:31` | select admin/staff; **`pin_hash`, `insz_encrypted`, `failed_pin_attempts` niet gegrant aan authenticated** (goed) | select |
| `pos_sessions` | select | `CashScreen.tsx:37` | select admin/staff/accountant | select |
| `products`, `categories`, `product_categories`, `product_addon_groups`, `product_addon_options`, `vat_rates` | select (kaart) | `horeca/useCatalog.ts:53-61` | select = lid (`get_user_tenant_ids`) | select; **geen** update |
| `check_lines` | select | `useCatalog.ts:103` | select = lid | select |
| `check_online_payments`, `kitchen_tickets`, `prep_stations` | select | `useKassaSignals.ts:70-79` | select = lid | select |
| `kitchen_tickets` | insert/update (keukenbord) | `components/admin/kitchen/useKitchenBoard.ts:68-78` | **ALL = lid, geen rolcheck** | insert/update |
| `orders` | select (keukenbord webshop/QR) | `useKitchenBoard.ts:38` | select = lid | select (bevat klantgegevens; zie restrisico) |
| `horeca_state`, `table_requests`, `table_calls` | select | `horeca/store.ts:64-77` | select = lid | select |
| `kassa_reports` | select | `reportActions.ts:158` | select = lid | select |
| `horeca_pay_settings`, `fulfillment_settings`, `reservation_settings` | select | `paySettings.ts:61,89,116`, `requests.ts:81`, `reservations.ts:131` | select = lid; write admin | select |
| `dining_areas`, `dining_tables`, `floor_markers`, `prep_station_routes` | select (zaalplan/routes) | `useFloorPlan.ts:36-38`, `usePrepStations.ts:25-26` | select = lid | select |
| `table_reservations` | select/insert/update | `horeca/reservationActions.ts:8-20` → `reservations.ts:111` | admin/staff | select/insert/update |
| `fiscal_events` | insert + select | `runtime.ts:197,218,225,260` | insert: `created_by = auth.uid()` + admin/staff + horeca-module; select = lid | insert/select |
| `fiscal_audit_log` | insert | `runtime.ts:271` | insert: `actor_id = auth.uid()` + lid | insert |
| `horeca_notify_devices` | select | `lib/deviceAlerts.ts:52` | select = lid | select |
| `device_tokens` | ins/upd/del eigen | `webPush.ts:126-236`, `pushRegistration.ts:30,103` | `auth.uid() = user_id` | werkt al |
| `tenants`, `tenant_subscriptions`, `user_roles` | select via `useTenant`/`useAuth` | `useTenant.tsx:143,188`, `useAuth.tsx:195` | lid / eigen | **niet** geven: vervangen door één RPC (tenants bevat o.a. `iban`, `stripe_account_id`, `domain_verification_token`) |

**RPC's (alle SECURITY DEFINER)** — rolcheck live (`has_tenant_role(..., array[...])` uit `pg_proc.prosrc`):

| RPC | Aanroep in kassa | Check nu |
|---|---|---|
| `horeca_apply`, `horeca_pay`, `horeca_pay_begin`, `horeca_pay_release` | `store.ts:54`, `payActions.ts:152-252` | admin/staff |
| `horeca_snapshot` | `store.ts:59` | **lid** (`get_user_tenant_ids`), geen rol |
| `horeca_table_request_accept/reject`, `horeca_table_call_handle` | `requests.ts:48,66,105` | admin/staff |
| `kassa_staff_login`, `kassa_staff_logout` | `PinLock.tsx:57`, `staffSession.ts:9` | admin/staff |
| `kassa_approve` | `approvals.ts:38` | admin/staff |
| `kassa_product_quick_edit` | `productActions.ts:25` | admin/staff + PIN owner/manager |
| `kassa_cash_move`, `kassa_shift`, `kassa_report_finish` | `fiscalOps.ts:82` via `cashActions.ts:46,61`, `reportActions.ts:131` | admin/staff |
| `kassa_report_begin/due/source/release` | `reportActions.ts:92-142` | admin/staff |
| `kassa_clock`, `kassa_clock_state`, `kassa_my_shift` | `attendance.ts:30,43`, `MyShiftScreen.tsx:20` | admin/staff |
| `kassa_heartbeat` | `heartbeat.ts:31` | admin/staff |
| `horeca_notify_device_save/remove`, `horeca_notify_devices_list` | `lib/deviceAlerts.ts:46-68` | admin/staff |

Totaal **27 RPC's** die het toestel moet blijven mogen. Interne helpers (`horeca_apply_one`,
`kassa_require_approval`, `kassa_staff_session_*`, `kassa_open_session` …) hebben geen execute voor
authenticated en hoeven niet mee.

**Edge functions**

| Functie | Aanroep | Auth nu | Nodig |
|---|---|---|---|
| `horeca-receipt-mail` | `MailReceipt.tsx:24` (`source: 'kassa'`) | `authenticateRequest` + `requireRole(tenant_admin, staff)` (`index.ts:76,87`) | toestel toelaten |
| `send-order-ready` | `useKitchenBoard.ts:106` | `authenticateRequest(req, order.tenant_id)` (`index.ts:60`): lid via `user_roles` | toestel toelaten |
| `horeca-device-push` | door triggers (service role) | n.v.t. | ongewijzigd |

`_shared/auth.ts` niet aanpassen (gedeeld door tientallen functies → allemaal herdeployen). Beter: nieuw klein
`_shared/kassaDeviceAuth.ts` dat enkel deze twee functies importeren.

### 1.3 Losse gaten (los van de toestelidentiteit)

| Gat | Feit (live) | Voorstel |
|---|---|---|
| `bulk_adjust_prices` | Checkt enkel "producten van eigen winkel" via `get_user_tenant_ids`, **geen rolcheck** | `has_tenant_role(tenant, array['tenant_admin','staff'])` toevoegen |
| `product_variants.price` | UPDATE-policy admin/staff/**warehouse**, triggers enkel `trg_product_variants_media_register`, `update_product_variants_updated_at`: **geen guard** | Guard-trigger zoals op products (warehouse/marketing geen prijs) |
| `guard_product_commercial_fields` | **Default-allow**: een rol die niet admin/staff én niet marketing/warehouse is (`IF NOT v_beperkt THEN RETURN NEW`) mag alles. Vandaag onschuldig (RLS houdt `viewer`/`accountant` tegen), maar fout bij elke nieuwe rol | Omdraaien: enkel admin/staff/service/platform mogen prijzen; elke andere rol 42501 op prijsvelden |

Met optie D (hieronder) kan een toestel `products`/`product_variants`/`bulk_adjust_prices` sowieso niet meer
raken (geen `user_roles`-rij → `get_user_tenant_ids` leeg → UPDATE-policy en de tenantcheck in
`bulk_adjust_prices` falen). De drie gaten blijven wel open voor warehouse/elke toekomstige rol en horen dicht.

---

## 2. Opties voor de identiteit van een toestel

Alle opties hebben hetzelfde UX-kader: de eigenaar maakt in beheer een eenmalige koppelcode (6 cijfers +
QR, 10 min geldig, gebonden aan zaak + terminal), het toestel ruilt die in.

### A. Nieuwe `app_role` `kassa` in `user_roles`, één auth-user per toestel

- **Hoe:** enum uitbreiden, edge function maakt de auth-user (patroon `create-invite-account:106`,
  `auth.admin.createUser`, `email_confirm: true`) + `user_roles(role='kassa', tenant_id)`.
- **Voor:** past in het bestaande rollenmodel; `useAuth`/`useTenant` werken zonder shim.
- **Tegen / risico:** de toestelaccount wordt "lid" → erft de **233 lidmaatschapspolicies** (klanten, facturen,
  Odoo-mappings lezen; 30 tabellen schrijven). Afsluiten = `get_user_tenant_ids` laten `kassa` uitsluiten: die
  functie zit in 233 policies + 34 functies → enorme blast radius. `tenants` select geeft iban/Stripe-ID's.
  `ALTER TYPE … ADD VALUE` kan niet in dezelfde transactie gebruikt worden (twee migraties).
  `guard_product_commercial_fields` is default-allow voor een onbekende rol.
- Bestaande toestellen: opnieuw koppelen. Offline: zoals vandaag (refresh-token). Push: per toestel. GKS: ok.

### B. Eigen JWT (custom claim) via een edge function die de koppelcode inruilt

- **Hoe:** functie tekent zelf een JWT (`role: authenticated`, `sub` = toestel-ID, claim `kassa_tenant`).
- **Tegen:** vereist de JWT-signing secret in de functie (Lovable Cloud: niet gegarandeerd beschikbaar, en
  bij asymmetrische signing keys niet mogelijk); geen refresh-token → toestel moet periodiek online
  her-munten, offline na verloop dood; `sub` zonder `auth.users`-rij breekt FK's (`fiscal_events.created_by`,
  `device_tokens.user_id`, `horeca_notify_devices.created_by`). Eigen sleutelbeheer = nieuw secret-risico.
- Variant **anonieme Supabase-login + `kassa_pair(code)`-RPC**: geen secret nodig, maar anonieme logins
  moeten projectbreed aan (Cloud → Auth settings, niet via de agent), anonieme users hebben rol
  `authenticated` en vallen dus onder élke `to authenticated`-policy (o.a. "Authenticated users can insert
  their own tenant"). Afgeraden.

### C. Bestaande `staff`-rol (+ kolom-grants)

- **Hoe:** toestelaccount met `staff`, `revoke update (price, …) on products from authenticated`.
- **Tegen:** `staff` schrijft live op **128 tabellen** (orders, klanten, producten, categorieën, Kaart …):
  het gat wordt nauwelijks kleiner. Kolom-grants gelden voor elke rol, dus ook tenant_admin (breekt
  productformulier, raster, Kaart, AI-acties; zie PRIJS-REST-RECON §4B) en elke nieuwe kolom moet expliciet
  gegrant worden. Afgeraden.

### D. (aanbevolen) Eigen auth-user per toestel, **buiten `user_roles`**, met een eigen koppeltabel

- **Hoe:**
  - Nieuwe tabel `kassa_device_accounts (user_id pk → auth.users, tenant_id, terminal_id, device_uuid,
    name, paired_by, paired_at, revoked_at, last_seen_at)`. RLS aan; select voor tenant_admin van de zaak en
    voor het toestel zelf (`user_id = auth.uid()`); schrijven enkel via functies.
  - Nieuwe tabel `kassa_pair_codes (code_hash, tenant_id, terminal_id, created_by, expires_at, used_at)`; RLS aan,
    geen grants.
  - RPC `kassa_pair_code_create(p_tenant_id, p_terminal_id)` (enkel tenant_admin) → code + QR-payload.
  - Edge function `kassa-device-pair` (zonder JWT): code + `device_uuid` → controleert/verbruikt de code
    (rate limit, 5 fouten = blokkeren), maakt met de service role een auth-user (`kassa-<uuid>@devices.sellqo.app`
    of vergelijkbaar adres zonder mailbox, random wachtwoord, `email_confirm: true`, `app_metadata.kind = 'kassa'`),
    schrijft de koppelrij en geeft eenmalig e-mail + wachtwoord terug; het toestel doet daarna
    `signInWithPassword` en houdt de sessie (refresh-token) zoals vandaag. Geen eigen JWT-signing.
  - Helper `public.kassa_device_tenant()` (SECURITY DEFINER, STABLE): tenant van `auth.uid()` als de
    koppeling niet ingetrokken is; en `public.kassa_can_operate(p_tenant_id)` =
    `has_tenant_role(p_tenant_id, array['tenant_admin','staff']) or kassa_device_tenant() = p_tenant_id`.
  - De 27 RPC's: `has_tenant_role(p_tenant_id, array['tenant_admin','staff'])` → `kassa_can_operate(p_tenant_id)`
    (ankerpatch zoals KASSA-RECHTEN-1: `pg_get_functiondef` + `replace` exact één keer, marker, snapshot).
    Daarbij **`p_device_id` binden**: voor een toestelaccount moet `p_device_id = device_uuid` van de koppelrij,
    anders 42501. Voor een gewone account (overgang) ongewijzigd.
  - Eigen policies (additief, `to authenticated`, `kassa_device_tenant() = tenant_id`) op de ±25 tabellen uit
    §1.2: select; insert/update op `kitchen_tickets`, `table_reservations`; insert op `fiscal_events`
    (`created_by = auth.uid()`), `fiscal_audit_log` (`actor_id = auth.uid()`); `pos_terminals` enkel de eigen
    terminal. **Geen** policy op `products` UPDATE, `product_variants`, `tenants`, `customers`, facturen, enz.
  - RPC `kassa_device_context()` → `{tenant: {id, name, slug, language, business_modules, …}, terminal: {id,
    name, settings}, device_uuid}`; de kassa-app levert daarmee een eigen `TenantContext.Provider`, zodat
    `useFloorPlan`/`usePrepStations`/`useKitchenBoard` blijven werken zonder `tenants`-select.
  - Intrekken: beheer → "Ontkoppel" zet `revoked_at` (werkt meteen, want elke check leest de koppelrij) en een
    edge function bant/verwijdert de auth-user (`auth.admin.updateUserById(ban_duration)`), revoket
    `device_tokens` van die user.
- **Voor:** **default-deny**: de toestelaccount staat in geen enkele bestaande policy (geen `user_roles`-rij →
  `get_user_tenant_ids` en `has_tenant_role` geven niets). Alleen wat we expliciet openzetten. Raakt geen enum,
  geen `get_user_tenant_ids`, geen van de 233/385 bestaande policies. Echte refresh-tokens (offline zoals nu),
  echte `auth.users`-rij (FK's ok), push per toestel gratis. Spoor: `fiscal_events.created_by` /
  `fiscal_audit_log.actor_id` = het toestel.
- **Tegen / risico:** 27 functies patchen (mechanisch, maar groot); ±25 nieuwe policies; de kassa-app moet
  af van `useTenant`/`useAuth().roles` (KassaApp, DeviceSetup, KassaHome, ReportsScreen, PayDialog). Toestel-
  accounts zijn auth-users: niet meetellen in teamlijsten/limieten (staan niet in `user_roles`, dus vanzelf
  niet), wel zichtbaar in `auth.users`.
- **Bestaande toestellen:** enkel De Wissel (demo). Overgang: RPC's aanvaarden tijdelijk ook nog
  tenant_admin/staff (dat is `kassa_can_operate`), dus oude kassa's blijven werken tot ze herladen; de nieuwe
  versie toont het koppelscherm. Bij koppelen wordt de bestaande `deviceUuid` uit `sq_kassa_device`
  meegegeven, zodat `device_id` in `kassa_devices`/fiscale berichten gelijk blijft.
- **Offline:** ongewijzigd t.o.v. vandaag (Supabase-sessie + refresh). Intrekken werkt pas bij de volgende
  online-aanroep (RPC weigert). Koppelen vraagt online.
- **Capacitor/native:** `signInWithPassword` is gewoon supabase-js; push via `device_tokens` met de
  toestel-user; printen (`src/kassa/print`, ESC/POS/HTML) los van auth. Het aparte native kassa-target
  (`apps/kassa/capacitor.config.ts`) heeft nog geen native projecten; op web en in de admin-app draait
  `/kassa` (`App.tsx:204`).
- **GKS:** `deviceId` (ID-07, `runtime.ts:136`) blijft de `deviceUuid`; nu server-side gebonden aan één
  account + terminal (vandaag 5 willekeurige ID's voor één terminal bij De Wissel). `terminalId` blijft uit
  `pos_terminals.settings.fiscal` of `terminalRowId`. Geen enkel fiscaal bericht verandert. Tip voor de
  eisenmatrix: "toestelidentiteit server-side gebonden" kan als bewijs bij ID-07 (matrix hier niet leesbaar,
  natrekken).

### Vergelijking

| | A rol `kassa` | B eigen JWT / anoniem | C `staff` | **D eigen account buiten user_roles** |
|---|---|---|---|---|
| Sluit prijs-REST | ja (mits guard default-deny) | ja | gedeeltelijk | **ja, vanzelf** |
| Sluit "alles wat eigenaar kan" | nee (233 lid-policies) | ja/nee (anon: breed) | nee (128 schrijftabellen) | **ja (default-deny)** |
| Blast radius DB | hoog (enum + `get_user_tenant_ids`) | middel/hoog | laag DB, hoog functioneel | **middel, enkel additief + 27 RPC-patches** |
| Offline | ok | slecht (B) | ok | **ok** |
| Secrets | geen | JWT-secret (B) | geen | **geen** |

---

## 3. Wat er verandert

### 3.1 Beheer (geen fiscale release)

- **Kassa (POS) › Kassa's** (`src/pages/admin/POS.tsx:255` toont al `KassaDevicesStatus` per terminal):
  per terminal knop **"Toestel koppelen"** → venster met 6-cijferige code + QR + aftelling (10 min).
  Daaronder de gekoppelde toestellen (naam, gekoppeld door/op, laatst gezien uit `kassa_devices`) met
  **"Ontkoppelen"**. Kassa aanmaken gebeurt hier (bestaat al in POS.tsx), niet meer in de kassa-app.
  Eén plek per taak (§8): de "dit toestel toevoegen"-meldingen blijven in `DeviceAlertsDialog`; het koppelen
  is een eigen sectie op dezelfde pagina, geen nieuw zijbalk-item.
- i18n in alle `SUPPORTED_LANGUAGES`; `doc_articles` met `context_path = '/admin/pos'`.

### 3.2 Kassa-app (`src/kassa/` = fiscale release)

- `KassaApp.tsx`: geen sessie of sessie zonder koppeling → `PairDevice` (code intikken of QR scannen met de
  bestaande `html5-qrcode`). Met koppeling → `kassa_device_context()` → eigen `TenantContext.Provider`.
- `SignIn.tsx` weg, `DeviceSetup.tsx` + `setup.ts canCreateTerminal` weg (na de "bouw nieuw, sloop oud"-
  volgorde: eerst koppelen werkend bewezen).
- Een gewone account (eigenaar) die `/kassa` opent: melding "Dit is geen kassatoestel — koppel dit toestel in
  beheer" + link, i.p.v. de kassa te draaien met eigenaarsrechten. Tijdens de overgang: zie beslispunt 2.
- "Naar beheer" (`KassaHome.tsx:181-185`, enkel owner/manager-PIN): zie beslispunt 3.
- `MailReceipt` en keukenbord: de twee edge functions aanvaarden het toestel (via nieuw
  `_shared/kassaDeviceAuth.ts`; enkel die twee deployen, vingerafdruk via GET-versie).
- `KASSA_SW_VERSION` → `sellqo-kassa-0.21.0` met kopregel "KASSA-ACCOUNT-1: toestel meldt zich aan met een
  eigen gekoppelde account; geen wijziging aan fiscale berichten". `npx vitest run src/kassa` groen.

### 3.3 Prijs-REST voor het toestel

- Met D: toestel heeft geen UPDATE-policy op `products`/`product_variants`/`product_addon_options` en geen
  lidmaatschap → REST-prijswijziging = 0 rijen/42501. Prijzen enkel via `kassa_product_quick_edit` (PIN
  owner/manager + `fiscal_audit_log`). Geen kolom-grants nodig.
- Losse gaten (§1.3) in een aparte kleine batch, los van `src/kassa`.

### 3.4 Migratiepad bestaande toestellen

1. Migratie + functies live; RPC's aanvaarden toestel **én** (tijdelijk) tenant_admin/staff.
2. Nieuwe kassa-frontend live (publish + bundelcheck). De Wissel: in beheer code maken, op de iPhone koppelen.
   Oude `kassa_devices`-rijen blijven (historiek); `deviceUuid` blijft gelijk.
3. Na bewezen werking (≥ een paar dagen, `kassa_devices.sw_version` ≥ 0.21.0 op alle actieve toestellen):
   batch KASSA-ACCOUNT-2 haalt tenant_admin/staff uit `kassa_can_operate` voor de toestel-RPC's waar de
   eigenaar ze niet vanuit beheer nodig heeft (eerst grep: welke RPC's roept beheer aan, bv.
   `horeca_notify_device_*`, `kassa_report_*` in Rapporten). Pas dan is "kassa met eigenaarsaccount" dicht.

---

## 4. Aanbeveling en batchindeling

**Optie D.** Default-deny, geen enum- of `get_user_tenant_ids`-wijziging, echte sessies, offline gelijk aan nu,
geen secrets.

| Batch | Inhoud | Fiscale release? | Omvang (schatting) |
|---|---|---|---|
| **PRIJS-GATEN-1** (eerst, klein, los) | `bulk_adjust_prices` rolcheck; guard op `product_variants` (+ `product_addon_options`); `guard_product_commercial_fields` default-deny voor onbekende rollen | nee | 1 migratie, ±120 regels SQL + SQL-tests; geen frontend |
| **KASSA-ACCOUNT-1a** (server) | tabellen `kassa_device_accounts`, `kassa_pair_codes`; `kassa_pair_code_create`, `kassa_device_context`, `kassa_device_tenant`, `kassa_can_operate`; ankerpatch 27 RPC's + `p_device_id`-binding; ±25 additieve policies; edge functions `kassa-device-pair`, `kassa-device-revoke`; `_shared/kassaDeviceAuth.ts` in `horeca-receipt-mail` + `send-order-ready` | nee (backend, maar raakt kassa-RPC's: SQL-suites `scripts/gks/sql/run.sh` moeten groen) | 1 grote migratie (±600-800 regels), 2 nieuwe functies, 2 functie-patches, SQL-testsuite (rol-impersonatie: toestel kan geen prijs/klant/factuur lezen of schrijven, wel alle 27 RPC's) |
| **KASSA-ACCOUNT-1b** (frontend) | beheer: "Toestel koppelen"/"Ontkoppelen" in POS.tsx; kassa: `PairDevice`, context-provider, SignIn/DeviceSetup weg, "naar beheer" aangepast; i18n 5+ talen; `KASSA_SW_VERSION` 0.21.0 | **ja** (`src/kassa`) | ±8-12 bestanden, vitest + harnas 390/1280 |
| **KASSA-ACCOUNT-2** (later) | overgangsrechten (tenant_admin/staff op toestel-RPC's) intrekken waar beheer ze niet gebruikt | nee/ja afh. van RPC | klein |

1a en 1b kunnen in één go uitgerold worden (volgorde: migratie → functies deployen + vingerafdruk → frontend
publish + bundelcheck), maar als twee commits. Paper trail per batch (role-audit, changelog in alle talen,
newsletter, `doc_articles`).

**Reviews:** dit is security- én auth-werk → aparte **security-review-agent ×2** op de diff van 1a (ronde 1,
fixes, ronde 2), met als opdracht: (1) kan een toestel-JWT iets buiten de lijst §1.2? (rol-impersonatie per
tabel), (2) koppelcode raden/hergebruiken/race, (3) `p_device_id`-binding omzeilen, (4) ontkoppelen werkt
meteen, (5) geen secrets in migraties. 1b: één review-ronde (UI + overgang).

**Verificatie na uitrol:** SQL-natrek dat de policies/functies live staan (projectregel core-migratie), live
test met een toestelaccount via `set local role authenticated; set local request.jwt.claims …` in een aparte
`query_database`-aanroep (nooit samen met de migratie), `kassa_devices` toont De Wissel op 0.21.0.

## Open beslispunten voor Akke

1. **Optie D (eigen account buiten `user_roles`) i.p.v. een nieuwe rol?** Aanbeveling: ja. Een rol `kassa` in
   `user_roles` erft 233 lidmaatschapspolicies (klanten, facturen, Odoo-mappings), `staff` schrijft op 128
   tabellen.
2. **Overgang: mag een eigenaarsaccount de kassa nog even draaien?** Aanbeveling: in 1b de wachtwoord-login uit
   de kassa-app halen (enkel De Wissel, demo, moet opnieuw koppelen); de server aanvaardt tenant_admin nog tot
   KASSA-ACCOUNT-2, zodat een niet-herladen toestel niet midden in de dienst breekt.
3. **"Naar beheer" vanuit de kassa op web.** Zelfde origin = zelfde Supabase-sessie (`client.ts` is
   Lovable-gegenereerd): eigenaar logt in beheer in → de kassa verliest haar toestelsessie. Aanbeveling: in de
   kassa opent "naar beheer" altijd een **nieuw venster/externe browser** met een waarschuwing, en we
   adviseren de kassa op een eigen toestel/beginscherm-app. Alternatief (later): kassa op `kassa.sellqo.app`
   (eigen origin, eigen opslag).
4. **Keukenbord leest `orders` (klantgegevens) via REST.** Aanbeveling: in 1a voor het toestel geen
   `orders`-select-policy, maar een smalle RPC `kassa_kitchen_orders()` met enkel de velden die het bord toont;
   kost een kleine aanpassing in `useKitchenBoard.ts` (gedeeld met beheer: enkel het toestelpad omleiden).

## Restrisico's (eerlijk)

- Toestelaccount-wachtwoord staat in de Supabase-sessie op het toestel (zoals vandaag het eigenaars-JWT). Wie
  het uitleest, heeft voortaan enkel kassarechten in één zaak, niet meer de eigenaarsrechten.
- Binnen de kassarechten blijft alles wat de 27 RPC's toelaten mogelijk met het toestel-JWT (bv. rekeningen
  muteren met een vervalste `staff_id`); KASSA-RECHTEN-1 dekt korting/annuleren/kas uit met sessietoken of PIN.
- `products` select voor het toestel toont ook `cost_price` (tabelbrede grant); te versmallen met een
  kolomlijst-view in een latere batch indien gewenst.

## Efficiëntie-pass

Geen kortere weg: geen bestaande skill/connector voor toestelkoppeling. Wel een terugkerend patroon: de
ankerpatch op meerdere kassa-functies (KASSA-RECHTEN-1, KEUKEN-VEILIG-1, nu 27 RPC's) verdient een helper in
`scripts/gks/sql/` (`patch_function(name, anchor, insert, marker)`) + vermelding in skill `sellqo-db-safety`.

## Skill-onderhoud

- `sellqo-db-safety` (voorstel): "Een nieuwe identiteit of rol nooit via `user_roles` als ze smal moet zijn:
  233 policies laten elk lid toe via `get_user_tenant_ids()` zonder rolcheck, en `staff` staat in 385 policies.
  Smalle identiteiten (toestellen) krijgen een eigen tabel + expliciete policies (default-deny)."
- `sellqo-db-safety`: "`guard_product_commercial_fields` is default-allow voor onbekende rollen" — tot
  PRIJS-GATEN-1 rond is.

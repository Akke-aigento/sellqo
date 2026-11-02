## QR-MODULES-1 — "QR aan tafel": alle gastschakelaars op één plek, plus Ober roepen / Rekening vragen aan-uit — 2 november 2026

Branch `qr-modules-1` in `sellqo` en in `sellqo-storefront`. Contract: `docs/nachtrun/API-CONTRACT.md` §6.

Vraag van Akke: "Er is een schakelaar om bestellen via de QR mogelijk te maken, maar niet om af te
rekenen. Maak dit zo modulair mogelijk, met een schakelaar."

**Plan-scope.** Geen nieuwe feature-sleutel: dit is een onderdeel van het bestaande horeca-QR-pakket
(QR-menu, bestellen aan tafel, REKENING-ONLINE-1, OBER-ROEPEN-1), dat al achter de horeca-module zit
(`OrderingHub` → `useHorecaModule`). Geen nieuw label op de prijzenpagina, geen grandfathering nodig:
de nieuwe schakelaars staan standaard aan, dus voor elke zaak blijft alles zoals het was.

### Inventaris (vóór het plan)

| Plek | Deed | Wat verandert | Voorstel / gedaan |
|---|---|---|---|
| Kaart › Instellen › QR-menu (`/admin/bestellen?tab=qr`, `QrModeSettings.tsx`) | QR-menu-stand, waar komt de bestelling, automatisch bevestigen; afrekenen enkel als alleen-lezen samenvatting met link naar Kassa › Betalen | Wordt **"QR aan tafel"**: vier groepen (QR-menu · Bestellen · Afrekenen door de gast · De bediening roepen), elke schakelaar met één zin uitleg; uitgegrijsd = reden + link | Gedaan |
| Kassa › Betalen (`/admin/pos?tab=betalen`, `HorecaPaySettings.tsx`) | Kassa-betaalwijzen, terminal, fooi aan de kassa **én** de gast-schakelaars (aan de toog / meteen online / de rekening online / splitsen / fooi online) | Houdt enkel de kassa-betaalwijzen. De QR-kaart wordt een stand ("Nu: …") + knop **Naar QR aan tafel**. Schrijft nooit meer `online_*` of `qr_*` | Gedaan; `?tab=betalen` blijft werken |
| Instellingen › Horeca (`HorecaSettingsHub.tsx`) | Rij Betalen: "n betaalwijzen · online betalen aan/uit" (linkt naar Kassa › Betalen) | "Online betalen" verhuist naar de rij QR-menu aan tafel ("… · rekening online betalen aan/uit"); Betalen toont "n betaalwijzen aan de kassa" | Gedaan |
| Kassa › Bon & printers (`HorecaPrinters.tsx`) | "Zet eerst online betalen aan in Kassa › Betalen." | Tekst wijst naar QR aan tafel + link | Gedaan (5 talen) |
| Bestellen › Overzicht (`OrderingHub.tsx`) | QR-kaart: stand + afrekenen, knop naar `?tab=qr` | Niets: leest dezelfde kolommen en linkt al naar de nieuwe plek | Ongemoeid |
| Storefront `/menu`, `/rekening` (`StaffCall.tsx`, `cart.ts`) | Ober roepen + Rekening vragen altijd (als de API het kent) | Enkel de soorten die de zaak aanzette (`call_kinds`) | Gedaan |
| `/rekening` online betalen | Volgt al `settings.online_pay` uit `table_check_view` | Niets nodig (nagekeken: `rekening.tsx:236`) | Ongemoeid |
| storefront-api `table_call`, `table_request_status` | Geen schakelaar per soort | `TABLE_CALL_KIND_OFF` + additief `call_kinds` | Gedaan |
| Helpartikels `qr-online-betalen`, `qr-tafelrekening`, `tafel-oproepen` | Verwijzen naar Kassa › Betalen; geen schakelaar voor oproepen | Verwijzen naar QR aan tafel; oproepen aan/uit beschreven; `qr-online-betalen` context_path → `/admin/bestellen` | Docs-migratie met snapshot |
| Helpartikel `kassa-afrekenen` | Kassa › Betalen voor kassa-betaalwijzen | Klopt nog | Ongemoeid |
| Kassa (`src/kassa`) | Leest `horeca_pay_settings` en `table_calls` | Niets (parallelle bouwer KASSA-ACCOUNT-1) | Niet aangeraakt |

**Root cause**
- `QrModeSettings.tsx` toonde de afrekenkeuze enkel als tekst ("Instellen bij Kassa › Betalen",
  BETAAL-1); de echte schakelaar "gasten betalen online aan tafel" (`horeca_pay_settings.online_pay`,
  REKENING-ONLINE-1) stond in `HorecaPaySettings.tsx` (±187-205), uitgegrijsd zonder Stripe of met
  FDM. Een zaakvoerder die in het QR-menu zoekt, vond hem niet: twee plekken voor één taak.
- Ober roepen / Rekening vragen (OBER-ROEPEN-1) hadden geen schakelaar: `tableCall` in
  `storefront-api/index.ts` weigerde enkel bij `qr_mode = 'off'`.

**Uitgevoerd**
- `supabase/migrations/20261102110000_qr_modules_1.sql`: `fulfillment_settings.qr_call_waiter` en
  `qr_call_bill` (boolean not null default true), `ADD COLUMN IF NOT EXISTS`, met kolomcommentaar.
  Bewust `fulfillment_settings`: daar staan alle andere `qr_*`-schakelaars, de RLS (lezen eigen tenant,
  schrijven tenant_admin) past, en de tabel gaat nergens via `select('*')` naar buiten (nagekeken:
  storefront-api leest expliciete kolommen in `loadFulfillmentSettings` en `resolveDomain`;
  `storefront-customer-api` en `storefront-resolve` lezen de tabel niet).
- `supabase/migrations/20261102110010_qr_modules_1_docs.sql`: snapshot
  `snapshots.sellqo_20261102_doc_articles_qrmodules1`, daarna `replace()` op exacte ankers (live
  nagekeken: elk anker precies één keer) in `qr-online-betalen` (+ context_path `/admin/bestellen`),
  `qr-tafelrekening` en `tafel-oproepen` (+ excerpt).
- `supabase/functions/storefront-api/index.ts`:
  - `tableCallKinds()` — aparte, foutbestendige lees van de twee kolommen (fout of geen rij = beide aan);
    `loadFulfillmentSettings` blijft ongemoeid, zodat bestellen aan tafel nooit breekt als de migratie
    later komt dan de functie.
  - `tableCall`: na de bestaande `TABLE_CALL_OFF`-check → `TABLE_CALL_KIND_OFF` (tekst per soort), zonder
    `table_call_place`-aanroep.
  - `tableRequestStatus`: met `call_ids` additief `call_kinds` (leeg als `qr_mode = 'off'`). Oud pad
    (enkel `request_id`) ongewijzigd.
  - Stempel `QR-MODULES-1` / `qr-modules-1`. `scripts/promo-compare/{qrStatus,allergenDeclared,tableCheckPay,event409}.test.ts`
    mee aangepast (grep op de oude stempel: `smoke.ts` noemt hem enkel in commentaar).
- `src/components/admin/storefront/food/QrModeSettings.tsx`: herschreven tot "QR aan tafel" (zie
  inventaris). Leest `fulfillment_settings` (qr_*), apart `qr_call_*` (ontbreken de kolommen, dan
  verdwijnt enkel de groep "De bediening roepen"), `horeca_pay_settings.online_*`, `shop_live` en de
  FDM-telling. Bewaart enkel wat wijzigde (zoals Review Mag-3). Grijs + reden: "meteen online" zonder
  Stripe (→ Betalingen; staat het toch aan, dan kan je het uitzetten), "de rekening online afrekenen"
  zonder Stripe (→ Betalingen) of met FDM (→ uitleg in Instellingen › Horeca), splitsen/fooi zonder
  online afrekenen ("Werkt enkel als …"). Validatie "minstens één manier" blijft.
- `src/components/admin/pos/HorecaPaySettings.tsx`: gast-schakelaars weg, stand + knop naar QR aan
  tafel; `save` schrijft enkel `methods/terminal/kassa_tip`.
- `src/components/admin/settings/HorecaSettingsHub.tsx`, `src/components/admin/pos/HorecaPrinters.tsx`: zie inventaris.
- i18n (nl/en/fr/de/uk): nieuw `admin.qrTable.*`, `admin.horecaPay.qr_moved|qr_now|qr_not_ordering|qr_to_settings`,
  `settings.horecaHub.qr_online|pay_methods_*`; aangepast `admin.horecaPrint.mail_online_needs_online`;
  weggehaald (niet meer gebruikt, gegrept): `admin.horecaPay.qr_desc_order|qr_desc_off|qr_to_menu|qr_set_in_pay`,
  `admin.qrFlow.pay_on_check`, `admin.storefront.food.qrModeSettings.qr_menu_in_je_zaak|hoe_rekent_de_klant_af|meteen_online`,
  `settings.horecaHub.pay_status_*`.
- Harnas: nieuw scenario `scripts/harness/scenarios/qr-aan-tafel` (8 varianten + klikscenario's) en
  vermelding in `scripts/harness/README.md`.
- Storefront (`sellqo-storefront`): `src/lib/cart.ts` — `getTableFeatures` geeft `{ calls, kinds }`,
  `parseTableFeatures` (geen `call_kinds` = beide), cache **per zaak** 1 min (was 10 min, één waarde
  voor alle zaken in de worker). `src/components/StaffCall.tsx` — `useStaffCallKinds`; `StaffCallButtons`
  toont enkel toegelaten soorten (ook de `kinds={['bill']}` op `/rekening`).

**Security-keuzes**
- Geen nieuwe RLS, policy of grant. De twee kolommen erven de bestaande policies van
  `fulfillment_settings` (`fulfillment_settings_select` eigen tenant; `fulfillment_settings_write` enkel
  tenant_admin of platform_admin). De online-schakelaars blijven in `horeca_pay_settings` (insert/update
  enkel tenant_admin). Het admin-scherm doet niets wat een gebruiker vroeger niet al kon.
- De weigering zit server-side in storefront-api (`table_call_place` is enkel service_role); de
  storefront verbergt de knoppen alleen voor het gemak.
- Niets gevoeligs in de nieuwe kolommen.

**Gedeelde-paden-waarschuwing**
- `storefront-api` is gedeeld door zes custom frontends. Strikt additief: nieuwe foutcode
  `TABLE_CALL_KIND_OFF` treedt enkel op als een zaak een soort uitzet (standaard aan → geen enkele zaak
  ziet ander gedrag na de uitrol); nieuw veld `call_kinds` enkel in het uitgebreide pad van
  `table_request_status` met `call_ids`. Geen bestaand veld, sleutel of foutcode gewijzigd.
  `resolve_domain` bewust niet uitgebreid (exacte sleutels in `smoke.ts`; het statuspad volstaat).
- `fulfillment_settings` is geen van de vier gedeelde storefront-tabellen uit CLAUDE.md §1 en gaat
  niet via `select('*')` naar buiten; toch strikt additief (ADD COLUMN, default = huidig gedrag).

**Verificatie**
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0.
- `node scripts/i18n-parity.mjs` → exit 0 (11242 keys, 5 talen).
- `npx eslint` op de vier gewijzigde componenten + `qrStatus.test.ts` → exit 0, 0 problemen.
- `deno check` storefront-api (import map met npm-supabase/stripe) → exit 0.
- `deno test` `qrStatus` (22, waarvan 5 nieuw), `allergenDeclared` (3), `tableCheckPay` (10),
  `event409` (5), `tableRequest` (6) → alles groen.
- Rooktest `smoke.ts` → exit 0 (37 ok).
- Harnas `qr-aan-tafel` 390/1280 → exit 0; screenshots bekeken (NL + EN). Klikscenario: Ober roepen
  aanzetten + Opslaan → één upsert op `fulfillment_settings` met `qr_call_waiter: true`; in Kassa ›
  Betalen een betaalwijze wijzigen → upsert op `horeca_pay_settings` zonder `online_*`.
  Harnas `horeca-beheer` → exit 0 (Instellingen › Horeca en `?tab=qr` zonder fouten).
- Storefront: `npx tsc --noEmit` exit 0, `npx vite build` exit 0; Playwright tegen nep-API
  (`/home/claude/sf-qr-shots/harness/run-qr-modules.mjs`) 44/44 groen op 390 en 1280: oudere API zonder
  `call_kinds` → beide knoppen (degradatie); enkel rekening / enkel ober / geen; `/rekening` met
  online uit toont "Rekening vragen" enkel als die aanstaat; met online aan de betaalkeuze.
  Screenshots in `/home/claude/sf-qr-shots/`.
- Live read-only: kolommen en policies van `fulfillment_settings`/`horeca_pay_settings`,
  rechten op `table_call_place` (service_role), helpartikels en ankers nagekeken.

**Uitrolvolgorde** (elk een aparte go)
1. Migratie `20261102110000_qr_modules_1.sql`, daarna natrekken:
   `select column_name, column_default from information_schema.columns where table_name='fulfillment_settings' and column_name like 'qr_call%';`
2. Deploy `storefront-api` (enkel die functie; geen `_shared` geraakt). Vingerafdruk: `GET` → `QR-MODULES-1`.
   Let op: vóór de deploy de live stempel vergelijken; andere nachtbatches die de stempel bumpen
   moeten samengevoegd worden (één stempel).
3. Frontend sellqo (publish) en sellqo-storefront.
4. Docs-migratie `20261102110010_qr_modules_1_docs.sql`, daarna natrekken dat de drie artikels
   "QR aan tafel" bevatten en `qr-online-betalen.context_path = '/admin/bestellen'`.

**Bewust ongemoeid / Vervolg**
- `src/kassa/` niet aangeraakt (parallelle bouwer). `KASSA_SW_VERSION` ongewijzigd.
- "Meteen online bij het bestellen" wordt niet uitgegrijsd bij een FDM: dat was ook vroeger niet zo,
  en de GKS-tip blijft bij "aan de toog" staan. Of een FDM-zaak QR-bestellingen online mag laten
  betalen (FAQ Q203) is een aparte vraag voor de kassa-batches.
- `resolve_domain` geeft geen oproep-vlaggen (bewust; zie gedeelde paden).
- Groepen 2-4 verschijnen enkel als het QR-menu op "Bestellen aan tafel" staat, met een zin die dat
  zegt: in "Alleen bekijken" bestaat er geen tafel-cookie in de storefront (`loadShell` zet hem enkel bij
  `qr_mode = 'order'`), dus zouden die schakelaars niets doen.
- Er komen geen nieuwe vitest-bestanden bij; de deno-tests staan al in CI.

### Changelog (NL)

**Titel:** Alles voor de QR aan tafel op één plek, met een schakelaar per functie

**Beschrijving:** Onder Kaart › Instellen › QR-menu vind je nu QR aan tafel: het QR-menu, bestellen,
hoe de gast afrekent (aan de toog, meteen online, de rekening online, delen en fooi) en de knoppen
Ober roepen en Rekening vragen, die je nu elk apart aan of uit zet. Kan een schakelaar niet, dan zie
je waarom en hoe je het oplost.

### Nieuwsbrief (NL, voor `docs/newsletter-queue.md`)
Categorie: improvement. Zelfde tekst als de changelog; i18n-key `public.changelog.changes.qr_modules_1`
(door de hoofdsessie aan te maken).

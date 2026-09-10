# SellQo — brede diagnose

**Datum:** 10 september 2026
**Type:** brede scan, ronde 1 van 2. Ondiep over vier assen, bedoeld om te bepalen wáár we
diep gaan. Read-only; geen code gewijzigd.
**Bijgewerkt (zelfde dag):** de open vragen uit §7 zijn alsnog zélf beantwoord via
`query_database` op de Lovable-connector. Zie §9. Drie bevindingen zijn daardoor
gecorrigeerd — twee naar beneden, één nieuwe erbij.
**Vervolg:** de deep-dives kiezen we samen op basis van §6.

> **Leesinstructie.** Waar ik "bevestigd" schrijf, staat er een commando of bestandsregel
> achter. Waar ik "kandidaat" of "niet vast te stellen" schrijf, kon de repo het antwoord
> niet geven — meestal omdat het in de database leeft. Die staan verzameld in §7 als
> SQL-vragen voor Akke. Het verschil tussen die twee is de hele waarde van dit document.

---

## 0. Omvang — waar hebben we het over

| | Aantal |
|---|---|
| TypeScript-bestanden in `src/` | 1.057 (~242.000 regels) |
| Pagina's / componenten / hooks | 120 / 598 / 204 |
| Routes in `App.tsx` | 125 |
| Edge functions | 229 |
| Migraties | 404 |
| Tabellen met RLS | 247 |
| **Testbestanden** | **7** |

Dat laatste getal staat er niet voor de sier. 7 testbestanden op 1.048 bronbestanden
betekent dat vrijwel elke wijziging in dit project handmatig geverifieerd moet worden.
Het verklaart ook waarom de engineering-regels in `sellqo-engineering-rules` bijna
allemaal met een productie-incident betaald zijn: er is geen net dat ze eerder had kunnen
vangen.

---

## 1. Gezondheidsscore per gebied

Mijn inschatting na de brede scan. De onderbouwing staat in §2 t/m §5.

| Gebied | Staat | Kern |
|---|---|---|
| **Types** | 🟢 gezond | `tsc --noEmit` is volledig schoon, exit 0 |
| **RLS-dekking** | 🟢 gezond | **Alle 270** tabellen hebben RLS; de 5 zonder policy zijn bewust service-role-only (§9e) |
| **Native shell** | 🟡 gat | Push is echt en compleet; camera ontbreekt in het Android-manifest |
| **Feature-realiteit** | 🟡 scheef | Ruggengraat echt, randmodules deels façade — maar de nepdata is nauwelijks gebruikt (§9f) |
| **Edge-function-hygiëne** | 🟠 aandacht | 24 zonder aanroeper (§9d); 16 cron-jobs draaien, maar 14 ervan staan nergens in git (§9c) |
| **Dependencies** | 🟠 aandacht | 1 kritieke + 14 hoge kwetsbaarheden in productie-deps; 46 MB ongebruikt |
| **Bundle** | 🟠 aandacht | Eén JS-chunk van 9,1 MB |
| **Correctheid (hooks)** | 🔴 bug | 9 × `rules-of-hooks`; `BolActionsCard` kan het orderscherm laten crashen |
| **Testdekking & CI** | 🔴 zwak | 7 testbestanden; geen lintstap in CI, dus de 9 hierboven vallen nergens om |
| **Auth op edge functions** | ⚫ niet vast te stellen | Zie §4c — met grep niet te beantwoorden, vraagt een echte review |
| **Gebruik in productie** | ℹ️ context | 98% van alle omzet zit bij één tenant, op een custom frontend (§9a) |

---

## 2. As 1 — Feature-realiteit

### 2a. Wat er daadwerkelijk aangeroepen wordt

Van de 229 edge functions, gemeten op letterlijke naamreferenties door heel `src/`,
`supabase/functions/` en `supabase/migrations/`:

| Categorie | Aantal |
|---|---|
| Aangeroepen vanuit `src/` | 151 |
| Alleen vanuit een andere edge function | 22 |
| Alleen genoemd in een migratie (cron) | 7 |
| **Nergens genoemd in de repo** | **49** |

Van die 49 is het merendeel verklaarbaar:

- **9 zijn extern aangeroepen** en horen dus niet in de repo voor te komen:
  `stripe-connect-webhook`, `platform-stripe-webhook`, `whatsapp-webhook`,
  `meta-messaging-webhook`, `shipping-webhook`, `process-email-webhook`,
  `auth-email-hook`, `shopify-oauth-init`, `shopify-oauth-callback`.
- **1 wordt aangeroepen door de vijf custom frontends**: `storefront-resolve`. Dat die hier
  geen aanroeper heeft is precies zoals het hoort.
- **39 blijven onverklaard.**

**Belangrijke kanttekening bij die 39: dit is géén lijst dode functies.** Veel ervan zijn
duidelijk cron-vormig (`*-scheduler`, `auto-invoice-cron`, `check-expired-trials`,
`expire-orders`, `warmup-vat-cache`, `reset-monthly-ai-credits`,
`send-trial-expiry-warning`, `process-invoice-dunning`). Of ze draaien, is uit de repo
niet te zien — en dat is zelf de bevinding:

> **Slechts 2 van de 404 migraties bevatten een `cron.schedule`.** De cron-planning van dit
> project staat dus vrijwel volledig in de database en niet in versiebeheer. Wie de
> schedules wil kennen, moet `cron.job` uitlezen. Er is geen enkele plek in de repo waar
> staat wat er periodiek draait.

Dat is een architectuurfeit met gevolgen: een cron die stilvalt, of een functie die na een
hernoeming niet meer bestaat, meldt zichzelf nergens. Dit is mijn belangrijkste kandidaat
voor deep-dive.

Een tweede groep binnen die 39 is juist wél verwacht dood: éénmalige onderhoudsscripts.
`backfill-ubl-archive`, `backfill-vat-regimes`, `repair-attachments`,
`repair-cid-references`, `regression-test-vat`. Die hebben per definitie geen aanroeper.

### 2b. Façade versus werkend

Uit de audit van vanmiddag ([app-dead-ui-audit.md](app-dead-ui-audit.md)), hier samengevat
omdat het het beeld per module bepaalt:

| Module | Oordeel |
|---|---|
| SEO-dashboard | **Grotendeels façade.** Vier panelen schrijven `Math.random()`-waarden naar echte tabellen (`seo_web_vitals`, `seo_audit_results`, `seo_competitor_keywords`, `seo_search_console_data`) en melden "meting voltooid" |
| A/B-testing | **Façade.** `calculateWinnerStats()` geeft altijd 24,5% vs 28,2%; B wint altijd |
| Ads (Meta/Google/Amazon) | **Eerlijk gelabeld** als "binnenkort" via `getPlatformStatus()`. Alleen bol.com is echt |
| Storefront social proof | **Verzonnen**, maar opt-in per tenant en standaard uit |
| Push, deeplinks, externe links | **Echt en compleet** |
| Facturatie, orders, producten, POS | Ruggengraat; geen façade-signalen aangetroffen |

Een onafhankelijke bevestiging van die scheiding zit in de RLS-scan (§4): de tabellen
`ads_meta_*`, `ads_google_*` en `ads_amazon_*` hebben RLS aan maar **geen enkele policy**.
Ze zijn dus voor elke client leeg. Dat klopt exact met het "binnenkort"-label in de UI —
de laag is aangelegd, niet aangesloten. Dit is het gezonde patroon.

---

## 3. As 2 — Technische gezondheid

### 3a. Groen

**`npx tsc --noEmit -p tsconfig.app.json` → exit 0, nul fouten.** Op 242.000 regels is dat
een serieus resultaat en het bevestigt dat de i18n-sprint en de typediscipline uit R7 hun
werk doen. Dit gebied vraagt geen aandacht.

### 3b. Verweesde bestanden

**71 van de 1.048 bronbestanden worden nergens geïmporteerd.** Met twee bekende
vals-positieve groepen die je eraf moet trekken:

- **11 shadcn-basiscomponenten** (`carousel`, `context-menu`, `drawer`, `menubar`,
  `pagination`, `resizable`…) — vendorcode die meekomt met de generator. Normaal.
- **`src/native/firebase-messaging-stub.ts`** — wordt via een alias in `vite.config.ts`
  ingeladen, niet via een import. Correct, geen wees.

Blijft over: ongeveer **58 echt verweesde bestanden**, waaronder hele features die ooit
gebouwd zijn en nu nergens hangen. Opvallende namen: `ABTestingPanel`,
`ProductPromoWizard`, de vier `EmailBlock*`-bestanden (een e-mailbuilder),
`ShopifyManualImport` + `ShopifyRequestConnection` + `ShopifyRequestStatus`,
`WhatsAppAutomationSettings`, `DomainSettings`, `ReminderSettings`, `GiftCardDesigns`,
`GiftCardDetail`, `CreditNotes`, en tien hooks waaronder `useVatReturns`,
`useProformaInvoices` en `usePackingSlips`.

Let op de wisselwerking met §2a: `ReminderSettings` is de enige consument van
`usePaymentReminders`, en `ReminderSettings` blijkt zélf nergens gerenderd te worden. De
hele betalingsherinnering-keten hangt dus in de lucht. Dat verklaart waarom de ontbrekende
e-mailverzending nooit is opgevallen.

### 3c. Bundel en dependencies

- **De hoofd-JS-chunk is 9,1 MB** (`dist/assets/index-*.js`, build van vandaag 10:53).
  Eén chunk, geen code-splitting van betekenis. De chunk-size-waarschuwing bij `npm run
  build` is bekend en staat in `CLAUDE.md` §6 als "bestaand", maar 9,1 MB is een ander
  ordegrootte-probleem dan een waarschuwing suggereert. In de native shell zijn de assets
  lokaal, dus daar kost het parse-tijd in plaats van downloadtijd — op een instaptoestel
  is dat alsnog merkbaar.
- **85 productie-dependencies**, waarvan de zwaarste:

  | Package | Omvang | In gebruik? |
  |---|---|---|
  | `@huggingface/transformers` | 46,1 MB | **Nul imports** in `src/` én in `supabase/functions/` |
  | `lucide-react` | 27,2 MB | Ja, overal (tree-shaked) |
  | `date-fns` | 21,1 MB | Ja |
  | `pdf-lib` | 18,6 MB | Ja (3 plekken) |
  | `xlsx` | 7,2 MB | Ja (4 plekken) — staat wel op de high-kwetsbaarhedenlijst |
  | `@capacitor/camera` | 2,9 MB | **Nul aanroepen** (zie §5) |

- **`npm audit --omit=dev`: 18 kwetsbaarheden, waarvan 1 kritiek en 14 hoog.** Kritiek:
  `protobufjs`. Hoog, onder meer: `react-router` / `react-router-dom`, `lodash`, `xlsx`,
  `ws`, `sharp`, `postcss`, `nanoid`, `@tiptap/core`, `@huggingface/transformers`. Dit zijn
  productie-deps, niet dev.

### 3d. Lint staat niet in CI

`.github/workflows/ci.yml` draait typecheck, i18n-pariteit, capacitor-sync en build. **Geen
lintstap.** `CLAUDE.md` §6 schrijft voor om altijd tegen een baseline te linten — die
baseline wordt nergens geautomatiseerd bewaakt. Bij het meten liep `eslint . -f json` op de
standaardheap uit zijn geheugen (exit 134); met `--max-old-space-size=8192` en de
standaardformatter lukt het wel, maar traag. Dat is op zich een signaal over de omvang.

### 3e. Lint-baseline — en negen echte bugs erin

`npx eslint .` (met verhoogde heap): **1.528 problemen — 1.433 errors, 95 warnings.**

| Regel | Aantal | Aard |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 1.338 | Stijl/typediscipline. Bekend, staat als bestaand in `CLAUDE.md` §6 |
| `react-hooks/exhaustive-deps` | 51 | Waarschuwing; kan stale closures geven |
| `react-refresh/only-export-components` | 40 | Alleen hinder tijdens development |
| `no-case-declarations` | 29 | Stijl |
| `no-empty` | 22 | Lege `catch`-blokken — raakt aan R4 |
| `prefer-const` | 15 | Stijl |
| **`react-hooks/rules-of-hooks`** | **9** | **Echte bugs — zie hieronder** |

87% van het totaal is één regel (`no-explicit-any`). Dat is ruis waar je een baseline voor
zet, niet iets om nu op te lossen. **Maar negen treffers zijn geen stijl**, en die zijn met
het blote oog nagetrokken:

| Bestand | Wat er staat |
|---|---|
| [BolActionsCard.tsx:54](src/components/admin/BolActionsCard.tsx:54) | `if (order.marketplace_source !== 'bol_com') return null;` — en **daarna** vier hooks (`useQuery` op 59, `useMutation` op 81, 111 en 141) |
| [NoAccess.tsx:56](src/pages/NoAccess.tsx:56) | `useTenant()` binnen een `try`-blok, dus voorwaardelijk aangeroepen |
| [RoleSimulator.tsx:62-66](src/components/dev/RoleSimulator.tsx:62) | Drie hooks na een voorwaarde (dev-only component) |
| [StorefrontLanguageSelector.tsx:35](src/components/storefront/StorefrontLanguageSelector.tsx:35) | `useEffect` voorwaardelijk |

`BolActionsCard` is de gevaarlijkste. In een orderlijst met zowel bol.com- als
niet-bol.com-orders wisselt dezelfde componentpositie tussen "nul extra hooks" en "vier
hooks". Dat is precies het scenario waarin React `Rendered more hooks than during the
previous render` gooit — een harde crash van het scherm, niet een vage glitch. Dat dit nog
niet gemeld is, betekent waarschijnlijk dat de volgorde in de praktijk stabiel blijft, niet
dat het veilig is.

`NoAccess` is verhelderend op een andere manier: de hook staat in een `try/catch`. Dat
suggereert dat iemand hier ooit een fout tegenkwam en hem heeft ingepakt in plaats van
opgelost.

**Dit is het sterkste argument voor een lintstap in CI.** Deze negen staan er al langer, en
zonder CI-stap valt er niets om. Zet je de baseline op het huidige aantal en laat je hem
alleen dalen, dan vang je de volgende vanzelf.

---

## 4. As 3 — Security & RLS

### 4a. RLS-dekking is goed — beter dan ik verwachtte

Gemeten over alle 404 migraties:

| | Aantal |
|---|---|
| Tabellen aangemaakt | 246 |
| `ENABLE ROW LEVEL SECURITY` | 247 |
| Minstens één policy | 249 |

**Er is geen enkele tabel die is aangemaakt en waar RLS vergeten is.** De twee treffers in
"aangemaakt zonder RLS" zijn een testtabel (`_test_has_tenant_role_results`) en een
regex-artefact (`for`). Voor een project met 246 tabellen is dat een uitstekende score en
het pleit voor de discipline uit `sellqo-db-safety`.

### 4b. 24 tabellen zijn volledig dicht

RLS aan, geen enkele policy — elke client-query geeft leeg terug. Voor het merendeel is dat
correct en opzettelijk:

- `ads_amazon_*`, `ads_google_*`, `ads_meta_*` (11 tabellen) — de nog niet gebouwde
  advertentieplatforms. Consistent met het "binnenkort"-label in de UI.
- `stock_snapshot_pre_reconcile_*`, `shopify_dates_staging` — snapshot- en staging-tabellen.
- `internal_config` — bewust alleen via service-role (zie `sync-cron-vault-key`).

**Eén groep verdient wél een vraag:** `event_groups`, `event_scanner_access`,
`event_ticket_types`, `event_zones`. De events-module heeft wél werkende routes
(`/admin/events`, `/admin/checkin`) en een eigen hook (`useEventScannerAccess`). Als die
tabellen voor de client dicht zijn, kan de module alleen via service-role-edge-functions
werken. Dat kán kloppen — maar het kan ook betekenen dat er policies via het
Supabase-dashboard zijn toegevoegd die niet in migraties staan, en dan is de repo niet de
waarheid over de beveiliging. Dat is een SQL-vraag (§7).

### 4c. Wat ik níet kan beoordelen — en waarom ik het toch meld

152 van de 154 in `config.toml` geconfigureerde edge functions staan op
`verify_jwt = false`. De overige 75 functions hebben geen config-entry en vallen daarmee op
de Supabase-default (`true`).

Ik heb geprobeerd te meten hoeveel van die 152 hun eigen auth doen. **Dat is mislukt, en
dat is het eerlijke antwoord.** Met een smalle markerlijst kwam ik op "24 zonder check";
een steekproef liet meteen zien dat dat onzin was — `sync-cron-vault-key` doet een
volwaardige `x-cron-secret`-controle die mijn lijst simpelweg niet kende. Met een bredere
markerlijst zakte het aantal naar nul, wat net zo weinig zegt.

> **Conclusie: of deze 152 publieke endpoints correct beveiligd zijn, is niet met grep vast
> te stellen.** Het vraagt een functie-voor-functie review. Dat is precies waar de
> `/security-review`-skill voor bedoeld is, of een deep-dive-ronde. Ik meld liever dat ik
> het niet weet dan dat ik een verzonnen getal in een rapport zet.

Wat ik wél zag: de cron-migratie zet een anon-JWT letterlijk in de SQL. Dat is geen lek —
de anon key is publiek by design en staat ook in `.env` — maar het betekent dat cron zich
authenticeert met een sleutel die iedereen heeft. De beveiliging van die endpoints leunt
dus volledig op wat de functie zelf controleert.

---

## 5. As 4 — Native/mobiel-gereedheid

### 5a. Wat echt werkt — bevestigd

| Onderdeel | Status |
|---|---|
| Push (FCM) | Volledig bekabeld: permissie, token, `device_tokens`-upsert, listener, opruimen bij uitloggen |
| `POST_NOTIFICATIONS` (Android 13+) | Aanwezig — komt via manifest-merging uit `@capacitor-firebase/messaging` |
| Deeplinks | Werkend, met unit-test (`deepLinks.test.ts`) |
| Externe links | `@capacitor/browser`, werkend |
| Landing overslaan in de app | `NativeLandingRedirect`, werkend |
| iOS privacy-strings | `NSCameraUsageDescription` + twee fotobibliotheek-strings aanwezig |
| iOS entitlements | `aps-environment` (push) + `associated-domains` (deeplinks) aanwezig |
| targetSdk | 36, minSdk 24 |

### 5b. Het gat: camera op Android

`android/app/src/main/AndroidManifest.xml` declareert **exact één permissie: `INTERNET`.**
Er is geen `android.permission.CAMERA`, en ik heb nagetrokken dat geen enkele
geïnstalleerde plugin hem via manifest-merging aanlevert — `@capacitor/camera` declareert
alleen `<queries>`, geen permissies, en `grep -rl 'android.permission.CAMERA' node_modules/@capacitor*`
geeft nul treffers.

Gevolg: **`TicketCheckin` (QR-scannen via `html5-qrcode` → `getUserMedia` in de WebView)
kan op Android niet werken.** Op iOS staat de privacy-string er wel, dus daar is de kans
groot dat het wél werkt. Dat is een asymmetrie tussen de twee platforms in een module die
bedoeld is om aan de deur van een evenement te gebruiken — precies de situatie waarin je er
niet achter wilt komen.

De code faalt overigens netjes zichtbaar (`toast.error('Camera niet beschikbaar: …')`), dus
het is geen stille fout. Maar het is wel een dode functie op één van twee platforms.

### 5c. Twee ongebruikte native afhankelijkheden

- **`@capacitor/camera`** — nul aanroepen in heel `src/`. Zit sinds vanochtend wel in de
  Android-build.
- **`useBarcodeScanner`** is een keyboard-wedge voor een hardware-scanner. Op een telefoon
  zonder extern apparaat doet de POS-scanfunctie niets, zonder dat de UI dat vertelt.

---

## 6. Waar ik zou inzoomen — voorstel

Op volgorde van wat het meeste oplevert per bestede uur:

0. **De negen `rules-of-hooks`-schendingen** (§3e). Geen diagnose meer nodig — dit is een
   bekende, gelokaliseerde bug met een bekende fix, en `BolActionsCard` kan een
   productiescherm laten crashen. Dit hoort niet in een onderzoeksronde maar in de eerste
   de beste batch, samen met een lintstap in CI zodat het niet terugkomt.

1. **Cron & edge-function-inventaris.** De 39 onverklaarde functies plus het feit dat de
   planning niet in versiebeheer staat. Uitkomst: een `docs/cron-inventaris.md` die zegt
   wat er draait, hoe vaak, en wat er dood is. Dit is het gebied waar we op dit moment het
   minst weten en waar stille storingen zich verstoppen.
2. **Security-review van de publieke edge functions.** §4c is een open vraag over 152
   endpoints. Dit is de enige as waar de brede scan écht gefaald heeft, en het is ook de as
   met de grootste schade bij een fout.
3. **Verweesde features opruimen of afmaken.** De ~58 losgekoppelde bestanden zijn per stuk
   een beslissing (weggooien of aansluiten), maar samen vertellen ze waar de app half is
   blijven steken. Relatief goedkoop, en het maakt elke volgende diagnose scherper.
4. **Dependencies.** 1 kritiek + 14 hoog, plus 46 MB die niemand gebruikt. Grotendeels
   mechanisch werk met een duidelijk eindpunt.
5. **Bundle-splitting.** 9,1 MB in één chunk. Hoge impact op de gebruikerservaring, maar
   het is een refactor en geen diagnose — dit is de enige van de vijf die ik zou uitstellen
   tot de rest helder is.

Feature-realiteit (as 1) heeft na de audit van vanmiddag geen aparte deep-dive meer nodig;
wat daar overblijft is triage-werk dat we al ingepland hebben.

---

## 7. ~~Wat ik nodig heb van Akke~~ → zelf beantwoord

Deze sectie stond vol SQL-vragen omdat ik aannam dat ik geen databasetoegang had —
`CLAUDE.md` §5 zegt dat. **Dat klopt niet meer:** de Lovable-connector biedt
`query_database`, read-only en zonder credits, en de skill `nomadix-lovable-connector`
noemt dat expliciet "de manier om élke bewering over de database na te trekken".

De antwoorden staan in §9. `CLAUDE.md` §5 moet bijgewerkt worden — zie §10.

## 8. Wat deze scan níet gedekt heeft

- **Runtime-gedrag.** Alles hierboven is statische analyse plus `tsc`, `eslint`, `npm audit`
  en een bundelmeting. Geen enkele bevinding is op een toestel of tegen productie getest.
- **De inhoud van de 229 edge functions.** Ik heb hun aanroepers geteld en hun
  auth-configuratie gelezen, niet hun logica.
- **De vijf custom-frontend tenants.** Die draaien eigen code in eigen Lovable-projecten.
  Geen enkele bevinding hier raakt `storefront-api`, `storefront-resolve` of
  `storefront-customer-api`.
- **Performance en query-gedrag.** Geen N+1-analyse, geen index-check, geen
  `pg_stat_statements`.
- **De i18n-pariteit.** Draait al in CI en is daarmee bewaakt; geen reden om hem hier over
  te doen.

---

## 9. Antwoorden uit de database

Alles hieronder is uitgevoerd met `query_database` tegen het live sellqo-project
(`9932a7fe-43a1-42de-9c64-168968599600`), read-only.

### 9a. De bedrijfsrealiteit — dit ontbrak volledig in ronde 1

12 tenants. De omzetverdeling is de belangrijkste tabel in dit hele document:

| Tenant | Custom frontend | Producten | Orders | Omzet |
|---|---|---|---|---|
| **VanXcel** | ✓ | 47 | **165** | **€ 12.671,71** |
| The Fonske Crawl | — (SellQo-theme) | 1 | 16 | € 50,00 |
| Mancini Milano | ✓ | 66 | 8 | € 54,60 |
| Demo Bakkerij *(demo)* | — | 3 | 2 | € 96,27 |
| Benny Rich | ✓ | 25 | 0 | € 0 |
| Loveke | ✓ | 7 | 0 | € 0 |
| Astra Sleep | ✓ | 4 | 0 | € 0 |
| Zona Dorata | ✓ | 3 | 0 | € 0 |
| SellQo Sandbox *(demo)* | — | 6 | 0 | € 0 |
| Demo Fashion Store *(demo)* | — | 0 | 0 | € 0 |
| SellQo *(intern)* | — | 0 | 0 | € 0 |
| SellQo Speeltuin | — | 0 | 0 | € 0 |

**Totale lifetime-omzet over alle tenants: circa € 12.872 — waarvan 98% bij één tenant.**

Dat verandert hoe je naar de rest van dit rapport kijkt. Een bundle van 9,1 MB, 229 edge
functions en 270 tabellen zijn de infrastructuur van een platform; het gebruik is dat van
één werkende webshop plus een handvol die nog niet gestart zijn. Dat is geen verwijt — zo
zien platforms er vroeg uit — maar het bepaalt wel waar techniek-schuld pijn doet en waar
nog niet. Concreet: **de enige tenant met echte transacties draait op een custom frontend**,
dus de SellQo-storefront zelf is in productie nauwelijks beproefd.

Nog een detail: `tenants.last_login` is `null` voor **alle twaalf**. Die kolom wordt niet
bijgehouden. Wie daarop een "actieve tenants"-rapportage bouwt, bouwt op zand.

### 9b. Zes custom frontends, niet vijf — correctie op CLAUDE.md §1

`CLAUDE.md` §1 ("de eerste wet") somt vijf tenants op: Loveke, VanXcel, Astra Sleep,
Mancini Milano, Zona Dorata. De database zegt zes:

```sql
select t.name, t.slug from tenant_theme_settings ts
join tenants t on t.id = ts.tenant_id where ts.use_custom_frontend is true;
```

→ Astra Sleep, **Benny Rich** (`bennyrich`), Loveke, Mancini Milano, VanXcel, Zona Dorata.

**Benny Rich staat niet in de eerste wet.** De vlag is op 26 augustus 2026 gezet, de tenant
heeft 25 producten. Dat is geen cosmetische omissie: de hele eerste wet bestaat om te
voorkomen dat webshop-werk een custom-frontend-tenant sloopt, en die bescherming werkt via
een lijst met namen. Werk dat "de vijf" controleert, mist Benny Rich.

### 9c. Cron — 16 actieve jobs

| Job | Schema | Roept aan |
|---|---|---|
| `auto-invoice-cron` | elke 5 min | `auto-invoice-cron` |
| `marketplace-sync-scheduler` | elke 5 min | `marketplace-sync-scheduler` |
| `update-bol-tracking-every-5min` | elke 5 min | `update-bol-tracking` |
| `ads-inventory-watch-every-15min` | elke 15 min | `ads-inventory-watch` |
| `ads-bolcom-sync-every-30min` | elke 30 min | `ads-bolcom-scheduler` |
| `poll-tracking-status-every-30min` | elke 30 min | `poll-tracking-status` |
| `sync-bol-inventory-every-30min` | elke 30 min | `sync-bol-inventory` |
| `sync-odoo-invoices-hourly` | elk uur (:17) | `sync-odoo-invoices` |
| `ads-bolcom-reports-4x-daily` | 4× per dag | `ads-bolcom-scheduler` |
| `ads-ai-engine-daily` | 02:00 | `ads-bolcom-scheduler?mode=ai` |
| `expire-unpaid-orders-daily` | 03:00 | `expire-orders` |
| `expire-invitations` | 03:00 | *(pure SQL, geen functie)* |
| `generate-subscription-invoices-daily` | 06:00 | `generate-subscription-invoices` |
| `check-expired-trials-daily` | 06:45 | `check-expired-trials` |
| `process-invoice-dunning-daily` | 07:00 | `process-invoice-dunning` |
| `process-cycle-reminders-daily` | 07:30 | `process-cycle-reminders` |

Alle 16 staan op `active = true`. Eén schijnbare afwijking bleek in orde:
`ads-ai-engine-daily` roept `ads-bolcom-scheduler?mode=ai` aan, niet `ads-ai-engine` — dat
is een modusparameter, geen verkeerde koppeling.

**De bevinding uit §2a blijft staan en wordt hierdoor juist scherper:** deze 16 schema's
bestaan uitsluitend in de database. Twee ervan zijn ooit via een migratie aangemaakt, de
andere veertien niet. Er is geen enkele plek in de repo waar staat dat `auto-invoice-cron`
elke vijf minuten hoort te draaien. Verdwijnt een job, dan merkt niemand het.

### 9d. Edge functions zonder aanroeper — 24, na drie correctierondes

Mijn detectie is drie keer te gretig geweest en drie keer bijgesteld:

1. Eerst miste ik multiline `invoke(\n 'naam')` en de wrapper `invokeWithErrorBody(...)`.
2. Daarna miste ik `cron.job` — dat verklaarde 8 functies.
3. Ten slotte miste ik rauwe `fetch(\`${URL}/functions/v1/naam\`)`-aanroepen. Zo bleek
   `ai-help-assistant` gewoon in gebruik, vanuit `AIHelpChatWindow.tsx:81`.

Na alle correcties: **159 van de 229 worden aangeroepen vanuit `src/`**, en 24 hebben na
aftrek van cron, externe webhooks, custom-frontend-endpoints en eenmalige backfill/repair-
scripts geen aanwijsbare aanroeper:

`ai-chatbot-respond`, `ai-generate-ab-variant`, `automation-scheduler`,
`check-scheduled-notifications`, `create-amazon-buy-shipping-label`,
`create-bank-transfer-order`, `create-checkout-session`, `create-return-label`,
`create-shipping-label`, `handle-inbound-email`, `nano-studio`, `newsletter-confirm`,
`odoo-correct-move-tax`, `odoo-list-taxes`, `odoo-read-move`, `process-gift-card-purchase`,
`reset-monthly-ai-credits`, `scanner-context`, `send-trial-expiry-warning`,
`storefront-customer-api`, `sync-bol-campaign-status`, `sync-cron-vault-key`,
`test-shopify-connection`, `warmup-vat-cache`.

**Onzekerheid gesloten (zelfde dag).** Ik heb de custom-frontend-kant nagelezen via de
connector, op VanXcel — de enige tenant met echt transactievolume. Die praat met SellQo via
twee eigen proxy-edge-functions:

| VanXcel-bestand | Roept aan |
|---|---|
| `supabase/functions/sellqo-proxy/index.ts` | **uitsluitend** `storefront-api` |
| `supabase/functions/sellqo-customer-proxy/index.ts` | **uitsluitend** `storefront-customer-api` |

De proxy vertaalt REST-paden naar één `{ action, tenant_id, params }`-body. De hele
checkout loopt via acties (`checkout_start`, `checkout_customer`, `checkout_address`,
`checkout_shipping`, `checkout_complete`) op `storefront-api` — **niet** via losse functies
als `create-checkout-session` of `create-bank-transfer-order`. Dat komt exact overeen met
het contract dat `CLAUDE.md` §1 beschrijft, en het is nu geverifieerd in plaats van
aangenomen.

Gevolg voor de lijst: `storefront-customer-api` is **in gebruik** en gaat eraf.
`handle-inbound-email` is vrijwel zeker een externe mailhook. Blijven over: **22 functies
zonder aanwijsbare aanroeper.**

Het scherpst daarbinnen is de groep met een cron-vormige naam maar zónder cron-job:
`automation-scheduler`, `check-scheduled-notifications`, `reset-monthly-ai-credits`,
`send-trial-expiry-warning`, `warmup-vat-cache`. Die zijn ofwel dood, ofwel er is ooit een
schema verdwenen — en in dat laatste geval draait er nu stilletjes iets niet meer. Dat is
de eerste groep om na te lopen.

Kanttekening die eerlijk moet blijven staan: "geen aanroeper in de code" bewijst niet dat
een functie niet gedeployed is of niet handmatig wordt aangeroepen.

*(Aanvulling: inmiddels is ook Benny Rich nagelezen — een architectonisch compleet andere
frontend die tot exact hetzelfde tweetal endpoints komt. Zie §11.)*

### 9e. RLS — beter dan de migraties suggereerden

| | Uit migraties (ronde 1) | Uit de live database |
|---|---|---|
| Tabellen | 246 | **270** |
| RLS aan | 247 | **270 — alle** |
| Zonder RLS | 2 (artefacten) | **0** |
| RLS zonder policy | 24 | **5** |

**Geen enkele tabel in dit project staat zonder RLS.** Dat is voor 270 tabellen een
uitstekende score.

De vijf zonder policy zijn allemaal bewust service-role-only, en het zijn precies de
tabellen waar je dat wil:

| Tabel | Rijen | Waarom terecht |
|---|---|---|
| `internal_config` | 3 | Interne secrets (o.a. de cron-secret) |
| `oauth_states` | 21 | OAuth-CSRF-tokens |
| `tenant_odoo_credentials` | 2 | Koppelingsgeheimen |
| `tenant_printful_credentials` | 1 | Idem |
| `ticket_change_tokens` | 0 | Eenmalige tokens |

**En een correctie op ronde 1:** mijn migratie-scan meldde 24 tabellen zonder policy,
waaronder de `event_*`-tabellen. Live zijn dat er 5, en de `event_*`-tabellen hébben
policies. Dat betekent dat **er policies bestaan die niet uit de migraties komen** — via
het Supabase-dashboard of via Lovable toegevoegd. Gevolg: de repo is niet de waarheid over
wie wat mag zien. Een `supabase db diff` of een periodieke policy-export zou dat gat
dichten.

### 9f. De nep-SEO-data is (bijna) nooit gebruikt

```sql
select count(*) from seo_web_vitals;           -- 1 rij, 1 tenant, 25 maart 2026
select count(*) from seo_audit_results;        -- 0
select count(*) from seo_competitor_keywords;  -- 0
select count(*) from seo_search_console_data;  -- 0
```

**Dit verlaagt de ernst van bevinding 1 uit de dode-UI-audit aanzienlijk.** Er staat geen
berg verzonnen cijfers bij echte tenants; er is één rij uit maart, waarschijnlijk van een
test. Het blijft een codeprobleem — de knoppen liegen nog steeds — maar het is géén
datamigratie en géén lopende schade. Dat maakt het goedkoper én minder dringend dan ik het
vanmiddag inschatte.

---

## 10. Correcties op de projectdocumentatie

Twee dingen in `CLAUDE.md` kloppen niet meer met de werkelijkheid. Beide zijn gevonden
tijdens deze diagnose, en beide raken de dagelijkse werkwijze.

**§5 — "Directe Supabase-database-toegang" onder *Wat Claude Code niet kan*.** Dat is
achterhaald. Via de Lovable-connector (`query_database`) is elke read-only SQL-vraag zelf
te beantwoorden, zonder credits. Alle antwoorden in §9 zijn zo verkregen. De regel zoals
hij nu staat kost tijd: hij stuurt vragen naar Akke die de assistent zelf kan oplossen —
precies wat C1 van `nomadix-lovable-connector` verbiedt.

**§1 — de eerste wet noemt vijf custom-frontend-tenants.** Het zijn er zes; Benny Rich
ontbreekt (§9b). Zolang die lijst met namen werkt, moet hij compleet zijn — of, beter, de
lijst moet vervangen worden door de query zelf, zodat hij niet opnieuw kan verouderen.

**Status: beide doorgevoerd op 10 september 2026, na expliciete go.** §1 noemt nu zes
tenants mét de query als bron, en §5 heet nu "Wat hier wel en niet kan" en beschrijft
`query_database` als de normale weg voor read-only vragen. Schrijfacties op de database
blijven buiten Claude Code.

---

## 11. Benny Rich — de nieuwste custom frontend, apart nagelezen

Op verzoek nagetrokken omdat dit de laatst geïmplementeerde frontend is en dus het meest
kans maakt af te wijken. Gelezen: `src/lib/sellqo.functions.ts` (de proxy),
`src/integrations/sellqo/normalizer.ts` van VanXcel ter vergelijking, en het live schema.

### 11a. Het contract houdt — geverifieerd, niet aangenomen

| | VanXcel | Benny Rich |
|---|---|---|
| Proxy-type | Supabase edge function (`sellqo-proxy`) | **TanStack server function** (`sellqoProxy`) |
| Stack | Vite + React | **TanStack Start + React 19** |
| Roept aan | `storefront-api`, `storefront-customer-api` | `storefront-api`, `storefront-customer-api` |
| `storefront-resolve` | — | — (tenant vast via `SELLQO_TENANT_ID`) |
| Protocol | `POST { action, tenant_id, params }` + `X-API-Key` | identiek |

**Geen enkele andere SellQo-edge-function wordt aangeroepen.** De hele checkout loopt via
acties op `storefront-api`. Dat bevestigt de conclusie uit §9d op een tweede, architectonisch
compleet andere frontend — en daarmee is de lijst van 22 functies zonder aanroeper
robuuster dan hij op één steekproef was.

Twee dingen die opvielen en gunstig zijn: de klantsessie-token wordt server-side in een
httpOnly-cookie gezet en uit de payload gestript vóór hij de browser bereikt, en de proxy
weigert een `SELLQO_API_URL` die niet op `/functions/v1/storefront-api` uitkomt.

### 11b. Een derde architectuur die de runbook niet kent

`sellqo-custom-frontend-runbook` beschrijft twee architecturen — "Astra"
(`storefrontApi.ts` met `normalizeCart`) en "Loveke/VanXcel" (`CheckoutContext`) — en
noemt Loveke en VanXcel als referentie-implementaties. **Benny Rich is een derde**, en staat
in geen van beide tabellen. De checklist in dat runbook (patroon 3 in het bijzonder) sluit
daardoor niet aan op wat daar gebouwd is.

### 11c. Het variantlabel-probleem is niet van core — correctie op mijn eigen hypothese

Benny Rich's documentatie meldt dat cart-regels geen variantlabel tonen omdat de tenant
`attribute_values` stuurt. Ik vermoedde een contractbug in core en heb dat nagetrokken:

- Het schema (`product_variants`) heeft **`title`** en **`attribute_values`** — en géén
  `variant_label`, `name` of `option_values`.
- `storefront-api` stuurt per cart-regel `variant: { title, attribute_values, image_url }`
  ([index.ts:1769](../../supabase/functions/storefront-api/index.ts:1769) en
  [:2080](../../supabase/functions/storefront-api/index.ts:2080)).
- **VanXcel's normalizer leest `raw.variant_title || raw.variant?.title`** en werkt dus
  correct.
- Benny Rich's eigen (bevroren) kopie leest `variant_label ?? variant.name ??
  variant.option_values` — drie velden die geen van alle bestaan.

**Conclusie: geen core-bug, maar een fout in één kopie.** De echte bevinding is
structureel: de normalizer is niet gedeeld maar per frontend gekopieerd, en die kopieën
zijn gaan afwijken. Zes frontends betekent zes kopieën. Benny Rich heeft het bovendien in
presentatie omzeild (`cart-labels.ts`) in plaats van de kopie te repareren, omdat hun eigen
regels dat bestand bevroren hadden.

### 11d. Drie van de zes kunnen vandaag geen normale verkoop afronden

| Tenant | Stripe-charges | Actieve verzendmethoden | Blokkade |
|---|---|---|---|
| VanXcel | ✅ | 1 | — |
| Mancini Milano | ✅ | 1 | — |
| Loveke | ✅ | 1 | — |
| **Benny Rich** | ❌ onboarding niet af | 1 | Kaartbetaling dicht |
| **Astra Sleep** | ❌ onboarding niet af | 2 | Kaartbetaling dicht |
| **Zona Dorata** | ✅ | **0** | Checkout strandt op de verzendstap |

Alle zes hebben `bank_transfer` aanstaan, dus bij Benny Rich en Astra Sleep is een
overschrijving technisch nog mogelijk — maar het primaire pad is dicht. Zona Dorata's
blokkade is de hardste: zonder actieve verzendmethode heeft `checkout_shipping` niets om
te kiezen, ongeacht de betaalmethode.

Dat verklaart de nullen in §9a beter dan "nog niet gestart": het zijn drie verschillende,
elk op zichzelf oplosbare blokkades. Geen van drieën is een codeprobleem.

Terzijde: Benny Rich's eigen `CLAUDE.md` stelt dat de tenant "zero active shipping methods"
heeft. Dat is inmiddels 1 — die documentatie is achterhaald.

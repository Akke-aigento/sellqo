## PLAYSTORE-SIGNING-1 — upload-key-infra voor Play App Signing — 20 augustus 2026

Alleen build-configuratie. Geen enkele wijziging aan applicatiecode, database of
edge-functies.

### Root cause

Geen defect maar een gat: de Android-app (`app.sellqo.admin`) stond nog op de kale
Capacitor-scaffold. `android/app/build.gradle` had **geen `signingConfigs`-blok** en
de release-buildType geen `signingConfig`, dus `./gradlew :app:bundleRelease`
leverde een **unsigned AAB** op — die weigert de Play Console.

Twee bijvangsten uit de recon:

**1. Keystores waren niet tegen git beschermd.** Het keystore-blok in
`android/.gitignore` (regels 55-58) stond uitgecommentarieerd — de Capacitor-default
laat de keuze aan de ontwikkelaar. `git check-ignore` op `keystore.properties`,
`test.jks`, `android/keystore.properties` en `android/test.jks` gaf **exit 1 op alle
vier**: een keystore of properties-bestand op schijf zou gewoon met `git add -A`
mee zijn gegaan. Gezien de bekende `public/sitemap.xml`-valkuil (CLAUDE.md §6) een
reëel scenario, niet een theoretisch.

**2. `targetSdkVersion` stond op 35 terwijl `compileSdkVersion` al 36 was.** De
Google-eis schuift eind augustus door naar 36; de SDK was al aanwezig, dus dit was
één regel.

### Uitgevoerd

- **`android/.gitignore`** — regels 55-58: `*.jks` en `*.keystore` uit commentaar,
  `keystore.properties` toegevoegd. De regel "Uncomment the following lines if…"
  vervalt; die instructie is nu uitgevoerd en zou verwarrend achterblijven.
- **`.gitignore` (root)** — dezelfde drie patronen toegevoegd. `android/.gitignore`
  dekt alleen paden ónder `android/`; een keystore in de projectroot of in `ios/`
  bleef anders onbeschermd.
- **`android/variables.gradle`** — `targetSdkVersion` 35 → 36.
- **`android/app/build.gradle`** — conditionele signing (patroon hieronder), plus
  een comment boven `versionCode` dat elke Play-upload een hogere `versionCode`
  nodig heeft. `versionCode 1` / `versionName "1.0"` bewust ongewijzigd: dit is v1.
- **`android/keystore.properties.example`** (nieuw) — placeholders, wél in git als
  naslag. De gitignore-regel `keystore.properties` matcht een bestandsnaam exact en
  dekt `.example` niet, dus een negatie-regel was niet nodig.

### Het conditionele-signing patroon

De kern van deze batch, en het stuk dat je later terug wil vinden. Credentials
staan in `android/keystore.properties` — buiten git — en Gradle leest dat bestand
alleen als het bestaat:

```gradle
def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}
```

Zowel `signingConfigs.release` als de koppeling in `buildTypes.release` staat achter
diezelfde `if`. Zonder die guard klapt elke verse clone, elke CI-run en elke
debug-build om op een ontbrekend bestand. Mét de guard degradeert het netjes: geen
keystore → release-variant blijft unsigned, debug-builds werken door.

Twee valkuilen bij het invullen van het echte bestand:

- **`storeFile` moet een absoluut pad zijn.** `file()` resolvet relatieve paden
  tegen `android/app/`, niet tegen de repo-root — en de keystore hoort buiten de
  repo. Staat zo ook in de `.example`.
- **Een ontbrekende sleutel faalt luid.** Bij een typo geeft
  `keystoreProps['storeFile']` null en klapt `file(null)` er tijdens de
  configuratiefase uit. Bewust niet afgevangen: stil doorgaan met een half
  geconfigureerde signing is erger dan een harde fout.

`rootProject` is hier `android/`, niet de repo-root — vandaar dat de
gitignore-regel in `android/.gitignore` precies het juiste pad dekt.

### Security-keuzes

Geen RLS-, policy- of grantwijziging; deze batch raakt de database niet. De
security-winst zit in git-hygiëne: keystores, `.keystore`-bestanden en
`keystore.properties` kunnen niet meer per ongeluk gecommit worden, op geen enkel
pad in de repo. Er zijn **geen echte credentials aangemaakt of aangeraakt** — de
keystore wordt door Akke lokaal buiten de repo gegenereerd. Play App Signing is de
gekozen opzet: Google houdt de app-signing-key, wij uploaden met een upload-key die
bij verlies vervangbaar is.

`android/app/google-services.json` blijft bewust in git. Het bevat client-config en
een Firebase-API-key die publiek mag zijn, geen serversecrets.

### Gedeelde-paden-waarschuwing

N.v.t. — en dat is hier onderbouwd, niet aangenomen. Deze batch raakt uitsluitend
Gradle-buildconfiguratie en gitignores van de Android-wrapper. Geen React-component,
geen tabel, geen migratie, en geen van de drie gedeelde edge-functies
(`storefront-resolve`, `storefront-api`, `checkout-engine`). De vijf
custom-frontend-tenants kunnen hier per constructie niets van merken.

### Verificatie

- `git check-ignore -v` op `android/keystore.properties`, `android/test.jks`,
  `android/app/release.keystore` → alle drie gevangen (exit 0), respectievelijk op
  `android/.gitignore` regels 58, 56, 57.
- `git check-ignore -v` op `keystore.properties`, `test.jks`,
  `sellqo-upload.keystore` vanaf de repo-root → alle drie gevangen via
  `.gitignore` regels 34, 32, 33.
- `git check-ignore android/keystore.properties.example` → **exit 1**, correct
  niet-genegeerd.
- `./gradlew :app:signingReport` → **BUILD SUCCESSFUL in 41s**, exit 0. Release-variant
  rapporteert `Config: null` / `Store: null` / `Alias: null` — precies het gewenste
  gedrag zonder `keystore.properties`. Daarmee is de "zonder keystore blijft alles
  werken"-kant hard aangetoond.
- `git status` vóór commit: alleen de vier gewijzigde bestanden plus de nieuwe
  `.example`. Geen keystore, geen `public/sitemap.xml`-drift.
- De twee `flatDir`-waarschuwingen in de Gradle-output zijn bestaand (uit het
  Capacitor-gegenereerde `repositories`-blok) en geen regressie.

### Bewust ongemoeid / Vervolg

- **De keystore zelf en `keystore.properties`** zijn niet aangemaakt — Akke
  genereert die lokaal. De "mét keystore"-kant van het patroon is dus nog niet
  getest; `./gradlew :app:signingReport` hoort dan `Config: release` met store en
  alias te tonen.
- **`minifyEnabled false`** op release blijft staan. Dat is Capacitor-default en
  hier verdedigbaar: het is native Java-wrapper-code die nauwelijks te krimpen
  valt, de echte app zit in de webassets. Aanzetten kan reflectie in de plugins
  breken.
- **targetSdk 36 is niet op een toestel gesmoke-test.** API 36 scherpt de
  edge-to-edge-afdwinging aan die met 35 begon; voor een Capacitor-WebView kan dat
  content onder de statusbar of navigatiebalk schuiven. Dat moet op een echt
  toestel gezien worden, niet uit een changelog afgeleid. Fix is dan safe-area
  insets, geen reden om targetSdk terug te draaien.
- **`android/build/` en `android/.gradle/`** bevatten build-output van 7 augustus
  met een debug-dex. Gitignored, dus geen git-risico — maar draai een schone build
  vóór de eerste AAB-upload.
- **Geen changelog-, doc_articles- of newsletter-entry.** CLAUDE.md §4 geldt voor
  batches die tenant-zichtbaar gedrag veranderen; dit is interne build-infra die
  geen enkele tenant ziet. Zodra de app daadwerkelijk in de Play Store staat, is
  dát wel changelog-waardig.

---

## EVENT-UI-2 — snelacties per event-kaart, veilige delete, dashboardfilter — 20 augustus 2026

Dekt batch 2a (`0f32c3e5`) en 2b (`e9f1284f`) samen.

### Root cause

Geen defect maar een gat: alles rond een event-datum — bewerken, scannen,
dupliceren, afronden — vereiste doorklikken naar de eventpagina of het product.
Bij het bouwen van het snelacties-menu kwamen wél drie echte defecten boven:

**1. Verwijderen zou vrijwel altijd stuklopen op een ruwe FK-fout.** De eerste
opzet van `useDeleteEventQuick` telde alleen `ticket_instances` met status
`valid`/`checked_in`. Maar **geen enkele FK naar `event_details` heeft
`ON DELETE CASCADE`** — nagetrokken over alle migraties, nul treffers. Zeven
tabellen verwijzen ernaar: `event_zones` (`20260819083247:40`),
`event_ticket_types` (`:66`), `event_scanner_access` (`:99`), `ticket_scans`
(`:126`), `ticket_instances` (`20260813231325:30`), en `storefront_cart_items` +
`order_items` (`20260814112422:1-2`). Een event met tickettypes — de normale
toestand — gaf dus een Postgres-`23503` als Engelse ruwe tekst in een toast.
Precies de dode affordance uit CLAUDE.md §2.

**2. Dupliceren kopieerde twee gedragsbepalende velden niet.**
- `capacity_mode` (`text NOT NULL DEFAULT 'sold'`, check `IN ('sold','inside')`,
  `20260819083247:22,32`) stuurt de capaciteitshandhaving aan de deur. Een
  `'inside'`-event viel in de kopie stil terug op `'sold'`.
- `event_ticket_types.zone_ids` beperkt bij welke zones een tickettype toegang
  geeft; de scan-RPC weigert erop (`20260819104515:83-84`). Zonder kopie werd de
  duplicaat-toegang **ruimer** dan het origineel.

**3. Auto-default-zone maakte een leeg event onverwijderbaar** (gevonden na de
smoke-test op event `dc354adf`). Een default-zone ontstaat automatisch (fase 4c,
en sinds 2a ook bij dupliceren), dus de tenant maakte hem nooit bewust — maar hij
telde wel als blokker.

**4. `?event=:id` vond een afgelopen event niet.** De kieslijst in
`TicketCheckin` filtert op `scheduled`/`confirmed` (bewust), en de preselect zocht
in díe lijst. Een `completed` event stond er niet in, dus "Scanner openen" viel
terug op handmatig kiezen.

### Uitgevoerd

- **`src/components/admin/events/EventCardActions.tsx`** (nieuw) — dropdown met
  Bewerken · Scanner openen · Dupliceren — Afronden · Annuleren — Verwijderen,
  plus dupliceer-dialog en twee confirms. De kaart eronder navigeert
  (`EventDashboard.tsx:158`), dus elke interactie stopt propagatie; Radix portalt
  de content, maar React-events bubbelen langs de React-boom, dus dat is nodig.
- **`src/hooks/useDuplicateEvent.ts`** (nieuw) — `useDuplicateEvent`,
  `useUpdateEventStatusQuick`, `useDeleteEventQuick`. Bronwaarden vers uit de DB,
  XOR-scope gerespecteerd (alleen `event_detail_id`, nooit `valid_from` of
  `event_group_id`).
- **Delete-guard** — menu-item blijft zichtbaar maar wordt uitgeschakeld met
  tooltip zodra er blokkerende kinderen zijn. Telling haakt aan op het bestaande
  batch-patroon: tickets komen gratis uit de stats-query (nieuw veld `total`,
  álle statussen), de overige drie tabellen kosten drie selects over de hele set
  in één `Promise.all`. Geen N+1. `ticket_scans` hoeft niet apart:
  `ticket_scans.ticket_instance_id` is `NOT NULL` naar `ticket_instances`.
- **Default-zones** tellen niet als blokker (`is_default = false` in de telling)
  en worden vlak vóór de delete opgeruimd — na de ticket-guard, vóór het event.
  Hangt er een scanner-toegang aan die zone, dan weigert Postgres die opruiming;
  die `23503` valt door naar het vangnet in plaats van als harde fout te eindigen.
- **`capacity_mode`** meegekopieerd bij dupliceren.
- **`zone_ids`** — zie Security-keuzes; zones worden meegedupliceerd en de id's
  omgezet via `mapZoneIds()`.
- **Preselect losgekoppeld** — eigen query op precies dat ene event-id, ongeacht
  status. `cancelled` opent niet maar waarschuwt; `completed` opent wel.
- **Dashboardfilter** — één `showPast`-state schakelt de `since`-ondergrens om:
  uit = 1 dag terug, aan = 180 dagen.
- **i18n** — `events.actions.*`, `events.actions.deleteBlockedHint`,
  `events.dashboard.showPast`, `events.checkin.preselectCancelled` in vijf talen.

### Security-keuzes

Geen RLS, policies of grants gewijzigd. Alle nieuwe queries filteren expliciet op
`tenant_id` bovenop de bestaande RLS; de `ticket_instances`-telling in
`useDeleteEventQuick` was aanvankelijk **niet** tenant-gescoped en is dat nu wel.

**`zone_ids`: bewust afgeweken van een letterlijke kopie, en dat is een
toegangskwestie.** `event_zones` is per-event (`event_detail_id`, XOR met
`event_group_id`) en `zone_ids uuid[]` bevat de UUID's van díe rijen — een array,
dus zonder FK die afdwingt dat ze bij het juiste event horen. De scan-RPC toetst
`p_zone_id = ANY(v_tt.zone_ids)`, waarbij `p_zone_id` van
`event_scanner_access.zone_id` van het **duplicaat** komt
(`20260819083247:100`). Verbatim kopiëren laat het duplicaat dus naar de zones van
het origineel wijzen, waarna elke scan op `not_allowed_zone` strandt: van te ruim
naar volledig onscanbaar. Daarom worden de zones zelf meegedupliceerd en de id's
omgezet. Een bron-id dat niet te mappen valt is een **harde fout**, geen stille
weglating — weglaten zou de beperking juist verruimen.

### Gedeelde-paden-waarschuwing

n.v.t. — geen gedeeld pad geraakt. Geen migratie in deze batch; `storefront-api`,
`checkout-engine` en `storefront-resolve` zijn niet aangeraakt, evenmin als de
gedeelde tabellen. Alles zit in `src/pages/admin`, `src/components/admin` en
`src/hooks`. Het `use_custom_frontend`-pad is ongemoeid.

### Verificatie

- `npx tsc --noEmit -p tsconfig.app.json` — exit 0 (per stap gedraaid).
- `npm run build` — exit 0, alleen de bestaande chunk-size-waarschuwing.
- `node scripts/i18n-parity.mjs` — exit 0, 5 talen, 2498 keys.
- FK-cascade: `grep` op `ON DELETE CASCADE` over alle migraties → nul treffers bij
  `event_details`. Dat is de basis onder de hele delete-guard.
- Radix-gedrag nagelezen in `node_modules/@radix-ui/react-tabs` en de
  scan-RPC-migraties, niet aangenomen.
- Smoke-test door Akke in SellQo Speeltuin: dupliceren en de verwijderknop.
  Daaruit kwam de default-zone-bevinding (event `dc354adf`), verwerkt in 2b.
- **Onderweg gevangen fout van Claude:** de eerste opzet van de zone-telling zette
  `.eq('is_default', false)` conditioneel op een union van drie query-builders →
  `TS2589: Type instantiation is excessively deep`. De drie queries staan nu elk
  uitgeschreven. Bewijs dat de typecheck hier iets vangt dat de build niet ziet.

### Bewust ongemoeid / Vervolg

- **Helft B — `completed` verdwijnt niet uit de webshop.** `storefront-api` sluit
  alleen `cancelled`, `skipped` en `merged` uit
  (`supabase/functions/storefront-api/index.ts:601`); `completed` valt daar niet
  onder en verdwijnt pas via `isEventStillOpen()` op tijdbasis. Een event dat je
  vóór de eindtijd op afgerond zet, blijft dus verkoopbaar. Die fix is **niet
  gebouwd** en raakt een gedeeld pad, dus vraagt een eigen recon en apart akkoord.
  De changelog- en nieuwsbriefteksten vermijden die claim bewust; de
  nieuwsbrief-entry draagt een expliciete waarschuwing.
- **`storefront_cart_items` telt niet mee als blokker.** Te vluchtig om een knop op
  te laten knipperen; de 23503-vertaling vangt dat pad leesbaar af.
- **Dashboardfilter: 180 dagen, niet "alles".** Zonder ondergrens zou
  `.order('event_date', asc).limit(200)` de **oudste** 200 events opleveren en de
  aankomende uit beeld duwen. Bij meer dan 200 events in een half jaar kan die
  afkap alsnog optreden; paginering is de volgende stap als dat speelt.
- **Kieslijst van de scanner blijft `scheduled`/`confirmed`** — alleen de
  preselect kijkt breder.
- **Correctie op EVENT-UI-1-rapportage:** daar is gemeld dat `isEventStillOpen`
  niet bestaat. Dat gold voor `src/`; de functie staat in
  `supabase/functions/storefront-api/index.ts:120` en is juist de kern van helft B.

## EVENT-UI-1 — dubbele check-in, dataverlies bij tab-wissel, scannen genest onder Events — 20 augustus 2026

### Root cause

Drie losse oorzaken in het event-pad, alle drie tenant-zichtbaar.

**1. Dubbele check-in door een cooldown die vanaf de verkeerde kant telde.**
`handleToken()` in `src/pages/admin/TicketCheckin.tsx` beschermde tegen herhaalde
scans van dezelfde QR met `Date.now() - last.at < 3000`, waarbij `last.at` gezet
werd **vóór** de netwerk-round-trip naar de `ticket-checkin`-functie. De
`html5-qrcode`-scanner draait op `fps: 10`, dus zolang een QR voor de camera hangt
komt er ~10× per seconde een callback binnen. Duurde de round-trip langer dan drie
seconden — traag netwerk aan de deur is het normale geval, niet het randgeval — dan
was het venster al verlopen op het moment dat het antwoord binnenkwam, en werd de
eerstvolgende callback als een nieuwe scan behandeld. Resultaat: dezelfde bezoeker
een tweede keer ingecheckt. De `busyRef`-lock van 600 ms dekte dit niet af, want die
werd losgelaten ruim vóór het cooldown-venster verliep.

**2. Onopgeslagen wijzigingen verdwenen bij een tab-wissel.**
`EventCoreSettingsCard` houdt zijn formulier in lokale `useState`
(`src/components/admin/events/EventCoreSettingsCard.tsx:69`). De kaart hangt in een
Radix `TabsContent` (`src/pages/admin/EventDetail.tsx:657`). Radix rendert
`children: present && children` met `present = forceMount || isSelected`
(`node_modules/@radix-ui/react-tabs/dist/index.mjs:157,174`), dus zonder `forceMount`
wordt de inactieve tab **ge-unmount** en gaat de componentstate verloren. Wie datum
en capaciteit aanpaste, even naar Deelnemers keek en terugkwam, vond een leeg
gewijzigd formulier terug — zonder enige waarschuwing.

**3. QR-scannen stond los van Events in de sidebar.**
`ticket-checkin` en `event-dashboard` stonden als twee ongerelateerde items naast
elkaar in `salesItems` (`src/components/admin/sidebar/sidebarConfig.ts:130-131`),
terwijl check-in functioneel bij een event hoort. Geen bug, wel een navigatie die
niet met het datamodel meebewoog sinds de eventpagina er kwam (2026.10i).

### Uitgevoerd

- **`src/pages/admin/TicketCheckin.tsx`**
  - `SAME_TOKEN_COOLDOWN_MS = 4000` en `SCAN_BUSY_RELEASE_MS = 800` als benoemde
    constanten, in plaats van magische getallen op de plek van gebruik.
  - Het cooldown-venster wordt in de `finally` opnieuw gestempeld, dus het telt
    vanaf het **einde** van de vorige verwerking. De stempel bij de start blijft
    staan, zodat callbacks tijdens de round-trip al genegeerd worden.
  - De herstempeling staat achter `if (lastTokenRef.current?.token === token)`, zodat
    een intussen gescande andere QR niet overschreven wordt.
- **`src/pages/admin/EventDetail.tsx`** — de settings-`TabsContent` krijgt
  `forceMount` plus `data-[state=inactive]:hidden`. Die klasse is noodzakelijk, niet
  decoratief: met `forceMount` is `present` altijd waar en zet Radix zijn eigen
  `hidden`-attribuut niet meer (`hidden: !present`, regel 164). Zonder de klasse zou
  de instellingen-tab op elk tabblad zichtbaar zijn. Alleen deze tab is aangeraakt.
- **`src/components/admin/events/EventCoreSettingsCard.tsx`** — `isDirty` via een
  JSON-vergelijking van de huidige `form` met `toForm(event)` (`FormState` is plat,
  dus stabiel), `resetForm()`, en de bestaande `FloatingSaveBar`. De Opslaan-knop is
  nu disabled zolang er niets gewijzigd is.
- **`src/components/admin/sidebar/sidebarConfig.ts`** — `ticket-checkin` is een
  `children`-item van `event-dashboard` geworden, met een nieuw `events-all`-item dat
  naar `/admin/events` wijst. Ongebruikte `QrCode`-import verwijderd.
- **`src/i18n/locales/{nl,en,fr,de,uk}.json`** — `navigation.items.events_all`.

### Security-keuzes

n.v.t. — geen RLS, policies, grants of rechten geraakt. De `allowedRoles` op beide
sidebar-items zijn ongewijzigd overgenomen (`platform_admin`, `tenant_admin`,
`staff`) en gelden ook op het nieuwe `events-all`-kind. De sidebar is presentatie:
`shouldHideItem()` bepaalt zichtbaarheid, niet toegang — die blijft bij de
route-guards en RLS. Er is dus geen pad ontstaan waarlangs een rol iets bereikt wat
hij eerst niet mocht.

De check-in-fix verkleint het aanvalsoppervlak niet, maar wel het foutoppervlak: een
dubbele check-in schreef een tweede rij in het scan-log en verstoorde de
`Nu binnen`-teller.

### Gedeelde-paden-waarschuwing

n.v.t. — geen gedeeld pad geraakt. `storefront-api`, `checkout-engine` en
`storefront-resolve` zijn niet aangeraakt, evenmin als `tenant_theme_settings`,
`themes`, `homepage_sections` of `storefront_pages`. Alle vier de gewijzigde
codebestanden zitten in het admin-pad (`src/pages/admin`, `src/components/admin`),
dat de vijf custom frontends niet renderen. Geen migratie in deze batch. Het
`use_custom_frontend`-pad is byte-voor-byte ongemoeid.

### Verificatie

- `npx tsc --noEmit -p tsconfig.app.json` — exit 0, 0 fouten (twee keer gedraaid: na
  de eerste en na de tweede patch).
- `npm run build` — exit 0, alleen de bestaande chunk-size-waarschuwing.
- Radix-gedrag nagelezen in `node_modules/@radix-ui/react-tabs/dist/index.mjs:145-175`
  in plaats van aangenomen: `data-state` wordt op `inactive` gezet, `hidden: !present`,
  `children: present && children`.
- Sidebar-nesting nagetrokken in `src/components/admin/AdminSidebar.tsx:221-228`: een
  item mét `children` rendert als `CollapsibleTrigger` **zonder** `NavLink`. Het
  `events-all`-kind is daarom noodzakelijk om `/admin/events` bereikbaar te houden —
  geen dode affordance, en geen duplicaat.
- `getAllMenuItems()` (`sidebarConfig.ts:276-280`) loopt door `children`, dus beide
  items blijven zichtbaar in de aanpassen-dialoog en bestaande verberg-voorkeuren op
  id `ticket-checkin` blijven werken.
- `grep` op `ticket-checkin` / `event-dashboard` over `src/`: geen verwijzingen buiten
  `sidebarConfig.ts` (de treffers zijn react-query-keys en de edge-functienaam).
- Changelog-pariteit machinaal nagerekend: 111 ids in `changelogEntries`, 111 entries
  in elk van de vijf `landing.*.json`, geen id zonder vertaling en geen weesvertaling.

### Bewust ongemoeid / Vervolg

- **De `FloatingSaveBar` is niet zichtbaar vanaf een ander tabblad.** De balk staat
  binnen de settings-`TabsContent`, en `data-[state=inactive]:hidden` is
  `display: none` — dat onderdrukt ook afstammelingen met `position: fixed`. De
  **form-state overleeft** de wissel nu wel, dus het dataverlies is verholpen; de
  zichtbare waarschuwing verschijnt pas als je terug bent op Instellingen. Wil je de
  balk overal zien, dan moet de dirty-state omhoog naar `EventDetail` en de balk
  buiten `Tabs` gerenderd worden. Niet gedaan: dat is een herstructurering van de
  kaart, geen gedragsfix.
- **De overige tabs houden hun unmount-gedrag.** Alleen `settings` heeft een
  formulier; `forceMount` op de andere tabs zou onnodig queries warm houden.
- **De cooldown van 4 s is een vaste waarde, niet instelbaar.** Bewust: een
  instelling hier is een knop die niemand goed kan afstellen zonder de round-trip te
  meten. Blijkt 4 s in de praktijk te kort bij een trage verbinding, dan is de
  volgende stap het venster laten meeschalen met de gemeten duur, niet een
  tenant-instelling.
- **Niet getest met echte camera-hardware.** De race is per constructie verholpen en
  door codelezing onderbouwd, maar een fysieke test aan de deur (QR laten hangen,
  controleren dat er één scan-logregel bijkomt) staat nog open. Dat vraagt een
  apparaat met camera op SellQo Speeltuin of Demo Bakkerij.
- **`doc_articles`: n.v.t.** — geen nieuw adminscherm, geen nieuwe route. Het
  bestaande artikel op `context_path = '/admin/events'` blijft kloppen; de
  herschikking betreft het menu, niet de pagina.

## CART-DISCOUNT-TOTALS-1 — volledige cart-shape met korting en totalen — 19 augustus 2026

**Root cause:** `cartGet` in `supabase/functions/storefront-api/index.ts` gaf enkel
`discount_codes` + bruto `subtotal` terug. Kortingsbedragen, verzending, btw en
totaal werden alleen in het checkout-pad (`buildCartResponse`) berekend, waardoor
storefronts de korting niet konden tonen. Daarnaast gooide `cartApplyDiscount` een
`DiscountCodeError` (400 `invalid_discount_code`) bij een al toegepaste code —
niet te onderscheiden van een echt ongeldige code.

**Uitgevoerd:**
- `computeCartTotals()` toegevoegd: berekent server-side `subtotal`,
  `discount_code` (canonieke schrijfwijze), `discount_amount`,
  `applied_discounts`, `shipping`, `tax`, `total`, `free_shipping_eligible` en
  `free_shipping_remaining`. Respecteert `applies_to`
  (`specific_products` / `specific_categories` via `product_categories`),
  min-besteding, geldigheid en `maximum_discount_amount`.
- `cartGet` retourneert die shape; `cart_add_item`, `cart_update_item`,
  `cart_remove_item`, `cart_apply_discount` en `cart_remove_discount` delegeren al
  naar `cartGet` en geven dus dezelfde volledige shape.
- `cartApplyDiscount` is idempotent: een al toegepaste code geeft HTTP 200 met de
  actuele cart. `invalid_discount_code` (400) blijft voor echt ongeldige codes.
- `validateDiscountCode` geeft additief `product_ids` en `category_ids` terug.

**Security-keuzes:** n.v.t. — geen RLS, policies of grants geraakt. Alle reads
lopen via de bestaande service-role-client met expliciete `tenant_id`-filter.

**Gedeelde-paden-waarschuwing:** `storefront-api` is een gedeeld pad voor de vijf
custom frontends. De wijziging is strikt additief: bestaande sleutels
(`id`, `session_id`, `currency`, `items`, `item_count`, `subtotal`,
`expires_at`, `discount_codes`) blijven aanwezig met hetzelfde type.
`discount_codes` bevat nu de gevalideerde canonieke codes (string[]), wat gelijk
is aan de opgeslagen waarde sinds DISCOUNT-CASE-1. Het checkout-pad
(`buildCartResponse`) is ongemoeid gelaten.

**Verificatie:** edge function gedeployed; cart-acties functioneel getest in
SellQo Speeltuin (korting, idempotente herhaling, verwijderen).

**Vervolg:** btw in `cartGet` gebruikt het tenant-standaardtarief inclusief-model;
het regime-bewuste pad (`resolveCartVatContext`) blijft voorbehouden aan de
checkout-response.

## DISCOUNT-CASE-1 — kortingscodes case-insensitive matchen — 19 augustus 2026

### Root cause
`validateDiscountCode()` in `supabase/functions/storefront-api/index.ts` matchte de
door de klant ingetypte code met `.eq('code', code)` op de exact meegegeven string.
De admin sloeg codes op als `code.toUpperCase()` (zonder trim), dus een klant die
`welkom10` of ` WELKOM10 ` intypte kreeg "Ongeldige kortingscode". Erger: op het
cart-pad (`cartApplyDiscount`) werd die fout als een gewone `Error` gegooid en
kwam die in de top-level catch terecht → **HTTP 500**, waardoor frontends niet
konden onderscheiden tussen een verkeerde code en een serverfout.

### Uitgevoerd
- **`supabase/functions/storefront-api/index.ts`**
  - Nieuwe helper `normalizeDiscountCode()` (`String(x).trim().toUpperCase()`) en
    een `DiscountCodeError`-klasse.
  - `validateDiscountCode()` normaliseert de input, accepteert zowel `code` als
    `discount_code`, matcht op de canonieke waarde en heeft een `ilike`-fallback
    (met geëscapete `%`, `_`, `\`) voor eventuele niet-gecanonicaliseerde rijen.
    Retourneert nu additief `code` (de opgeslagen canonieke schrijfwijze).
  - `cartApplyDiscount` / `cartRemoveDiscount` / `checkoutApplyDiscount`:
    normalisatie, case-insensitieve duplicaatcheck, en het opslaan van de
    **canonieke** code in `storefront_carts.discount_codes`.
  - Ongeldige code → `DiscountCodeError` → top-level catch geeft **HTTP 400** met
    `{ success: false, error: 'invalid_discount_code', message: <reden> }`.
  - `buildCartResponse()` geeft additief `discount_code` (canonieke actieve code)
    en `discount_amount` terug, náást de bestaande `applied_discounts` en
    `discount_total`.
- **`src/hooks/useDiscountCodes.ts`** — create én update slaan `code.trim().toUpperCase()` op.
- **Migratie** — pre-flight `RAISE EXCEPTION` bij casing-conflicten (0 gevonden),
  daarna `UPDATE ... SET code = upper(btrim(code))` (0 rijen geraakt) en
  `CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_tenant_upper_code_key ON
  public.discount_codes (tenant_id, upper(code))`. Idempotent; handmatig terugdraaien
  met `DROP INDEX IF EXISTS public.discount_codes_tenant_upper_code_key;`.

### Security-keuzes
Geen RLS-, policy- of grantwijziging. De unieke index is een integriteitsregel,
geen rechtenwijziging. Alle lookups blijven expliciet op `tenant_id` gefilterd.

### Gedeelde-paden-waarschuwing
`storefront-api` is een gedeeld pad voor de vijf custom frontends. De wijziging is
**strikt additief** voor hen: bestaande sleutels (`applied_discounts`,
`discount_total`, `discount_codes`) blijven ongewijzigd; `discount_code` en
`discount_amount` zijn nieuw. Enig gedragsverschil: een ongeldige code op
`cart_apply_discount` geeft nu 400 i.p.v. 500 (beide non-2xx, dus bestaande
error-handling blijft werken) en `checkout_discount` geeft bij een ongeldige code
nu 400 i.p.v. 200 met `data.success = false`. Dat was expliciet gevraagd zodat
frontends "code bestaat niet" kunnen onderscheiden van een serverfout.

### Verificatie
- SQL-natrek vóór de migratie: `0` rijen met `code <> upper(btrim(code))`, `0`
  casing-conflicten per tenant.
- Na de migratie: index `discount_codes_tenant_upper_code_key` aanwezig.
- `node scripts/i18n-parity.mjs`: volledige pariteit, 2473 keys × 5 talen.
- `npx tsc --noEmit -p tsconfig.app.json`: exit 0.
- Live end-to-end tegen de gedeployde `storefront-api` met een wegwerpcode
  `TESTCASE1` in SellQo Speeltuin:
  - `validate_discount_code` met `testcase1`, ` TeStCaSe1 ` en `TESTCASE1` → alle
    drie `valid: true` met `code: "TESTCASE1"` (HTTP 200).
  - `cart_apply_discount` met `testcase1` → HTTP 200, `discount_codes: ["TESTCASE1"]`
    plus de nieuwe velden `discount_code: "TESTCASE1"` en `discount_amount: 0`.
  - `cart_apply_discount` met `nietbestaand` → **HTTP 400**
    `{"success":false,"error":"invalid_discount_code","message":"Ongeldige kortingscode"}`.
  - Dubbele toepassing (`TESTCASE1`) → HTTP 400 "Deze kortingscode is al toegepast".
  - `cart_remove_discount` met `testcase1` → HTTP 200, `discount_codes: []`.
  - Testcode en testcart daarna verwijderd; geen restdata in Speeltuin.

### Bewust ongemoeid / Vervolg
- `src/lib/promotions/calculators/discountCode.ts` (client-side calculator) krijgt
  de code al genormaliseerd aangeleverd en is niet aangepast.
- `orders.discount_code` bevat historisch de door de klant ingetypte schrijfwijze;
  bestaande orders zijn niet herschreven.

## EVENT-SYSTEEM FASE 4d — event-velden leidend + live teller — 19 augustus 2026

### Root cause / aanleiding
Na 4a stond de event-kern (`status`, `event_date`, `start_time`, `end_time`, `location_name`,
`meeting_point`, `capacity`, `min_attendees`) read-only op `src/pages/admin/EventDetail.tsx`,
terwijl bewerken alleen kon via `ProductEventDatesTab.tsx` — de verkeerde plek zodra een event
zijn eigen pagina heeft. Bovendien las EventDetail `capacity` met `?? 0`, waardoor een
NULL-capaciteit (ongelimiteerd) als 0 (niets verkoopbaar) toonde. De bezettingstellers waren
statisch: `ticket_scans` zat niet in `supabase_realtime`.

### Uitgevoerd
- **Migratie (additief)** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_scans;`
  Geen kolomwijziging, geen REPLICA IDENTITY FULL (we tellen INSERTs). Geverifieerd via
  `pg_publication_tables`: `ticket_scans` aanwezig.
- **`src/hooks/useEventDetails.ts`** — `capacity` in `EventDetail` en `EventDateFormData` is nu
  `number | null`, zodat "ongelimiteerd" als echte NULL geschreven kan worden.
- **`src/components/admin/events/EventCoreSettingsCard.tsx` (nieuw)** — bewerkbare kern-kaart,
  schrijft via de bestaande `useUpdateEventDate` (niet gedupliceerd). Checkbox "Ongelimiteerde
  capaciteit" schrijft `capacity: null`; nooit `?? 0`. Twee guards in één AlertDialog:
  (a) status → `cancelled|skipped|merged` ("verdwijnt uit je webshop, bestaande tickets blijven
  geldig"), (b) `capacity < verkocht` ("stopt nieuwe verkoop, bestaande tickets blijven geldig").
  Beide waarschuwen, blokkeren niet — de backend staat het toe.
- **`src/pages/admin/EventDetail.tsx`** — nieuw tabblad "Instellingen" met die kaart;
  `capacity` toont `∞` bij NULL (stats, bezetting, tickettype-plafond) en het percentage valt weg
  bij ongelimiteerd. Realtime-abonnement op `ticket_scans` gefilterd op
  `event_detail_id=eq.<id>` (INSERT) → invalidatie van scan-log en deelnemers, met een klein
  "live"-puntje bij "Nu binnen"; `supabase.removeChannel` in de cleanup (patroon van
  `RealtimeActivityFeed.tsx`).
- **`src/components/admin/products/ProductEventDatesTab.tsx`** — read-only spiegel: per datum een
  knop "Bewerken op de event-pagina" (`/admin/events/:id`). De bestaande bewerk-dialoog blijft
  bestaan maar is nu de vroegboekkorting-dialoog: kernvelden staan disabled met doorlink, en de
  update stuurt bij bewerken **alleen** de `early_bird_*`-velden mee. Aanmaken, bulk-plannen,
  verplaatsen, overslaan en samenvoegen bleven ongewijzigd op de product-tab. Capaciteit toont
  `∞` bij NULL.
- **i18n** — `events.tabs.settings`, `events.stats.live` en `events.settings.*` (incl.
  `guards.*`) in nl/en/fr/de/uk.

### Security-keuzes
n.v.t. voor RLS/policies/grants: geen nieuwe tabel, geen policy-wijziging. De
publicatie-toevoeging op `ticket_scans` levert alleen events aan abonnees die de rij via de
bestaande tenant-scoped RLS mogen lezen.

### Gedeelde-paden-waarschuwing
`storefront-api`, `checkout-engine` en de issuance/check-in-functies zijn **niet** aangeraakt.
Zij lazen `event_details` al live, dus dit is puur een UI-verhuizing van dezelfde kolommen; het
JSON-contract voor de vijf custom frontends is byte-identiek. `capacity_mode` en
`merged_into_event_id` bewust ongemoeid (geen dode affordance toegevoegd).

### Verificatie
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0.
- `node scripts/i18n-parity.mjs` → volledige pariteit, 2469 keys × 5 talen.
- `pg_publication_tables` → `ticket_scans` in `supabase_realtime` (`ticket_instances` en
  `event_details` bewust niet toegevoegd).

### Vervolg
- **Openstaand:** er bestaat momenteel géén TEST-event; de enige `event_details`-rijen horen bij
  de live tenant The Fonske Crawl. De gevraagde functionele DB-natrek (capacity → echte NULL,
  capaciteit-confirm, cancelled-confirm + verdwijnen uit `storefront-api`, live teller bij een
  test-scan) is daarom **NIET uitgevoerd** — die vraagt een wegwerp-event op een test-tenant.
- Fase 4 is hiermee inhoudelijk afgerond; changelog- en newsletter-bundel staan klaar om te
  versturen na bevestiging.

## EVENT-SYSTEEM FASE 4c — deur-toegangen-UI (scanner-tokens) — 19 augustus 2026

### Root cause / aanleiding
De fase-2b token-auth valideert live tegen `event_scanner_access`, maar er was geen UI om
toegangen aan te maken of in te trekken: elke vrijwilliger-token vroeg een handmatige
DB-insert. Tokens zijn beveiligingsgevoelig, dus de recon ging eerst na hoe het token
gegenereerd wordt en of intrekken direct doorwerkt.

### Uitgevoerd
- **`src/hooks/useEventScannerAccess.ts` (nieuw)** — data-laag:
  - `useScannerAccesses(eventId)` — lijst, altijd `.eq('tenant_id', currentTenant.id)`.
  - `useCreateScannerAccess` — insert met `tenant_id`, `event_detail_id`, `zone_id`, `name`,
    `direction`, `scan_mode`, `allowed_product_ids`, `expires_at`, `created_by`.
    `access_token` wordt **bewust weggelaten** zodat de kolom-default
    `encode(gen_random_bytes(32), 'hex')` het server-side genereert; de UI zet nooit een token.
    Daarna `.select(...)` om het token één keer terug te lezen voor de QR.
  - `useRevokeScannerAccess` — `update { is_active: false }`, nooit `delete`.
  - `useDeleteScannerAccess` — `delete` met extra `.eq('use_count', 0)` als tweede net naast
    de UI-guard.
  - `useEnsureDefaultZone(eventId)` — maakt bij ontbreken van zones een `event_zones`-rij
    ('Hoofdingang', `is_default: true`, `sort_order: 0`) en geeft de `zone_id` terug.
  - `.select()` na elke write (persistence-verificatie), invalidatie op
    `['event-scanner-accesses', tenantId, eventId]`.
- **`src/components/admin/events/ScannerAccessDialog.tsx` (nieuw)** — naam, zone-Select,
  richting (in/uit/beide), scan_mode (check_in/validate_only/check_out), tickettype-scope als
  checkboxes (niets aangevinkt = `allowed_product_ids` NULL = alle types) en optionele
  `expires_at`. Zonder zone wordt de default-zone automatisch aangemaakt bij opslaan.
- **`src/components/admin/events/ScannerQrDialog.tsx` (nieuw)** — QR via `react-qr-code` met de
  volle URL `${window.location.origin}/scan/${access_token}` (toekomstvast voor fase 5, die
  route bestaat nog niet), plus naam/zone/scope en een "Kopieer link"-knop.
- **`src/pages/admin/EventDetail.tsx`** — vijfde tabblad **Toegangen** (mobiele kaarten /
  desktoptabel): naam, zone, richting, scan_mode, tickettype-scope, gebruik
  ("X keer gebruikt, laatst om Y"), vervaldatum, status-badge (Actief/Ingetrokken/Verlopen).
  Acties: QR tonen, Intrekken (met AlertDialog), Verwijderen (alleen bij `use_count = 0`).
- **i18n** — nieuwe keys in `nl/en/fr/de/uk`.

### Security-keuzes
- **Token-generatie uitsluitend server-side** via de kolom-default; de client kan geen token
  kiezen of raden-en-zetten.
- **Intrekken = `is_active = false`**, geen delete: de audit trail (`ticket_scans` →
  `scanner_access_id`) blijft intact en de fase-2b lookup (`is_active = true`) weigert de
  token onmiddellijk.
- Geen nieuwe RLS-policies of grants nodig: `event_scanner_access` had al CRUD-policies voor
  `authenticated` binnen de eigen tenant-scope. Het token is daarmee leesbaar voor
  tenant_admin/staff van diezelfde tenant en voor niemand anders (geen `anon`-grant).
- Verwijderen dubbel afgedekt: UI verbergt de knop bij `use_count > 0` én de delete-query
  filtert op `use_count = 0`.

### Gedeelde-paden-waarschuwing
n.v.t. — `event_scanner_access` en `event_zones` worden niet door `storefront-api`,
`storefront-resolve` of `checkout-engine` gelezen; er is geen migratie, geen
edge-function-wijziging en geen contractwijziging. Puur admin-UI + één nieuwe hook, dus de
vijf custom-frontend tenants zijn onaangeraakt.

### Verificatie (TEST-event in SellQo Speeltuin, niet Fonske)
- Toegang aangemaakt zonder zone → `event_zones`-rij 'Main entrance' automatisch aangemaakt,
  toegang eraan gekoppeld.
- `access_token` server-side gegenereerd: 64 hex-tekens
  (`9eac735b…4c6546e2`, `length(access_token) = 64`), niet client-gezet.
- QR toont de volle URL `http://localhost:8080/scan/<token>`; "Kopieer link" aanwezig.
- Scope: tweede toegang met aangevinkt tickettype gaf
  `allowed_product_ids = {95470ba1-…}`; de eerste (niets aangevinkt) gaf NULL = alle types.
- Live token-check: `POST /functions/v1/scanner-context` met `x-scanner-token` gaf **HTTP 200**
  met zone/richting/scan_mode; ná intrekken via de UI (`is_active = f` in DB) gaf dezelfde
  token **HTTP 401 {"success":false,"error":"invalid scanner token"}**.
- Verwijderen: knop alleen zichtbaar bij `use_count = 0`; verwijderde rij verdween uit de DB.
- Testdata volledig opgeruimd (toegangen → zones → tickettype → event → product).
- `npx tsc --noEmit` 0 fouten, changelog-i18n-pariteit 107 keys in alle vijf de locales.

### Bewust ongemoeid / Vervolg
- De publieke `/scan/:token`-route bestaat nog niet — dat is fase 5. De QR is daar al op
  voorbereid.
- Zone-beheer (meerdere zones aanmaken/hernoemen) zit nog niet in de UI: alleen de
  automatische default-zone. Kandidaat voor een latere fase.
- Changelog `2026.10k` en het newsletter-item staan KLAARGEZET, nog niet verstuurd (bundelen
  met 4a/4b).

## EVENT-SYSTEEM FASE 4b — tickettype-beheer-UI (eerste schrijf-UI) — 19 augustus 2026

### Root cause / aanleiding
Na fase 4a was `event_ticket_types` alleen read-only zichtbaar op `EventDetail.tsx`. Tenants
konden tickettypes niet zelf aanmaken of bijstellen; dat vroeg elke keer een handmatige
DB-ingreep. Dit is de eerste schrijf-UI op de tabel waar de betaalflow (fase 3a) live tegen
valideert (`is_active` + `sub_capacity`), dus de guards staan in de UI, niet in de DB.

### Uitgevoerd
- **`src/hooks/useEventTicketTypes.ts` (nieuw)** — data-laag voor tickettypes:
  - `useTicketProducts()` — `products` van deze tenant met `product_type = 'ticket'`,
    altijd `.eq('tenant_id', currentTenant.id)`; levert naam + prijs voor de koppeling.
  - `useCreateTicketType` / `useUpdateTicketType` / `useToggleTicketTypeActive` /
    `useDeleteTicketType` — react-query `useMutation` + directe Supabase-client, met
    `queryClient.invalidateQueries` op de tickettypes-key en toasts via `useToast`.
  - Insert zet expliciet `tenant_id` + `event_detail_id` en laat `event_group_id`,
    `valid_from` en `valid_until` op `null`, zodat de XOR-scope-check niet geraakt wordt.
  - `isDuplicateProductError()` mapt Postgres-code `23505` (unique
    `(event_detail_id, product_id)`) op een leesbare melding.
  - `REENTRY_POLICIES` als bron van de vier toegestane waarden.
- **`src/components/admin/events/TicketTypeDialog.tsx` (nieuw)** — aanmaak/bewerk-dialog:
  - product-Select toont alleen ticketproducten die nog niet aan dit event gekoppeld zijn
    (het eigen product blijft zichtbaar bij bewerken) — de unique-constraint wordt dus in
    de UI voorkomen, met de 23505-melding als tweede net.
  - naam en prijs zijn read-only afgeleid van het product (één bron van waarheid).
  - datum+tijd-velden voor `sales_start` / `sales_end`; `sales_end < sales_start` blokkeert
    opslaan hard.
  - `sub_capacity` leeg = ongelimiteerd; lager dan het al verkochte aantal geeft een
    `confirm` met het aantal verkopen, maar blokkeert niet (bestaande tickets blijven geldig).
  - `sort_order`, `reentry_policy`, `is_active` bewerkbaar. Geen `zone_ids`, geen
    `event_group_id`, geen `valid_from/valid_until` in deze UI.
  - geen ticketproducten beschikbaar → lege staat met knop naar `/admin/products/new`
    (geen quick-create in de dialog, dat zou productvalidatie dupliceren).
- **`src/pages/admin/EventDetail.tsx`** — nieuw tabblad **Tickettypes** (tussen Overzicht en
  Deelnemers) met mobiele kaarten (`md:hidden`) en desktoptabel (`hidden md:block`):
  naam, prijs, sub-capaciteit, verkocht, vrij, verkoopvenster, status-badge, acties
  (Bewerken / Activeren-Deactiveren / Verwijderen). De read-only sectie in Overzicht is
  ingekort tot een compacte samenvatting, zodat er geen dubbele bron staat.
  - deactiveren van een tickettype met verkopen vraagt eerst bevestiging;
  - verwijderen is geblokkeerd zodra er verkopen zijn (melding: deactiveer in plaats daarvan),
    anders een `AlertDialog`-bevestiging.
- **i18n** — `events.tabs.ticketTypes` + de hele `events.ticketTypes.*`-boom (kolommen,
  formulier, guards, toasts, heringang-labels) in alle vijf talen (nl, en, fr, de, uk).

### Security-keuzes
- Geen RLS-, policy- of grant-wijziging. `event_ticket_types` had al tenant-scoped
  schrijfpolicies; de UI schrijft als de ingelogde gebruiker en zet `tenant_id` expliciet
  op `currentTenant.id`. Elke read en write is expliciet tenant-gefilterd.
- Geen edge-functie geraakt, geen service-role-pad, geen nieuwe secret.
- De capaciteits- en deactivatie-guards zijn **UI-guards**, geen securitygrens: de
  geld-kritische handhaving blijft server-side in fase 3a (`check_event_capacity` +
  `pg_advisory_xact_lock` bij uitgifte). De UI maakt de gevolgen alleen expliciet.

### Gedeelde-paden-waarschuwing
`event_ticket_types` wordt door de vijf custom frontends gelezen via `storefront-api`
(fase 3b, `ticket_types[]`). Deze batch wijzigt alleen rijen, niet het schema en niet de
serialisatie: geen kolom toegevoegd, hernoemd of gedropt, `storefront-api` en
`checkout-engine` zijn niet aangeraakt. Een tenant die een tickettype toevoegt of bijstelt
ziet dat puur additief terug in de bestaande `ticket_types[]`-array. Geen contract-wijziging.

### Verificatie
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0, 0 fouten.
- `node scripts/i18n-parity.mjs` → volledige pariteit, 2383 keys in alle vijf talen.
- End-to-end in de browser (Playwright, tenant **SellQo Speeltuin**, tijdelijk testevent +
  twee tijdelijke ticketproducten, na de test volledig opgeruimd):
  - aanmaken met `sub_capacity = 10` → rij zichtbaar, DB-rij correct: `event_detail_id`
    gevuld, `event_group_id` / `valid_from` / `valid_until` `null`, `reentry_policy = 'none'`;
  - tweede tickettype met verkoopvenster en `sort_order = 1` → correct gesorteerd getoond;
  - het al gekoppelde product verdween uit de product-Select (duplicaat onmogelijk);
  - bewerken (capaciteit 10 → 12) en deactiveren → status-badge werd "Inactief";
  - verwijderen van een tickettype zonder verkopen → rij verdwenen.
- Geen backendwijziging, geen migratie op schema-niveau, alleen admin-UI + één
  `doc_articles`-insert.

### Bewust ongemoeid / Vervolg
- `zone_ids` (toegangszones) blijft buiten deze UI — hoort bij de zones/toegangen-fase.
- `event_group_id` en `valid_from/valid_until` (abonnement-achtige geldigheid) blijven
  buiten de UI; de XOR-scope wordt niet aangeraakt.
- Prijs en naam blijven productvelden; er komt geen prijsoverride per tickettype.
- Geen quick-create van ticketproducten vanuit de dialog; de dialog linkt naar het
  productformulier.

## EVENT-SYSTEEM FASE 4a — read-only event-detailpagina (admin-UI) — 19 augustus 2026

### Root cause / aanleiding
`EventDashboard.tsx` had een in-page `selected`-detailview zonder eigen URL en zonder tabs:
niet deelbaar, niet deep-linkbaar, en de check-in-status kwam uit `ticket_instances.status`
in plaats van uit de scan-log (`ticket_scans`) die sinds fase 2 de bron van waarheid is.

### Uitgevoerd
- **`src/pages/admin/EventDetail.tsx` (nieuw)** — route `/admin/events/:eventId`, read-only,
  drie tabs (Overzicht / Deelnemers / Scan-log). Data via react-query + directe Supabase-client,
  altijd met `.eq('tenant_id', currentTenant.id)`:
  - `event_details` + `products(name)` op `id`;
  - `ticket_instances` + `orders(order_number, customer_email)` op `event_detail_id`;
  - `event_ticket_types` + `products(name, price)`, geordend op `sort_order`;
  - `ticket_scans` op `event_detail_id`, nieuwste eerst; per `ticket_instance_id` bepaalt de
    laatste scan de status (Binnen / Buiten / Niet gescand).
  - bezetting client-side geaggregeerd (`valid` + `checked_in`), `refetchInterval: 30000`.
- **`src/pages/admin/EventDashboard.tsx`** — `selected`-state en de in-page detail-JSX verwijderd;
  klik op een eventkaart doet `navigate('/admin/events/<id>')`. Kaartengrid-overzicht ongewijzigd.
- **`src/App.tsx`** — route toegevoegd met `RouteGuard requireRole={['tenant_admin','staff']}`,
  identiek patroon aan `events` en `customers/:customerId`. Geen nieuw sidebar-item.
- **i18n** — nieuwe `events.*`-sleutels (tabs, kolomkoppen, statuslabels, tickettypes, scan-log)
  in alle vijf de talen (nl/en/fr/de/uk).

### Security-keuzes
Geen nieuwe policies of grants. Alle reads gaan via bestaande RLS
(`ticket_instances`, `ticket_scans`, `event_ticket_types`, `event_details` zijn tenant-scoped
voor `tenant_admin`/`staff`) en zijn daarnaast expliciet op `tenant_id` gefilterd in de query.
Pagina is volledig read-only: geen mutaties, geen edge-functie-calls.

### Gedeelde-paden-waarschuwing
n.v.t. — `storefront-api`, `checkout-engine` en `storefront-resolve` zijn niet aangeraakt, geen
migratie, geen schemawijziging. De vijf custom frontends kunnen hier per definitie niets van merken.

### Verificatie
- Playwright tegen de draaiende app als platform-admin met tenant "The Fonske Crawl":
  `/admin/events/70a2b02e-3514-49cc-bd97-9dfe9ec92939` rendert alle drie de tabs.
  Overzicht: capaciteit 44, verkocht 1, nu binnen 1, vrij 43, bezetting 1/44 (2%), minimum 15,
  één tickettype (Pubcrawl ticket, € 25,00, verkocht 1, badge "On sale").
  Deelnemers: Aaron Mercken / aaron.mercken@hotmail.com / Pubcrawl ticket / #0001 /
  status "Inside · 05:08" — afgeleid uit de scan-log, niet uit `ticket_instances.status`.
  Scan-log: één regel — Aaron Mercken, richting In, 19-08 05:08, Admitted, zone Ingang, Host/crew.
- Onbekend/foreign event-id toont "Event not found" (tenant-filter werkt).
- `EventDashboard` navigeert naar de detailpagina, geen dubbele detailview meer.
- Typecheck 0 fouten, i18n-parity gelijk over vijf talen, build groen.
- De React `Function components cannot be given refs`-waarschuwing in de console is
  app-breed en bestaand (stack start bij `App`/providers), geen regressie van deze batch.

### Bewust ongemoeid / Vervolg
- Scanner-namen: `scanner_access_id` wordt als "Host/crew" getoond wanneer er geen token-naam is;
  een join op `event_scanner_access` voor de tokennaam is bewust nog niet gebouwd.
- Geen bewerkingsacties (datum wijzigen, status, deelnemer handmatig inchecken) — fase 4b.
- Het uit de opdracht genoemde event-id `17efe0cc-…` heeft geen tickets/scans; verificatie is
  daarom op het zusterevent `70a2b02e-…` van dezelfde tenant gedaan.

## EVENT-SYSTEEM FASE 3b — presentatie ticket_types[] (storefront-api, additief) — 19 augustus 2026

### Root cause / aanleiding
Na fase 3a kon de server meerdere tickettypes per event handhaven, maar de publieke
`get_product`-respons toonde er niets van: `event.upcoming[]` bevatte één prijs
(`current_price`) en geen enkele verwijzing naar `event_ticket_types`. Frontends konden dus
geen keuze tussen tickettypes aanbieden.

### Uitgevoerd
- **Migratie**: `public.get_event_ticket_counts(uuid[])` — `SECURITY DEFINER`, `STABLE`,
  `search_path = public`, telt `ticket_instances` met `status IN ('valid','checked_in')`
  gegroepeerd per `(event_detail_id, product_id)`. Zelfde teldefinitie als
  `get_event_signup_count` / `get_event_ticket_type_count`.
- **`supabase/functions/storefront-api/index.ts`** (`getProduct`, event-blok):
  - één batch-select op `event_ticket_types` voor álle open events (`.in('event_detail_id', ids)`,
    `tenant_id`-filter, `is_active = true`, join `products!event_ticket_types_product_id_fkey`,
    geordend op `sort_order`) + één `get_event_ticket_counts(ids)`-RPC, parallel.
  - per event additief `ticket_types[]` (id, product_id, name, price, sub_capacity, sold,
    spots_left, sales_start, sales_end, is_on_sale, sort_order) en top-level `product_id`.
  - prijs per tickettype via de **ongewijzigde** `resolveEventPrice` met de **event-brede** sold
    (presentatie = betaalkant). `resolveEventPrice` zelf is niet aangeraakt.
- `getProducts` (lijst) ongemoeid.

### Security-keuzes
`get_event_ticket_counts` is `SECURITY DEFINER` omdat `ticket_instances` niet publiek leesbaar is.
`EXECUTE` expliciet gerevoked van PUBLIC/anon/authenticated en alleen gegrant aan `service_role`;
de storefront-api draait met service-role en filtert zelf op `tenant_id`. Geen nieuwe tabellen,
policies of grants. Geen persoonsgegevens in de respons (alleen aantallen en productnaam/prijs).

### Gedeelde-paden-waarschuwing
`storefront-api` bedient 5 custom frontends. De 18 bestaande sleutels van elk
`event.upcoming[]`-object zijn byte-identiek gebleven (expliciete mapping, geen spread, geen
herordening); `product_id` en `ticket_types` zijn er ná toegevoegd. `tickets_sold`, `spots_left`,
`min_reached`, `current_price`, `early_bird_*` worden nog steeds uit dezelfde
`get_event_signup_count`-RPC en dezelfde `resolveEventPrice`-aanroep berekend.

### Verificatie
- Fonske (`get_product`, slug `early-bird-ticket`, event `17efe0cc…`) vóór/na: sleutels 1-18
  identiek — `current_price 25`, `spots_left 40`, `tickets_sold 0`, `min_reached false`,
  `early_bird_active false`, `early_bird_price null`, `spots_left_at_early_bird null`,
  `early_bird_deadline null`. Nieuw: `product_id 1daee896…` en `ticket_types` = array van 1
  (Pubcrawl ticket, price 25, sub_capacity null, sold 0, spots_left null, is_on_sale true).
- Testevent met 2 tickettypes (extra TEST VIP-type, prijs 45, `sub_capacity 10`,
  `sales_start = now() + 30 dagen`): beide types correct, prijzen uit de eigen producten,
  `spots_left 10` voor het type met sub_capacity, `is_on_sale false` door het toekomstige
  verkoopvenster. Bestaande 18 sleutels bleven onveranderd. Testdata verwijderd en
  na-controle bevestigt `ticket_types` = 1 item.
- Query-budget: 1× `event_details`-select + 1× `event_ticket_types`-batchselect +
  1× `get_event_ticket_counts`-RPC, plus de bestaande per-event `get_event_signup_count`.
  Constant in het aantal tickettypes (geen N+1).
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0.

### Bewust ongemoeid / vervolg
Tickettype-namen komen nu uit `products.name` (basisnaam); vertaling via
`content_translations` is bewust uitgesteld. Early-bird blijft event-breed, niet per type.
Geen changelog-, docs- of UI-werk in deze batch (conform opdracht).

## EVENT-SYSTEEM FASE 3a — capaciteitshandhaving (server, geld-kritisch) — 19 augustus 2026

### Root cause / aanleiding
Er was **nergens** capaciteitshandhaving voor events. `cartAddItem` (storefront-api r.1567-1586)
controleerde alleen of de datum bij het product hoorde en of de status `scheduled/confirmed` was —
`event_details.capacity` werd niet gelezen. `checkoutComplete` had geen event-check. En
`issue_tickets_for_order` gaf tickets blind uit én vulde `ticket_instances.product_id` niet,
waardoor `get_event_ticket_type_count` structureel 0 teruggaf en sub-caps nooit konden tellen.
Gevolg: events konden overboeken, ook ná betaling.

### Uitgevoerd
- **`public.check_event_capacity(p_event_detail_id, p_product_id, p_quantity)`** — nieuw, single
  source of truth. Retourneert `{ok, reason?, event_spots_left, type_spots_left}`. Event-cap via
  `get_event_signup_count` (`capacity IS NULL` = ongelimiteerd); sub-cap alleen wanneer de
  `event_ticket_types`-rij voor (event, product) een `sub_capacity` heeft. `p_product_id = null`
  checkt uitsluitend de event-cap. EXECUTE alleen voor `service_role`.
- **`public.issue_tickets_for_order(uuid)`** — herschreven:
  - `pg_advisory_xact_lock(hashtext(event_detail_id))` per event ⇒ gelijktijdige issuance voor
    dezelfde laatste plek serialiseert binnen de transactie; de verliezer ziet de winnaar zijn
    tickets al staan.
  - `ticket_instances.product_id` wordt gevuld uit `order_items.product_id` (fundament sub-cap).
  - Bij geen plek: **geen** tickets voor dat order_item, wél een regel in `admin_actions_log`
    met `action_type='ticket_issuance_overbooking_prevented'` en `action_details`
    `{order_id, order_item_id, event_detail_id, product_id, quantity, reason, paid_amount}`.
    Bewust **geen** automatische refund (backlog). De rest van de order gaat normaal door.
- **`storefront-api` → `checkoutComplete`** (r.2545-2586) — poort vóór betaling, direct na de
  `CART_EMPTY`-check: sub-cap per (event, product) én event-cap over alle tickettypes samen.
  Vol ⇒ `{code:'EVENT_FULL'|'TICKET_TYPE_FULL', message, event_detail_id}` vóór er geld beweegt.
- **`storefront-api` → `cartAddItem`** (r.1568-1643) — vriendelijke weigering + validatie:
  `event_ticket_types`-rij vereist (`TICKET_TYPE_UNAVAILABLE` bij ontbreken of `is_active=false`),
  verkoopvenster `sales_start/sales_end` (`TICKET_TYPE_NOT_ON_SALE`), en cap-check die de
  bestaande cart-regels voor dat event meesommeert (`TICKET_TYPE_FULL` / `EVENT_FULL` + `spots_left`).
  Additief: een product dat via een actieve `event_ticket_types`-rij aan het event hangt is nu ook
  geldig, niet alleen het host-product. `resolveEventPrice` ongewijzigd — prijs blijft uit het product.

### Security-keuzes
`check_event_capacity` is `SECURITY DEFINER` met EXECUTE uitsluitend voor `service_role`; anon/
authenticated kunnen hem niet aanroepen. Geen RLS-policy gewijzigd. Voor de race-test is
`issue_tickets_for_order` kortstondig aan `anon` gegrant en in dezelfde sessie weer ge-revoked;
de linter staat terug op de baseline van 155 bevindingen (156 tijdens het venster).

### Gedeelde-paden-waarschuwing
`storefront-api` is een gedeeld pad (5 custom frontends). Strikt additief: geen sleutel in
`content`/`settings` of in de cart-respons hernoemd of verwijderd; alleen nieuwe foutcodes op
paden die voorheen géén fout gaven. Events zonder `sub_capacity` en zonder verkoopvenster — dat
is elk bestaand event, want de fase-1 migratie gaf ze allemaal een `event_ticket_types`-rij —
gedragen zich exact als voorheen zolang de event-cap niet bereikt is. Nieuw is dat een event
bij een bereikte `capacity` nu weigert; dat is het doel van deze fase.

### Verificatie (letterlijk gedraaid, testevent capacity=2, type A sub_capacity=1)
- `cart_add_item` 1× type A → `success:true`.
- 2× type A → `{"code":"TICKET_TYPE_FULL","spots_left":1}`.
- 1× type B → `success:true` (event-cap 2 nog niet vol).
- 2× type B → `{"code":"EVENT_FULL","spots_left":2}`.
- Issuance: order met 1× type A ⇒ ticket met `product_id` gevuld, `seq=1`; event-count 1,
  type-count 1 (vóór de fix bleef type-count 0).
- **Race:** twee orders, elk 1× type B, om de laatste plek; twee parallelle `curl`-calls naar
  `rpc/issue_tickets_for_order`, beide HTTP 204. Resultaat: `total_tickets=2` (de cap),
  `b_tickets=1` ⇒ precies één won; de verliezer staat in `admin_actions_log` met
  `reason='event_full'`. Bij capacity=5 en een tweede type-A-order: `reason='ticket_type_full'`.
  Opmerking: elke logregel verscheen tweemaal doordat `trg_issue_tickets_on_paid` bij de insert
  al vuurde náást mijn expliciete RPC-call — geen dubbele tickets, alleen een dubbele logregel.
- **Checkout-poort:** cart met 2 tickets terwijl het event vol was ⇒
  `{"code":"EVENT_FULL","event_detail_id":"…"}`, vóór enige betaalintent.
- **Compat:** bestaand event (fase-1 auto-rij, geen sub_cap, geen venster, capacity=40) ⇒
  `cart_add_item` quantity 2 `success:true`, `unit_price` 25 ongewijzigd.
- `npx tsgo` 0 fouten. Alle testdata verwijderd (tickets, orders, order_items, carts, logregels,
  event, tickettype-producten).

### Bewust ongemoeid / Vervolg
Geen presentatie-wijziging: `getProduct` geeft nog géén `ticket_types[]` terug (fase 3b). Geen
automatische refund bij een verloren race — Akke refundt handmatig op basis van de logregel
(backlog). `get_event_signup_count` en `resolveEventPrice` ongewijzigd. Geen UI, changelog of docs.

---

## EVENT-SYSTEEM FASE 2b — scanner-token-auth (server-pad) — 19 augustus 2026

### Root cause / aanleiding
Check-in vereiste tot nu toe een SellQo-account: `ticket-checkin` riep op r.35
`authenticateRequest(req)` aan vóór het lezen van de body, dus een vrijwilliger zonder account
kon niet scannen. Fase 1 leverde `event_scanner_access` (met `access_token`) al op, maar geen
enkel pad gebruikte hem: `p_scanner_access_id` werd hard op `null` doorgegeven.

### Uitgevoerd
- **`supabase/functions/ticket-checkin/index.ts`** — token-aftakking **vóór** `authenticateRequest`:
  de body wordt nu eerst gelezen, daarna wordt de modus bepaald. Token uit header
  `x-scanner-token` (voorkeur) of `body.scanner_token` (fallback); nooit uit de URL.
  Zonder token: exact de bestaande JWT-flow, `authenticateRequest` ongewijzigd aangeroepen.
  `_shared/auth.ts` is **niet** aangeraakt; de function gebruikt een lokale `CheckinAuth`-interface
  die dezelfde velden beschrijft.
- **Token-validatie**: regex `/^[a-f0-9]{64}$/`, lookup met service-role op
  `event_scanner_access WHERE access_token=… AND is_active=true`, plus een expliciete
  `expires_at`-check. Onbekend, inactief én verlopen geven **dezelfde** generieke 401
  `{success:false, error:"invalid scanner token"}` — geen orakel.
  `last_used_at`/`use_count` worden best-effort bijgewerkt (fout wordt gelogd, blokkeert nooit).
- **Token-'auth'-object**: `{ user_id: null, tenant_ids:[row.tenant_id], is_platform_admin:false,
  roles_by_tenant:{ [tenant]: ['staff'] } }` → `isCrew=true`, `isHost=false`, dus **undo is
  structureel 403** zonder extra code. `actorId` wordt `null` (kolom `scanned_by_user_id` is
  nullable en heeft geen FK), `p_scanner_access_id` wordt de token-rij-id.
- **Anti-tampering**: in token-modus komen `event_detail_id` en `zone_id` **uitsluitend** uit de
  DB-rij; `body.event_detail_id` wordt genegeerd. De verplichting van `event_detail_id` in de body
  geldt alleen nog in JWT-modus.
- **Gat 1 — `allowed_product_ids`** afgedwongen in de edge function, vóór `perform_scan`, en
  bewust **niet** in `can_scan`: dat zou de signatuur van de engine wijzigen en dus het JWT-pad
  raken. Ligt de `product_id` van het ticket niet in de array (NULL/leeg = alles toegestaan), dan
  wordt een `ticket_scans`-rij `result='not_allowed_zone'`, `note='ticket_type_not_allowed'`
  gelogd en volgt `{result:'not_allowed_zone', reason:'ticket_type_not_allowed'}`. JWT-modus:
  geen filter, exact als voorheen.
- **Gat 2 — `direction`** uit de token-rij: `'out'` → out-scan, `'both'` → default `'in'`
  (tenzij `scan_mode='check_out'`), `scan_mode='check_out'` → `'out'`. JWT-modus blijft hard
  `'in'`. **Bevestigd**: `perform_scan` doet de dual-write alleen bij `result='ok' AND
  p_direction='in'`, dus een out-scan raakt `ticket_instances.status` níet — enkel het scan-log.
  Occupancy klopt (via `ticket_is_inside`/`zone_occupancy`), de "verkocht/checked_in"-tellingen
  van de bestaande lezers blijven intact.
- **Gat 3 — `scan_mode='validate_only'`**: roept alleen `can_scan` aan (STABLE, read-only), doet
  **geen** status-write, en logt wél een `ticket_scans`-rij met het besluit en
  `note='validate_only[:reason]'` — auditwaarde zonder de bezetting te beïnvloeden (de rij heeft
  `result='ok'` maar er is geen status-write; occupancy leest `ticket_is_inside`, die op de
  laatste `in`-scan afgaat — daarom is `validate_only` bedoeld voor deur-controle zonder
  check-in en mag zo'n token nooit op een `in`-poort staan; fase 4 beperkt dit in de UI).
  Response krijgt `validate_only: true` naast de bestaande velden.
- **Nieuw `supabase/functions/scanner-context/index.ts`** — zelfde tokenvalidatie en zelfde
  generieke 401. Geeft terug: `scanner{id,name}`, `event{id,date,start_time,end_time,
  location_name,status}`, `zone{id,name}`, `direction`, `scan_mode`, `allowed_product_names`,
  `tenant_branding{name,logo_url}`. **Geen** attendee-data, **geen** tellers, **geen** financiële
  of orderdata.
- **`supabase/config.toml`**: `[functions.ticket-checkin] verify_jwt=false` en
  `[functions.scanner-context] verify_jwt=false` expliciet toegevoegd. Dit verandert bestaand
  gedrag niet: `ticket-checkin` had geen blok en liep al op de default `false`, en de auth gebeurt
  in-code — de PWA stuurt haar JWT mee en die wordt onverminderd via `authenticateRequest`
  gevalideerd.
- `x-scanner-token` toegevoegd aan `Access-Control-Allow-Headers` van beide functies.
- **Bewust niet gebouwd**: vrijwilliger-UI (fase 5) en toegangen-beheer-UI (fase 4). Geen
  changelog, geen doc_articles, geen frontend-wijziging.

### Security-keuzes
- Undo blijft host-only: token-scanners zijn `staff`, dus `isHost=false` → 403. Bovendien vereist
  `admin_actions_log.admin_user_id` een echte user-id.
- Een tokenscanner heeft geen JWT en dus DB-rol `anon`; `event_scanner_access`, `ticket_scans` en
  `ticket_instances` hebben geen anon-grant en geen anon-policy → geen attendee-lijst, geen
  tellers, geen financiële data. Alle DB-werk loopt via de service-role client ín de function.
- `can_scan`/`perform_scan` blijven `REVOKE ALL … FROM PUBLIC, anon` met `EXECUTE` enkel voor
  `service_role` — een token kan de engine nooit direct aanroepen.
- Scope-afscherming bevestigd: `can_scan` eist `event.tenant_id = ticket.tenant_id` én
  `ticket.event_detail_id = p_event_detail_id`; omdat `p_event_detail_id`/`p_zone_id` in
  token-modus uit de DB-rij komen, kan een token niet buiten zijn event/zone of tenant scannen.
- Geen nieuwe tabellen, geen RLS- of grant-wijzigingen in deze batch.

### Gedeelde-paden-waarschuwing
`storefront-api`, `storefront-resolve`, `checkout-engine` en de gedeelde theme-tabellen zijn niet
geraakt. `_shared/auth.ts` ongemoeid, dus geen effect op de ~40 andere functies die hem importeren.

### Verificatie (letterlijk, testdata nadien opgeruimd)
Testopstelling: event `17efe0cc` (status `scheduled`, zone `Ingang` = default), testticket
`seq 9001` (`status='valid'`), vier scanner-toegangen `FASE2B ok/expired/inactive/otherproduct`.

Token-modus (`x-scanner-token`):
- T1 geldig token, in-scan → `HTTP 200 {"success":true,"result":"ok","attendee":"Fase2b Tester","seq":9001,"checked_in_at":"2026-08-19T11:08:13.327Z"}`
- T2 tweede scan → `HTTP 200 {"result":"already","checked_in_at":"2026-08-19T11:08:13.327Z"}`
- T3 undo via token → `HTTP 403 {"success":false,"error":"Only a host can undo a check-in"}`
- T4 body-tampering (`body.event_detail_id` = ánder event) → `HTTP 200 {"result":"already"}` —
  token wint, body genegeerd (was de body gevolgd, dan zou `wrong_event` zijn teruggekomen)
- T5 verlopen token → `HTTP 401 {"success":false,"error":"invalid scanner token"}`
- T6 inactief token → `HTTP 401 {"success":false,"error":"invalid scanner token"}`
- T7 onbekend token → `HTTP 401 {"success":false,"error":"invalid scanner token"}` (drie keer
  identiek — geen orakel)
- T8 token met `allowed_product_ids` op een ánder product → `HTTP 200
  {"result":"not_allowed_zone","reason":"ticket_type_not_allowed"}`
- T13 `direction='out'`/`scan_mode='check_out'` → `HTTP 200 {"result":"ok","checked_in_at":null}`;
  `ticket_instances.status` bleef `checked_in` (**geen** dual-write op out — bevestigd)
- T14 `scan_mode='validate_only'` → `HTTP 200 {"result":"ok","validate_only":true}`; geen
  status-write, scanregel met `note='validate_only'`

`ticket_scans` na de tokentests (6 rijen, alle met `scanner_access_id` gevuld en
`scanned_by_user_id = NULL`): `in/ok`, `in/already_inside`, `in/already_inside`,
`in/not_allowed_zone (note=ticket_type_not_allowed)`, `out/ok`, `in/ok (note=validate_only)`.

`scanner-context`:
- T9 geldig token → `HTTP 200` met `scanner{FASE2B ok}`, `event{17efe0cc, 2026-09-18, 21:00,
  Ladeuzeplein, scheduled}`, `zone{Ingang}`, `direction:"in"`, `scan_mode:"check_in"`,
  `allowed_product_names:null`, `tenant_branding{The Fonske Crawl, logo_url}` — géén attendee,
  géén tellers.
- T10 ongeldig token → `HTTP 401 {"success":false,"error":"invalid scanner token"}`

JWT-modus ONVERANDERD (echte sessie-JWT, geen `x-scanner-token`):
- J1 check-in → `{"result":"already","checked_in_at":"…11:08:13.327Z"}`
- J2 undo → `{"result":"undone","attendee":"Fase2b Tester","seq":9001}`
- J3 check-in na undo → `{"result":"ok","checked_in_at":"…11:09:16.861Z"}`
- J4 ander event → `{"result":"wrong_event","expected_event":{"date":"2026-09-18",
  "start_time":"21:00:00","name":"Ladeuzeplein"}}`
- J5 zonder `event_detail_id` → `HTTP 400 {"error":"event_detail_id required"}`
- T11 zonder JWT en zonder token → `HTTP 401 {"error":"Missing or invalid Authorization header"}`

Opruiming: testticket, vier scanner-toegangen, alle bijhorende `ticket_scans`-rijen en de
`admin_actions_log`-undo-regel verwijderd. `npx tsgo --noEmit -p tsconfig.app.json` → **exit 0**.

### Bewust ongemoeid / Vervolg
- Geen vrijwilliger-UI en geen beheer-UI voor toegangen (fase 4/5). Er is dus nog geen manier om
  in de app een token aan te maken of in te trekken — dat gebeurt vandaag alleen via de DB.
- Geen rate-limiting of use-cap op tokens: een gelekte link blijft tot `expires_at` geldig binnen
  zijn event/zone. `use_count`/`last_used_at` zijn de telemetrie waarop fase 4 een intrek-knop kan
  bouwen.
- `validate_only` logt een `in`-scan met `result='ok'`; wil je die modus écht bezettings-neutraal,
  dan is een aparte result-code nodig (additieve constraint-uitbreiding, latere fase).
- De PWA kent de nieuwe codes (`not_allowed_zone`, `event_not_active`, …) nog niet als eigen
  UI-status; dat blijft fase 4/5.

---

## EVENT-SYSTEEM FASE 2a — check-in engine (scan-log, dual-write) — 19 augustus 2026

### Root cause / aanleiding
Na fase 1 bestond het scan-log (`ticket_scans`) wel, maar de check-in schreef nog rechtstreeks
`ticket_instances.status='checked_in'` (edge function `ticket-checkin`, oude r.173-215). Zones,
her-betreding en zone-capaciteit waren daardoor niet handhaafbaar. Fase 2a maakt het scan-log de
bron van waarheid en schrijft status + `checked_in_at` **synchroon** mee (dual-write), zodat de
vijf bestaande lezers niets merken.

### Uitgevoerd
- **Nieuw `public.can_scan(ticket, event, zone, direction, scanner_access)`** — STABLE,
  SECURITY DEFINER, `search_path=public`, **read-only beslissing** in vaste volgorde:
  ticket bestaat + tenant-match (`invalid/unknown_token`) → event actief (`event_not_active`,
  **alleen bij `direction='in'`**, zodat opschonen op een cancelled event mogelijk blijft) →
  event-match (`wrong_event`) → ticketstatus cancelled/refunded/transferred
  (`invalid/ticket_<status>`) → zone-toegang via `event_ticket_types.zone_ids`
  (`not_allowed_zone`) → her-betreding op `reentry_policy`
  (`none`→`already_inside`, `once_per_day`/`once_per_event`→`reentry_blocked`, `unlimited`→vrij)
  → zone-capaciteit (`zone_full`) → `ok`.
- **Nieuw `public.perform_scan(...)`** — SECURITY DEFINER, atomair: roept `can_scan` aan, schrijft
  **altijd** een `ticket_scans`-rij (ook negatieve resultaten — auditwaarde; `reason` gaat naar
  `note`), en enkel bij `ok` + `in` de dual-write
  `UPDATE ticket_instances SET status='checked_in', checked_in_at=now(), checked_in_by=...
  WHERE id=… AND status='valid'`. 0 rijen = race verloren → resultaat wordt `already_inside` met
  het bestaande `checked_in_at`. Retourneert `{result, reason?, attendee, seq, checked_in_at?}`.
- **`ticket_scans_result_check` verruimd** met `event_not_active` (additief, bestaande waarden
  ongemoeid).
- **`ticket_is_inside` en `zone_occupancy`** tellen nu ook `result='undo'` mee, zodat een undo
  (`direction='out'`) de bezetting correct vrijgeeft. Bestaande rijen ongewijzigd.
- **`supabase/functions/ticket-checkin/index.ts`**: de check-in-tak roept `perform_scan` aan met
  de default-zone (`event_zones.is_default`) i.p.v. de directe UPDATE. Result-mapping:
  `already_inside → already` (COMPAT, met `checked_in_at`), overige codes 1-op-1 doorgegeven;
  nieuwe codes (`event_not_active`, `not_allowed_zone`, `reentry_blocked`, `zone_full`) gaan
  ongewijzigd naar de PWA (mooi maken = fase 4/5). De undo-tak behoudt de bestaande
  host-only `admin_actions_log`-insert én de status-reset, en schrijft **daarnaast** een
  `ticket_scans`-rij `result='undo'`, `direction='out'` (dubbele trail).
- Alle bestaande response-velden en result-codes (`ok`, `already`, `invalid`, `wrong_event`,
  `undone`, `not_checked_in`, `expected_event`) blijven exact behouden.

### Security-keuzes
- `can_scan`/`perform_scan`: `REVOKE ALL … FROM PUBLIC, anon`; `EXECUTE` enkel voor
  `service_role` (de engine wordt uitsluitend vanuit de edge function met service-key gebruikt).
- Linter vóór en ná: **155 issues, identiek** — geen nieuwe bevindingen.
- De UPDATE-policy `ticket_instances_update_tenant` (authenticated) is bewust **niet** aangeraakt;
  kolom-specifieke beperking blijft aanbevolen voor een latere fase.

### Gedeelde-paden-waarschuwing
`storefront-api`, `checkout-engine` en de gedeelde theme-tabellen zijn niet geraakt. De issuance-
trigger (`issue_tickets_for_order`) en `get_event_signup_count` zijn ongewijzigd.

### Verificatie (letterlijk)
- Verse check-in (`perform_scan`, zone = default): `{result: ok, attendee: Aaron Mercken, seq: 1,
  checked_in_at: 2026-08-19T10:47:39.149Z}`; `ticket_instances.status='checked_in'` +
  `checked_in_at` gezet; `ticket_scans`-rij `in/ok` aanwezig (alle drie bevestigd).
- Tweede scan: `{result: already_inside, checked_in_at: 2026-08-19T10:46:24.616Z}` → mapt op
  `already` in de edge function; scanregel `in/already_inside` gelogd.
- Tellers na check-in ongewijzigd: `get_event_signup_count=1`,
  `get_event_ticket_type_count=1` (dual-write werkt).
- Undo (edge-pad nagebootst op DB): status `valid`, `checked_in_at` NULL, `ticket_scans`-rij
  `out/undo` → `ticket_is_inside=false`, `zone_occupancy=0`, `get_event_signup_count=1`.
  Na undo slaagt een nieuwe check-in weer: `{result: ok}`.
- Cancelled event: event op `cancelled`, geldig ticket → `{result: event_not_active, reason:
  cancelled}`; daarna teruggezet.
- Race: afgedekt door de conditionele `WHERE status='valid'`; sequentieel bewezen — exact één
  `ok`, de tweede `already_inside` (0 rijen bijgewerkt). Echt-parallelle uitvoering kon niet
  gedraaid worden (geen service-key in de sandbox) — semantiek is die van de oude code.
- `tsgo --noEmit -p tsconfig.app.json` → exit 0. `ticket-checkin` succesvol gedeployed.
- Testdata teruggezet naar de begintoestand (ticket `checked_in` met één `in/ok`-scan, event
  `cancelled`).

### Bewust ongemoeid / vervolg
Geen scanner-token (fase 2b), geen UI, geen changelog/docs. De vier tel-implementaties en de
PWA-code zijn niet gewijzigd.

---

## EVENT-SYSTEEM FASE 1 — scan-log-fundament (schema + migratie) — 19 augustus 2026

### Root cause / aanleiding
Het TICKET-1-fundament kent aanwezigheid alleen als één vlag op de ticketrij
(`ticket_instances.status='checked_in'` + `checked_in_at`/`checked_in_by`). Daarmee is geen
her-betreding, geen uit-scan, geen zone-bezetting en geen scan-historiek mogelijk. Recon
(19 aug) legde vier harde feiten vast: (a) `ticket_instances_status_check` beperkte status tot
`valid|checked_in|cancelled|refunded`, (b) er is een UPDATE-policy voor `authenticated` op
`ticket_instances`, (c) er bestaan vier onafhankelijke tel-implementaties
(`get_event_signup_count`, `TicketCheckin.tsx` r.120-133, `EventDashboard.tsx` r.131-146,
`useEventDetails.ts` r.113-127), (d) er stond precies één ticket op `checked_in`.

### Uitgevoerd (2 migraties, puur additief)
- **Nieuw**: `event_groups`, `event_zones` (XOR event/groep, partial unique max 1 `is_default`
  per event), `event_ticket_types` (XOR scope: event | groep | `valid_from`; unique
  `(event_detail_id, product_id)` partial), `event_scanner_access` (unieke `access_token` via
  `encode(extensions.gen_random_bytes(32),'hex')`), `ticket_scans` (het scan-logboek; 3 indexen
  conform spec).
- **`event_details`**: `+ event_group_id` (FK), `+ capacity_mode` DEFAULT `'sold'` CHECK
  `('sold','inside')`.
- **`ticket_instances`**: `+ product_id` (FK products), `+ seat_label`, `+ is_complimentary`
  DEFAULT false. `product_id` gebackfilled uit `order_items` (1/1 rij gevuld, 0 null).
- **CHECK verruimd**: `status IN ('valid','checked_in','cancelled','refunded','transferred')`.
  `'checked_in'` is **bewust behouden** — alle vier de lezers en `ticket-checkin` blijven er
  ongewijzigd op draaien. Omschakeling naar het scan-log als bron van waarheid = fase 2.
- **Data-migratie (idempotent)**: 2/2 events kregen default-zone 'Ingang'; 2/2 events met
  product kregen een `event_ticket_types`-rij; het ene `checked_in`-ticket kreeg 1 `ticket_scans`
  -rij (`in`/`ok`, `scanned_at = checked_in_at`, `scanned_by_user_id = checked_in_by`,
  zone = default-zone). Herhaald draaien in transactie: 0/0/0 nieuwe rijen.
- **Helpers** (SQL, STABLE, SECURITY DEFINER, `search_path=public`): `ticket_last_scan`,
  `ticket_is_inside`, `zone_occupancy`, `event_occupancy`, `ticket_checkin_status`,
  `get_event_ticket_type_count`. `get_event_signup_count` is **ongewijzigd**; geen compat-view
  in fase 1.

### Security-keuzes
- Alle vijf nieuwe tabellen: `tenant_id NOT NULL`, RLS aan, vier policies
  (SELECT/INSERT/UPDATE/DELETE) `TO authenticated` met exact hetzelfde predicaat als
  `event_details`: `tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND
  has_tenant_role(tenant_id, ARRAY['tenant_admin','staff'])`. Geen anon-policy.
- De project-brede default privileges gaven `anon` automatisch alle tabelrechten op nieuwe
  tabellen; in een tweede migratie `REVOKE ALL ... FROM anon` op alle vijf (RLS blokkeerde anon
  al, maar het recht hoort er niet te staan). Verificatie: 0 anon-grants.
- Nieuwe helpers: `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated,
  service_role`. Zichtbaar in `proacl`: enkel postgres/authenticated/service_role.
- `ticket_scans` schrijven kan door service_role (engine, bypass RLS) én door
  tenant_admin/staff via de INSERT-policy.
- **Gerapporteerd, niet gewijzigd**: `ticket_instances_update_tenant` staat `authenticated`
  (tenant_admin/staff) een directe UPDATE toe op *alle* kolommen, inclusief `status`,
  `checked_in_at`, `checked_in_by`, en nu ook `product_id`, `seat_label`, `is_complimentary`.
  Vandaag doet geen enkele frontend dat (alle mutaties lopen via de `ticket-checkin` edge
  function met service_role), dus dichtknijpen is in fase 2 veilig: een kolom-specifieke
  variant (column-level `GRANT UPDATE (seat_label, attendee_name, attendee_email,
  is_complimentary)` + policy) breekt geen bestaande lezer. Voorwaarde: doe het additief
  (nieuwe grant/policy erbij, meten, dan de brede weg) — zie DB-safety M1.

### Gedeelde-paden-waarschuwing
`ticket_instances`, `event_details` en `get_event_signup_count` zitten in het pad van
`storefront-api` (r.597-630 event-blok, r.1581 early-bird) en dus van alle vijf frontends.
Alleen kolommen/constraints toegevoegd en één CHECK verruimd — geen kolom hernoemd, gedropt of
van type/default gewijzigd, geen functie-signatuur aangepast. `select('*')`-consumenten krijgen
drie extra, niet-gevoelige velden. Het `use_custom_frontend`-pad is niet geraakt.

### Verificatie
- Kolommen, CHECKs, indexen en 20 RLS-policies (4 per nieuwe tabel) letterlijk uitgelezen uit
  `information_schema` / `pg_constraint` / `pg_policies` / `pg_indexes`.
- `event_details`=2, default-zones=2 (2 distinct events), events met product=2,
  `event_ticket_types`=2, `ticket_scans`=1 met `stamp_match=t`.
- `get_event_signup_count('17efe0cc…')` = 0 (identiek aan baseline vóór de migratie);
  `get_event_signup_count('70a2b02e…')` = 1.
- `zone_occupancy(default-zone)` = 1, `ticket_is_inside(ticket)` = true,
  `ticket_checkin_status(ticket)` = `inside`, `event_occupancy(event)` = 1,
  `(ticket_last_scan(ticket)).result` = `ok`.
- Status-CHECK: INSERT met `'transferred'` slaagt (rollback), met `'bogus'` faalt op
  `ticket_instances_status_check`.
- XOR: `event_ticket_types` met event_detail_id **én** event_group_id faalt; met alleen
  `valid_from` slaagt. `event_zones` zonder beide faalt.
- Check-in-pad: de lookup van `ticket-checkin` (r.80-85) geeft nog exact dezelfde rij terug
  (`status=checked_in`) → de functie zou `result:'already'` teruggeven. **Niet live geverifieerd
  met een echte HTTP-call**: dat vereist een geldig JWT/service-role token dat in deze omgeving
  niet beschikbaar is. Geen regel code in `ticket-checkin` gewijzigd.
- `types.ts` geregenereerd (33 matches op de nieuwe tabellen); `tsgo --noEmit
  -p tsconfig.app.json` exit 0.

### Bewust ongemoeid / Vervolg
- Ongewijzigd: `ticket-checkin`, `issue_tickets_for_order` + `trg_issue_tickets_on_paid`,
  `get_event_signup_count`, `send-ticket-confirmation`, `storefront-api`, en de vier
  tel-implementaties in de frontend. Geen UI, geen engine, geen changelog/docs (per opdracht).
- `ticket_change_tokens` bestaat al in de DB maar wordt nergens gerefereerd — nog te beslissen
  in fase 2 (opnemen of opruimen).
- Fase 2: scan-engine (`ticket-scan`), her-betredingsbeleid, zone-capaciteit, compat-view /
  omschakeling van de vier lezers, en pas dán eventueel `checked_in` uitfaseren.

## MAIL-LOCALE FIX — resolveEmailLocale explicit-tak consistent — 19 augustus 2026

### Root cause
In `resolveEmailLocale` (`supabase/functions/_shared/tenantEmail.ts` r.498-501) werd de
`explicit`-tak (= `order.locale`) via `sanitizeLocale(opts.explicit, "en")` afgehandeld.
`sanitizeLocale` geeft bij een niet-ondersteunde locale (bv. `es`) altijd de fallback terug
(hier hard `"en"`), en omdat die terugkeer altijd een niet-lege string is, returneerde de tak
die altijd — ook voor onbekende locales. Gevolg: een order met `locale='es'` kreeg een Engelse
mail in plaats van de tenant-default (bv. `nl` voor Fonske). Alle andere takken
(`customerLocale`, `tenant_domains`, `countryCode`) gebruiken consequent
`opts.tenantDefault || "en"` als fallback; alleen de `explicit`-tak week af.

### Uitgevoerd
- `supabase/functions/_shared/tenantEmail.ts` r.498-501: de `explicit`-tak classificeert nu
  eerst of de locale écht in `SUPPORTED_LOCALES` (`nl`/`en`/`fr`/`de`) zit; alleen dan
  returneert hij direct. Een niet-ondersteunde `explicit` locale (bv. `es`) valt niet meer
  hard terug op `"en"` maar door naar de rest van de keten (`customerLocale` →
  tenant-domain-locale → landcode → `tenantDefault`). De nu-overbodige
  `sanitizeLocale(opts.explicit, "en")`-call is vervangen door de inline check.

### Security-keuzes
n.v.t. — geen RLS, policy, grant of rechtenwijziging. Geen schemawijziging. Puur een
consisténtie-fix in een gedeelde mailhelper.

### Gedeelde-paden-waarschuwing
`_shared/tenantEmail.ts` wordt gebruikt door alle 10 klant-mail-edge-functies (alle tenants,
incl. de 5 custom frontends). De wijziging verandert het gedrag **uitsluitend** voor
niet-ondersteunde `explicit`-locales: vroeger `→ en`, nu `→ keten/tenantDefault`.
Ondersteunde locales (`nl`/`en`/`fr`/`de` als `explicit`) worden nog steeds direct
teruggegeven — geen gedrags- of contractwijziging voor die meerderheid. Custom frontends
die een niet-ondersteunde locale meesturen krijgen nu de tenant-default in plaats van
Engels, wat juist klopt. Edge-function-contract byte-voor-byte ongewijzigd.

### Verificatie
- Deno-logica-test van de nieuwe `explicit`-tak (gespiegeld aan de broncode), 5 cases:
  - `{explicit:'nl', tenantDefault:'en'}` → `nl` (ondersteund, ongewijzigd). PASS.
  - `{explicit:'es', tenantDefault:'nl', countryCode:'BE'}` → `nl` (valt door, niet meer
    hard `en`). PASS.
  - `{explicit:'es', tenantDefault:'en', countryCode:'DE'}` → `de` (land-hint werkt nu).
    PASS.
  - `{explicit:'fr'}` → `fr` (ondersteund). PASS.
  - `{explicit:'es', tenantDefault:'en'}` (geen land/klant/domein) → `en` (uiteindelijke
    tenantDefault). PASS.
- `tsgo --noEmit` exit 0 (clean). Geen regressie voor geldige `order.locale`.

### Bewust ongemoeid / Vervolg
- `sanitizeLocale` zelf niet aangepast; de functie blijft correct voor de andere takken.
- Spaans (`es`) als volwaardige mail-taal is een aparte, grotere klus (recon: ~155 unieke
  strings) en blijft uitstaand; dit is alleen de fallback-consistentie-fix.
- Deploy van de betreffende edge-functies volgt apart (geen code-wijziging meer nodig).

---

## MAIL-LOCALE STAP 1 — checkout stuurt klant-taal mee — 19 augustus 2026

### Root cause
De backend-keten voor "mail in de aankoop-taal" was al compleet: `storefront-api`
`cartCreate` (r.1471) en `checkoutCustomer` (r.2336) nemen `params.locale` optioneel aan
en schrijven die naar `storefront_carts.locale`; bij order-aanmaak gaat die waarde mee als
`orders.locale` (r.2224 en r.3153) en de mailhelper leest hem als `explicit` in
`resolveEmailLocale` (`_shared/tenantEmail.ts` r.488-502). Alleen de core-storefront
checkout stuurde nooit een `locale` mee, dus `orders.locale` bleef overal `null` en elke
klant-mail viel terug op de tenant-default (Fonske = `en`).

### Uitgevoerd
- `src/pages/storefront/ShopCheckout.tsx`: `locale` afgeleid van `i18n.language`
  (`.slice(0,2).toLowerCase()`, dus `nl-BE` → `nl`) en meegestuurd in zowel de
  `cart_create`-payload (in `initServerCart`) als de `checkout_customer`-payload;
  `i18n.language` toegevoegd aan de deps van `initServerCart`. Verder niets gewijzigd
  aan de checkout-flow.
- Stap 2 (`customers.locale` als vangnet vullen) **overgeslagen**: de kolom bestaat niet
  op `public.customers` (geverifieerd via `information_schema.columns`; ook geen
  `language`-kolom). Conform opdracht niet geblokkeerd en geen kolom toegevoegd.
- Stap 3 (`customerLocale` voeden in `send-ticket-confirmation` /
  `send-order-confirmation`) **overgeslagen** om dezelfde reden: er is geen bron voor
  `customer.locale`. `resolveEmailLocale` blijft de bestaande volgorde volgen:
  `explicit` → `customerLocale` → enige actieve tenant-domain-locale → landcode →
  tenant-default.

### Security-keuzes
n.v.t. — geen RLS, policy, grant of rechtenwijziging. Geen schemawijziging; `locale` is
een bestaande kolom op `storefront_carts` en `orders`.

### Gedeelde-paden-waarschuwing
`cart_create` en `checkout_customer` zijn gedeelde `storefront-api`-acties (5 custom
frontends). De wijziging is puur additief en zit uitsluitend in de core-storefront-React:
het edge-function-contract is byte-voor-byte ongewijzigd, `locale` blijft optioneel en bij
ontbreken blijft `storefront_carts.locale` `null` → `orders.locale` `null` → mail op
tenant-default, exact het huidige gedrag. Custom frontends die de locale nog niet
meesturen zijn dus onaangeroerd.

### Verificatie
- Live `storefront-api`-calls op tenant SellQo Speeltuin:
  `cart_create` met `locale:"nl"` → `storefront_carts.locale = 'nl'`; met `locale:"en"` →
  `'en'`; zonder `locale` → `null` (geen fout, cart normaal aangemaakt).
  `checkout_customer` met `locale:"fr"` op de cart zonder locale → `locale = 'fr'` en
  `customer_email` gezet; response is de volledige `CartResponse`.
- Testkarretjes (`session_id LIKE 'loctest-%'`) verwijderd met een gewone DELETE.
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0.

### Bewust ongemoeid / Vervolg
- Geen changelog- of doc-entry: wordt in de latere ronde gebundeld.
- Vervolg: eventueel een `customers.locale`-kolom als vangnet (aparte go), en de vijf
  custom frontends die zelf `locale` gaan meesturen in hun checkout-calls.

---

## MAIL-BRANDING-FIX — tenant-branding herstellen in klant-mails — 19 augustus 2026

### Root cause
`supabase/functions/_shared/tenantEmail.ts` r.119-129 selecteerde vier kolommen die
niet op `public.tenants` bestaan: `legal_name`, `contact_email`, `website_url`,
`vat_number` (geverifieerd tegen `information_schema.columns`). PostgREST weigert dan
de volledige select; de `try/catch` las alleen `data` en negeerde `error`, dus
`tenantRow` bleef `null` en elk brandingveld viel terug op de SellQo-defaults:
afzendernaam "SellQo", `https://sellqo.app/email-logo.png` als logo en
`support@sellqo.app` als reply/support-adres. Tenant-branding in klant-mails heeft
dus nooit gewerkt — niet door ontbrekende data (Fonske heeft `name` en `logo_url`
correct gevuld) maar doordat de query stil faalde.

### Uitgevoerd
`supabase/functions/_shared/tenantEmail.ts`:
- Select opgeschoond naar uitsluitend bestaande kolommen: `id, name,
  billing_company_name, support_email, owner_email, notification_email,
  primary_color, logo_url, custom_domain, address, city, postal_code, country,
  btw_number, billing_vat_number, language`. Elke kolom is vóór het behouden
  getoetst tegen `information_schema.columns`.
- Veldmapping voor de verwijderde fantoomkolommen: `legal_name` →
  `billing_company_name`; `contact_email` → `notification_email` (blijft tweede keus
  na `support_email`, vóór `owner_email`); `vat_number` → `btw_number` met
  `billing_vat_number` als tweede bron; `website_url` → `custom_domain`, genormaliseerd
  naar `https://<custom_domain>` wanneer er geen schema in staat.
- Beide selects loggen nu de PostgREST-`error` via `console.error`, en de catch logt de
  worp. De fallback naar defaults blijft staan (robuust), maar een toekomstige
  kolom-mismatch is nu zichtbaar in de logs in plaats van stil.
- Header-link (r.392-pad) gebruikt `websiteUrl` uit `custom_domain`; is die leeg, dan
  blijft `https://sellqo.app` de fallback. Fonske heeft `custom_domain = null`, dus daar
  blijft de fallback staan — correct, geen bug.
- "Mogelijk gemaakt door SellQo · sellqo.app" blijft bewust ongewijzigd:
  `showSellqoFooter` staat nog default aan.

Geen wijziging in de tien verzendfuncties zelf; die gebruiken alle `getTenantBrand` +
`renderTenantEmail` en profiteren automatisch mee.

### Security-keuzes
n.v.t. — geen RLS, policies of grants geraakt. De select draait met de service-role
binnen de edge functions en leest strikt minder velden dan voorheen. `custom_domain`,
`billing_company_name` en `billing_vat_number` zijn niet-gevoelige tenant-gegevens die
al op documenten en storefront zichtbaar zijn.

### Gedeelde-paden-waarschuwing
`_shared/tenantEmail.ts` is een gedeelde helper voor tien klant-mails over alle tenants
(order, ticket, factuur, creditnota, quote, retour, cadeaubon, klantbericht, campagne,
betaalverzoek). De wijziging is puur herstellend en additief in gedrag: de
`TenantBrand`-interface is byte-voor-byte gelijk gebleven, de render-signatuur
ongewijzigd, en de fallback-waarden identiek aan wat er vóór de fix uitkwam. Het
`storefront-api`/`checkout-engine`-contract en de gedeelde tabellen zijn niet geraakt,
dus de vijf custom-frontend tenants merken hier niets van behalve dat hun eigen mails
nu hun eigen logo en naam tonen.

### Verificatie
- `information_schema.columns` op `public.tenants`: de vier fantoomkolommen bestaan
  niet; de zestien behouden kolommen wel.
- Live SQL-natrek met exact de nieuwe kolomlijst: slaagt zonder fout voor Fonske en
  Mancini.
- `getTenantBrand` + `renderTenantEmail` gedraaid onder Deno met de echte tenantrijen:
  Fonske levert `tenantName "The Fonske Crawl"`, `logoUrl` = Fonske-logo,
  `supportEmail info@fonskecrawl.com`, `vatNumber BE1017500207`, footer met
  tenantnaam + adres + "Mogelijk gemaakt door SellQo".
- Regressie zonder logo (Mancini, `logo_url = null`): valt terug op het SellQo-logo met
  `alt="Mancini Milano"` — geen kapotte `<img>`, geen lege src.
- Regressie met `custom_domain` gezet: header-link wordt `https://shop.example.com`.
- Tien edge functions opnieuw uitgerold.

### Bewust ongemoeid / Vervolg
- De Powered-by-footer blijft aan (expliciete keuze).
- `document_logo_url` wordt nog steeds niet door mails gebruikt; e-mail volgt
  `tenant_theme_settings.logo_url` → `tenants.logo_url`. Aparte afweging.
- Stream A-mails (team-invite, trial-warning, notificaties) blijven SellQo-branded via
  `_shared/sellqoEmail.ts`.
- `send-return-email` (`tenant?.name || 'SellQo'`) en `send-campaign-batch`
  (`|| 'Sellqo'`) zetten de from-naam uit hun eigen query; die fallbacks blijven staan.

## I18N-3A — settings-zone gemigreerd naar t(), 27 van 43 bestanden — 18 augustus 2026

### Root cause
Geen defect maar een gat: de volledige instellingen-zone stond in hardcoded
Nederlands. Voor de vier bestaande talen en het in [I18N-1B](#i18n-1b)
toegevoegde Oekraïens betekende dat: wie de interface op en/fr/de/uk zet, kreeg
in Instellingen alsnog Nederlands te zien. Dat is precies het scenario waar de
skill `.agents/skills/sellqo-i18n-verplicht/SKILL.md` voor waarschuwt — met
`fallbackLng: 'nl'` is een niet-gemigreerd scherm niet "onvertaald" maar
stilzwijgend Nederlands, zonder dat iets faalt.

Batch 2 ([I18N-2](#i18n-2)) migreerde de auth- en navigatiezone en legde het
patroon vast. Deze batch
is de eerste die dat patroon op schaal toepast: 43 bestanden, waarvan er 27 zijn
gedaan.

### Uitgevoerd
344 nieuwe keys, toegevoegd in alle vijf de talen vanuit één vertaaltabel zodat
de key-paden per definitie identiek zijn. Hergebruikt zonder duplicaat:
`common.save/cancel/delete/status/actions/email/saving`, `auth.email`, en binnen
de batch de sectie- en rolkeys.

- `src/pages/admin/Settings.tsx` — de groep- en sectieregistry omgezet van
  `title`/`description` naar `titleKey`/`descriptionKey`, dezelfde aanpak als
  `sidebarConfig.ts` in batch 2: hernoemen zodat de compiler elke consument
  aanwijst in plaats van stil een rauwe key te tonen.
- 26 componenten in `src/components/admin/settings/`: AccountSettings,
  BusinessSettings, BrandingSettings, SocialLinksEditor, SocialMediaHub,
  SocialConnectionsManager, TeamSettings, InviteTeamMemberDialog,
  TenantInvitationsList, StripeDisconnectDialog, PlatformToolsSettings,
  ProviderInstructions, CustomerCommunicationSettings, CommunicationTriggerRow,
  DomainSettings, MultiDomainSettings, DomainVerificationPanel,
  DomainProgressSteps, InboundEmailSettings, NotificationSettings,
  AIAssistantSettings en de vier WhatsApp-bestanden.

Commit `18f99911`.

### De belangrijkste vondst: de build is hier geen vangnet
Na de eerste migratieronde gaf `npm run build` **exit 0**, terwijl er zeventien
echte fouten in de code zaten: `t()` aangeroepen buiten componentscope. Ze zaten
in twee soorten plekken:

- **module-level arrays** die vertaalde tekst dragen — `STEPS` in
  `DomainProgressSteps.tsx` en `platformConfigs` in `SocialConnectionsManager.tsx`;
- **sub-componenten** die geen eigen hook hadden gekregen omdat het hook-script
  alleen de eerste component in een bestand aanvult — `EmailCheckBanner`
  (InviteTeamMemberDialog), `RowActions` (TenantInvitationsList) en
  `DomainStatusBadge` (DomainVerificationPanel).

`npm run build` is `vite build` met esbuild. Esbuild stript types en doet **geen
scope-analyse**, dus een verwijzing naar een niet-bestaande `t` compileert
gewoon door. Het resultaat zou een `ReferenceError` zijn op het moment dat de
gebruiker het scherm opent — een productie-crash, niet een verkeerde tekst.
Alleen `npx tsc --noEmit -p tsconfig.app.json` ving ze (`TS2304: Cannot find
name 't'`).

Opgelost met de factory-aanpak uit batch 2: de arrays zijn functies geworden die
`t` als parameter krijgen en binnen de component via `useMemo` worden opgebouwd;
de sub-componenten kregen hun eigen `useTranslation()`.

**Conclusie voor volgende batches: bij componentmigraties is `tsc` verplicht en
is een groene build betekenisloos als bewijs.** Dat hoort in de skill en
uiteindelijk in CI.

### Scope-correctie
De opdracht ging uit van ongeveer 476 strings. Mijn eerste inventarisatie
bevestigde dat ruwweg (516), maar bevatte een fout: de skip-regex in het
extractiescript stond op case-insensitive, waardoor `^[a-z0-9_-]+$` ook
"Domeinnaam", "Status", "Acties" en "Annuleren" matchte. **Elk enkel woord viel
daardoor uit de inventaris.** Na correctie: 993 kandidaten, na aftrek van
import-ruis ongeveer 590 echte UI-strings.

Daarvan zijn er 344 gedaan. De resterende ~509 strings zitten in zestien
bestanden en zijn bewust doorgeschoven naar batch 3b, omdat dat precies de
fiscale en financiële set is — TaxSettings (113), ReturnSettings (75),
TransactionFeeSettings (58), PaymentSettings (51), POSTerminalSettings (41) en
de label-, printer- en fulfilment-bestanden. Daar moet per string beoordeeld
worden of iets UI-tekst is of configuratie, en juist daar valt de winst van een
tabelgedreven migratie weg.

### Bewust behouden strings
Vertalen zou deze onbruikbaar of kapot maken:

- **Cloudflare-UI-labels** (`DomainSettings`): `"Create Token"`,
  `"Edit zone DNS"`, `Zone Resources`, `"Continue to summary"`,
  `Cloudflare Dashboard → My Profile → API Tokens`. Knop- en menunamen in
  Cloudflare's Engelstalige interface; een vertaling maakt de instructie
  onvindbaar.
- **Bol.com-menupad en veldnaam** (`InboundEmailSettings`):
  `Bol.com Partner Platform`, `→ Instellingen → Winkelsettings`,
  `"Klantenservice e-mailadres"`. Staat zo in Bol.com's eigen scherm.
- **Meta/WhatsApp API-veldnamen**: `Phone Number ID`, `Business Account ID`,
  `Access Token`, `Verify Token`, `Webhook URL`, en de tokenprefix `EAAx...`.
- **`{{1}}`/`{{2}}` in de WhatsApp-voorbeeldtemplate**: dit is Meta's
  placeholder-syntax. Door i18next zouden die tokens als interpolatievariabelen
  worden opgevat en **leeg renderen** — de string blijft daarom letterlijk.
- **`RESET`** (`PlatformToolsSettings`): het bevestigingstoken dat de gebruiker
  letterlijk moet intypen. Alleen het werkwoord eromheen is vertaald.
- **Enum-waarden**: `value: 'tenant_admin'`, `'staff'`, `'accountant'` enzovoort.
  De migrator weigert expliciet op de velden `value`, `id`, `key`, `type`,
  `slug`, `provider` en `status`; dat is na elke groep per bestand gecontroleerd.

### Security-keuzes
n.v.t. Geen tabellen, policies, functies, grants of routes geraakt. Wel relevant
voor deze zone: de migratie raakt schermen die integraties en toegangsrechten
configureren, maar uitsluitend hun **labels**. Geen enkele config-waarde,
provider-id, secret-naam of API-parameter is gewijzigd — zie de vorige sectie.
De rolwaarden achter de vertaalde rol-labels in `TeamSettings` en
`InviteTeamMemberDialog` zijn ongewijzigd, dus de rechtenafhandeling verandert
niet.

### Gedeelde-paden-waarschuwing
n.v.t., maar nagetrokken. `git diff --name-only` blijft binnen
`src/components/admin/settings/`, `src/pages/admin/Settings.tsx` en de vijf
locale-bestanden. Geen edge function, geen migratie, geen gedeelde tabel, geen
component uit `src/components/storefront/`. De custom frontends hebben hun eigen
i18n en delen deze schermen niet.

### Verificatie
1. `node scripts/i18n-parity.mjs` → exit 0, vijf talen op **2217/2217** keys
   (was 1873).
2. `npx tsc --noEmit -p tsconfig.app.json` → exit 0, na het oplossen van de
   zeventien scope-fouten.
3. `npm run build` → exit 0.
4. Per groep gecontroleerd dat geen enum- of id-veld door de migrator is geraakt.
5. `git diff --name-only` bevat geen bestand buiten de scope.

### Bewust ongemoeid
- De zestien bestanden van batch 3b, plus 77 restjes in de hier gemigreerde
  bestanden (vooral `AIAssistantSettings` en `DomainSettings`) — losse woorden
  die de kapotte extractiefilter miste.
- `src/components/ui/*` blijft buiten elke migratie; dat zijn shadcn-primitieven
  zonder eigen tekst.

### Vervolg
- **Batch 3b**: de fiscale en financiële settings, ~509 strings in zestien
  bestanden. Vraagt per string beoordeling op UI-tekst versus configuratie.
- **`tsc` en het parity-script draaien nog steeds nergens automatisch.** Deze
  batch laat zien wat dat kost: zonder de handmatige tsc-run waren zeventien
  crashes doorgeglipt langs een groene build. Dit is het sterkste argument tot nu
  toe om beide in CI te zetten.
- De skill verdient een regel dat een groene build bij componentmigraties geen
  bewijs is.
## I18N-2 — auth en navigatie gemigreerd naar t() — 18 augustus 2026

### Root cause
Geen defect maar een gat, en wel op de meest zichtbare plek van de applicatie.
Na [I18N-1B](#i18n-1b) waren er vijf talen met volledige key-pariteit, maar de
schermen zelf stonden nog in hardcoded Nederlands. Wie de interface op en/fr/de/uk
zette, kreeg dus alsnog een Nederlands loginscherm en een Nederlands zijmenu —
letterlijk het eerste en het meest gebruikte dat een gebruiker ziet.

Dat is het scenario waar `.agents/skills/sellqo-i18n-verplicht/SKILL.md` voor
waarschuwt: met `fallbackLng: 'nl'` faalt er niets, het scherm is gewoon stil
Nederlands. De batches 0 tot en met 1b hadden de infrastructuur en de vertalingen
geleverd; dit is de eerste batch die daadwerkelijk componenten omzet.

### Uitgevoerd
110 nieuwe keys, toegevoegd in alle vijf de talen vanuit één vertaaltabel zodat
de key-paden per definitie identiek zijn. Elf keys zijn hergebruikt uit de
bestaande `navigation.*`-sectie (dashboard, orders, products, customers,
categories, analytics, shipping, import, settings, tenants, platform), plus
`auth.login`, `auth.signUp`, `auth.email`, `auth.password`, `auth.forgotPassword`,
`auth.resetPassword`, `auth.logout`, `common.cancel` en `common.save`.

- `src/pages/Auth.tsx` — 42 strings: login, registratie, wachtwoord-reset, het
  keuzescherm voor al ingelogde gebruikers en de validatiemeldingen.
- `src/components/admin/sidebar/sidebarConfig.ts` — 74 menu- en groepstitels.
- `src/hooks/useAuth.tsx` — de zeven user-facing toasts plus hun
  dependency-array.
- `src/components/admin/AdminSidebar.tsx` — 12 strings (winkelkiezer,
  admin-view-banner, tooltips, footer).
- `src/components/admin/SidebarCustomizeDialog.tsx` — 5.
- `src/components/auth/SessionExpiredDialog.tsx` — 3.
- `src/components/platform/TenantModulesTab.tsx` — 2, zie hieronder.

Commit `e5dcb04b`.

### Vangst uit recon: de labels stonden niet waar je ze zoekt
De opdracht noemde de sidebar-componenten. Maar `AdminSidebar.tsx` rendert
`{item.title}` en `{group.title}`; de teksten zelf zijn data in
`sidebarConfig.ts`, een bestand dat niet in de scope-lijst stond. Zonder dat
bestand zou het menu Nederlands blijven en alleen het chroom eromheen vertaald
worden. Na afstemming is het toegevoegd.

Daarbij is het veld `title` **hernoemd** naar `titleKey` in plaats van de key in
het bestaande veld te zetten. Dat is een bewuste keuze: bij hernoemen faalt de
compiler bij elke consument, terwijl een key in een veld dat `title` heet
stilzwijgend een rauwe key op het scherm zet. Dat betaalde zich meteen uit —
`tsc` wees op `TenantModulesTab.tsx`, dat dezelfde velden rendert, in
`src/components/platform/` staat en dus buiten de verwachte zoekrichting viel.
Twee regels daar aangepast; de rest van dat bestand blijft Nederlands en valt
buiten deze batch.

### Het factory-patroon voor t() buiten componentscope
De drie Zod-schema's in `Auth.tsx` stonden op moduleniveau met Nederlandse
foutmeldingen. Daar bestaat `t` niet. Ze zijn factory-functies geworden —
`buildLoginSchema(t)`, `buildResetSchema(t)`, `buildSignupSchema(t)` — die binnen
de component via `useMemo` op `[t]` worden opgebouwd, zodat ze alleen bij een
taalwissel opnieuw ontstaan. De validatielogica zelf is regel voor regel
ongewijzigd.

Dit patroon is daarna in de settings-migratie opnieuw nodig gebleken, en niet
zelden: module-level arrays met vertaalde tekst en sub-componenten zonder eigen
hook lopen tegen precies hetzelfde aan. Het is daarmee het standaardantwoord
geworden op `t()` buiten componentscope.

### Drie zichtbare tekstwijzigingen door key-hergebruik
De regel "maak geen nieuwe key als er al een bestaat" heeft hier drie Nederlandse
labels veranderd. Geen bug, wel zichtbaar gedrag:

- menu-item **Analytics** → **Analyse** (`navigation.analytics`)
- login-label **E-mail** → **E-mailadres** (`auth.email`)
- dialoogtitel **Wachtwoord opnieuw instellen** → **Wachtwoord resetten**
  (`auth.resetPassword`)

### Bewust behouden strings
- **`••••••••`** als wachtwoord-placeholder: bullets, geen taal.
- **`error.message`** in de login- en registratietoasts: dat is de foutmelding
  van Supabase, geen eigen UI-tekst. Vertalen vraagt een mapping van
  backend-foutcodes en is een eigen ontwerpbeslissing.
- **Merknamen** die wel een key kregen voor pariteit maar in alle vijf talen
  identiek zijn: Bol.com, Amazon, Google, Meta, SellQo Connect, SEO.
- **`src/components/ui/sidebar.tsx`** is niet aangeraakt; dat is een
  shadcn-primitive zonder eigen tekst.

### Security-keuzes
n.v.t. Geen tabellen, policies, functies, grants of routes geraakt. Wel het
vermelden waard: de migratie raakt het authenticatiescherm en de rolafhankelijke
navigatie, maar uitsluitend hun **labels**. De rolfiltering in `AdminSidebar`
(`shouldHideItem`, `isResourceHidden`, `WAREHOUSE_ALLOWED_ITEMS`) werkt op
`item.id` en is ongewijzigd; welke gebruiker welk menu-item ziet, verandert dus
niet. De validatieregels in `Auth.tsx` zijn identiek gebleven, alleen hun
meldingen lopen nu via `t()`.

### Gedeelde-paden-waarschuwing
n.v.t., maar nagetrokken. De diff blijft in `src/pages/Auth.tsx`, `src/hooks/`,
`src/components/auth/`, `src/components/admin/` (sidebar), één bestand in
`src/components/platform/` en de vijf locale-bestanden. Geen edge function, geen
migratie, geen gedeelde tabel, geen component uit `src/components/storefront/`.
De custom frontends hebben hun eigen auth- en navigatieopzet.

### Verificatie
1. `node scripts/i18n-parity.mjs` → exit 0, vijf talen op **1873/1873** keys
   (was 1763).
2. `npx tsc --noEmit -p tsconfig.app.json` → exit 0. Dit is ook de run die
   `TenantModulesTab.tsx` aanwees.
3. `npm run build` → exit 0.
4. `grep -nE ">[A-Z][a-zà-ÿ].{3,}<"` op alle zes de gemigreerde bestanden → nul
   treffers.

### Vervolg
- De rest van `TenantModulesTab.tsx` (kaarttitels, beschrijvingen) staat nog in
  het Nederlands.
- De vertaling van Supabase-foutmeldingen vraagt een foutcode-mapping en is niet
  ingepland.
- De settings-zone volgt als aparte batch.

## I18N-1B — Oekraïens toegevoegd als vijfde taal — 18 augustus 2026

### Root cause
Geen defect maar een gat in het aanbod: SellQo ondersteunde vier talen
(nl/en/fr/de), waardoor Oekraïenstalige gebruikers geen keuze hadden. Deze batch
vult dat gat.

Dit is de **eerste toepassing van het recept** uit
`.agents/skills/sellqo-i18n-verplicht/SKILL.md`, sectie "Een nieuwe taal
toevoegen". Dat recept bestaat uit vier stappen en die zijn hier letterlijk
gevolgd:

1. **Schrift en richting bepalen.** Oekraïens is Cyrillisch maar LTR, dus volgens
   het recept een gewone toevoeging: geen layout-audit, geen logical CSS-properties,
   geen spiegeling. Die eis geldt alleen voor RTL (ar/he), en dat blijft een apart
   project. Het font dekt de Cyrillische glyphs — geen CJK-problematiek.
2. **Eén regel in `SUPPORTED_LANGUAGES`.** Het recept waarschuwt expliciet voor de
   ISO-code: Oekraïens is `uk`, niet `ua`. Dat is gerespecteerd.
3. **Twee locale-bestanden met de volledige key-set**, plus registratie als
   resource in `src/i18n/index.ts`.
4. **Parity groen, switchers werken vanzelf.** Het recept stelt dat allowlists,
   browser-detectie en taal-switchers automatisch meegaan omdat ze uit `LANG_CODES`
   afleiden, en dat je een hardcoded lijst die je alsnog moet aanpassen als bug
   moet behandelen. **Nagetrokken: er hoefde niets aangepast te worden.** Dat is de
   uitbetaling van de bron van waarheid uit batch 0 (`6f93fff4`); vóór die batch
   hadden hier negen hardcoded talenlijsten bijgewerkt moeten worden.

Deze batch bouwt voort op [I18N-1A](#i18n-1a) (`7bd99fd6`), die de main namespace
op volledige pariteit bracht. Dat was een voorwaarde: zonder die 297 gedichte
gaten zou `uk` gekopieerd zijn van een bronbestand met eigen gaten, en zou de
nieuwe taal dezelfde rauwe key-strings hebben geërfd.

### Uitgevoerd
- `src/i18n/languages.ts` — één regel toegevoegd:
  `{ code: 'uk', label: 'Українська', flag: '🇺🇦', script: 'cyrillic', dir: 'ltr' }`.
  De TODO-comment is ingekort tot es/it/pt/pl.
- `src/i18n/index.ts` — twee imports (`uk`, `landingUk`) en één resource-entry
  `uk: { translation: { ...uk, ...landingUk } }`, exact het patroon van de
  bestaande vier talen.
- `src/i18n/locales/uk.json` — nieuw, 1095 keys.
- `src/i18n/locales/landing.uk.json` — nieuw, 666 keys.

Samen 1761 keys, gelijk aan de unie van beide namespaces. Commit `8163a3fd`.

De vertalingen zijn machinaal geproduceerd op basis van de nl-bestanden, met een
vooraf vastgelegd glossarium dat overal consequent is toegepast
(`рахунок-фактура`, `кредит-нота`, `підписка`, `замовлення`, `товар`, `доставка`,
`залишки`, `ПДВ`, `магазин`, `тарифний план`) en een formele aanspreekvorm
(ви/ваш) door de volledige set heen. Achttien waarden zijn bewust onvertaald:
merknamen, plannamen, technische termen als SKU en SEO, en de `languages`-sectie
met endoniemen — die staat in alle locales identiek, wat de bestaande conventie is.

Geen component, hook of edge function aangeraakt buiten de twee bedradingsregels.

### Security-keuzes
n.v.t. Geen tabellen, policies, functies, grants of routes geraakt. De wijziging
voegt twee JSON-bestanden met vertaalstrings toe aan de client-bundle en zet één
regel bij in een bestaande constante. Er komt geen data in de bundle die qua
gevoeligheid afwijkt van wat er al stond.

Wel het vermelden waard: `uk` stroomt nu mee in de twee `z.enum`-schema's van
`CampaignDialog` en `TemplateDialog`, omdat die sinds batch 0 uit
`LANG_CODES_TUPLE` afleiden. Dat verruimt de geaccepteerde invoer van vier naar
vijf waarden. Dat is bedoeld gedrag en geen verzwakking: het schema blijft een
gesloten allowlist, alleen met één extra toegestane taalcode.

### Gedeelde-paden-waarschuwing
n.v.t., maar expliciet nagetrokken. De locale-bestanden worden alleen door
`src/i18n/index.ts` geïmporteerd en dus alleen door de core-bundle gebruikt. De
custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata)
hebben hun eigen i18n-opzet en halen geen vertalingen uit de core.

Twee punten die op het eerste gezicht gedeeld lijken maar het niet zijn:

- **`StorefrontLanguageSelector`** leidt zijn lijst nu wel uit
  `SUPPORTED_LANGUAGES` af, maar filtert die ongewijzigd op de `languages`-prop van
  de tenant. Oekraïens verschijnt in een storefront dus alleen als die tenant het
  zelf in `storefront_languages` heeft staan. Er is geen tenant-data gewijzigd, dus
  voor bestaande winkels verandert er niets.
- **Geen kolom, default of contract aangeraakt.** `storefront-resolve`,
  `storefront-api` en `checkout-engine` blijven ongemoeid, en er is niets
  toegevoegd aan `tenant_theme_settings` — dus ook niets dat via `select('*')` naar
  de custom frontends doorstroomt.

### Verificatie
1. `node scripts/i18n-parity.mjs` → exit 0. **Vijf talen (de, en, fr, nl, uk), elk
   1761/1761 keys**, nul gaten. De nieuwe taal verschijnt automatisch in het
   rapport omdat het script de talen uit de aanwezige bestanden afleidt.
2. Beide uk-bestanden parsen als geldige JSON, encoding UTF-8, **nul
   `\u`-escapes** — het Cyrillisch staat leesbaar in het bestand, conform de
   conventie van de bestaande locales.
3. Placeholder-integriteit per key vergeleken met nl: **nul mismatches** in beide
   namespaces. Zowel de `{{dubbele}}` als de `{enkele}` accoladevorm is intact,
   inclusief `{originalDate}`, `{duplicateDate}`, `{name}` en `{period}`. Ook de
   `<strong>`-tags en de `<email/>`-Trans-tag zijn ongewijzigd overgenomen.
4. Diepe structuurvergelijking met de nl-bestanden: alle geneste objecten en alle
   arrays hebben identieke lengte en vorm. Dat is apart getoetst omdat de
   key-telling arrays als één blad ziet en een ingekorte stappenlijst dus niet zou
   opvallen.
5. `npm run build` → exit 0.
6. Steekproef op tien keys, verspreid over beide namespaces, met correcte
   Cyrillische rendering: `common.delete` = "Видалити", `navigation.dashboard` =
   "Панель керування", `billing.upgrade` = "Підвищити тариф",
   `vat.decision_tree.reverse_charge` = "ПДВ сплачує отримувач".
7. De zeven plekken die talen tonen of valideren zijn nagelopen: alle zeven
   importeren uit `@/i18n/languages`. Geen enkele hardcoded lijst gevonden die
   bijgewerkt moest worden.

### Vangst uit recon
De opdracht noemde 1069 main-keys en 664 landing-keys, en 47 placeholders. Beide
cijfers klopten niet meer:

- De key-aantallen waren die van **vóór** I18N-1A en de bijbehorende slottaken.
  Actueel is het 1095 en 666. Was `uk` op de opgegeven aantallen gebouwd, dan had
  de taal 28 keys gemist en zou de pariteit direct rood zijn gestaan.
- De placeholder-verwachting van 47 (39 main + 8 landing) bleek een onderschatting
  van het bronbestand zelf: gemeten in nl zijn het er 65 (57 main, 8 landing). Het
  landing-getal klopte precies; het main-getal niet. Voor de verificatie is dat
  niet doorslaggevend — de harde eis is dat uk per key hetzelfde heeft als nl, en
  dat is het geval.

### Bewust ongemoeid
- Geen component gemigreerd naar `t()`. De hardcoded strings in JSX blijven staan.
- es/it/pt/pl staan nog als TODO in `languages.ts` en zijn niet toegevoegd.
- Geen tenant-data aangeraakt: geen enkele winkel heeft Oekraïens automatisch in
  zijn storefront-talen gekregen.

### Vervolg
- **Native review is de openstaande stap.** De vertalingen zijn machinaal
  geproduceerd. Structuur, terminologie en placeholders zijn geverifieerd; toon en
  idioom niet. Nastya reviewt die op de live versie, met de nadruk op de langere
  marketingteksten: de landingspagina en de 101 changelog-entries. Correcties
  daarop zijn data-only wijzigingen in `uk.json` en `landing.uk.json` en raken de
  bedrading niet.
- `scripts/i18n-parity.mjs` draait nog steeds niet in CI. Met vijf talen wordt het
  risico dat de pariteit ongemerkt wegzakt navenant groter.
- Batch 0 (`6f93fff4`) heeft nog geen eigen role-audit-entry; zie de notitie in
  I18N-1A.

## I18N-1A — 297 ontbrekende vertaalkeys gedicht, waarvan 26 als rauwe key-strings renderden — 18 augustus 2026

### Root cause
`src/i18n/index.ts` start i18next met `fallbackLng: 'nl'` en voegt per taal twee
bestanden samen in één `translation`-namespace: `locales/{code}.json` (app-UI) en
`locales/landing.{code}.json` (publieke landing). Keys werden historisch per taal
los toegevoegd, zonder dat iets bewaakte dat de vier bestanden dezelfde set
houden. Daardoor stonden er in de main namespace 297 gaten: nl 26, en 37, fr 117,
de 117.

Voor en/fr/de betekent zo'n gat een stille terugval op het Nederlands —
vervelend, maar leesbaar. Voor de 26 Nederlandse keys bestond die terugval niet:
`nl` **is** de fallback. i18next geeft dan het key-pad zelf terug, dus in de UI
verscheen letterlijk `navigation.dashboard` in plaats van "Dashboard" — en dat in
élke taal, want geen van de vier bestanden had de key. Het ging om de volledige
`navigation.*`-sectie (analytics, categories, customers, dashboard, orders,
platform, products, settings, shipping, tenants) en om zestien `common.*`-keys
(actions, add, address, back, close, confirm, date, delete, description, email,
name, next, no, phone, search, yes).

Dat dit jarenlang kon blijven staan, komt doordat er geen controle op bestond.
Batch 0 (`6f93fff4`) leverde die alsnog: `scripts/i18n-parity.mjs` leidt de talen
af uit de aanwezige locale-bestanden, voegt beide namespaces samen zoals
`i18n/index.ts` dat doet, en faalt met exit 1 zodra één taal een key mist.
Diezelfde batch legde de talenlijst vast in `src/i18n/languages.ts` als enige bron
van waarheid, zodat allowlists, `z.enum`-schema's, browser-detectie en
taal-switchers niet langer elk hun eigen hardcoded rijtje bijhouden.

### Uitgevoerd
- `src/i18n/locales/nl.json` — 26 keys toegevoegd
- `src/i18n/locales/en.json` — 37 keys toegevoegd
- `src/i18n/locales/fr.json` — 117 keys toegevoegd
- `src/i18n/locales/de.json` — 117 keys toegevoegd

Alle vier de bestanden staan nu op 1095 keys. Toegevoegd via een additieve nested
merge die per key eerst controleert of het pad al bestaat en alleen schrijft bij
afwezigheid; bestaande waarden worden nooit aangeraakt. De vertalingen kwamen uit
een vooraf gegenereerde en gereviewde dataset — er is niets ter plekke verzonnen
of bijgesteld. Commit `7bd99fd6`.

Geen component, hook of edge function aangeraakt: de wijziging is pure JSON-data.

### Security-keuzes
n.v.t. Geen tabellen, policies, functies, grants of routes geraakt. De wijziging
voegt uitsluitend vertaalstrings toe aan vier JSON-bestanden die al integraal in
de client-bundle zaten. Er komt dus niets in de bundle dat qua gevoeligheid
afwijkt van wat er al stond, en er is geen pad waarlangs deze strings iets over
een tenant prijsgeven.

### Gedeelde-paden-waarschuwing
n.v.t., maar expliciet nagetrokken. De vier locale-bestanden worden alleen door
`src/i18n/index.ts` geïmporteerd en dus alleen door de core-bundle gebruikt. De
custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata)
hebben hun eigen i18n-opzet en halen geen vertalingen uit de core.
`storefront-resolve`, `storefront-api` en `checkout-engine` zijn niet aangeraakt;
geen kolom, default of contract gewijzigd.

### Verificatie
1. Droogloop vóór het schrijven voorspelde 26/37/117/117 en nul al-aanwezige
   keys; de uitvoering gaf exact diezelfde aantallen.
2. `node scripts/i18n-parity.mjs` → exit 0, volledige pariteit. Main namespace
   4 × 1095, landing namespace onveranderd 4 × 664. Geen nieuwe taal verschenen.
3. Additiviteit per key nagerekend tegen `HEAD`: 0 verwijderd, 0 overschreven, in
   alle vier de bestanden.
4. De dertien `-`-regels in de diffstat zijn dezelfde regels die terugkeren mét
   afsluitende komma omdat er een sibling achter kwam. Eén-op-één gematcht: nul
   echte verwijderingen.
5. Alle vier de bestanden parsen als geldige JSON.
6. Placeholder-integriteit: 57 placeholders per taal, gelijk aantal, alle
   accolades gebalanceerd. `{originalDate}`, `{duplicateDate}`, `{name}` en
   `{period}` staan intact in `invoice_duplicate.notice` en
   `subscriptions.invoice_note`.
7. Steekproef op de kapotte-UI-fix in `nl.json`: `common.delete` = "Verwijderen",
   `common.yes` = "Ja", `navigation.dashboard` = "Dashboard".

### Vangst uit recon
Het meegeleverde merge-script las `/tmp/dealA_translations.json`, een pad dat hier
niet bestaat; ongewijzigd draaien crashte meteen. Alleen dat pad is gecorrigeerd
naar de repo-root, de merge-logica is ongemoeid gebleven. Verder bleek de opmaak
van de vier bestanden (2 spaties inspringen, geen `\u`-escapes, sluitende newline)
exact overeen te komen met wat `JSON.stringify(json, null, 2)` teruggeeft — vandaar
dat een volledige herschrijving toch een schone, additieve diff oplevert.

### Bewust ongemoeid
- De landing-namespace (`landing.{code}.json`, 664 keys per taal) had al volledige
  pariteit en is niet aangeraakt.
- Geen nieuwe talen. `SUPPORTED_LANGUAGES` blijft nl/en/fr/de; es/it/pt/pl/uk
  komen pas wanneer hun locale-bestanden bestaan.
- Geen component gemigreerd naar `t()`. De hardcoded strings in JSX blijven staan;
  dit ging uitsluitend over ontbrekende keys.

### Vervolg
- Batch 0 (`6f93fff4`) heeft geen eigen role-audit-entry. Bewust overgeslagen omdat
  die batch geen tenant-zichtbaar gedrag veranderde: de talenlijst bleef
  functioneel nl/en/fr/de. Deze entry verwijst ernaar zodat de keten sluit.
- `scripts/i18n-parity.mjs` draait nog niet in CI. Zolang dat zo blijft, kan de
  pariteit opnieuw wegzakken zonder dat iemand het merkt.
- De componentmigratie naar `t()` staat nog open.

## PROD-TRIGGER-1 — marketing mag producten bewerken, niet de commerciële velden — 18-08-2026

### Root cause
`products` bundelt content- en commerciële velden in één tabel. Rijniveau-RLS kan
daarom geen onderscheid maken tussen "beschrijving aanpassen" en "prijs aanpassen".
De rol `marketing` was daardoor volledig uitgesloten van `products.write`
(`src/hooks/useCan.ts`) en van de UPDATE-policy `Users can update their tenant's
products` — precies het werk (teksten, SEO, tags, afbeeldingen) waarvoor de rol
bestaat, was onmogelijk. Bij het testen met een echte marketinggebruiker bleek dit
een blokkade voor normaal werk.

**Bestaand gat, in dezelfde batch meegenomen:** `warehouse` stond wél in de
UPDATE-policy en kon dus de verkoopprijs, inkoopprijs, btw-tarief, SKU en barcode
van elk product wijzigen, terwijl die rol alleen voorraad hoort te beheren.

### Uitgevoerd
- **Migratie** — `Users can update their tenant's products` herbouwd met
  `'marketing'::app_role` toegevoegd aan de rol-array; policynaam en de
  `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`-voorwaarde behouden.
  INSERT-policies en de twee platform-admin-policies ongemoeid.
- **Migratie** — nieuwe `public.guard_product_commercial_fields()`
  (`SECURITY DEFINER`, `search_path = public`) + trigger
  `trg_guard_product_commercial_fields` `BEFORE UPDATE ON public.products FOR EACH ROW`.
  Verboden voor wie uitsluitend `marketing`/`warehouse` is: `price`,
  `compare_at_price`, `cost_price`, `vat_rate_id`, `sku`, `barcode`. Voorraad
  (`stock`, `low_stock_threshold`) mag `warehouse` wel, `marketing` niet.
  Foutcode `42501`.
- `src/hooks/useCan.ts` — `marketing` toegevoegd aan `products.write`.
  `product_costs` ongewijzigd.
- `src/pages/admin/ProductForm.tsx` — rolafgeleide vlaggen `canEditCommercial` en
  `canEditStock` uit `useAuth().roles`; prijs-, kostprijs-, vergelijkingsprijs-,
  SKU-, barcode-, voorraad- en drempelvelden `disabled` met de uitleg
  "Wordt door een beheerder beheerd."
- `src/App.tsx` — `products/new` kreeg naast `requireWrite="products"` een
  `requireRole={['tenant_admin','staff']}`. **Bevinding:** zonder die toevoeging
  zou een marketier na de matrixwijziging wél het aanmaakformulier krijgen terwijl
  de INSERT-policy hem weigert — dus een formulier dat bij opslaan faalt.

### Checkvolgorde: ruim naar smal
`auth.uid() IS NULL` of `is_platform_admin` → door. Daarna `tenant_admin`/`staff`
→ door. Pas daarna de beperking voor `marketing`/`warehouse`. Rolstapeling mag
nooit tot minder rechten leiden: wie naast `marketing` ook `staff` is, houdt
volledige schrijfrechten.

### Server-to-server
`auth.uid() IS NULL` betekent hier service-role: productimport, marketplace-sync
en prijsfeeds draaien via edge functions. Een harde check zou die allemaal breken.
Zelfde conventie als SEC-0b; zie platformartikel `rpc-autorisatie-conventie`.

### Triggerorde
`BEFORE`-triggers lopen alfabetisch: `products_updated_at` → `trg_guard_...` →
`trg_sync_product_ean_fields`. Nagetrokken: `sync_product_ean_fields` raakt geen
prijs- of identificatievelden (`pg_get_functiondef(...) LIKE '%price%'` = false),
dus de guard kan niet afgaan op een systeemwijziging.
`trigger_stock_notification` is `AFTER` en valt buiten de guard.

### Verificatie
1. Triggers op `products`: `products_updated_at` (BEFORE),
   `trg_guard_product_commercial_fields` (BEFORE),
   `trg_sync_product_ean_fields` (BEFORE), `trigger_stock_notification` (AFTER).
2. `bevat_marketing`: UPDATE `Users can update their tenant's products` = **true**,
   beide INSERT-policies = **false**, platform-admin-UPDATE = false.
3. `guard_product_commercial_fields`: `prosecdef = true`, `config = search_path=public`.
4. **End-to-end, echte marketinggebruiker** (`48ab6f43-…`, tenant `54f6b480-…`),
   sessie nagebootst via `request.jwt.claims`, alles in één transactie die
   afgesloten werd met een `RAISE EXCEPTION` zodat niets persistent werd:
   `description=OK; price=geweigerd 42501; stock=geweigerd 42501;
   sku=geweigerd 42501; bulk_adjust_prices=geweigerd 42501`.
   Stap 4 van de opdracht is daarmee bewezen: `bulk_adjust_prices` draait
   `SECURITY DEFINER`, maar de trigger vuurt op de onderliggende `UPDATE` en
   weigert alsnog.
5. `npx tsgo --noEmit -p tsconfig.app.json` → exit 0.
6. JSON-parse `landing.{nl,en,fr,de}.json` → alle vier geldig, sleutel
   `marketing_product_editing` in alle vier aanwezig.

### Openstaand restrisico
- `cost_price` blijft **leesbaar** voor alle tenant-rollen via de tenant-blinde
  `SELECT`-policy op `products`. Kolomniveau-leesafscherming vraagt een view of
  column privileges en valt buiten deze batch — zie de `product_costs`-notitie
  uit SEC-2a en SEC-4.
- `product_variants` heeft een eigen `cost_price` en verdient dezelfde guard
  zodra `marketing` daar schrijfrechten zou krijgen. Nu niet aan de orde: die rol
  staat niet in de variant-policies.
- Newsletter-item staat onder *Openstaand* in `docs/newsletter-queue.md` en moet
  handmatig door Akke verzonden worden; de wachtrij leeft in de paper trail tot
  UPDATES-1.

### Rollback
```sql
DROP TRIGGER IF EXISTS trg_guard_product_commercial_fields ON public.products;
DROP FUNCTION IF EXISTS public.guard_product_commercial_fields();

DROP POLICY IF EXISTS "Users can update their tenant's products" ON public.products;
CREATE POLICY "Users can update their tenant's products"
ON public.products
FOR UPDATE
USING (
  (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'warehouse'::app_role])
);
```
Frontend: `marketing` uit `products.write` halen, de `disabled`-vlaggen en de
`requireRole` op `products/new` terugdraaien.

## PERM-2 — persoonlijke instellingen ontsloten, rapporten gesplitst — 18 augustus 2026

**Root cause (deel A).** De route-guard van `/admin/settings` en `/admin/notifications` stond in
`src/App.tsx` op `requireRead="settings_general"`, en die resource is beperkt tot
`platform_admin`, `tenant_admin`, `viewer`. Daardoor was de volledige instellingenpagina —
inclusief de sectie "Mijn profiel" (`AccountSettings`: naam, taalkeuze, wachtwoord) —
onbereikbaar voor `staff`, `marketing`, `warehouse` en `accountant`: vier van de zeven rollen.
Een persoonlijke instelling zat achter een tenant-rechtencheck. Dit kwam boven bij het testen
met een echte `marketing`-gebruiker en niet bij de RLS-audits (SEC-2a t/m SEC-4): een
frontend-guard valt buiten wat een policy-sweep detecteert.

**Root cause (deel B).** Eén resource `reports` dekte drie inhoudelijk verschillende pagina's:
`Reports.tsx` (btw-aangifte, IC-listing, omzet, aging — fiscaal), `Analytics.tsx` (omzet over
tijd, orders, nieuwe klanten, AOV, top producten — commercieel) en `reports/stock` (operationeel).
Fiscale rapporten kregen zo dezelfde rolset als commerciële analyses.

**Uitgevoerd.**
- `src/hooks/useCan.ts`: nieuwe resources `profile` (`read`/`write` = ALL_ROLES),
  `reports_financial` (`read`: platform_admin, tenant_admin, staff, accountant, viewer) en
  `reports_analytics` (`read`: ALL_ROLES minus warehouse). Oude resource `reports` verwijderd.
  `reports_financial` neemt bewust de rolset van SEC-2a (`invoices`, `credit_notes`) over —
  één rolset voor "mag financiële gegevens zien".
- `src/App.tsx`: `settings` en `notifications` → `requireRead="profile"`;
  `reports` → `reports_financial`; `analytics` → `reports_analytics`;
  `reports/stock` → `products`.
- `src/pages/admin/Settings.tsx`: `SettingsSection` uitgebreid met optionele
  `requiredRead?: Resource`. Secties zonder waarde blijven voor iedereen zichtbaar; groepen
  zonder zichtbare sectie verdwijnen uit de navigatie. Deep-links naar een niet-toegestane
  sectie vallen terug op "Mijn profiel". Omdat hooks niet in een loop kunnen, worden de drie
  gebruikte rechten (`settings_general`, `settings_financial`, `marketing`) eenmalig op
  componentniveau uitgelezen.
- `src/components/admin/sidebar/sidebarConfig.ts`: kinderen van "Rapporten" gesplitst
  (`reports_financial` / `reports_analytics` / `products`); parent op `products` zodat
  `warehouse` het voorraadrapport in het menu ziet.
- `src/components/admin/OrderBulkActions.tsx`: `useCan('read','reports')` →
  `useCan('read','reports_financial')` (het betreft een financiële export).

**Toewijzingstabel secties.**

| Groep / sectie | `requiredRead` |
|---|---|
| `account` → `profile` | geen (alle rollen) |
| `account` → `team` | `adminOnly: true` (ongewijzigd) |
| `business` → company, branding, domain | `settings_general` |
| `webshop` → webshop-general | `settings_general` |
| `financial` → tax, vat_rates, invoicing, peppol, compliance | `settings_financial` |
| `payments` → payments, transactions | `settings_financial` |
| `returns` → return-settings | `settings_general` |
| `channels` → shop-notifications, customer-communication, inbound-email | `settings_general` |
| `channels` → ai-assistant, whatsapp, newsletter, social, reviews | `marketing` |
| `channels` → fulfillment-api | `adminOnly: true` (ongewijzigd) |

Zichtbaarheid per rol: "Mijn profiel" staat voor **alle zeven** rollen in de navigatie
(geen `requiredRead`, geen `adminOnly`). `platform_admin`/`tenant_admin` zien alles;
`viewer` ziet profiel + business/webshop/returns/channels-algemeen; `accountant` ziet
profiel + financial/payments; `marketing` ziet profiel + de vijf marketingkanalen;
`staff` en `warehouse` zien enkel profiel (geen `settings_general`/`settings_financial`/
`marketing`-read).

**Security-keuzes.** Puur frontend. Geen migratie, geen policy-, grant- of functiewijziging.
De RLS blijft bepalend voor wat werkelijk gelezen/geschreven wordt.
`AccountSettings.tsx` bevat geen eigen `useCan`-checks; er hoefde niets weggehaald te worden.
`public.profiles` heeft `Users can update their own profile` (UPDATE, `id = auth.uid()`),
`Users can insert their own profile` (INSERT, `id = auth.uid()`) en een tenant-gescopeerde
SELECT-policy — een gebruiker mag zijn eigen rij dus bijwerken; geen migratie nodig.

**Gedeelde-paden-waarschuwing.** n.v.t. — geen storefront-api, checkout-engine of gedeelde
tabellen geraakt; custom frontends ongemoeid.

**Verificatie.** `tsgo --noEmit` groen (dekkingscontrole: elke verwijzing naar de oude
resource `reports` moest omgezet zijn om te compileren). JSON-parse op de vier
`landing.*.json` geldig, Duits gebruikt `„…“`. Migratie-telling
(`supabase_migrations.schema_migrations`) niet uitleesbaar met de leesrol
(`permission denied for schema supabase_migrations`) — er is in deze batch geen enkele
migratie uitgevoerd; alle wijzigingen zijn frontend plus één idempotente
`doc_articles`-update.

**Observatie.** `reports/stock` hing aan `reports`, een resource die `warehouse` juist
uitsluit, terwijl het voorraadrapport bij uitstek voor magazijnpersoneel is. Nu op `products`
(`read: ALL_ROLES`).

**Openstaand.**
- `products.write` sluit `marketing` uit, waardoor productbeschrijvingen en SEO-teksten niet
  aanpasbaar zijn terwijl dat marketingwerk is. Rol simpelweg toevoegen is ongewenst omdat
  `products` ook `price`, `cost_price`, `stock` en `sku` bevat; voorkeursrichting is een
  `BEFORE UPDATE`-trigger die wijziging van die velden blokkeert voor rol `marketing`.
  Aparte batch.
- `orders.read` staat op `ALL_ROLES` en geeft `marketing` inzage in het volledige
  klantenbestand inclusief adressen; overweging is dat toegang toggelbaar te maken via het
  bestaande `user_permission_grants`-mechanisme.
- De uitnodigingsflow (`InviteTeamMemberDialog`) kent alleen `role`, geen recht. Het gewenste
  recht zou als kolom op `team_invitations` meegegeven moeten worden en bij acceptatie omgezet
  in een grant.
- Restrisico uit SEC-4 blijft staan: `tenants.iban` en `products.cost_price` /
  `product_variants.cost_price` zijn leesbaar voor alle tenant-rollen (zie `product_costs`-
  notitie SEC-2a).
- **Actie voor Akke:** newsletter-item `2026.10c` staat in `docs/newsletter-queue.md` onder
  *Openstaand*; er is nog geen wachtrijtabel, dus verzenden gebeurt handmatig.

**Rollback.** Volledig frontend; `git revert` van de gewijzigde bestanden volstaat.
Concreet: `profile`, `reports_financial` en `reports_analytics` uit `PERMISSION_MATRIX`
verwijderen en `reports: { read: ALL_ROLES.filter((r) => r !== "warehouse"), write: [] }`
terugzetten; in `src/App.tsx` de drie rapportroutes en `settings`/`notifications` terug op
respectievelijk `requireRead="reports"` en `requireRead="settings_general"`;
`requiredRead` en `isSectionPermitted` uit `Settings.tsx` halen; sidebar-entries terug op
`requireRead: 'reports'`; `OrderBulkActions` terug op `useCan('read','reports')`.
Het bijgewerkte `doc_articles`-artikel `teamleden-rollen` wordt met een nieuwe idempotente
`UPDATE` teruggezet.

## SEC-4 — promotietabellen achter het per-gebruiker recht + twee tenant-blinde reads — 18 augustus 2026

**Root cause** — `PERM-1` zette uitsluitend `discount_codes` achter het per-gebruiker recht (`has_permission_grant(auth.uid(), tenant_id, 'discount_codes')`). De zeven promotietabellen met dezelfde financiële impact bleven onvoorwaardelijk open voor `marketing`: een marketinggebruiker zonder het recht kon geen kortingscode aanmaken, maar wél een automatische korting van 100% op de hele catalogus, een BOGO- of cadeaupromotie, een stapelregel of een loyaliteitsprogramma. De maatregel was daarmee via een andere deur volledig te omzeilen. Daarnaast waren twee `SELECT`-policies tenant-blind (tenant wél, rol níet gecontroleerd) op tabellen met gevoelige waarden: `digital_deliveries.download_token` is een **bearer-token** waarmee een gekocht digitaal product te downloaden is, en `gift_card_transactions.balance_after` bevat saldomutaties van cadeaubonnen. Die laatste tabel is bij `SEC-2a` gemist toen `gift_cards` zelf op payments-niveau werd gezet.

**Uitgevoerd** (één migratie, alleen policies — geen schema-, functie- of grant-wijziging)
- Deel A — 21 write-policies (INSERT/UPDATE/DELETE) op `automatic_discounts`, `bogo_promotions`, `gift_promotions`, `discount_stacking_rules`, `loyalty_programs`, `volume_discounts` en `volume_discount_tiers` herbouwd. Het rolgedeelte `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing'])` is vervangen door dezelfde vorm die al op `discount_codes` staat: `tenant_admin`/`staff` onvoorwaardelijk, `marketing` alleen mét grant. Policynamen ongewijzigd.
- `volume_discount_tiers` scopet via de bovenliggende `volume_discounts` en heeft geen eigen `tenant_id`; de `EXISTS`-constructie is volledig behouden en `vd.tenant_id` is als tenant-argument gebruikt voor zowel `has_tenant_role` als `has_permission_grant`.
- Deel B — `digital_deliveries` policy `Auth users can view tenant digital deliveries` en `gift_card_transactions` policy `Tenant users can view gift card transactions` kregen de `SEC-2a`-groep-B-rolcheck `ARRAY['tenant_admin','staff','accountant','viewer']`. Bij `gift_card_transactions` binnen de bestaande `EXISTS` op `gc.tenant_id`, zodat hij overeenkomt met wat `gift_cards` zelf sinds `SEC-2a` heeft. `marketing` en `warehouse` vallen af.
- Slottaken: changelog `2026.10b` / `promotion_permission_scope` (type `security`, NL/EN/FR/DE), helpartikel `teamleden-rollen` bijgewerkt, newsletter-item toegevoegd.

**Bewuste keuze** — de bestaande resource `'discount_codes'` is **hergebruikt**; er is géén tweede resource geïntroduceerd. Kortingscodes en promoties zijn voor de gebruiker één bevoegdheid ("mag kortingen maken"); één schakelaar die beide dekt is begrijpelijker dan twee die apart kunnen afwijken. Gevolg: de bestaande toggle in teambeheer blijft ongewijzigd en dekt dit automatisch mee — geen frontendwijziging nodig.

**Security-keuzes** — uitsluitend RLS-policies geraakt. `has_tenant_role`, `get_user_tenant_ids`, `is_platform_admin` en `has_permission_grant` zijn niet aangeraakt; hun `EXECUTE`-grants (bucket C) zijn nagetrokken en staan op `true` voor `authenticated`. `SELECT` op de promotietabellen is bewust ongemoeid: promoties mogen door alle tenant-rollen bekeken worden. De schrijfpolicies op `digital_deliveries` en `gift_card_transactions` waren al correct rolgescoped en zijn niet gewijzigd.

**Gedeelde-paden-waarschuwing** — de custom frontends lezen via `storefront-api` en `checkout-engine`, die met de service role draaien (`rolbypassrls = true`) en dus niet door tenant-RLS gaan. Promoties worden voor bezoekers server-side berekend; de policies hier gelden enkel voor ingelogde tenant-gebruikers in de admin. Geen tabel-, kolom- of contractwijziging, dus het `use_custom_frontend`-pad is byte-voor-byte identiek.

**Verificatie** — vier natrek-queries gedraaid:
1. Alle 21 promotie-write-policies op `via_toggle = true`.
2. `totaal = 21`, `met_admin = 21`, `met_staff = 21`, `met_grant = 21`.
3. `digital_deliveries` en `gift_card_transactions`: beide `rolcheck = true`, `bevat_marketing = false`.
4. Regressie: `discount_codes_writes = 3` (ongewijzigd), `bucketC_ok = true`, `helper_ok = true`.
Daarnaast `tsgo --noEmit` groen en alle vier `landing.*.json` valid JSON.

**Openstaand restrisico** (expliciet, bewust niet in deze batch)
- `tenants.iban` en `products.cost_price` / `product_variants.cost_price` blijven leesbaar voor **alle** tenant-rollen, inclusief `marketing`. Reden: die tabellen worden applicatiebreed gelezen (productlijsten, kassa, rapporten, storefront-hydratie) en staan in `PERMISSION_MATRIX` bewust op alle rollen. Afschermen vraagt kolomniveau-privileges (`REVOKE ... (cost_price)`) of een aparte view met een gefilterde kolomset; beide raken tientallen leespaden en vallen buiten deze batch. Zie de bestaande `product_costs`-notitie uit `SEC-2a`.
- Observatie (niet opgelost, buiten scope): `useCanWriteDiscountCodes()` schermt de promotie-UI (`AutoDiscounts`, `VolumeDiscounts`, `Bundles`, `GiftPromotions`) nog niet af. Marketing zonder grant ziet daar dus knoppen die nu door RLS geweigerd worden — functioneel veilig, maar UX-ruis. Aparte batch waard.

**Rollback** — afgeleid uit een inventarisatiequery vóór de wijziging (`pg_policies`), niet uit het hoofd. Zes van de zeven tabellen hadden exact hetzelfde patroon; `LABEL` per tabel: `auto discounts` (`automatic_discounts`), `bogo promotions`, `gift promotions`, `stacking rules` (`discount_stacking_rules`), `loyalty programs`, `volume discounts`.

```sql
-- Deel A, zes uniforme tabellen — per tabel de drie policies terug naar onvoorwaardelijk marketing
-- COND = ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) ))
--          AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
DROP POLICY "Marketing roles can insert <LABEL>" ON public.<TABEL>;
CREATE POLICY "Marketing roles can insert <LABEL>" ON public.<TABEL>
  FOR INSERT TO authenticated WITH CHECK (COND);
DROP POLICY "Marketing roles can update <LABEL>" ON public.<TABEL>;
CREATE POLICY "Marketing roles can update <LABEL>" ON public.<TABEL>
  FOR UPDATE TO authenticated USING (COND) WITH CHECK (COND);
DROP POLICY "Marketing roles can delete <LABEL>" ON public.<TABEL>;
CREATE POLICY "Marketing roles can delete <LABEL>" ON public.<TABEL>
  FOR DELETE TO authenticated USING (COND);

-- Deel A, volume_discount_tiers (EXISTS via bovenliggende tabel, geen eigen tenant_id)
-- TIERCOND = EXISTS ( SELECT 1 FROM volume_discounts vd
--   WHERE vd.id = volume_discount_tiers.volume_discount_id
--     AND has_tenant_role(vd.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
DROP POLICY "Marketing roles can insert volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can insert volume discount tiers" ON public.volume_discount_tiers
  FOR INSERT TO authenticated WITH CHECK (TIERCOND);
DROP POLICY "Marketing roles can update volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can update volume discount tiers" ON public.volume_discount_tiers
  FOR UPDATE TO authenticated USING (TIERCOND) WITH CHECK (TIERCOND);
DROP POLICY "Marketing roles can delete volume discount tiers" ON public.volume_discount_tiers;
CREATE POLICY "Marketing roles can delete volume discount tiers" ON public.volume_discount_tiers
  FOR DELETE TO authenticated USING (TIERCOND);

-- Deel B — de twee SELECT-policies zonder rolcheck
DROP POLICY "Auth users can view tenant digital deliveries" ON public.digital_deliveries;
CREATE POLICY "Auth users can view tenant digital deliveries" ON public.digital_deliveries
  FOR SELECT TO authenticated
  USING (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) ));

DROP POLICY "Tenant users can view gift card transactions" ON public.gift_card_transactions;
CREATE POLICY "Tenant users can view gift card transactions" ON public.gift_card_transactions
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM gift_cards gc
    WHERE gc.id = gift_card_transactions.gift_card_id
      AND gc.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) )));
```

**Openstaande actie voor Akke** — newsletter-item `2026.10b` staat in `docs/newsletter-queue.md` onder *Openstaand*; er is geen wachtrijtabel in de DB, dus verzending gebeurt handmatig (in lijn met SEC-3, SEC-2a en PERM-1).

---

## PAYPAL-REMOVE — PayPal-via-Stripe volledig teruggedraaid — 18 augustus 2026

**Root cause** — Stripe biedt `paypal_payments` niet aan voor SellQo's platformtype (SaaS met connected accounts die onder eigen naam verkopen). Bewezen via drie kanten: (1) `updateCapability` op VanXcel gaf `Unknown capability: paypal_payments`, (2) het Stripe-dashboard toont "only supported in v1 accounts" zonder actie, (3) de Stripe-docs sluiten platforms zoals Shopify/Squarespace expliciet uit. De PayPal-code uit PAYPAL-1a/1b kon dus nooit werken en beloofde tenants iets dat niet leverbaar is.

**Uitgevoerd**
- `src/components/admin/settings/PaymentSettings.tsx` — "PayPal toevoegen?"-infoblok, PayPal-tariefregel en PayPal in de methodes-samenvatting verwijderd; ongebruikte `useNavigate` opgeruimd (nergens anders gebruikt).
- `src/hooks/useStripeConnect.ts` — `paypal_capability_status` uit `ConnectStatus` verwijderd.
- `supabase/functions/check-connect-status/index.ts` — self-healing én self-adding PayPal-blok verwijderd, plus `paypal_capability_status` uit de response.
- `supabase/functions/_shared/stripe-fees.ts` — `case 'paypal'` en het PayPal-blok in `getAvailablePaymentMethods` verwijderd.
- `supabase/functions/storefront-api/index.ts` — uitsluitend `'paypal': 'paypal'` uit `stripeMethodMap` verwijderd.
- `supabase/functions/paypal-capability-recon/` — volledig verwijderd (eenmalige recon).
- `src/pages/public/PublicChangelog.tsx` — entry `2026.10b` / `paypal_checkout` verwijderd; `public.changelog.changes.paypal_checkout` uit `landing.{nl,en,fr,de}.json`.
- `docs/newsletter-queue.md` — nog niet verzonden PayPal-item verwijderd.
- DB — `DELETE FROM doc_articles WHERE slug = 'paypal-koppelen'`.

**Security-keuzes** — n.v.t. qua RLS/grants. Wel relevant: er zijn nu géén DB-writes op `tenants.stripe_payment_methods` meer vanuit `check-connect-status`; die function is voor betaalmethodes weer puur lezend.

**Gedeelde-paden-waarschuwing** — `stripe-fees.ts` en `storefront-api` zijn gedeeld met de vijf custom frontends. Veilig: er is uitsluitend een methode verwijderd die in geen enkel connected account actief kon zijn (`Unknown capability`). Het JSON-contract, de sleutelnamen, de VAT/reverse-charge- en discount-logica en de vijf echte methodes (ideal/bancontact/card/klarna/bank_transfer) zijn byte-voor-byte ongewijzigd.

**Verificatie** — `rg -i paypal` over `src/` en `supabase/`: geen treffers meer buiten de historische migratie en de `status: 'planned'`-vermelding op de publieke Integrations-pagina. Alle vier locale-JSON's parsen geldig. `tsgo --noEmit` groen. SQL-natrek: `doc_articles` bevat geen `paypal-koppelen`.

**Bewust ongemoeid / Vervolg** — De migratie `20260817203106_*.sql` blijft staan (historie, niet-destructief). De `paypal`-regel met status `planned` op `src/pages/public/Integrations.tsx` blijft: die belooft niets voor vandaag. Weg vooruit: PayPal via Mollie Connect for Platforms — apart traject, zie deepdive-document.

## PAYPAL-1b — PayPal capability-driven weergave + help-artikel — 17 augustus 2026

**Root cause** — PAYPAL-1a leverde enkel de neerwaartse helft van de capability-gate: `check-connect-status` verwijderde `'paypal'` uit `stripe_payment_methods` als `paypal_payments !== 'active'`, maar voegde het nooit toe wanneer een tenant PayPal wel activeerde in zijn eigen Stripe Dashboard. Gevolg: een tenant kon PayPal correct aanzetten bij Stripe en er in SellQo niets van merken, want de storefront gate't op de kolom. Bovendien toonde `PaymentSettings.tsx` PayPal nergens, dus was er ook geen signaal dat de methode bestond of hoe je hem activeert.

**Uitgevoerd**
- `supabase/functions/check-connect-status/index.ts` — self-adding tegenhanger in hetzelfde blok: `paypal_payments === 'active'` én `'paypal'` nog niet in de array → toevoegen via de service-role update, met expliciete log. Dezelfde `Array.isArray`-guard; schrijffout wordt gelogd, niet gethrowd. Netto-invariant: `'paypal'` staat in `stripe_payment_methods` dan en slechts dan als de capability actief is. Uitsluitend `'paypal'` wordt aangeraakt.
- `src/hooks/useStripeConnect.ts` — `paypal_capability_status?: string | null` toegevoegd aan `ConnectStatus` (veld bestond al in de response sinds 1a).
- `src/components/admin/settings/PaymentSettings.tsx` — read-only, additief: PayPal-regel (2,9% + €0,35) in de `rates`-array van Transactiekosten, `PayPal` in de betaalmethodes-samenvatting, en een subtiel informatieblok "PayPal toevoegen?" dat enkel verschijnt bij `charges_enabled && payouts_enabled && paypal_capability_status !== 'active'`, met link naar `/admin/help?article=paypal-koppelen`. Bewust GEEN aparte toggle — consistent met iDEAL/Bancontact, die ook puur capability-gedreven zijn.
- `doc_articles` — nieuw artikel `paypal-koppelen` (doc_level `tenant`, categorie Betalingen `a0000001-0000-0000-0000-000000000003`, `context_path` `/admin/settings`, `sort_order` 2), idempotent ingeschoten via `WHERE NOT EXISTS` op `(doc_level, slug)`.

**Security-keuzes** — Geen nieuwe tabel, kolom of policy. De self-adding-update loopt op hetzelfde service-role-pad als de bestaande self-healing, binnen een functie die de tenant al via `authenticateRequest` autoriseert; de tenant-id komt uit de geverifieerde request, niet uit de body-payload zonder check. De update raakt één jsonb-waarde en nooit een andere betaalmethode. De UI is strikt read-only: geen enkele mutatie op `stripe_payment_methods` vanaf de client.

**Gedeelde-paden-waarschuwing** — `storefront-api` en `_shared/stripe-fees.ts` zijn in deze batch NIET aangeraakt (die waren in 1a klaar). De vijf custom frontends renderen `available_payment_methods` dynamisch; PayPal verschijnt daar dus automatisch zodra de capability actief is, zonder contractwijziging. Geen sleutel in `content`/`settings` hernoemd of verwijderd.

**Verificatie** — `tsgo --noEmit` op de gewijzigde frontend-bestanden; edge function gedeployd; SQL-natrek dat `paypal-koppelen` bestaat met de juiste `category_id`/`doc_level`/`slug`; changelog-key `paypal_checkout` in alle vier locales gecontroleerd via een JSON-load.

**Bewust ongemoeid** — Stripe-connect/onboarding-flow, disconnect-dialog, country-select en payout-weergave. Geen migratie op `tenants`, geen nieuwe kolom.

## PAYPAL-1a — Backend PayPal-ondersteuning + capability-vangnet — 17 augustus 2026

**Root cause** — PayPal toevoegen als betaalmethode via Stripe Connect is puur additief op de edge functions, maar PayPal erft NIET automatisch naar bestaande connected accounts. Waar bancontact/ideal/card/klarna na standaard-onboarding direct werken, vereist PayPal een aparte capability (`paypal_payments`) die de tenant zelf moet activeren plus PayPal-specifieke onboarding moet doorlopen. Zonder vangnet zou de storefront PayPal blijven tonen (de methode staat in `stripe_payment_methods`) terwijl de charge faalt — een klant kiest PayPal, komt in een falende flow terecht, en de bestelling hangt. Vandaar de server-side self-healing in `check-connect-status`.

**Uitgevoerd**
- `supabase/functions/_shared/stripe-fees.ts`:
  - `calculateStripeFee`: nieuw `case 'paypal': return Math.round(amountCents * 0.029) + 35;` (2.9% + €0.35, EU PayPal-tarief). Geen bestaande case of default gewijzigd.
  - `getAvailablePaymentMethods`: nieuw PayPal-block direct NA het `card`-block, identiek gestructureerd, gated op `hasStripe && stripeMethods.includes('paypal')`. De `klarna`- en `bank_transfer`-blocks staan ongewijzigd eronder.
- `supabase/functions/storefront-api/index.ts`:
  - `checkoutComplete`, `stripeMethodMap`: `'paypal': 'paypal',` toegevoegd. De `payment_method_types`-mapping in de Stripe Checkout-sessie dekt nu PayPal. Niets anders in `checkoutComplete` of elders gewijzigd — VAT/reverse-charge/discount/OSS-logica, de bank_transfer/QR-tak en de `stripe`-umbrella backward-compat onaangetast.
- `supabase/functions/check-connect-status/index.ts`:
  - `select` uitgebreid met `stripe_payment_methods` (was al aanwezig op de tenants-tabel, enkel nu mee-opgehaald).
  - Capability-vangnet NA de status-sync: leest `account.capabilities?.paypal_payments`; als `'paypal'` in de tenant-array staat maar de capability ≠ `'active'`, verwijdert een service-role update uitsluitend `'paypal'` uit `stripe_payment_methods` en logt dit expliciet. Andere methodes worden nooit aangeraakt; charges_enabled/payouts_enabled/onboarding-logica ongewijzigd.
  - Response uitgebreid met `paypal_capability_status: account.capabilities?.paypal_payments ?? null`. De bestaande `capabilities`-key blijft staan.

**Security-keuzes**
- De self-healing update loopt via `SUPABASE_SERVICE_ROLE_KEY` op de tenants-tabel, net als de bestaande status-sync in dezelfde functie. Geen nieuw RLS-beleid of grant nodig — de tabel is al toegankelijk voor de service role.
- Alleen `'paypal'` wordt verwijderd; een `filter((m) => m !== 'paypal')` garandeert dat geen andere methode per ongeluk verdwijnt. Bij een schrijffout wordt gelogd maar geen exception gegooid, zodat de status-check nooit faalt op het vangnet.
- `paypal_capability_status` in de response is read-only info voor het admin-UI (PAYPAL-1b); geen privilege-escalatie-vector.

**Gedeelde-paden-waarschuwing**
- `storefront-api` is een gedeeld pad (de vijf custom frontends lezen `available_payment_methods` dynamisch). De wijziging is strikt additief: een nieuwe key in `stripeMethodMap` en een nieuw block in `getAvailablePaymentMethods`. Bestaande keys, het JSON-contract van `content`/`settings`, en de bank_transfer/QR-tak zijn ongewijzigd. Custom frontends die PayPal niet in hun `stripe_payment_methods` hebben, zien geen verschil — het block is gated op `stripeMethods.includes('paypal')`. Geen React-component gedeeld of gewijzigd.
- `check-connect-status` is admin-only (JWT + `requireRole(['tenant_admin','staff'])`); custom frontends callen deze niet. Het vangnet draait dus uitsluitend wanneer een tenant zelf de status opvraagt.

**Verificatie**
- `get_diff` toont exact drie edge-function-bestanden + deze role-audit-entry.
- `calculateStripeFee(cartTotalCents, 'paypal')` geeft 2.9% + 35 cent; bestaande cases ongewijzigd (handmatig nagetrokken).
- `stripeMethodMap` bevat nu zes entries; de `isStripeMethod`-check en `payment_method_types`-propagatie werken ongewijzigd voor de andere methodes.
- Self-healing: `Array.isArray`-guard voorkomt crash op `null`/ontbrekende `stripe_payment_methods`; filter raakt uitsluitend `'paypal'`.
- `paypal_capability_status` staat in de 200-response naast `capabilities` (niet vervangen).

**Bewust ongemoeid / Vervolg**
- GEEN changelog-entry en GEEN newsletter-item in deze batch — bewust geparkeerd tot PAYPAL-1b (toggle-UI in het admin + handleiding), want zonder toggle-UI kan een tenant hier nog niks mee.
- GEEN nieuwe DB-kolom en GEEN migratie — `stripe_payment_methods` (jsonb array) bestaat al; PayPal is gewoon een nieuwe waarde erin.
- GEEN frontend-/src-wijziging — `useStripeConnect.ts`, de checkout-UI en de storefront-renderer worden in PAYPAL-1b aangeraakt.
- De vijf custom frontends renderen `available_payment_methods` dynamisch en worden in deze batch NIET aangeraakt; hun PayPal-weergave hangt af van hun eigen renderer, niet van dit contract.
- Custom-frontend smoke-checks (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) zijn hier niet uitvoerbaar; het contract is ongewijzigd bewezen door de additieve diff.

---

## MANDATE-CTX-1 — bedrag, reden en interval op manuele SEPA-machtigingen — 17 augustus 2026

**Root cause** — `supabase/functions/create-mandate-setup/index.ts` mintte het mandaat-token zonder `context` (insert in `mandate_setup_tokens`, r.102-107 oud). `mandate-setup-info` geeft `tok.context ?? null` door, dus de machtigingspagina (`src/pages/MandateActivation.tsx`) kreeg `context: null` en rekende `contextLine` weg (`if (!ctx?.plan_name) return null`). Het `mb-4`-infoblok stond achter `{contextLine && ...}`, waardoor de klant enkel het Stripe PaymentElement + de generieke `mandate.sepa_mandate_text` zag: een machtiging zonder bedrag, reden of interval. Het platformpad (`create-platform-mandate-setup`) vulde de context wél en was dus niet getroffen.

**Uitgevoerd**
- `src/pages/admin/Subscriptions.tsx` — `handleCreateMandateLink` heeft een optionele derde parameter `subscriptionId?: string`; invoke-body is nu `{ customer_id, subscription_id }`. Beide knop-aanroepen (r.310 en r.456) geven `sub.id` mee.
- `supabase/functions/create-mandate-setup/index.ts` — optioneel `subscription_id` uit de body. Bij aanwezigheid: subscription + `subscription_lines(description, quantity, unit_price, vat_rate, sort_order)` geladen, guard op `subscription.tenant_id === tenant.id` EN `subscription.customer_id === customer.id`; bij mismatch context = null en géén error (link blijft altijd aanmaakbaar). Bedrag exact volgens de pay_first-rekenwijze van `generate-subscription-invoices` (per line `net = qty * unit_price`, `vat = +(net*rate/100).toFixed(2)`, sommen `.toFixed(2)`, `total = +(subtotal+vat).toFixed(2)`). Context: `{ source:'subscription', creditor: tenant.name, reason: eerste line-description (fallback subscription.name), price: total incl. btw, interval, interval_count }`, meegeschreven in de token-insert. Tenant-select uitgebreid met `name`. Zonder `subscription_id` blijft het gedrag identiek.
- `src/pages/MandateActivation.tsx` — `Info['context']` uitgebreid met `source`, `creditor`, `reason` en interval `weekly|monthly|quarterly|yearly`. Nieuwe tak in `contextLine` voor `source === 'subscription'` (key `mandate.context.line_generic`, bedrag via `Intl.NumberFormat`, periode `per_year` bij yearly, anders `per_month`); de platformtak (`plan_name`/`line`/`line_from`) is ongewijzigd. Vangnet: het `mb-4`-blok wordt nu altijd gerenderd; zonder bruikbare `contextLine` valt het terug op `mandate.context.recurring_no_amount` met de tenantnaam. `cancel_note` blijft onder beide varianten staan. **MANDATE-CTX-1b:** periode-bepaling vervangen door volledige interval+count-mapping: `interval_count` toegevoegd aan `Info['context']`; `per_week`/`per_quarter` en `_n`-meervoudskeys voor alle vier intervallen, zodat elk interval juridisch correct toont (bv. "per 2 weken" i.p.v. "per week").
- i18n — `mandate.context.line_generic`, `mandate.context.recurring_no_amount`, `per_week`, `per_quarter`, `per_week_n`, `per_month_n`, `per_quarter_n`, `per_year_n` toegevoegd in `nl/en/fr/de` (`per_month`/`per_year` bestonden al).
- Migratie — enkel een `INSERT ... ON CONFLICT` op `public.doc_articles` (helpartikel). Geen schemawijziging; kolom `context` bestond al.

**Security-keuzes** — geen RLS, policy of grant geraakt. De context wordt volledig server-side gebouwd met de service-role client, ná `authenticateRequest` + `requireRole(['tenant_admin','staff'])`. Cross-tenant lek uitgesloten door de dubbele guard op `tenant_id` én `customer_id`; een vreemd `subscription_id` levert stil geen context op. De context bevat alleen gegevens die de klant zelf hoort te zien (crediteur, reden, bedrag, interval).

**Gedeelde-paden-waarschuwing** — `mandate-setup-info` (publiek, gaf `context` al door) is niet gewijzigd; `create-platform-mandate-setup`, `mandate-setup-complete`, `generate-subscription-invoices` en de charge-engine bleven ongemoeid. De vijf custom frontends gebruiken dit pad niet: `create-mandate-setup` is een admin-functie met JWT-auth, `subscription_id` is optioneel en additief, en het JSON-contract van `mandate-setup-info` kreeg geen sleutelwijziging.

**Verificatie** — Rekenwijze nagetrokken op de live subscription "Domein: https://astrasleep.shop/" (1 x 50,00 @ 21%): `subtotal 50.00`, `vat 10.50`, `total 60.50` — gelijk aan `subscriptions.total` (60.50) en aan wat de pay_first-runner in `billing_cycles` zet. Dus het getoonde bedrag matcht de incasso, inclusief per-line afronding. Pad zonder `subscription_id`: context blijft `null` → vangnetregel. Platformpad ongewijzigd (tak op `plan_name` intact). `npx tsgo --noEmit -p tsconfig.app.json` exit 0; `create-mandate-setup` gedeployd; doc_articles-insert geslaagd.

**Bewust ongemoeid / Vervolg** — Bestaande, al gemintte tokens zonder context krijgen geen retro-context (ze vallen op het vangnet terug). **MANDATE-CTX-1b** sluit de openstaande notitie af: `weekly`/`quarterly` tonen nu hun eigen label, en `interval_count > 1` wordt correct als meervoud weergegeven.

## VIES-FIX — userError classificeren + retry — 17 augustus 2026

**Root cause** — `callVies` in `supabase/functions/_shared/vies.ts` (r.75-84 oud) las alleen `data.isValid` en negeerde `data.userError`. VIES antwoordt bij een geweigerde lidstaat-call met HTTP 200 + `isValid:false` + `userError:"MS_MAX_CONCURRENT_REQ"` en velden `name/address = "---"`. Die tijdelijke onbeschikbaarheid werd als "ongeldig BTW-nummer" getoond én 24u gecachet in `vat_validations` (`checkoutValidateVat`, storefront-api r.2427). BE heeft de per-lidstaat-concurrency-limiet, NL niet → BE faalde intermittent, NL nooit. Bewezen: `BE1017500207` gaf binnen 8s eerst `VALID` (BV NOMADIX) en daarna `MS_MAX_CONCURRENT_REQ`.

**Uitgevoerd**
- `supabase/functions/_shared/vies.ts` — `callViesOnce` (netwerk) losgetrokken van `classify` (interpretatie). Classificatie: `VALID` → geldig; `INVALID` → écht ongeldig; `INVALID_INPUT` → `error: 'Ongeldig BTW-nummer formaat'` zonder `service_unavailable` (retry helpt niet, maar wordt ook niet als `false` gecachet); al het andere (`MS_MAX_CONCURRENT_REQ`, `GLOBAL_MAX_CONCURRENT_REQ`, `MS_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, onbekend) → `service_unavailable: true`. Ontbreekt `userError`, dan gedraagt de helper zich exact als voorheen (achterwaartse compatibiliteit). Retry: max 2 extra pogingen met backoff 400ms + 1000ms, alleen bij niet-definitieve uitkomsten; totale extra tijd < 1,5s.
- `supabase/functions/storefront-api/index.ts` — na de `service_unavailable`-guard een extra guard op `vies.error`: niet-definitieve uitkomsten geven `VALIDATION_ERROR` terug en schrijven niets in `vat_validations`. Alleen `VALID`/`INVALID` wordt nog gecachet.
- `supabase/functions/validate-vat/index.ts` — geeft bij een foutuitkomst nu `service_unavailable` + `definitive: false` terug (en `definitive: true` bij een definitieve uitkomst).
- `src/hooks/useVatValidation.ts` — logt niet-definitieve uitkomsten, invoke-fouten en onbekende fouten niet meer weg als `is_valid=false`.
- Eenmalige opschoning (migratie): `DELETE FROM public.vat_validations WHERE country_code='BE' AND is_valid=false AND (company_name='---' OR company_name IS NULL)` — 4 rijen: `BE1017500207` (2x, 14 en 17 aug), `BE0123456749`, `BE0888888888`.

**Security-keuzes** — n.v.t.: geen RLS, policies of grants geraakt. De opschoning is een gerichte DELETE op cache-rijen, geen schemawijziging.

**Gedeelde-paden-waarschuwing** — `_shared/vies.ts` en `storefront-api` zijn gedeeld met de vijf custom frontends. Het JSON-contract van `checkout_validate_vat` is onveranderd: `VALID`/`INVALID` geven exact dezelfde respons als voorheen. Nieuw is alleen dat een geweigerde call nu `VIES_UNAVAILABLE` (bestaande foutcode, bestaand pad r.2422) of `VALIDATION_ERROR` teruggeeft in plaats van een onterecht `valid:false`. Geen kolom, sleutel of statuscode hernoemd of verwijderd.

**Verificatie** — Live VIES: `BE1017500207` → `valid:true`, "BV NOMADIX"; `BE0417497106` → `valid:true`, "NV Anheuser-Busch InBev"; `BE0000000000` → `userError:INVALID` → nette `valid:false`; `NL866104136B01` → `valid:true`, "RESPONDO B.V.". Gestubde retry-test: 3x `MS_MAX_CONCURRENT_REQ` → `service_unavailable:true` in 1406ms (3 calls, geen `valid:false`); busy→VALID → `valid:true` na 2 calls; `INVALID_INPUT` → 1 call, geen retry. Na de tests staan er nul BE-rijen met `is_valid=false` in `vat_validations`. `npx tsgo --noEmit -p tsconfig.app.json` exit 0. Functies `storefront-api` + `validate-vat` gedeployd.

**Bewust ongemoeid / Vervolg** — Cache-TTL (24u) en de rate-limit (10/tenant/minuut) niet aangepast. Changelog-entry (bugfix, B2B-checkout betrouwbaarder) staat klaar voor de gebundelde slottaakronde; docs/newsletter niet nodig.

## EARLY-BIRD FASE D — Admin-UI early-bird per event — 15 augustus 2026

**Doel** — Een tenant kan early-bird per event instellen (prijs, deadline, aantal) in de datum-editor, zonder SQL. Strikt additief, alleen admin: storefront, betaalpad en custom frontends zijn niet geraakt.

**Root cause** — Fase A t/m C leverden schema, betaalkant en toonkant, maar `early_bird_price / early_bird_deadline / early_bird_quantity` werden nog handmatig via SQL gezet. Er was geen UI-pad.

**Uitgevoerd**
- `src/lib/eventTime.ts` (nieuw) — `tzOffsetMs` + `zonedToUtc` 1-op-1 geport uit `supabase/functions/storefront-api/index.ts` (r.53-80), inclusief de twee-passes DST-correctie, plus de omgekeerde `utcToZonedParts`. Bewust een port en geen tweede tz-lib: de opgeslagen deadline moet exact het moment zijn waar `resolveEventPrice` in de betaalkant tegen vergelijkt.
- `src/hooks/useEventDetails.ts` — `EventDetail` en `EventDateFormData` uitgebreid met de drie early-bird-velden (`select('*')` haalde ze al op).
- `src/components/admin/products/ProductEventDatesTab.tsx` — `FormState`/`emptyForm`/`openEdit` uitgebreid; deadline in de UI gesplitst in Calendar + `type=time` (label "Europe/Brussels"), bij opslaan via `zonedToUtc` naar timestamptz, bij edit via `utcToZonedParts` terug. Nieuwe optionele prop `regularPrice`. Nieuwe sectie "Vroegboekkorting (optioneel)" met prijs, deadline datum+tijd (wisbaar) en max. aantal, plus de "vroegste grens wint"-uitleg.
- `src/pages/admin/ProductForm.tsx` — `regularPrice={Number(form.watch('price')) || 0}` doorgegeven, dus ook een nog niet opgeslagen prijs voedt de waarschuwing.

**Null om uit te zetten** — `handleSubmit` stuurt de drie keys altijd expliciet mee. Prijs leeg → alle drie `null` (early-bird uit). Prijs gezet maar deadline leeg → `early_bird_deadline` null (alleen aantalgrens). Aantal leeg → `early_bird_quantity` null (alleen deadline).

**Validatie (inline, bestaande `canSave`-stijl, geen zod)** — Harde blokkades: deadline in het verleden, aantal ≤ 0 indien ingevuld, prijs < 0. Zachte waarschuwing (opslaan mag): `early_bird_price >= regularPrice`.

**Security-keuzes** — n.v.t. Geen nieuwe tabellen, policies of grants; de bestaande tenant-scoped RLS op `event_details` en de mutaties uit `useEventDetails` zijn ongewijzigd.

**Gedeelde-paden-waarschuwing** — Geen. `storefront-api`, `checkout-engine` en `storefront-resolve` zijn niet aangeraakt; het JSON-contract uit fase C blijft byte-identiek. De tz-logica is een port, dus de admin schrijft precies het moment dat de betaalkant leest.

**Verificatie**
- tz-bewijs: `zonedToUtc('2026-08-20','23:59','Europe/Brussels')` → `2026-08-20T21:59:00.000Z` (zomertijd, +2), heen-en-terug via `utcToZonedParts` → `2026-08-20 23:59`. Wintercontrole `2026-01-15 23:59` → `22:59Z` (+1), ook correct terug.
- DB-rondgang op testevent `17efe0cc…`: `early_bird_price=12`, `early_bird_deadline=2026-08-20 21:59:00+00` (= `2026-08-20 23:59` Brussel), `early_bird_quantity=20`; daarna alle drie terug op `null`. Testdata opgeruimd.
- `tsgo --noEmit -p tsconfig.app.json` → exit 0.

**Bewust ongemoeid** — Bulk plannen ("Plan meerdere datums") kent geen early-bird; buiten scope. Geen tijdzone-keuze in de UI: `row.timezone` bij edit, `Europe/Brussels` bij create (kolom-default), alleen als label getoond.

**Vervolg** — Slottaken (changelog 4 talen, `doc_articles`, newsletter-wachtrij) staan in een aparte ronde. UI-smoke op 390px is niet gedraaid: er was geen ingelogde preview-sessie beschikbaar (`signed_out`); de logica is via de tz-unit en de DB-rondgang bewezen.

## EARLY-BIRD FASE C-CORE — getProduct geeft per-event prijs terug — 15 augustus 2026

**Doel** — De toonkant: `getProduct` geeft per upcoming-event de huidige prijs (early-bird of regulier) terug via dezelfde `resolveEventPrice`-helper als fase B, zodat toon en betaal niet kunnen divergeren. Dicht de desync die fase B expliciet flagde.

**Root cause / aanleiding** — `getProduct` (`supabase/functions/storefront-api/index.ts`) selecteerde de early-bird-kolommen niet en gaf per event alleen `tickets_sold`, `spots_left` en `min_reached` terug. De storefront toonde dus `product.price` terwijl `cartAddItem` sinds fase B al de early-bird-prijs rekende.

**Uitgevoerd** — één bestand, `supabase/functions/storefront-api/index.ts`, strikt binnen `if (product.product_type === 'ticket')`:
- r.597: event-select uitgebreid met `early_bird_price, early_bird_deadline, early_bird_quantity`. Filters, `eventQueryLowerBound()`, status-exclusie en ordering ongewijzigd.
- r.606-634: de `withCounts`-map herschreven naar **expliciete mapping (optie A)**; de `...e`-spread is verwijderd. Bestaande sleutels ongewijzigd doorgegeven (`id, event_date, start_time, end_time, meeting_point, location_name, capacity, min_attendees, status, timezone`) plus de bestaande berekende sleutels (`tickets_sold, spots_left, min_reached`).
- Nieuwe additieve sleutels via `const pr = resolveEventPrice(e, product.price, sold, new Date())`: `current_price`, `early_bird_active`, `early_bird_price`, `spots_left_at_early_bird`, `early_bird_deadline`.
- `early_bird_quantity` wordt **bewust niet** geëxposeerd (interne grens; `spots_left_at_early_bird` geeft de bruikbare informatie).
- Top-level `price` (r.626 oud) blijft `product.price` — ongewijzigd.

**Security-keuzes** — Geen RLS, policies of grants geraakt. De expliciete mapping is zelf een security-verbetering: de vorige `...e`-spread lekte automatisch elke nieuwe `event_details`-kolom naar de publieke respons; dat kan nu niet meer.

**Gedeelde-paden-waarschuwing** — `storefront-api` bedient vijf custom frontends. Geen bestaande JSON-sleutel is gewijzigd, hernoemd of verwijderd; enkel vijf nieuwe sleutels per event-object. Het blok draait alleen voor `product_type === 'ticket'`; de vijf custom-frontend-tenants verkopen geen tickets, dus hun pad wordt niet eens betreden. Dezelfde helper als fase B → toon en betaal zijn structureel gekoppeld.

**Verificatie** (live tegen gedeployde functie, testevent `17efe0cc-e8ec-45b8-b2c6-6d72122249bd`, product `1daee896-a794-4076-b41e-8f511305f2a6`, regulier € 19,00):
- `early_bird_price` NULL: `current_price` 19, `early_bird_active` false, `early_bird_price` null; top-level `price` 19.
- Early bird € 12,00 zonder grenzen: `current_price` 12, `early_bird_active` true, `early_bird_price` 12, `spots_left_at_early_bird` null; top-level `price` blijft 19.
- Betaalpariteit: `cart_add_item` op hetzelfde event gaf `unit_price` 12 — gelijk aan `current_price`.
- Deadline `2026-08-01` (verleden): `current_price` 19, `early_bird_active` false, `early_bird_price` 12.
- Sleutelset gecontroleerd: alle 13 bestaande sleutels aanwezig, `early_bird_quantity` **niet** aanwezig.
- Niet-ticket product (Demo Bakkerij `dab379a8…`): `price` 29.99, geen `event`-sleutel — byte-identiek.
- Opruiming: early-bird-kolommen terug op NULL, testcart verwijderd. `npx tsgo --noEmit` exit 0.

**Bewust ongemoeid / Vervolg** — Het `getProducts`-lijstpad is niet aangeraakt (geen counts, geen per-event RPC; early-bird in de lijst zou N extra RPC-calls kosten) → optionele fase C-bis. Admin-UI voor het invullen van de early-bird-velden staat nog open. Geen changelog/newsletter/doc_articles-werk in deze fase, conform opdracht.

---

## EARLY-BIRD FASE B — resolveEventPrice inhaken in cartAddItem — 14 augustus 2026

**Doel** — De betaalkant: de ticketprijs op de cart-regel volgt de early-bird-regel uit fase A. `resolveEventPrice` is daarmee geen dode code meer.

**Root cause / aanleiding** — `cartAddItem` (`supabase/functions/storefront-api/index.ts`) zette de cart-regelprijs onvoorwaardelijk op `product.price` (r.1537) en het event-validatieblok selecteerde alleen `id, product_id, tenant_id, status`. De early-bird-kolommen uit fase A werden dus nergens gelezen.

**Uitgevoerd** — één bestand, `supabase/functions/storefront-api/index.ts`, strikt binnen de `if (eventDetailId)`-tak:
- r.1553: event-select uitgebreid met `early_bird_price, early_bird_deadline, early_bird_quantity`. Filters (`id`/`product_id`/`tenant_id`) en de status-check (`scheduled`/`confirmed`) ongewijzigd.
- r.1562-1568 (na de status-check): `get_event_signup_count(p_event_detail_id)` opgehaald → `sold` (fallback 0 bij niet-numeriek), en `unitPrice = resolveEventPrice(eventDetail, product.price, sold, new Date()).price` — **achter een `if (!variantId)`-guard**, zodat de variant-prijs-tak semantisch onaangeroerd blijft.
- Niets anders aangeraakt: r.1537 (`unitPrice = product.price`), de variant-tak (r.1541-1548), de stock-check (r.1571), de merge-tak (r.1594) en de insert (r.1597) lezen `unitPrice` en zijn dus automatisch consistent — de override staat vóór beide takken.

**Gedeelde-paden-waarschuwing** — `storefront-api` bedient vijf custom frontends. De wijziging zit volledig binnen de ticket-tak: een item zonder `event_detail_id` doorloopt exact hetzelfde codepad als vóór deze fase. Het JSON-contract is ongewijzigd (geen nieuwe of hernoemde sleutels in de cart-response); enkel de waarde van `unit_price` kan afwijken, en alleen voor ticketproducten mét early-bird-configuratie.

**Verificatie** (live tegen de gedeployde functie; testevent `17efe0cc…`, regulier € 19,00, early bird € 12,00)
- **Niet-ticket byte-identiek** (belangrijkste regressietest): Demo Bakkerij-product zonder `event_detail_id`, prijs 29.99 → `unit_price` = **29.99**, exact `product.price`.
- early_bird_price gezet, geen deadline/quantity → **12.00**.
- merge: zelfde ticket 2× toevoegen → `quantity = 2`, `unit_price = 12.00` (beide keren de early-bird-prijs).
- deadline in het verleden (2026-08-01) → **19.00**.
- `quantity = 1`, `sold = 0` (onder de grens) → **12.00**.
- `quantity = 0`, `sold = 0` (grens bereikt, deadline in de toekomst) → **19.00** — vroegste grens wint.
- Opruiming met gewone `DELETE` (geen migratie): 5 testcarts + hun items weg, `early_bird_*` op het testevent terug op `NULL`. Natrek: 0 achtergebleven carts, 0 achtergebleven items, event-rij weer volledig `NULL`.
- `npx tsgo --noEmit -p tsconfig.app.json` → 0 fouten.

**FLAG — tijdelijke toon/betaal-desync** — `getProduct` is deze fase NIET aangeraakt (dat is fase C). De storefront toont dus nog de reguliere prijs terwijl de betaalde prijs al early-bird-correct is. Niet tenant-zichtbaar: zolang geen enkel event `early_bird_price` gevuld heeft, is er geen verschil. Vul dus geen early-bird-prijzen in vóór fase C live is.

**Bewust ongemoeid** — `getProduct`, variant-prijs-logica, stock-check, checkout/Stripe-pad, admin-UI (fase D).

## EARLY-BIRD FASE A — schema + gedeelde prijs-helper — 14 augustus 2026

**Doel** — Fundament voor echte early-bird-prijzen op event-tickets. Deze fase raakt géén live prijsbepaling: schema additief + één pure helper die (nog) nergens aangeroepen wordt.

**Root cause / aanleiding** — Er bestond geen enkele plek waar een afwijkende ticketprijs per event-datum kon staan: `cartAddItem` (`supabase/functions/storefront-api/index.ts` r.~1501) neemt `product.price`, en het event-validatieblok (r.~1515-1525) selecteert alleen `id, product_id, tenant_id, status`. `getProduct` (r.~559-583) toont enkel `product.price` + tellers. Zonder kolommen én zonder gedeelde regel zouden fase B (betalen) en fase C (tonen) uiteen kunnen lopen.

**Uitgevoerd**
- Migratie op `public.event_details`, `ADD COLUMN IF NOT EXISTS`, geen bestaande kolom aangeraakt:
  - `early_bird_price numeric NULL` — null = geen early bird op dit event
  - `early_bird_deadline timestamptz NULL` — null = geen tijd-grens
  - `early_bird_quantity integer NULL` — null = geen aantal-grens
  Met `COMMENT ON COLUMN` per kolom en een DOWN-instructie in commentaar (drie `DROP COLUMN`).
- `supabase/functions/storefront-api/index.ts`: `interface EarlyBirdEvent` + `resolveEventPrice(event, regularPrice, ticketsSold, now)` toegevoegd, direct boven `isEventStillOpen`. Puur: geen DB-call, alle input meegegeven. Retourneert `{ price, earlyBirdActive, spotsLeftAtEarlyBird }`.
  - Regel: actief ⟺ `early_bird_price != null` AND (`deadline == null` OR `now < new Date(deadline)`) AND (`quantity == null` OR `ticketsSold < quantity`). Vroegste grens wint.
  - `spotsLeftAtEarlyBird = quantity == null ? null : max(0, quantity - ticketsSold)` — ook gevuld als early bird niet meer actief is (0), zodat fase C dat kan tonen.
  - `early_bird_price` wordt door `Number()` gehaald: Postgres `numeric` komt via PostgREST als string terug.

**Keuze: deadline = timestamptz, géén tijdzone-conversie hier**
`early_bird_deadline` is een absoluut moment, dus de vergelijking is simpelweg `now < new Date(deadline)`. De 6a-1-helpers (`tzOffsetMs`, `zonedToUtc`) zijn bewust NIET gebruikt: die zetten een lokale `date + time` om naar een instant, en toepassen op een timestamptz zou dubbel converteren (fout ter grootte van de UTC-offset, DST-afhankelijk). Het omzetten van tenant-invoer (lokale datum+tijd in de event-tijdzone) naar timestamptz hoort in de admin-UI van fase D. `event.timezone` wordt deze fase alleen voor weergave/rapportage gebruikt, niet in de resolver.

**Security-keuzes** — n.v.t. voor RLS/policies/grants: geen nieuwe tabel, geen policy-wijziging. `event_details` behoudt z'n bestaande tenant-scoped RLS; de drie nieuwe kolommen erven die policies automatisch. Wel bewust: `storefront-api` selecteert kolommen expliciet (geen `select('*')` op `event_details`), dus de nieuwe kolommen lekken pas naar de publieke API zodra fase C ze expliciet toevoegt — en dat is prijsinformatie, dus publiek acceptabel.

**Gedeelde-paden-waarschuwing** — `storefront-api` is een gedeeld pad (vijf custom-frontend tenants). Deze fase voegt daar uitsluitend een niet-aangeroepen functie + interface toe: geen bestaande functie gewijzigd, geen respons-veld toegevoegd of hernoemd, geen JSON-contract geraakt. `cartAddItem` en `getProduct` zijn byte-voor-byte ongewijzigd. `checkout-engine` en `storefront-resolve` niet aangeraakt.

**Verificatie**
- Pre-flight: `information_schema.columns` op `event_details` → 15 kolommen, geen `early_bird_*`.
- Post-flight: de drie kolommen bestaan; de enige bestaande rij (Fonske, `17efe0cc…`, 2026-08-21, cap 40, `scheduled`) heeft alle drie `null` en overige waarden ongewijzigd.
- Unit-bewijs van de helper (geïsoleerd via Bun, `now = 2026-08-14T17:00:00Z`):

```
1 geen early_bird_price                {"price":25,"earlyBirdActive":false,"spotsLeftAtEarlyBird":null}
2 price 18, geen deadline/quantity     {"price":18,"earlyBirdActive":true,"spotsLeftAtEarlyBird":null}
3 deadline verleden                    {"price":25,"earlyBirdActive":false,"spotsLeftAtEarlyBird":null}
4 deadline toekomst                    {"price":18,"earlyBirdActive":true,"spotsLeftAtEarlyBird":null}
5 quantity 20, sold 19                 {"price":18,"earlyBirdActive":true,"spotsLeftAtEarlyBird":1}
6 quantity 20, sold 20                 {"price":25,"earlyBirdActive":false,"spotsLeftAtEarlyBird":0}
7 deadline toekomst + sold>=quantity   {"price":25,"earlyBirdActive":false,"spotsLeftAtEarlyBird":0}
```
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0, 0 fouten.

**Bewust ongemoeid** — Geen changelog-entry, geen newsletter-item, geen `doc_articles` (afgesproken: pas wanneer de feature tenant-zichtbaar wordt). Geen admin-UI, geen types-regeneratie-afhankelijke code.

**Vervolg** — Fase B: `resolveEventPrice` aanroepen in `cartAddItem` (event-select uitbreiden met `early_bird_*` + `ticketsSold` via `get_event_signup_count`). Fase C: prijs + `earlyBirdActive` + `spotsLeftAtEarlyBird` in `getProduct`. Fase D: admin-UI met lokale datum+tijd → timestamptz-conversie in de event-tijdzone.

## EVENT-DASHBOARD — event-centrisch admin-overzicht — 14 augustus 2026

**Doel** — Een tenant kon de stand van z'n events (crawls) alleen zien door in het PRODUCT te duiken (`ProductEventDatesTab`). Nieuwe view `/admin/events` toont per event de bezetting, check-ins en de deelnemerslijst.

**Uitgevoerd** (puur additief — geen schema-wijziging, geen storefront-api-wijziging)
- `src/pages/admin/EventDashboard.tsx` (nieuw): overzichtskaarten (productnaam, datum+tijd, locatie/meeting point, `Progress` verkocht/capaciteit, ingecheckt-teller, statusbadge, min_attendees-indicatie met ✓) en een detailweergave met kern-stats (capaciteit/verkocht/ingecheckt/plaatsen vrij) plus deelnemerslijst (tabel ≥768px, kaarten daaronder voor 390px). Geen CSV-export (bewust buiten scope).
- `src/App.tsx`: route `events` met dezelfde `RouteGuard requireRole={['tenant_admin','staff']}` als `/admin/checkin`.
- `src/components/admin/sidebar/sidebarConfig.ts`: item `event-dashboard` ("Events", `CalendarDays`) direct naast `ticket-checkin`, `allowedRoles` identiek (`platform_admin`, `tenant_admin`, `staff`).

**Data-laag: directe client-queries, GEEN SECURITY DEFINER RPC**
Een RPC zou service-role draaien en dus RLS omzeilen; de tenant-scope zou dan afhangen van een correct meegegeven `p_tenant_id`-parameter, met een nieuw bypass-oppervlak op data die kopers-emails en -namen bevat. Directe queries erven de bestaande RLS, die op alle drie de gelezen tabellen tenant-scoped is:
- `event_details`: `event_details_select_tenant` — `tenant_id IN get_user_tenant_ids(auth.uid()) AND has_tenant_role(tenant_id, ['tenant_admin','staff'])`
- `ticket_instances`: `ticket_instances_select_tenant` — identieke conditie
- `orders`: `Auth users can view tenant orders` — `tenant_id IN get_user_tenant_ids(auth.uid())`
Daarbovenop filtert elke query expliciet `.eq('tenant_id', currentTenant.id)` als tweede slot. Een lek zou dus zowel een RLS-fout als een clientfout vereisen.

**N+1-mitigatie** — De overzichtstellers komen uit ÉÉN select op `ticket_instances` (`event_detail_id, status`) voor alle event-ids in het venster; aggregatie (verkocht = `valid|checked_in`, ingecheckt = `checked_in`, refunded = `refunded|cancelled`) gebeurt client-side, patroon van `useEventSignupCounts`. Geen count-query per event. Deelnemerslijst is één select met embedded `orders(order_number, customer_email)`; beide tabellen zijn tenant-scoped, dus de join kan nooit een andere tenant tonen.

**MIDDERNACHT** — Ondergrens `event_date >= vandaag - 2 dagen`, geen "vandaag"-afkap; events die over middernacht lopen (21:00 → 03:00) blijven zichtbaar. Identiek aan `TicketCheckin.tsx`.

**Security-keuzes** — Geen nieuwe policies, grants of functies. Een `platform_admin` zonder tenant-rol ziet het dashboard niet (RLS op `event_details`/`ticket_instances` vereist `has_tenant_role`); dat is bewust identiek aan de bestaande check-in-pagina. Een bypass is expliciet niet gebouwd en gaat, indien gewenst, als aparte batch.

**Gedeelde-paden-waarschuwing** — n.v.t. Geen wijziging aan `storefront-api`, `checkout-engine`, `storefront-resolve` of aan gedeelde tabellen; de vijf custom frontends merken hier niets van. Alleen admin-frontend en één routerregel.

**Verificatie** — `npx tsgo --noEmit -p tsconfig.app.json` → 0 fouten (na een volledige `bun install`; `node_modules` was leeg geraakt). Layout opgezet voor 390px (2-koloms stat-tiles, kaartweergave voor deelnemers).

**Bewust ongemoeid / Vervolg** — Geen CSV-export, geen platform-admin-bypass, geen changelog/newsletter/doc_articles (bundelt met de core-slottaakronde ná early-bird). De live end-to-end test met een tijdelijk €0-ticketproduct staat nog open: de sandbox-`psql` mag geen INSERT/DELETE uitvoeren, dus die test hoort in een aparte beurt met de juiste rechten.

## TICKET-1 fase 6b-fix — event_detail_id meekopiëren naar order_items (Gat D) — 14 augustus 2026

**Root cause** — In de gedeelde checkout van `supabase/functions/storefront-api/index.ts` viel `event_detail_id` weg tussen cart-item en order-item. Drie plekken in de `createOrderFromCart`-keten: de select in `getCartForCheckout` (r.1673) haalde het veld niet op, de cart-item-mapping (r.1696-1703) nam het niet mee, en de order-item-mapping in `createOrderFromCart` (r.2170-2184) schreef het niet weg. Gevolg: `order_items.event_detail_id = null` bij ticketaankopen → `issue_tickets_for_order` maakte 0 `ticket_instances` → klant kreeg geen QR-ticket. Op `storefront_cart_items` stond de waarde wél correct (fase 3.5). `checkoutVerifyPayment` (r.2963 select, r.3115 mapping) doet het al jaren correct en diende als referentie-implementatie.

**Uitgevoerd** (strikt additief — drie toevoegingen, geen bestaande regel gewijzigd)
- `supabase/functions/storefront-api/index.ts` r.1673 — `event_detail_id` toegevoegd aan de select uit `storefront_cart_items`.
- r.1699 — `event_detail_id: item.event_detail_id || null` toegevoegd aan het cart-item-object van `getCartForCheckout`.
- r.2182 — `event_detail_id: item.event_detail_id || null` toegevoegd aan de order-item-mapping in `createOrderFromCart`.

**Security-keuzes** — n.v.t. Geen RLS, policy, grant of rechtenwijziging; alleen een bestaande nullable kolom (`order_items.event_detail_id`, uuid) die nu gevuld wordt. Geen nieuwe tabel, geen nieuwe response-sleutel naar buiten.

**Gedeelde-paden-waarschuwing** — `createOrderFromCart` en `getCartForCheckout` bedienen de checkout van alle vijf custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) plus de SellQo-storefront, en beide betaalpaden: de €0-tak (r.2577) en de Stripe-tak (r.2744). Veilig omdat de wijziging puur additief is: een niet-ticket cart-item heeft `event_detail_id = null`, de `|| null` levert dan exact dezelfde waarde als de kolomdefault. Geen veld hernoemd, geen veld verwijderd, geen conditie aangepast. Het JSON-contract van `buildCartResponse` blijft ongewijzigd — `event_detail_id` komt alleen op het interne cart-item-object en in de DB-insert, niet in de frontend-response.

**Verificatie**
- `npx tsgo --noEmit -p tsconfig.app.json` → 0 fouten. `storefront-api` gedeployed.
- End-to-end tegen de live storefront-api (Fonske-tenant `95f6685b-…`), tijdelijk €0-ticketproduct met `track_inventory=false` + `event_detail`: `cart_create` → `cart_add_item` (met `event_detail_id`, qty 2) → `checkout_start` → `checkout_customer` → `checkout_complete` (`payment_method_id:'free'`) → order `#0001`, `payment_type:'none'`.
- SQL-natrek: `order_items.event_detail_id = b8bd65ca-…` (gevuld, was null vóór de fix) en 2 `ticket_instances` met status `valid` en 64-hex `qr_token`.
- Regressiecheck niet-ticket: identieke keten met een `physical` product → `order_items.event_detail_id = null`, 0 `ticket_instances`, geen fout. Byte-identiek gedrag.
- Alle testdata verwijderd: 2 tickets, 2 order_items, 2 orders, 2 facturen + 2 factuurregels, 6 cart-items, 6 carts, 1 event_detail, 2 producten, 2 testklanten. Natrek daarna: 0 achtergebleven records.

**Bewust ongemoeid / Vervolg** — `checkoutVerifyPayment` niet aangeraakt (deed het al correct). Geen changelog- of nieuwsbrief-entry: fase 6 bundelt de publieke communicatie.

---

## TICKET-1 fase 6a-1 — Middernacht-fix in storefront-api event-lijst — 14 augustus 2026

**Root cause** — De event-datumfilter in de gedeelde `storefront-api` kapte op de UTC-kalenderdag af: `.gte('event_date', new Date().toISOString().slice(0, 10))` op twee plekken — `getProduct` (detail, oude r.502) en `getProducts` (lijst, oude r.709). Een crawl die om 21:00 begint en tot 03:00 doorloopt verdween daardoor midden in het lopende event uit de storefront, zodra het in UTC "morgen" werd.

**Uitgevoerd** (strikt additief, alleen de ticket-tak)
- `supabase/functions/storefront-api/index.ts` — nieuwe helpers boven de promotion-utils: `eventQueryLowerBound()` (ondergrens = gisteren i.p.v. vandaag), `tzOffsetMs()`, `zonedToUtc()` (twee passes voor DST) en `isEventStillOpen()`. Eind van het venster = `event_date + end_time` (met +24u wanneer `end_time <= start_time`, dus over-middernacht), of `start_time + 8u` als `end_time` leeg is. Timezone uit de `timezone`-kolom, fallback `Europe/Brussels`.
- `getProduct`: query-ondergrens naar `eventQueryLowerBound()`, daarna `openEvents = events.filter(isEventStillOpen)` vóór het tellen. Response-key `event: { upcoming: [...] }` met `tickets_sold`, `spots_left`, `min_reached` ongewijzigd.
- `getProducts`: `start_time, end_time, timezone` toegevoegd aan de select (nodig voor de venstercheck), ondergrens naar gisteren, en `if (!isEventStillOpen(ev)) continue;` in de bestaande lus. `next_event_date` blijft exact hetzelfde veld.

**Security-keuzes** — n.v.t. Geen RLS, policy of grant geraakt; enkel leesfilters binnen bestaande tenant-gescope queries (`.eq('tenant_id', tenantId)` blijft staan).

**Gedeelde-paden-waarschuwing** — `storefront-api` bedient vijf custom frontends. Beide gewijzigde takken zitten achter `product_type === 'ticket'` respectievelijk een niet-lege `ticketProductIds`-lijst; producten zonder `event_details` raken de gewijzigde code niet. Geen response-veld hernoemd, verwijderd of van type veranderd — alleen nieuwe velden in een interne select. Het niet-ticket pad is byte-identiek.

**Verificatie** — Filterlogica geïsoleerd getest tegen de echte helpers: event vandaag 21:00 zonder `end_time` blijft zichtbaar op 01:00 UTC de volgende dag; event gisteren 21:00-03:00 is zichtbaar op 00:30 UTC (02:30 Brussel) en weg vanaf 01:00 UTC (03:00 Brussel) en op 12:00; event 3 dagen terug weg; event volgende week zichtbaar; ontbrekende `timezone` valt correct terug op Brussel. Query-ondergrens gaf `2026-08-13` bij "vandaag" `2026-08-14`. Geen databaserijen aangemaakt, dus geen opruiming nodig (0 testrijen). `tsgo -p tsconfig.app.json` = 0 fouten; `storefront-api` gedeployed.

**Bewust ongemoeid / Vervolg** — Check-in pad (fase 5) al datum-onafhankelijk, niet aangeraakt. `search_products` levert nog geen `product_type`/eventinfo; `cart_add_item`-datumvalidatie ongemoeid. Changelog en nieuwsbrief worden gebundeld aan het eind van fase 6.

---

## TICKET-1 fase 5 — Check-in PWA (QR-scannen aan de deur) — 14 augustus 2026

**Doel** — Host/crew scant QR-tickets aan de ingang: token -> validatie -> `status='checked_in'`. Dubbelscan geeft "al ingecheckt", ongeldig wordt afgewezen, host kan terugdraaien.

**Kritiek ontwerpprincipe** — Check-in bindt zich aan een **expliciet gekozen `event_detail_id`**, nooit aan "event_date = vandaag". Events lopen over middernacht (crawl 21:00 -> 03:00); naieve datumlogica breekt bij oudejaar/festival-tenants. Zowel de edge function (verplichte `event_detail_id` in de body, `wrong_event` als het ticket bij een andere datum hoort) als de UI (host kiest eerst bewust een event, geen auto-selectie) handhaven dit. Er staat nergens een `current_date`-vergelijking in het check-in pad.

**Uitgevoerd**
- `supabase/functions/ticket-checkin/index.ts` (nieuw) — acties `checkin` en `undo`. Volgorde: JWT via `authenticateRequest` -> gekozen `event_details` ophalen (bepaalt de tenant-scope) -> tenant-access check -> rolmapping -> ticket ophalen binnen die tenant -> event-binding -> conditionele update.
- Rolmapping: `host` = `tenant_admin` of `platform_admin` (mag inchecken en terugdraaien), `crew` = `staff` (mag alleen inchecken; `undo` geeft 403).
- Race-veiligheid: `update ... where status='valid'` (check-in) en `where status='checked_in'` (undo). Nul geraakte rijen = `already` respectievelijk `not_checked_in`, dus twee gelijktijdige scans kunnen niet dubbel inchecken.
- `undo` wordt gelogd in `admin_actions_log` met `action_type='ticket_checkin_undo'` (traceerbaar wie terugdraaide).
- `src/pages/admin/TicketCheckin.tsx` (nieuw) — mobiel-eerst PWA-scherm: event-kiezer, camera-scan via `html5-qrcode`, groot kleurvlak per uitkomst (groen ok / oranje al ingecheckt / geel ander event / rood ongeldig), live teller `ingecheckt / totaal` (refetch elke 15s), lijst recente scans met host-only "Terugdraaien" achter een bevestigingsdialoog. Debounce van 3s per token omdat een QR in beeld blijft bij continue scan.
- `src/App.tsx` — route `checkin` onder `/admin`, achter `RouteGuard requireRole={['tenant_admin','staff']}` (platform_admin bypasst via `useCan`/`useAuth`).
- `src/components/admin/sidebar/sidebarConfig.ts` — item "Ticket check-in" naast Kassa (POS), `allowedRoles: platform_admin | tenant_admin | staff`.
- `html5-qrcode@2.3.8` toegevoegd (camera-scan); `react-qr-code` bleef voor generatie.

**Security-keuzes** — Geen schema-, RLS-, policy- of grantwijziging. De functie gebruikt de service-role client maar leidt de tenant-scope **uitsluitend** af uit het gekozen `event_details.tenant_id`, en haalt het ticket op met `.eq('tenant_id', tenantId)`; een token uit een andere tenant valt dus terug op "ongeldig". Client-side rolinformatie wordt niet vertrouwd: de rolcheck gebeurt in de functie op basis van `roles_by_tenant` uit `authenticateRequest`. De QR bevat alleen het token, geen persoonsgegevens.

**Gedeelde-paden-waarschuwing** — n.v.t.: `storefront-api`, `checkout-engine`, `storefront-resolve` en de gedeelde thema-/sectietabellen zijn niet aangeraakt. Puur additief: een nieuwe edge function, een nieuwe adminroute en een nieuw sidebar-item. Het `use_custom_frontend`-pad is ongewijzigd.

**Verificatie**
- `bunx tsgo --noEmit -p tsconfig.app.json` -> schoon (exit 0, geen output).
- `ticket-checkin` gedeployed.
- Auth-gate: POST zonder Authorization-header -> `401 {"success":false,"error":"Missing or invalid Authorization header"}`.
- Dubbelscan-semantiek op DB-niveau bewezen met testdata op tenant Fonske (`95f6685b-3474-42fe-81ad-a5e6ca3d6806`): tweede testevent (2026-09-04, 21:00-03:00), testorder, testregel en twee tickets (token `aaa...`/`bbb...`). Twee keer dezelfde conditionele update: eerste raakt 1 rij, tweede 0 rijen, eindstatus `checked_in` met gevulde `checked_in_at`. Het ticket van het andere event bleef `valid` (event-binding).
- Testdata volledig opgeruimd; natrek: 0 tickets, 0 order_items, 0 orders, 0 event_details.

**UNVERIFIED** — De HTTP-paden van `ticket-checkin` (checkin/already/wrong_event/invalid/undo en de 403 voor crew) zijn **niet end-to-end getest**: er was geen ingelogde preview-sessie beschikbaar (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`) en de service-role key is op Lovable Cloud niet opvraagbaar, dus er kon geen geldig JWT gemint worden. Nodig van Akke: inloggen in de preview en een echte scan op een ticket-event, incl. een dubbelscan, een ticket van een andere datum en een undo als crew-gebruiker (moet 403 geven).

**Bewust ongemoeid / Vervolg** — Geen changelog-, `doc_articles`- of nieuwsbrief-entry: net als bij fase 4d bundelt fase 6 de publieke communicatie van de ticket-feature (de feature is nog niet aangekondigd). Geen offline-modus/queue voor scannen zonder netwerk. Geen handmatige zoek-op-naam als camera-alternatief. `trg_issue_tickets_on_paid` en het mailpad onaangeroerd.

## TICKET-1 fase 4d — Timing-gat in stripe-connect-webhook (Gat C) — 14 augustus 2026

**Root cause** — De fase-4a trigger `trg_issue_tickets_on_paid` is `AFTER INSERT OR UPDATE OF payment_status ... WHEN payment_status='paid'` op `orders`. De cart-flow in `supabase/functions/stripe-connect-webhook/index.ts` insert de order al mét `payment_status: "paid"` (regel ~395) en pas daarna de regels via `order_items.insert(...)` (regel ~440). Op triggermoment bestaan er dus geen ticketregels: de functie vindt niets en maakt geen `ticket_instances`. Gevolg vóór deze fix: een échte betaalde ticket-order via Stripe leverde geen tickets op en de fase-4b ticket-mail (fetch op ~507) was leeg.

**Uitgevoerd** — strikt additief, twee blokken toegevoegd, geen bestaande regel gewijzigd:
- `supabase/functions/stripe-connect-webhook/index.ts` — cart-flow: non-blocking `supabaseClient.rpc('issue_tickets_for_order', { p_order_id: newOrder.id })` direct ná `order_items.insert(orderItems)` en vóór "Mark cart as converted" — dus ruim vóór de `send-ticket-confirmation`-fetch, zodat de tickets bestaan wanneer de mail afgaat.
- Zelfde bestand — legacy-flow (`else if (orderId)`): identieke aanroep met `orderId`, ná de stock-update en vóór de invoice- en `send-ticket-confirmation`-fetches. Daar gaat de order via `UPDATE` naar paid (items bestaan al), dus de trigger werkt; de aanroep is er voor consistentie en is idempotent.
- Beide blokken hebben een eigen `try/catch` met `logStep`, zodat de webhook nooit kan breken.

**Security-keuzes** — n.v.t.: geen RLS, policies, grants of schemawijzigingen. `issue_tickets_for_order` is `SECURITY DEFINER` en had al `EXECUTE` voor `service_role` (bevestigd via `pg_proc.proacl`); niets toegevoegd of gewijzigd.

**Gedeelde-paden-waarschuwing** — `stripe-connect-webhook` bedient alle tenants inclusief de vijf custom frontends. Veilig omdat: (1) er geen bestaande regel of respons-veld wijzigt; (2) `issue_tickets_for_order` returnt zonder effect voor orderregels zonder `event_detail_id`, dus niet-ticket orders krijgen geen tickets en geen fout; (3) de aanroep is idempotent via de unique index `(order_item_id, seq)`; (4) beide blokken zijn non-blocking, een fout wordt alleen gelogd.

**Verificatie** — zelfopruimende `DO`-block die de exacte webhook-volgorde nabootst op tenant Fonske (`95f6685b-3474-42fe-81ad-a5e6ca3d6806`, product `1daee896-a794-4076-b41e-8f511305f2a6`, event_detail `17efe0cc-e8ec-45b8-b2c6-6d72122249bd`, qty 2):
- (a) order geïnsert met `payment_status='paid'` zónder items → **0** ticket_instances (bevestigt Gat C)
- (b) na insert van de order_items met `event_detail_id` → nog steeds **0** (trigger vuurt niet opnieuw)
- (c) na 1e `issue_tickets_for_order` → **2**
- (d) na 2e `issue_tickets_for_order` → **2** (idempotent)
De block faalde bewust met een exception bij elke andere uitkomst; hij liep zonder fout. Testdata volledig verwijderd; natrek: `orders`-rij = 0, `order_items` = 0.
- `stripe-connect-webhook` gedeployed. `storefront-api` niet aangeraakt.

**Bewust ongemoeid / Vervolg** — Geen changelog- of nieuwsbrief-entry: fase 6 bundelt de publieke communicatie van de ticket-feature. De trigger `trg_issue_tickets_on_paid` blijft ongewijzigd (nog nuttig voor handmatige status-updates in de admin). Overige webhook-takken (`payment_intent`, refunds) niet aangeraakt.

## TICKET-1 fase 4c — Gratis (€0) ticketpad + ontbrekende ticket-mail — 14 augustus 2026

**Doel** — De backend sluitend maken: zowel betaald als gratis leidt tot `ticket_instances` + bevestigingsmails. Strikt additief in `storefront-api`; Stripe- en bank_transfer-takken ongewijzigd.

**Uitgevoerd**
- `supabase/functions/storefront-api/index.ts` — `checkoutComplete`: nieuwe €0-tak direct na de totaalberekening (`totalCents = Math.round(total * 100)`, tak vuurt enkel bij `<= 0`), vóór de Stripe-map. Blauwdruk = het bank_transfer-blok: voorraad afboeken, cart-`payment_method='free'`, `createOrderFromCart(..., 'paid')`, factuur best-effort, en non-blocking `send-order-confirmation` + `send-ticket-confirmation`.
- `supabase/functions/storefront-api/index.ts` — `checkoutVerifyPayment`: **Gat A** gedicht met een non-blocking `send-ticket-confirmation`-fetch náást de bestaande `send-order-confirmation`-fetch (patroon van `stripe-connect-webhook` ~507). Geen bestaande regel gewijzigd.
- Beide paden roepen bovendien de bestaande idempotente RPC `issue_tickets_for_order(p_order_id)` expliciet aan.

**Waarom die RPC-aanroep nodig is (nieuw feit)** — de fase-4a trigger `trg_issue_tickets_on_paid` is `AFTER INSERT OR UPDATE OF payment_status` op `orders`. Bij een order die al bij INSERT `paid` is, bestaan de `order_items` nog niet, dus de trigger vindt geen ticketregels en maakt niets aan. De expliciete RPC ná het inserten van de items sluit dat gat; dubbele aanroepen zijn veilig door de partiële unique index `ux_ticket_instances_orderitem_seq (order_item_id, seq)`.

**Security-keuzes** — n.v.t.: geen RLS/policies/grants geraakt. `issue_tickets_for_order` had al `EXECUTE` voor `service_role` (bevestigd via `pg_proc.proacl`); niets toegevoegd. Geen DB-schemawijziging.

**Gedeelde-paden-waarschuwing (G1)** — `checkoutComplete` bedient alle tenants én de vijf custom frontends. Veilig omdat: (1) de €0-tak alleen vuurt bij `Math.round(total*100) <= 0` — bij elk positief totaal valt de code onveranderd door naar de Stripe- respectievelijk bank_transfer-tak; (2) `payment_method='free'` is intern en is **niet** toegevoegd aan `available_payment_methods` (regel ~1821) of aan de methodelijst (`bank_transfer_enabled`, regel ~242) — het JSON-contract is byte-identiek; (3) de `PAYMENT_METHOD_NOT_AVAILABLE`-check op regel ~2405 is bewust ongewijzigd gelaten, zodat de foutvolgorde voor bestaande frontends identiek blijft; een €0-cart krijgt nog steeds een normale methodelijst en de meegestuurde methode wordt simpelweg genegeerd zodra het totaal ≤ 0 is; (4) `send-ticket-confirmation` skipt zichzelf zonder `ticket_instances`, dus niet-ticket orders veranderen niet.

**Verificatie**
- SQL-test (zelfopruimende `DO`-block op SellQo-testtenant, ticketproduct "Early bird ticket", qty 2): tickets na INSERT-trigger = 0 (bevestigt de timing-gap), na 1e RPC = 2, na 2e RPC = 2 (idempotent). Testdata volledig verwijderd; natrek: `orders LIKE 'TEST-4C%'` = 0, tickets met testmail = 0.
- Idempotentie order-niveau: dubbel indienen levert geen tweede order — `checkoutComplete` blokkeert op `cart.checkout_status === 'converted'` (regel ~2410) en `createOrderFromCart` zet die status (regel ~2124), exact zoals bank_transfer.
- `storefront-api` gedeployed; typecheck zonder fouten.

**Bewust ongemoeid / Vervolg**
- `stripe-connect-webhook` niet aangeraakt (conform opdracht). **Openstaand risico**: die webhook insert de order óók al als `paid` (regel ~395) vóór de `order_items` (regel ~440), dus daar ontstaat dezelfde timing-gap en worden er bij een echte betaalde ticket-order géén `ticket_instances` gemaakt — de fase-4b mail heeft dan niets te sturen. Voorstel voor fase 4d: één additieve `issue_tickets_for_order`-aanroep ná de items-insert, of de trigger verplaatsen naar `order_items`.
- Geen changelog/newsletter (fase 6 bundelt).
## TICKET-1 fase 4b — Bevestigingsmail met QR-tickets — 14 augustus 2026

**Doel** — Bij een betaalde ticket-order één e-mail met alle QR-codes onder elkaar (optie 1), zonder PDF-bijlage. Strikt additief; de mail/betaalflow van niet-ticket orders blijft ongewijzigd.

**Uitgevoerd**
- `supabase/functions/send-ticket-confirmation/index.ts` (nieuw) — neemt `{ order_id }`, `authenticateRequest`, service-role client. Haalt de order op (`customer_email/name`, `locale`, `tenant_id`, `shipping_address`), daarna `ticket_instances` op `order_id` gesorteerd op `seq`. Geen tickets → `{ skipped: true, reason: 'no ticket_instances' }` (200). Event- en productgegevens worden met twee losse `.in('id', …)`-queries op `event_details` en `order_items` opgehaald i.p.v. PostgREST-embeds — minder afhankelijk van FK-hints. Branding via `getTenantBrand`, taal via `resolveEmailLocale`, teksten via `t()`; render via `renderTenantEmail`. Sender: nieuwe `EMAIL_SENDERS.tickets(tenantName, replyTo)` → `tickets@sellqo.app` met tenantnaam als weergavenaam (patroon van `orders`).
- `supabase/functions/ticket-qr/index.ts` (nieuw, `verify_jwt = false`) — publieke GET `?token=…&size=…`, levert de QR als binary image (`image/gif`, `Cache-Control: immutable`). Token-regex `^[A-Za-z0-9_-]{8,128}$`, size geklemd op 120–600.
- `supabase/functions/_shared/emailSenders.ts` — `tickets`-sender + `SenderKey`-uitbreiding (additief).
- `supabase/functions/_shared/tenantEmailI18n.ts` — optioneel `ticket`-blok in het `Strings`-type plus volledige teksten in nl/en/fr/de (subject, heading, intro, instructions, labels, codeLabel, disclaimer, footerNote, poweredBy). Bestaande blokken onaangeroerd.
- `supabase/functions/stripe-connect-webhook/index.ts` — twee toevoegingen, chirurgisch: één extra non-blocking `fetch` naar `send-ticket-confirmation` in eigen `try/catch` náást de bestaande `send-order-confirmation`-aanroep, in zowel de cart-flow als het legacy order-pad. Geen bestaande regel gewijzigd.
- Migratie — `customer_communication_settings` krijgt per tenant een rij `trigger_type = 'ticket_delivery'` (`category = 'orders'`, `email_enabled = true`), idempotent via `WHERE NOT EXISTS`. Terugdraaien staat in commentaar in de migratie.
- `src/types/customerCommunication.ts` — trigger-definitie "Tickets versturen" toegevoegd zodat de tenant de mail in de admin kan togglen.

**QR-aanpak en waarom** — `<img src="{SUPABASE_URL}/functions/v1/ticket-qr?token=…&size=220">`. Base64-inline (`data:`-URI) is bewust vermeden: Gmail en Outlook blokkeren dat. Een gewone URL wordt door alle clients gerenderd (Gmail proxied hem via googleusercontent). Er is voor een eigen endpoint gekozen i.p.v. een publieke QR-dienst zodat tokens niet bij een derde partij langskomen en er geen externe uptime-afhankelijkheid is. Het endpoint doet géén database-lookup — het encodeert enkel de meegegeven string, dus er lekt niets en er is geen enumeratie-oppervlak. In de QR zit **uitsluitend** de `qr_token`, geen persoonsgegevens; fase 5 (check-in) valideert het token server-side.

**Aanroeppunt + gedeelde-pad-afweging** — Optie (a) uit de opdracht is uitgevoerd. De extra fetch staat op dezelfde plek als de bestaande order-confirmation, is non-blocking en gevat in eigen `try/catch`; een falende ticket-mail kan de orderverwerking niet raken. De fetch is onvoorwaardelijk maar de function skipt zichzelf bij afwezige `ticket_instances`, waardoor er géén extra query in de webhook nodig was en het bestaande verloop van niet-ticket orders identiek blijft (extra HTTP-call zonder neveneffect). `storefront-api` en `checkout-engine` zijn niet aangeraakt; het JSON-contract van de vijf custom frontends is onveranderd.

**Security-keuzes** — Geen RLS/policy-wijzigingen. Ticketgegevens worden alleen server-side met de service-role gelezen. `ticket-qr` is publiek maar stateless en leest niets uit de database. De mail-function vereist `authenticateRequest` (service-role of geldige JWT).

**Verificatie**
- `ticket-qr` live: HTTP 200, `Content-Type: image/gif`, 2618 bytes voor een testtoken.
- Mail-HTML lokaal gerenderd voor qty 3: drie QR-blokken met `ticket-qr?token=TOKEN1/2/3&size=220`, labels "Ticket 1 van 3" t/m "Ticket 3 van 3", instructietekst en disclaimer aanwezig.
- `deno check send-ticket-confirmation/index.ts` → 12 fouten, exact dezelfde baseline als `deno check send-order-confirmation/index.ts` (12), alle in `_shared/sellqoEmail.ts`/`tenantEmail.ts` en bestaand. `deno check ticket-qr/index.ts` → schoon.
- `send-ticket-confirmation` met een bestaande niet-ticket order kon niet end-to-end getest worden: de service-role key is niet beschikbaar in deze omgeving en de function weigert (correct) een aanroep zonder Authorization-header. De skip-tak is code-matig één early return op een leeg `ticket_instances`-resultaat.
- Deployed: `ticket-qr`, `send-ticket-confirmation`, `stripe-connect-webhook`.

**Bewust ongemoeid / Vervolg** — Geen changelog- of nieuwsbrief-entry (hele flow wordt in fase 6 gebundeld). Geen PDF-bijlage, geen aparte mail per ticket, geen WhatsApp-variant. Nog te testen door Akke: een echte betaalde ticket-order in SellQo Speeltuin — controleer dat de QR in de mail rendert in Gmail/Apple Mail en dat het token in de afbeelding gelijk is aan `ticket_instances.qr_token`.

## TICKET-1 fase 4a — Instance-creatie via DB-trigger — 14 augustus 2026

**Doel** — Bij een betaalde ticket-order automatisch `ticket_instances` aanmaken, zonder de betaalpaden aan te raken.

**Architectuur** — Puur in de database:
- `public.issue_tickets_for_order(p_order_id uuid)` — SECURITY DEFINER, `SET search_path = public`. Leest de order; bij `payment_status <> 'paid'` direct `RETURN`. Selecteert daarna alleen `order_items` met `event_detail_id IS NOT NULL` (de ticketregels, gezet in fase 3.5) — geen join naar `products`. Zonder ticketregels doet de functie niets: goedkoop pad voor niet-ticket orders. Per ticketregel `FOR i IN 1..quantity` één rij met `tenant_id`, `event_detail_id`, `order_id`, `order_item_id`, `seq`, `status 'valid'` en `attendee_name`/`attendee_email` uit `orders.customer_name`/`customer_email` (geen extra joins).
- `qr_token`: `replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')` — 64 hexkarakters, 256 bit entropie, botsing praktisch uitgesloten. `pgcrypto`'s `gen_random_bytes` was niet aanroepbaar vanuit `search_path = public` (42883) en is daarom niet gebruikt.
- Trigger `trg_issue_tickets_on_paid`: `AFTER INSERT OR UPDATE OF payment_status ON public.orders FOR EACH ROW WHEN (NEW.payment_status = 'paid')` → `trg_issue_tickets_for_order()`. INSERT is meegenomen omdat de webhook cart-flow een order aanmaakt die meteen `paid` is; UPDATE dekt de paden die een bestaande order op paid zetten.

**Idempotentie-sleutel** — `(order_item_id, seq)`. `seq int` additief toegevoegd (`ADD COLUMN IF NOT EXISTS`) plus `ux_ticket_instances_orderitem_seq` (partieel, `WHERE seq IS NOT NULL`). Nodig omdat qty 3 drie rijen met dezelfde `order_item_id` oplevert; `order_item_id` alleen kan dus niet uniek zijn. De insert gebruikt `ON CONFLICT (order_item_id, seq) WHERE seq IS NOT NULL DO NOTHING` — het WHERE-predicaat is verplicht om een partiële index te kunnen inferren (zonder predicaat: 42P10). Dubbele trigger-vuring levert daarmee nooit dubbele tickets. Geen backfill nodig: 0 bestaande rijen.

**Security-keuzes** — Beide functies SECURITY DEFINER met vast `search_path`; `EXECUTE` ingetrokken voor `PUBLIC`, `anon` en `authenticated`, zodat alleen de trigger/service-role ze aanroept. Geen RLS, policies of grants op `ticket_instances` gewijzigd.

**Gedeelde-paden-waarschuwing** — `stripe-connect-webhook` en `storefront-api` zijn niet aangeraakt (byte-identiek); de logica zit volledig in de DB. Voor de vijf custom frontends verandert er niets: het `storefront-api`-contract is onveranderd en de trigger valt bij niet-ticket orders direct terug op `RETURN`.

**Verificatie (geïsoleerd, testdata nadien verwijderd)**
1. Ticket-order (tenant SellQo Speeltuin, event_detail `17efe0cc-…49bd`, status `scheduled`), order_item qty 3, order eerst `pending` → daarna `paid`: **3** `ticket_instances`, alle met het juiste `event_detail_id` en `tenant_id`, `status = 'valid'`, `seq` 1/2/3, `qr_token` 64 tekens, **3 unieke tokens**, attendee-velden gevuld uit de order.
2. `issue_tickets_for_order()` nog eens handmatig aangeroepen → **nog steeds 3** (`ticket_order_count: 3, unique_tokens: 3`) — idempotentie bewezen.
3. Niet-ticket order (order_item zonder `event_detail_id`) op `paid` gezet → **0** `ticket_instances`, geen fout.
4. Opruiming: `ticket_instances` = 0, testorders = 0. Triggers op `orders`: 8 (de 7 bestaande intact + de nieuwe).

**Bewust ongemoeid / Vervolg** — Geen mail, geen QR-afbeelding, geen scanner (fase 4b/verder). POS (`pos_transactions`) valt buiten scope: dat pad raakt `orders` niet. Attendee-splitsing per ticket (naam per bezoeker) staat open voor 4b. Geen changelog/newsletter — nog geen tenant-zichtbare feature (pas fase 6).

## TICKET-1 fase 3.5-fix — Status-validatie cartAddItem (bugfix) — 14 augustus 2026

**Root cause** — De in fase 3.5 toegevoegde datum-validatie in `cartAddItem` (`supabase/functions/storefront-api/index.ts`) controleerde op status `'active'`, maar die status bestaat niet op `event_details`: de CHECK-constraint staat alleen `scheduled, confirmed, cancelled, completed, skipped, merged` toe. Gevolg: `eventDetail.status !== 'active'` was altijd waar voor een geldige datum (die `scheduled` of `confirmed` is), dus élke ticket-toevoeging aan de cart werd geweigerd met `EVENT_DATE_UNAVAILABLE` — de hele ticketverkoop was geblokkeerd.

**Uitgevoerd** — Enkel de status-check vervangen:
```
- if (eventDetail.status && eventDetail.status !== 'active') {
+ if (!['scheduled', 'confirmed'].includes(eventDetail.status)) {
```
Niets anders aangeraakt: kolommen, doorgifte naar `order_items`, merge-check en de rest van fase 3.5 zijn byte-identiek gebleven.

**Security-keuzes** — n.v.t.; geen RLS/policy/grant geraakt. De validatie blijft een security-toevoeging (datum moet bij product + tenant horen), alleen de toegestane statusset is gecorrigeerd naar de echte CHECK-constraint.

**Gedeelde-paden-waarschuwing** — `storefront-api` is een gedeeld pad voor alle tenants, inclusief de vijf custom frontends. Veilig: de wijziging is puur in het `event_detail_id`-pad, dat alleen loopt wanneer de parameter aanwezig is (alleen ticket-producten). Bestaande (non-ticket) cart-acties merken er niets van; de response-keys zijn ongewijzigd.

**Verificatie** — `npx tsgo --noEmit -p tsconfig.app.json` → exit 0, 0 fouten. `storefront-api` opnieuw gedeployed. De check laat nu `scheduled`/`confirmed` toe en weigert `cancelled`/`completed`/`skipped`/`merged`, conform de CHECK-constraint op `event_details.status`.

**Bewust ongemoeid / Vervolg** — Geen changelog/newsletter (interne fix, niet tenant-zichtbaar). Fase 4 ongewijzigd.

---

## TICKET-1 fase 3.5 — Event-datum door de checkout (dataleiding) — 14 augustus 2026

**Root cause / aanleiding** — De fase-4-recon toonde de blocker: de door de klant gekozen event-datum werd nergens vastgelegd. `storefront_cart_items` (8 kolommen) en `order_items` (19 kolommen) hadden geen `event_detail_id`, dus na betaling was niet vast te stellen vóór welke datum een ticket verkocht was. Fase 4 (ticket_instances aanmaken bij betaling) kan zonder die leiding niet bestaan.

**Uitgevoerd**
- Migratie (idempotent, `ADD COLUMN IF NOT EXISTS`): `storefront_cart_items.event_detail_id uuid NULL REFERENCES event_details(id)` en `order_items.event_detail_id uuid NULL REFERENCES event_details(id)`, plus twee partiële indexen (`WHERE event_detail_id IS NOT NULL`). Geen default, geen backfill. Terugdraaien handmatig: `ALTER TABLE ... DROP COLUMN event_detail_id` (niet doen zolang fase 4 leeft).
- `supabase/functions/storefront-api/index.ts` — `cartAddItem`: optionele parameter `event_detail_id`. Wordt hij meegestuurd, dan valideert de functie eerst dat de `event_details`-rij bij hetzelfde `product_id` én dezelfde `tenant_id` hoort (`EVENT_DATE_INVALID`) en dat de status `scheduled` of `confirmed` is (`EVENT_DATE_UNAVAILABLE`; oorspronkelijk foutief op `active` gecheckt — gecorrigeerd in fase 3.5-fix, zie boven); daarna schrijft hij het veld mee op de insert. De merge-check op bestaande cart-regels kreeg een extra filter (`.eq`/`.is` op `event_detail_id`), zodat twee verschillende datums van hetzelfde product niet samenvallen tot één regel.
- `checkoutVerifyPayment` (storefront-api): `event_detail_id` toegevoegd aan de cart-item-`select`, aan `processedItems` en aan de `order_items`-mapping.
- `supabase/functions/stripe-connect-webhook/index.ts` — cart-flow van `checkout.session.completed`: idem, drie plekken (select, processedItems, order_items-mapping).

**Security-keuzes** — Geen RLS/policy/grant gewijzigd. De nieuwe kolommen erven de bestaande policies van hun tabellen. De validatie in `cartAddItem` is juist een security-toevoeging: zonder die check had een client een `event_detail_id` van een ander product of een andere tenant kunnen meesmokkelen. De validatie draait alleen wanneer de parameter aanwezig is, dus geen enkel bestaand pad raakt hem.

**Gedeelde-paden-waarschuwing** — Zowel `storefront-api` als `stripe-connect-webhook` zijn gedeelde paden voor alle tenants, inclusief de vijf custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata). Waarom veilig: (1) de kolommen zijn nullable zonder default, bestaande rijen blijven NULL; (2) `event_detail_id` in `add_to_cart` is optioneel — afwezig betekent exact het gedrag van vóór deze batch; (3) er is geen bestaande response-key hernoemd of verwijderd, enkel `event_detail_id` toegevoegd aan de item-objecten in de verify/webhook-paden; (4) de extra `.is('event_detail_id', null)` op de merge-check komt overeen met de werkelijkheid van alle 123 bestaande cart-regels (allemaal NULL), dus geen gedragswijziging.

**Verificatie**
- Post-flight kolomtelling: `storefront_cart_items` = 9 kolommen, `order_items` = 20 kolommen, `event_detail_id` in beide aanwezig.
- Bestaande rijen ongewijzigd: 142 `order_items` en 123 `storefront_cart_items`, waarvan 0 met een niet-lege `event_detail_id`.
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0, 0 fouten.
- Edge functions `storefront-api` en `stripe-connect-webhook` succesvol gedeployed.

**Bewust ongemoeid / Vervolg** — Geen storefront-UI in deze batch: de datumkeuze voor de klant is fase 6. `cartGet` levert `event_detail_id` nog niet mee in zijn response (niet nodig zolang er geen UI is; strikt additief toe te voegen in fase 6). POS en bol.com-import blijven ongemoeid — tickets lopen via de webshop-checkout. Fase 4 (ticket_instances aanmaken bij betaling, idempotent) kan nu gebouwd worden op `order_items.event_detail_id`.

## TICKET-1 fase 3d — Tooltips + inschrijvingsteller per datum — 14 augustus 2026

**Root cause / aanleiding** — Fase 3c leverde vijf icoon-only actieknoppen per datum-rij (`src/components/admin/products/ProductEventDatesTab.tsx`). Op desktop was er geen enkele uitleg: het mobiele tekstlabel staat op `sm:hidden`, dus vanaf `sm` zag de tenant enkel iconen. Daarnaast toonde de rij alleen de ingestelde capaciteit en het minimum, niet hoe vol een datum werkelijk zit — precies de informatie die bepaalt of een event doorgaat.

**Uitgevoerd**
- `src/hooks/useEventDetails.ts` — nieuwe hook `useEventSignupCounts(productId, eventIds)`. Eén batch-select op `ticket_instances` (kolom `event_detail_id`), gefilterd op `tenant_id = useTenant().currentTenant.id`, `event_detail_id IN (eventIds)` en `status IN ('valid','checked_in')`; telling gebeurt client-side en levert `Record<eventId, number>`. queryKey `['event-signup-counts', productId, <gesorteerde ids>]`, `enabled` alleen bij een tenant én minstens één eventId. Bestaande hooks ongewijzigd.
- `src/components/admin/products/ProductEventDatesTab.tsx`
  - Nieuwe presentatiecomponent `SignupMeter`: tekst "X / capaciteit ingeschreven", plus bij `min_attendees > 0` "· min. Y gehaald" (groen) of "· nog Z tot minimum" (amber), en "· uitverkocht" bij vol. Daaronder een dunne balk (capaciteit = 100%) met kleur amber onder minimum, groen boven minimum, destructive bij vol, en een subtiele verticale marker op de minimum-drempel.
  - Geen balk bij `skipped`/`merged` (die datums tellen niet mee) — de bestaande dim/doorstreep-weergave blijft.
  - Nieuwe helper `ActionTooltip`: wikkelt elke icoon-actieknop in een shadcn `Tooltip` met "Verplaatsen naar andere dag", "Overslaan", "Terugzetten", "Bewerken", "Verwijderen". Eén `TooltipProvider` rond de hele lijst. De mobiele `sm:hidden`-labels zijn byte-identiek behouden; aan de knoppen zelf (props, handlers, condities) is niets gewijzigd.
- Changelog `2026.09z` (`ticket_signup_counter`, type improvement) in `PublicChangelog.tsx` + teksten in `landing.{nl,en,fr,de}.json` (96 entries, pariteit in alle vier).
- Migratie: idempotente `UPDATE` op `doc_articles` voor `ticket-product-datums` (guard `content NOT LIKE '%Inschrijvingen per datum%'`), met een korte sectie over de teller en de tooltips.

**Tellers staan nu op 0 — verwacht** — Ticketverkoop is fase 4; `ticket_instances` is nog leeg. Alle tellers tonen daarom `0 / capaciteit` met een amber balk op 0%. De teller leunt volledig op de bestaande rij-data, dus hij beweegt vanzelf mee zodra fase 4 rijen wegschrijft. Er is geen placeholder- of mocklogica ingebouwd.

**Security-keuzes** — Geen wijziging. Geen nieuwe tabellen, kolommen, policies, grants of functies. De teller leest via de tenant-scoped SELECT-policy op `ticket_instances` uit fase 1 (tenant_admin/staff) en filtert bovendien altijd expliciet op `tenant_id` in de query, conform het projectpatroon. De definer-functie `get_event_signup_count(p_event_detail_id uuid)` bestaat (geverifieerd: `prosecdef = true`) maar is hier bewust **niet** gebruikt: één batch-query voor de hele lijst is goedkoper dan N RPC-calls, en de RLS op `ticket_instances` geeft de admin al leesrecht. De functie blijft beschikbaar voor de storefront-kant in fase 4. De enige migratie is een content-`UPDATE` op `doc_articles`.

**Gedeelde-paden-waarschuwing** — Niet van toepassing. `storefront-api`, `checkout-engine`, `storefront-resolve` en de gedeelde tabellen (`tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`) zijn niet aangeraakt. Puur admin-UI plus één read-only hook. Het `use_custom_frontend`-pad is byte-identiek; de vijf custom-frontend tenants zien geen enkel verschil.

**Verificatie**
- `bunx tsgo --noEmit -p tsconfig.app.json` → exit 0, 0 fouten.
- i18n-pariteit: 96 changelog-entries in nl/en/fr/de, gelijk in alle vier de locales.
- Bestaande functionaliteit onveranderd: lijst-render, bulk plannen, verplaatsen, overslaan/terugzetten, samenvoegen, add/edit-Dialog en delete-AlertDialog zijn functioneel ongewijzigd — enkel de knoppen zijn in een tooltip-wrapper gezet (`asChild`, dus geen extra DOM-node rond de button).
- 390px: de balk is `max-w-xs` en de tekst wrapt via `flex-wrap`; de actiegroep behoudt `flex-wrap gap-2` met de mobiele tekstlabels.

**Bewust ongemoeid / Vervolg** — Kopers-communicatie bij verplaatsen/samenvoegen blijft fase 4b. Realtime-updates op de teller zijn niet ingebouwd: invalidatie loopt via de bestaande queryKey-invalidaties en een refetch bij navigatie; pas als fase 4 verkopen oplevert is te beoordelen of live-updates nodig zijn.

## TICKET-1 fase 3c — Slimme datum-acties (bulk, verplaatsen, overslaan, samenvoegen) — 14 augustus 2026

**Root cause / aanleiding** — Fase 3b (`src/components/admin/products/ProductEventDatesTab.tsx`) leverde enkel losse CRUD op `event_details`. Voor een tenant met een wekelijks terugkerend event betekende dat handmatig datum-per-datum invoeren, en waren "niet deze week" of "we voegen twee avonden samen" alleen mogelijk via verwijderen — destructief en niet terug te draaien.

**Uitgevoerd**
- `src/hooks/useEventDetails.ts`
  - `EventStatus` uitgebreid met `'skipped' | 'merged'` (de CHECK op `event_details.status` stond die twee al toe sinds fase 1, migratie `20260813231325`).
  - `EventDateFormData` uitgebreid met optioneel `merged_into_event_id`, zodat `useUpdateEventDate` de merge-relatie kan schrijven zonder nieuwe hook.
  - Nieuwe hook `useBulkCreateEventDates(productId)`: één array-insert met `product_id` + `tenant_id` op elke rij, `.select()` voor verificatie, invalidate van `['event-details', productId]` in `onSuccess`. Volgt het bestaande patroon van `useCreateEventDate`.
- `src/components/admin/products/ProductEventDatesTab.tsx`
  - Labels/badges voor `skipped` ("Overgeslagen", secondary) en `merged` ("Samengevoegd", outline) via een aparte `ALL_STATUS_LABELS`-map. `STATUS_OPTIONS` (de dropdown-bron) blijft bewust op de vier oorspronkelijke waarden.
  - **Bulk plannen**: dialog met startdatum (Calendar), aantal weken (default 6, geclamped 1–52), weekdag (auto-gevuld op de weekdag van de startdatum), gedeelde starttijd/capaciteit/minimum. Genereert een preview met een checkbox per datum, alles aangevinkt; al bestaande `event_date`-waarden voor dit product worden uit de generatie gefilterd en subtiel gemeld ("N datum(s) bestonden al en zijn overgeslagen"). Pas op "Aanmaken" volgt de insert.
  - **Verplaatsen**: per rij een knop (`CalendarClock`) met een dialog met alleen een datumkiezer, voorgevuld op de huidige datum; schrijft enkel `event_date` via `useUpdateEventDate`.
  - **Overslaan**: knop (`SkipForward`) alleen bij status `scheduled`/`confirmed` → status `skipped`. De rij blijft staan, doorgestreept en gedimd. Bij `skipped` verschijnt "Terugzetten" (`RotateCcw`) → status terug naar `scheduled`. Niet-destructief, één klik ongedaan.
  - **Samenvoegen**: modus-knop toont checkboxes per rij (alleen selecteerbaar bij `scheduled`/`confirmed`/`skipped`). Bij 2+ selectie opent een dialog met een radio-keuze voor de "winnaar". Verliezers krijgen `status = 'merged'` + `merged_into_event_id = winnaar`; de winnaar blijft ongemoeid. Verliezende rijen renderen gedimd met "Samengevoegd → [datum]". De merge-loop gebruikt per rij try/catch zodat één falende update de rest niet blokkeert.
- Changelog `2026.09y` (`ticket_smart_date_actions`, type feature) in `PublicChangelog.tsx` + teksten in `landing.{nl,en,fr,de}.json` (95 entries, pariteit in alle vier).
- Migratie: idempotente `ON CONFLICT (doc_level, slug) DO UPDATE` op `doc_articles` voor `ticket-product-datums`; het artikel beschrijft nu de vier acties en vermeldt expliciet dat kopers-communicatie later komt.

**Waarom `skipped`/`merged` niet handmatig kiesbaar zijn** — Beide statussen dragen een impliciete relatie of intentie die de dropdown niet kan uitdrukken. `merged` is zinloos zonder `merged_into_event_id`; handmatig kiezen zou een verliezer zonder winnaar opleveren en de "Samengevoegd → [datum]"-weergave laten hangen. `skipped` is per definitie het resultaat van een omkeerbare actie met een bijhorende "Terugzetten"-knop; via de dropdown gezet zou de gebruiker geen zichtbaar pad terug hebben. Daarom zet enkel de actie de status, en toont de UI de status wél als badge.

**Kopers-communicatie bewust uitgesteld naar fase 4b** — Verplaatsen en samenvoegen raken in deze fase alleen `event_details`. Bestaande `ticket_instances` worden niet mee verhuisd en er gaat geen mail uit. Dat is een expliciete keuze: de mailflow met ja/refund-keuze en `ticket_change_tokens` is fase 4b en vereist een eigen edge-function plus refund-pad. Beide dialogs melden dit letterlijk: "Kopers worden pas in een latere fase automatisch verwittigd." Zo is er geen stille aanname dat kopers al bericht krijgen.

**Security-keuzes** — Geen. Geen nieuwe tabellen, kolommen, policies, grants of functies. Alle writes lopen via de bestaande `event_details_insert_tenant` / `event_details_update_tenant` policies uit fase 1; de bulk-insert zet `tenant_id` expliciet per rij via `useTenant()`, conform het bestaande patroon. De enige migratie is een `doc_articles`-INSERT/UPDATE (content).

**Gedeelde-paden-waarschuwing** — Niet van toepassing. `storefront-api`, `checkout-engine`, `storefront-resolve` en de gedeelde tabellen (`tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`) zijn niet aangeraakt. `event_details` is een eigen ticket-tabel; de custom-frontend tenants (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) hebben geen ticketproducten en zien geen enkel gedragsverschil. Het `use_custom_frontend`-pad is byte-identiek.

**Verificatie**
- `npx tsgo --noEmit -p tsconfig.app.json` → exit 0, 0 fouten.
- i18n-pariteit: 95 changelog-entries in nl/en/fr/de, gelijk aantal in alle vier de locales.
- Bestaande basis onveranderd: lijst-render, add/edit-Dialog (inclusief de vier-waarden status-Select), en delete-AlertDialog zijn functioneel ongewijzigd overgenomen; `useCreateEventDate` / `useUpdateEventDate` / `useDeleteEventDate` hebben identieke signature.
- Mobiel (390px): alle nieuwe dialogs gebruiken `max-w-[calc(100vw-2rem)] sm:max-w-lg` + `max-h-[85vh] overflow-y-auto`; de kopbalk-knoppen stapelen via `flex-col sm:flex-row`; de preview-lijst scrollt binnen `max-h-56`; de actieknoppen per rij wrappen via `flex-wrap` met tekstlabels die enkel op mobiel zichtbaar zijn.
- Redenering per flow: bulk berekent het eerste voorkomen van de gekozen weekdag vanaf de startdatum via `(targetDow - getDay(start) + 7) % 7` en dan `addWeeks(first, i)` — dus altijd dezelfde weekdag; verplaatsen schrijft enkel `event_date`; overslaan zet `skipped` en "Terugzetten" zet `scheduled`; mergen zet `merged` + `merged_into_event_id` uitsluitend op de niet-gekozen datums.

**Bewust ongemoeid / Vervolg**
- Geen mail, geen `ticket_instances`-verhuizing, geen `ticket_change_tokens` — fase 4b.
- Geen storefront-weergave van `skipped`/`merged`; `get_public_events` en `storefront-api` blijven zoals ze zijn. Of een overgeslagen of samengevoegde datum uit de publieke lijst moet verdwijnen is een openstaand beslispunt voor de storefront-fase.
- Newsletter-item bewust nog niet toegevoegd — wacht op fase 6, conform opdracht.

## TICKET-1 fase 3b — producttype `ticket` + basis Events & Datums-beheer — 14 augustus 2026

**Root cause / gat:** het schema uit fase 1 (`event_details`) en de storefront-response uit fase 2 bestonden al, maar een tenant kon nergens een ticketproduct aanmaken of datums invoeren. `ticket` ontbrak in de TS-union, `productTypeInfo`, `productTypeIcons` en de zod-enum van `ProductForm`.

**Uitgevoerd:**
- `src/types/product.ts`: `'ticket'` toegevoegd aan de `ProductType`-union en een `ticket`-entry in `productTypeInfo` ("Ticket / Event").
- `src/pages/admin/ProductForm.tsx`: `Ticket`-icoon geïmporteerd uit lucide-react en toegevoegd aan `productTypeIcons`; `'ticket'` toegevoegd aan de zod-enum `product_type`; `isTicket`-boolean naast de bestaande `isDigital`/`isGiftCard`/`isBundle`; in `handleProductTypeChange` valt `ticket` in de bestaande dienst-branche (`requires_shipping = false`, `track_inventory = false`) — geen nieuwe branche nodig, geen bestaande branche gewijzigd.
- Nieuw: `src/hooks/useEventDetails.ts` — `useEventDetails(productId)` (queryKey `['event-details', productId]`, gefilterd op `product_id` + `tenant_id`, geordend op `event_date` asc) plus `useCreateEventDate`, `useUpdateEventDate`, `useDeleteEventDate` met `tenant_id` van `useTenant()` op insert en `invalidateQueries` in `onSuccess`. Exact het patroon van `useProductVariants.ts` als blauwdruk.
- Nieuw: `src/components/admin/products/ProductEventDatesTab.tsx` — lijst van datums (datum, starttijd, status-badge, capaciteit/minimum, locatie/verzamelpunt), Dialog voor toevoegen én bewerken (Calendar-in-Popover met `pointer-events-auto`, time-input default 21:00, capaciteit verplicht, min. deelnemers default 0, status-Select met enkel `scheduled|confirmed|cancelled|completed`), verwijderen achter een AlertDialog-bevestiging.
- `ProductForm.tsx`: Events & Datums-Card toegevoegd direct ná de Varianten-Card, volgens exact hetzelfde patroon: bij `isEditing && id` de tab, anders de placeholder "Sla het product eerst op om datums te beheren".
- Changelog `2026.09x` (feature, `ticket_product_dates`) met i18n-keys in nl/en/fr/de (94 entries per taal, pariteit gecontroleerd).
- `doc_articles`: tenant-artikel `ticket-product-datums`, categorie `producten`, `context_path = /admin/products`, idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.

**Security-keuzes:** n.v.t. — geen tabel, policy, grant of definer-functie gewijzigd. De nieuwe hook schrijft via de gewone client en is dus volledig afhankelijk van de RLS die in fase 1 op `event_details` gezet is; alle queries filteren bovendien expliciet op `tenant_id` van `useTenant()`.

**Gedeelde-paden-waarschuwing:** `ProductForm.tsx` is de gedeelde product-admin voor álle producttypes. Veilig omdat (1) er niets is hernoemd of verwijderd — enkel een union-lid, een map-entry, een enum-waarde, een boolean en één nieuwe Card toegevoegd; (2) de nieuwe Card zit volledig achter `isTicket`, dus physical/digital/service/subscription/bundle/gift_card renderen identiek; (3) `ticket` valt in de bestaande dienst-branche van `handleProductTypeChange`, waardoor het gedrag van de andere types onaangeroerd blijft; (4) geen enkele storefront-edge-function of gedeelde tabel geraakt in deze batch.

**Verificatie:** `tsgo --noEmit -p tsconfig.app.json` slaagt zonder fouten (de vier plekken landen consistent; de eerdere TS2741/TS2322-fouten na het uitbreiden van de union zijn opgelost door de vier plekken samen te wijzigen). Migratie voor `doc_articles` succesvol toegepast (eerste poging faalde op de `NOT NULL` van `category_id`; opgelost met de bestaande categorie `producten`). Responsiveness: rijen stapelen onder `sm` (`flex-col` → `sm:flex-row`), dialog gebruikt `max-w-[calc(100vw-2rem)]` + `max-h-[85vh] overflow-y-auto`, formuliergrid is `grid-cols-1` → `sm:grid-cols-2`, en knoppen zijn `w-full` op mobiel — geen horizontale overflow op 390px.

**Bewust ongemoeid:** bulk-plannen, verplaatsen, overslaan en mergen (statussen `skipped`/`merged` staan bewust niet in de Select) — dat is fase 3c. Ticketverkoop in de storefront/checkout en `ticket_instances` blijven ongewijzigd.

**Vervolg:** newsletter-item nog OPENSTAAND — pas versturen als de volledige ticketverkoop-flow rond is (fase 6), niet bij deze admin-only stap.

## TICKET-2 — event-info in storefront-api (fase 2 van event-tickets) — 14 augustus 2026

**Doel:** ticket-producten leveren event-info mee via `storefront-api`; alle andere producttypes houden een identieke response.

**Recon (vóór schrijven):**
- `supabase/functions/storefront-api/index.ts`: bundle-branche in `getProduct` op regel 459 (`if (product.product_type === 'bundle')`), return-payload 494-539. Bevestigd dat `...bundleData` daar TWEE keer werd gespread (regel 527 én 538) — dezelfde sleutels, dus functioneel onschuldig maar dubbel.
- Fase-1 definer-functies bestaan in `supabase/migrations/20260813231325_*.sql`: `public.get_public_events(uuid)` (regel 103) en `public.get_event_signup_count(uuid)` (regel 132), beide met `GRANT EXECUTE ... TO anon, authenticated` (regels 145-146), dus aanroepbaar via `supabase.rpc`.

**Uitgevoerd (1 bestand):**
- `getProduct` (single): direct na de bundle-branche een `eventData`-blok toegevoegd dat alleen bij `product_type === 'ticket'` `event_details` opvraagt (toekomstige datums, status niet in cancelled/skipped/merged, gefilterd op `product_id` + `tenant_id`) en per event `tickets_sold`, `spots_left` en `min_reached` berekent via `get_event_signup_count`. Resultaat als `event: { upcoming: [...] }`.
- Return-payload: `...eventData` op ÉÉN plek toegevoegd, naast de overgebleven `...bundleData`. De dubbele `...bundleData` op regel 527 verwijderd; er staat er nu exact één (onderaan). Sleutelnamen en -waarden blijven identiek, alleen de spread-positie is ontdubbeld.
- `getProducts` (lijst): één batch-query op `event_details` voor alle ticket-product-ids van de huidige pagina (niet per product) vult `nextEventDateMap`. In het productobject wordt `next_event_date` enkel toegevoegd via conditionele spread wanneer `product_type === 'ticket'`.

**Security-keuzes:** n.v.t. — geen RLS, policy of grant gewijzigd. `event_details` wordt gelezen met de bestaande service-role client van de function, maar altijd gefilterd op `tenant_id`, conform de marketplace-isolatiestandaard. De RPC `get_event_signup_count` was in fase 1 al gegrant aan `anon`/`authenticated`.

**Gedeelde-paden-waarschuwing:** `storefront-api` is een gedeeld pad voor Loveke, VanXcel, Astra Sleep, Mancini Milano en Zona Dorata. Veilig omdat: (1) geen bestaande query, veld of branche gewijzigd; (2) alle nieuwe velden zitten achter een `product_type === 'ticket'`-guard, en er bestaan nog geen ticket-producten; (3) niet-ticket producten krijgen de sleutels `event` en `next_event_date` niet — ze zijn afwezig, niet `null`; (4) het ontdubbelen van `...bundleData` verandert geen sleutel of waarde.

**Verificatie (na deploy):**
- `storefront-api` succesvol gedeployed.
- `get_product` voor Loveke (`unisex-tank-top`) en VanXcel (`vanxcel-switch-panel-5-slots`), beide physical: identieke top-level keys — barcode, category, compare_at_price, description, featured_image, has_variants, id, images, in_stock, is_variant_product, name, options, parent_product_id, price, product_type, related_products, reviews, selected_variant_index, seo, short_description, size_guide, sku, slug, stock, tags, variants, weight. Geen `event`-key aanwezig (`has event: False` voor beide).
- `get_products` voor Loveke (3 producten): keys bundle_calculated_price, bundle_individual_total, bundle_pricing_model, bundle_savings, category, compare_at_price, description, featured_image, has_variants, id, images, in_stock, is_featured, name, price, price_range, product_type, sku, slug, stock, tags. `next_event_date` afwezig bij alle drie.

**Bewust ongemoeid:** `storefront-resolve`, `checkout-engine`, alle gedeelde tabellen, de `get_public_events`-RPC (nog niet nodig voor deze twee acties), en de cart/checkout-paden. Geen changelog- of nieuwsbriefitem: de feature is nog niet tenant-zichtbaar zolang er geen ticket-producten bestaan.

**Vervolg:** fase 3 — ticket-producten aanmaakbaar maken in de admin en `ticket_instances` genereren bij betaling.

## ODOO-OSS-RETRO — admin-tools voor de OSS-move-correctie — 14 augustus 2026

**Root cause:** ODOO-OSS-1/2 fixten de sync alleen vooruit. Drie reeds geboekte Odoo-moves van VanXcel staan nog op de Belgische binnenlandse tax (id 3) i.p.v. de NL-OSS-tax (id 120): 1322 (INV-2026-0157), 1213 (CN-2026-0002), 1323 (CN-2026-0004). Er bestond geen veilige weg om dat vanuit SellQo recht te zetten; enkel handmatig in Odoo.

**Recon (vóór schrijven):** `supabase/functions/odoo-list-taxes/index.ts` volledig gelezen als template: auth via `authenticateRequest(req, tenantId)` + `requireRole(auth, tenantId, ['tenant_admin'])` (platform-admin bypasst in `requireRole`), credentials uit `tenant_odoo_credentials` met `decryptOdooKey`, RPC via `odooAuthenticate`/`odooExecKw` uit `_shared/odooRpc.ts`, `assertValidOdooUrl` als SSRF-guard. CORS-object en error-handling byte-voor-byte overgenomen.

**Uitgevoerd (twee nieuwe bestanden, niets bestaands gewijzigd):**
- `supabase/functions/odoo-read-move/index.ts` — READ-ONLY. Input `{ tenant_id, move_ids: number[] }`. Leest `account.move` (id, name, state, move_type, amount_total, amount_tax, invoice_line_ids), verzamelt alle `invoice_line_ids` en leest `account.move.line` (id, name, move_id, tax_ids, price_subtotal, price_total, account_id, display_type). Retourneert rauwe JSON per move met header + regels. Geen write, geen state-change.
- `supabase/functions/odoo-correct-move-tax/index.ts` — WRITE, defensief. Input `{ tenant_id, move_id, from_tax_id, to_tax_id, dry_run? }`. Draait nooit automatisch: geen cron, geen trigger, enkel expliciete aanroep met exacte parameters. Stappen: (1) move lezen, 404 als onbekend; (2) productregels (`display_type` leeg of `'product'`) met `from_tax_id` selecteren — geen enkele treffer én ook geen `to_tax_id` aanwezig → harde error `Move <id> has no line with tax <from_tax_id> — aborting`, zodat een fout doelwit niet stil geschreven wordt; (3) `dry_run === true` retourneert move + geplande line-wijzigingen en STOPT; (4) originele state onthouden, bij `posted` een `button_draft`; (5) per regel `tax_ids: [[6,0,newTaxIds]]` waarbij enkel `from_tax_id` door `to_tax_id` vervangen wordt en andere taxes behouden blijven; (6) bij oorspronkelijk `posted` een `action_post`; (7) move + regels herlezen en de nieuwe staat (tax_ids, amount_tax, state) als bewijs teruggeven.
- Idempotentie: als geen regel `from_tax_id` heeft maar er wél al een regel op `to_tax_id` staat, komt `already_corrected: true` terug i.p.v. een error — een dubbele aanroep is veilig.
- Compensatie: alles zit in try/catch. Faalt er iets ná `button_draft` maar vóór `action_post`, dan probeert de catch de move terug te posten en rapporteert `recovery` + `manual_check_required: true`.

**Security-keuzes:** geen DB-migratie, geen RLS, geen policies, geen grants. Beide functies vereisen een geldige JWT met de rol `tenant_admin` op de opgegeven tenant; platform-admins bypassen via `requireRole`. `authenticateRequest(req, tenantId)` blokkeert cross-tenant gebruik (403). De Odoo-URL gaat door `assertValidOdooUrl` (https-only, geen IP's/localhost, geen pad/query) als SSRF-guard. API-keys worden alleen in-memory ontcijferd en nooit gelogd of geretourneerd. De write-functie is niet aan cron of trigger gekoppeld.

**Gedeelde-paden-waarschuwing:** niet van toepassing. `storefront-api`, `checkout-engine`, `storefront-resolve` en de gedeelde tabellen zijn niet aangeraakt; enkel twee nieuwe, losstaande edge functions. De vijf custom frontends merken er niets van.

**Verificatie:** beide functies gedeployed. Geen correctie gedraaid — bouwen en deployen was de volledige scope van deze batch. De feitelijke rechtzetting van 1322/1213/1323 gebeurt in een aparte, expliciete aanroep (eerst `odoo-read-move`, dan `odoo-correct-move-tax` met `dry_run: true`, pas daarna de echte write).

**Bewust ongemoeid / Vervolg:** `sync-odoo-invoices` niet aangeraakt. Changelog, `doc_articles` en newsletter bewust overgeslagen: interne admin-tools zonder tenant-zichtbaar scherm of gedragswijziging. Vervolg: de drie moves rechtzetten via de nieuwe tools (from_tax_id 3 → to_tax_id 120, tenant VanXcel).

## ODOO-OSS-2 — creditnota-sync regime-bewust maken — 14 augustus 2026

**Root cause:** `syncCreditNote` in `supabase/functions/sync-odoo-invoices/index.ts` gaf hardcoded `{ vat_regime: null, reporting_country: null }` door aan `buildOdooLines`. Daardoor landen OSS-creditnota's (terugbetalingen van EU-B2C-verkopen) op de Belgische binnenlandse tax i.p.v. de landspecifieke OSS-tax — exact dezelfde misboeking die ODOO-OSS-1 op het factuur-pad oploste, maar dan bij refunds. Er staan reeds 2 fout geboekte moves: CN-2026-0002 en CN-2026-0004 (beide bron NL/`oss_b2c_eu`).

**Recon (vóór schrijven):** `syncCreditNote` (r415-486) gelezen. Bevestigd dat `syncInvoice` al correct regimeCtx doorgeeft (r381-384) en dat `resolveTax`/`buildOdooLines` de OSS-logica al hebben uit ODOO-OSS-1 — die niet opnieuw aangeraakt. De koppeling naar de bron-factuur bestaat via `credit_notes.original_invoice_id`.

**Uitgevoerd (`supabase/functions/sync-odoo-invoices/index.ts`, enige gewijzigde functiebestand):**
- `credit_notes`-select uitgebreid met `original_invoice_id`.
- Na het laden van de creditnota: als `cn.original_invoice_id` bestaat, losse query `select('vat_regime, reporting_country').from('invoices').eq('id', cn.original_invoice_id).maybeSingle()`. Bouw daaruit `regimeCtx`; als geen `original_invoice_id` of geen bron-rij → veilige niet-OSS-terugval `{ vat_regime: null, reporting_country: null }` (geen crash, geen error).
- `buildOdooLines(ctx, lines, regimeCtx)` i.p.v. de hardcoded null. De verouderde "known follow-up"-comment verwijderd; de follow-up is hiermee gesloten.
- `syncInvoice`, `resolveTax`, `buildOdooLines` en alle andere functies blijven byte-identiek.

**Security-keuzes:** n.v.t. — geen DB-migratie, geen RLS, geen policies, geen grants. Puur server-side boekhoud-sync-logica met service-role en bestaande Odoo-credentials.

**Gedeelde-paden-waarschuwing:** niet van toepassing. `storefront-api`, `checkout-engine`, `storefront-resolve` en de gedeelde tabellen zijn niet aangeraakt. De vijf custom frontends merken er niets van.

**Verificatie (statisch, geen productie-sync gedraaid):**
- OSS-creditnota (bron-factuur NL/`oss_b2c_eu`, lijn 21%): `regimeCtx = { vat_regime: 'oss_b2c_eu', reporting_country: 'NL' }` → `buildOdooLines` geeft `{ oss: true, country: 'NL' }` mee → `resolveTax` kiest tax id 120 "21.0% NL BTW". Niet id 3.
- Binnenlandse creditnota (bron BE/`domestic_standard`): niet-OSS-pad, ongewijzigd → id 3.
- Handmatige creditnota zonder `original_invoice_id`: `regimeCtx = { vat_regime: null, reporting_country: null }` → niet-OSS-terugval, geen error.
- Reeds fout geboekte moves 1213 (CN-2026-0002) en 1323 (CN-2026-0004) vergen een aparte handmatige move-correctie in Odoo — de code-fixt alleen nieuwe syncs, niet retroactief.

**Bewust ongemoeid / Vervolg:** partner-logica, journal-keuze, B2C-aggregatie, Peppol, auto-post en `move_type: 'out_refund'` niet aangeraakt. De retroactieve correctie van CN-2026-0002 en CN-2026-0004 in Odoo is een handmatige boekhouderstaak buiten de scope van deze batch. Changelog `2026.09w` uitgerold in 4 talen. `doc_articles` overgeslagen: interne boekhoud-sync-logica, geen tenant-zichtbaar scherm of route. Newsletter overgeslagen: geen aankondigbare functiewijziging voor tenants.



**Root cause:** `resolveTax` in `supabase/functions/sync-odoo-invoices/index.ts` was regime-blind. De functie zocht uitsluitend op `[['amount','=',rate],['type_tax_use','=','sale']]` met `limit: 1` en nam de eerste treffer. Voor OSS-verkopen naar een ander EU-land (`vat_regime = 'oss_b2c_eu'`) landde een 21%-lijn daardoor op de Belgische BINNENLANDSE tax (VanXcel: id 3 "21%") in plaats van de landspecifieke OSS-tax (id 120 "21.0% NL BTW"). Gevolg: OSS-omzet werd stil als binnenlandse btw geboekt.

**Recon (vóór schrijven):** `resolveTax` (r166), `buildOdooLines` (r262), `syncInvoice` invoice-/lines-select (r285-298) en interface `SellqoLine` (r255) gelezen. Vastgesteld dat `syncCreditNote` (r362) dezelfde `buildOdooLines`/`resolveTax` deelt. Kolomcontrole via SQL: `invoices.vat_regime`, `invoices.reporting_country`, `invoice_lines.vat_box_code` en `invoice_lines.gl_account_code` bestaan alle vier.

**Uitgevoerd (`supabase/functions/sync-odoo-invoices/index.ts`, enige gewijzigde functiebestand):**
- Invoice-select uitgebreid met `reporting_country, vat_regime`; lines-select met `vat_box_code, gl_account_code`. `SellqoLine` uitgebreid met optionele `vat_box_code?` en `gl_account_code?`.
- `resolveTax(ctx, rate, opts?: { oss?: boolean; country?: string | null })`. Zonder `opts.oss` (of zonder land) exact het oude pad: rate + `type_tax_use=sale`, `limit: 1`, cache-key `<rate>`. Met `opts.oss` een `search_read` op `[['amount','=',rate],['type_tax_use','=','sale'],['name','ilike','OSS']]` met velden `id,name,tax_group_id`, waarna in code gefilterd wordt op de tax waarvan de naam het bestemmingsland-ISO bevat (woordgrens-regex, dus "NL" matcht niet binnen een ander woord). Levert dat niets, dan een rate-only `search_read` met match op tax_group-naam die met "OSS" begint plus land-ISO in de naam. Cache-key `oss:<LAND>:<rate>`.
- Geen stille fallback: vindt het OSS-pad geen landspecifieke tax, dan `throw new Error('No Odoo OSS tax for <LAND> <rate>%')`. Zichtbaar falen boven misboeken.
- `buildOdooLines(ctx, lines, regimeCtx)` met `regimeCtx: { vat_regime, reporting_country }`. Bij `vat_regime === 'oss_b2c_eu'` gaat `{ oss: true, country: reporting_country }` mee naar `resolveTax`, anders geen opts. `syncInvoice` geeft de waarden van de factuur mee.

**Security-keuzes:** n.v.t. — geen DB-migratie, geen RLS, geen policies, geen grants. De functie draait ongewijzigd met service-role en de bestaande per-tenant Odoo-credentials; de auth-/journal-/partner-logica is niet aangeraakt.

**Gedeelde-paden-waarschuwing:** niet van toepassing. `storefront-api`, `checkout-engine` en `storefront-resolve` zijn niet aangeraakt en er is geen gedeelde tabel gewijzigd. Dit is puur server-side boekhoud-sync-logica; de vijf custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) zien er niets van.

**Verificatie (statisch, geen productie-sync gedraaid):**
- NL-OSS-factuur (`reporting_country = 'NL'`, `vat_regime = 'oss_b2c_eu'`, lijn 21%): OSS-pad, domein met `name ilike 'OSS'`, naam-match op "NL" → tax id 120 "21.0% NL BTW". Niet id 3.
- Binnenlandse BE-factuur (`domestic_standard`, 21%): niet-OSS-pad, byte-identiek aan het oude gedrag → id 3.
- IC-goederen en export buiten EU op 0%: niet-OSS-pad, ongewijzigd → id 13 "0% EU M" / id 15 "0% EX".
- Onbekend OSS-land zonder passende tax: expliciete `No Odoo OSS tax for <LAND> <rate>%`-error; de sync markeert de factuur als mislukt in plaats van hem verkeerd te boeken.
- Kolom-audit via SQL bevestigd (zie recon). Typecheck via `tsgo` op de frontend-wijzigingen; de edge function is Deno-code en wordt bij deploy gecontroleerd.

**Bewust ongemoeid / Vervolg:** partner-logica, journal-keuze, B2C-aggregatie, Peppol en auto-post niet aangeraakt. **Bekende follow-up:** `syncCreditNote` deelt `buildOdooLines` maar geeft `{ vat_regime: null, reporting_country: null }` mee, omdat de regime-gegevens van de bron-factuur daar niet triviaal beschikbaar zijn (`credit_notes` wordt geselecteerd zonder join naar de factuur). Creditnota's op OSS-verkopen behouden dus voorlopig het oude niet-OSS-gedrag; dat vraagt een aparte batch die de bron-invoice meeneemt. Changelog `2026.09v` uitgerold in 4 talen. `doc_articles` overgeslagen: interne boekhoud-sync-logica, geen tenant-zichtbaar scherm of route. Newsletter overgeslagen: geen aankondigbare functiewijziging voor tenants.

## TICKET-1 (fase 1) — schema-fundament event tickets — 13 augustus 2026

**Root cause:** n.v.t. — dit is geen fix maar een additief schema-fundament voor een nieuwe feature. Er bestond nog geen enkele opslag voor evenementdata, verkochte tickets of eenmalige wijzigingslinks.

**Recon (vóór schrijven):**
- *Betaald-detectie:* `handle_payment_notification` en `handle_order_notification` zijn puur notificatie-triggers op `orders` (reageren op statuswijzigingen), geen bron-van-waarheid. Het feitelijke "betaald" zetten gebeurt in `stripe-connect-webhook` (idempotent per event), in de POS-paden van `storefront-api` en in de bol-imports. Dat zijn de aangewezen punten om in een latere fase idempotent ticket-instances aan te maken — niet de notificatie-triggers.
- *Tokenpatroon:* `mandate_setup_tokens` heeft `token` (text, unique), `expires_at` (default now() + 7 dagen), `used_at` (nullable), `context` (jsonb, nullable), `created_at`. `ticket_change_tokens` volgt exact dat patroon.
- *Blast radius `product_type`:* geen exhaustieve switch/match zonder default-tak in `src/` of `supabase/functions/`. Alle checks zijn specifieke gelijkheidstests (bv. `=== 'bundle'`, `=== 'gift_card'`). In `ProductForm.tsx` staat een zod-enum die in fase 2 uitgebreid moet worden; die breekt nu niets omdat er nog geen ticket-producten bestaan. De `products`-tabel is niet aangeraakt: 127 kolommen en 9 policies vóór én na de batch.

**Uitgevoerd:**
- Migratie 1: `ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'ticket'` — enum nu `physical, digital, service, subscription, bundle, gift_card, ticket`.
- Migratie 2: nieuwe tabellen `public.event_details`, `public.ticket_instances`, `public.ticket_change_tokens` + RLS + de security-definer helpers `public.get_public_events(p_tenant_id uuid)` en `public.get_event_signup_count(p_event_detail_id uuid)`.
- Migratie 3 (grant-lockdown, zie Security): `REVOKE ALL ... FROM anon` op alle drie de tabellen, `REVOKE ALL ... FROM authenticated` op `ticket_change_tokens` en `ticket_instances`, daarna gericht `GRANT SELECT, UPDATE ON ticket_instances TO authenticated`.

**Security-keuzes:**
- Eerste migratiepoging faalde op `ERROR 42725: function public.get_user_tenant_ids() is not unique` — er bestaan twee overloads (zonder args en met `_user_id uuid`). Alle policies gebruiken nu de expliciete vorm `tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))`, conform het patroon in de bestaande migraties.
- **Bevinding om te onthouden:** dit project heeft default privileges die nieuwe public-tabellen automatisch volledige rechten geven aan `anon` én `authenticated` (SELECT/INSERT/UPDATE/DELETE/TRIGGER/TRUNCATE/REFERENCES/MAINTAIN). Een `CREATE TABLE` zonder expliciete `REVOKE` levert dus stil een anon-grant op. RLS blokkeerde de rijen al (geen anon-policy), maar table-level rechten zijn nu weggehaald zodat de grant-laag en de policy-laag hetzelfde zeggen.
- `event_details`: 4 policies (select/insert/update/delete), alle `TO authenticated` met tenant-check + `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff'])`. Anon heeft geen enkel recht; de publieke weg loopt uitsluitend via `get_public_events`.
- `ticket_instances`: 2 policies (select/update) voor tenant_admin/staff — bekijken en check-in. Insert/delete bewust niet: die komen in fase 2 van de service-role.
- `ticket_change_tokens`: RLS aan, **0 policies**, geen grants voor anon of authenticated. Volledig dichtgezet; de e-mailknoppen lopen in een latere fase via een edge function met service-role.

**Gedeelde-paden-waarschuwing:** `storefront-api`, `checkout-engine` en `storefront-resolve` zijn niet aangeraakt. De gedeelde tabellen (`products`, `tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`) zijn niet gewijzigd — geen kolom bij, geen policy aangeraakt. Een nieuwe enum-waarde is voor de vijf custom frontends onzichtbaar zolang geen product hem gebruikt, en de recon toonde aan dat geen enkele consumer op een exhaustieve match zonder default-tak leunt. Het JSON-contract is byte-voor-byte identiek.

**Verificatie:**
- `products`: 127 kolommen / 9 policies vóór en na — ongewijzigd.
- Enum bevat `ticket`; RLS staat aan op alle drie de tabellen (`relrowsecurity = true`).
- Policy-telling: `event_details` 4, `ticket_instances` 2, `ticket_change_tokens` 0 (bedoeld).
- Grant-natrek via `aclexplode(relacl)` ná de lockdown: `anon` komt op geen van de drie tabellen meer voor; `authenticated` heeft enkel `event_details` (select/insert/update/delete) en `ticket_instances` (select/update); `ticket_change_tokens` heeft voor beide rollen niets.
- Beide helpers zijn `prosecdef = true` met `search_path = public` en EXECUTE voor anon/authenticated/service_role.
- Rol-impersonatie via `SET LOCAL ROLE anon` was niet uitvoerbaar: de query-runner weigert met `42501: permission denied to set role "anon"`. De grant-diff hierboven is daarom het bewijs in plaats van een rijtelling per rol; een echte anon-meting volgt in fase 2 zodra `get_public_events` via de storefront wordt aangeroepen.

**Bewust ongemoeid / Vervolg:** geen UI, geen `storefront-api`-wijziging, geen frontend — conform de opdracht. Changelog, `doc_articles` en `docs/newsletter-queue.md` overgeslagen: deze batch verandert geen tenant-zichtbaar gedrag (lege tabellen, geen bereikbare feature); die slottaken horen bij de fase waarin tickets daadwerkelijk verkoopbaar worden. Open voor fase 2: zod-enum in `ProductForm.tsx` uitbreiden, idempotente ticket-creatie in `stripe-connect-webhook` en de POS/bol-betaalpaden, insert-pad voor `ticket_instances` via service-role, en de edge function achter `ticket_change_tokens`.

## GUEST-VAT-1 — btw-regime bij gast-bestellingen + read-only Odoo-tax recon — 13 augustus 2026

**Root cause:** in `supabase/functions/generate-invoice/index.ts` werd de btw-regime-resolutie alleen uitgevoerd wanneer `order.customer_id` bestond. Gast-bestellingen (`customer_id` NULL) vielen in de `else`-tak met de log `"VAT regime skipped — guest order, using fallback"` en kregen daardoor altijd `domestic_standard`. Cross-border EU B2C gast-verkopen (bv. NL met OSS actief) en verkopen buiten de EU werden zo in het verkeerde btw-vak geboekt. De pure beslisboom `decideVatRegime` in `supabase/functions/_shared/regimeResolver.ts:138` heeft geen customer-record nodig; alleen de DB-variant `resolveVatRegime` doet een verplichte customer-lookup.

**Uitgevoerd:**
- `supabase/functions/generate-invoice/index.ts` — uitsluitend de guest-`else`-tak vervangen. `decideVatRegime` wordt nu gevoed met `customer_country` (`shipping_address.country` → `billing_address.country` → `tenant.country`), `tenant_country`, `is_b2b` uit `order.customer_type`, `vies_valid: false`, OSS-vlaggen defensief uit `oss_enabled`/`apply_oss_rules`, activatiedatum uit `oss_activation_date`/`oss_registration_date`, `simplified_vat_mode`, de al bepaalde `salesChannel`, `order_date` uit `order.created_at` en `has_goods: true`. `perLineRegime` wordt in dezelfde vorm opgebouwd als de niet-guest-tak: `vat_rate` via `rateForRegime`, `vat_box_code` via `REGIME_TO_BOX` (leeg voor `oss_b2c_eu`), `gl_account_code` via `REGIME_TO_GL`. Import uitgebreid met `decideVatRegime`, `rateForRegime`, `REGIME_TO_BOX`, `REGIME_TO_GL`. Log: `"VAT regime resolved (guest)"`.
- `supabase/functions/odoo-list-taxes/index.ts` — nieuwe read-only recon-functie. `authenticateRequest` + `requireRole(auth, tenant_id, ['tenant_admin'])` (platform-admin bypasst in `requireRole`), credentials uit `tenant_odoo_credentials` ontsleuteld via `_shared/odooCrypto.ts`, URL door `assertValidOdooUrl`, `account.tax` `search_read` met domein `[['type_tax_use','=','sale']]`, velden `id,name,amount,amount_type,price_include,tax_group_id,country_id,description`, `limit: 200`. Response: `{ success, company_name, taxes }`. Geen enkele schrijfactie naar Odoo.
- Slottaken: changelog `2026.09u` / `guest_checkout_vat_classification` (type `bugfix`) in `PublicChangelog.tsx` en in alle vier `landing.*.json`.

**Security-keuzes:** geen RLS-, policy- of grant-wijziging, geen migratie. De nieuwe functie leest alleen; de Odoo-API-key wordt ontsleuteld in het geheugen van de functie en nooit gelogd of teruggegeven. Autorisatie volgt exact het patroon van `test-odoo-connection`/`sync-odoo-invoices`.

**Gedeelde-paden-waarschuwing:** `storefront-api` en `checkout-engine` zijn niet aangeraakt; de gedeelde tabellen (`tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`) evenmin. De wijziging zit volledig in server-side factuurlogica ná de bestelling; het JSON-contract naar de custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) is byte-voor-byte identiek. De bedrag-/totaalberekening (`re-derive totals from resolver`) en de PDF/UBL-generatie zijn ongewijzigd — die logica draaide voorheen simpelweg niet voor gasten omdat `perLineRegime` leeg bleef.

**Verificatie:** `tsgo` typecheck groen. Beslisboom-doorloop (geen productie-testorder): gast → NL met OSS actief geeft `oss_b2c_eu`, rate 21, vak leeg, GL 700500; gast binnenland BE geeft `domestic_standard`, vak 03, GL 700000 (ongewijzigd gedrag t.o.v. de oude fallback); gast → VS geeft `export_outside_eu`, rate 0, vak 47, GL 700400.

**Bewust ongemoeid / Vervolg:** `doc_articles` overgeslagen — interne server-side fix, niet tenant-zichtbaar, geen adminroute om contextuele hulp aan te hangen. `docs/newsletter-queue.md` overgeslagen — geen tenant-zichtbare feature. Bestaande facturen worden niet retroactief geherclassificeerd. `odoo-list-taxes` is puur recon: de regime-bewuste Odoo-tax-mapping in `sync-odoo-invoices` staat nog open.

## WEBSHOP-5A — renderregister en linkoplossing in sectie-renderers — 13 augustus 2026

**Root cause:** de sectie-editor slaat bewust shop-relatieve paden op (`SectionEditor.tsx:66-79` biedt `/products`, `/cart` en `/` aan), maar twee renderers gaven `button_link` rauw aan react-router door: `HeroSection.tsx:61` en `TextImageSection.tsx:43`, plus hun admin-tweelingen `EditableHeroSection.tsx:82` en `EditableTextImageSection.tsx:66`. Een knop met `/products` navigeerde daardoor naar de admin-app in plaats van naar de winkel. Het correcte patroon bestond al in `CollectionSection.tsx:77`. Tweede, niet eerder gemelde bug: react-router staat op `^6.30.1`, waarin `<Link to="https://...">` een absolute URL als relatief pad behandelt — een externe link in `button_link` eindigde dus als `/shop/<slug>/https://voorbeeld.nl`.

**Uitgevoerd:**
- (1) `src/lib/shopLinks.ts` — nieuwe pure helper `resolveShopLink(link, basePath)` die `{ href, isExternal }` teruggeeft. Idempotent: een pad dat al met `basePath` begint blijft ongemoeid. De grenscontrole checkt expliciet op `/`, `?` of `#` achter `basePath`, zodat `/shop/demo` niet ten onrechte matcht op `/shop/demo-bakkerij`. Onveilige schemes (`javascript:`, `data:`, `vbscript:`) worden weggegooid; fragmenten en query-only links blijven ongemoeid. 28 tests in `shopLinks.test.ts`.
- (2) `src/components/storefront/sections/registry.tsx` — nieuw `Record<HomepageSectionType, ComponentType<SectionRenderProps>>` als enige bron van waarheid voor de mapping van sectie-type naar component. `ShopHome.tsx` gebruikt het via een `map` in plaats van een handmatige `switch`. Zuivere refactor: dezelfde negen componenten, dezelfde `key`, en een onbekend type levert net als voorheen `null` op. Vier componenten krijgen nu `tenantId` en alle negen `basePath` mee, wat aantoonbaar effectloos is omdat `AnnouncementSection`, `TestimonialsSection`, `TextImageSection` en `VideoSection` die props niet declareren. Vijf tests in `registry.test.ts`.
- (3) De vier renderers gebruiken de helper. De twee winkelrenderers krijgen `basePath` via het register; de twee admin-tweelingen halen het winkelpad uit `useTenant()`, omdat de route `/admin/storefront` geen `tenantSlug` kent en `useParams` daar `/shop/undefined/products` zou opleveren. Externe links renderen als `<a>` met `target="_blank"` en `rel="noopener noreferrer"`.
- (4a) Migratie `20260813120000_webshop5a_seed_relative_links.sql` — `UPDATE` op uitsluitend `tpl-mode`, `tpl-food` en `tpl-minimal` in `public.themes` die de `{{shop}}`-placeholder uit `seed_definition` verwijdert. Idempotent via een `WHERE` op de placeholder. Bewust geen `INSERT ... ON CONFLICT` zoals WEBSHOP-3, omdat dat ook `name`, `description`, `default_settings` en `sort_order` zou overschrijven.
- (4b) Placeholder-logica uit de code: `resolveShopPaths` (21 regels), de `shopPath`-const en de export `SHOP_PATH_PLACEHOLDER` zijn verwijderd; seed-content gaat nu ongewijzigd door.
- Slottaken: changelog-entry `storefront_section_buttons` in `PublicChangelog.tsx` (versie 2026.09t) en in alle vier de `landing.*.json`; `doc_articles`-migratie `20260813140000` met `context_path = '/admin/storefront'`; item in `docs/newsletter-queue.md`.

**Security-keuzes:** geen RLS-, policy- of grant-wijziging. Eén verharding toegevoegd: `resolveShopLink` gooit `javascript:`, `data:` en `vbscript:` weg in plaats van ze door te geven. `button_link` is tenant-invoer die op een publieke winkelpagina in een `href` terechtkomt, dus dat was een reële injectievector. Gevolg is dat zo'n waarde nu geen knop meer oplevert in plaats van een knop die scriptcode uitvoert.

**Gedeelde-paden-waarschuwing (G1):** deze batch raakt `ShopHome`, het publieke renderpad van elke SellQo-winkel, en `themes`, een gedeelde tabel. Beide zijn veilig voor de vijf custom-frontend tenants:
- **Geen sleutelnaam gewijzigd.** `button_link`, `overlay_opacity` en alle andere sleutels binnen `content` en `settings` zijn onaangeroerd. Alleen de interpretatie bij het renderen verandert. `storefront-api/index.ts:766` geeft `content` verbatim door via de publieke actie `get_homepage` (`index.ts:3637`), dus het contract blijft identiek.
- **Geen React-component gedeeld.** Geverifieerd: `grep` op `components/storefront` in `supabase/functions/` geeft nul treffers. De custom frontends renderen zelf.
- **`homepage_sections` niet aangeraakt.** Bewust besluit, vastgelegd in `docs/webshop-batch-5a-recon.md` §6. VanXcel en Loveke hebben rijen uit februari 2026 waarvan niet aantoonbaar is of hun frontend ze nog opvraagt: `get_homepage` is publiek zonder API-key-check, er is geen telemetrie, hun repos zijn hier niet beschikbaar, en de proxy-probe uit `docs/sellqo-proxy-recon.md` vond geen homepage-pad maar heeft `/homepage` ook nooit geprobeerd. Bij onzekerheid geldt afblijven. Dat kan omdat `resolveShopLink` idempotent is en hun bestaande absolute waarden ongewijzigd naar hetzelfde doel oplossen.
- **Migratie strikt smal.** Alleen drie rijen in `themes`, geen kolomwijziging. Na uitvoering geverifieerd op core: drie templates zonder placeholder, nul themes met `{{shop}}`, nul `homepage_sections` met `{{shop}}`, en Bold/Classic/Modern ongemoeid.

**Verificatie:** vitest van 16 naar 49 tests, alle groen. `tsc --noEmit` exit 0 na elke stap. `eslint` gelijk aan baseline op elk gewijzigd bestand (nul problemen voor en na op de vier renderers en op `useTemplateSeed`/`types/storefront`). Migratie vooraf gesimuleerd op de bron-JSON: geldig resultaat met `/products`, `/page/about` en `/page/contact`.

**Bewust ongemoeid:** de vijf sectie-types zonder inline-bewerkbare tweeling blijven op `EditableGenericSection` vallen; dat lost 5B op. `PreviewPanel` en `VisualEditorCanvas` zijn niet aangepast. De februari-rijen van VanXcel en Loveke blijven staan tot een netwerk-check op hun live sites uitwijst dat opruimen veilig is.

**Vervolg:** 5B bouwt het WYSIWYG-canvas op dit register, waarna de vier tweelingen en `EditableGenericSection` vervallen. 5C krijgt een eigen recon wegens het opslagformaat van `storefront_pages.content`.

## ONBOARD-REMOUNT-1 — wizard viel terug naar stap 1 na tenant-creatie — 11 augustus 2026

**Root cause:** de ONBOARD-ROLES-1 fix riep na tenant-creatie `refetchRoles()` aan. Die functie zet `rolesLoading = true` (`src/hooks/useAuth.tsx`), waarop `ProtectedRoute` (`if (loading || (user && rolesLoading)) → spinner`) de hele admin-boom unmount: `AdminLayout` → `TenantProvider` + `OnboardingWizard`. Daardoor gingen alle in-memory refs verloren (`hasCreatedTenantRef`, `hasInitiallyChecked`, `isCreatingTenantRef`) plus de nog niet-gerenderde `setState({ createdTenantId })`. Na `rolesLoading = false` remountte `AdminLayout` — zichtbaar als een dubbele `[useTenant] No tenants found, checking for orphaned tenant...` en een dashboard dat enkele seconden zichtbaar was. De verse `checkOnboardingStatus` had `hasCreatedTenantRef = false`, zodat de skip-guard niet greep, en forceerde via `isNewUser && isInitialCheck` een verse user terug naar stap 1 — waar de zojuist aangemaakte slug als "al in gebruik" verscheen. Bijkomend: `useShopHealth` instantieert een tweede `useOnboarding`, wat log-ruis en extra profiel-writes gaf.

**Uitgevoerd:**
- (A) `src/hooks/useAuth.tsx`: `refetchRoles(opts?: { silent?: boolean })`. Met `silent` blijft `rolesLoading` ongemoeid, zodat `ProtectedRoute` niet unmount; `setRoles(fresh)` draait altijd. Type in de context-interface bijgewerkt. Invite-accept (`AcceptInvitation.tsx`) behoudt onveranderd het luide pad.
- (B) `src/hooks/useOnboarding.ts`: beide `refetchRoles()`-calls (succes-pad van `createTenant` en `completeOnboarding`) gebruiken nu `{ silent: true }`. `startStep` forceert stap 1 alleen nog bij `savedStep <= 1`, zodat persisted voortgang gerespecteerd wordt na een eventuele remount.
- (C) `src/hooks/useOnboarding.ts`: `onboarding_step: 4` wordt vastgelegd direct na `hasCreatedTenantRef.current = true` en vóór `refreshTenants`/`refetchRoles` — additief en idempotent (`nextStep` schrijft daarna hetzelfde), als vangnet bij een onverwachte remount.

**Security-keuzes:** n.v.t. — `refetchRoles` blijft exact dezelfde `user_roles`-read met dezelfde RLS; enkel de loading-state-flip is optioneel gemaakt. De extra `profiles`-update loopt onder de bestaande eigen-profiel-policy. Geen policies, grants of routes gewijzigd.

**Vervolg:** de dubbele `useOnboarding`-instantie via `useShopHealth` blijft bestaan (log-ruis, extra profiel-writes). Kandidaat voor opruiming zodra de onboarding-state naar één provider verhuist.

## SHIP-RESET-1 — verzendkeuze resetten bij checkout-start — 10 augustus 2026

**Root cause:** `checkoutStart` in `supabase/functions/storefront-api/index.ts` resette bij het (her)starten van de checkout wel de betalingsvelden (`payment_method`, `stripe_session_id`, `calculated_fee_cents`), maar **niet** `shipping_method_id` / `shipping_cost`. Gevolg: een verzendmethode uit een vorige sessie (bijv. "Gratis verzending", die geen `shipping_class` heeft) bleef op de cart hangen. Bij een cart met een product dat een specifieke verzendklasse vereist (bijv. boxspring → `shipping_class` 'boxspring', methode €100) werd die stale gratis-methode nooit vervangen: de frontend zag dat de cart al een `shipping_method_id` had, dus de auto-select van de enige geldige class-methode sloeg niet aan. De klant hield €0 verzending. Geverifieerd in de database: zowel een BE- als NL-cart met boxspring hield `shipping_method_id` = "Gratis verzending" (€0).

**Uitgevoerd:** `supabase/functions/storefront-api/index.ts`, functie `checkoutStart` (regels ~2091–2102):
- Het bestaande reset-updateblok (`checkout_status`, `payment_method`, `stripe_session_id`, `calculated_fee_cents`) is chirurgisch uitgebreid met `shipping_method_id: null` en `shipping_cost: 0`.
- Console-log aangepast van `v4 RESET ACTIVE + appfee=0` naar `v5 RESET ACTIVE + appfee=0 + shipping reset`.
- Commentaar bijgewerkt om expliciet te vermelden dat de verzendkeuze nu ook wordt gereset.

**Bewust ongemoeid:**
- De rest van `checkoutStart` is onaangeraakt: stock-validatie, `getCartForCheckout`, en de `buildCartResponse`-return zijn identiek gebleven.
- Geen enkele andere functie is gewijzigd: `checkoutShipping`, `buildCartResponse`, `getShippingMethods`, en `resolveCartShippingClasses` zijn volledig ongemoeid.

**Gedrag na fix:**
- Elke keer dat de checkout (her)start, begint de verzendkeuze opnieuw leeg.
- `buildCartResponse` toont dan de `shippingPreview` (de enige geldige methode) of laat de klant kiezen bij meerdere methoden.
- Voor een boxspring-cart betekent dit dat de €100-methode wordt voorgesteld in plaats van de stale €0-methode.
- Carts zonder specifieke shipping-class krijgen opnieuw hun (enige) methode voorgesteld; eindresultaat identiek, maar niet meer stale.

**Security-keuzes:** geen RLS- of policy-wijziging. Enkel een additieve reset van twee nullable kolommen op de eigen cart binnen dezelfde tenant-scoped update (`eq('id', cartId).eq('tenant_id', tenantId)`).

**Gedeelde-paden-waarschuwing (G1):** `storefront-api` is een gedeeld pad voor alle tenants. De wijziging is louter een correctie van het reset-gedrag bij checkout-start; er is geen tenant-specifieke branching. Alle checkouts gedragen zich nu consistent: verzendkeuze wordt altijd opnieuw bepaald, wat de verwachte gebruikerservaring is.

**Verificatie:** `deno check supabase/functions/storefront-api/index.ts` groen; geen andere wijzigingen in `checkoutStart` of andere functies.

---

## B2B-2a — B2B-velden door checkout naar order+customer — 10 augustus 2026

**Root cause:** de checkout-flow verzamelde geen B2B-gegevens. Beide order-creatie-paden in `supabase/functions/storefront-api/index.ts` bevatten een check `!!(cart.customer_btw_number || cart.is_b2b)`, maar `storefront_carts` had géén van beide kolommen — `customer_btw_number` bestond nooit als kolom, dus de check was dode code die altijd `false` opleverde. Gevolg: elke webshop-order werd als `b2c` weggeschreven en bedrijfsnaam/BTW-nummer landden nooit op order of customer.

**Uitgevoerd:**
- Migratie (idempotent, `ADD COLUMN IF NOT EXISTS`) op `public.storefront_carts`: `is_b2b` (default false), `customer_company_name`, `customer_vat_number`, `customer_vat_verified` (default false), `customer_vat_country`, `customer_vat_company_name` (VIES-naam, apart van klant-invoer).
- `checkoutCustomer`: accepteert optioneel `is_b2b`, `company_name`, `vat_number`, `vat_verified`, `vat_country`, `vat_company_name` en slaat enkel aanwezige velden op. Geen validatie-afdwinging hier (frontend + `block_invalid_vat_orders` volgt in 2b).
- Helpers `b2bOrderFields()`, `b2bCustomerFields()` en `orderCustomerName()` toegevoegd, gebruikt in BEIDE order-paden (`createOrderFromCart` en de verify/bank-flow) zodat er geen drift ontstaat: `customer_type`, `customer_company_name`, `customer_vat_number`, `customer_vat_verified`, `vat_country` op de order; `company_name`/`vat_number`/`vat_verified`/`vat_verified_at` op nieuwe én bestaande customers (enkel aanwezige velden, nooit leeg overschrijven); `customer_name` = bedrijfsnaam bij B2B met company_name, anders de bestaande voornaam+achternaam-logica.
- Dode `customer_btw_number`-check in beide paden verwijderd; nu enkel `cart.is_b2b`.

**Bewust ongemoeid:** de BTW-berekening blijft VOLLEDIG ongewijzigd — geen wijziging aan `_shared/vat.ts`, `extractVatFromGross`, `resolveLineVatBatch/Sync`, `tax_amount`, `total`, `vat_rate` of `vat_amount`. Verlegging (reverse charge) komt in B2B-2b.

**Security-keuzes:** geen RLS- of policy-wijziging; enkel additieve nullable kolommen op een bestaande cart-tabel. Kolomnamen vooraf geverifieerd tegen het live schema (`orders`, `customers`, `storefront_carts`).

**Gedeelde-paden-waarschuwing (G1):** `storefront-api` is een gedeeld pad. B2C-checkouts zonder B2B-velden gedragen zich identiek: `is_b2b` blijft `false`, alle nieuwe order-velden worden `null`/`false` en `customer_type` blijft `'b2c'` — exact het effectieve gedrag van vóór deze batch.

**Verificatie:** `deno check supabase/functions/storefront-api/index.ts` groen; `rg customer_btw_number` levert 0 hits in `supabase/functions/` en `src/`.

## LOVEKE-PHONE-1 (Deel A) — checkout_phone_required validatie in storefront-api/checkoutCustomer — 10 augustus 2026

**Root cause:** `tenant_theme_settings.checkout_phone_required` bestond al als boolean-kolom, maar werd nooit gelezen in de checkout-flow. De `checkoutCustomer`-handler in `supabase/functions/storefront-api/index.ts` valideerde `email`, `first_name` en `last_name`, terwijl `customer_phone` wel werd opgeslagen zonder verplichtheidscontrole. Voor tenants die telefoon verplicht wilden maken, was er dus geen backend-afdwinging.

**Uitgevoerd:** `supabase/functions/storefront-api/index.ts`, functie `checkoutCustomer` (regels ~1878–1880):
- Na de `last_name`-check en vóór de `emailRegex`-check een additieve, flag-gated telefoonvalidatie toegevoegd.
- Leest `tenant_theme_settings.checkout_phone_required` voor de betreffende tenant via `.maybeSingle()`.
- Alleen als `checkout_phone_required = true` EN `customer.phone` ontbreekt of leeg is, wordt een `VALIDATION_ERROR` teruggegeven met veld `phone`.
- Geen wijziging aan de opslag van `customer_phone` in `updateData`, geen refactor van bestaande e-mail/voornaam/achternaam-checks, geen aanpassing aan andere handlers of shared files.

**Security-keuzes:** geen nieuwe policy of RLS-wijziging. De validatie leest alleen een bestaande tenant-instelling en is volledig additief. Er wordt geen tenant-gevoelige informatie blootgelegd.

**Gedeelde-paden-waarschuwing (G1):** `storefront-api` is een gedeeld pad voor alle tenants. De wijziging is bewust flag-gated: tenants met `checkout_phone_required = false` of `NULL` ervaren geen enkel gedragsverschil. Alleen tenants die de vlag expliciet op `true` zetten, krijgen de nieuwe verplicht-validatie.

**Vervolg:** geen changelog/newsletter/docs voor dit deel A; puur backend-validatie die pas zichtbaar wordt wanneer een tenant de vlag activeert. Deel B kan de vlag aan de storefront-UI koppelen indien gewenst.

## POS snelknoppen tekst-overflow op tablet (vervolg 2A-POS) — 10 augustus 2026


**Root cause:** de snelknoppen-grid in `src/pages/admin/POSTerminal.tsx` gebruikte `grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2`. Op tablet (md-breekpunt) werden de tegels in 8 kolommen verdeeld, waardoor de vaste `aspect-square`-tegels te smal werden. De productlabels (`<span>` voor naam en prijs) en de Cadeaukaart-labels hadden geen `w-full`/`break-words`/`truncate`, zodat lange teksten zoals "VanXcel 500W...", "Cadeaukaart" en "€ 299,00" horizontaal uit de tegels liepen en deels onleesbaar/visueel gebroken werden.

**Uitgevoerd:** `src/pages/admin/POSTerminal.tsx` — uitsluitend de snelknoppen-sectie (regels ~1188–1216):
- Grid-klassen aangepast van `grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2` naar `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2`. Dit geeft bredere tegels: telefoon 2 kolommen, tablet 4 kolommen, desktop 6 kolommen (was maximaal 8).
- Productlabel `<span>` (button.label): className uitgebreid van `text-xs font-medium text-center line-clamp-2` naar `text-xs font-medium text-center line-clamp-2 w-full break-words`.
- Prijs `<span>`: className uitgebreid van `text-xs text-muted-foreground mt-1` naar `text-xs text-muted-foreground mt-1 truncate max-w-full`.
- Cadeaukaart-tekst `<span>Cadeaukaart</span>`: `w-full break-words` toegevoegd (bestaande `text-xs font-medium text-center` behouden).
- Cadeaukaart-tekst `<span>Verkopen</span>`: `w-full text-center break-words` toegevoegd (bestaande `text-[10px] text-muted-foreground` behouden).

**Security-keuzes:** n.v.t. — puur presentatie, geen handlers, state, routes, policies of data-flows gewijzigd.

**Gedeelde-paden-waarschuwing (G1):** de snelknoppen-sectie deelt het product-toevoeg-codepad met `addToCart`, maar enkel de container/tekst-klassen zijn aangepast. De sale-flow en quick-button handlers zijn ongewijzigd.

**Vervolg:** valt onder de reeds aangekondigde changelog `2026.09n` "Kassa vlot op tablet/telefoon" (zelfde feature, afgemaakt). Geen nieuwe changelog-versie, geen newsletter-item, geen docs-wijziging.

## STOREFRONT-SIZEGUIDE — Maatgids in product-detail-response — 9 augustus 2026

**Waarom:** na LOVEKE-POD-2-SIZEGUIDE heeft `products` een `size_guide` JSONB-kolom die bij import uit Printful wordt gevuld, maar `storefront-api` gaf die kolom niet door in `getProduct()`. Custom frontends (zoals Loveke) kunnen de productspecifieke maatgids dus niet tonen.

**Uitgevoerd:**
- `supabase/functions/storefront-api/index.ts`: in het return-object van `getProduct()` één veld toegevoegd:
  `size_guide: product.size_guide || null,`
  geplaatst bij de andere product-metadata (na `tags`).
- De query gebruikte al `.select('*')`, dus `product.size_guide` was al beschikbaar; geen query-wijziging nodig.
- `getProducts()` (lijstweergave) ongemoeid gelaten — alleen de product-detail geeft de maatgids mee.

**Security-keuzes:** additief, geen nieuwe policy of RLS-wijziging. `size_guide` bevat publieke productinformatie en wordt net als `weight`, `tags` en `images` in de anonieme storefront-response opgenomen. Geen infrastructuur- of tenantgevoelige data.

**Vervolg:** frontend-weergave van de maatgids (Loveke custom frontend) is een aparte taak buiten deze core-wijziging.

**Geverifieerd:** tsgo zonder errors; `getProduct` response bevat nu `size_guide`.

## LAYOUT-2 Spoor 2A-POS — kassa mobiel/tablet bruikbaar — 10 augustus 2026
**Root cause:** POSTerminal had een tweepaneel-layout waarin het winkelwagen-paneel een vaste `w-96` (384px) had naast een `flex-1` productpaneel, zonder enige mobiele stapeling. Op 390px at de winkelwagen bijna het hele scherm op; op tablet staand bleef er nauwelijks ruimte voor producten.
**Uitgevoerd:** `src/pages/admin/POSTerminal.tsx` — de volledige winkelwagen-JSX (kop, klant/kortingsbalk, items-ScrollArea, totalen, actie- en betaalknoppen) is naar één variabele `cartPanelContent` vlak vóór de return getild. Die ene bron wordt op twee plaatsen gerenderd: het desktop-zijpaneel (`w-96 border-l bg-card hidden lg:flex flex-col`) en een mobiele `Sheet` (`side="bottom"`, `h-[85dvh] lg:hidden p-0 flex flex-col`). Nieuwe state `mobileCartOpen`. Onder de hoofdcontainer staat een `lg:hidden` vaste onderbalk met aantal artikelen + totaal + knop "Afrekenen" die de Sheet opent. Vier kale grids kregen een mobiele kolom-stap: winkelwagen-actiebalk `grid-cols-2 sm:grid-cols-3`, betaalknoppen `grid-cols-2 sm:grid-cols-4`, en in de contant-dialog de snelbedragen `grid-cols-2 sm:grid-cols-4` en `grid-cols-2 sm:grid-cols-3`.
**Security-keuzes:** n.v.t. — puur presentatie, geen tabellen, functies, routes of policies aangeraakt.
**Gedeelde-paden-waarschuwing (G1):** `cartPanelContent` is nu een gedeeld codepad dat twee werelden bedient (desktop-zijpaneel en mobiele Sheet). Wie hier iets wijzigt, wijzigt beide weergaven tegelijk. Bewust NIET aangeraakt: betaal-handlers, cart-state, kortingen, parkeren, `cartTotals`. Enkel container/klassen gewijzigd, zodat lg+ byte-identiek rendert als voorheen.
**Vervolg:** live 390px/768px-verificatie in de kassa (achter admin-login) door Akke; changelog `2026.09n` staat klaar, newsletter-item in de wachtrij.

## POS-header overflow fix (vervolg 2A-POS) — 10 augustus 2026
**Root cause:** de POSTerminal-header hield de actieknoppen (reader-status, Geparkeerd, Kas +/-, Rapport, transactie-historie, instellingen, Dag Sluiten) in een flex-rij zonder `overflow-x-auto`. Op smalle schermen liepen "Rapport" en verder buiten het viewport en waren niet bereikbaar. De terminal-naam had geen `min-w-0`/`truncate`, dus een lange naam duwde de knoppenrij verder het scherm uit.
**Uitgevoerd:** `src/pages/admin/POSTerminal.tsx` — uitsluitend de `<header>`-rij:
- Rechter knoppen-container: className uitgebreid van `flex items-center gap-2` naar `flex items-center gap-2 overflow-x-auto`.
- Alle losse knoppen en de offline-badge in die rij kregen `shrink-0` zodat ze niet samendrukken.
- Linker titel-container kreeg `min-w-0`; de `<h1>` kreeg `truncate`.
- De `<header>` zelf behield `justify-between`; geen andere elementen in het bestand aangeraakt.
**Security-keuzes:** n.v.t. — puur presentatie, geen handlers, state, routes of policies gewijzigd.
**Gedeelde-paden-waarschuwing (G1):** de header is een gedeeld codepad voor desktop en mobiel. De wijziging is bewust alleen CSS-klassen; functionaliteit is ongewijzigd.
**Vervolg:** valt onder de reeds aangekondigde changelog `2026.09n` "Kassa vlot op tablet/telefoon" (zelfde feature, afgemaakt). Geen nieuwe changelog-versie, geen nieuw newsletter-item, geen docs-wijziging.


## SECURITY-PAGES-1 — Publieke Security & Compliance sectie — 8 augustus 2026

**Waarom:** partners en marketplace-integraties vragen naar een aantoonbare security-posture. Die documentatie bestond nergens publiek; alleen juridische pagina's (`sellqo_legal_pages`) waren er.

**Uitgevoerd:**
- `src/data/securityPolicies.ts`: 5 policies (slug, title, icon, summary, version, effectiveDate, markdown) als constante content-map. Bewust *niet* in de DB: dit is statische, versiebeheerde tekst zonder tenant-scope, dus code is de juiste bron van waarheid en er is geen extra RLS-oppervlak.
- `src/pages/public/security/SecurityOverview.tsx` (`/security`) en `SecurityPolicyPage.tsx` (`/security/:slug`), beide op het bestaande `PublicPageLayout` + `PageMeta`, markdown via `react-markdown` in prose-styling (reeds in deps, geen nieuwe dependency).
- `src/App.tsx`: routes uitsluitend in het "Public Pages"-blok; storefront- en admin-blokken ongemoeid, dus geen conflict met tenant-domeinrouting.
- `src/components/landing/LandingFooter.tsx`: "Security" bij de legal-links voor vindbaarheid.
- PDF-knop verwijst statisch naar `marketing-assets/security/<slug>.pdf` (publieke bucket). Bewust geen existence-check: dat zou een netwerk-roundtrip per pageview kosten voor een link die alleen cosmetisch faalt.
- Changelog `2026.09e` (improvement) + i18n `security_compliance_docs` in nl/en/fr/de.
- DOCS-1: `doc_articles` `doc_level='platform'`, slug `publieke-security-compliance-sectie`, `context_path='/security'` — beschrijft waar de sectie leeft, hoe je een policy bijwerkt en waar de PDF's horen. Platform-level omdat dit onderhoudsinstructie is, geen tenant-feature.

**Security-keuzes:** volledig additief. Geen migratie op `sellqo_legal_pages`, geen wijziging aan bestaande routes, geen nieuwe tabel, geen RLS-wijziging. De policy-teksten zijn publiek bedoeld en bevatten geen infrastructuurdetails die exploitatie vergemakkelijken (geen hostnames, versies, project-refs of interne endpoints). Enige DB-write is de idempotente `doc_articles`-insert via `ON CONFLICT (doc_level, slug) DO UPDATE`.

**Geverifieerd:** tsgo zonder errors; `/security` rendert 5 kaarten en alle 5 detailroutes renderen de juiste titel en policy-inhoud.

## Platform-nieuwsbrief opt-in per tenant — 7 augustus 2026

**Root cause:** SellQo verstuurde product-updates zonder dat er ergens een vastgelegde voorkeur bestond. `tenant_newsletter_config` gaat over tenant→klant-mail (Mailchimp/Klaviyo) en `tenant_notification_settings` is een per-type × per-kanaal matrix voor transactionele meldingen; geen van beide modelleert "wil de eigenaar marketingmail *van SellQo zelf*". Zonder eigen kolom is er geen bewijsbare consent-status en geen afmeldmogelijkheid.

**Uitgevoerd:**
- Migratie: `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS platform_newsletter_opt_in boolean NOT NULL DEFAULT true` — bestaande rijen krijgen `true` via de DEFAULT (natrek: 10/10 rijen `true`, geen aparte backfill).
- `src/hooks/useTenant.tsx`: `platform_newsletter_opt_in?: boolean` toegevoegd aan de `Tenant`-interface (`select('*')` haalde de kolom al binnen).
- `src/components/admin/settings/NotificationSettings.tsx`: Switch tussen de geluidsmelding en de e-mailnotificatie-sectie — logisch bij de communicatievoorkeuren, geen bestaande instelling verschoven. Optimistic update met rollback naar de vorige waarde bij fout, `.select()` na `.update()` en `data.length === 0` als faalgeval (stille RLS-weigering wordt zo een echte fout i.p.v. een groen vinkje), daarna `refreshTenants()`.
- i18n: `settings.platform_newsletter.{title,description,saved,error}` in nl/en/fr/de.
- Changelog `2026.09b` (type `improvement`) + `changelog.entries.platform_newsletter_preference` in de vier talen.
- DOCS-1: `doc_articles` `doc_level='tenant'`, slug `sellqo-nieuwsbrief-aan-of-uitzetten`, `context_path='/admin/settings'`, categorie Communicatie, idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.

**Security-keuzes:** geen nieuwe policy en geen verruiming. De bestaande UPDATE-policy `Tenant admins can update their own tenant` (`id IN (SELECT get_user_tenant_ids(auth.uid())) AND has_tenant_role(id, ARRAY['tenant_admin'])`, rol `authenticated`) dekt deze kolom automatisch — RLS op `tenants` is rij-, niet kolomgebaseerd, dus een tenant_admin kan enkel de eigen rij zetten en niet-admins (staff/marketing/warehouse/viewer) kunnen niets zetten. Platform admins behouden hun bestaande bypass via `is_platform_admin(auth.uid())`. Bewust géén kolom-grant of aparte policy toegevoegd: dat zou een tweede, divergerende autorisatieweg op dezelfde tabel introduceren (M1: additief vóór destructief, maar hier is niets nodig). `tenant_newsletter_config` en `tenant_notification_settings` zijn niet aangeraakt.

**Vervolg:** de verzendlaag van de platform-nieuwsbrief moet bij implementatie filteren op `platform_newsletter_opt_in = true`; zolang die er niet is, is de kolom louter een vastgelegde voorkeur.

# 2026-08-07 (ochtend) — PUSH-DB-1

**PUSH-DB-1**: DB-fundering voor native push (FCM/APNs via Capacitor). Additief, geen bestaande flow geraakt.

Nieuwe tabel `public.device_tokens` (`user_id` FK → `auth.users` ON DELETE CASCADE, `tenant_id` FK → `tenants` NULL, `token` UNIQUE, `platform` CHECK ios/android/web, `device_name`, `created_at`, `last_seen_at`) met index op `user_id`, GRANTs voor `authenticated` + `service_role`, RLS enabled en vier strakke policies op `auth.uid() = user_id`.

**Root cause van het scope-ontwerp**: een push-token identificeert een *fysiek toestel*, niet een winkel. Eén e-mail kan tot 10 tenants beheren (zie multi-tenant per-user access); zou het token tenant-scoped zijn, dan ontstaan duplicaat-rijen per tenant voor hetzelfde device → dezelfde melding meermaals op één telefoon, plus onmogelijke invalidatie wanneer FCM het token roteert (welke rij is de waarheid?). Daarom: `UNIQUE(token)`, device-scoped, `tenant_id` louter als niet-normatieve hint over de laatst actieve context. Filtering op tenant hoort in de verzendlaag (`notifications.tenant_id` × rol/tenant-membership), niet in de tokenopslag.

**Waarom geen platform-admin-bypass in RLS**: push-verzending draait server-side met service-role, die RLS structureel omzeilt. Een admin-policy zou dus enkel leesbaar maken wat de verzender toch al ziet, terwijl het het aanvalsoppervlak vergroot (tokens zijn bearer-achtige credentials waarmee je meldingen naar een toestel kunt sturen). Strak op `user_id` houden is het minimale-rechten-antwoord.

**Waarom `push_enabled` default false** op `tenant_notification_settings`: push is het eerste kanaal dat OS-permissie vereist én buiten de app om aandacht opeist. Default true zou bij deploy stilzwijgend meldingen activeren voor bestaande rijen (backfill zet elke bestaande instelling op `true`) — dat is een opt-out-model op een kanaal waarvoor de gebruiker nooit toestemming gaf. `false` maakt de rij-backfill inert en dwingt expliciete activatie zodra de push-UI landt.

Bewust niet gedaan: geen edge function, geen frontend, geen Capacitor-config, geen changelog/newsletter (interne infra, nog niet tenant-zichtbaar), geen doc_articles.

---

# 2026-08-06 (avond) — STOREFRONT-API-IP-THROTTLE-1

**STOREFRONT-API-IP-THROTTLE-1**: IP-throttle (in-memory, 5/IP/10 min) toegevoegd op `newsletter_subscribe` en `submit_contact_form` in `storefront-api` tegen mail-bombing/lijstvervuiling. De throttle zit vóór de dispatch en laat de handlers zelf ongemoeid; `clientIp` wordt afgeleid uit `cf-connecting-ip`, `x-forwarded-for` of terugval naar `unknown`. De bestaande per-tenant `checkRateLimit` blijft als generieke bovengrens. **Verificatiebevinding**: in-memory state blijkt in de serverless/Deno-Deploy-omgeving niet gedeeld tussen requests (elke request krijgt een schone isolate), waardoor de in-memory teller in de praktijk niet oploopt en dus geen 429 afgeeft. De code is conform de opdracht ingebouwd, maar effectieve bescherming vereist een upgrade naar een gedeelde state store (DB-teller, Redis/KV of vergelijkbaar). Geen DB-migratie of nieuwe tabel toegevoegd in deze stap.

---

# 2026-08-06 (avond) — STOREFRONT-CONFIG-BANK-SECURITY-1

**STOREFRONT-CONFIG-BANK-SECURITY-1**: `getConfig` in `storefront-api` gaf in de publieke, ongeauthenticeerde `/settings`-respons een `bank_details`-object mee met `account_holder`, `iban` en `bic`. Dit was opvraagbaar zonder aankoop en vormt een spoofing-/factuurfraude-risico. Het `bank_details`-blok is verwijderd uit `getConfig`; de boolean `bank_transfer_enabled` blijft behouden voor backward-compatibiliteit. De bankgegevens die een klant nodig heeft voor een bankoverschrijving of QR-code worden legitiem en onveranderd opgebouwd in `checkout_complete` (eigen tenant-query). Andere functies, de database en `cacheControl` zijn onaangeroerd. Scope: alleen het bank-blok in `getConfig`.

---


# 2026-08-06 (late namiddag) — STOREFRONT-CONFIG-SOCIALS-FIX-1

**STOREFRONT-CONFIG-SOCIALS-FIX-1**: `getConfig` in `storefront-api` las socials uit niet-bestaande `tenant.social_*` kolommen; alle waarden waren daarom altijd `null`. Socials worden opgeslagen in `tenant_theme_settings.social_links` (JSONB, vorm `{ "instagram": "...", "facebook": "...", ... }`). Het social-blok in `getConfig` is omgezet naar `themeSettings.social_links` met veilige fallback, zelfde 6 keys en onveranderde responsvorm. Socials werken nu storefront-breed. Scope: alleen de social-opbouw in `getConfig`; store/contact/languages/features/payments/appearance onaangeroerd; cacheControl op `get_config` behouden.

---

# 2026-08-06 (namiddag) — STOREFRONT-PAGES-FIX-1

**STOREFRONT-PAGES-FIX-1**: get_pages en get_sitemap_data in storefront-api lazen uit een niet-bestaande tabel `pages`; de sellqo-proxy maskeerde de upstream-fout als `{"data":[]}`, waardoor legal pages bij geen enkele tenant op de storefront verschenen. Omgezet naar `public.legal_pages` met per-taal kolommen (nl/en/fr/de) + NL-fallback; `page_type` is de canonieke slug. Lijstvorm `{slug, title, url}`, detailvorm `{slug, title, content}`; sitemap-vorm onveranderd. content_translations niet meer gebruikt in deze functie. Legal pages werken nu storefront-breed voor alle tenants.

# 2026-08-06 (middag) — LABEL-PRINT-FIX / BOL-ORDER C000CJ82P1 / INVOICE-MAIL-FIX / SELLQO-GEDEELDE-PADEN SKILL / FASE-B-SLOOP

**LABEL-PRINT-FIX-1** (commit dd5606f): regressie uit 2a·4. De daar toegevoegde customer_id-select in get-document-url draaide voor álle doc-types, maar shipping_labels heeft geen customer_id-kolom → elke labelprint 500'de ("column shipping_labels.customer_id does not exist"), live gevonden op VanXcel #1163. Fix: HAS_CUSTOMER_ID-map per doc_type; customer_id-select én de interne-tenant-fallback-autorisatie (uit 2a·4) alleen nog voor billing-doctypes (invoice/credit_note/payment_request); shipping_label terug op de pure tenant-check. Geverifieerd: get-document-url doet nul writes → label_url-regel onaangetast. LES → nieuwe workspace-skill sellqo-gedeelde-paden G1.

**Bol-order C000CJ82P1 — transient, geen breuk** (geen deploy): gemeld als "auto-accept weer stuk". Read-only recon toonde het tegendeel: cron marketplace-sync-scheduler (jobid 1) draaide elke 5 min succesvol, connectie is_active + autoAcceptOrder=true, order stond lokaal op sync_status='accepted' mét VVB-label. Bij Bol stond de order onder "eigen verzendwijze" met tracking CD141496613BE al aanwezig. Poging tot confirm-bol-shipment gaf Bol-antwoord "order item id(s) that are shipped already: [3970645860]" — Bol had de verzending dus al ontvangen (bevestiging van ~07:20 kwam door), maar confirm-bol-shipment struikelde ná Bol's acceptatie op een async poll-timeout vóór de lokale statusupdate (regel 331). Fix: één order lokaal rechtgezet (sync_status→shipped, fulfillment→shipped) — exact wat de functie zelf zou schrijven. GEEN code, GEEN API-config aangeraakt (bewust: moeilijk-geconfigureerde bewezen Bol-keten). Historische parallel: 22 juni was het een gereverteerde scheduler. LES → skill sellqo-gedeelde-paden G3/G4.

**INVOICE-MAIL-FIX-1** (commit 553e095, changelog 2026.09a): send-invoice-email koos de "automatische incasso"-mailvariant puur op factuurstatus (paid/processing). Daardoor kreeg een betaalde tenant-KLANTfactuur (VanXcel-webshopklant, INV-2026-0155, geen enkele SEPA-machtiging) de abonnement-incassotekst "het bedrag wordt automatisch geïncasseerd via de door jou verstrekte machtiging — deze factuur is voldaan". Klant-facing leugen. Fix: isSubscriptionInvoice = invoice.subscription_id != null; auto-collect-variant enkel voor abonnementsfacturen. Betaalde klantfactuur krijgt nu een neutrale "voldaan"-bevestiging (nieuwe 4-talige keys paidSubject/paidIntro/paidNote; tenant-custom body met betaaltermijnen bewust overgeslagen). Impact-telling: 111 betaalde klantfacturen bestaan (110 VanXcel, 1 demo), maar de foute autoCollect-tekst is een recente toevoeging; alleen enkele recente paid-facturen raakten hem, en de betrokken mail (INV-2026-0155) is niet eens aangekomen — geen corrigerende nazending nodig. LES → skill sellqo-gedeelde-paden G2.

**Nieuwe workspace-skill sellqo-gedeelde-paden** (commit dca7bf7): vier regressie-preventie-regels, elk met het litteken van vandaag. G1 gedeelde functie → alle consumenten/types inventariseren en tegen élk type testen (label-regressie). G2 mailvariant op datastructuur niet op status (invoice-mail). G3 "werkt al maanden, nu stuk" = trigger zoeken, bewezen integratie niet aanraken (Bol). G4 broncode ≠ gedeployde werkelijkheid, diagnose uit live data (scheduler). Reden: op één dag braken drie dingen door dezelfde grondoorzaak — gedeeld codepad dat meerdere werelden bedient.

**FASE-B-SLOOP** (changelog 2026.08z): Stripe Billing voor SellQo's eigen abonnementsfacturatie volledig gesloopt; de native pay-first engine is nu de enige factureer-weg. Uitgevoerd in veilige volgorde: (1) frontend ontkoppeld — /pricing (handleSelectPlan) stuurt tenants naar /admin/billing en bezoekers naar signup, createCheckout/openCustomerPortal uit useTenantSubscription verwijderd (nul aanroepers over); (2) create-platform-checkout + platform-customer-portal verwijderd incl. config; (3) stripe_*-kolommen gedeprecieerd (gedocumenteerd, uit selects/writes gehaald, GEEN drop — data blijft archief), platform_invoices blijft read-only archief; (4) platform-admin historische Stripe-data als "historisch" gelabeld; (5) webhook-chirurgie op platform-stripe-webhook: customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, trial_will_end verwijderd. ⛔ CONNECT-VANGRAIL GEHOUDEN EN GEVERIFIEERD: create-connect-account, stripe-connect-webhook, get-merchant-payouts intact; payment_intent.succeeded/payment_failed (CYCLE-3-interceptor), checkout.session.completed en alle payout.*-cases (created/paid/failed/canceled) intact; tenants.stripe_account_id en alle Connect-semantiek onaangeroerd. Twijfelgevallen bewust behouden: confirm-platform-bank-payment (bank-reconciliatie, geen Billing) en alle platform_invoices-schrijvers. Post-flight via verse clone bevestigde alle bovenstaande punten.

**Changelog-stand**: t/m 2026.09a. **Newsletter-wachtrij**: o/p/q/r/u + 08z (billing-migratie, tenant-zichtbaar → geschikt voor nieuwsbrief) staan klaar voor gebundelde verzending na bevestiging; 08w/08x/08y/09a zijn bugfix/polish (geen nieuwsbrief).

---

# FASE-B-SLOOP — oude Stripe Billing-machinerie ontmanteld — 6 augustus 2026

**Root cause:** de native pay-first billing-engine nam maandenlang stap voor stap de SellQo-abonnementsfacturatie over (activatie, betalingsverzoeken, incasso, facturen, creditnota's, pro-rata-upgrades, self-service UI, documentenoverzicht), maar de oude Stripe Billing-machinerie bleef er naast staan. Dubbele waarheid = risico op tegenstrijdige status en misleidende data.

**Uitgevoerd (per stap, elk met verse aanroeper-grep vooraf):**
1. *Frontend ontkoppeld.* `src/pages/Pricing.tsx`: `handleSelectPlan` opent geen Stripe Checkout meer — ingelogde gebruiker → `/admin/billing?plan=&interval=` (native activatiewizard), publieke bezoeker → `/auth?mode=signup&plan=&interval=`. Plankeuze/vergelijking blijft. `src/hooks/useTenantSubscription.ts`: mutaties `createCheckout` en `openCustomerPortal` verwijderd inclusief nu-ongebruikte imports (`useMutation`, `useToast`, `queryClient`); `subscription`, `usage`, `invoices`-lezingen ongewijzigd. Grep na wijziging: 0 hits op beide namen in `src/`.
2. *`platform-customer-portal` verwijderd* (map + config.toml-blok). Grep vooraf: 0 aanroepers in `src/` en `supabase/`, alleen het config-blok zelf.
3. *`create-platform-checkout` verwijderd* (map + config.toml-blok). Grep vooraf: 0 aanroepers ná stap 1.
4. *Kolom-deprecatie zonder DROP.* Nieuw `docs/stripe-billing-deprecated.md` met de status per kolom (`tenant_subscriptions.stripe_subscription_id/stripe_customer_id`, `pricing_plans.stripe_product_id/stripe_price_id_monthly/stripe_price_id_yearly`). `src/types/billing.ts`: `@deprecated`-notities zodat bestaande `select('*')`-queries blijven typechecken. Geen migratie, geen DROP — data blijft archief.
5. *Platform-admin labeling.* `PlatformBilling.tsx` facturen-tab en `TenantInvoicesTab.tsx` gelabeld "historisch (Stripe)" met uitleg dat actuele abonnementsfacturen uit de native engine komen; Stripe-dashboard-deeplinks in `PlatformBilling.tsx` en `TenantSubscriptionTab.tsx` gelabeld "legacy". `usePlatformBilling.ts` / `usePlatformAdmin.ts`: `platform_invoices`-queries gedocumenteerd als historische bron. Geen rebuild, geen querywijziging → admin blijft foutloos laden.
6. *Webhook-chirurgie* (`platform-stripe-webhook`): uitsluitend de vijf Billing-cases verwijderd — `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`. Geverifieerd intact: de CYCLE-3-interceptor bovenaan (`handleSubscriptionChargeWebhook`, regel ~119, dekt `payment_intent.succeeded/payment_failed/processing`), `checkout.session.completed`, alle vier `payout.*`-cases en de default-tak ("Unhandled event type"). Geen gedeelde helper stond alleen in een verwijderde case. Function opnieuw uitgerold.

**Security-keuzes:** geen policy-, grant-, rol- of functie-autorisatiewijziging in deze batch. `platform_invoices` blijft read-only archief met bestaande RLS; het bank-overschrijvingspad (`confirm-platform-bank-payment`) schrijft er nog naar en bleef daarom volledig staan. Verwijderde functies waren beide JWT-geauthenticeerde tenant-endpoints; hun wegvallen verkleint het aanvalsoppervlak.

**Connect-vangrail (expliciet niet aangeraakt):** alle Stripe Connect-paden — connected accounts, storefront-checkouts, payouts, transfers, application fees, `on_behalf_of`, `destination`, `tenants.stripe_account_id`, `check-connect-status`, `create-connect-account` — én de mandaat/incasso-infrastructuur (`create-mandate-setup`, `create-platform-mandate-setup`, mandaat-webhooks, `customer_payment_mandates.*`) en `tenant_addons.*` (add-ons lopen nog via Stripe Billing). Grep op connect-termen in de twee verwijderde functiemappen: 0 hits.

**Vangst uit recon:** `/pricing` bleek nog stiekem de enige levende aanroeper van `create-platform-checkout` — een publieke pagina kon dus nog een Stripe Billing-abonnement starten náást de native engine. Dat was het echte gat; stap 1 sloot het vóór de functieverwijdering (daarom deze volgorde: frontend eerst, webhook laatst, zodat er nooit een venster is waarin de UI naar een verdwenen functie wijst).

**Twijfelgevallen — bewust NIET gesloopt:** `confirm-platform-bank-payment` (actief in bankreconciliatie), `platform_invoices` (archief + bankpad), `checkout.session.completed` (blijft als hook, logt alleen), `tenant_addons`-Stripe-kolommen (add-on-flow leeft nog).

**Vervolg:** eventuele DROP van de deprecated kolommen in een aparte batch, niet samen met code-sloop. Live te smoken: mandaat-aanmaak, betaling van een betalingsverzoek (PR → cycle settled → factuur), labelprint, storefront-checkout via Connect, en `/pricing` → activatiewizard voor zowel ingelogd als uitgelogd.

# 2026-08-06 (ochtend) — UX-POLISH / BTW-CONSISTENCY / PAY-UX / LABEL-PRINT-FIX

**UX-POLISH-1** (changelog 2026.08w): drie livetest-bevindingen in één batch. (A) Cold-start na deploy gaf de gebruiker eenmalig een failed fetch met error-toast op de planwissel — nu één stille retry (~1,5s) bij netwerk-level fouten via invokeWithNetworkRetry; nette JSON-fouten blijven direct zichtbaar. (B) Mandaat-context negeerde een pending downgrade en toonde het huidige (duurdere) plan — context gebruikt nu het pending plan mét effective_from (eerstvolgende incassodatum): "…vanaf <datum>". (C) Factuur- en creditnota-PDF's kapten omschrijvingen af op 42 tekens — gedeelde wrapTextToWidth-helper (_shared/pdfText.ts), rijhoogte groeit mee; zelfde aanpak als het betalingsverzoek.

**BTW-CONSISTENCY-1** (commit 097d859, changelog 2026.08x): btw-communicatie was op drie plekken tegenstrijdig — publieke prijzenpagina en tenant-plankaarten zeiden "inclusief BTW" (tenant-kant zelfs hardcoded NL, geen i18n) terwijl engine, facturen en wizard excl.+btw rekenen. Beslissing: excl. is de waarheid (B2B-standaard, engine/Peppol/Odoo draaien er al op). Alle vermeldingen naar "exclusief btw" in 4 talen, plus excl.-suffix direct bij elk bedrag (Belgische duidelijkheidseis) op beide prijzenpagina's, de plan-vergelijkingskaarten en de comparison-tabel. HARDE GRENS bewaakt en geverifieerd: TaxSettings/default_vat_handling (de eigen winkel-btw van de tenant) en de factuurlabels total_incl/excl_vat volledig onaangeraakt.

**PAY-UX-1** (commit 843dacc, changelog 2026.08y): betaallinks openden in een nieuwe tab; na betalen bleef de oude tab op "wacht op betaling" staan — klant dacht dat de betaling mislukt was. Drieledig: (B) beide betaalknoppen openen nu in dezelfde tab (window.location.assign), success_url brengt de klant terug; (A) de billing-pagina detecteert betaling zelf — 5s-poll zolang er een open verzoek is + refetch op focus/visibilitychange + ?paid=<pr>-terugkeerpad met "we verwerken je betaling…"-status en eenmalige succes-toast (ref-guard), puur read-only; (C) succespagina omgebouwd tot echte bevestiging (vinkje, e-mailnotitie, knop "terug naar je abonnement" met ?paid-param). Dekt alle paden: zelfde tab, losse tab uit de PR-mail, trage webhook.

**LABEL-PRINT-FIX-1** (commit dd5606f): regressie uit 2a·4 — de daar toegevoegde customer_id-select in get-document-url draaide voor álle doc-types, maar shipping_labels heeft geen customer_id-kolom → elke labelprint 500'de (live gevonden op VanXcel #1163). Fix: HAS_CUSTOMER_ID-map per doc_type; customer_id-select én de interne-tenant-fallback-autorisatie alleen nog voor billing-doctypes; shipping_label terug op de pure tenant-check. Geverifieerd: functie doet nul writes — label_url-regel onaangetast. LES (nieuw): een select of autorisatiepad uitbreiden in een functie die meerdere doc-types bedient, moet expliciet per type gescoped worden; test bij zo'n wijziging alle bediende types, niet alleen het type waarvoor je bouwt.

---

# 2026-08-05 (namiddag/avond) — UX-UNIFY / TRIAL-FIX / PAY-PAGES / CRON-KEY / PDF-SAFE

**UX-UNIFY-1** (changelog 2026.08q): plankeuze en betaalwijze samengevoegd tot één PlanActivationWizard — de losstaande "automatische incasso"-kaart voelde als een blanco cheque (gebruikersfeedback). Mandaatpagina toont nu plancontext + bedrag via mandate_setup_tokens.context (jsonb, additief); PlanChangeConfirmDialog opgegaan in de wizard; halve staat via sessionStorage + resume-alert; betaalwijze-kaart gedegradeerd tot beheer-only. create-mandate-setup (tenant→klant) onaangeraakt.

**TRIAL-FIX-1** (commit d7ebc56, changelog 2026.08r): verse trials kregen plan 'free' met 0/37 features — lege zijbalk, waardeloze proefperiode (live gevonden op verse tenant SellQo Speeltuin). Beslissing: trial = 14 dagen Pro. Trigger-seed aangepast; badge-bron bleek kolom-default 'starter' op tenants.subscription_plan die bij signup nooit gezet werd — nu gesynchroniseerd, ook bij trial-downgrade. Bijvangst met tanden: er bestond GEEN cron voor check-expired-trials — de hele expiry-machinerie was dead code. Zona Dorata's trial (verlopen 29/7) daardoor nooit gedowngraded; trial_end verlengd naar 1/10 (klantbeheer via gratis maanden), daarna cron check-expired-trials-daily aangemaakt (jobid 118, 06:45 UTC, vault-patroon). Backlog: TRIAL-MAIL-1 (herinnering ~5 dagen vóór verloop).

**Speeltuin-smoke pay-first manual** — historisch: PR-2026-0001 (eerste betalingsverzoek van het platform, automatisch verzonden), na chirurgische krimp naar €2-schaal (subscription_line + cycle herrekend, verse link/PDF/mail via dispatch) door Akke betaald → CYCLE-3-webhook maakte automatisch factuur SQ-2026-0006 'paid' (11:48:34) + mail, cycle settled. Volledige pay-first-keten met echt geld bewezen. LES: subscription_lines heeft geen line_total-kolom.

**PAY-PAGES-1** (commit 1fd0d36, changelog 2026.08t) + CHANGELOG-FIX-3 (5b4c68d): na de eerste echte betaling bleek /pay/success nergens te bestaan (0 hits op 111 routes) — óók create-invoice-payment-link verwees er al naartoe: elke betaallink-betaling eindigde al langer op een 404. Publieke PaySuccess/PayCancelled-pagina's gebouwd (4-talig, statisch, ?pr=/?invoice=-param). LES: "bestaand patroon"-claims ook verifiëren, niet alleen nieuwe code. FIX-3: changelog-key stond in de locales maar registratie in PublicChangelog.tsx ontbrak — spiegelbeeld van FIX-2; slottaak-instructie voortaan: beide kanten expliciet.

**UX-UNIFY-2** (changelog 2026.08s): link-dialoog in het self-service-incassopad vervangen door directe redirect (keuze → sessionStorage → window.location.assign); MandateActivation done-state kreeg bij platform-context "terug naar je abonnement" + auto-redirect; Billing.tsx activeert automatisch bij terugkeer met bruikbaar mandaat + opgeslagen selectie (once-guard). Link-dialoog blijft bestaan voor tenant→klant.

**Upgrade-incident + creditering**: live upgrade-test op Speeltuin trof het legacy invoice-first-blok in sync-tenant-plan: SQ-2026-0007 (€35,09, "Free -> Starter 30/30 d" — dubbel: periode was al betaald) en SQ-2026-0008 (€60,50, "Starter -> Pro 30/30 d" — volle maand i.p.v. echte proratie), beide direct gemaild; tevens ongewenste cancel-status. Opruiming: CN-2026-0008/0009 (volledige creditering, reden gedocumenteerd, PDF+mail verzonden), facturen op 'cancelled' (buiten dunning-scope: die selecteert unpaid/sent), speellijn en statussen hersteld. Uitgegeven facturen nooit verwijderd — creditnota-regel gevolgd. Structurele fix: zie UPGRADE-PF-1 hieronder.

**CRON-KEY-1** (+ vault-vondst): vault-secret cron_service_role_key bleek NIET de echte service-role-key (401 op strikte token-vergelijking in _shared/auth.ts; gateway-tolerante functies zoals dispatch werkten wél — verklaart de CRON-AUTH-1-observatie). Zelfherstellende oplossing zonder dashboard: edge function sync-cron-vault-key (auth: x-cron-secret vs internal_config.internal_webhook_secret, constant-time) + SECURITY DEFINER RPC sync_cron_service_role_key (EXECUTE alleen service_role) die de env-key in de vault upsert. Uitgevoerd: updated=true; generate-credit-note werkt nu via het cron-pad. Herbruikbaar bij toekomstige key-rotaties. Correctie op eerdere aanname: CRON_SECRET/private.config bestaat niet in dit project; de interne shared secret is internal_config.internal_webhook_secret.

**PDF-SAFE-1** (commit 90f3000): generate-credit-note crashte op "WinAnsi cannot encode →" — de nieuwe pro-rata-omschrijving (planProration.ts) gebruikte hetzelfde pijltje en zou de eerste echte upgrade-PR-PDF gegarandeerd gecrasht hebben. Alle PDF-rakende strings gescand: → en — vervangen door ASCII in planProration/planEffectuate, U+2212-minus in generate-credit-note gefixt; accenten en € zijn WinAnsi-veilig. ENGINEERING-REGEL (nieuw): strings die in PDF's landen (omschrijvingen, namen) uitsluitend WinAnsi-veilige tekens — geen typografische pijlen/streepjes/quotes.

**Newsletter-wachtrij aangevuld**: 2026.08q (wizard), 2026.08r (Pro-trial), 2026.08u (eerlijke pro-rata-upgrades) toegevoegd; totaal in wachtrij: o/p/q/r/u (s en t zijn klein/bugfix — geen newsletter).

---

# 2026-08-05 (middag) — SAFEGUARD / CYCLE-2 / 2a·1 / 2a·2 / CHANGELOG-FIX-2

**SAFEGUARD-1** (commit ac014d5, changelog 2026.08n): oud Stripe Billing-betaalpad in de UI dichtgezet nadat een live gebruikerstest bevestigde dat /admin/billing tenants naar een betaalbare live Checkout stuurde (alle plannen hadden actieve price-id's). onSelectPlan geneutraliseerd, plan-knoppen disabled via selectionDisabled-prop, 4-talige melding, portal-kaart verborgen. LES: een gevonden actief footgun onmiddellijk neutraliseren vóór verder te bouwen — de audit had de urgentie onderschat door "zombie" te denken i.p.v. "geladen wapen". Bijvangst: FR/DE misten het volledige billing-vertaalblok (LANG-ADMIN-1 → opgelost in 2a·2).

**CYCLE-2** (changelog 2026.08o): betalingsverzoek-spoor voor pay-first manual-modus. Vier nieuwe functies: generate-payment-request-pdf (BETALINGSVERZOEK-template, verplichte "dit is geen factuur"-disclaimer boven én in footer, storage-PATH only, bestandsnaam gesaneerd), create-cycle-payment-link (Checkout mode 'payment', geen payment_method_types → automatisch alle actieve methodes, payment_intent_data.metadata zodat CYCLE-3 ongewijzigd settelt — geen checkout.session.completed-handler nodig), send-payment-request-email (klanttaal-i18n 4-talig, verzoek-toon, PDF-bijlage), dispatch-payment-request (dun orkestratie-adres, per stap best-effort). Runner-dispatch in beide awaiting_payment-takken; mandaat-vangnet krijgt nu ook een PR-nummer. Herinnering-cron process-cycle-reminders (jobid 114, 07:30 UTC, vault-patroon): niveaus due/midpoint/expiry, dag-guard, status+invoice_id-guards, 7-daagse verse-link-guard; expiry raakt alleen billing_cycles.status, notificatie alleen bij expiry. Migratie additief (5 kolommen + partiële reminder-index). get-document-url uitgebreid met doc_type 'payment_request'. Bewuste afwijking genoteerd: dispatch-payment-request heeft zelf geen status-guard zodat de laatste kennisgeving na expiry nog verzonden kan worden; aanroepers filteren streng.

**2a·1** (commit e3ac796): create-platform-mandate-setup — self-service mandaatlink voor het eigen SellQo-abonnement. Auth strikt op de eigen tenant (tenant_admin; platform_admin via requireRole), interne tenant via is_internal_tenant (geverifieerd: exact één rij), ensureBillingCustomer 1-op-1 uit sync-tenant-plan, terugschrijven op tenant_subscriptions.billing_customer_id, Stripe-customer op het platformaccount met platform_tenant_id-metadata, token in mandate_setup_tokens. Bestaande create-mandate-setup (tenant→klant) ongewijzigd.

**2a·2** (changelog 2026.08p, DOCS-1 artikel 'abonnement-en-betaalwijze-beheren'): /admin/billing volledig omgehangen naar de native engine; SAFEGUARD-1 opgeheven. Nieuwe get-platform-billing-status (action status | set_payment_mode) omdat RLS een tenant_admin blokkeert op zijn eigen mandaat/billing-sub (die leven op de interne tenant) — recon-vondst die het ontwerp bepaalde. Mandaat-ordering-hardening: nieuwste rij wint, een oude failed blokkeert nooit. UI: betaalwijze-blok (incasso via 2a·1-link / betalingsverzoek per periode), poortwachter vóór activeren, activate-vs-switch-keuze op billing_subscription_id (de 400 "use action=activate" bereikt nooit de gebruiker), bevestigingsdialoog met de twee wetten zonder pro-rata-bedragbelofte, DowngradeWarning uit plan-vergelijking, pending-downgrade-banner, enterprise niet self-service. Oude paden (createCheckout, portal, usePlanSwitch, VISA-4242-mock) zonder aanroepers; edge functions blijven staan tot Fase B. Volledige billing-i18n in 4 talen (FR/DE hadden 1 key). sync-tenant-plan, MandateActivation, CYCLE-functies, webhook onaangeraakt.

**CHANGELOG-FIX-2** (commit 89ab9b9): self_service_billing was in de 4 landing-locales als platte string geplaatst i.p.v. { title, description } — zelfde bugklasse als CHANGELOG-FIX-1 (juiste nesting, verkeerde shape). LES aangescherpt: bij changelog-entries niet alleen het pad maar ook de shape verifiëren tegen wat de component leest; dit hoort voortaan expliciet in de slottaak-instructie van elke prompt.

**Newsletter-wachtrij**: 2026.08o (betalingsverzoeken) + 2026.08p (self-service billing) staan klaar voor de eerstvolgende gebundelde verzending na bevestiging.

---

# 2026-08-05 — SUB-UNIFY / CYCLE (abonnement-lifecycle, pay-first)


**SUB-UNIFY-0** (commit 08c2b27): PaymentElement in MandateActivation.tsx toonde kaart als eerste betaalmethode. Root cause: geen expliciete paymentMethodOrder — Stripe bepaalt dan zelf de volgorde. Fix: paymentMethodOrder ['sepa_debit','card']. Geen changelog (visuele ordering).

**SUB-UNIFY-1** (verificatie, geen code): sync-tenant-plan regel-voor-regel langs de twee wetten (upgrade direct + pro-rata / downgrade bij volgende facturatie) — conform. SQL-natrek nieuwe-klant-route: interne tenant geseed bevestigd, alleen sandbox doorliep ooit de verenigde route, alle echte tenants billing_subscription_id NULL.

**SUB-UNIFY-1a** (commit 9dec31c, changelog 2026.08j): interval-swap upgrades factureerden dubbel — entitlement op vandaag+nieuw-interval maar subscriptions.next_invoice_date bleef op de oude grens. Root cause: upgrade-tak updatete alleen interval en name. Fix: bij interval-wissel start_date/next_invoice_date mee-gezet; pro-rata = volle nieuwe prijs − credit ongebruikt deel oude periode.

**SUB-UNIFY-1b** (commit 139e707, changelog 2026.08k): pro-rata upgrade-facturen misten pariteit met de runner (geen PDF/UBL, geen mail, bij falen bleef status 'sent' buiten dunning-vangnet). Root cause: verkorte kopie van het runner-patroon. Fix: alle drie toegevoegd in runner-volgorde. NB: wordt herwerkt in UPGRADE-PF-1 (pay-first).

**AUDIT-VONDST (sloop-pre-flight)**: overdracht-conclusie "Stripe Billing-laag bevestigd dood, nul frontend-aanroepers" bleek FOUT — /admin/billing (live gerouteerd) stuurt tenants zonder stripe_subscription_id naar create-platform-checkout (Stripe Checkout), en calculate/execute-plan-switch zijn bereikbaar zodra één checkout voltooit. sync-tenant-plan had juist nul aanroepers. Live bevestigd 5/8: downgrade-klik VanXcel opende live Stripe Checkout €79/mnd (niet afgerekend, geen DB-writes). LES: sloop-batches krijgen ALTIJD een verse aanroeper-grep als pre-flight; "bevestigd dood" uit een vorige sessie is geen bewijs. Gevolg: masterplan v2.0 (pay-first billing-cycle-engine) vervangt het oude SUB-UNIFY-2-plan.

**CYCLE-1** (changelog 2026.08l): billing-cycle-engine fundament — tabel billing_cycles (UNIQUE subscription_id+period_start als idempotentie-sleutel, partieel unique PR-nummer, RLS 4 policies via get_user_tenant_ids(auth.uid())), payment_mode/billing_model op subscriptions (bestaande rijen via default-flip op invoice_first — nul data-UPDATE, nul gedragswijziging), RPC generate_payment_request_number (SECURITY DEFINER, search_path, tenant-guard, anon revoked), pay-first-vertakking in runner (insert-first, 23505 → zelf-herstellende advance, Stripe idempotencyKey cycle:<id>, runner zet nooit 'settled') + pending-sweep >1u. Plan_mode-review vooraf; zes ontwerpvragen expliciet beantwoord vóór de bouw.

**CYCLE-3** (commit 57e1a1f, changelog 2026.08m): webhook is de enige factureer-plek voor pay-first — handleCycleCharge in _shared/subscriptionCharge.ts maakt bij payment_intent.succeeded de factuur als 'paid' (bedragen uit cycle-totalen, BTW-tarief afgeleid met snapping 0/6/12/21), settelt race-veilig via .is('invoice_id', null), PDF + mail altijd. Failed-tak → awaiting_payment met settled-guards; mandaat-flag-logica gedeeld (flagMandateIfDetached). Sweep aangescherpt op invoice_id IS NULL. Odoo/Peppol ongewijzigd via ISSUED_STATUSES ('paid' zit erin). Deploy: platform-stripe-webhook, stripe-connect-webhook, generate-subscription-invoices.

**CHANGELOG-FIX-1** (commit b51ef35): vijf changelog-i18n-keys stonden buiten public.changelog.changes en renderden als rauwe keys — bestond al sinds 2026.08i. Root cause: anchor-gebaseerde inserts ("na subscribeError") plaatsten keys op het verkeerde nestingniveau; de JSON-hersortering in CYCLE-3 legde het bloot. LES: bij i18n-inserts altijd het lookup-pad in de component verifiëren, niet alleen een tekstueel anker.

**SMOKE (lopend)**: pay-first testabonnement aabc0729 (€1,21, interne tenant, SEPA-mandaat) → cycle 30a5e564 'processing' met echte payment_intent pi_3U0zKt2NSrtUWCOr0ct9un9I. Verwacht bij SEPA-settlement deze week: webhook → factuur paid + mail → cycle settled. subscription_invoices bleef leeg (correct), advance correct.

**Overig**: VanXcel current_period_end verlengd naar 2027-03-12 (was verlopen). Nieuw op backlog: SUB-ADMIN-1 (admin-datatools + gift-month op eigen systeem, met audit trail).

---

# Fase 2 — VOLLEDIG AFGESLOTEN (2026-06-09)



## LABEL-PATH-1 — verzendlabels: download/print herstel na storage-hardening — 31 juli 2026

**Root cause:** de storage-security-remediatie zette de bucket `shipping-labels` privé en migreerde alleen de *leeskant*: `get-document-url` signt voor `doc_type='shipping_label'` uitsluitend op de kolom `label_path` (TTL 600s, rijen zonder path worden overgeslagen). De *schrijfkant* bleef achter: `create-bol-vvb-label` en `create-amazon-buy-shipping-label` schreven na de upload enkel een `getPublicUrl()`-resultaat naar `label_url` en nooit `label_path`. Ook de *batch-print-kant* (`src/hooks/useBatchLabelPrint.ts`) fetchte nog rechtstreeks de rauwe `label_url` (`/object/public/…`). Op een privé bucket levert dat 400/403 → `mergePdfs` kreeg nul bruikbare bytes en faalde met "No pages could be merged"; losse downloads via `get-document-url` faalden op een leeg `label_path`.

**Reeds uitgevoerde DB-hotfix (buiten deze commit, via connector):** order #1162, `shipping_labels.id = 463752bd-2e64-4cd6-b2f6-581b243708c1` → `label_path` bijgezet op `54f6b480-280b-42e1-b843-d5beb2831acd/bol-vvb-1162-dymo4xl-1785321010718.pdf`. `label_url` onaangeroerd (de retry-selectie in `sync-bol-orders` hangt op `label_url IS NULL`). Geverifieerd dat het storage-object op dat pad bestaat en dat `external_id`, `tracking_number` en `status` ongewijzigd bleven.

**Codewijzigingen in deze commit:**
1. `create-bol-vvb-label` — bij de `shipping_labels`-insert nu `label_path: (labelPdfUrl && !labelUploadError) ? labelStoragePath : null`, waarbij `labelStoragePath` gelijk is aan de `requestedPath` van de geslaagde upload (buiten de blokscope gelift). `label_url` en `status` exact ongewijzigd. *Verificatie:* nieuw VVB-label aanmaken → rij heeft niet-lege `label_path` gelijk aan de storage-key; downloaden via `get-document-url` geeft een werkende signed URL.
2. `create-amazon-buy-shipping-label` — `label_path: labelUrl ? labelPath : null`, waarbij `labelPath` de `fileName` is die naar `.upload()` ging. `label_url` ongewijzigd. *Verificatie:* idem via Amazon Buy Shipping.
3. `src/hooks/useBatchLabelPrint.ts` (`fetchLabelsForOrders`) — haalt per order het nieuwste `shipping_labels`-record op, verzamelt de label-id's en vraagt in één call `get-document-url` aan met `{ doc_type: 'shipping_label', kind: 'pdf', doc_ids: [...] }`. Signed URLs worden op `files[].id === shipping_labels.id` teruggemapt naar de juiste order; orders zonder `files`-entry (geen path of geen storage-object) krijgen status `no_label`. `printViaWebUSB` / `printViaBrowser` / `downloadLabels` bleven ongewijzigd en krijgen nu een werkende gesignde URL. *Verificatie:* batch-print op een order met gerepareerd `label_path` → PDF merge slaagt; op een order zonder path → nette `no_label`-melding in plaats van een merge-fout.

**Bewust géén backfill van de 17 oudere VanXcel-labels:** hun bestandsnamen bevatten `#` (verouderde `safeLabelFileName`-conventie) en verwijzen naar niet-bestaande storage-objecten. Een `label_path`-backfill zou daar een pad naar een leegte zetten en niets oplossen. Alleen #1162 was repareerbaar en is gefixt.

**Buiten scope gehouden:** `create-shipping-label` (doet geen storage-upload, slaat een externe carrier-URL op als `label_url`) en alle bucket-permissies — de bucket blijft privé.

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
- **Aanpassing 1 augustus 2026 (NANO-1-FIX-3):** de function schreef altijd PNG weg met vaste extensie `.png` en hardcoded content-type `image/png`. Een 2K-generatie leverde daardoor een bestand van **5,14 MB** op (geverifieerd op job `34a95362-e732-4c35-91d5-4b0be4c645f0`), te zwaar voor een productpagina en aanvankelijk tegen de bucketlimiet aan. `output_format` is nu instelbaar via de request body met **JPEG als default** (grofweg vijf keer kleiner bij vergelijkbare visuele kwaliteit; `png` blijft beschikbaar voor transparantie). Alleen `png`/`jpeg` worden geaccepteerd — een andere waarde valt terug op `jpeg` met een waarschuwing in de log, nooit een harde fout. Het formaat wordt opgeslagen in de nieuwe kolom `nano_image_jobs.output_format` (default `jpeg`; bestaande rijen expliciet op `png` gezet), en `status` leidt extensie (`.jpg`/`.png`) én content-type (`image/jpeg`/`image/png`) daaruit af in plaats van hardcoded. Bucketlimieten (10 MB op `ai-images` en `product-images`) blijven als vangnet staan.
- `doc_articles`: platform-artikel `nano-studio` (`doc_level='platform'`, categorie AI) beschrijft beide acties, defaults en de eis dat `image_url` publiek bereikbaar moet zijn bij `mode:"image"`. Idempotent via `ON CONFLICT (doc_level, slug) DO UPDATE`.
- **Aanpassing 2 augustus 2026 (NANO-1-FIX-4):** één referentiebeeld bleek onvoldoende voor vormbewerkingen. Bij een opdracht als "neem het hoofdbord uit beeld B over op het bed uit beeld A" moest het model het over te nemen onderdeel verzinnen, wat aantoonbaar misging (geverifieerd in productie: een gegenereerde opbergbox kreeg een lattenbodem in plaats van een plank en vier gasveren in plaats van twee). Nano Banana ondersteunt tot 10 referentiebeelden en de imgeditor-API accepteert `image_url` als string óf array. `image_url` accepteert nu beide: intern normaliseren we naar een array (lege/niet-string waarden worden weggefilterd). Bij `mode:"image"` is minstens één URL vereist (`image_url_required_for_image_mode`) en zijn maximaal 10 URLs toegestaan (`too_many_reference_images`, 400). Naar imgeditor gaat een **array** bij meer dan één URL en een **string** bij precies één, zodat bestaande aanroepen exact hetzelfde gedrag houden. De volledige set wordt vastgelegd in de nieuwe kolom `nano_image_jobs.source_image_urls` (`text[]`, nullable); `source_image_url` houdt de eerste URL voor achterwaartse compatibiliteit met bestaande rijen en queries die daarop matchen. `ai_generated_images.source_image_url` blijft één tekstwaarde (de eerste URL). Autorisatie, polling, storage-afhandeling, `output_format` en foutmapping ongewijzigd.

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

---

## SEC-2a — leesrechten uit `PERMISSION_MATRIX` afgedwongen in RLS

**Datum:** 2026-07-29

### Root cause

Veertien `SELECT`-policies waren **tenant-blind**: ze controleerden uitsluitend
of de gebruiker lid was van de tenant (`tenant_id IN get_user_tenant_ids(auth.uid())`,
of een `EXISTS` op de moedertabel), maar niet welke rol hij binnen die tenant had.
`PERMISSION_MATRIX` in `src/hooks/useCan.ts` beschreef de bedoelde afscherming al,
maar was frontend-only: wie de REST-API rechtstreeks aansprak met zijn eigen JWT
omzeilde de matrix volledig. Concreet kon de `marketing`-rol facturen en
factuurregels, creditnota's, SEPA-mandaten inclusief `mandate_setup_tokens.token`,
cadeaubonnen met `code` en `current_balance`, en de credentials in
`marketplace_connections`, `shipping_integrations`, `review_platform_connections`,
`tenant_newsletter_config`, `whatsapp_connections` en `tenant_odoo_settings` lezen.

### Aanpak

Per policy is de **bestaande `USING`-expressie ongewijzigd behouden** en met `AND`
een rolcheck toegevoegd via de tweeargumentige `has_tenant_role(tenant_id, ARRAY[...])`,
die `auth.uid()` intern gebruikt en een platform-admin-bypass bevat. Geen policy is
hernoemd of herschreven. Bij de drie regeltabellen (`invoice_lines`,
`credit_note_lines`, `payment_reminders`) staat de rolcheck binnen de bestaande
`EXISTS` en gebruikt hij de `tenant_id` van de moedertabel.

De twee bestaande platform-admin-`SELECT`-policies
(`Platform admins can view all invoices`, `Platform admins can view all invoice lines`)
zijn **volledig met rust gelaten**. Waar zo'n aparte policy ontbrak, bleef de
al aanwezige `is_platform_admin(auth.uid()) OR (...)` in de expressie staan; voor de
overige tabellen borgt de bypass in `has_tenant_role` het platformbeheer.

### Groep A — integratie-credentials

Matrix-resource: `integrations` → `["platform_admin","tenant_admin","viewer"]`
Rol-array: `ARRAY['tenant_admin'::app_role, 'viewer'::app_role]`

| Tabel | Policy |
|---|---|
| `marketplace_connections` | `mc_select_tenant_members` |
| `shipping_integrations` | `si_select_tenant_members` |
| `review_platform_connections` | `rpc_select_tenant_members` |
| `tenant_newsletter_config` | `Tenant users can view newsletter config` |
| `whatsapp_connections` | `Users can view their tenant whatsapp connections` |
| `tenant_odoo_settings` | `tos_select_tenant_members` |

### Groep B — financiële documenten

Matrix-resources: `invoices` en `credit_notes` (alle rollen behalve `warehouse` en
`marketing`) en `payments` (`platform_admin, tenant_admin, staff, accountant, viewer`).
Beide leiden tot dezelfde rol-array:
`ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role, 'viewer'::app_role]`

| Tabel | Policy | Matrix-resource |
|---|---|---|
| `invoices` | `Tenant users can view invoices` | `invoices` |
| `invoice_lines` | `Tenant users can view invoice lines` | `invoices` |
| `credit_notes` | `Tenant users can view credit notes` | `credit_notes` |
| `credit_note_lines` | `Tenant users can view credit note lines` | `credit_notes` |
| `customer_payment_mandates` | `mandates_select` | `payments` |
| `mandate_setup_tokens` | `mandate_tokens_select` | `payments` |
| `payment_reminders` | `Tenant users can view payment reminders` | `payments` |
| `gift_cards` | `Tenant users can view gift cards` | `payments` (bewuste keuze) |

**Bewuste keuze `gift_cards`:** de matrix noemt cadeaubonnen niet expliciet. Ze zijn
op `payments`-niveau gezet in plaats van `loyalty`, omdat een cadeaubon een `code` en
`current_balance` draagt — wie de code kan lezen, kan hem verzilveren. Dat is een
toonderinstrument, geen loyaliteitspunt.

### Cross-check matrix

`PERMISSION_MATRIX` in `src/hooks/useCan.ts` is gelezen vóór uitvoering; `integrations`,
`invoices`, `credit_notes` en `payments` kwamen exact overeen met bovenstaande arrays.
`platform_admin` is bewust weggelaten uit de `has_tenant_role`-arrays.

### Verificatie

Rol-simulatie over twaalf tabellen × zes rollen gaf exact het verwachte beeld:
`marketing` en `warehouse` overal `false`; `staff` en `accountant` `false` op de zes
tabellen van groep A en `true` op groep B; `tenant_admin` en `viewer` overal `true`.
De veertien tenant-policies bevatten `has_tenant_role`; de twee platform-admin-policies
niet — dat is correct.

### Rollback

```sql
-- Groep A
DROP POLICY IF EXISTS "mc_select_tenant_members" ON public.marketplace_connections;
CREATE POLICY "mc_select_tenant_members" ON public.marketplace_connections FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

DROP POLICY IF EXISTS "si_select_tenant_members" ON public.shipping_integrations;
CREATE POLICY "si_select_tenant_members" ON public.shipping_integrations FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

DROP POLICY IF EXISTS "rpc_select_tenant_members" ON public.review_platform_connections;
CREATE POLICY "rpc_select_tenant_members" ON public.review_platform_connections FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

DROP POLICY IF EXISTS "Tenant users can view newsletter config" ON public.tenant_newsletter_config;
CREATE POLICY "Tenant users can view newsletter config" ON public.tenant_newsletter_config FOR SELECT TO authenticated
USING (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids));

DROP POLICY IF EXISTS "Users can view their tenant whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Users can view their tenant whatsapp connections" ON public.whatsapp_connections FOR SELECT TO authenticated
USING (tenant_id IN ( SELECT ur.tenant_id FROM user_roles ur WHERE (ur.user_id = auth.uid())));

DROP POLICY IF EXISTS "tos_select_tenant_members" ON public.tenant_odoo_settings;
CREATE POLICY "tos_select_tenant_members" ON public.tenant_odoo_settings FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

-- Groep B
DROP POLICY IF EXISTS "Tenant users can view invoices" ON public.invoices;
CREATE POLICY "Tenant users can view invoices" ON public.invoices FOR SELECT TO authenticated
USING (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids));

DROP POLICY IF EXISTS "Tenant users can view invoice lines" ON public.invoice_lines;
CREATE POLICY "Tenant users can view invoice lines" ON public.invoice_lines FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1 FROM invoices i WHERE ((i.id = invoice_lines.invoice_id) AND (i.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))));

DROP POLICY IF EXISTS "Tenant users can view credit notes" ON public.credit_notes;
CREATE POLICY "Tenant users can view credit notes" ON public.credit_notes FOR SELECT TO authenticated
USING (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids));

DROP POLICY IF EXISTS "Tenant users can view credit note lines" ON public.credit_note_lines;
CREATE POLICY "Tenant users can view credit note lines" ON public.credit_note_lines FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1 FROM credit_notes cn WHERE ((cn.id = credit_note_lines.credit_note_id) AND (cn.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))));

DROP POLICY IF EXISTS "mandates_select" ON public.customer_payment_mandates;
CREATE POLICY "mandates_select" ON public.customer_payment_mandates FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

DROP POLICY IF EXISTS "mandate_tokens_select" ON public.mandate_setup_tokens;
CREATE POLICY "mandate_tokens_select" ON public.mandate_setup_tokens FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));

DROP POLICY IF EXISTS "Tenant users can view payment reminders" ON public.payment_reminders;
CREATE POLICY "Tenant users can view payment reminders" ON public.payment_reminders FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1 FROM invoices i WHERE ((i.id = payment_reminders.invoice_id) AND (i.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)))));

DROP POLICY IF EXISTS "Tenant users can view gift cards" ON public.gift_cards;
CREATE POLICY "Tenant users can view gift cards" ON public.gift_cards FOR SELECT TO authenticated
USING (tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids));
```

### Openstaand

- **`products.cost_price`** blijft leesbaar voor alle tenant-leden, terwijl de matrix
  `product_costs` beperkt tot `tenant_admin`, `accountant` en `warehouse`. Beperking op
  kolomniveau vergt een view of column-level privileges en is bewust niet in deze batch
  meegenomen.
- De resterende tenant-blinde tabellen waarvan de matrix `ALL_ROLES` toestaat
  (`orders`, `customers`, `products`, `pos`) zijn correct zoals ze zijn en niet aangeraakt.
- `discount_codes` en de overige promotietabellen: vervolg in **PERM-1**.

### Openstaande actie — Akke

Newsletter-item voor SEC-2a nog te plaatsen (tenant-zichtbaar); verzendmechanisme te
bevestigen. Voorgestelde tekst:

> **Rolrechten aangescherpt**
> We hebben de toegang tot gegevens in SellQo strikter afgestemd op de rol van elk
> teamlid. Teamleden zien voortaan alleen wat bij hun functie hoort; onderdelen waar
> ze geen rechten voor hebben, worden niet langer getoond. Heeft een collega ergens
> toegang tot nodig? Pas dan zijn rol aan bij Instellingen → Teamleden.

---

## PERM-1 — per-gebruiker recht om kortingscodes te beheren (31-07-2026)

### Root cause

Rechten waren uitsluitend **per rol** te verlenen. Kortingscodes aanmaken hoort
functioneel bij de marketingfunctie, maar een code van 100% is direct geld. Met alleen
rolgebaseerde autorisatie kon dat recht uitsluitend aan of uit voor de hele rol
`marketing` — te grof zodra een tenant met een externe marketier werkt.

### Ontwerp

- Nieuwe tabel `public.user_permission_grants (tenant_id, user_id, resource, granted_by)`
  met `UNIQUE (tenant_id, user_id, resource)`. `resource` is bewust `text` en géén enum,
  zodat er later een recht bij kan zonder schemawijziging.
- **Aanwezigheid van een rij = recht verleend.** Er is geen `granted`-booleaan; intrekken
  is de rij verwijderen. Dat voorkomt een derde toestand ("bestaat, maar false").
- RLS: `SELECT` voor eigen rijen (`user_id = auth.uid()`), plus alle rijen van de eigen
  tenant voor `tenant_admin`, plus `is_platform_admin(auth.uid())`. `INSERT`/`UPDATE`/
  `DELETE` uitsluitend voor `tenant_admin` of `is_platform_admin`. Bij `INSERT` dwingt de
  `WITH CHECK` bovendien `granted_by = auth.uid()` af. Een `marketing`-gebruiker kan
  zichzelf dus niets toekennen.
- Helper `public.has_permission_grant(uuid, uuid, text)` — `STABLE SECURITY DEFINER`,
  `search_path = public`. Volgens de SEC-0a-conventie: `EXECUTE` ingetrokken van `PUBLIC`
  en `anon`, verleend aan `authenticated` en `service_role`. `authenticated` is nodig
  omdat de functie binnen een RLS-policy door de rol van de aanroepende sessie wordt
  geëvalueerd. `anon` niet: de betreffende `discount_codes`-policies staan alle drie op
  `TO authenticated` — gecontroleerd in `pg_policies.roles` vóór de migratie, bevestigd.
- De drie write-policies op `discount_codes` behouden hun naam en de
  `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`-voorwaarde; alleen het
  rolgedeelte wijzigde. `tenant_admin` en `staff` blijven **onvoorwaardelijk** bevoegd:
  zij zijn de rollen die het recht ook kunnen toekennen respectievelijk de bestaande
  operationele rol, en hen afhankelijk maken van een grant zou de tenant kunnen
  opsluiten (niemand kan dan nog een code aanmaken). Alleen `marketing` is afhankelijk.
- De `SELECT`-policy op `discount_codes` is **niet** aangeraakt: lezen blijft voor alle
  rollen behalve `warehouse`, conform de matrix. De grant gaat uitsluitend over schrijven.

### Waarom `useCan` synchroon blijft

`useCan(action, resource)` is een pure, synchrone check op `useAuth().roles` en wordt op
tientallen plaatsen gebruikt, inclusief in render-paden zonder loading-state. Een
asynchrone grant-lookup erin bouwen zou de hele applicatie raken (elke gate zou een
tussentoestand "nog onbekend" krijgen). De grant is daarom een **aanvullende** check
náást `useCan`, via de nieuwe hook `src/hooks/usePermissionGrants.ts`
(`usePermissionGrants` + de afgeleide `useCanWriteDiscountCodes`). `PERMISSION_MATRIX`
zelf is ongewijzigd.

### Drie plaatsen voor rechten

Rechten leven nu op **drie** plaatsen:

1. `PERMISSION_MATRIX` in `src/hooks/useCan.ts` (UI-gating),
2. de RLS-policies in de database (afdwinging),
3. `public.user_permission_grants` (per-persoon uitzondering).

Dit is beheersbaar zolang het bij een handvol resources blijft. Bij verdere uitbreiding
hoort de matrix éérst naar de database te verhuizen, zodat UI en RLS uit één bron lezen;
anders lopen de drie plaatsen onvermijdelijk uit elkaar.

### Frontend (aparte batch: PERM-1-UI, 01-08-2026)

De eerste batch werd afgebroken nadat de databaselaag was geland; de frontend is daarna in
een aparte batch afgerond. Zonder die batch was het recht wel vereist maar nergens toe te
kennen behalve met handmatige SQL. Wat er nu staat:

- `src/hooks/usePermissionGrants.ts` — `usePermissionGrants()` haalt de grants van de
  **huidige** gebruiker voor de **huidige** tenant op (`useAuth()` + `useTenant()`) en
  geeft `{ grants, hasGrant, isLoading, refetch }`. Stijl volgt `useTeamMembers.ts`:
  `useState` + `useEffect` + `useCallback`, geen react-query. Daarnaast de afgeleide
  `useCanWriteDiscountCodes()`, die `tenant_admin` / `staff` / `platform_admin`
  onvoorwaardelijk toestaat en voor `marketing` op de grant terugvalt (`needsGrant` voor
  de uitleg in de UI).
- `src/hooks/useTeamMembers.ts` — `TeamMember` heeft nu `canManageDiscountCodes`. De
  grants worden in **één** query per tenant opgehaald (`user_id, resource` gefilterd op
  `tenant_id`) en in-memory aan de leden gekoppeld; geen query per lid. `setPermissionGrant(userId, resource, granted)`
  doet insert (met `granted_by` = ingelogde gebruiker) of delete, met try/catch, toast en
  `await fetchMembers()`, in dezelfde stijl als `updateMemberRole`.
- `src/components/admin/settings/TeamSettings.tsx` — kolom "Kortingscodes" met een
  `Switch`, uitsluitend gerenderd voor leden met rol `marketing` (andere rollen: streepje,
  want zij hebben het recht onvoorwaardelijk of krijgen het sowieso niet). Bedienbaar
  alleen wanneer `useCan('write', 'team')` waar is; anders uitgeschakeld zodat de stand
  zichtbaar blijft. `aria-label` "Mag kortingscodes aanmaken en wijzigen". De
  rollenlegenda vermeldt nu expliciet dat kortingscodes beheren een apart, per persoon in
  te schakelen recht is en niet standaard bij de marketingrol hoort.
- Kortingscode-UI afgeschermd via `useCanWriteDiscountCodes()`:
  `src/pages/admin/Discounts.tsx` (knop "Nieuwe code" + uitleg-alert),
  `src/components/admin/DiscountCodeDialog.tsx` (opslaan geblokkeerd, lock-alert) en
  `src/components/admin/DiscountCodeCard.tsx` (bewerken/verwijderen verborgen). Lezen is
  ongewijzigd — de `SELECT`-policy is niet aangeraakt.
- `useCan` is bewust **synchroon** gebleven; de grant is een aanvullende check ernaast,
  niet een vervanging (zie de sectie hierboven).

**Losse observatie:** `getRoleBadge` in `TeamSettings.tsx` had géén `case 'marketing'` en
toonde daardoor sinds de uitbreiding van de `app_role`-enum de rauwe string `marketing` in
de ledenlijst. Gecorrigeerd naar een roze Marketing-badge, passend bij de legenda die die
badge al gebruikte.

### Verificatie (alle groen)

- `pg_class.relrowsecurity` op `user_permission_grants` = `true`.
- Vier policies: `SELECT` (eigen rijen / tenant_admin / platform_admin), `INSERT`
  (`granted_by = auth.uid()` + tenant_admin/platform_admin), `UPDATE` en `DELETE`
  (uitsluitend tenant_admin/platform_admin).
- `has_permission_grant`: `anon = false`, `authenticated = true`, `service_role = true`.
- `discount_codes`: `INSERT`/`UPDATE`/`DELETE` alle drie `gebruikt_grant = true`,
  `SELECT` = `false`.
- `cron.job` waar `command ILIKE '%permission_grant%'`: 0 rijen.
- Type-check (`tsgo -p tsconfig.app.json`) exit 0; JSON-parse van de vier
  `landing.*.json` OK.

### Geen migratie van bestaande data

Er zijn op dit moment geen gebruikers met de rol `marketing` (alleen `platform_admin` en
`tenant_admin`). Deze wijziging ontneemt vandaag dus niemand toegang en er zijn geen
grants te seeden.

### Rollback

```sql
-- 1. Oorspronkelijke write-policies op discount_codes (marketing onvoorwaardelijk)
DROP POLICY IF EXISTS "Marketing roles can insert discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can insert discount codes"
ON public.discount_codes FOR INSERT TO authenticated
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

DROP POLICY IF EXISTS "Marketing roles can update discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can update discount codes"
ON public.discount_codes FOR UPDATE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]))
WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

DROP POLICY IF EXISTS "Marketing roles can delete discount codes" ON public.discount_codes;
CREATE POLICY "Marketing roles can delete discount codes"
ON public.discount_codes FOR DELETE TO authenticated
USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))
  AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role]));

-- 2. Helper en tabel
DROP FUNCTION public.has_permission_grant(uuid, uuid, text);
DROP TABLE public.user_permission_grants;
```

### Openstaand

- De **promotietabellen** vallen nog **niet** onder de grant: `automatic_discounts`,
  `volume_discounts`, `volume_discount_tiers`, `bogo_promotions`, `gift_promotions`,
  `discount_stacking_rules`. Die volgen in een aparte batch zodra dit mechanisme zich in
  de praktijk bewezen heeft. Tot dan kan een `marketing`-gebruiker zonder grant wél nog
  promoties aanmaken — functioneel een vergelijkbaar risico, bewust buiten scope
  gehouden om de blast-radius van deze batch klein te houden.
- Een plafond op kortingswaarde (bv. maximaal 30% voor niet-beheerders) is een aparte
  batch en zit hier niet in.

### Openstaande actie — Akke

Newsletter-item voor PERM-1 staat in `docs/newsletter-queue.md` onder "Openstaand"
(2026.07ak, tenant-zichtbaar). Er bestaat geen wachtrij**tabel** in de database, alleen
dat document; het verzendmechanisme is nog te bevestigen, in lijn met SEC-3 en SEC-2a.

---

## SEC-0b — autorisatiechecks in RPC's die de frontend aanroept

**Datum:** juli 2026 · **Changelog:** 2026.07al · **Migratie:** 1 (geen tabelwijzigingen)

### Root cause

Na SEC-0a (EXECUTE ingetrokken op 35 puur-interne functies) bleef een tweede bucket over:
29 `SECURITY DEFINER`-functies die de frontend *wel* legitiem aanroept. Omdat ze als
definer draaien, omzeilen ze RLS volledig, terwijl de tenant-parameter gewoon uit de
client komt. Elke ingelogde gebruiker kon dus een willekeurige `tenant_id` (of
`product_ids` van een andere tenant) meegeven. De autorisatie zat enkel in de UI, niet in
de functie zelf.

### Aanpak

**Groep 1 — dood (EXECUTE volledig ingetrokken, alleen `service_role`)**
`generate_content_hash`, `get_invitation_effective_status`,
`initialize_ai_assistant_config`, `initialize_customer_communication_settings`.

**Groep 2 — onschuldig (alleen `anon` ingetrokken)**
`generate_gift_card_code`, `generate_fulfillment_api_key`, `generate_platform_ogm` —
pure code-generatoren zonder datatoegang, maar niet nodig voor niet-ingelogden.

**Groep 3 — tenant-guard toegevoegd + `anon` ingetrokken (22 functies)**

- *3a — expliciete tenant-parameter:* `generate_invoice_number`,
  `generate_order_number`, `generate_credit_note_number`, `generate_quote_number`,
  `generate_rma_number`, `generate_po_number`, `generate_proforma_number`,
  `generate_packing_slip_number`, `get_tenant_storage_bytes`,
  `find_order_by_reference`, `update_ai_learning_pattern`, `add_ai_credits`,
  `record_transaction`.
- *3b — gebruikersparameter:* `track_user_behavior`, `update_user_learning_pattern` —
  naast de tenant-check ook `p_user_id = auth.uid()`.
- *3c — tenant afgeleid uit de entiteit:* `get_order_return_tag`,
  `get_order_returnable_items` (via `orders.tenant_id`),
  `calculate_session_expected_cash` (via `pos_sessions.tenant_id`),
  `bulk_adjust_prices`, `bulk_adjust_stock`, `bulk_update_tags`,
  `bulk_update_social_channels` (via `products.tenant_id`).

`add_ai_credits` is géén tenant-handeling maar een platformhandeling: de guard eist
`is_platform_admin(auth.uid())`.

De bulk-functies zijn **alles-of-niets**: staat er één product buiten de eigen tenant in
`p_product_ids`, dan faalt de hele call (`42501`) en wordt er niets aangepast. Geen
stille filtering — dat zou een aanvaller een orakel geven en de teller misleiden.

### Guard-patroon

Alle guards gebruiken bewust:

```sql
IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
    OR _tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
  RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
END IF;
```

`auth.uid() IS NOT NULL AND ...` in plaats van een harde check, omdat een reeks van deze
functies óók vanuit edge functions op de **service-role** wordt aangeroepen — daar is
`auth.uid()` NULL en zou een harde guard checkout, tracking-webhooks en de
subscription-runner breken. Omdat `anon` in dezelfde migratie EXECUTE verliest, is
`auth.uid() IS NULL` voortaan gelijk aan "service-role of cron", niet aan "anonieme
bezoeker". Concreet geverifieerde service-role-aanroepers: `storefront-api`,
`stripe-connect-webhook`, `tracking-webhook`, `confirm-platform-bank-payment`
(`add_ai_credits`), en de AI-leerfuncties.

Twee functies waren `LANGUAGE sql` en zijn naar `plpgsql` gezet om een guard te kunnen
bevatten: `get_tenant_storage_bytes` en `get_order_returnable_items`. Returntype,
`STABLE`-volatiliteit, `SECURITY DEFINER` en `SET search_path` zijn ongewijzigd.

Interne aanroepers binnen de database zijn nagetrokken: `create_credit_note_from_return`
→ `generate_credit_note_number` en `redeem_gift_card` → `record_transaction`. Beide zijn
zelf `SECURITY DEFINER` met eigen tenant-context; de guard slaagt daar op de
tenant-lidmaatschapstak.

### Verificatie

Rechtenmatrix over alle 29 functies:

| groep | anon | authenticated | service_role | guard aanwezig |
| --- | --- | --- | --- | --- |
| 1 (4 functies) | f | f | t | n.v.t. |
| 2 (3 functies) | f | t | t | n.v.t. |
| 3 (22 functies) | f | t | t | ja (`42501`) |

Alle 29 rijen gecontroleerd via `has_function_privilege` en een `prosrc`-scan op
`42501`. Geen enkele functie is nog voor `anon` uitvoerbaar.

### Rollback

Draai per functie de vorige definitie terug (bewaard in `/tmp/bucketb.sql` tijdens de
batch; de definities staan één-op-één in de migratiehistoriek) en herstel de rechten:

```sql
GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon, authenticated;
```

Voor groep 1 volstaat `GRANT EXECUTE ... TO authenticated` — die functies hadden geen
guard, alleen ingetrokken rechten.

### Openstaand

- Een newsletter-item is **niet** nodig: tenants merken hier functioneel niets van
  (zie de werkwijze bij SEC-0a en SEC-1).
- De promotie-RPC's en de resterende `SECURITY DEFINER`-views (linter: `0010`) vallen
  buiten deze batch.

## VARIANT-GALLERY-1 — meerdere foto's per variant

`product_variants` kon maar één beeld dragen (`image_url`), waardoor een galerij per
variant niet mogelijk was: extra beelden (bv. een hoofdborddetail per kleur) konden
alleen in `products.images` en verschenen dan bij álle combinaties door elkaar.

Toegevoegd: `product_variants.images text[] NOT NULL DEFAULT '{}'`. `image_url` blijft
de hoofdfoto en leidend voor bestaande code — geen breaking change, geen backfill:
bestaande varianten houden een lege array.

`storefront-api` geeft in de variant-mapping van `getProduct` nu `images: v.images ?? []`
terug naast `image_url`. Cart, checkout en verzendklassen zijn niet aangeraakt.

Admin-UI: per variant een dialoog "Extra foto's" die het bestaande
"Kies uit bibliotheek"-patroon (`MediaLibraryPickerDialog`) hergebruikt, met herordenen
en verwijderen per beeld. Zichtbaar achter `PermissionGate action="write" resource="products"`
(dus `tenant_admin` en `staff`).

## CART-SHIP-PREVIEW-1 — verzendkosten vóór adresinvoer

`buildCartResponse` hield `shipping_display_state` op `not_calculated` zolang
`cart.shipping_method_id` leeg was, terwijl `available_shipping_methods` in dezelfde
functie al berekend wordt via `checkoutGetShippingOptions` — die filtert op de
verzendklasse van de cart-inhoud, niet op het adres. De prijs was dus vaak al bekend
zodra het mandje gevuld was, maar werd als "wordt berekend" weergegeven; klanten
ontdekten een toeslag van €100 pas in de laatste stap.

Nu: is er nog geen methode gekozen én is er precies één beschikbaar, dan geeft de
respons `shipping_preview: { name, price }`, met `shipping_cost` en
`shipping_display_state` (`free`/`charged`) daarop afgestemd; `total` wordt na dit blok
berekend en telt de preview mee. Een gratis-verzendkorting zet de preview op 0.

`shipping_method` blijft `null` tot er daadwerkelijk gekozen is — de preview is
informatief, `checkout_shipping` blijft verplicht voor het afronden. Bij meerdere
geldige methodes verandert er niets (`not_calculated`, `shipping_preview: null`).
Rollen: geen impact, dit is publieke storefront-API-logica zonder rolafhankelijkheid.

## SHIP-CLASS-2 — verzendklassen als entiteit + voorrangsregel

SHIP-CLASS-1 koppelde producten aan verzendmethodes via een vrij tekstveld
(`shipping_methods.shipping_class` en `product_specifications.shipping_class`).
Drie gebreken: typefoutgevoelig ("boxspring" vs "Boxspring" = stille mismatch),
geen overzicht van welke producten aan een methode hingen, en bij een gemengde
cart gaf `getShippingMethods` de methodes van **beide** klassen terug — de klant
koos dan de goedkoopste (matras gratis) terwijl er een boxspring van €100 in het
mandje zat.

Nu: `public.shipping_classes` als entiteit per tenant (unieke naam), met
`shipping_class_id`-FK's op `shipping_methods` en `product_specifications`.
Bestaande tekstwaarden zijn gemigreerd en gekoppeld (Astra Sleep: klasse
"boxspring", 1 methode + 2 producten); de tekstkolommen staan als DEPRECATED
gemarkeerd en worden in een aparte batch gedropt.

`tenants.shipping_conflict_rule` (`highest_price` standaard, of `sum`) bepaalt het
gedrag bij meerdere klassen in één cart: `highest_price` houdt alleen de duurste
methode over (bij gelijke prijs: laagste `sort_order`), `sum` telt de goedkoopste
methode per klasse op, zet die som als prijs op de duurste methode en geeft
`is_combined: true` plus `shipping_breakdown` mee. Het vangnet blijft: levert het
filter niets op, dan alle actieve methodes met een `console.warn`.
`checkout_shipping` valideert tegen dezelfde set en gebruikt bij `sum` de
gecombineerde prijs; een niet-toegestane methode geeft `SHIPPING_NOT_ALLOWED`.

Rollen: het beheer van klassen, het koppelen van producten en de voorrangsregel
zitten achter `PermissionGate action="write" resource="settings_general"`
(`tenant_admin`, `staff`; platform_admin via bypass). RLS op `shipping_classes`:
lezen voor leden van de tenant, schrijven voor `tenant_admin`/`staff` via
`has_tenant_role`, plus `is_platform_admin`-bypass. De storefront-API leest met
service-role en is rol-onafhankelijk.

## Billing-slotstuk: webhook-gat, refund-flow & smoke-opruiming — 1-4 aug 2026

**Root cause (webhook):** het Stripe-endpoint "Sellqo Platform" was nooit geabonneerd op payment_intent.*-events — alleen de oude Billing-laag-events. Sinds SUB-2 (off-session PI's) wachtte de handler op events die Stripe nooit verstuurde: 4 geslaagde SEPA's bleven weken op processing. Fix: events toegevoegd (succeeded/payment_failed/processing); historie via plan B gereconcilieerd (4 facturen op paid met échte Stripe-betaaldatums, manual_reconciliation-annotatie in metadata). SQ-2026-0003/0004 = organische end-to-end-test zodra hun SEPA settelt.

**REFUND-SUB-1 (2026.08a):** refund + auto-CN vanuit SellQo voor facturen zonder order (PI via Stripe-search op metadata.invoice_id) — productprincipe "boekhouder heeft alleen SellQo + Odoo nodig". Twee opvolg-bugs gevonden en gefixt in productie: (1) CN-FIX-1/2026.08b: dropdown-dialog unmount (onSelect preventDefault) + dode no-op-actie; (2) REFUND-FIX-1/2026.08f: PostgREST numeric-strings → string-concatenatie ("06.0501.05") brak de CN-insert ná de refund; fix = Number() + factuurtotaal als bron + completion-modus (self-healing). REFUND-UX-FIX/2026.08g: knop stuurt nu op refund_id ÉN CN-bestaan.

**Opruiming:** 7 CN's interne tenant (5×6,05 + 2×35,09) + CN-2026-0003 VanXcel (Mercken 299 via retour-flow, refund via Stripe-pad), alle drie smoke-abo's cancelled, BCC uit (parallelweek 15/7-1/8 clean afgesloten), dunning geneutraliseerd (0001/0004/SQ-0005). INV-2026-0002: CN vóór refund aangemaakt → refund eenmalig via Stripe-dashboard (guard-les).

**Vangsten/backlog:** CN-DUNNING-1 (CN moet bronfactuur uit dunning halen), cancelled-status ontbreekt in credit_notes CHECK-constraint, REFUND-UX-1 (refund als checkbox in CN-dialoog), GELD-1/PAYOUT-1-2 (payout- en fee-transparantie naar Odoo), initiële-charge zet status/attempts niet (SUB-2-familie). Astra SQ-2026-0001 (€60,50) bewust open — wacht op betaling Marawan.

## STOCK-1: voorraadrapport op elke datum — 4 aug 2026

**Aanleiding:** tenants (en hun boekhouder) hebben een gewaardeerde voorraadlijst nodig op een willekeurige datum — o.a. 31/12 voor de jaarrekening. Belofte aan Pieter (Finobi) in de VanXcel-mail.

**Kernbeslissing:** er is GEEN voorraad-grootboek; stock is een live kolom op products en product_variants (beide met cost_price). Historische voorraad wordt daarom GERECONSTRUEERD: stock(D) = huidige stock + verkocht na D − ontvangen na D. Vandaag = live snapshot; verleden = reconstructie met zichtbare amber-disclaimer.

**Uitgevoerd:** nieuwe pagina /admin/reports/stock (menu "Voorraadrapport" onder Rapporten), useStockReport-hook met gebatchte queries (geen N+1), datumkeuze, reconstructie op niet-geannuleerde orders na D + PO-ontvangsten (received_at, met status+updated_at als benadering, zichtbaar gemeld), alleen track_inventory-producten, negatief→0 met per-rij-waarschuwing, filters (zoek/categorie/nulvoorraad-toggle), totalen, CSV+XLSX-export met kopblok (onderneming, datum, timestamp, disclaimer). Changelog 2026.08h, i18n 4 admin- + 4 landing-locales met pariteit.

**Datavangst bij oplevering:** van 39 getrackte VanXcel-producten hadden er 19 geen kostprijs (waonder #12003, doorheen de Shopify-import geglipt). Akke vulde kostprijzen aan en zette testproducten op track_inventory=false → 25 getrackte producten, alle met stock>0 gewaardeerd. Cross-check 31/12/2025: reconstructie €13.938,53 (2.175 st) vs live €13.047,06 — richting klopt (verleden > heden = netto verkocht sindsdien). Export voor Pieter bevestigd correct.

**Beperking / vervolg (STOCK-2):** reconstructie mist handmatige correcties en marketplace-syncs (eerlijk gedisclaimerd). STOCK-2 = echt stock_movements-grootboek dat elke datum exact maakt i.p.v. gereconstrueerd, inclusief die mutaties. Klein stuksverschil (2.175 vs 2.177 in export) door PO-ontvangstdatum-benadering — lost STOCK-2 op.

## STOCK-2: voorraadgrootboek (stock_movements) — 4 aug 2026

**Aanleiding:** STOCK-1 kon voorraad alleen reconstrueren omdat er geen mutatie-historie was. STOCK-2 legt elke voorraadbeweging vast zodat elke datum exact wordt i.p.v. gereconstrueerd.

**Ontwerp (one-gateway):** i.p.v. 20+ schrijfpunten te herschrijven, is de bestaande SECURITY DEFINER RPC decrement_stock/decrement_variant_stock herschreven om via één kern-functie record_stock_movement te lopen (past delta toe, leest balance_after, schrijft stock_movements-rij). Signatuur onveranderd → de Stripe-webhook en sync-bol-orders krijgen ledgering gratis. increment_stock/increment_variant_stock toegevoegd voor retours.

**Tabel stock_movements:** tenant_id, product_id, variant_id, delta (±), balance_after, reason (sale/return/purchase/sync/manual/opening/adjustment), reference_type/id, note, created_by, created_at. RLS: alleen SELECT voor tenant-leden; INSERT enkel via SECURITY DEFINER (geen client-bypass). Indexen op (tenant,product,created_at) etc.

**Opening balances:** idempotent geseed (NOT EXISTS-guard), delta=balance_after=huidige stock. 105 product-openings + variant-openings = 528 rijen.

**UI:** InlineStockStepper in ProductVariantsTab loopt nu via handleStockChange → ledger met reason 'manual' (geen directe stock-update meer die het grootboek omzeilt). Per variant een voorraadhistoriek-knop → StockLedgerDialog (datum/reden/delta/saldo/notitie, vertaald). Shared helper _shared/stockLedger.ts (logStockMovement, no-op bij delta 0) voor edge-side logging.

**Sync-paden:** Odoo/Shopify/WooCommerce inventory-sync loggen 'sync'-movements via de helper. PO-ontvangst logt 'purchase'.

**Post-flight geverifieerd:** grootboek-identiteit sum(delta)=live stock over 105 getrackte producten met 0 mismatches en 0 negatieve saldi. Verkoop-test (decrement_stock in teruggedraaide transactie): stock -2, één 'sale'-rij met balance_after correct. Changelog 2026.08i, i18n 4 admin + 4 landing met pariteit.

**Scope-vangst tijdens post-flight:** oorspronkelijke prompt nam aan dat bol/amazon/ebay inventory-sync lokale stock overschrijven → die zouden 'sync' moeten loggen. Recon toonde dat deze drie OUTBOUND zijn (pushen SellQo-stock naar de marketplace, schrijven geen lokale stock: Bol update marketplace_mappings, Amazon/eBay enkel last_synced_at). Er is dus niets te loggen — geen gat. Bol-VERKOPEN lopen via sync-bol-orders → decrement_stock (logt al). STOCK-2 daarmee volledig; geen STOCK-2b nodig.

**Vervolg/backlog:** STOCK-1 reconstructie kan later vervangen worden door directe ledger-optelling voor datums ná invoering (exacter dan de order/PO-reconstructie). Lovable paste de migratie deels toe zonder git-bestand op één timestamp — DB is de waarheid bij post-flight, niet enkel de repo.

## UPGRADE-PF-1: upgrades volledig pay-first — 5 aug 2026

**Aanleiding:** `sync-tenant-plan` action=switch was het laatste invoice-first eiland. Het zette het plan direct live, maakte daarna een volledige periode-factuur (geen delta) en liet de oude periode ongemoeid → te veel gefactureerd, soms dubbel, en bij interval-swap een verkeerd startplan. Upgrade = direct (na betaling), downgrade = periodegrens.

**Pre-flight (verse grep, les uit de sloop-audit hierboven):** `calculate-plan-switch` / `execute-plan-switch` / `usePlanSwitch` / `PlanSwitchPreview` hadden nul aanroepers → pas daarna gesloopt (code + config.toml + edge functions verwijderd). Kolomtypes gecontroleerd vóór DDL: `pricing_plans.id` en `tenant_subscriptions.plan_id` zijn `character varying`, dus `target_plan_id` idem (geen uuid).

**DDL:** enum `billing_cycle_type` (recurring|proration); `billing_cycles.cycle_type/target_plan_id/target_interval/description`; `cancelled` toegevoegd aan `billing_cycle_status`; `tenant_subscriptions.pending_billing_cycle_id`. Unieke periode-key beperkt tot `cycle_type='recurring'` (partieel) + nieuwe partiële `billing_cycles_open_proration_key`: maximaal één openstaande proration-cyclus per subscription — de DB is de guard, niet enkel de code.

**Pro-rata:** shared `_shared/planProration.ts` rekent op de ECHTE lopende prijs uit `subscription_lines` (niet op de plan-catalogus, die kan afwijken van wat de tenant betaalt): delta = (nieuw − huidig) × resterende dagen / periode-dagen. Periode/btw-bron = laatste cyclus + lijn 0. Interval-swap: nieuwe periode start vandaag, ongebruikte dagen van de oude periode in mindering. Bij delta ≤ 0 → geen cyclus, direct effectueren.

**Effectuatie:** shared `_shared/planEffectuate.ts` is idempotent en de enige plek die een plan live zet (subscription_lines, subscriptions, tenant_subscriptions, tenants). Mandaat-pad: PaymentIntent succeeded/processing → meteen effectueren, webhook is dan no-op. Manueel pad: cyclus blijft `awaiting_payment` met `pending_billing_cycle_id`; de webhook (`subscriptionCharge.effectuateProrationCycle`) effectueert bij settlement en maakt de factuur. Grace = 7 dagen, daarna expiry; runner (`generate-subscription-invoices`) sluit proration-cycli uit van de stale-sweep zodat hij niet met sync-tenant-plan vecht.

**PR-document/mail:** `generate-payment-request-pdf` wrapt nu de omschrijving i.p.v. te truncaten op 60 tekens (pro-rata-strings zijn ~100), `send-payment-request-email` toont de omschrijving in de samenvatting (`descriptionLabel` in 4 talen).

**UI:** `/admin/billing` toont een banner "je upgrade wacht op betaling" met bedrag, betaallink en annuleer-knop zolang onbetaald; planwissel geblokkeerd zolang er een open upgrade is (spiegelt de 409 van de backend); pending-downgrade-banner onderdrukt als er een pending upgrade staat. `get-platform-billing-status` kreeg `cancel_upgrade` + `pending_upgrade` in de status.

**Recon-vondst:** `subscriptions.tenant_id` = de interne SellQo-tenant, `tenant_subscriptions.tenant_id` = de klant. Die splitsing bepaalt waarom de billing-status via een service-role edge function moet en niet via RLS-queries uit de client.

**Slottaken:** changelog 2026.08u (`pay_first_upgrades`) in 4 landing-locales + geregistreerd in PublicChangelog. Billing-i18n `pending_upgrade` in 4 talen. DOCS-1: tenant-artikel `abonnement-en-betaalwijze-beheren` bijgewerkt met de pro-rata-rekenwijze, het "wacht op betaling"-scenario en de 7-dagen-expiry. Geen dataherstel van oude foute facturen (bewust besloten).

## 2026-08-06 (avond) — COOKIE-CONSENT-PUBLIC-1

- Publieke Sellqo-site had geen cookiebanner (GDPR/ePrivacy non-conform).
- Nieuw: `src/components/PlatformCookieBanner.tsx` — granulaire consent (noodzakelijk/analytisch/marketing), opslag in localStorage `sellqo-cookie-consent` (v1), events `sellqo-cookie-consent-changed`, helpers `hasPlatformConsent()` en `openPlatformCookieSettings()`.
- Gemount in `App.tsx` binnen de router; uitgesloten op `/shop/*`, `/admin`, `/platform`, `/pos`, `/checkout`, `/betaling` (tenant-storefront houdt zijn eigen `CookieBanner`).
- Footer: heropen-link "Cookievoorkeuren"; teksten in nl/en/fr/de via `landing.*.json` key `cookieConsent`.

## 2026-08-07 — PUSH-EDGE-1

- **Aparte trigger i.p.v. de e-mailtrigger uitbreiden.** `trigger_notification_email` (functie `notify_email_on_notification`) doet één `net.http_post` naar `create-notification`. Zou push in datzelfde pad zitten, dan zou elke fout in de push-tak (FCM down, ongeldig service account, OAuth-timeout) de e-mailnotificatie meesleuren — één gedeeld faalpunt voor twee onafhankelijke kanalen. Daarom een tweede, volledig losstaande trigger `notify_push_on_notification` op `public.notifications` (AFTER INSERT FOR EACH ROW) die dezelfde credentials uit `internal_config` (`supabase_url`, `supabase_anon_key`, `internal_webhook_secret`) leest en naar `/functions/v1/send-push-notification` post met dezelfde body-structuur. `pg_net` is fire-and-forget: de twee posts kunnen niet in elkaars falen terechtkomen.
- **Auth-model.** `send-push-notification` accepteert enkel calls met een `X-Internal-Secret` die matcht met `internal_config.internal_webhook_secret` (exact het interne pad van `create-notification`); mismatch of ontbrekende header → 401. Geen JWT-pad, want de enige caller is de DB-trigger.
- **User-resolutie hergebruikt het bestaande notificatiemodel**, niet een eigen bedenksel: als `notifications.user_id` gezet is, is dat de enige ontvanger; is die NULL (tenant-brede melding), dan alle `user_roles.user_id` voor die `tenant_id`. Devices komen uit `device_tokens` via `user_id IN (...)` — `device_tokens.tenant_id` is bewust NIET het filter (zie PUSH-DB-1: tokens zijn device-scoped, één device kan meerdere tenants dienen).
- **Kanaal-gate.** Push wordt alleen verstuurd als `tenant_notification_settings.push_enabled = true` voor exact (tenant_id, category, notification_type). Geen rij = geen push (opt-in, default false) → `200 {skipped:true, reason:'push_disabled'}`. Een uitgezette of onbekende categorie is geen fout en mag de trigger niet laten retryen.
- **Token-cleanup bij 404/410.** FCM v1 antwoordt `404 UNREGISTERED` / `410` wanneer een registratietoken is ingetrokken (app verwijderd, token gerotEerd, herinstallatie). Zulke tokens worden nooit meer geldig; ze laten staan betekent bij elke melding een gegarandeerd falende HTTP-call per dood device — de kostprijs groeit monotoon met churn. Daarom worden precies die tokens uit `device_tokens` verwijderd. Andere statussen (429, 5xx, auth-fouten) zijn transient of systeembreed en leiden expliciet NIET tot verwijdering.
- **Graceful degradation bij ontbrekend secret.** `FIREBASE_SERVICE_ACCOUNT` ontbrekend, geen geldige JSON, of missende velden (`project_id`/`client_email`/`private_key`) → `console.error("FIREBASE_SERVICE_ACCOUNT not configured")` + `200 {skipped:true, reason:'firebase_not_configured'}`. Een throw zou hier een 500 op een DB-trigger-pad opleveren voor een puur configuratieprobleem: ruis in de logs, geen extra informatie, en het risico dat een ontbrekende push-config als een defect in de notificatiepijplijn wordt gelezen. Idem voor een mislukte OAuth-exchange (`fcm_auth_failed`).
- **FCM-auth.** OAuth-token wordt in de functie zelf gemunt: RS256-JWT (service-account `client_email` → scope `firebase.messaging`) gesigneerd met WebCrypto op de PKCS8-key, daarna omgewisseld bij `oauth2.googleapis.com/token`. `project_id` komt uit het service account zelf, niet uit een tweede secret dat uit sync kan lopen.
- **Scope:** enkel edge function + trigger. Geen frontend, geen Capacitor, geen registratie-UI (volgende batch). Geen changelog/newsletter en geen doc_articles: nog niets tenant-zichtbaar.

---

## Auto-registratie tenant → klant in SellQo-tenant (BATCH 2a) — 7 augustus 2026

**Root cause.** Er bestond geen enkele machineleesbare band tussen een `tenants`-rij en de klant-rij die die tenant representeert in de interne SellQo-tenant (`d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`). De vijf echte tenants waren handmatig geseed; koppeling gebeurde impliciet op e-mailadres. Twee gevolgen: (1) een nieuwe tenant kwam simpelweg niet in de SellQo-klantenlijst terecht — signup en klantregistratie waren losse, menselijke stappen; (2) het nieuwsbrief-publiek was niet af te bakenen, omdat "is dit een echte tenant-eigenaar of een sandbox/smoke-test-rij?" alleen uit een e-mailadres viel te raden. E-mail is bovendien geen stabiele sleutel: hij verandert, en dezelfde eigenaar kan meerdere tenants hebben.

**Wat is toegevoegd.**
- `customers.linked_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL` — de expliciete koppeling. `SET NULL` en niet `CASCADE`: bij verwijderde tenant verdwijnt de relatie, maar de klant-historie (facturen, communicatie) blijft bestaan.
- Partiële unieke index `customers_linked_tenant_unique ON (linked_tenant_id) WHERE linked_tenant_id IS NOT NULL` — hard maximum van één klant-rij per tenant, en tegelijk de conflict-target die de trigger idempotent maakt. Partieel, want de overgrote meerderheid van klantrijen heeft geen tenant en NULLs mogen niet met elkaar botsen.
- `register_tenant_as_sellqo_customer()` + `register_tenant_as_sellqo_customer_trigger` AFTER INSERT op `tenants`, naast de bestaande trigger-familie (trial-subscription, ai-credits, return-settings, tenant_admin-rol, inbox-folders). Bewust een aparte trigger: een falende klantregistratie mag nooit de rol-toekenning of trial-aanmaak van een nieuwe tenant meesleuren.
- Nieuwe rijen krijgen `tags = ARRAY['tenant','sellqo-tenant']`, `customer_type='b2b'`, `email_subscribed = COALESCE(platform_newsletter_opt_in, true)` en `email_subscribed_at = now()` enkel bij opt-in. `platform_newsletter_opt_in` is de leidende voorkeur; de klant-rij is een projectie daarvan, geen tweede bron van waarheid.

**Backfill.** De vijf bestaande echte tenants zijn gekoppeld via een expliciete e-mail→tenant_id-mapping (VALUES-lijst, geen fuzzy match), enkel waar `linked_tenant_id IS NULL`. Tag `sellqo-tenant` toegevoegd met guard `NOT tags @> ARRAY['sellqo-tenant']`. `email_subscribed_at` aangevuld waar subscribed maar datum leeg. Natrek: 5/5 rijen met beide tags, correcte `linked_tenant_id`, subscribed + datum gezet. `bmaaruf@gmail.com`, `akke@studioakke.com`, `sandbox@sellqo.app` en `aaron.mercken@hotmail.com` zijn niet aangeraakt en houden dus géén `sellqo-tenant`-tag — daarmee vallen ze buiten elk publiek dat op die tag selecteert, zonder dat er een uitsluitingslijst onderhouden moet worden.

### Security-keuzes
- **SECURITY DEFINER + `SET search_path = public` is hier noodzakelijk, niet gemakzucht.** De trigger schrijft per definitie *cross-tenant*: hij vuurt bij het aanmaken van tenant X en schrijft een rij met `tenant_id = <SellQo-tenant>`. Geen enkele legitieme aanroeper heeft RLS-toegang tot de SellQo-tenant, dus onder `SECURITY INVOKER` zou de INSERT altijd door RLS geweigerd worden. Het vaste `search_path` sluit search-path-hijacking uit (een aanvaller die een eigen `customers` of `now()` in een voorliggend schema plaatst).
- **Aanvalsoppervlak blijft nul-extra.** De functie is uitsluitend als trigger bereikbaar en gebruikt geen enkele parameter van de aanroeper: alle waarden komen uit `NEW` (de rij die Postgres zelf aanlevert). Er is geen pad waarlangs een client de doel-`tenant_id` of het e-mailadres van de klant-rij kan sturen — de SellQo-tenant-id staat hard in de functie.
- **Anti-lus-guard (GUARD 1).** `IF NEW.id = <SellQo-tenant> THEN RETURN NEW` staat vóór alles. Wordt de SellQo-tenant ooit opnieuw aangemaakt of gerestored, dan zou hij zichzelf als klant registreren: een zelfreferentiële rij die elke rapportage over "aantal tenants" en elk nieuwsbrief-publiek vervuilt (SellQo mailt zichzelf). De guard is geen theoretische netheid maar de enige plek waar dit te stoppen is.
- **GUARD 2 (leeg e-mailadres).** `owner_email` is nullable op `tenants`, `email` is NOT NULL op `customers`. Zonder guard zou een tenant-insert zonder e-mail de hele signup laten falen op een NOT NULL-violation in een neventaak. Een lege sleutel levert bovendien nooit een bruikbare klant-rij op. Late e-mail-sync is expliciet uit scope (batch 2b).
- **Geen RLS-wijziging.** De klant-rij leeft in de SellQo-tenant; de bestaande tenant-isolatie op `customers` zorgt er automatisch voor dat de tenant zijn eigen "klant-kaart" niet ziet. Dat is het gewenste gedrag: dit is platform-administratie, geen tenant-data.

---

## BLOG-1 — Publiek blogsysteem (`blog_posts`) — 7 augustus 2026

**Root cause / welk gat dit vult.** `/blog` bestond als route, maar `src/pages/public/Blog.tsx` was een pure placeholder: een hardcoded lege staat zonder tabel, zonder detail-route en zonder enige indexeerbare content. Gevolg, in drie lagen: (1) sellqo.app had géén contentlaag die op long-tail zoektermen kan ranken — enkel product- en changelog-pagina's; (2) er was geen bron voor teasers in de platform-nieuwsbrief, waardoor elke mailing inhoudelijk terugviel op release-notes; (3) uitgebreide, redactionele stukken (boekhoudinzichten, tips) hadden nergens een thuis — `doc_articles` is de kennisbank van de hulpchatbot en `social_posts` is tenant-scoped marketing, dus beide zijn structureel de verkeerde plek. De oplossing is een eigen, platform-scoped tabel `blog_posts` met 4-talige `translations` (nl-kolom als basis + fallback) en een concept→gepubliceerd-workflow, zodat artikelen ingeschoten kunnen worden en pas na review live gaan.

**Ontwerpkeuzes.**
- **Categorie als conventie, niet als CHECK.** Een CHECK op `category` betekent een migratie per nieuwe rubriek, terwijl de labels toch al in i18n moeten leven. Bron van waarheid is `src/lib/blogCategories.ts`; een onbekende waarde valt in de UI terug op de rauwe string i.p.v. te crashen. Op `status` blijft de CHECK wél staan — daar hangt zichtbaarheid (en dus RLS) aan, en een typo als `'publshed'` zou een artikel stil onvindbaar maken.
- **`reading_minutes` bij publiceren berekend** (woorden/200, minimaal 1) en enkel wanneer het veld leeg is: een handmatig gezette waarde wordt nooit overschreven.
- **Sitemap build-time, niet runtime.** De publieke site is een static SPA; `/sitemap.xml` kan niet dynamisch geserveerd worden. `scripts/generate-sitemap.ts` haalt de gepubliceerde slugs via de anon key op (publieke SELECT-policy volstaat) en schrijft `public/sitemap.xml` via `predev`/`prebuild`. `lastmod` komt uit `updated_at` van het artikel — page-specifiek; de statische routes krijgen bewust géén `lastmod`, om geen build-datum als nep-signaal te sturen. Faalt de fetch, dan blijven de statische entries staan (gewaarschuwd, niet gecrasht).

### Security-keuzes

- **Twee losse SELECT-policies i.p.v. één samengestelde.** `Public can read published posts` (rol `anon, authenticated`, `status='published' AND published_at IS NOT NULL AND published_at <= now()`) en `Platform admins can read all posts` (`is_platform_admin(auth.uid())`). Postgres OR't SELECT-policies, dus het effect is identiek aan één `OR`-expressie — maar de publieke voorwaarde blijft apart leesbaar en apart auditeerbaar. Een toekomstige verruiming van de admin-policy kan zo nooit per ongeluk de publieke voorwaarde meeslepen. De `published_at <= now()`-clausule maakt een gedateerd artikel niet vroegtijdig publiek.
- **Drafts: 404 volgt uit RLS, niet uit een frontend-guard.** `/blog/:slug` doet één query zonder statusfilter. Anon krijgt fysiek geen rij terug en ziet de niet-gevonden-weergave; een platform-admin krijgt de rij wél en ziet een oranje CONCEPT-badge plus `noindex` in `PageMeta`. Zou de guard in de frontend zitten, dan zou de volledige draft-content nog steeds over de API meegaan en in de netwerktab leesbaar zijn.
- **Alleen platform-admin schrijft.** INSERT/UPDATE/DELETE staan alle drie op `is_platform_admin(auth.uid())`, mét `WITH CHECK` op INSERT en UPDATE (zonder `WITH CHECK` kan een UPDATE een rij naar een staat schrijven die de policy zelf zou weigeren). GRANTs zijn zo krap als de policies toelaten: `anon` krijgt enkel SELECT.
- **DOMPurify op de content-rendering.** `content` is rijke HTML en wordt met `dangerouslySetInnerHTML` gerenderd. Schrijfrechten liggen bij platform-admins, dus dit is geen user-generated input — maar de content komt via SQL/connector binnen en kan uit externe bron of AI-generatie stammen. Één `<script>` of `onerror=`-attribuut in zo'n import zou anders stored XSS zijn op een publieke, door iedereen bezochte pagina, in de sessie-context van elke ingelogde bezoeker. `DOMPurify.sanitize` met het html-profiel is de laatste verdedigingslijn op renderniveau, onafhankelijk van hoe zorgvuldig de invoer was.
- **Geen signed URLs voor beeld (bewust).** Cover-images en inline screenshots staan in de publieke bucket `marketing-assets`. Dit is per definitie openbare marketingcontent; R1 (nooit een signed URL in de DB) blijft gerespecteerd omdat er geen tijdelijke URL wordt opgeslagen, maar een permanent publiek pad.

---

## PUSH-FIX-1: thenable-proxy bug in native push-registratie — 7 augustus 2026

**Symptoom.** Na de eerste succesvolle build op een echt Android-toestel (Pixel 7): app opent en gebruiker is ingelogd, maar er verschijnt **geen** notificatie-permissiepopup en `device_tokens` blijft leeg. Geen zichtbare fout in de UI.

**Root cause.** `src/native/pushRegistration.ts` laadde de plugin via een async helper die de plugin-referentie direct terugliet vloeien:
```ts
async function loadMessaging() {
  const mod = await import('@capacitor-firebase/messaging');
  return mod.FirebaseMessaging;   // ← bug
}
// call-site: const FirebaseMessaging = await loadMessaging();
```
Op Android is `FirebaseMessaging` geen gewoon object maar een **Capacitor-Proxy** die élke property-toegang doorstuurt naar de native bridge — inclusief `.then`. Wanneer een `async` functie zijn resultaat *returnt*, draait de JS-spec de *thenable resolution procedure*: als de resolve-waarde een `.then` heeft, wordt die aangeroepen om de promise te "adopteren". Dus `return mod.FirebaseMessaging` → JS roept `FirebaseMessaging.then(resolve, reject)` aan → Capacitor kent geen native methode `then` → gooit `"FirebaseMessaging.then() is not implemented on android"`. De promise van `loadMessaging()` rejecte daardoor, nog vóór `checkPermissions()`/`requestPermissions()`/`getToken()` ooit werd bereikt.

Omdat `registerPushForUser` in `useAuth.tsx` werd aangeroepen als `void registerPushForUser(id)` (zonder `.catch`), werd de rejection een **stille unhandled promise rejection**: de hele push-flow stopte zonder spoor in de UI. Logcat-bewijs (op toestel):
```
Msg: [Auth] State change: SIGNED_IN ...
Msg: Uncaught (in promise) Error: "FirebaseMessaging.then()" is not implemented on android
```
en het systeemlog toonde `checkPermission: missing 13 for <uid>` (permissie 13 = POST_NOTIFICATIONS) — bevestiging dat de aanvraag nooit plaatsvond.

**Alleen op echt Android reproduceerbaar, niet op web.** Op web levert `@capacitor-firebase/messaging` een gewoon JS-implementatie-object zonder `.then`, dus niet-thenable → geen crash, flow wordt sowieso door `Capacitor.isNativePlatform()` gepoort. De bug bestaat uitsluitend omdat de native bridge een alles-doorsturende Proxy teruggeeft. Web-testen (en de Vite-build) konden dit dus nooit vangen; het kwam pas boven op de fysieke Pixel 7 via wireless debugging + logcat.

**Fix.** Nooit een promise laten resolven met de kale proxy — wrap in een gewoon (niet-thenable) object:
```ts
async function loadMessaging() {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  return { FirebaseMessaging };   // plain object → geen proxy.then()
}
// call-sites: const { FirebaseMessaging } = await loadMessaging();
```
Aangepast op alle drie de call-sites (`attachListeners`, `registerPushForUser`, `unregisterPushForUser`).

**Hardening.** De drie `void registerPushForUser(...)`-aanroepen in `useAuth.tsx` (onAuthStateChange-hoofdpad, stale-storage-refreshpad, en `initializeAuth`) vervangen door `registerPushForUser(id).catch(err => console.error('[push] registration failed', err))`. Een toekomstige fout in de registratie wordt daarmee zichtbaar in de console i.p.v. stil te verdwijnen als unhandled rejection — precies wat het opsporen van deze bug had versneld.

**Verificatie (op toestel).** Na rebuild + redeploy toonde logcat de volledige keten: `[Auth] State change: SIGNED_IN` → `checkPermissions` `{"receive":"prompt"}` → native `requestPermissions` → Android `GrantPermissionsActivity` (de popup verscheen daadwerkelijk). Permissie werd op het toestel eerst geweigerd (Android onderdrukt daarna elke re-prompt); na `adb shell pm grant app.sellqo.admin android.permission.POST_NOTIFICATIONS` + app-herstart liep de flow door naar `{"receive":"granted"}` → native `getToken` zonder fouten → upsert. `device_tokens` bevat sindsdien één rij: `platform='android'`, echte FCM-token (142 tekens), `device_name='android device'`, `tenant_id=NULL` (device-scoped, zie PUSH-DB-1), `created_at`/`last_seen_at` gezet.

**Build-context (nevenwijzigingen in dezelfde commit).** Om überhaupt op het toestel te kunnen bouwen was de Android-toolchain-config bijgewerkt: `android/build.gradle` AGP 8.7.2 → 8.9.1 en `android/variables.gradle` `compileSdkVersion` 35 → 36 (transitief geëist door `androidx.core:1.17.0` via firebase-messaging) en `minSdkVersion` 23 → 24 (geëist door de camera-plugin `io.ionic.libs:ioncamera-android`). Deze zijn functioneel los van de thenable-fix maar zaten in dezelfde build-sessie.

## APP-ROUTE-1 — Native "/" redirect (7 augustus 2026)

**Wat.** Route `/` rendert nu `<NativeLandingRedirect />` i.p.v. direct `<LandingPage />`. Op web is het gedrag byte-voor-byte identiek (de wrapper rendert `<LandingPage />`). In de Capacitor-app stuurt `/` door naar `/admin` (ingelogde gebruiker) of `/auth` (geen sessie).

**Waarom native-only.** De marketing-landing (pricing, testimonials, CTA "start gratis") is een acquisitie-pagina voor web-bezoekers. Iemand die de app al geïnstalleerd heeft is per definitie al geconverteerd; die eerst een verkooppagina tonen kost een extra tap en oogt onprofessioneel in een app-shell zonder browser-chrome. Web blijft ongewijzigd omdat SEO en acquisitie daar volledig van die landing afhangen.

**Waarom via `Capacitor.isNativePlatform()`.** Dat is de enige betrouwbare runtime-check die niet afhangt van user-agent-sniffing of build-flags: hij is `false` in de browser (ook in de Lovable preview) en `true` binnen de iOS/Android WebView. Zo blijft er één codebase en één bundle, zonder aparte native entrypoint of route-config.

**Waarom een loader tegen flikkering.** `useAuth` start met `loading: true` en `user: null`; direct op `user` beslissen zou in de app eerst een frame naar `/auth` sturen en na sessie-restore terug naar `/admin`. Daarom renderen we bij `loading` een neutrale spinner en pas ná de auth-beslissing een `<Navigate replace />`. `replace` voorkomt dat `/` in de native history blijft staan, zodat de hardware-back-button niet terug in de redirect valt. De landing wordt op native nooit gerenderd — de `isNative`-check staat vóór de loading-branch.

**Scope.** Alleen de nieuwe wrapper-component en één regel in `src/App.tsx`. Geen wijziging aan auth-logica, andere routes of native config. Geen changelog/newsletter (web-tenants merken niets) en geen `doc_articles` (interne app-routing, niet tenant-facing).

## PUSH-PERM-1 — Herstelbanner voor geweigerde push-permissie (7 augustus 2026)

**Waarom nodig.** `registerPushForUser()` in `src/native/pushRegistration.ts` stopt stil bij `receive !== 'granted'`. Zowel Android (POST_NOTIFICATIONS) als iOS tonen de permissie-prompt na een weigering **niet** opnieuw — `requestPermissions()` retourneert dan direct `denied` zonder UI. Zonder in-app signaal blijft een tenant dus permanent zonder push, zonder enige aanwijzing waarom orders niet doorkomen. Dit is precies de situatie die tijdens de PUSH-EDGE-1-test op de Pixel 7 optrad (herstel was daar alleen mogelijk via `adb shell pm grant`).

**Native-only.** `getPushPermissionStatus()` retourneert `'unsupported'` als `Capacitor.isNativePlatform()` false is; de banner rendert dan null. Web-tenants hebben geen FCM-registratieflow en zouden een onoplosbaar bericht zien.

**Detectie.** `checkPermissions()` is read-only en prompt nooit, dus veilig op mount. Alleen `'denied'` triggert de banner — `'prompt'` betekent dat de normale registratieflow de prompt nog gaat tonen, daar hoort geen waarschuwing bij.

**Gekozen settings-aanpak: geen plugin, manuele instructie.** Er is in dit project geen schone weg om de OS-instellingen te openen: `@capacitor/app` is niet geïnstalleerd (alleen `core`, `ios`, `android`, `camera`, `cli`) en `@capacitor-firebase/messaging` biedt geen `openSettings()`. Een nieuwe plugin (`capacitor-native-settings`) vereist `npx cap sync` + native rebuild en valt buiten de opdrachtscope ("geen nieuwe plugins zonder melding", "geen native config"). Daarom is `openAppNotificationSettings()` een gedocumenteerde no-op en toont de banner in plaats van een knop het platform-specifieke pad (iOS: Instellingen → Meldingen → SellQo; Android: Instellingen → Apps → SellQo → Meldingen). Bij een volgende native release kan de plugin toegevoegd worden en de no-op vervangen; de call-site en detectie hoeven dan niet te wijzigen.

**Dismiss via `useState`, niet localStorage.** Bewust: de permissie kan buiten de app veranderen en localStorage-persistentie zou de enige aanwijzing permanent verbergen. Her-tonen bij de volgende app-open is het gewenste gedrag.

**Scope.** Twee nieuwe exports in `pushRegistration.ts`, nieuwe `src/components/PushPermissionBanner.tsx`, één regel in `AdminLayout.tsx`. De bestaande registratieflow is onaangeroerd.

## LEGAL-ROUTE-FIX-1 — Publieke legal-pagina's toonden allemaal "Pagina niet gevonden" (8 augustus 2026)

**Root cause.** De zes publieke legal-routes in `src/App.tsx` zijn als vaste paden gedefinieerd — `/terms`, `/privacy`, `/cookies`, `/sla`, `/acceptable-use`, `/dpa` — alle zes met `element={<SellqoLegal />}` en **zonder** `:slug`-parameter. `SellqoLegal.tsx` haalde de slug echter op met `useParams<{ slug: string }>()`. Zonder route-parameter is `slug` per definitie `undefined`, waardoor `usePublicLegalPage(slug || '')` een lege string kreeg en de query door `enabled: !!slug` nooit werd uitgevoerd. Gevolg: `isLoading === false` en `page === undefined`, dus de component viel direct in de `if (error || !page)`-branch en rende de "Pagina niet gevonden"-state. Dit gold voor alle zes paden, niet alleen `/dpa`.

**De data was correct.** `public.sellqo_legal_pages` bevat alle zes records met `is_published = true` en slugs die exact gelijk zijn aan de URL-paden (`terms`, `privacy`, `cookies`, `sla`, `acceptable-use`, `dpa`). Er is dus niets aan de database, de RLS of de publicatiestatus mankeert — het was zuiver een routing/param-mismatch aan de clientzijde.

**Fix.** Eén bestand, `src/pages/SellqoLegal.tsx`: de slug wordt nu afgeleid uit `useLocation().pathname` wanneer de route geen parameter levert:

```tsx
const { slug: paramSlug } = useParams<{ slug: string }>();
const { pathname } = useLocation();
const slug = paramSlug ?? pathname.replace(/^\/+|\/+$/g, "");
```

**Waarom pathname-afleiding en niet de routes aanpassen.** Twee alternatieven zijn afgewogen. (1) Een prop per route meegeven (`<SellqoLegal slug="dpa" />`) betekent zes wijzigingen in `App.tsx` plus een props-interface, en dupliceert de slug op twee plaatsen. (2) De routes omzetten naar één `:slug`-route zou de zes expliciete publieke URL's opgeven en zonder whitelist elk willekeurig pad naar de legal-component sturen. De pathname-afleiding raakt precies één bestand, houdt de expliciete route-lijst intact als impliciete whitelist (alleen die zes paden bereiken de component) en blijft forward-compatible: `paramSlug ?? …` geeft voorrang aan een echte route-parameter zodra er ooit een `:slug`-route bijkomt.

**Waarom `??` en niet `||`.** Bij een aanwezige maar lege parameter is een leegwaarde een expliciete "geen pagina"-situatie; `??` valt alleen terug bij `undefined`, wat het onderscheid tussen "geen parameter in de route" en "parameter is leeg" bewaart.

**Verificatie.** Read-only browsertest tegen alle zes paden na de fix: `/terms → Terms of Service`, `/privacy → Privacy Policy`, `/cookies → Cookie Policy`, `/sla → Service Level Agreement`, `/acceptable-use → Acceptable Use Policy`, `/dpa → Data Processing Agreement`. Geen enkele route rendert nog de niet-gevonden-state.

**Scope.** Alleen `src/pages/SellqoLegal.tsx` (functioneel) plus changelog `2026.09f` (`legal_pages_fix`, type `bugfix`, i18n nl/en/fr/de). Routes in `App.tsx`, de hook en de database zijn onaangeroerd. DOCS-1: n.v.t. — geen nieuwe of gewijzigde tenant-feature, de pagina's tonen na de fix exact de content die ze altijd hadden moeten tonen.

## LOVEKE-POD-1a — Printful-fundament + coming-soon gating (9 augustus 2026)

**Scope.** Enkel het fundament van de Printful-koppeling (credentials, settings, variant-mapping, drie edge functions, UI-tab) plus een presentatie-laag die niet-actieve kanalen als "Binnenkort" toont. GEEN order-forwarding, GEEN webhook — die volgen in POD-1b/1c. Bestaande tabellen, hooks en edge functions zijn onaangeroerd; er is niets verwijderd.

**Nieuwe tabellen.**

| Tabel | Rol-toegang | Motivatie |
| --- | --- | --- |
| `tenant_printful_credentials` | RLS aan, **geen policies** (deny-all); alleen `service_role` heeft GRANT | Bevat het versleutelde Printful-token (AES-GCM) en de hash van het webhook-secret. Identiek aan `tenant_odoo_credentials`: geheimen mogen nooit via PostgREST bereikbaar zijn, ook niet read-only voor de eigenaar. De UI leest metadata (winkelnaam, laatste test) daarom via een `action: 'status'`-pad in `test-printful-connection`, niet via de tabel. |
| `tenant_printful_settings` | SELECT: `tenant_admin` + `viewer` binnen eigen tenant (of platform_admin); write: `tenant_admin` only | Spiegelt de `tos_*`-policies van `tenant_odoo_settings`. |
| `printful_variant_mappings` | SELECT: alle tenant-leden; write: `tenant_admin` only | Mapping is operationele data zonder geheimen; lezen mag breder dan schrijven. Index op `(tenant_id, printful_sync_variant_id)` voor de lookup die POD-1b op de webhook-kant nodig heeft. |

**Bewuste afwijking van het Odoo-patroon: geen `accountant`-rol.** `tenant_odoo_settings` geeft `accountant` schrijfrechten omdat dagboek- en BTW-mapping boekhoudbeslissingen zijn. Fulfilment is dat niet: wie bepaalt of bestellingen naar een externe printer gaan, neemt een operationele en commerciële beslissing. `accountant` krijgt hier dus geen write, en ook geen SELECT (de settings-SELECT eist `tenant_admin` of `viewer`).

**Crypto.** `_shared/printfulCrypto.ts` is een 1-op-1 kopie van het `odooCrypto.ts`-patroon (AES-GCM, `base64(iv).base64(ct)`, key-normalisatie via SHA-256) met eigen env-secret `PRINTFUL_CREDENTIALS_KEY`. Bewust géén gedeelde sleutel met Odoo: compromittering van één integratie mag de andere niet meenemen. Het token wordt nooit gelogd, nooit in een response teruggegeven en na opslaan nooit meer aan de UI getoond (het invoerveld toont enkel een placeholder "Opgeslagen — vul in om te vervangen").

**Edge functions.** `test-printful-connection`, `save-printful-credentials`, `disconnect-printful` — alle drie `authenticateRequest(req, tenantId)` + `requireRole(auth, tenantId, ['tenant_admin'])`, met `AuthError`/`authErrorResponse`, en `verify_jwt = false` in `config.toml` (in-code auth is leidend, consistent met `test-odoo-connection`). `save-printful-credentials` valideert het token eerst live tegen `GET https://api.printful.com/stores`; een niet-werkend token wordt nooit opgeslagen. Het webhook-secret wordt enkel bij eerste opslag gegenereerd en **alleen als SHA-256-hash** bewaard; het plaintext-secret komt precies één keer in de response en wordt door de UI genegeerd. `disconnect-printful` verwijdert de credentials en zet `printful_sync_enabled = false`, maar laat variant-mappings staan — herconnect moet niet betekenen dat een tenant zijn mapping-werk kwijt is.

**Coming-soon gating (presentatie-laag).** SQL-verificatie (2026-08-09) toonde: enkel `bol_com` heeft actieve `marketplace_connections`; `amazon`, `woocommerce`, `ebay` en alle social/messaging-kanalen hebben nul. Tenants zagen dus werkende "Verbind"-knoppen voor koppelingen die in de praktijk nergens live staan. `MARKETPLACE_INFO` krijgt daarom een `coming_soon`-vlag op `amazon`, `woocommerce` en `ebay` (Bol expliciet niet); `MarketplaceCard` en `UnifiedChannelList` tonen dan badge "Binnenkort" + disabled knop. Twee overrides, in deze volgorde: (1) een bestaande connectie wint altijd van de vlag — een tenant die al verbonden is, mag nooit buitengesloten worden; (2) `isPlatformAdmin` uit `useAuth` houdt de knop werkend (badge blijft staan), zodat platformbeheer kan testen zonder de vlag om te zetten. Er is niets verwijderd: alle cards, routes, hooks, edge functions en tabellen blijven bestaan, enkel de weergave verandert.

**Twee recon-beslissingen voor POD-1b/1c.**
1. **`external_id` = order-UUID zonder hyphens.** Printful beperkt `external_id` in de praktijk tot 32 tekens, wat exact de hyphenloze UUID-vorm is. Postgres' `::uuid`-cast accepteert die vorm, dus `find_order_by_reference` werkt ongewijzigd en er is geen extra kolom of mapping-tabel nodig voor de terugweg.
2. **Printful API v1 heeft geen webhook-signing.** Er is dus geen HMAC om tegen te valideren. Daarom een per-tenant secret in de webhook-URL, met hash-only opslag in `webhook_secret_hash` (constante-tijdvergelijking op de hash in POD-1c). Zodra Printful v2-signing GA is, migreren we naar signature-validatie; de hash-kolom kan dan blijven staan als transitiepad.

**Slottaken.** Changelog `2026.09g` (feature `printful_pod` + improvement `connect_availability`, NL/EN/FR/DE), newsletter-queue-item toegevoegd (niet verstuurd), en DOCS-1: nieuw tenant-artikel voor de Fulfilment-tab + bijwerken van het bestaande Connect-artikel met de live/aankomende kanalenlijst.

## LOVEKE-POD-1b — Printful order-forwarding + variant-mapping UI

**Nieuwe tabel: `public.printful_order_links`** (1 SELECT-policy, 0 write-policies).

| Aspect | Keuze | Motivatie |
| --- | --- | --- |
| Tabel i.p.v. kolommen op `orders` | Aparte linktabel met `UNIQUE (tenant_id, order_id)` | Nul wijzigingen aan `orders`/`order_items` = nul risico op gedeelde-paden-regressies (checkout, facturen, marketplace-sync, PDF's lezen alle dezelfde kolommen). De linktabel is puur additief en kan bij een terugdraai zonder gevolgen leeg blijven. |
| RLS | SELECT voor tenant-leden (`is_platform_admin(auth.uid()) OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`); **geen** INSERT/UPDATE/DELETE-policies | Alle writes gebeuren via `forward-printful-order` met de service-role. Een tenant mag nooit zelf een Printful-status "confirmed" kunnen schrijven zonder dat er echt is doorgestuurd. GRANT SELECT aan `authenticated`, GRANT ALL aan `service_role`. |

**Idempotentie-ontwerp.** `external_id = orderId.replace(/-/g,'')` (hyphenloze UUID, 32 tekens — beslissing uit POD-1a) in combinatie met `POST /orders?update_existing=true`. Dubbelklikken, retry na netwerkfout of een tweede "Doorsturen" leidt daardoor tot een *update* van dezelfde Printful-order, nooit tot een duplicaat. De upsert in `printful_order_links` gebruikt `onConflict: tenant_id,order_id`, dus ook aan onze kant blijft er precies één rij per order.

**Gift-card-uitsluiting.** Regels met `order_items.gift_card_id IS NOT NULL` worden vóór de mapping-stap uitgefilterd: een cadeaukaart is geen fysiek te printen artikel en zou bij Printful een onbedoelde productie triggeren. Bestaat een order enkel uit cadeaukaarten, dan volgt een 422 met NL-melding in plaats van een lege Printful-order.

**422-gedrag (fail closed, niets half versturen).**
- Regel zonder `variant_id` → reden "Geen variant gekoppeld".
- Regel met variant maar zonder actieve mapping → "Geen Printful-mapping voor variant X".
- Eén probleemregel volstaat: er wordt **niets** naar Printful gestuurd en de UI krijgt de volledige probleemlijst. Een half doorgestuurde order zou stil onderleveren.
- Onvolledig `shipping_address` → 422 die expliciet benoemt welk veld ontbreekt (naam, straat en huisnummer, plaats, postcode, land; `state_code` enkel verplicht voor US/CA/AU). Printful weigert zulke orders sowieso; wij geven de bruikbare foutmelding.
- Printful-fout of netwerkfout → `status='failed'` + `last_error` in de linktabel, zodat de orderpagina een "Opnieuw proberen"-knop kan tonen met de echte reden.

**Rollen.** `forward-printful-order`: `['tenant_admin','staff']` — doorsturen is operationeel dagelijks werk, niet een instellingsbeslissing. Bewust géén `warehouse`: die rol heeft een read-only fulfilment-scope en mag geen externe productie-opdracht plaatsen. `list-printful-sync-products`: `['tenant_admin']` only, omdat het pad het gedecrypte token gebruikt om de volledige Printful-catalogus te lezen (mapping = configuratie).

**Stap-6 status-fix (POD-1a post-flight).** In `test-printful-connection` is `requireRole` voor **uitsluitend** `action === 'status'` verruimd naar `['tenant_admin','viewer']`. Motivatie: het status-pad geeft alleen metadata terug (`configured`, `store_id`, `connected_store_name`, `last_test_at/ok`) en geen enkel geheim, terwijl `tenant_printful_settings` al SELECT-baar is voor `viewer`. Zonder deze fix kreeg een viewer een 403 op de Fulfilment-tab en dus een misleidend "niet verbonden"-beeld. De test-, save-, disconnect- en token-test-paden blijven `tenant_admin` only.

**Slottaken.** Changelog `2026.09h` (feature `printful_order_forwarding`, NL/EN/FR/DE), newsletter-queue: gebundeld met het bestaande POD-1a Printful-item (niet apart verstuurd), en DOCS-1: het tenant-artikel `printful-print-on-demand-koppelen` uitgebreid met varianten koppelen, een order doorsturen, de statussen en de cadeaukaart-uitsluiting.

## LOVEKE-POD-1c — Printful webhook (verzendbevestiging → klant)

**Geen schema-migration.** Alle benodigde kolommen bestonden al (`tenant_printful_credentials.webhook_secret_hash`, `printful_order_links.status/last_error/updated_at`, `orders.tracking_number/tracking_url/carrier/tracking_status/shipped_at`). Kolom-audit tegen `types.ts` uitgevoerd vóór implementatie; nul wijzigingen aan `orders`, `order_items` of enige bestaande tabel.

**Eigen dun update-pad i.p.v. `tracking-webhook` refactoren.** `tracking-webhook` bedient de bewezen carrier-/Bol-flow (API-key-auth, import-log, marketplace-terugkoppeling naar `confirm-bol-shipment`). Volgens het gedeelde-paden-principe (G1) zou een tweede consument met een ander auth-model en een andere payloadvorm precies het faalpatroon opleveren dat eerder labelprints brak. `printful-webhook` schrijft daarom zelf de tracking-velden en laat `tracking-webhook` volledig onaangeroerd (diff = leeg).

**Auth-model.** Printful API v1 biedt geen request-signing (vastgelegd in POD-1a). Daarom een per-tenant secret in de URL: `?t={tenantId}&k={secret}`. Bij binnenkomst wordt `sha256Hex(k)` in constante tijd vergeleken met `webhook_secret_hash` van die tenant; mismatch of ontbrekende parameter → 401. Extra binding: de order uit de payload moet via `printful_order_links` bij dezelfde tenant horen (`tenant_id`-filter op elke match-query, plus expliciete check → 403). `verify_jwt = false` omdat Printful geen JWT stuurt; de in-code auth is leidend. Secret en token komen nooit in logs of responses.

**Her-generatie van het secret bij elke save.** De plaintext kan niet uit de hash worden gereconstrueerd, dus bij herverbinden zou een oud secret geen kloppende webhook-URL kunnen opleveren. `save-printful-credentials` mint daarom bij élke save een nieuw secret + hash en registreert direct de bijhorende URL. Dat is veilig: Printful staat één webhook-URL per store toe, dus de nieuwe `POST /webhooks` overschrijft de oude registratie en het oude secret is per definitie dood.

**Idempotentie + status alleen vooruit.** Is `orders.tracking_number` al gelijk aan het tracking-nummer uit de payload, dan wordt niets gewijzigd (200). De orderstatus gaat uitsluitend van `pending`/`processing` naar `shipped`; `delivered`, `shipped`, `cancelled` en `returned` blijven ongemoeid — een late Printful-retry mag nooit een verder gevorderde status terugzetten. `shipped_at` wordt alleen gezet als het nog leeg is. De klantnotificatie (`send-customer-message`, `order_shipped`, in try/catch, non-fataal, met respect voor `tenant_tracking_settings.notify_on_shipped !== false`) vuurt uitsluitend wanneer de status in déze call naar `shipped` ging — dubbele verzendmails zijn daarmee structureel uitgesloten.

**Fulfilment-statussen blijven los van de order.** `order_canceled` en `order_failed` zetten alleen `printful_order_links.status` (+ `last_error`); de SellQo-order wordt nooit automatisch geannuleerd, want die kan al betaald of verzonden zijn. `order_refunded`, `order_put_hold` en `order_remove_hold` raken enkel `last_error` (bij remove_hold terug op `null`). `forwarded_at`/`confirmed_at` blijven ongemoeid.

**200-ack op alles behalve auth.** Printful retry't onbeperkt op non-2xx. Onbekend event-type, onparseerbare JSON, geen matchende link (kan een order zijn die niet via SellQo liep), ontbrekende order of een interne DB-fout → gelogd en 200 ge-ackt. Alleen auth-fouten geven een echte foutstatus: 401 bij ontbrekend/onjuist secret, 403 bij een tenant-mismatch op de order.

**Overige wijzigingen, strikt begrensd.** `disconnect-printful` doet vóór het verwijderen van de credentials een best-effort `DELETE /webhooks` (non-fataal). `test-printful-connection` geeft in het status-pad een extra `webhook_registered` boolean (`webhook_secret_hash IS NOT NULL`) — metadata, geen geheim — voor de UI-regel "Verzendupdates: actief". Geen andere edge function is aangeraakt.

**Slottaken.** Changelog `2026.09i` (feature `printful_shipping_updates`, NL/EN/FR/DE, generiek verwoord), newsletter-queue: gebundeld met het bestaande POD-1a/1b Printful-item (niet apart verstuurd), en DOCS-1: het tenant-artikel `printful-print-on-demand-koppelen` uitgebreid met automatische verzendupdates, de automatische verzendmail naar de klant en het feit dat de koppeling de webhook zelf instelt.

## LOVEKE-POD-1c-FIX — Printful webhook payload-parsing robuust

**Geen schema-migration, geen nieuwe functionaliteit.** Wijziging strikt beperkt tot `supabase/functions/printful-webhook/index.ts`; `tracking-webhook`-diff is leeg (geverifieerd).

**Bug A — defensief tracking-parsen.** De vorige code las `shipment.tracking_number` als vaste sleutel met `?.toString()`. Printful API v1 geeft geen schema-garantie op casing of type van deze velden, dus een afwijkende vorm leverde stil `null` of een crash op. Nu een `pickString()`-helper die meerdere kandidaten probeert (`tracking_number`/`trackingNumber`, `tracking_url`/`trackingUrl`, `carrier`→`service` als bestaande fallback), alles via `String()` + trim coerct en leeg als `null` teruggeeft. Bij een `package_shipped` zonder tracking-nummer volgt een expliciete waarschuwing met de shipment-object-keys in de logs, terwijl de order wél naar `shipped` gaat (status-alleen-vooruit blijft): een verzonden order zonder tracking is beter dan een gemiste of gecrashte verzendbevestiging, en de gelogde keys maken een eventuele vormafwijking direct diagnostiseerbaar zonder de tenant te raken.

**Bug C — multi-pakket: tracking niet blind overschrijven.** Printful vuurt `package_shipped` één keer per pakket. De oude code overschreef daardoor bij pakket 2 de tracking van pakket 1 — de klant kreeg een mail met nummer A en zag later nummer B in het portaal. Nieuw: leeg `orders.tracking_number` → schrijven; gelijk → idempotent 200; gevuld én verschillend → niet overschrijven, log "extra pakket, tracking behouden" en 200 ack. Het eerste pakket blijft leidend, precies het nummer dat in de verzendmail stond. De mail-logica is ongewijzigd: die vuurt enkel bij de daadwerkelijke statusovergang naar `shipped`, dus alleen op het eerste pakket.

**Bug B — retail_costs (bekend, uitgesteld).** `forward-printful-order` stuurt `retail_costs` zonder `tax`/`discount`, waardoor het pakslip-totaal bij Printful cosmetisch kan afwijken van de SellQo-order. Puur presentatie bij de fulfiller, geen invloed op productie, prijs of klantcommunicatie. Bewust niet in deze batch gewijzigd om de blast radius tot de webhook te beperken.

**Slottaken.** Geen changelog (interne robuustheidsfix; `2026.09i` dekt de feature al), geen newsletter, geen DOCS-1-wijziging — het gedrag naar de gebruiker toe verandert niet.

## LOVEKE-POD-2 — Printful product-import (preview + apply)

**Geen schema-migration.** Alle gebruikte kolommen bestonden al (`products.import_source/external_id/raw_import_data/imported_at/featured_image/images/hide_from_storefront/is_active/slug/price`, `product_variants.attribute_values/title/sku/price/image_url/images/position`, `printful_variant_mappings.*`). Kolom-audit tegen `src/integrations/supabase/types.ts` uitgevoerd vóór de eerste write; `products.slug` is verplicht en `(tenant_id, slug)` is unique, daarom een slug-generator met suffix-loop in `apply-printful-import`.

**Preview-first ontwerp.** `preview-printful-import` schrijft nul rijen: het leest Printful (`GET /store/products`, `GET /store/products/{id}`) en geeft een voorstel terug. Pas na expliciete bevestiging van de gebruiker — inclusief mogelijk aangepaste prijzen — schrijft `apply-printful-import`. Een import op een zware gedeelde tabel mag nooit een neveneffect zijn van "even kijken wat er in Printful staat".

**Bucket-opslag i.p.v. Printful-CDN-URL.** Product-thumbnail en variant-mockups worden server-side gedownload en met de service-role naar de bestaande publieke bucket `product-images` geüpload onder `{tenantId}/printful/{sync_product_id}/…`; in de DB komt uitsluitend de public URL van ons eigen bucket-object. Reden: een Printful-CDN-URL is niet onder onze controle (ontwerp verwijderd, CDN-rotatie) en zou stille dode beelden in de storefront geven. Geen nieuwe bucket. Faalt één download of upload, dan wordt die image overgeslagen en gaat de import door — een tijdelijke CDN-hik mag geen halve import opleveren.

**Strikt additief op `products`.** `products` wordt gedeeld door bol/amazon/ebay/shopify/woo/odoo-sync. De insert raakt uitsluitend basis- en import-kolommen; geen enkele marketplace-sync-kolom komt in de payload voor. Er is geen UPDATE- of DELETE-pad op bestaande producten in deze batch (per-product `try/catch`, alleen INSERT).

**Duplicaat-guard + idempotentie.** Per product wordt gecontroleerd of er al een rij bestaat met `tenant_id` + `external_id = '@' + sync_product_id` + `import_source = 'printful'`; zo ja → `skipped_duplicate`, geen tweede product. De preview markeert diezelfde producten als `duplicate: true` en zet ze in de UI standaard uit. De mapping-upsert gebruikt `onConflict: tenant_id,variant_id` en is dus herhaalbaar.

**Automatische variant-mapping.** Direct na elke variant-insert wordt `printful_variant_mappings` gelegd (`printful_variant_name = "productnaam · varianttitel"`). Daarmee verdwijnt het handmatige koppelwerk uit POD-1b voor geïmporteerde producten en werkt `forward-printful-order` meteen. Mislukt één mapping, dan wordt dat gelogd zonder de import te laten falen — de gebruiker kan hem dan alsnog handmatig leggen in de bestaande mapping-UI.

**Variant-parse-strategie (`_shared/printfulImport.ts`, pure functies).** Eerst de structurele velden (`sync_variant.product.color/size` → `"Kleur"`/`"Maat"`); alleen als die ontbreken wordt de variant-naam gesplitst op `/`, met de productnaam-prefix eraf en een size-heuristiek om `Maat` van `Kleur` te onderscheiden. Onbekende vormen vallen terug op `Optie 1/2/…` of de hele naam als één attribuut; de parser kan niet crashen. Labels zijn leesbaar en de titel volgt de SellQo-conventie `"waarde · waarde"`, consistent met bestaande tenants.

**Niet-live landen.** Nieuwe producten krijgen `is_active = false` en `hide_from_storefront = true` (plus `track_inventory = false`, want print-on-demand heeft geen voorraad). De tenant controleert teksten, prijzen en beelden en zet het product zelf live. De import mag nooit ongecontroleerde artikelen in een publieke storefront duwen.

**Rollen & auth.** `preview-printful-import` en `apply-printful-import`: `authenticateRequest(req, tenantId)` + `requireRole(auth, tenantId, ['tenant_admin'])`, `verify_jwt = false` in `config.toml` (in-code auth is leidend, consistent met de andere Printful-functies). Bewust géén `staff`: nieuwe producten aanmaken en prijzen bepalen is een configuratiebeslissing, geen dagelijkse orderhandeling. Het gedecrypte token komt nooit in een log of response. De import-knop in de Fulfilment-tab is alleen zichtbaar bij `configured` + schrijfrecht op `integrations`.

**Nul wijzigingen aan bestaande edge functions** (`list-printful-sync-products`, `forward-printful-order`, `printful-webhook`, `save-printful-credentials`, `disconnect-printful` ongemoeid): de nieuwe functies zijn eigen paden, zodat het gedeelde-paden-risico (G1) niet opnieuw wordt geïntroduceerd.

**Slottaken.** Changelog `2026.09j` (feature `printful_product_import`, NL/EN/FR/DE, generiek verwoord, tenant-visible), newsletter: gebundeld met het bestaande Printful-item (POD-1a/1b/1c) — niet apart verstuurd, en DOCS-1: tenant-artikel `printful-print-on-demand-koppelen` uitgebreid met de import-flow (voorbeeld eerst, prijs is aanpasbare suggestie, beelden worden overgenomen, varianten automatisch gekoppeld, producten landen niet-actief/verborgen).

## LOVEKE-POD-2-FIX — Volledige beeldenset per product

**Root cause:** de import nam per variant enkel `files[type='preview']` mee; bij een sync-product met dezelfde mockup per variant leverde dat de facto dezelfde thumbnail meerdere keren op i.p.v. de volledige beeldenset.

**Fix:** nieuwe pure helper `collectProductImages(syncProduct, syncVariants)` in `_shared/printfulImport.ts`: `sync_product.thumbnail_url` eerst, daarna álle `files[]`-entries (alle types: mockups, lifestyle, back-prints) over álle sync-varianten, plus `variant.product.image`. Dedup op URL met behoud van volgorde. `apply-printful-import` haalt het productdetail server-side op, downloadt elk uniek beeld en uploadt naar de bestaande `product-images` bucket onder `{tenantId}/printful/{syncProductId}/{index}-…`; `products.images` = volledige lijst bucket-URLs, `featured_image` = eerste beeld. Nooit een Printful-CDN-URL in de DB. Eén mislukte download wordt overgeslagen, de import gaat door. `preview-printful-import` geeft `image_count` terug voor de UI. Variant-`image_url` bleef ongewijzigd (werkte al correct).

**Reimport-vlag:** `apply-printful-import` accepteert optioneel `reimport: boolean`. Default (afwezig/false) blijft de duplicaat-guard op `external_id='@'+syncProductId` skippen (`skipped_duplicate`) — zonder expliciete vlag verandert er dus niets aan bestaande producten. Met `reimport=true` wordt uitsluitend `images` + `featured_image` overschreven; naam, prijs, `is_active`, `hide_from_storefront` en alle marketplace-sync-kolommen blijven ongemoeid omdat de tenant die mogelijk al heeft aangepast. Variant-mappings blijven bestaan (upsert idempotent, nooit verwijderd). Status `reimported_images`. In de UI is dit een expliciet "Beelden bijwerken"-knopje per al geïmporteerd product.

Geen changelog/newsletter/DOCS-wijziging: interne verbetering binnen de nog niet uitgerolde POD-2-feature.

## POD-2-CLEANUP — debug-diagnostiek opgeruimd + strikte beeldfilter

1. **Debug weg:** edge function `debug-printful-files` volledig verwijderd (map + `supabase/config.toml`-entry) en de secret `DEBUG_PRINTFUL_KEY` verwijderd. Was tijdelijke read-only diagnostiek, hoort niet in productie.
2. **Beeldfilter:** `collectProductImages` in `_shared/printfulImport.ts` laat uit `variant.files[]` nu uitsluitend `type === 'preview'` door. Print-/labelbestanden (`default`, `label_inside`, en elk ander niet-preview type) worden overgeslagen — die kwamen eerder als "productbeeld" binnen (het Loveke-logo, het binnenlabel). Behouden: `sync_product.thumbnail_url` eerst en `variant.product.image` als fallback; dedup op URL met behoud van volgorde. Reimport-logica en de rest van apply/preview ongemoeid.
3. **Bevinding (bewust niet gebouwd):** model-/lifestyle-mockups zijn NIET beschikbaar via `/store/products/{id}`; die komen enkel uit Printful's Mockup Generator API. Dat is een aparte integratie en is bewust niet geïmplementeerd — dergelijke beelden worden voorlopig manueel toegevoegd in de mediabibliotheek.

### LOVEKE-POD-2-SIZEGUIDE — Printful maatgids bij import

**Wat.** `apply-printful-import` haalt nu per product de Printful-maatgids op en slaat die volledig op in de nieuwe kolom `public.products.size_guide` (jsonb, nullable, default null — puur additief, geen constraint/index).

**Catalog product_id-afleiding.** Nieuwe pure helper `pickCatalogRefs()` in `_shared/printfulImport.ts`: eerst `sync_variant.product.product_id` (aanwezig in de meeste sync-variant-details); ontbreekt die, dan de catalog `variant_id` van de eerste geldige sync-variant, opgelost via `GET /products/variant/{variantId}` → `result.product.id`. Daarna één call `GET /products/{catalogProductId}/sizes?unit=cm,inches` met Bearer-token + `X-PF-Store-Id`. De volledige `result` (product_id, available_sizes, size_tables[] met type/description/unit/measurements inclusief de meetuitleg-teksten) wordt opgeslagen, zodat frontends zelf tussen cm en inch kunnen wisselen en de uitleg kunnen renderen.

**Efficiëntie.** Eén size-guide-call per product, hergebruikt via een in-memory cache op catalog product_id binnen dezelfde import-batch. Het product-detail dat al voor de beelden werd opgehaald, wordt hergebruikt — geen extra store-call.

**Non-fataal ontwerp.** Faalt de lookup, is de response niet ok, of ontbreekt de maatgids → `size_guide` blijft null, waarschuwing in de log ("geen size guide voor catalog product X") en de import gaat gewoon door. Een ontbrekende maatgids mag nooit een import laten falen.

**Reimport.** De bestaande `reimport=true`-vlag werkt nu ook de maatgids bij: het update-object bevat `images`, `featured_image` en (alleen als er een maatgids gevonden is) `size_guide`. Naam, prijs, `is_active`, `hide_from_storefront` en alle marketplace-sync-kolommen blijven ongemoeid.

**Scope.** Alleen de migration, `apply-printful-import` en de helper in `_shared/printfulImport.ts`. `preview-printful-import` bewust ongemoeid: een `has_size_guide`-vlag zou een extra API-call per product kosten en de preview merkbaar vertragen — niet essentieel. Geen changelog/newsletter (interne datavoorbereiding binnen nog-niet-uitgerolde POD-2).

**Frontend-weergave is een aparte taak.** Het tonen van de maatgids gebeurt in de Loveke custom frontend en valt expliciet buiten deze batch; SellQo core levert enkel de data. DOCS-1: tenant-artikel `printful-print-on-demand-koppelen` aangevuld met de automatische overname van de maatgids.

## LAYOUT-1 Batch A — centrale dialog-viewport fix
- **Root cause:** de base `DialogContent`/`AlertDialogContent` in `src/components/ui/dialog.tsx` en `src/components/ui/alert-dialog.tsx` staat `fixed left-[50%] top-[50%] translate-y-[-50%]` zonder `max-h` en zonder `overflow-y`. Bij inhoud hoger dan de viewport groeit het venster symmetrisch buiten beeld, waardoor de footer (o.a. "Opslaan" bij varianten bewerken) onbereikbaar wordt op zowel 390px als 1366px.
- **Fix:** `max-h-[90dvh] overflow-y-auto` toegevoegd aan beide base content-varianten (dvh i.p.v. vh i.v.m. mobiele browser-chrome). Via `cn`/twMerge overschrijven files met eigen `overflow-*` de base automatisch.
- **Dubbele-scrollbar guard:** `overflow-hidden` toegevoegd aan de 6 `flex flex-col`-dialogs die zelf een interne ScrollArea hebben maar nog geen eigen overflow zetten: AIFieldAssistant, SyncTestModeDialog, BolCsvImport, ProductSelectDialog, MediaLibraryPickerDialog, BulkAIGenerateDialog. (SessionReportDialog, ShippingMethodDialog en ProductBulkEditDialog zetten al `overflow-hidden` en zijn niet aangeraakt.)
- **Blast radius:** alle dialogs en alert-dialogs in de app (admin, platform, storefront). Puur presentational; geen backend, edge functions of SQL aangeraakt.
- **Test:** varianten-dialog past binnen beeld met zichtbare Opslaan-knop op 1366px én 390px; lange dialogs (TenantFormDialog) scrollen binnen het venster; BolCsvImport toont geen dubbele scrollbar.
- **Changelog:** versie `2026.09b` was al in gebruik (platform newsletter), daarom geregistreerd als `2026.09k`, type bugfix, publiek zichtbaar, i18n NL/EN/FR/DE. Geen newsletter (te kleine wijziging).
- **DOCS-1:** doc_articles met dialog-screenshots gecontroleerd — enkel gemarkeerd voor eventuele latere screenshot-verversing, geen inhoudelijke wijziging (layoutfix verandert geen flows).

## LAYOUT-1 Batch B1 — tabellen horizontale scroll (kale groep)

**Pattern**: kale `<Table>` gewikkeld in `<div className="w-full overflow-x-auto">` (zelfde pattern als `src/components/ui/responsive-data-table.tsx`). Tabellen met >= 5 kolommen kregen daarbij `min-w-[640px]` zodat kolommen niet samendrukken; smalle 2-4 koloms tabellen niet.

**Gewrapt met `min-w-[640px]`**: BankReconciliationUpload, CreditNoteDialog, ManualInvoiceDialog, QuoteItemsEditor, settings/VatRatesSettings, settings/WhatsAppTemplatesTable, platform/TenantCreditsTab (credit-historie tabel), platform/TenantInvoicesTab, ChannelFieldMappingAdmin, LoyaltyPrograms, MarketplaceDetail (3 tabellen), OrderDetail, PurchaseOrders, Tenants, platform/PlatformBilling (3 tabellen), platform/PlatformCoupons.

**Gewrapt zonder min-w** (smal): import/PreviewValidation (4 kolommen), pos/SessionReportDialog (2-koloms label/waarde kascontrole-tabel), platform/TenantCreditsTab (tweede, 4-koloms tabel).

**Overgeslagen**: `src/components/admin/products/StockLedgerDialog.tsx` — de `<Table>` staat al in `<div className="max-h-[60vh] overflow-auto">`, dus horizontale scroll is er al.

**Scope**: uitsluitend wrapper-divs (+ min-w className). Geen kolommen, sortering, logica, DialogContent, backend, edge functions of SQL geraakt. Typecheck groen.

**Changelog uitgesteld** — wordt bewust gebundeld met Batch B2 tot één gezamenlijke changelog-entry. Geen newsletter. DOCS-1: geen doc-impact (geen flow-wijziging).

## LAYOUT-1 Batch B2 — tabellen met bestaande overflow (+ gebundelde changelog B1+B2)

**Pattern:** deze tabellen zaten al in `<div className="border rounded-lg overflow-hidden">`. Die `overflow-hidden` is bedoeld om de afgeronde hoeken te clippen; hem vervangen door `overflow-x-auto` zou de radius-clip breken (vierkante hoeken op de tabelranden). Daarom is een **geneste** scroll-div toegevoegd:
`<div className="border rounded-lg overflow-hidden"><div className="w-full overflow-x-auto"><Table className="min-w-[720px]">…`
De buitenste div blijft clippen, de binnenste regelt horizontale scroll.

**Gewrapt (min-w-[720px], SEO-tabellen zijn breed):**
- src/components/admin/seo/CompetitorAnalysisPanel.tsx
- src/components/admin/seo/SEOCategoryTable.tsx
- src/components/admin/seo/SEOProductTable.tsx
- src/components/admin/seo/ScheduledAuditsPanel.tsx
- src/components/admin/seo/SearchConsolePanel.tsx
- src/components/admin/seo/SlugManager.tsx

**Gewrapt (min-w-[640px]):**
- src/pages/platform/PlatformBlog.tsx — desktoptabel binnen `hidden md:block`

**Bewust overgeslagen:**
- StockLedgerDialog.tsx, marketplace/shopify/ShopifyManualImport.tsx — hebben al `overflow-auto`, scrollen dus al horizontaal.
- marketing/EmailPreview.tsx, storefront/PreviewPanel.tsx, storefront/visual-editor/StaticPageEditor.tsx, storefront/visual-editor/VisualEditorCanvas.tsx — iframe/preview-canvas met device-toggle, geen data-tabel.

**Slottaken:** changelog `2026.09l` (bugfix, publiek, NL/EN/FR/DE) dekt B1 + B2 samen — B1 had bewust nog geen entry. Geen newsletter. DOCS-1: geen doc-impact. Geen kolommen/logica/backend/SQL geraakt.

## LAYOUT-2 Spoor 1 — product-flow mobiel (header, tabs, variant-kaart)

**Root-cause (per stuk):** rigide flex/grid zonder mobiele breakpoint.

1. `src/pages/admin/ProductForm.tsx` (~611) — header stond in één `flex items-center gap-4`-rij; op 390px werd de knoppengroep samengeknepen en viel Opslaan buiten beeld.
   Fix: buitenste div → `flex flex-col gap-4 sm:flex-row sm:items-center`; knoppen-div → `flex gap-2 flex-wrap w-full sm:w-auto`; beide knoppen → `flex-1 sm:flex-none`.
2. `src/pages/admin/ProductForm.tsx` (~646) — `TabsList` forceerde `grid grid-cols-4`, waardoor 4 labels op mobiel aan elkaar plakten ("MarketplacesAdvertenties").
   Fix: `flex w-full overflow-x-auto sm:grid sm:grid-cols-4` + `shrink-0` op elke `TabsTrigger`.
3. `src/components/admin/products/ProductVariantsTab.tsx` — `grid-cols-3` in een smalle kaart deed SKU en Prijs overlappen.
   Fix: afbeeldingen-grid (~411) → `grid grid-cols-2 gap-2 sm:grid-cols-3`; read-only detailgrid (~514) → `grid grid-cols-2 gap-2 text-sm sm:grid-cols-3`; SKU-waarde-span (~517) → `break-all`. Edit-modus grid (~485, `grid-cols-2`) bewust ongewijzigd.

**Scope:** puur Tailwind responsive-classes; geen handlers, logica, queries, edge functions of SQL. De `sm:`-varianten herstellen exact het huidige desktopgedrag (≥640px identiek).

**Test:** 390px → Opslaan volledig zichtbaar, tab-labels los/scrollbaar, SKU en Prijs zonder overlap; 1366px → ongewijzigd. Visuele browsercheck kon niet zelf worden uitgevoerd (admin-routes achter login).

**Slottaken:** changelog `2026.09m` (bugfix, publiek, NL/EN/FR/DE, key `product_page_mobile_fix`). Geen newsletter. DOCS-1: geen doc-impact.

---

## POS-header mobiel — Square-stijl ••• menu (vervolg LAYOUT-2 Spoor 2A-POS)

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Aanleiding:** de POSTerminal-header propte op telefoon alle 7 actieknoppen op één horizontale scrollrij; de terminalnaam werd afgekapt en sessie-acties waren praktisch onbereikbaar.

**Wijziging (`src/pages/admin/POSTerminal.tsx`, alleen de `<header>`):**
1. Bestaande knoppen-container: `flex items-center gap-2 overflow-x-auto` → `flex items-center gap-2 hidden lg:flex`. Inhoud byte-identiek — alle knoppen en hun condities ongewijzigd. Desktop (≥1024px) rendert exact zoals voorheen.
2. Nieuwe mobiele variant ernaast (`flex items-center gap-2 lg:hidden`): offline-Badge (bij `!isOnline`), reader-status als icoon-knop (Wifi groen bij `connectedReader?.status === 'online'`, anders CreditCard) → `setShowReaderDialog(true)`, en een `MoreVertical`-DropdownMenu met alle sessie-acties: Sync (`pendingCount > 0`), Kas +/-, Rapport, Retouren (alle drie bij `activeSession`), Geparkeerd (`parkedCarts.length > 0`), Instellingen, separator, Dag Sluiten (`activeSession`, `text-destructive focus:text-destructive`).
3. Imports toegevoegd: `MoreVertical` (lucide-react) en het bestaande DropdownMenu-patroon uit `@/components/ui/dropdown-menu`.

**Scope:** uitsluitend header-JSX + twee imports. Geen handlers, panelen, `cartPanelContent`, `cartTotals`, state-logica, queries of SQL aangeraakt. Elke conditie in het mobiele menu is identiek aan de desktop-knop.

**Changelog/newsletter:** valt onder de al aangekondigde changelog `2026.09n` ("Kassa vlot op tablet/telefoon") — zelfde feature afgemaakt. **GEEN** nieuwe changelog-versie, **GEEN** newsletter-item.

**DOCS-1:** tenant-doc `pos-gebruiken` ("Kassa op tablet of telefoon") aangevuld met één zin dat Kas +/-, Rapport, Retouren en Dag sluiten op telefoon via het ••• menu rechtsboven bereikbaar zijn. doc_level `tenant`.

**Test:** 390px → header één compacte regel, titel + starttijd niet afgekapt, reader-icoon + ••• zichtbaar, condities kloppen (geen sessie = geen Kas/Rapport/Retouren/Sluiten). 1440px → ongewijzigd. Livecheck in browser niet zelf uitgevoerd (kassa achter admin-login); `tsgo` slaagt zonder errors.

---

## Pagina-headers responsive (LAYOUT-2 Spoor 2A)

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Aanleiding:** in 17 admin-pagina's gebruikte de pagina-header `flex items-center justify-between` zonder mobiele stapeling → actieknoppen liepen op 390px van het scherm.

**Aanpak:** scriptmatige transformatie met conditionele match — alleen een `flex items-center justify-between`-div met binnen 2 regels een `<h1` als kind werd omgezet naar `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`. Zo bleven kaart-headers, tabelrijen en list-items (bv. MarketplaceDetail, POSTerminalSettings) ongemoeid. Overige classes op de div bleven staan.

**Gewijzigde regels (bestand → regel):** Analytics 101, AutoDiscounts 66, Bundles 53, Categories 424, ChannelFieldMappingAdmin 122, CustomerGroups 51, Discounts 89, GiftPromotions 60, Help 66, Marketing 70, Messages 273, Notifications 186, POS 92, PendingPlatformPaymentsPage 183, Promotions 192, Tenants 142, VolumeDiscounts 57 (alle in `src/pages/admin/`). Exact 1 transformatie per bestand; bestanden met 2-3 voorkomens hielden hun niet-header-varianten ongewijzigd.

**Knoppen-blokken:** `w-full sm:w-auto` toegevoegd aan het actie-div in Marketing (81), Notifications (193), PendingPlatformPaymentsPage (193). Waar de actie direct een `<Button>`/`<Tabs>`/`<GatedButton>` is (o.a. Analytics, Discounts, Tenants) is niets toegevoegd.

**2 grid-pagina's:** `LoyaltyPrograms.tsx` (~160) `grid grid-cols-3 gap-4 mb-6` → `grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6`; `SyncConflicts.tsx` (~188) `grid grid-cols-3 gap-4` → `grid grid-cols-1 sm:grid-cols-3 gap-4`.

**Scope:** uitsluitend Tailwind-classes. Geen logica, handlers, queries, edge functions of SQL.

**Slottaken:** changelog `2026.09o` (improvement, publiek, NL/EN/FR/DE, key `admin_headers_mobile`). **Geen newsletter** — het gaat om admin-only beheerpagina's, niet klant-facing storefront. Geen DOCS-1 (puur cosmetisch).

**Test:** 390px → titel boven, knoppen eronder volledig breed, grids 1 kolom; 1440px → ongewijzigd. `tsgo` zonder errors.

---

## Component-grids in dialogs responsive (LAYOUT-2 Spoor 2B)

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Aanleiding:** 8 grids in admin-dialogs/componenten hadden `grid-cols-3/4/5` zonder mobiele breakpoint. Per grid is eerst gecontroleerd of het een veld-grid (inputs/statkaarten) of een `TabsList` betreft — de juiste keuze verschilt.

**Gewijzigd (veld-/statgrids):**
1. `src/components/admin/marketplace/SyncTestModeDialog.tsx` (~192, statkaarten Totaal/Nieuw/…): `grid grid-cols-4 gap-3` → `grid grid-cols-2 sm:grid-cols-4 gap-3`.
2. `src/components/admin/promotions/GiftPromotionFormDialog.tsx` (~255, Aantal + velden): `grid grid-cols-3 gap-4` → `grid grid-cols-1 sm:grid-cols-3 gap-4`.
3. `src/components/admin/promotions/LoyaltyProgramFormDialog.tsx` (~187, Punten per €1 e.a.): `grid grid-cols-3 gap-4` → `grid grid-cols-1 sm:grid-cols-3 gap-4`.
4. `src/components/admin/promotions/LoyaltyProgramFormDialog.tsx` (~250, tier-rij van 5 velden): `grid grid-cols-5 gap-2 items-end` → `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 items-end`.

**Bewust ongewijzigd gelaten:**
- `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` (~502, TabsList 4 tabs): de labels (Producten/Orders/Klanten/Kortingen) staan al in `hidden sm:inline`; op telefoon rendert alleen het icoon. Geen overlap → met rust gelaten.
- `src/components/admin/TenantFormDialog.tsx` (~165, TabsList 3 tabs): Algemeen / Adres / Instellingen — korte eenwoordslabels die op 360px in 3 kolommen passen. Geen overflow-x nodig.
- `src/components/admin/marketplace/BolCsvImport.tsx` (~338, statkaarten in `max-w-md mx-auto`): kleine kaarten met één getal + kort label binnen een reeds smalle container; 3 kolommen blijven leesbaar op 390px.
- `src/components/admin/NotificationCenter.tsx` (~143, TabsList 4 tabs): labels zijn `text-xs` met korte teksten + count ("Alle (n)", "Nieuw (n)"); passen binnen de popover-breedte. Geen ingreep.

**Scope:** uitsluitend Tailwind grid-classes op 4 regels. Geen logica, handlers, queries, edge functions, SQL of andere grids.

**Slottaken:** valt onder changelog `2026.09o` (zelfde "mobiel schikken"-thema). **GEEN** nieuwe changelog-versie, **GEEN** newsletter, **GEEN** docs.

**Test:** 390px → veld-grids stapelen, tier-rij 2 kolommen, statkaarten 2 kolommen; tabs leesbaar. ≥640/768px → identiek aan voorheen. `tsgo` zonder errors.

---

## POS berekent btw nu identiek aan de webshop (POS-BEREKENING-1)

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Aanleiding (geldbug).** Bij `tenants.default_vat_handling = 'inclusive'` (de standaard) telde de kassa 21% btw **bovenop** een prijs die de btw al bevatte. Een artikel van € 299 werd als € 361,79 afgerekend.

**Root cause.**
1. `src/pages/admin/POSTerminal.tsx` (`cartTotals`, ~197): hardcoded `const taxRate = 21` en `total = subtotal − korting + btw` — geen enkele notie van `default_vat_handling`.
2. `src/hooks/usePOS.ts` (`createTransaction`, ~299): dezelfde formule nogmaals inline, dus ook de boeking/bon was fout.
3. `addToCart` (~240) zette blind `tax_rate: 21`, ongeacht het `vat_rate_id` van het product.

**Fix.** Nieuwe gedeelde helper `src/lib/calculations/posTotals.ts` → `calculatePosTotals(items, cartDiscount, vatHandling)`, die de canonieke webshop-logica in `supabase/functions/create-checkout-session/index.ts` (~488) **spiegelt** (die functie is niet gewijzigd):
- `inclusive`: `taxTotal = Σ per tarief round(basis − basis/(1+rate/100), 2)`, `total = subtotal − totaleKorting` (**geen** btw erbovenop).
- `exclusive`: `taxTotal = Σ per tarief round(basis × rate/100, 2)`, `total = subtotal − totaleKorting + taxTotal`.
- Btw wordt **per tarief** geaggregeerd en afgerond, conform `src/lib/calculations/ROUNDING_RULES.md` (BIS 3.0, per-rate — niet per-line). De cart-korting wordt proportioneel over de tarief-groepen verdeeld.

**Scherm + boeking gebruiken exact dezelfde helper**, dus de bon is per definitie gelijk aan wat de kassier zag. `addToCart` haalt het echte tarief via `vat_rate_id` uit `useVatRates`, met `tenants.tax_percentage` als fallback (niet blind 21). De cadeaukaart-regel blijft `tax_rate: 0`.

**Kolombetekenis `pos_transactions` onveranderd:** `subtotal` = bruto Σ prijs×aantal, `discount_total` = totale korting, `tax_total` = helper-btw, `total` = helper-total. Rapporten en btw-aangifte hangen hieraan en zijn niet aangepast.

**Expliciet NIET aangeraakt:** webshop/checkout-functies, facturen, creditnota's, rapporten, `ROUNDING_RULES.md`, en de rest van de insert in `createTransaction` (payments, cash, status, `record_transaction`-rpc).

**Verificatie (los script, niet in de app).**
- Test A — 1× € 299 @ 21% inclusive → `total = 299.00`, `taxTotal = 51.89` (= round(299 − 299/1.21, 2); 51,8926 → 51,89, identiek aan de canonieke checkout-afronding).
- Test B — 1× € 100 @ 21% exclusive → `total = 121.00`, `taxTotal = 21.00`.

**Slottaken.** Changelog `2026.09p` (bugfix `pos_vat_calculation_fix`, NL/EN/FR/DE, publiek), newsletter-item toegevoegd aan `docs/newsletter-queue.md` (nog niet verstuurd), DOCS-1: tenant-artikel `pos-gebruiken` aangevuld met één zin dat de kassa btw identiek aan de webshop hanteert. `tsgo` zonder errors.

---

## B2B-1 — publieke checkout VIES-validatie + `_shared/vies.ts` extractie

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Root cause (waarom nodig).** De enige VIES-implementatie zat inline in `supabase/functions/validate-vat/index.ts`, achter een harde admin-muur (`authenticateRequest` + `ADMIN_ROLES` = tenant_admin/staff/accountant, met platform_admin/service-role bypass). Storefront-bezoekers hebben geen JWT en konden dus tijdens checkout hun BTW-nummer niet laten valideren. Kopiëren van de VIES-logica zou een tweede bron van waarheid opleveren.

**Fix.**
1. Nieuwe gedeelde module `supabase/functions/_shared/vies.ts`: `cleanVatNumber`, `parseVatCountry`, `EU_COUNTRIES` (incl. `EL` en `XI`), `isEuCountry`, `callVies` (400 → "Ongeldig BTW-nummer formaat", 503 → service down met `service_unavailable`, overige non-2xx → throw).
2. `validate-vat/index.ts` gebruikt nu die module. **Gedragsidentiek**: zelfde response-velden (`valid`, `vat_number`, `country_code`, `company_name`, `address`, `request_date`, `request_identifier`), zelfde status-codes en foutteksten. De admin-auth is volledig ongewijzigd.
3. Nieuwe **publieke** actie `checkout_validate_vat` in `storefront-api/index.ts` (geregistreerd in de action-switch naast `checkout_customer`; geen auth, net als de andere checkout-acties).

**Misbruik-beheersing op het publieke pad.**
- **Cache 24 u**: bestaat er voor `(tenant_id, vat_number)` een rij in `vat_validations` met `validated_at > now() - 24 uur`, dan wordt dat resultaat teruggegeven met `cached: true` en **géén** VIES-call gedaan.
- **Rate-limit 10/min**: aantal `vat_validations`-rijen voor de tenant in de laatste minuut ≥ 10 → `{ code: 'RATE_LIMITED' }`. Cache-hits tellen niet mee (die schrijven niets).
- Niet-EU landcode wordt vóór elke DB/VIES-actie afgekapt als `VALIDATION_ERROR`.

**Logging.** Elke nieuwe validatie schrijft naar `vat_validations` met de reële kolomnamen uit `types.ts`: `tenant_id`, `customer_id` (NULL in checkout-fase), `vat_number` (genormaliseerd), `country_code`, `is_valid`, `company_name`, `company_address`, `validated_at`, `vies_request_id`. Een mislukte insert logt via `errMsg()` en breekt de response niet.

**Expliciet NIET aangeraakt:** alle andere checkout-acties, btw-berekening (`_shared/vat.ts`), cart/order-flow, `useVatValidation.ts` en de admin-auth van `validate-vat`.

**Verificatie.** `deno check` groen op beide functies; live curl tegen `storefront-api`: lege input → `VALIDATION_ERROR`, `BE0888888888` → `cached:false`, herhaling met `BE 0888.888.888` (andere opmaak, zelfde genormaliseerd nummer) → `cached:true` zonder nieuwe VIES-call.

**Slottaken.** Geen changelog/newsletter (nog niet tenant-zichtbaar; UI volgt in B2B-2). DOCS-1: platform-artikel `checkout-vies-validatie` (`doc_level='platform'`).

---

## B2B-2b — netto reverse-charge (btw-verlegging) in de checkout-BTW

**Datum:** 2026-08-10 · **Rol:** platform-admin

**Root cause (waarom nodig).** Alle checkout-prijzen zijn btw-inclusief en de btw werd altijd uit de brutoprijs geëxtraheerd (`extractVatFromGross`), ongeacht klanttype. Voor een EU-bedrijf met een geldig buitenlands btw-nummer moet de btw juist uit de prijs verdwijnen (art. 39bis WBTW): de klant betaalt netto en `tax_amount` is 0. Er was nergens een verleggingsbeslissing; B2B-2a leverde alleen de data (`is_b2b`, `customer_vat_verified`, `customer_vat_country`) aan.

**Rekenmodel (enige plek: `supabase/functions/_shared/vat.ts`).**
- `isReverseCharged({is_b2b, vat_verified, vat_country, tenant_country})` → `true` **alleen** als B2B **en** verified **en** `vat_country` in EU (`isEuCountry` uit `_shared/vies.ts`) **en** `vat_country !== tenant_country`. Binnenlands B2B (BE→BE) blijft 21%.
- `netFromGross(gross, rate)` = `round(gross / (1 + rate/100), 2)`; `rate <= 0` → bedrag ongewijzigd.
- Geen enkele aanroeper herhaalt de formule of de beslissing; de drie call sites gebruiken uitsluitend deze twee exports (order-paden via de wrapper `resolveCartReverseCharge` + `reverseChargeOrderFields`).

**Drie call sites (`storefront-api/index.ts`).**
1. `buildCartResponse` — bij verlegging worden `unit_price`/`line_total` per lijn netto gemaakt met het **per-lijn** tarief (`resolveLineVatBatch`/`resolveLineVatSync`, tenant-fallback `tenants.tax_percentage`), `subtotal` = som van de netto lijnen (dus geen centverschil), `shipping_cost` netto tegen het tenant-tarief, `total = subtotal − discount + shipping + fee`. Extra velden: `reverse_charge`, en bij verlegging `vat_regime: 'ic_supply_goods'` + `vat_text`.
2. `createOrderFromCart` (Stripe/bank-flow) — orderlijnen netto (`unit_price`, `total_price`), `vat_rate = 0`, `vat_amount = 0`; order: `subtotal` = som netto lijnen, `tax_amount = 0`, `total` netto, plus `vat_regime='ic_supply_goods'`, `vat_type='reverse_charge'`, `vat_text=…39bis…`, `vat_rate=0`. `vat_country` blijft het klantland uit B2B-2a.
3. `checkoutVerifyPayment` (verify-flow) — identiek gedrag met de eigen tenant-tarief-kolom van dat pad.

**Migratie.** `orders.vat_regime` (TEXT, nullable) toegevoegd — bestond nog niet; `vat_type`, `vat_text`, `vat_rate`, `vat_country` bestonden al.

**STAP 4 — `tenants.block_invalid_vat_orders`.** Bij order-creatie (`checkout_complete`) geldt: `is_b2b && !customer_vat_verified` én flag `true` → `{ code:'VAT_REQUIRED', message:'Een geldig BTW-nummer is verplicht voor zakelijke bestellingen' }`. Flag `false` → order gaat door als gewone inclusief-btw order (geen geldig nummer = geen verlegging).

**Testcases (geverifieerd met een Deno-script op de echte helpers, tenant = BE).**
| # | Situatie | reverse | subtotal/total | tax | regime |
|---|---|---|---|---|---|
| 1 | BE-consument, €121@21% | false | 121 | 21 | — |
| 2 | BE-bedrijf verified bij BE-tenant | false | 121 | 21 | — |
| 3 | NL-bedrijf verified, €121@21% | true | 100 | 0 | ic_supply_goods |
| 4 | NL-bedrijf niet verified | false | 121 | 21 | — |
| 5 | Gemengd €121@21% + €106@6%, NL verified | true | 200 | 0 | ic_supply_goods |

**⚠️ Gedeelde-paden-waarschuwing.** `_shared/vat.ts` wordt óók geïmporteerd door `stripe-connect-webhook`, `create-bank-transfer-order` en de marketplace-sync-functies. De wijziging is **strikt additief**: `resolveLineVatBatch`, `resolveLineVatSync` en `extractVatFromGross` zijn byte-identiek gebleven, dus die consumenten veranderen niet. `buildCartResponse` en beide order-paden vallen bij `reverseCharge === false` terug op exact de bestaande brutoberekening (alleen de lokale variabelen zijn omgedoopt naar `grossSubtotal`/`grossShipping`; totalen worden nu expliciet op 2 decimalen afgerond, wat float-ruis wegneemt maar geen bedrag wijzigt). Wie in de toekomst een vierde consument aan de verlegging toevoegt, moet dat via `isReverseCharged`/`netFromGross` doen — nooit met een eigen `/1.21`.

**Expliciet NIET aangeraakt:** de tenant-tarief-kolomnamen zoals ze in de code stonden (`tax_percentage` in pad 1, `default_vat_rate` in pad 2 — die laatste bestaat niet in het schema en valt dus terug op 21; bewust ongewijzigd gelaten conform opdracht), kortingsberekening (blijft op brutobasis), POS, facturatie, en de VIES-validatie zelf.

**Slottaken.** Geen changelog/newsletter (zichtbaar gedrag komt met de frontend-batch). DOCS-1: platform-artikel `checkout-customer-b2b-velden` uitgebreid met de verleggingslogica en de nieuwe `CartResponse`-velden. `deno check` groen; `storefront-api` gedeployed.

## B2B-CHECKOUT-BACKEND-1 — reverse-charge ontbrak op Stripe-bedrag in checkoutComplete

**Root cause:** BTW-verlegging werd correct toegepast in `buildCartResponse` en in de order-opbouw (`createOrderFromCart`), maar `checkoutComplete` gebruikte van `resolveCartReverseCharge` alleen `blocked`. De Stripe `line_items` namen daardoor de BRUTO `item.unit_price` (`Math.round(item.unit_price * 100)`), net als shipping en de `total` voor manual/QR. Gevolg: frontend + order-records netto (bv. EUR 247,11) terwijl Stripe bruto inde (EUR 299).

**Fix (uitsluitend in `checkoutComplete`):**
- `reverseCharge` uit de bestaande `resolveCartReverseCharge`-call gehaald.
- `tenantDefaultRate` (`tenants.tax_percentage`, al in de select) + `vatMap` via `resolveLineVatBatch`, opgebouwd buiten de Stripe-tak zodat manual/QR dezelfde bedragen gebruiken.
- `line_items`: `netUnit = reverseCharge ? netFromGross(unit, vat_rate) : unit`, per lijn via `resolveLineVatSync`.
- Shipping: `netShippingCost` gebruikt voor het Stripe-bedrag; conditie blijft `shippingCost > 0`.
- `total`: `effectiveSubtotal` (netto som van lijnen bij verlegging, anders `cart.subtotal`) `- discount + netShippingCost + fee`.
- Fee-logica ongewijzigd (transactiekost, geen btw). Discount-herverdeling ongewijzigd; die werkt op `li.price_data.unit_amount` en pakt dus automatisch de netto bedragen.

**B2C ongewijzigd:** bij `reverseCharge === false` geldt `netUnit === unit`, `netShippingCost === shippingCost` en `effectiveSubtotal === Number(cart.subtotal)` — byte-identiek gedrag.

**Testcase:** 1 item bruto EUR 299, tarief 21%, NL-btw verified, gratis verzending -> `netFromGross(299,21) = 247.11` -> Stripe `unit_amount = 24711`, `total = 247.11`.

**NIET aangeraakt:** `buildCartResponse`, `createOrderFromCart`, `resolveCartReverseCharge`, `_shared/vat.ts`, fee-berekening, andere edge functions, migraties, frontend.

**Changelog-kandidaat (nog niet gepubliceerd):** bugfix — "BTW-verlegging wordt nu correct toegepast op het betaalbedrag voor zakelijke bestellingen met een geldig EU-BTW-nummer."

## B2B-CHECKOUT-BACKEND-2 — B2B-status normaliseren in checkoutCustomer (verlegging bleef hangen na uitvinken/refresh)

**Root cause:** `checkoutCustomer` schreef de B2B-velden alleen wanneer ze in de payload zaten (`if (customer.X !== undefined)`). De status kon dus alleen "aan" gezet worden, nooit terug. Frontends die de velden weglaten bij refresh of na het uitvinken van de zakelijk-toggle lieten de cart op `is_b2b=true` + `customer_vat_verified=true` staan → verlegging bleef ten onrechte actief (te weinig btw geïnd). `checkout_validate_vat` schrijft niet naar de cart; `checkoutCustomer` is de enige schrijfplek voor deze velden.

**Fix:** B2B-status wordt bij elke `checkout_customer`-call genormaliseerd. Verlegging vereist expliciet `customer.is_b2b === true`; in alle andere gevallen worden `is_b2b`, `customer_company_name`, `customer_vat_number`, `customer_vat_verified`, `customer_vat_country` en `customer_vat_company_name` gereset naar null/false.

**Gevallen:** (a) `is_b2b=true` + `vat_verified=true` → velden gezet, verlegging blijft werken. (b) tweede call zonder `is_b2b` of met `false` op dezelfde cart → alle B2B-velden gereset → verlegging uit, klant betaalt weer incl. btw. (c) zuivere B2C → `isB2B=false` → velden op null/false (waren ze al), geen functionele verandering.

**NIET aangeraakt:** validatie/phone-required, basisvelden van `updateData`, de `.update()`-call, `buildCartResponse`, `checkoutComplete`, `resolveCartReverseCharge`, `checkoutValidateVat`, migraties, frontend. Geen nieuwe kolommen.

**Changelog-kandidaat (nog niet gepubliceerd):** bugfix/security — "Zakelijke bestelstatus wordt nu correct teruggezet wanneer een klant niet langer zakelijk bestelt, zodat de btw-behandeling altijd klopt."

## B2B-CHECKOUT-BACKEND-3 — B2B-velden in customer-object van buildCartResponse (rehydratie)

**Root cause:** `buildCartResponse` gaf `reverse_charge`/`vat_regime`/`vat_text` wel top-level terug, maar het `customer`-object bevatte alleen `email`, `first_name`, `last_name` en `phone`. Bij terugkeer/herlaad van de checkout kon een frontend dus niet zien dát (en als wié) de klant zakelijk bestelt: leeg formulier met de zakelijk-toggle uit terwijl de prijzen netto zijn (live gereproduceerd).

**Fix (puur additief):** het `customer`-object bevat nu extra `is_b2b`, `company_name`, `vat_number`, `vat_verified`, `vat_country` en `vat_company_name`, gelezen uit de cart-rij. `getCartForCheckout` gebruikt `select('*')` op `storefront_carts`, dus alle kolommen waren al beschikbaar — geen select-wijziging nodig.

**Gedrag:** B2C-cart → `is_b2b: false` en de overige B2B-velden `null`/`false`; B2B-cart → alle velden gevuld. Bestaande velden zijn ongewijzigd, dus geen breaking change.

**NIET aangeraakt:** `checkoutCustomer`, `checkoutComplete`, `createOrderFromCart`, `resolveCartReverseCharge`, `_shared/vat.ts`, btw-/totaalberekening, queries, migraties, frontend.

**Changelog-kandidaat (nog niet gepubliceerd):** enhancement — "Zakelijke gegevens blijven zichtbaar wanneer een klant terugkeert in de checkout."

## SHIP-GEO-1 — Verzendlanden per verzendmethode — 10 augustus 2026

**Root cause:** `shipping_methods` had geen enkel geografisch veld. De checkout bood een hardcoded lijst van 5 landen (BE/NL/DE/FR/LU) in `ShopCheckout.tsx`, terwijl `getShippingMethods`/`checkout_get_shipping_options`/`checkout_shipping` élke landkeuze dezelfde methodes en tarieven gaven. Custom frontends (Loveke, VanXcel, Astra) sturen willekeurige landcodes → een klant kon in principe naar US/AU bestellen tegen een BE-tarief.

**Uitgevoerd:**
- Migratie: `shipping_methods.countries text[]` en `tenants.shipping_allowed_countries text[]` (IF NOT EXISTS); bestaande methodes gebackfilld naar de EU-27-lijst.
- `src/lib/shippingRegions.ts` — `ALL_SHIPPING_COUNTRIES`, `EU_COUNTRIES`, `REGION_PRESETS` (EU-27, Benelux, Europa niet-EU), `summarizeCountries()`.
- Admin: `ShippingMethodDialog.tsx` landen-multiselect + regio-presets + live samenvatting; badge per methode in `Shipping.tsx`; `useShippingMethods.ts` en `types/shipping.ts` uitgebreid.
- `storefront-api`: landfilter in `getShippingMethods` (respecteert tenant-allowlist), geo-check in `checkout_get_shipping_options` en server-side validatie in `checkout_shipping`; nieuwe publieke actie `get_shipping_countries` (retourneert `{countries, unrestricted}`).
- Storefront: `ShopCheckout.tsx` vult de landendropdown dynamisch uit `get_shipping_countries`, met `ALL_SHIPPING_COUNTRIES` als fallback wanneer er geen restrictie is.

**Security-keuzes:** geen nieuwe tabellen of policies. `get_shipping_countries` is een publieke (anon) leesactie op `storefront-api`, net als de bestaande `get_shipping_methods`; ze geeft enkel landcodes terug van actieve methodes van de opgevraagde tenant — geen tarieven, geen interne velden, strikt gefilterd op `tenant_id`. Land-validatie gebeurt server-side in `checkout_shipping`, niet enkel in de UI, zodat custom frontends de restrictie niet kunnen omzeilen.

**Vangst uit recon:** de 300s-cache op verzendmethodes wordt overgeslagen zodra er op land gefilterd wordt, anders zou een gecachte lijst de geo-restrictie doorbreken. Verder bleek `_shared/vat.ts` géén export-regime (0% buiten EU) of OSS-drempel te kennen — orders naar de US krijgen nu nog 21% btw.

**Verificatie (live, Mancini Milano):** `get_shipping_methods` met `country=US` → `[]`; met `country=NL` → 1 methode; `get_shipping_countries` → 27 EU-landen, `unrestricted:false`.

**Vervolg:** btw-export (0% buiten EU) en OSS-drempel als aparte fase binnen de accounting-revisie — geplande architectuur houdt hier al rekening mee.

## VAT-CHECKOUT-PARITY-1 — Checkout gebruikt de canonieke btw-regime-engine — 10 augustus 2026

**Root cause:** de fiscale motor (`_shared/regimeResolver.ts`) kende alle 12 regimes, maar de storefront-checkout gebruikte hem niet. `storefront-api` besliste zelf via `isReverseCharged()` uit `_shared/vat.ts`, dat enkel intracommunautaire verlegging kent en `false` teruggeeft zodra het land buiten de EU ligt. Gevolg: een order naar de US kreeg in de checkout 21% btw aangerekend, terwijl `generate-invoice` diezelfde order via de resolver als `export_outside_eu` (0%, vak 47) classificeerde en `subtotalExcl = finalTotal` zette. De aangifte klopte, maar de klant betaalde 21% te veel en de omzet stond 21% te hoog in vak 47. Vóór SHIP-GEO-1 was dat pad onbereikbaar (geen verzending buiten de EU), sindsdien wel.

**Uitgevoerd:**
- `_shared/regimeResolver.ts`: pure `decideVatRegime()` geëxtraheerd uit de beslisboom van `resolveVatRegime()` (gedragsbehoudend — dezelfde functie voedt nu beide paden), plus `ZERO_RATED_REGIMES`/`isZeroRatedRegime()`.
- `storefront-api`: `resolveCartReverseCharge()` vervangen door `resolveCartVatContext()` → `{ regime, rate, text, zeroRated, blocked, destinationCountry }`. Bezorgland is bepalend; bij een gevalideerd EU-btw-nummer weegt het btw-land mee (zoals bij de factuur). `reverseChargeOrderFields()` werd `vatRegimeOrderFields()` en zet `vat_regime`, `vat_type`, `vat_text` en (waar van toepassing) `vat_rate` voor álle regimes.
- Regimeteksten komen uit `vat_regimes.invoice_text_nl` (in-memory gecached) met hardcoded fallback; de oude constante `REVERSE_CHARGE_TEXT` is verdwenen.
- Cart-respons geeft nu altijd `vat_regime`, `vat_rate` en `vat_text` mee; `reverse_charge` blijft als afgeleide boolean bestaan zodat Loveke, VanXcel en Astra ongewijzigd blijven werken.
- Storefront: `ShopCheckout.tsx` toont de regimemelding en gebruikt de server-`subtotal` in plaats van het lokale (bruto) cart-subtotaal.

**Rekenregels (bewust asymmetrisch, spiegelt `generate-invoice`):** bij nultarief-regimes (verlegging, uitvoer, art. 44) wordt de btw uit de bruto prijs gehaald → de klant betaalt netto en het Stripe-bedrag is netto. Bij OSS blijft het brutobedrag ongewijzigd en registreren we enkel het bestemmingstarief, exact zoals `generate-invoice` het brutototaal als inclusief het OSS-tarief behandelt. Binnenlandse verkoop is rekenkundig ongewijzigd (per-product tarieven blijven gelden, `vat_rate` wordt niet overschreven).

**Security-keuzes:** geen nieuwe tabellen, kolommen of policies. `resolveCartVatContext()` leest tenant-btw-instellingen met de bestaande service-role client van `storefront-api` en filtert strikt op `tenant_id`; de regime-beslissing gebeurt server-side, dus een custom frontend kan geen regime forceren. `vat_verified` blijft — net als in B2B-2b — een clientvlag die na `checkout_validate_vat` wordt gezet; dat gedrag is niet gewijzigd in deze fase.

**Verificatie (live, Mancini Milano, artikel van 240 incl. 21%):** BE B2C → `domestic_standard`, 240. US B2C → `export_outside_eu`, 198,35 (240/1,21), `reverse_charge:true`, tekst "Vrijgesteld van btw - Uitvoer - artikel 39 WBTW". NL B2C zonder OSS → `domestic_standard`, 240 (ongewijzigd). NL B2B met gevalideerd btw-nummer → `ic_supply_goods`, 198,35 (ongewijzigd t.o.v. B2B-2b). OSS-takken los getest op `decideVatRegime`: na activatiedatum → `oss_b2c_eu` met NL-tarief 21%, vóór activatiedatum → `domestic_standard`, `simplified_vat_mode` → `domestic_standard`. Edge functions `storefront-api`, `generate-invoice`, `create-manual-invoice`, `resolve-vat-regime` en `backfill-vat-regimes` opnieuw uitgerold (alle importeren de gewijzigde `_shared/regimeResolver.ts`).

**Niet in scope:** terugwerkend herstel van bestaande orders/facturen, wijzigingen aan aangifte/IC-listing/Peppol/Odoo-export.

## SHIP-GEO-2 — Landenlijst overal dynamisch per tenant — 10 augustus 2026
**Root cause:** na SHIP-GEO-1 haalde alleen `ShopCheckout.tsx` de verzendlanden dynamisch op. Er bleef een tweede bron van waarheid bestaan (`src/components/storefront/CheckoutForm.tsx`, ongebruikt, met hardcoded lijst incl. US/GB/CH/NO), en de dynamische dropdown had geen vangnet voor een voorgevuld land dat niet leverbaar is. Headless frontends kregen geen standaardland mee.
**Uitgevoerd:**
- Verwijderd: `src/components/storefront/CheckoutForm.tsx` (dode code, eigen landenlijst + eigen btw-logica).
- `src/lib/shippingRegions.ts`: `localizedCountryName(code, locale)` en `localizedCountryOptions(codes, locale)` via `Intl.DisplayNames`, met de Nederlandse naam als fallback en sortering in de actieve taal.
- `src/pages/storefront/ShopCheckout.tsx`: landenopties gelokaliseerd (`i18n.language`), auto-correctie naar `default_country` (of eerste toegestane land) wanneer de selectie niet leverbaar is, vast label bij exact één land, en melding "Deze winkel verzendt momenteel niet" bij een lege lijst. `unrestricted` bepaalt nu of de volledige lijst getoond wordt (voorheen viel een lege lijst ook terug op alles).
- `supabase/functions/storefront-api/index.ts`: `getShippingCountries` geeft naast `countries`/`unrestricted` ook `default_country` terug (tenantland indien toegestaan, anders eerste land). Backwards compatible; caching ongewijzigd.
**Security-keuzes:** geen nieuwe tabellen, policies of routes. `get_shipping_countries` blijft een publieke leesactie die enkel landcodes en het (publieke) winkelland van de opgevraagde tenant teruggeeft, strikt gefilterd op `tenant_id`. Server-side landvalidatie in `checkout_shipping` blijft de harde grens; de UI-wijzigingen zijn puur presentatie.
**Vervolg:** headless docs uitbreiden met het aanbevolen landkeuze-patroon (lijst ophalen, dropdown vullen, ongeldig land resetten).

## UI-POLISH-1 — Auth-terugknop, onboarding-scroll en PaymentsStep-tekst — 11 augustus 2026
**Root cause:** (1) `src/pages/Auth.tsx` had geen enkele uitgang naar de publieke marketingsite — bezoekers die per ongeluk op /auth landden konden alleen via de browser-back terug. (2) `OnboardingWizard.tsx` combineerde een `Card` met vaste hoogte (`h-[90vh] max-h-[90vh]` + `grid grid-rows-[auto_auto_1fr]`) met een interne `ScrollArea`, terwijl de overlay-div zelf al `overflow-y-auto` had. Twee scroll-containers boven elkaar gaven een "kadertje-in-kadertje"-gevoel: korte stappen (Welcome) rekten de card kunstmatig tot 90vh, lange stappen (BusinessDetails) scrollden in een klein binnenvak. (3) De disclaimer in `PaymentsStep.tsx` ("Geen Stripe? Geen probleem!") suggereerde dat de tenant zelf een betaalplatform moest regelen.
**Uitgevoerd:**
- `src/pages/Auth.tsx`: discrete `variant="link"`-knop met `ArrowLeft` ("Terug naar sellqo.app") boven het logo, op zowel het login/signup-scherm als het "Welkom terug!"-scherm; navigeert via de bestaande `useNavigate` naar `/`.
- `src/components/onboarding/OnboardingWizard.tsx`: `ScrollArea` (en de import) verwijderd, vaste hoogte en grid-rows vervangen door een meegroeiende card met `my-auto`. De overlay-div blijft de enige scroll-container; step-content staat nu direct in `CardContent` (p-6).
- `src/components/onboarding/steps/PaymentsStep.tsx`: enkel de tekst binnen de bestaande `AlertDescription` geherformuleerd naar "wij beheren alles"-toon; icoon en Alert-structuur ongewijzigd.
**Security-impact:** geen. Puur presentational/navigational; auth-logica, forms, validatie, wizard-handlers en `useOnboarding` zijn ongewijzigd. Geen nieuwe routes, tabellen of policies.
**Verificatie:** typecheck groen; changelog `2026.08ac` (improvement) toegevoegd met i18n-keys `login_setup_polish` in NL/EN/FR/DE.

## AUTH-DEADLOCK-1 — Auth-lock deadlock in stale-storage-herstelpad — 11 augustus 2026
**Root cause:** de `onAuthStateChange`-callback in `src/hooks/useAuth.tsx` draait binnen het supabase-js auth-lock (`navigator.locks`, dat alle auth-operaties serialiseert). In het `else if (hasStaleAuthStorage())`-pad werd `await supabase.auth.refreshSession()` — en bij mislukking `await safeLocalSignOut()` (`signOut({scope:'local'})`) — rechtstreeks binnen die callback geawait. Die calls wachten op een lock dat de callback zelf vasthoudt → deadlock tot de ingebouwde lock-timeout, met `AbortError: signal is aborted without reason`. Zolang de callback hing, blokkeerde élke volgende auth-call. Symptomatisch zichtbaar in onboarding-stap 3: `createTenant` → `ensureAuthenticated()` bleef hangen op `supabase.auth.getSession()` (log stopte na "[Auth] ensureAuthenticated: checking session...") en de wizard viel terug naar stap 3. Het `fetchUserRoles`-pad in dezelfde callback was al gedeferd via `setTimeout(0)`; het refreshSession-pad niet.
**Uitgevoerd:** het stale-storage-pad in de callback vervangen door `setTimeout(() => { void handleStaleStorage(); }, 0); return;`, en de volledige bestaande body 1-op-1 verplaatst naar een lokale async helper `handleStaleStorage()` binnen hetzelfde `useEffect` (inclusief `refreshSession()`, de `setSession/setUser/currentUserIdRef/registerPushForUser`-tak met het bestaande gedeferde `fetchUserRoles`-blok, en de `safeLocalSignOut()`-fallback met reset van session/user/roles/refs). `setLoading(false)` gebeurt voor dit pad aan het einde van de helper; de niet-gedeferde paden behouden hun eigen `setLoading(false)`.
**Niet aangeraakt:** SIGNED_OUT-pad, verse-login/user-switch-pad, tab-switch/TOKEN_REFRESHED-pad (`sameUser && hasResolvedRolesOnceRef`), `initializeAuth`, `ensureAuthenticated`, `getVerifiedAccessToken`, `useOnboarding`/`createTenant`, edge functions. Enkel `src/hooks/useAuth.tsx` gewijzigd.
**Security-impact:** geen. RLS, rollen, `hasResolvedRolesOnceRef`/`currentUserIdRef`/`rolesLoading`-semantiek en de vier auth-scenario's (verse login, tab-switch/token-refresh, session-restore, logout) zijn ongewijzigd; enkel de uitvoeringscontext van het herstelpad is buiten het auth-lock geschoven.
**Verificatie:** typecheck groen; changelog `2026.08ad` (bugfix) met i18n-keys `auth_session_stability` in NL/EN/FR/DE.

## ONBOARD-ROLES-1 — Lege admin-navigatie na onboarding (roles-state niet ververst) — 11 augustus 2026
**Root cause:** de onboarding maakt tenant én `user_roles` server-side aan (create-tenant edge function). Na creatie werden in `src/hooks/useOnboarding.ts` wél de tenants ververst (`refreshTenants()` + `setCurrentTenant()` in het succes-pad van `createTenant`, en `refreshTenants()` in `completeOnboarding`), maar nooit de client-side `roles`-state van `useAuth`. `AdminSidebar` berekent `scopedRoles` door `roles` te filteren op `r.tenant_id === currentTenant.id` en verbergt items via `canWithRoles(scopedRoles, 'read', resource)`. Zonder de verse `tenant_admin`-rol was `scopedRoles` leeg → bijna de hele navigatie viel weg en de gebruiker landde op een "dood" dashboard. Een handmatige F5 herstelde het omdat `initializeAuth` in `useAuth` de rollen dan opnieuw ophaalt.
**Uitgevoerd:** `useAuth.refetchRoles()` (bestaand, idempotent, ook gebruikt bij invite-accept) toegevoegd aan de `useAuth()`-destructuring in `useOnboarding` en aangeroepen op twee plekken: in het succes-pad van `createTenant` direct ná `setCurrentTenant(tenant)`, en in `completeOnboarding` direct ná `refreshTenants()`. Beide binnen de reeds bestaande try/catch, zodat een gefaalde refetch de flow niet breekt. Dependency-arrays van beide callbacks bijgewerkt met `refetchRoles`.
**Niet aangeraakt:** `useAuth`, `useTenant`, `AdminSidebar`, RLS, edge functions, skip-onboarding, het `wasExisting`-pad, de `?new=1`-flow en de session-expired handling. Enkel `src/hooks/useOnboarding.ts` gewijzigd.
**Security-impact:** geen. `refetchRoles()` is een read van `user_roles` die server-side al bestaat; geen permissie- of policy-logica gewijzigd. `RouteGuard` toont een spinner zolang `rolesLoading` true is en redirect niet, dus geen flikkering naar `/no-access` of `/auth`.
**Verificatie:** typecheck groen; changelog `2026.08ae` (bugfix) met i18n-keys `onboarding_nav_ready` in NL/EN/FR/DE.

## ONBOARD-EARLY-CLOSE-1 — Onboarding-wizard sluit vroegtijdig na tenant-creatie op stap 3 — 11 augustus 2026
**Root cause:** de guard "tenant bestaat → `onboarding_completed = true` → sluit wizard" stond in `checkOnboardingStatus` (`src/hooks/useOnboarding.ts`) VOOR de profiel-fetch en keek dus niet naar `onboarding_step`. Zodra `createTenant` op stap 3 een tenant aanmaakte (`refreshTenants()` → `tenants.length > 0` → het debounced effect met `tenants` in de dependency-array vuurde opnieuw), sloot die guard de wizard vroegtijdig en markeerde de onboarding als voltooid terwijl stappen 4-7 (logo, product, betalingen, launch) nog te gaan waren. De in-memory bescherming (`hasCreatedTenantRef`, een `useRef`) verdween bij een component-remount (uitloggen/opnieuw inloggen of harde refresh), waardoor de guard alsnog toesloeg. Denkfout: "tenant bestaat" ≠ "onboarding voltooid".
**Uitgevoerd:** guard verplaatst naar ná de profiel-fetch (direct na de `onboarding_skipped_at`-check) en aangevuld met de conditie `persistedStep = profile.onboarding_step ?? 1` en `persistedStep <= 1`, zodat een actieve doorloop (`step >= 2`) nooit meer vroegtijdig als voltooid wordt gemarkeerd. De conditie leunt op persistente DB-state i.p.v. de fragiele ref; `hasCreatedTenantRef` blijft behouden als extra bescherming binnen één sessie. `!isNewTenantFlow` blijft in de conditie staan, zodat de `?new=1`-flow onverkort de volledige wizard doorloopt.
**Geverifieerd tegen productiedata:** geen bestaand profiel leunt op deze guard om de wizard weg te houden — de `onboarding_completed`- en `onboarding_skipped_at`-checks (die vóór de nieuwe guard-positie staan) dekken de bestaande tenant-eigenaren al.
**Niet aangeraakt:** `OnboardingWizard`, `useAuth`, `useTenant`, RLS, edge functions, skip-onboarding, het `wasExisting`-pad en de session-expired handling. Enkel `src/hooks/useOnboarding.ts` gewijzigd.
**Security-impact:** geen — geen permissie- of RLS-logica gewijzigd; enkel de timing/conditie van het sluiten van de onboarding-wizard.
**Verificatie:** typecheck groen; changelog `2026.08af` (bugfix) met i18n-keys `onboarding_full_flow` in NL/EN/FR/DE.

## TENANT-DELETE-1 — Tenant verwijderen ruimde auth.users/profiles niet op — 11 augustus 2026
**Root cause:** de platform-admin "tenant verwijderen"-knop (`src/pages/admin/Tenants.tsx` → drie-puntjes → AlertDialog → `useTenants.deleteTenant`) deed een directe client-side `supabase.from('tenants').delete()`. Die delete cascadeert wél 194 tenant-scoped FK's (products, orders, user_roles, tenant_subscriptions, invoices, pos_*, ads_*), maar kan `auth.users` NIET verwijderen: PostgREST exposeert enkel het `public`-schema en de call draait met de gebruikers-JWT, niet met service-role. Gevolg: verweesde `auth.users` + `profiles` (`profiles` heeft geen `tenant_id`, hangt enkel aan `auth.users`), waardoor het e-mailadres "bezet" bleef en een nieuwe registratie met dat adres onmogelijk was. Daarnaast blokkeerden 2 NO ACTION-FK's (`credit_notes.tenant_id`, `ai_credit_purchases.tenant_id`) de delete stilletjes zodra die rijen bestonden — de UI toonde enkel de generieke toast "Fout bij verwijderen". Storage-objecten werden in geen enkele bucket geraakt.
**Uitgevoerd:** nieuwe service-role edge function `supabase/functions/delete-tenant/index.ts` met expliciete platform-admin-check op de caller (`auth.getUser(token)` → `user_roles` bevat `platform_admin`, anders 403). Volgorde: (1) omzet-guard — `orders.payment_status IN ('paid','refunded','partially_refunded')` (geverifieerde enum-waarden; `pending`/`failed` tellen niet mee) → bij >0 een 409 met `{ blocked: true, reason: 'has_paid_orders', count, tenant_name }`; (2) `candidateUserIds` vastleggen uit `user_roles` vóór de delete, want die rijen cascaderen weg; (3) blokkerende FK-rijen (`credit_notes`, `ai_credit_purchases`) expliciet verwijderen; (4) `DELETE FROM tenants`; (5) daarna pas de onomkeerbare acties — storage-purge per tenant-prefix (recursieve `purgePrefix`, `marketing-assets` enkel `{tenant_id}/` zodat platformbrede `blog/`-covers blijven, `tenant-logos` zowel `{tenant_id}/` als legacy `{slug}/`) en Stripe `accounts.del(stripe_account_id)` (niet-fataal, gerapporteerd in `stripe_error`); (6) users opruimen per candidate: `platform_admin` → altijd behouden, nog andere tenant-rollen → enkel loskoppelen, geen enkele binding meer → `auth.admin.deleteUser` (profiles cascadeert via `profiles_id_fkey`, e-mail komt vrij); (7) gestructureerd JSON-rapport (`deleted_users`, `detached_users` met reden, storage-aantallen per bucket, Stripe-status). `src/hooks/useTenants.ts`: `deleteTenant` roept nu `functions.invoke('delete-tenant')` aan, leest de gestructureerde foutbody via `error.context.json()` en toont een concrete melding i.p.v. de generieke toast; succes-toast vat op hoeveel gebruikers zijn opgeruimd/behouden.
**Bewust NIET gedaan:** de 2 NO ACTION-FK's blijven staan als laatste vangnet tegen een onbedoelde delete met boekhoudkundige historiek (stap 3 ruimt ze expliciet op). Cloudflare-domein blijft ongemoeid. `customers`/`support_tickets`/`admin_actions_log` hebben `ON DELETE SET NULL` en blijven met `tenant_id = NULL` bestaan (bekende rest-vervuiling, buiten scope).
**Niet aangeraakt:** `src/pages/admin/Tenants.tsx`, `TenantBulkActions.tsx`, alle RLS-policies, andere hooks en edge functions.
**Security-impact:** verhoogd privilege (service-role + `auth.admin.deleteUser`) maar afgeschermd door de expliciete `platform_admin`-check op de caller vóór elke andere actie; geen RLS of grants gewijzigd. Een `platform_admin` wordt nooit verwijderd (expliciete skip in stap 6b), een multi-tenant user wordt enkel losgekoppeld, een solo-tenant user verdwijnt volledig.
**Verificatie:** typecheck groen; edge function expliciet gedeployed (R6); changelog `2026.08ag` (improvement) met i18n-keys `tenant_delete_cascade` in NL/EN/FR/DE.

## ONBOARD-DOUBLE-CREATE-1 — createTenant kon twee keer draaien op onboarding-stap 3 — 11 augustus 2026
**Root cause:** op stap 3 van de onboarding-wizard kon `createTenant` twee keer draaien. De "Volgende stap"-knop in `src/components/onboarding/steps/BusinessDetailsStep.tsx` was `type="submit"` met enkel `disabled={!canContinue}` en lette niet op de processing-state, en `handleStepTransition(3)` in `OnboardingWizard.tsx` leunde op `if (!createdTenantId)` — een hook-state die pas na de re-render gevuld is (de `setState` in `useOnboarding` is asynchroon). Een tweede submit vóór die re-render passeerde de guard. `createTenant` zelf had geen in-flight guard: `hasCreatedTenantRef` wordt pas ná succes gezet en voorkomt alleen re-CHECKS in `checkOnboardingStatus`, geen tweede gelijktijdige creatie. Gevolg: poging 1 maakte de tenant aan, poging 2 botste op de net aangemaakte slug → `create-tenant` edge function 409 → `SlugConflictError` → `SLUG_CONFLICT` → gebruiker teruggeworpen naar stap 1 met "slug bezet", terwijl de winkel wél was aangemaakt. De auth-flow (`forceRefresh` → `TOKEN_REFRESHED` → refresh succeeded) was NIET de oorzaak; die werkte correct.
**Uitgevoerd:** (A) synchrone `useRef` in-flight guard `isCreatingTenantRef` in `createTenant`, gecheckt en gezet direct na `if (!user) return null;` — dus vóór élke await, inclusief de pre-flight slug-check — en vrijgegeven in een `finally` dat de volledige body omsluit. Alle exit-paden geven de ref vrij: succes (`return tenant`), `SESSION_EXPIRED` (`return null`) en elke throw (`SLUG_CONFLICT`, `MISSING_SHOP_DATA`, overige errors). Een tweede gelijktijdige aanroep logt een warning en returnt meteen `null` zonder de slug-check of edge function te raken. (B) `isProcessing` doorgegeven van `OnboardingWizard` aan `BusinessDetailsStep`; de "Volgende stap"-knop is nu `disabled={!canContinue || isProcessing}` met spinner + "Winkel aanmaken...", de "Vorige"-knop is disabled tijdens verwerken, en `handleSubmit` bewaakt `!isProcessing`.
**Retry-flow getoetst:** `handleSlugAcceptAndRetry` roept `handleStepTransition(3)` pas na `setTimeout(..., 100)` aan, dus nadat de eerdere `createTenant` is afgerond en de ref via `finally` is vrijgegeven — de legitieme retry na een slug-conflict blijft werken.
**Niet aangeraakt:** `WelcomeStep` (stap 1 doet geen server-mutatie in `handleStepTransition`), `FirstProductStep` (krijgt al `isLoading={isProcessing}`), RLS, edge functions, migraties.
**Security-impact:** geen — puur client-side re-entrancy en UX; geen permissies, policies of grants gewijzigd.
**Verificatie:** typecheck groen; changelog `2026.08ah` (bugfix) met i18n-keys `onboarding_no_double_create` in NL/EN/FR/DE.

## ONBOARD-CUSTOMER-CONFLICT-1 — Klanttrigger maskeerde tenant-insert als slugconflict — 12 augustus 2026
**Root cause:** de slug was niet bezet en de wizard submitte niet dubbel. `create-tenant` passeerde de pre-flight slugcheck en startte de tenant-insert. De `AFTER INSERT`-trigger `register_tenant_as_sellqo_customer_trigger` probeerde daarna dezelfde eigenaar als klant van de interne SellQo-tenant te registreren. Voor `test@test.com` bestond die klant al; de trigger ving alleen een conflict op `linked_tenant_id` af, niet de bestaande unieke `(tenant_id, email)`-constraint. PostgreSQL gaf `23505` en rolde atomair ook de tenant-insert terug. De edge function vertaalde vervolgens iedere `23505` fout foutief naar HTTP 409 `slug_conflict`, waardoor de UI "URL niet meer beschikbaar" toonde terwijl de tenant nooit was opgeslagen.
**Uitgevoerd:** `register_tenant_as_sellqo_customer()` is idempotent gemaakt op de bestaande e-mailconstraint. Een bestaande SellQo-klant krijgt alleen een `linked_tenant_id` als die nog ontbreekt; een bestaande koppeling blijft behouden voor multi-tenant eigenaren. Ontbrekende naam-/bedrijfsgegevens worden aangevuld en tags worden zonder duplicaten samengevoegd. `create-tenant` controleert bij een `23505` nu expliciet of `tenants.slug` werkelijk bestaat: alleen dan volgt de bestaande 409 met slugsuggestie; unieke fouten uit triggers of child-tabellen blijven een generieke 500 en worden met de echte details gelogd.
**Niet aangeraakt:** wizardstate, auth-refresh, `ProtectedRoute`, rollen-refresh, styling, RLS en grants.
**Security-impact:** geen toegangsverbreding; de bestaande SECURITY DEFINER-trigger en guards blijven intact. De migratie wijzigt uitsluitend de conflictbestendige verwerking binnen dezelfde triggerfunctie.
**Verificatie:** productiedata bevestigde vóór de fix de combinatie "geen tenant met slug test" + "wel bestaande interne klant test@test.com" + backendlog `Inserting tenant` → `Duplicate key error`. De nieuwe databasefunctie is na migratie teruggelezen en de aangescherpte `create-tenant` edge function is expliciet gedeployed. Changelog `2026.08aj` met i18n-key `onboarding_existing_customer_fix` in NL/EN/FR/DE.

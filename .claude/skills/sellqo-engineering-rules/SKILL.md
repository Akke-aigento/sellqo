---
name: sellqo-engineering-rules
description: Harde engineering-regels voor het sellqo-project. Altijd toepassen
  bij werk aan edge functions, storage/documenten (PDF's, exports, downloads),
  auth/sessies, dependency-imports, foutafhandeling in deliverables, native
  Capacitor-plugins, verificatie van een batch, of een gewijzigd scherm
  (harnas op 390/1280). Elke regel is betaald met echte productie-debugging.
---

# SellQo Engineering-Regels

**Scope: enkel het project `sellqo`. Bij andere projecten in deze workspace:
negeer deze skill, tenzij expliciet gevraagd.**

Harde regels. Elke regel staat hier mét het incident dat 'm veroorzaakte —
een regel zonder litteken wordt genegeerd.

## R1 — Nooit een signed URL in de database. Sla het pad op.
Kolommen heten `*_path` en bevatten een storage-pad (`{tenant_id}/{nummer}.pdf`).
De URL wordt vers gegenereerd bij elke download via `get-document-url`
(auth + tenant-check → `createSignedUrl(pad, 600)`). Frontend:
`useDocumentDownload`. Backend: `storage.from(bucket).download(pad)` met
service-role.
**Incident:** `generate-credit-note` schreef een signed URL (TTL 24u) weg in
`credit_notes.pdf_url`. Na 24u: stille dode link, maandenlang. `export-q-bundle`
fetchte diezelfde verlopen URL en leverde de boekhouder een ZIP zonder
creditnota's.

## R2 — Pin altijd dependency-versies.
`https://esm.sh/@supabase/supabase-js@2.57.2`, nooit `@2`. Eén versie per
codebase. Elke nieuwe edge function pint meteen.
**Incident:** `_shared/auth.ts` had als enige `@2`. Een ongerelateerde redeploy
liet die specifier naar de nieuwste v2.x verlopen en legde de hele auth-laag
plat.

**`npm:`-imports in edge functions: exacte versie, en dezelfde versie in
`package.json` + `bun.lock`.** Elke `npm:`-import krijgt een exacte versie
(`npm:jpeg-js@0.4.4`), en die versie staat ook als devDependency in
`package.json` en in `bun.lock`. Reden: de Lovable-agent checkt vanaf de
repo-root; Deno 2 kiest zijn config (`package.json`/`deno.json`) vanaf de
werkmap en zoekt `npm:` dan in `node_modules`. Ontbreekt het pakket, dan
"repareert" de agent de import naar esm.sh en breekt CI. Een `deno.json` per
functie helpt niet. Bekend open geval: `process-email-queue` met
`npm:@lovable.dev/email-js` zonder versie.
**Incident (EDGE-IMPORT-1, 16 okt 2026):** twee keer op één dag herschreef de
agent `_shared/socialMedia.ts` naar esm.sh; CI rood, twee keer teruggedraaid.
Zie EDGE-IMPORT-1 in `docs/role-audit.md`.

## R3 — `signOut()` altijd met `scope: 'local'`.
Gebruik `safeLocalSignOut()`. Enkel een bewuste "log me overal uit" mag
`global` zijn — expliciet.
**Incident:** default `signOut()` is `scope: 'global'` en vernietigt alle
sessies server-side. `useAuth.tsx` gebruikte dat op zes plekken als opruimactie;
één tab sloopte de sessie van alle andere.
**Zombie-token-patroon:** token blijft cryptografisch geldig → PostgREST/RLS
accepteert (checkt enkel handtekening + exp), app "lijkt te werken". GoTrue
weigert (`403 session_not_found`) → elke edge function met `getUser()` geeft
401. Symptoom: "lijsten laden maar niks werkt". Diagnose: rauwe fetch naar
`/auth/v1/user`.

## R4 — Slik nooit een fout weg met `console.warn`. Zeker niet in een deliverable.
Bij partieel falen: lever wat er is plus een expliciete lijst van wat ontbreekt.
Bouw een volledigheidscheck (bv. query op `pdf_path IS NULL`) — een bundel moet
kunnen aantonen dat hij compleet is.
**Incident:** `export-q-bundle` deed `Promise.allSettled` + `console.warn` bij
mislukte PDF-fetches. De `WAARSCHUWINGEN`-sectie in de README werd niet gevoed.
Resultaat: boekhoudbundel met stille gaten, voor documenten met zeven jaar
bewaarplicht.

## R5 — Downloads zijn popup-safe.
Open het venster synchroon binnen de click, vóór elke `await`:
```ts
const win = window.open('', '_blank');
try {
  const url = await getDocumentUrl(...);
  if (win && !win.closed) win.location.href = url;
  else window.location.href = url;
} catch (e) {
  win?.close();
  toast({ title: 'Downloaden mislukt', description: e.message, variant: 'destructive' });
}
```
Gebruik `useDocumentDownload` — het patroon zit er al in.
**Incident:** `onClick → await → window.open(url)`: user-gesture verlopen,
browser blokkeert, knop "doet niks meer".

## R6 — Een edge-function-wijziging is pas af als de deploy geverifieerd is.
Lovable schrijft edge functions maar deployt ze niet automatisch. Na elke batch
die `supabase/functions/**` raakt: `deploy_edge_functions` expliciet in de
slottaak, of check `deployed_at` in Supabase — pas dáárna testen.
**Incident (2× op één dag):** `get-document-url` stond in de repo maar niet in
Supabase (half uur CORS-jacht in de verkeerde laag). `export-q-bundle` werd na
een fix niet uitgerold; de verificatie-bundel klopte "perfect" — met de oude
code. Vals positief.

**Een gewijzigd `_shared/`-bestand is geen eigen edge-functie.** Het gaat pas
live via élke functie die het bundelt. Na een wijziging in `_shared/`: grep de
import (`grep -rl "_shared/<bestand>" supabase/functions/`) en deploy álle
aanroepers, niet alleen de functie waar je aan werkte. Zet die lijst afvinkbaar
in de slottaak — dit is niet iets om op geheugen te doen.
**Incident (BILL-2, 25 aug 2026):** `_shared/subscriptionCharge.ts` kreeg de
fiscale velden, maar dat bestand draait alleen via `stripe-connect-webhook` en
`platform-stripe-webhook`. Eén van beide vergeten betekent: pad 1 draait nieuw,
pad 2 oud, en de helft van de subscription-facturen blijft stil als B2C
weggeschreven. Geen fout, geen alarm, geen verschil in de logs — het
halve-deploy-scenario meldt zichzelf niet.

**Een commit naar `main` rolt niets uit.** Lovable synct de code wel — het
bestand staat daarna in het Lovable-project en `read_file` toont het — maar
deployt alleen wat zijn eigen agent schrijft. "Publishen" in Lovable en
`deploy_project` publiceren de frontend, niet de functies. Uitrollen gaat **alleen** via
Lovable — een prompt aan de agent, of dezelfde tekst in de Lovable-chat. De
Supabase-CLI werkt hier niet: `supabase functions deploy` uploadt wel maar geeft
dan `403 — Your account does not have the necessary privileges`, omdat het
project eigendom is van Lovable en niet van het Supabase-account
(getest 11 sep 2026).
**Incident (ADS-CRON-1, 11 sep 2026):** twee edge-function-fixes stonden in de
repo én in het Lovable-project, en de oude code bleef antwoorden. Dat kostte een
ronde, en zonder probe was de conclusie geweest dat de fix niet werkte.

**Lovable werkt uit een eigen kopie van `main`, en die kan achterlopen.** Een push
naar GitHub staat niet meteen in de werkkopie van de Lovable-agent. Een migratie
wordt dan "niet gevonden", en een deploy rolt stil de vórige code uit — met een
geslaagd-melding. Begin elke uitrolopdracht daarom met een controle die de agent
zelf moet doen: *"Controleer eerst dat `<migratiebestand>` bestaat / dat
`<bestand>` `<regel uit de nieuwe code>` bevat. Zo niet: stop en meld het."*
Migratie en deploy horen in één opdracht in vaste volgorde, of in twee opdrachten
waarbij de tweede pas vertrekt als de eerste klaar is. Controleer achteraf met
`list_messages` de tijdstempels: draaide de migratie vóór de deploy, en ligt de
deploy ná de commit?
**Incident (PUSH-2 en CRON-AUTH-1, 13 sep 2026):** twee keer op één dag. Eerst
meldde de agent dat beide PUSH-2-migraties in geen enkele commit voorkwamen. Later
deployde hij om 15:32 zestien functies "vanaf main" terwijl de commit er nog niet
was: de oude code draaide door, en de migratie van dezelfde batch werd niet
gevonden. Pas bij de tweede opdracht (15:38) klopte het. Zonder de tijdstempels
had de 401-test op oude code gedraaid.

**Bewijs een deploy met een antwoord dat verschilt.** `net.http_get` via
`query_database` naar `…/functions/v1/<naam>`, met een tekst die tussen oud en
nieuw afwijkt als discriminator — bij een auth-wijziging is de foutmelding zelf
vaak genoeg. Neem altijd een verzonnen functienaam als controle mee; die hoort
`{"code":"NOT_FOUND"}` te geven. Dezelfde probe beantwoordt ook of een functie
überhaupt gedeployed is, en dát is niet uit de database af te lezen.

**Een logbestand bewijst een deploy net zo goed, en voert niets uit.** Een probe
róept de functie aan. Bij een betaal-, mail- of externe-API-functie is dat precies
het scenario dat je wilde vermijden: je meet niet, je richt aan. De Edge
Function-logs in Supabase laten dezelfde omslag zien zonder iets te raken — de
gewijzigde aanroeppaden, een nieuwe logregel of een veranderde foutmelding zijn
de discriminator die R6 vraagt.

Dat werkt alleen als de wijziging zichtbaar ís in de logs. Verandert er niets aan
wat de functie logt of naar buiten aanroept, dan zeggen ze niets en blijft een
probe de enige weg. Kies dus bewust: **logs bij een functie met bijwerkingen,
een probe bij een functie die niets aanricht.**
**Incident (ADS-REBUILD-1/2, 11-12 sep 2026):** de bol.com-API ligt gevoelig, dus
er is geen enkele handmatige aanroep gedaan. De logs waren ondubbelzinnig: tot en
met de run van 15:00 vier keer `GET …/campaigns/{id}/ad-groups` met vier keer een
404, en vanaf 15:30 vier POSTs naar `…/list` zonder één foutregel. Dat bewees de
deploy én beantwoordde meteen de openstaande vraag of een lege tabel een fout was
of gewoon leeg — zonder de productie-API aan te spreken.

**Zorg dat het antwoord je bereikt.** Een functie die netjes een `failures`-lijst
teruggeeft is nutteloos als die lijst nergens aankomt. Wordt de functie door
`pg_cron` aangeroepen, dan geldt: `net.http_post` heeft
`timeout_milliseconds DEFAULT 5000`, en alles wat langer duurt laat
`net._http_response.content` op NULL staan. `cron.job_run_details` meldt de run
dan alsnog als `succeeded`, want dat rapporteert of het versturen lukte — niet
wat er terugkwam. Geef elke cron-job die een edge function aanroept expliciet een
ruimere `timeout_milliseconds` mee.

**Les:** als een test slaagt, verklaar wáárom. Een groen vinkje zonder
verklaring is geen bewijs.

## R7 — `npm run build` bewijst niks over types. Draai altijd `tsc --noEmit`.
`vite build` gebruikt esbuild, dat types stript — het slaagt terwijl er
runtime-crashers in de code staan. Enkel `npx tsc --noEmit -p tsconfig.app.json`
vangt ze. Een component-batch is pas geverifieerd na een groene tsc, niet na een
groene build. **Let op:** voor edge functions zegt tsc níets — die staan buiten
`tsconfig.app.json`. Zie R8.
**Incident (i18n-sprint, 18 aug 2026):** de build was groen terwijl 17× `t()`
buiten component-scope stond — allemaal runtime-crashers (`t is not defined` bij
render). Enkel tsc ving ze. De fix was het factory-patroon (`buildLoginSchema(t)`
met `useMemo`) en de `title→titleKey`-rename om de compiler het te laten
afdwingen.
**macOS-valkuilen bij het draaien:** `tsc ... | head` geeft de exit code van
`head`, niet van tsc — schrijf naar een logbestand en lees `$?`. `timeout`
bestaat niet op macOS (exit 127, draait niets). tsc duurt 5–10 min op deze repo
(`types.ts` is 20.000+ regels); draai 'm in de achtergrond. Een hangend
`tsc`-proces in `pgrep` kan een wees zijn van een eerdere afgebroken run —
controleer de logoutput vóór je concludeert dat je code de checker laat
ontploffen.

## R8 — Verifieer elke tabel- en kolomnaam in een edge function handmatig.
Elke `.from("tabel")` en elke `.select("kolom, ...")` in `supabase/functions/**`
gaat vóór de commit langs de werkelijke DB — via `information_schema` of het
gegenereerde `src/integrations/supabase/types.ts`. Niets in de keten vangt een
verwijzing naar iets dat niet bestaat:
- `tsc` compileert enkel `src/` (`tsconfig.app.json` include't letterlijk alleen
  `"src"`), dus de Deno-functies worden nooit getypecheckt. Zie R7.
- ESLint dekt `supabase/functions/**` wél — er staat geen ignore op — maar draait
  zonder `parserOptions.project`. Puur syntactisch, dus een tabelnaam is per
  constructie onvindbaar.
- Een `.from("bestaat_niet").single()` faalt **stil** in runtime. PostgREST zet
  een `42P01` in `error`; code die alleen `{ data }` destructureert ziet daar
  niets van en valt door naar de fallback alsof er niets aan de hand is.

**Incident (BILL-3, 25 aug 2026):** `process-refund` query'de
`tenant_settings.stripe_secret_key` — een tabel die in geen van de 402 migraties
voorkomt en nooit heeft bestaan. De query faalde bij élke refund, de `error` werd
niet uitgelezen, en de key kwam altijd al uit `Deno.env`. Maandenlang dode code
die eruitzag als werkende per-tenant-configuratie. Het patroon was intussen
gekopieerd naar `refund-invoice`, met een comment dat `process-refund` als bron
aanwees.
**Les:** een fallback die altijd vuurt is niet robuust, hij is een symptoom.
Controleer bij een `|| fallback` op een DB-waarde of het linkerdeel ooit iets
oplevert.

**Een `onConflict`-doel is óók een naam die geverifieerd moet worden.** Elke
`upsert(..., { onConflict: "a,b,c" })` wijst een unieke index aan. Bestaat die
niet — of dekt hij nét andere kolommen — dan weigert PostgreSQL de hele
operatie met `42P10`. Controleer het tegen `pg_indexes`, niet tegen je
verwachting van het schema:
```sql
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = '<tabel>' and indexdef ilike '%unique%';
```
Let daarbij op nullable kolommen in de index. De standaard is `NULLS
DISTINCT`, en `NULL` is dan nooit gelijk aan `NULL`: rijen die op elke
niet-lege kolom identiek zijn, gelden niet als duplicaat en worden elke run
opnieuw toegevoegd. Bij een index over nullable kolommen hoort `NULLS NOT
DISTINCT` (PostgreSQL 15+).
**Incident (ADS-REBUILD-1, 11 sep 2026):** vier van de zes wegschrijfacties in
`ads-bolcom-sync` en `ads-bolcom-reports` noemden een index die nooit heeft
bestaan, en de enige die er wél was dedupliceerde niet omdat `adgroup_id` en
`keyword_id` `NULL` zijn bij campagnerijen. Het viel niet op doordat de
bol.com-fetch ervóór al faalde: er kwam nooit een rij bij de upsert aan. Was
alleen het API-pad gerepareerd, dan was het probleem verschoven van "fetch
faalt" naar "upsert faalt" — even stil, want `if (!error) teller++; else
console.error(...)` meldt zich groen met een teller op nul.
**Les:** de verificatie stopt niet bij tabel- en kolomnamen. Alles wat in een
query een naam noemt — een tabel, een kolom, een index, een constraint — is een
aanname tot je hem hebt opgezocht.

Ook `cart.<veld>` (of een ander veld uit een `select('*')`) is een naam die je
natrekt tegen het schema: een onbestaand veld wordt stil `undefined` → `null`
(DISCOUNT-LIMIT-1: `stripe-connect-webhook` schreef maandenlang
`cart.discount_code`, een kolom die nooit bestond).

## R9 — Een native plugin wijzigen = beide platforms syncen én committen.
Een `@capacitor/*`-dependency toevoegen of verwijderen is pas af na
`npx cap sync` én het committen van de drie gegenereerde manifesten:
`android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` en
`ios/App/Podfile`. Die bestanden staan in git en worden niet vanzelf bijgewerkt.
`node scripts/verify-capacitor-sync.mjs` is de scheidsrechter en draait in CI.

De asymmetrie is de valkuil: **iOS valt op, Android niet.** Xcode Cloud bouwt in
de cloud en leest de Podfile uit de repo, dus een vergeten iOS-sync breekt
zichtbaar. Voor Android bestaat geen CI-build; een vergeten sync levert een
groene pipeline en een stil kapotte app.
**Incident (10 sep 2026):** de gradle-bestanden stonden sinds de scaffold van
7 augustus nog op alleen `firebase-messaging` + `camera`, terwijl `@capacitor/app`,
`browser`, `keyboard` en `status-bar` al een maand in `package.json` stonden en
de Podfile elke keer wél was meegesynct. Zonder die `include`-regels compileert
de native kant van die plugins niet mee: `Browser` (`src/lib/openExternal.ts`) en
`App` (`src/native/deepLinks.ts`) vallen om op Android, en de Android-specifieke
`Keyboard.resizeOnFullScreen` en `StatusBar`-instellingen uit
`capacitor.config.ts` doen niets — terwijl iOS gewoon werkt. Precies het
toetsenbord-over-de-onderbalk-probleem dat de M3a-batch had opgelost.
**Les:** een gegenereerd bestand dat in git staat, is pas gegenereerd als het
gecommit is. En een platform zonder CI meldt zijn eigen scheefstand nooit.

## R10 — Geef een supabase-querybuilder nooit rechtstreeks terug uit een async functie.
Een supabase-querybuilder is "thenable". `await builder` voert de query dus uit
en levert het resultaat (`{ data, error }`) op, niet de builder. Een async helper
die `return query` doet, geeft na `await` geen builder meer terug: de volgende
`.order()` of `.range()` faalt met "query.order is not a function". `deno check`,
tsc en unit tests met pure functies zien dit niet, want de types zijn `any`.
**Regel:** pak de builder in (`return { q: query }` → `(await helper(...)).q`),
of houd de helper synchroon. Na elke storefront-api-deploy meteen opnieuw meten
tegen de nulmeting, en vóór de deploy `scripts/promo-compare/smoke.ts` draaien
(draait ook in CI): die roept de echte functies aan tegen een thenable nep-databank.
**Incident (CATALOG-FILTERS-1, 13 okt 2026):** `applyCategoryAndSearch` gaf de
builder terug. Na de deploy gaf élke `get_products` van alle winkels HTTP 500,
van 11:36 tot 11:42. De nameting tegen `ops.snap_catalog_pre` ving het; de
hotfix 1b pakte de builder in.

## R11 — Lokaal groene lint ≠ groene CI. Draai de baseline ook na edge-function-werk.
`scripts/verify-lint-baseline.mjs` vergelijkt met een vaste baseline, maar CI
installeert de eslint-plugins uit `bun.lock`, terwijl een lokale `node_modules`
vaak nieuwere versies heeft. Regels die alleen in de ene versie vuren, zie je
dan lokaal niet. Bekend geval: `react-refresh/only-export-components` vuurt in
CI op een niet-component-export uit een `.tsx` met componenten.
**Regel:**
- exporteer uit componentbestanden alleen componenten en types; constanten en
  helpers horen in `src/lib/`;
- draai de lint-baseline ook na wijzigingen in `supabase/functions/**`
  (eslint dekt die map; `any` telt mee);
- haal tijdelijke mappen zoals `.harness/` weg vóór de lint;
- na de push: `gh run list --limit 1` tot de run groen is.
**Incidenten (14 okt 2026):** FLEX-1 brak CI met 4 nieuwe `any` in
`storefront-api`. MKT-3 brak CI op een geëxporteerde `SCENE_LOOP_MS` uit
`LiveScene.tsx`, terwijl de lokale lint groen was.

## R12 — Een worker-cache per run bevat nooit status die een parallelle run kan wijzigen.
Cache per run gerust wat vastligt (template, tenantinstellingen). Maar
statuswaarden die een andere run kan veranderen — A/B-winnaar, campagnestatus
(`paused`, `cancelled`, `sent`) — lees je opnieuw uit de DB vlak vóór een
onomkeerbare stap (verzenden, winnaar kiezen, status op `sent`).
**Incident (MAIL-2d, 20 okt 2026):** `process-campaign-queue` draait elke
minuut, dus runs overlappen. De review vond dat rijen zonder variant van een
gestarte A/B-test verstuurd konden worden met een gecachte context zonder
winnaar. Fix `guardAbRemainder`: campagne opnieuw laden; nog geen winnaar →
terug op `queued` met +1 min, niet versturen.

## R13 — Geen `window.prompt`/`alert`/`confirm` in de admin.
Altijd een dialoogcomponent (`AlertDialog`/`Dialog` uit `src/components/ui/`)
met i18n-teksten (zie sellqo-i18n-verplicht). Native dialogen zijn niet te
vertalen, niet te stylen, blokkeren de thread en werken slecht in de
Capacitor-app.
**Incident (MAIL-1b/MAIL-2, okt 2026):** `CampaignRichEditor.tsx` vroeg link en
afbeelding via `window.prompt` — onvertaald en zonder mediabibliotheek.
Vervangen door `LinkDialog`/`ImageInsertDialog` (`EditorInsertDialogs.tsx`).

## R14 — Koppel een methode nooit los van de Supabase-client. En een preview met mocks bewijst geen dataflow.
`const rpc = supabase.rpc` (ook met een `as`-cast) verliest `this`: elke aanroep
faalt live met "Cannot read properties of undefined (reading 'rest')". tsc, build
en tests met een nep-client merken het niet, want een mock heeft geen `this`.
**Regel:**
- gebruik `supabase.rpc.bind(supabase) as unknown as …` of roep rechtstreeks aan
  (`(supabase.rpc as …)(…)` behoudt `this` wel);
- `src/test/unboundSupabase.test.ts` weigert losgekoppelde client-methodes in `src/`;
- elke nieuwe schrijfactie in de admin klik je vóór "klaar" één keer echt door
  op sellqo.app in een testzaak (Café De Wissel), niet enkel in een preview met mocks.
**Incident (KAART-1 t/m KAART-3, 24–25 okt 2026):** `useKaart.ts` koppelde
`supabase.rpc` los. Snel toevoegen, plakken, startkaart, foto-import, slepen en
maat toevoegen op de horeca-Kaart faalden een dag lang live. SQL-tests en een
Playwright-preview met nepdata waren groen. De geheel-wandeling op sellqo.app
ving het (KAART-FIX-1). Dezelfde fout zat in de A/B-statistieken van campagnes.

## R15 — Stripe-terugstortingen idempotent, en Checkout-sessies die meteen moeten afrekenen kennen uitgestelde betalingen.
Een webhook en een terugkerende gast kunnen tegelijk dezelfde betaling verwerken.
Zonder idempotency-key wordt dan twee keer teruggestort of twee keer gealarmeerd.
En met `automatic_payment_methods`/dynamische betaalmethodes kan een sessie
`complete` zijn terwijl `payment_status` nog `unpaid` is (Bancontact, SEPA…):
het geld komt pas later via `checkout.session.async_payment_succeeded`.
**Regel:**
- `stripe.refunds.create(…, { stripeAccount, idempotencyKey: '<domein>_refund_<id>' })`;
  de status in de DB idempotent zetten (tweede keer = `changed: false`) en een
  melding enkel versturen als `changed` waar is;
- een Checkout-sessie die synchroon iets moet afsluiten (rekening, ticket, voorraad)
  behandelt `checkout.session.async_payment_succeeded` / `_failed` en
  `checkout.session.expired`, óf zet vaste `payment_method_types` die meteen
  afrekenen. Die events moeten op het (Connect-)endpoint in Stripe aanstaan;
- een bedrag dat binnenkomt wordt altijd vergeleken met wat de DB verwacht
  (`amount_total` ≠ verwacht → terugstorten, nooit afsluiten).
**Incident (REKENING-ONLINE-1, review 28 okt 2026):** de eerste versie van de
online tafelbetaling kon dubbel terugstorten en dubbel alarmeren (webhook +
statuspoll), en een Bancontact-betaling bleef eeuwig "pending" omdat enkel
`checkout.session.completed` werd afgehandeld. Beide vond de review, niet de tests.

## R16 — Draai `npm run ci:local` vóór elke push naar main.
`scripts/ci-local.mjs` leest de stappen uit `.github/workflows/ci.yml` en draait
ze lokaal (node-checks, vitest, deno als die er is; `--full` voegt tsc en build
toe). Losse checks uit het hoofd draaien mist er altijd één.
**Incident (REKENING-ONLINE-1, 28 okt 2026):** de push brak op "Meldingsbronnen":
twee nieuwe meldingstypes stonden niet in `NOTIFICATION_CONFIG` en
`notificationDefaults.ts`. Lokaal waren tsc, lint, i18n en de tests groen, maar
die ene node-check was niet gedraaid.

## R17 — Elk gewijzigd scherm gaat vóór "klaar" door het harnas, op 390 én 1280 px.
`node scripts/harness/shoot.mjs <scenario>` draait één component in Vite met
gemockte hooks en maakt met Playwright screenshots op 390 en 1280 px
(`/tmp/harness/`); exit 1 bij een paginafout of console-error. Werkwijze en hoe je
een scenario toevoegt: `scripts/harness/README.md`.
**Regel:**
- een nieuw of gewijzigd scherm krijgt een scenario in `scripts/harness/scenarios/`
  (of breidt een bestaand uit), met de klikstappen in `steps.mjs`;
- bekijk de screenshots echt (labels, afgekapte tekst, taal); groen is niet genoeg;
- mock spoor- en rechtenfilters bewust: een te ruime mock toont items die de echte
  app verbergt;
- het harnas bewijst opmaak en klikgedrag, géén dataflow. Schrijfacties klik je
  daarnaast één keer echt door op sellqo.app (R14).
**Incident (ONDERBALK-1 en KASSA-START-1, 29 okt 2026):** het harnas werd per batch
opnieuw met de hand opgebouwd en daarna weggegooid. Bij ONDERBALK-1 ving het een
lijst met andere labels dan de balk erboven ("Point of sale (P…" naast "Kassa"); de
eerste versie stond per ongeluk in het Engels omdat de taal ná i18n werd gezet.

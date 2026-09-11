---
name: sellqo-engineering-rules
description: Harde engineering-regels voor het sellqo-project. Altijd toepassen
  bij werk aan edge functions, storage/documenten (PDF's, exports, downloads),
  auth/sessies, dependency-imports, foutafhandeling in deliverables, native
  Capacitor-plugins, of verificatie van een batch. Elke regel is betaald met
  echte productie-debugging.
---

# SellQo Engineering-Regels

**Scope: enkel het project `sellqo`. Bij andere projecten in deze workspace:
negeer deze skill, tenzij expliciet gevraagd.**

Negen harde regels. Elke regel staat hier mét het incident dat 'm veroorzaakte —
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
`deploy_project` publiceren de frontend, niet de functies. Uitrollen gaat via
een prompt aan de Lovable-agent of via
`supabase functions deploy <naam> --project-ref <ref>`.
**Incident (ADS-CRON-1, 11 sep 2026):** twee edge-function-fixes stonden in de
repo én in het Lovable-project, en de oude code bleef antwoorden. Dat kostte een
ronde, en zonder probe was de conclusie geweest dat de fix niet werkte.

**Bewijs een deploy met een antwoord dat verschilt.** `net.http_get` via
`query_database` naar `…/functions/v1/<naam>`, met een tekst die tussen oud en
nieuw afwijkt als discriminator — bij een auth-wijziging is de foutmelding zelf
vaak genoeg. Neem altijd een verzonnen functienaam als controle mee; die hoort
`{"code":"NOT_FOUND"}` te geven. Dezelfde probe beantwoordt ook of een functie
überhaupt gedeployed is, en dát is niet uit de database af te lezen.

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

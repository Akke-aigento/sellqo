# GANGEN-1 — gangen aan tafel: voorgerecht, hoofdgerecht, dessert en "gang vrijgeven" — 1 november 2026

Branch `night-keuken` (na `git merge night-final`, fast-forward tot `7c1cee6`). Niet gepusht, niet gedeployed, niets in de DB geschreven (enkel read-only natrek op de live DB).

## Root cause / aanleiding

- `check_lines.course` bestond al (TAFEL-1, `1..9`) en `send_round` sorteerde de bon al op gang, maar de kassa gaf nooit een gang mee: `addProduct` in `CheckScreen.tsx` stuurde `add_line` zonder `course` (types.ts `course: number | null`, store.ts optimistisch altijd `null`). Alles ging dus in één keer naar de keuken.
- `set_note` wiste de gang (`course = nullif(cmd->>'course','')`); al opgelost in KEUKEN-VEILIG-1 (zonder `course` in het commando blijft de gang staan).
- Er was geen manier om een gang later "af te roepen".

## Ontwerpkeuze (fiscaal) — vastgelegd

**Vrijgeven = een latere gewone ronde; geen nieuw fiscaal event.**

- Gelezen: `src/kassa/README.md` (EVT-13: correcties zijn nieuwe events; FDM-04), `src/kassa/fiscal/builders.ts` (`buildOrder` = P/ORDER), `src/kassa/app/horeca/fiscalLines.ts` (ronde = enkel de nieuwe ontwerp-lijnen, EVT-04/06) en `actions.ts` (`sendRound` = ondertekenen → `send_round`). De eisenmatrix (projectdoc) was niet bereikbaar.
- Een lijn van een latere gang blijft een **ontwerp-lijn** (geen P/ORDER, niet naar de keuken) tot de bediening de gang vrijgeeft. "Gang vrijgeven" = (1) `fire_course` op de server: enkel `dining_checks.course_fired` ophogen, niet fiscaal (zoals `rename_check`/`cancel_bill`), en (2) die lijnen versturen met de bestaande `sendRound` → een gewone ronde, P/ORDER zoals altijd. Niets aan `fiscal_events`, FDM-berichten of builders gewijzigd; `KASSA_SW_VERSION` niet verhoogd.
- Alternatief (alles meteen als P/ORDER en enkel de keukenbon "vasthouden") verworpen: vraagt een bonstatus/uniciteit per (ronde, post, gang) op `kitchen_tickets` en wijkt af van de voorkeur van de opdracht.
- **Open punt voor de FOD-check — beslist 2-11-2026, zie GANGEN-BON-1 hieronder** (eisenmatrix): de keuken ziet ter info op de bon van de huidige ronde welke lijnen nog wachten (`'waiting': true`, grijs, "nog niet maken"). Die lijnen zijn nog niet besteld (geen P/ORDER). Op een GKS-kassa drukt de server geen keukenbonnen af (de kassa doet dat zelf, nog niet gebouwd); het gaat hier enkel om het scherm en de niet-fiscale serverprint. Bevestigen dat een info-vermelding van niet-bestelde lijnen op een productiebon mag; zo niet, is het één voorwaarde in `send_round` om het weg te laten.
- De voorrekening (`requestBill`) verstuurt eerst ook wat nog wachtte (de server eist dat alles verstuurd is). Afrekenen met wachtende lijnen: zoals elke ontwerp-lijn gaan ze mee naar de vervolgrekening (bestaand gedrag van `horeca_pay`).

## Uitgevoerd

**Migratie `supabase/migrations/20261101230220_gangen_1.sql`** (additief; functies via `pg_get_functiondef` + `replace`, elk anker 1× nagetrokken op live, marker `GANGEN-1`, vorige definities in `ops.gangen_1_prev_functions`):
- `horeca_pay_settings.courses_enabled boolean not null default false` en `course_by_category jsonb not null default '{}'` (check: object, ≤ 20 kB).
- `dining_checks.course_fired integer` (null of 1..9).
- `horeca_check_json`: `'course_fired'` erbij.
- `horeca_apply_one`: nieuw commando `fire_course` (1..9, gaat nooit terug: `greatest`), en in `send_round` per post de wachtende ontwerp-lijnen (gang gezet, niet in deze ronde, zelfde post) als `waiting: true` achteraan in `items` — enkel als `courses_enabled`. Hangt af van 20261101230200 (het anker bevat de komma uit KEUKEN-VEILIG-1); zonder die migratie breekt deze af in plaats van half te patchen.

**Kassa**
- `src/kassa/app/horeca/courses.ts` (nieuw, puur): `courseFor` (categorie-instelling > gekozen gang > hoofdgerecht; bar/"geen gang" nooit), `goesToBar` (zelfde routering als de server), `firedCourse`, `isHeld`, `sendableIds`, `nextHeldCourse`, `releaseIds`.
- `paySettings.ts`: `useKassaCourseSettings` (lokale kopie, standaard uit).
- `actions.ts`: `ActionCtx.coursesEnabled`; `sendRound` zonder expliciete lijnen stuurt wat niet wacht; `fireCourse` (fire_course + ronde); `requestBill` verstuurt alles.
- `store.ts`: commando `fire_course` (optimistisch), `set_note` met `course` past de gang aan (zonder blijft ze).
- `quickTap.ts`: sneltikken telt enkel op binnen dezelfde gang (optionele parameter; gangen uit = ongewijzigd).
- `CheckScreen.tsx` (enkel aan tafel, enkel met gangen aan): balk bovenaan "Automatisch · Voorgerecht · Hoofdgerecht · Dessert" en de knop "‹gang› vrijgeven (n)"; `addProduct`/`addOne` geven `course` mee; + op een lijn blijft in die gang; lijnen tonen hun gang en "wacht"; "Verstuur (n)" telt enkel wat meegaat; in het lijnvenster de gang wijzigen.
- `KassaHome.tsx`: `coursesEnabled` in de context.

**Keuken**
- `kitchenModel.ts`: `KitchenItem.course` / `waiting`, `itemGroups` (per gang, wachtende apart); allergenen-samenvatting telt wachtende niet.
- `KitchenBoard.tsx`: `ItemList` — kop per gang (enkel als de bon gangen heeft), wachtende lijnen grijs in een gestippeld kader "Wacht op vrijgave · nog niet maken"; afgewerkte lijst toont geen wachtende.
- `printTicket.ts` + `kitchenBoardUtils.ts`: idem op de browserbon.
- `_shared/horecaPrint.ts` + `horeca-print/index.ts`: `[ VOORGERECHT ]`-koppen en een blok "WACHT OP VRIJGAVE - NIET MAKEN" in 5 talen; versie `GANGEN-1`.

**Beheer** — `src/components/admin/horeca/CoursesSettings.tsx` in Bestellen › Posten (onder de posten: gangen horen bij de keukenroutering): schakelaar "Gangen gebruiken" (standaard uit) en per categorie Automatisch / Geen gang / Voorgerecht / Hoofdgerecht / Dessert. Bewaart meteen.

**i18n**: `admin.courses.*` (namen, balk, vrijgeven, wacht, instellingen, bewaard) in nl/en/fr/de/uk.

## Security-keuzes

- Geen nieuwe tabellen, policies of grants. De nieuwe kolommen vallen onder de bestaande grants/RLS van `horeca_pay_settings` (lezen: leden; schrijven: beheerder) en `dining_checks` (enkel via de security-definer kassafuncties).
- `fire_course` loopt door `horeca_apply` (rolcontrole, paying-slot, toog-guard: aan de toog geweigerd). Geen geld, geen fiscaal event.

## Gedeelde-paden-waarschuwing

- `storefront-api`, `storefront-customer-api` en de gedeelde storefront-tabellen: niet geraakt.
- `horeca_apply_one` / `horeca_check_json` bedienen elke kassa: met `courses_enabled = false` (standaard, alle bestaande zaken) verandert er niets aan de bonnen; `course_fired` is een extra JSON-sleutel; `fire_course` wordt enkel gestuurd met gangen aan.
- `_shared/horecaPrint.ts` ook in `horeca-receipt-mail`: enkel productiebon-code en extra teksten.

## Verificatie

- Lokale PostgreSQL 16: migratie 2× (idempotent). `scripts/gks/sql/test_gangen.sql` 12/12 `t` (dessert blijft ontwerp, keuken ziet `waiting` op de keukenbon en niet op de barbon, `course_fired` in de JSON, ongeldige gang geweigerd, vrijgeven gaat nooit terug, vrijgegeven bon zonder `waiting`, gangen uit = nooit `waiting`). Bestaande kassatests na beide migraties: fiscal 5, personeel 10, tafel 32, pay 62, heartbeat 5, tafel3 89, kaart 49, kassa06 26, kaart3 33 — 0 `f`. (`test_keuken_veilig.sql`: route-fixture idempotent gemaakt, botste met de fixtures van `test_tafel.sql`.)
- Ankers read-only op de live DB: `horeca_check_json` `'version', …` 1×; `horeca_apply_one` `rename_check` 1×; het send_round-anker bestaat live pas na 20261101230200 (lokaal geverifieerd in de juiste volgorde).
- `npx vitest run src/kassa src/components/admin/kitchen src/components/horeca` → 367 groen, 1 overgeslagen, 0 rood. Nieuw: `src/kassa/app/__tests__/courses.test.ts` (12 tests, o.a. "vrijgeven = fire_course + send_round, geen fiscal_event_id").
- `deno test horecaPrint.test.ts` 9/9; `deno check horeca-print/index.ts` 0.
- `node scripts/i18n-parity.mjs` → volledige pariteit (exit 0). `npx eslint` op alle gewijzigde bestanden → exit 0.
- **Volledige `npx tsc --noEmit -p tsconfig.app.json` → exit 0.**
- Harnas: `kassa-home` (390/1024/1280, exit 0) met gangen aan: balk, "Dessert vrijgeven (1)", "Verstuur (4)", lijnen "Voorgerecht" en "Dessert · wacht", keukenbon met kop VOORGERECHT en het kader "Wacht op vrijgave". Nieuw scenario `gangen-instelling` (390/1280): kaart, categorie op Dessert, uitschakelen verbergt de lijst. Screenshots bekeken.

## Bewust ongemoeid / Vervolg

- Wachtende lijnen verschijnen enkel als preview op de bon van een post die in deze ronde ook iets kreeg; een post met enkel wachtende lijnen krijgt pas een bon bij het vrijgeven.
- Een preview op een oudere bon wordt niet bijgewerkt als de bediening wachtende lijnen nog wijzigt; de bon bij het vrijgeven is de waarheid.
- Geen gangen aan de toog, niet in de QR-bestelling (QR-lijnen krijgen geen gang en gaan meteen), niet voor webshoporders.
- Fiscale bevestiging van de info-preview (zie "Open punt"). doc_articles/newsletter: hoofdsessie.
- CI: `src/kassa/app/__tests__/courses.test.ts` aan de Vitest-stap toevoegen.
- **Uitrol**: (1) `horeca-print` + `horeca-receipt-mail` deployen (`GET horeca-print` → `version: "GANGEN-1"`), (2) migraties 20261101230200 → 20261101230210 → 20261101230220 (volgorde verplicht), (3) frontend publiceren + nieuwe app-build. Natrek: `select position('GANGEN-1' in pg_get_functiondef('public.horeca_apply_one'::regproc)) > 0, position('course_fired' in pg_get_functiondef('public.horeca_check_json'::regproc)) > 0;` en `select count(*) from information_schema.columns where table_name in ('horeca_pay_settings','dining_checks') and column_name in ('courses_enabled','course_by_category','course_fired');` = 3.

## Bijgewerkt: GANGEN-BON-1 (2-11-2026, batch VERVOLG-1)

De info-preview van wachtende lijnen op de keukenbon is weggehaald. Volgens de GKS-eisenmatrix is een keuken-/barbon een gevolg van een P/ORDER (PRT-05) en hoort bij elke aanmaak van een bestelling een signOrder (EVT-06): een productiebon toont dus enkel wat in die ronde besteld wordt. Migratie `20261102080020_gangen_bon_1.sql` haalt het `|| coalesce((select jsonb_agg(... 'waiting', true ...)), '[]'::jsonb)`-blok uit `send_round` in `horeca_apply_one` (ankermethode, marker `GANGEN-BON-1`, vorige definitie in `ops.gangen_bon_1_prev_functions`).

- De kassa (CheckScreen) blijft "wacht" tonen aan de bediening: dat komt uit `check_lines` (`horeca_check_json`), niet uit de bon.
- Keukenscherm (`kitchenModel.ts`, `KitchenBoard.tsx`, `printTicket.ts`) en `_shared/horecaPrint.ts` kunnen `waiting` nog renderen; nieuwe bonnen bevatten het niet meer, dus dat blok blijft gewoon leeg. Bewust niet opgeruimd (geen deploy nodig, tests blijven geldig).
- Gevolg voor de keuken: wat nog komt, ziet ze pas als de gang vrijgegeven wordt (dan als gewone bon).
- Test: `scripts/gks/sql/test_gangen_bon.sql` (na `test_gangen.sql`, dat vóór deze migratie hoort te draaien).
- Live (2-11): geen enkele zaak heeft gangen aan, geen enkele bestaande bon bevat `waiting`.

Changelog-zin hieronder aangepast: "wat nog komt" staat niet meer op de bon.

## Changelog (NL)

**Gangen aan tafel: voorgerecht, hoofdgerecht en dessert apart naar de keuken**
Zet in Bestellen › Posten "Gangen gebruiken" aan en je kassa geeft elke bestelling een gang (per categorie, of zelf gekozen bovenaan de rekening). Latere gangen wachten tot je ze met één tik vrijgeeft; de keuken krijgt per gang een bon zodra je die gang vrijgeeft.

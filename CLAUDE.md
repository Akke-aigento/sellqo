# CLAUDE.md — werkwijze voor dit project

Instructies voor Claude Code in de SellQo-repo. Lees dit vóór je iets wijzigt.

Dit bestand vat samen; de brondocumenten zijn leidend bij twijfel:

| Onderwerp | Bron |
|---|---|
| Paper trail van elke batch | `docs/role-audit.md` |
| Custom frontends (patronen, valkuilen) | `.agents/skills/sellqo-custom-frontend-runbook/SKILL.md` |
| Nieuwe custom-frontend-klant opzetten | `.claude/skills/sellqo-nieuwe-storefront/SKILL.md` |
| Webshop-reeks (de eerste wet) | `docs/webshop-masterplan.md` §0 |
| Webshop fase 5-7 | `docs/webshop-fase5-7-visie.md` |
| RLS-patronen | `docs/architecture-patterns.md` |
| Secrets | `docs/secrets-management.md` |
| Nieuwsbrief-wachtrij | `docs/newsletter-queue.md` |
| Geparkeerd werk | `docs/fase2-backlog.md` |

Er bestaan daarnaast **workspace-skills** (Lovable-agent) en **repo-skills**
(`.claude/skills/`, met een spiegel in `.agents/skills/`). Sinds `beb3b180`
(10 sep 2026) leven ze op beide plekken; sinds 16 okt 2026 staan alle twaalf
repo-skills ook in de workspace, en de repo is de bron van waarheid.

Niets houdt die drie kopieën vanzelf gelijk, en ze lopen aantoonbaar uit elkaar:
op 10 sep bleek de workspace-versie van `sellqo-i18n-verplicht` bijna half zo
groot als de repo-versie, zonder de codemod-motor. Daarom:

- `node scripts/verify-skills-sync.mjs` vergelijkt `.claude/skills` met
  `.agents/skills` en draait in CI.
- De workspace-kant kan een CI-runner niet bereiken. Bewaar de output van
  `list_workspace_skills({ workspace_id })` als JSON en draai
  `node scripts/verify-skills-sync.mjs --compare <bestand>`: die legt de grootte
  per skill naast de repo en geeft exit 1 bij een ontbrekende of afwijkende skill.
  Duw bij verschil de repo-inhoud met `update_workspace_skill` (of
  `create_workspace_skill`) en lees de skill terug. De werkwijze staat bovenaan
  het script. Let op: de workspace weigert frontmatter die geen geldige YAML is
  (bv. een `: ` in een description zonder aanhalingstekens).

| Skill | Workspace | Repo | Bron |
|---|---|---|---|
| `sellqo-engineering-rules` | ✓ | ✓ | repo |
| `sellqo-db-safety` | ✓ | ✓ | repo |
| `sellqo-gedeelde-paden` | ✓ | ✓ | repo |
| `sellqo-connector-werkwijze` | ✓ | ✓ | repo |
| `sellqo-release-werkwijze` | ✓ | ✓ | repo |
| `sellqo-docs-slottaak` | ✓ | ✓ | repo |
| `sellqo-custom-frontend-runbook` | ✓ | ✓ | repo |
| `sellqo-i18n-verplicht` | ✓ | ✓ | repo |
| `sellqo-nieuwe-storefront` | ✓ | ✓ | repo |
| `sellqo-claim-audit` | ✓ | ✓ | repo |
| `sellqo-demo-tenant` | ✓ | ✓ | repo |
| `sellqo-prospect-demo` | ✓ | ✓ | repo |

`nomadix-mobiel` bestaat alleen als workspace-skill: die geldt workspace-breed
en hoort niet in deze repo.

Wijzig je een skill, werk dan **alle drie** de kopieën bij — `.claude/skills`, `.agents/skills` en de workspace. De repo wint bij verschil.

---

## 1. De eerste wet — custom-frontend tenants

**Zes tenants draaien een eigen frontend: Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata en Benny Rich. Zij mogen van webshop-werk niets merken.**

Deze lijst is een momentopname (10 sep 2026) en kan opnieuw verouderen: Benny Rich kreeg
de vlag op 26 augustus 2026 en stond hier twee weken later nog steeds niet in. **De bron is
de database, niet dit document.** Controleer bij elke batch die de eerste wet raakt:

```sql
select t.name, t.slug from tenant_theme_settings ts
join tenants t on t.id = ts.tenant_id
where ts.use_custom_frontend is true order by t.name;
```

- Hun frontends praten via `storefront-resolve`, `storefront-api` en `storefront-customer-api` met de core. Die contracten wijzigen niet.
- **Strikt additief** op de gedeelde tabellen `tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`: geen kolom hernoemen, verwijderen, van datatype veranderen of van default wijzigen.
- Het `use_custom_frontend`-pad blijft byte-voor-byte identiek — functioneel én qua opslag.
- De drie edge-functies worden niet aangeraakt tenzij een recon aantoont dat een additieve uitbreiding nodig én veilig is, en dan alleen na apart akkoord.

**Wat gedeeld is en wat niet.** Geen enkel React-component wordt gedeeld met de custom frontends; die renderen zelf. Gedeeld zijn alleen de tabellen en het JSON-contract van `storefront-api`. Concreet: het *uiterlijk* van een storefront-renderer mag volledig herbouwd worden, maar de **sleutelnamen binnen `content` en `settings`** liggen vast — nieuwe sleutels toevoegen mag, bestaande hernoemen of weghalen niet.

Testbedden: **SellQo Speeltuin** en **Demo Bakkerij** (de enige twee op het SellQo-theme, beide test). Elke batch daar smoke-testen vóór iets "klaar" heet.

---

## 2. Engineering-regels — niet onderhandelbaar

**Recon eerst.** Geen code vóór een read-only recon die de aanname toetst. Een opdracht die begint met "fix X" begint met vaststellen dát X kapot is, en waar precies.

**Verifieer vóór je implementeert.** Beweringen worden onderbouwd met `grep`, een file-read of SQL — niet met herinnering. Dit geldt ook voor beweringen in opdrachten en in bestaande docs: de recon van WEBSHOP-1 corrigeerde vier punten uit het masterplan, en WEBSHOP-4 toonde aan dat een gevreesd deep-link-risico niet bestond. Documenten kunnen verouderd zijn; de code is de waarheid.

**Strikt additief op gedeelde tabellen.** `ADD COLUMN IF NOT EXISTS` mag. Hernoemen, droppen, defaults wijzigen niet. Bij seeds: `INSERT ... ON CONFLICT (slug) DO UPDATE` zodat alleen de eigen rijen geraakt worden.

**Nooit destructief zonder bevestiging.** Bij het vervangen van bestaande tenant-content: verbergen (`is_visible = false`), niet verwijderen. Bestaande records met dezelfde sleutel overslaan, niet overschrijven. En altijd terugkoppelen wat er is overgeslagen of verborgen.

**DB-safety invarianten.**
- Een kolom droppen is onomkeerbaar en gebeurt niet om dode UI op te ruimen — de UI mag weg, de kolom blijft.
- Migraties zijn idempotent: twee keer draaien geeft hetzelfde resultaat.
- Een migratie die geen `DOWN` heeft, vermeldt in commentaar hoe je hem handmatig terugdraait.
- Nieuwe kolommen op `tenant_theme_settings` stromen via `select('*')` in `storefront-api` automatisch door naar alle custom frontends. Zet er dus nooit iets gevoeligs in.

**Bouw eerst de nieuwe plek, sloop dan de oude.** Bij verhuizingen: nieuwe locatie bouwen, bewijzen dat hij werkt, pas daarna het oude scherm weghalen. Nooit andersom.

**Geen dode affordances.** Een knop, sleepgreep of menu-item dat niets doet is erger dan de afwezigheid ervan. Kom je er een tegen, meld het; bouw er zelf geen.

---

## 3. Workflow-sequentie

**recon → review → expliciete go → implementatie → post-flight verificatie → paper trail**

1. **Recon** — read-only, levert een rapport met feiten en regelverwijzingen. Onderbouw elke bewering.
2. **Review** — de bevindingen en het plan gaan naar Akke. Open beslispunten expliciet benoemen, met een aanbeveling.
3. **Expliciete go** — wachten. Niet vast beginnen "omdat het toch moet gebeuren".
4. **Implementatie** — alleen wat de go dekt. Scope-uitbreiding gaat terug naar stap 2.
5. **Post-flight verificatie** — diff tonen, `tsc`, build, lint tegen baseline, en waar relevant een SQL-natrek.
6. **Paper trail** — verificatiedoc in `docs/`, plus de slottaken uit §4.

Committen alleen op verzoek. Pushen is een aparte stap die apart gevraagd wordt.

---

## 4. Slottaken per batch — standaard, niet optioneel

Deze zijn in de webshop-reeks 1 t/m 4b vergeten. Ze horen bij elke batch die tenant-zichtbaar gedrag verandert. Loop ze expliciet af vóór je een batch "klaar" noemt.

### 4.1 Role-audit entry — `docs/role-audit.md`

Nieuwe sectie bovenaan, format `## <ID> — <korte titel> — <datum in NL>`, met:

- **Root cause** — wat er precies misging, met bestand- en regelverwijzingen.
- **Uitgevoerd** — wat er gewijzigd is, per bestand.
- **Security-keuzes** — welke RLS, policies, grants of rechten geraakt zijn. "n.v.t." mag, mits onderbouwd.
- **Gedeelde-paden-waarschuwing** — als een gedeeld pad (`storefront-api`, `storefront-customer-api`, gedeelde tabellen) geraakt is: waarom dat veilig is voor alle tenants.
- **Verificatie** — wat er gedraaid is en met welke uitkomst.
- **Bewust ongemoeid / Vervolg** — wat expliciet niet is aangeraakt, en wat er nog open staat.

### 4.2 Publieke changelog in alle ondersteunde talen

**De talenlijst is de bron, nooit een vast aantal.** Het aantal talen groeit (binnenkort o.a. es/it/pt). Ga daarom nooit uit van een getal in dit document; de bron is `SUPPORTED_LANGUAGES` in `src/i18n/languages.ts`, en `scripts/i18n-parity.mjs` is de scheidsrechter. Tel de talen en de landing-bestanden na tegen die bron.

Twee plekken, altijd samen:

1. `src/pages/public/PublicChangelog.tsx` — entry in de `changelogEntries`-array: `{ version, dateKey, changes: [{ id, type }] }`, met `type` uit `feature | improvement | bugfix | security`.
2. `src/i18n/locales/landing.{code}.json` voor **elke** code uit `SUPPORTED_LANGUAGES` — `public.changelog.changes.<id>` met `{ title, description }` in alle talen.

`scripts/i18n-parity.mjs` leest de talen uit de bestanden zelf en faalt met exit 1 zodra één taal een key mist. Die check draait in CI (`.github/workflows/ci.yml`), dus een overgeslagen taal blokkeert de PR.

Nieuwe entries worden **achteraan** het `changes`-object toegevoegd (geen alfabetische volgorde), en bovenaan `changelogEntries` — die array staat nieuwste-eerst.

Volledige pariteit is verplicht: elke change-id bestaat in elke ondersteunde taal. Eén taal overslaan breekt de changelog voor die bezoekers én maakt de CI-parity rood. Bestaande content wordt bij een nieuwe taal mee vertaald (volledige dekking, geen permanente fallback-lappendeken).

Versienummers volgen `JJJJ.MMx` en tellen door op de laatste in `changelogEntries` (`2026.10n` → `2026.10o`). Let op dat `dateKey` in de 2026.10-reeks op `sep_2026` staat terwijl de commits uit augustus 2026 komen; die scheefstand is bestaand. Volg de reeks, of stem af met Akke vóór je hem rechttrekt.

Schrijf in de tweede persoon, leg uit wat het voor de tenant betekent, en vermijd onverifieerbare marketingtaal (Belgische regels rond misleidende handelspraktijken). De aanspreekvorm verschilt per taal en is niet uniform in de bestaande set: de event-reeks gebruikt `du` (de) en `ти` (uk), oudere entries `Sie`. Sluit aan bij de entries in hetzelfde onderwerp.

### 4.3 `doc_articles` — in-app documentatie

Via een migratie-`INSERT` op `public.doc_articles`:

- `doc_level` = `'tenant'` (of `'platform'` voor interne docs)
- `context_path` = de adminroute waar het artikel bij hoort, bijv. `/admin/storefront` — daarop wordt contextuele hulp getoond
- `title`, `slug`, `excerpt`, `content` (HTML), `sort_order`
- `UNIQUE (doc_level, slug)`, dus gebruik `ON CONFLICT` bij het bijwerken

Let op: `doc_articles` heeft **één** `content`-veld, geen taalvarianten. Alleen de changelog is vijftalig.

### 4.4 Newsletter-wachtrij — `docs/newsletter-queue.md`

Item toevoegen onder **Openstaand**, met versienummer, categorie en datum, de NL-tekst zoals die in de nieuwsbrief komt, en een verwijzing naar de i18n-key uit 4.2. Na verzending verhuist het item naar **Verzonden** met datum.

---

## 5. Wat hier wel en niet kan

**Read-only databasevragen horen hier wél thuis.** De Lovable-connector biedt
`query_database` — read-only, zonder credits, en het beantwoordt élke vraag over het live
schema, de data, `cron.job` en `pg_policies`. Zie de skill `nomadix-lovable-connector` C1:
een vraag aan Akke die een tool kan beantwoorden, is een verloren beurt. Formuleer dus geen
SQL-natrek voor Akke die je zelf kunt draaien.

```
project_id sellqo = 9932a7fe-43a1-42de-9c64-168968599600
```

**Wat nog steeds niet hier gebeurt:**

- **Schrijfacties op de database.** Migraties draaien, `INSERT`/`UPDATE`/`DELETE`, types
  genereren. `query_database` kán schrijven maar doet dat hier niet: schrijfwerk gaat via
  een migratiebestand en een expliciete go. Wat hier wél kan: migratiebestanden schrijven
  en valideren.
- **De CLI.** `.env` bevat alleen `SUPABASE_URL` en de publishable key; `supabase projects
  list` faalt op `LegacyPlatformAuthRequiredError`.
- **Custom frontends draaien of smoke-testen.** De zes custom frontends zijn aparte
  Lovable-projecten. Hun code is hier wél te lézen (`list_files` / `read_file` via de
  connector — zo is op 10 sep geverifieerd dat VanXcel uitsluitend `storefront-api` en
  `storefront-customer-api` aanroept). Ze daadwerkelijk draaien en klikken gebeurt daar.

---

## 6. Praktische notities voor deze repo

Verzameld tijdens de webshop-reeks; bespaart herhaalde fouten.

**Verificatie duurt lang.** `npx tsc --noEmit -p tsconfig.app.json` doet er 5 tot 10 minuten over (`types.ts` is 20.000+ regels). Draai hem in de achtergrond. Twee valkuilen die echt zijn voorgekomen:
- `tsc ... | head -30` geeft de exit code van `head`, niet van `tsc`. Schrijf naar een logbestand en lees `$?` direct af.
- `timeout` bestaat niet op macOS; een commando erin verpakken geeft exit 127 en draait niets.
- Een `tsc`-proces dat blijft hangen in `pgrep` kan een wees zijn van een eerder afgebroken run. Controleer de logoutput vóór je concludeert dat je code de typechecker laat ontploffen.

**`npm run build` doet geen typecheck** — dat is `vite build` met esbuild, dat types stript. Beide draaien dus, ze vangen verschillende fouten. De chunk-size-waarschuwing is bestaand en geen regressie.

**Lint altijd tegen een baseline.** Veel bestanden hebben bestaande `no-explicit-any`-fouten. Meet het aantal vóór en na door de `HEAD`-versie tijdelijk weg te schrijven en te linten; rapporteer alleen het verschil.

**`git add -A` sleept `public/sitemap.xml` mee.** Het `prebuild`-script regenereert dat bestand bij elke build, en lokaal valt het korter uit. Controleer `git status` vóór het committen en stage gericht.

**Committen gaat direct op `main`.** De hele historie staat daar en de Lovable-sync verwacht het; een feature branch is hier de afwijking.

**`Settings.tsx` leest alleen `?section=`.** De parameter `?tab=` wordt nergens uitgelezen; links daarmee landen stil op "Mijn profiel". Er staan er nog drie in edge-functies, geparkeerd in de backlog.

**Antwoord in het Nederlands.** Alle documentatie, commit-messages en UI-teksten in dit project zijn Nederlands.

---

## 7. Proactief meedenken — twee reflexen

Deze twee reflexen zijn standaard, niet optioneel. Ze bestaan omdat Akke niet zelf aan efficiëntie en skill-onderhoud wil hoeven denken — dat is de taak van de assistent.

**Efficiëntie-pass (verplicht).** Vóór een oplossing: (1) bestaat er al een tool/connector/MCP/plugin/skill die dit korter of veiliger maakt? (2) gebeurt dit op de juiste plek — chat (strategie/recon) vs Claude Code (multi-file) vs Cowork (terugkerende ops) vs Design (visueel) vs connector (externe data)? (3) is dit een terugkerend patroon dat geautomatiseerd of in een skill gegoten moet worden i.p.v. handmatig herhaald? (4) wat zou toekomstige-Akke hier omslachtig aan vinden? Meld de uitkomst ongevraagd, ook als het het huidige plan doorkruist. Valt er niks te winnen: één zin ("geen kortere weg, doorknallen") — de pass mag het tempo niet doden.

**Skill-onderhoudsreflex.** Leren we een harde les (productie-bug die een patroon blootlegt, omzeilde valkuil, veranderde regel), of blijkt een skill/doc iets te beweren dat niet meer met de code klopt: meld ter plekke "dit hoort in skill X" of "skill X klopt niet meer" met een kant-en-klaar voorstel. Niet wachten op een audit. Akke hoeft nooit zelf aan skill-onderhoud te denken. Skills updaten nooit stilzwijgend automatisch — elke wijziging gaat via een expliciete go, want een foute skill draagt door in al het volgende werk. Leeft een skill op beide plekken (workspace + repo), werk dan beide bij; de repo is de bron.
\n
---

## 8. Samenhang: elke wijziging past in het geheel

Akke mag nooit zelf moeten struikelen over een oude instelling, een dubbele knop, een verouderde helptekst of een gemengde taal (les van 20 okt 2026, mailmodule). Bij elke nieuwe functie, wijziging, verhuis of opruiming:

1. **Vóór het plan, een inventaris.** Wat raakt hetzelfde onderwerp al? Kijk naar zijbalk, routes, tabs, `?section=`/`?tab=`, instellingen, helpartikels (`doc_articles`, live), i18n, changelog, publieke site, mailtemplates, hooks/functies/cron en live gebruik per tenant. Zet het in het plan als tabel: plek | doet nu | wat verandert | voorstel.
2. **Ontwerpregels.**
   - Eén plek per taak; een tweede plek is enkel een link.
   - Geen dubbelingen op één scherm.
   - Een onderdeel van een module wordt een tab, geen nieuw zijbalk-item.
   - Tabs bovenaan, deeplinkbaar.
   - Eén bron per getal.
   - Eén taal per scherm.
   - Geen dode affordances.
   - Elk scherm werkt op 390 en 1280 px.
3. **Verhuizen.**
   - Volgorde: nieuwe plek → bewijzen → gebruikers en data overzetten (snapshot vooraf, nagetrokken per tenant) → oude plek slopen.
   - Oude links redirecten.
   - Na afloop een sweep op alle verwijzingen naar de oude plek.
4. **Vóór "klaar", de geheel-wandeling.** Loop het hele onderwerp door als gebruiker, met screenshots op 390/1280. Controleer dat de cijfers overal gelijk zijn en dat de helptekst klopt met wat je ziet.
5. **Melden.** Het verslag heeft altijd een sectie **Samenhang**: wat bestond er al, wat is aangepast of verhuisd, wie is overgezet, wat is opgeruimd en wat bewust bleef staan.

De volledige werkwijze staat in de account-skill `samenhang-check`.

---

## 9. SellQo Kassa (GKS 2.0) — fiscale kern

**Wijzigen in `src/kassa/` = fiscale release.** SellQo Kassa wordt gecertificeerd als geregistreerd kassasysteem; elke wijziging aan de kassa-kern moet bij de FOD gemeld worden. Lees eerst `src/kassa/README.md` en de eisenmatrix (projectdoc `claude/gks-eisenmatrix.md`). Nooit "even snel" iets in `src/kassa/` meenemen in een andere batch; `npx vitest run src/kassa` (incl. de officiële use cases) moet groen zijn, en `KASSA_SW_VERSION` gaat omhoog. `fiscal_events` en `fiscal_audit_log` zijn append-only: geen update, delete of truncate, ook niet in een migratie.

# CLAUDE.md — werkwijze voor dit project

Instructies voor Claude Code in de SellQo-repo. Lees dit vóór je iets wijzigt.

Dit bestand vat samen; de brondocumenten zijn leidend bij twijfel:

| Onderwerp | Bron |
|---|---|
| Paper trail van elke batch | `docs/role-audit.md` |
| Custom frontends (patronen, valkuilen) | `.agents/skills/sellqo-custom-frontend-runbook/SKILL.md` |
| Webshop-reeks (de eerste wet) | `docs/webshop-masterplan.md` §0 |
| Webshop fase 5-7 | `docs/webshop-fase5-7-visie.md` |
| RLS-patronen | `docs/architecture-patterns.md` |
| Secrets | `docs/secrets-management.md` |
| Nieuwsbrief-wachtrij | `docs/newsletter-queue.md` |
| Geparkeerd werk | `docs/fase2-backlog.md` |

Er bestaan daarnaast Lovable workspace-skills (`sellqo-gedeelde-paden`, en de werkwijze-documenten voor engineering/release/security/connector) die **niet in deze repo staan**. Verwijst een opdracht daarnaar, vraag om de inhoud in plaats van te gokken.

---

## 1. De eerste wet — custom-frontend tenants

**Vijf tenants draaien een eigen frontend: Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata. Zij mogen van webshop-werk niets merken.**

- Hun frontends praten via `storefront-resolve`, `storefront-api` en `checkout-engine` met de core. Die contracten wijzigen niet.
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
- **Gedeelde-paden-waarschuwing** — als een gedeeld pad (`storefront-api`, `checkout-engine`, gedeelde tabellen) geraakt is: waarom dat veilig is voor alle tenants.
- **Verificatie** — wat er gedraaid is en met welke uitkomst.
- **Bewust ongemoeid / Vervolg** — wat expliciet niet is aangeraakt, en wat er nog open staat.

### 4.2 Publieke changelog in 4 talen

Twee plekken, altijd samen:

1. `src/pages/public/PublicChangelog.tsx` — entry in de `RELEASES`-array: `{ version, dateKey, changes: [{ id, type }] }`, met `type` uit `feature | improvement | bugfix | security`.
2. `src/i18n/locales/landing.{nl,en,fr,de}.json` — `public.changelog.changes.<id>` met `{ title, description }` in **alle vier** de talen.

Momenteel 89 entries, in alle vier de locales gelijk. Die pariteit moet blijven kloppen: één taal overslaan breekt de changelog voor die bezoekers.

Schrijf in de tweede persoon, leg uit wat het voor de tenant betekent, en vermijd onverifieerbare marketingtaal (Belgische regels rond misleidende handelspraktijken).

### 4.3 `doc_articles` — in-app documentatie

Via een migratie-`INSERT` op `public.doc_articles`:

- `doc_level` = `'tenant'` (of `'platform'` voor interne docs)
- `context_path` = de adminroute waar het artikel bij hoort, bijv. `/admin/storefront` — daarop wordt contextuele hulp getoond
- `title`, `slug`, `excerpt`, `content` (HTML), `sort_order`
- `UNIQUE (doc_level, slug)`, dus gebruik `ON CONFLICT` bij het bijwerken

Let op: `doc_articles` heeft **één** `content`-veld, geen taalvarianten. Alleen de changelog is viertalig.

### 4.4 Newsletter-wachtrij — `docs/newsletter-queue.md`

Item toevoegen onder **Openstaand**, met versienummer, categorie en datum, de NL-tekst zoals die in de nieuwsbrief komt, en een verwijzing naar de i18n-key uit 4.2. Na verzending verhuist het item naar **Verzonden** met datum.

---

## 5. Wat Claude Code niet kan

Twee dingen lopen via Claude in de chat (Lovable-kant), niet hier:

**Directe Supabase-database-toegang.** Geen SQL uitvoeren, geen migraties draaien, geen types genereren. `.env` bevat alleen `SUPABASE_URL` en de publishable key; `supabase projects list` faalt op `LegacyPlatformAuthRequiredError`. Wat wél kan: migratiebestanden schrijven, ze valideren (JSON-literals parsen, sectietypes tegen de registry houden), en een SQL-natrek formuleren die Akke uitvoert. Vraag de uitkomst en verwerk die in de paper trail.

**Custom-frontend smoke-checks.** De vijf custom frontends zijn aparte Lovable-projecten. Verifiëren dat een wijziging hen niet raakt gebeurt daar, niet hier. Hier kan alleen aangetoond worden dat het contract ongewijzigd is.

Vraag hier dus nooit om deze twee te "even zelf te doen" — meld wat je nodig hebt en van wie.

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

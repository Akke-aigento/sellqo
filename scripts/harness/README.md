# Harnas — één scherm visueel nakijken zonder login of database

Draait één React-component in Vite met gemockte hooks, en maakt met Playwright screenshots op
390 en 1280 px. Bedoeld voor de check "elk scherm werkt op 390 en 1280 px" (CLAUDE.md §8) en voor
klikscenario's, zonder echte sessie, tenant of Supabase.

```bash
node scripts/harness/shoot.mjs <scenario>            # screenshots naar /tmp/harness/<scenario>-<breedte>[-<stap>].png
node scripts/harness/shoot.mjs <scenario> --serve    # enkel de devserver (http://localhost:5199) om zelf te kijken
```

Exit 1 bij een paginafout of console-error. Playwright komt uit `PLAYWRIGHT_PATH` (standaard
`/opt/node-tools/node_modules/playwright/index.mjs`, de sandbox) of anders uit `playwright` in node_modules.

## Een scenario toevoegen

`scenarios/<naam>/`:

- `main.tsx` — rendert het scherm (met `MemoryRouter`, `Toaster`, ...). `@/index.css` en `@/i18n` worden
  al geladen; de taal is `nl`, tenzij de URL `?lang=en` bevat.
- `mocks/*.ts` — vervangers voor hooks of de Supabase-client. Houd ze klein en stuur ze via `window.__…`
  vanuit `steps.mjs`.
- `aliases.json` — `{ "<import-pad zoals in de code>": "mocks/<bestand>.ts" }`. Een sleutel die met `/`
  begint en eindigt, is een regex (bv. `"/^\\./sidebar/useNavItemVisibility$/"` voor een relatieve import).
- `steps.mjs` (optioneel) — `export const setup = { … }` (wordt `window.__harness`),
  `export const widths = [390, 1024, 1280]` om andere breedtes te nemen (1024 = tablet liggend, 1024×768) en
  `export async function run(page, { width, shot, log })` voor klikken; `shot('naam')` maakt een extra screenshot.

Scenario's: `kassa-koppelen` (toestel koppelen met code/QR of met één tik vanuit een beheer-sessie, ontkoppeld/fout met terugknop, beheer: Toestel koppelen/Ontkoppelen), `keuken` (KASSA-MOBIEL-1: kop van het keukenscherm, meet of elke knop binnen beeld valt), `onderbalk` (gsm-onderbalk), `kassa-home` (een dienst op de kassa met
het zaalplan en de kaart van Café De Wissel: tafel, tikken, rekening, toog, ⋯-menu; meet ook horizontale overloop).
`uren` (UREN-1 / WEBSITE-HORECA-1: Instellingen › Bedrijfsgegevens met de openingsuren — ook als lezer en leeg —, afhalen/leveren en online reserveren met "Zelfde als openingsuren", de horeca-zijbalk met Website, de Website-pagina als horeca, de sectiekiezer in Aanpassen, Instellingen › Horeca; klikt openingsuren en een sluitingsdag in en controleert wat er bewaard wordt; UREN-1b: Branding, QR aan tafel, afhalen zonder tijdsloten, themagalerij met horeca vooraan — het themaschema komt uit `mocks/schemaData.ts`, de presets van sellqo-storefront).
`nu-paneel` (HORECA-NU-1/2: het Nu-paneel bovenaan Vandaag — rustig en druk, als beheerder, medewerker en marketing, de lijsten Uitverkocht en Dagschotel, "vandaag dicht" bevestigen, het pauzemenu, Engels — en ⋯ › Nu op de kassa als eigenaar (met sessietoken) en als ober (akkoord met PIN); logt de zichtbare tegels per rol en de schrijfacties).
`qr-aan-tafel` (QR-MODULES-1: "QR aan tafel" per variant — op de tafelrekening, elke bestelling apart, zonder Stripe,
met FDM, enkel bekijken, databank zonder de oproep-kolommen, Engels — en Kassa › Betalen; controleert ook wat er bewaard wordt).
`mijn-zaak` (HORECA-INSTELLINGEN-1: horeca-only-zijbalk met Transacties onder Rapporten, Mijn zaak met de checklist, elke groep
met tabs, Betalen › Fooi, oude `?section=`-links die doorsturen, staff-rol, Personeel, Reservaties, de zoekbalk met "fooi",
⌘K in de kop met "printer" + Enter, en als bewijs een webshopzaak: zijbalk en klassieke Instellingen).

Lessen: mock het spoorfilter (`isItemBlocked`) bewust, anders zie je items die de echte app verbergt.
Nooit `pkill -f` op de vite-server; `shoot.mjs` stopt hem zelf.
Geef je een echte store (bv. `HorecaStore` met een nep-transport) als prop door, abonneer er dan zelf op
(`store.subscribe(rerender)`): anders hertekent er niets en lijkt het of tikken niets doet.
Een ontbrekende export in een mock geeft een leeg scherm en een time-out; kijk dan in de vite-uitvoer
(`--serve`) naar "No matching export".

## Parallel draaien (meerdere worktrees)

Elke worktree die tegelijk een harnas draait, krijgt een **eigen cache en poort**. Anders
her-optimaliseert vite in de ene worktree de dependencies van de andere en breekt de pagina met
"Failed to fetch dynamically imported module", of faalt de start op "Port … is already in use".

```bash
HARNESS_CACHE_DIR=/tmp/harness-cache-<worktree> HARNESS_PORT=52xx node scripts/harness/shoot.mjs <scenario>
```

| Variabele | Standaard | Wat |
|---|---|---|
| `HARNESS_CACHE_DIR` | `/tmp/harness-vite-cache` | vite-cache (dep-optimalisatie) |
| `HARNESS_PORT` | `5199` | poort van de dev-server |
| `HARNESS_TIMEOUT` | `30000` | ms voor de eerste lading (`goto` + `networkidle`) en elke stap |

**Koude start.** De eerste Tailwind-verwerking van `src/index.css` kan onder CPU-krapte langer dan
30 s duren. Zet dan `HARNESS_TIMEOUT=180000`, of warm eerst op:

```bash
HARNESS_CACHE_DIR=… HARNESS_PORT=52xx node scripts/harness/shoot.mjs <scenario> --serve &
curl --noproxy '*' -s -o /dev/null "http://localhost:52xx/@fs$PWD/src/index.css"   # wacht tot 200
```

en stop de server daarna (`ps -eo pid,args | awk '$3=="scripts/harness/shoot.mjs"'`, nooit `pkill -f`).

**Veel schermen in één scenario.** Laad schermen lazy in `main.tsx` (`?screen=…`) en open per scherm
een vers tabblad (zie `scenarios/horeca-beheer`): tien schermen na elkaar in één tabblad liet chromium
in de sandbox crashen op geheugen.

KASSA-MOBIEL-1: de kassa praat via `@/kassa/app/kassaSupabase` (eigen client). Mock die in elk kassascenario
(`aliases.json`), en importeer hem in de code altijd via dat alias-pad, nooit relatief (`./kassaSupabase`):
een relatieve import ontsnapt aan de alias, maakt in het harnas een echte client zonder env en geeft een leeg scherm
zonder foutmelding.

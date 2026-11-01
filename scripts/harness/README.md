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

Scenario's: `kassa-setup` (eerste toestel), `onderbalk` (gsm-onderbalk), `kassa-home` (een dienst op de kassa met
het zaalplan en de kaart van Café De Wissel: tafel, tikken, rekening, toog, ⋯-menu; meet ook horizontale overloop).

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

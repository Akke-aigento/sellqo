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
- `steps.mjs` (optioneel) — `export const setup = { … }` (wordt `window.__harness`) en
  `export async function run(page, { width, shot, log })` voor klikken; `shot('naam')` maakt een extra screenshot.

Lessen: mock het spoorfilter (`isItemBlocked`) bewust, anders zie je items die de echte app verbergt.
Nooit `pkill -f` op de vite-server; `shoot.mjs` stopt hem zelf.

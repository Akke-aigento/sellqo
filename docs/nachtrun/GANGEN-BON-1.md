# GANGEN-BON-1 — geen wachtende gangen meer op de keukenbon — 2 november 2026

Batch VERVOLG-1 (onderdeel D), branch `vervolg-1`. Niet gepusht, niet gedeployed, geen DB-writes. Zie ook de
bijgewerkte `docs/nachtrun/GANGEN-1.md`.

## Root cause
GANGEN-1 (`supabase/migrations/20261101230220_gangen_1.sql`, stap 4b) voegde in `send_round` van
`horeca_apply_one` per post de nog niet vrijgegeven ontwerp-lijnen toe aan `kitchen_tickets.items`
(`'waiting': true`). Volgens de GKS-eisenmatrix is een keuken-/barbon een gevolg van een P/ORDER (PRT-05) en hoort
bij elke aanmaak van een bestelling een signOrder (EVT-06): een productiebon mag niets tonen dat nog niet besteld is.
Beslissing Akke: weghalen.

## Uitgevoerd
- `supabase/migrations/20261102080020_gangen_bon_1.sql`: ankermethode (`pg_get_functiondef` + `replace`), het hele
  blok `|| coalesce((select jsonb_agg(… 'waiting', true …)), '[]'::jsonb)` vervangen door een commentaarregel met
  marker `GANGEN-BON-1`. Anker = het exacte blok uit 20261101230220 inclusief de regels ervoor en erna; moet precies
  1× voorkomen, anders exception. Vorige definitie in `ops.gangen_bon_1_prev_functions`.
- `scripts/gks/sql/test_gangen_bon.sql` (nieuw) en een volgorde-opmerking bovenaan `test_gangen.sql`.
- Changelog `public.changelog.changes.dining_courses` (5 talen) en `docs/newsletter-queue.md`: "de keuken ziet per gang
  wat nu moet en wat nog komt" klopte niet meer → "de keuken krijgt de bon van een gang pas als je die vrijgeeft".
- `docs/nachtrun/GANGEN-1.md`: open punt gesloten, sectie GANGEN-BON-1.

Bewust niet opgeruimd: de `waiting`-rendering in `src/components/admin/kitchen/{kitchenModel,KitchenBoard,printTicket}.ts(x)`
en `supabase/functions/_shared/horecaPrint.ts`. Die blijft compatibel (toont niets zonder `waiting`-items), breekt
geen tests (`kitchenModel.test.ts`, `printTicket.test.ts`, `horecaPrint.test.ts` voeden zelf `waiting`-items) en
vraagt dus geen edge-function-deploy. Wordt een dode tak; opruimen kan in een latere batch samen met een deploy.
De kassa (`CheckScreen`) toont "wacht" uit `check_lines` en blijft ongewijzigd.

## Security-keuzes
Geen policies of grants. `horeca_apply_one` blijft `security definer` met dezelfde rolcontroles (enkel één
expressie in de `items`-opbouw verwijderd). Geen fiscaal event, geen FDM-bericht gewijzigd; `src/kassa/` niet geraakt.

## Gedeelde-paden-waarschuwing
`horeca_apply_one` bedient elke kassa. Het verwijderde blok gaf enkel iets terug als `horeca_pay_settings.courses_enabled`;
live staat dat bij 0 zaken aan en bevat 0 van de 15 `kitchen_tickets` een `waiting`-item. Zonder gangen is de bon
byte-gelijk aan vóór de migratie.

## Verificatie
- Live read-only: anker (933 tekens) precies 1× in `horeca_apply_one`; `'waiting', true` komt enkel in die functie voor.
- Lokale PostgreSQL 16 (`scripts/gks/sql/run.sh` + GANGEN-1 2× + `test_gangen.sql` 12/12 t, daarna GANGEN-BON-1 2×,
  tweede run "al gepatcht"): `test_gangen_bon.sql` 6/6 t (marker aanwezig, geen `'waiting', true` meer, `fire_course`
  behouden, bon bevat enkel de verstuurde lijn, dessert blijft ontwerp, `horeca_check_json` toont de wachtende lijn nog).
- `npx vitest run src/kassa src/components/admin/kitchen …` → 403 groen, 1 overgeslagen.

## Uitrol
Volgorde: na 20261101230200 → 20261101230210 → 20261101230220 (GANGEN-1). Natrek:
`select position('GANGEN-BON-1' in d) > 0 and position($$'waiting', true$$ in d) = 0 from (select pg_get_functiondef('public.horeca_apply_one(uuid, jsonb)'::regprocedure) d) s;`
Geen edge-function-deploy, geen frontend-publish nodig voor dit onderdeel.

## Changelog (NL)
Geen aparte entry: GANGEN-1 is nog niet uitgerold, dus de bestaande entry "Gangen aan tafel" is aangepast
(de keuken krijgt de bon van een gang pas als je die vrijgeeft).

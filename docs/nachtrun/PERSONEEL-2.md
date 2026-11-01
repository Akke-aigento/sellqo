## PERSONEEL-2 — in/uitklokken server-side, urenoverzicht, correcties, CSV en fooienpot — 1 november 2026

Branch `night-rapport` (nachtrun); niets gepusht, gedeployed of live gedraaid.

**Root cause** — `src/kassa/app/attendance.ts` (PERSONEEL-1) bewaarde "ingeklokt" enkel in `localStorage` van het toestel (`sq_kassa_clock|tenant|staff`, r. 9-13 oud) en schreef in niet-fiscale modus enkel een auditregel `work_in`/`work_out` in `fiscal_audit_log` (r. 21 oud). Gevolg: inklokken op tablet A was onbekend op tablet B, en er bestond geen urenregistratie of overzicht (role-audit PERSONEEL-1: "een urenoverzicht volgt later"). `KassaHome.tsx` las de knopstand één keer uit `localStorage` bij het mounten (ook niet bij "Wissel").

**Uitgevoerd**
- Migratie `supabase/migrations/20261101230600_personeel_2_uren.sql`:
  - `kassa_shifts` (één rij per shift; trigger laat enkel het afsluiten toe: `clock_out_at` van leeg naar ingevuld; geen delete/truncate) met verwijzing naar het fiscale `signWorkIn/Out`-event (`in_/out_fiscal_event_id`).
  - `kassa_shift_corrections` (append-only): `adjust` (andere tijden), `void` (telt niet), `add` (vergeten shift). De laatste correctie per shift wint; de bron blijft ongewijzigd.
  - `kassa_shifts_effective`, `kassa_open_shift` (intern), `kassa_clock_state`, `kassa_clock` (kassa), `kassa_shift_correct`, `kassa_hours_report` (beheer).
- Migratie `20261101230610_personeel_2_docs.sql`: helpartikel `kassapersoneel-pincodes` aangevuld (anker live nagetrokken).
- `src/kassa/app/attendance.ts` (enige fiscale-kernbestand met logica): `fetchClockState()`; `clock()` vraagt eerst de serverstand (zelfde stand = niets tekenen/loggen, `already`), niet-fiscaal = eerst `kassa_clock` (lukt dat niet: `offline`, niets gebeurd) en daarna de bestaande auditregel; fiscaal = het ongewijzigde pad (`buildWorkInOut` → `runtime.sign`) en daarna `kassa_clock` met het event-id (staat het event nog in de outbox: opnieuw zonder id). Mislukt de server na het tekenen: `ok` + `notSaved`. `localStorage` is enkel nog cache.
- `src/kassa/app/screens/KassaHome.tsx` (minimaal): `useEffect` haalt de serverstand bij elke medewerker(wissel); meldingen voor `already`/`notSaved`.
- `src/kassa/app/__tests__/runtime.test.ts`: supabase-mock kreeg `rpc`; 4 nieuwe tests.
- Beheer: `src/components/admin/pos/KassaHoursCard.tsx` onder `/admin/pos?tab=personeel` (enkel met horecaspoor, zoals Betalen/Printers): week-navigatie, uren per medewerker per dag (h:mm), open shifts met "Afsluiten", shiftlijst met badges, correctiedialoog (begin/einde/reden, schrappen met bevestiging), "Shift toevoegen", CSV per week, fooienpot per dag. `src/hooks/useKassaHours.ts`, `src/lib/kassaHours.ts` (+ test). `src/pages/admin/POS.tsx`: kaart toegevoegd.
- i18n nl/en/fr/de/uk (`admin.kassaHours.*`, `kassa.home.clockAlready*`, `clockNotSaved`, `clockError.offline`).
- Harnas: scenario `kassa-uren`; mock `kassa-home/mocks/attendance.ts` kreeg `fetchClockState`; `scripts/harness/vite.config.ts` leest `HARNESS_CACHE_DIR` (parallelle harnassen deelden één optimize-cache → "504 Outdated Optimize Dep").

**Security-keuzes**
- Beide tabellen: geen schrijfrechten voor `authenticated`; enkel via security-definer-functies. Lezen (RLS) enkel `tenant_admin` (uren = loongegevens).
- `kassa_clock`/`kassa_clock_state`: `has_tenant_role(tenant_admin, staff)`, medewerker moet actief zijn en bij de zaak horen, fiscaal event-id wordt gecontroleerd (zelfde zaak, zelfde medewerker, juiste mutatie). Advisory lock per medewerker tegen dubbele shifts.
- `kassa_shift_correct`, `kassa_hours_report`: enkel `tenant_admin`. Correcties met verplichte reden (3-200), max. 24 u, niet in de toekomst.
- `fiscal_events`/`fiscal_audit_log`: niet gewijzigd (enkel gelezen in `kassa_clock`). Geen fiscale event-types of FDM-berichtinhoud veranderd. `KASSA_SW_VERSION` niet verhoogd (hoofdsessie).

**Gedeelde-paden-waarschuwing** — Geen storefront-contract of gedeelde webshoptabel geraakt. Nieuwe tabellen/functies zijn additief.

**Verificatie**
- Lokale PG16 (`scripts/gks/sql/run.sh`, migraties 2×): alle bestaande suites groen + nieuwe `test_personeel2.sql` (knopstand over toestellen, dubbel in/uit = noop, staff leest/corrigeert niet, vals fiscaal event geweigerd, update/delete op de bron geweigerd ook als superuser, vreemde zaak geweigerd, correcties adjust/add/void, open shift sluiten via correctie → nieuwe shift mogelijk, >24u en lege reden geweigerd, fooien per dag, anon geweigerd).
- `npx vitest run src/kassa`: 262 tests groen; 3 bestanden (print/preview, print/print, payDialog) laden niet door een ontbrekende `qr.js` in de gedeelde node_modules — identiek op HEAD, geen regressie.
- `npx vitest run src/lib/kassaHours.test.ts`: 6/6 (nieuw testbestand → toevoegen aan de Vitest-stap in CI).
- `node scripts/i18n-parity.mjs`: exit 0. `check-i18n-used-keys`, `check-dead-buttons`: exit 0. `eslint` op alle gewijzigde bestanden: 0 fouten.
- Harnas `kassa-uren` op 390 en 1280: geen horizontale overloop, correctiedialoog bekeken (screenshots /tmp/harness/kassa-uren-*.png).
- `tsc --noEmit -p tsconfig.app.json`: exit 2 met 27 fouten, alle in bestanden die deze batch niet raakt (useOrders, useInvoices, PlatformBlog, … — `RejectExcessProperties`, wijst op een afwijkende supabase-js in de gedeelde node_modules van de sandbox); 0 fouten in de gewijzigde of nieuwe bestanden. Hoofdsessie: opnieuw draaien op de samengevoegde branch. `npm run build` niet gedraaid (geheugen: tsc werd 2× door de OOM-killer gestopt).

**Bewust ongemoeid / Vervolg**
- Geen herberekening van oude PERSONEEL-1-klokacties (enkel in localStorage/auditlog): uren starten vanaf de deploy.
- Fooienpot is een rapport; geen boeking of uitbetaling. Fooi uit de klassieke kassa (`pos_cash_movements kind='tip'`) telt niet mee, net als in het Z-rapport.
- Uitrol: migratie 230600 → frontend publish → docs 230610. Na de migratie `information_schema.column_privileges`/`pg_policies` op beide tabellen natrekken. Nieuwe native app-build nodig voor de kassa-app (gebundelde code).
- `ReportsScreen`/labels niet aangeraakt.

### Changelog (NL)
**Uren van je kassapersoneel, op elk toestel hetzelfde** — Klok je in op de ene tablet, dan weet elke kassa het. Onder Kassa › Personeel zie je per week de gewerkte uren, sluit je vergeten shifts af, corrigeer je met een reden, download je een CSV voor je sociaal secretariaat en zie je hoe de fooien per dag volgens de uren verdeeld worden.

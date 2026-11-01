## KASSA-RECHTEN-1 — korting, gratis en annuleren enkel met akkoord van een verantwoordelijke — 1 november 2026

**Root cause**
- Elke kassamedewerker kon zonder goedkeuring korting geven (−10/−20/−50 %), iets "van het huis" geven
  en verstuurde lijnen annuleren. In de kassa: `LineDialog` in `src/kassa/app/screens/CheckScreen.tsx`
  (kortingsknoppen en "Annuleren", vóór deze batch r. ±487-503 en ±525), de `void_line` werd rechtstreeks
  in de wachtrij gezet (r. ±380) en `discountLine` in `src/kassa/app/horeca/actions.ts` (r. ±179) stuurde
  `discount_line` zonder enige rolcontrole.
- Op de server controleerde `horeca_apply` enkel `has_tenant_role(tenant_admin, staff)`
  (`supabase/migrations/20261024130000_tafel_1_checks.sql` r. 346); `horeca_apply_one` voerde
  `discount_line` en `void_line` uit voor elke `staff_id` (r. 540-607).
- Gevolg: geldlek/fraudemogelijkheid (gratis geven of verstuurde drankjes wegboeken zonder spoor van wie het toeliet).

**Uitgevoerd**
- `supabase/migrations/20261101230250_kassa_rechten_1.sql`
  - Tabel `kassa_approvals` (eenmalig akkoord: actie `discount`/`void_sent`, rekening, lijn, goedkeurder,
    starter, toestel, vervalt na 5 min, `used_at` + `command_id`). RLS aan, geen policies, geen grants:
    enkel de functies hieronder.
  - `kassa_approve(p_tenant_id, p_device_id, p)`: PIN + rol (owner/manager) + actief/`can_use_pos` van de
    goedkeurder, exact dezelfde lockout als `kassa_staff_login`/`kassa_product_quick_edit` (5 fout = 5 min),
    elke foute PIN (`pin_failed`, context `kassa_approval`) en elk akkoord (`kassa_approval`) in
    `fiscal_audit_log`. Geeft `{ok, approval_id, approver_name}` of `{ok:false, reason: wrong_pin|locked}`.
  - `kassa_require_approval(p_tenant_id, p_check_id, cmd)` (niet uitvoerbaar voor authenticated): door als
    `staff_id` zelf owner/manager is, anders een geldig, ongebruikt, niet-verlopen akkoord voor precies die
    actie + rekening + lijn; zet het op gebruikt. Anders `42501`.
  - Patch op `horeca_apply_one` (pg_get_functiondef + één anker `if v_kind = 'add_line'`, precies één keer,
    idempotent via marker `KASSA-RECHTEN-1`, snapshot in `snapshots.sellqo_20261101_fn_kassa_rechten_1`):
    vóór de commando-takken `perform kassa_require_approval(...)` voor `discount_line` (ook gratis = 100 %)
    en voor `void_line` op een verstuurde lijn. De takken zelf (en dus alle lijnen/fiscale gevolgen) zijn
    byte-identiek.
- `src/kassa/app/horeca/approvals.ts` (nieuw): `needsApproval`, `approvalFor`, `requestApproval` (RPC).
- `src/kassa/app/screens/ApprovalDialog.tsx` (nieuw): "PIN van een verantwoordelijke" — zelfde opbouw als
  `ProductQuickEdit` (goedkeurder kiezen uit owner/manager, PIN, server beslist).
- `src/kassa/app/horeca/actions.ts`: `discountLine(..., approvalId?)`, nieuwe `voidLine(...)` (zonder
  akkoord zoals vroeger in de wachtrij; met akkoord meteen via `applyNow`, zodat het eenmalige akkoord niet
  in de offline-wachtrij blijft hangen), `42501` → reden `not_allowed`.
- `src/kassa/app/screens/CheckScreen.tsx`: korting/gratis en annuleren van een verstuurde lijn lopen via
  `guarded(...)`: eigenaar/verantwoordelijke meteen, anders eerst `ApprovalDialog`. Schildje + uitleg op de
  knoppen die een akkoord vragen. Ontwerp-lijnen weghalen blijft vrij.
- i18n `kassa.approval.*`, `kassa.checks.error.not_allowed` in nl/en/fr/de/uk.

**Security-keuzes**
- Akkoord en PIN-controle in een aparte RPC (niet in het commando): een foute PIN binnen `horeca_apply`
  rolt mee terug (subtransactie per commando) waardoor de lockout niet zou tellen en een PIN met 50
  commando's per aanroep te raden zou zijn; zo komt er ook nooit een PIN in de lokale wachtrij.
- Akkoord is eenmalig, 5 minuten geldig en gebonden aan actie + rekening + lijn; wordt het commando
  verderop geweigerd, dan rolt `used_at` mee terug (bruikbaar voor dezelfde lijn tot het verloopt).
- `kassa_approvals`: RLS aan, `revoke all` voor anon/authenticated. `kassa_require_approval`: geen execute
  voor authenticated. `kassa_approve`: execute voor authenticated, `has_tenant_role` + rekening moet bij de
  zaak horen.
- Restrisico (bestaand model, niet nieuw): `staff_id` in een commando komt van het toestel. Een
  eigenaar/verantwoordelijke "zelf aan de kassa" wordt herkend aan die `staff_id`; wie een ander toestel-
  token heeft, kan die al vervalsen voor elke andere handeling. Echte sessiebinding = eigen batch.

**Gedeelde-paden-waarschuwing**
- Geen `storefront-api`/`storefront-customer-api`, geen gedeelde storefront-tabellen. `horeca_apply_one`
  wordt ook gebruikt door `table_request_accept` (QR, `add_line`) en `table_check_pay_settle` (online,
  `move_lines`): die commando's raken de nieuwe controle niet. Geen andere aanroepers van
  `discount_line`/`void_line` (grep over `src` en `supabase/functions`).

**Verificatie**
- `scripts/gks/sql/run.sh` (lokale PostgreSQL 16, alle kassamigraties twee keer = idempotent): alle
  bestaande suites groen + nieuwe `test_kassa_nachtrun.sql` (39 controles): ober zonder akkoord geweigerd
  (korting verstuurd, gratis ontwerp, annuleren verstuurd, zonder staff_id), ontwerp weghalen vrij, ober kan
  niet goedkeuren, foute PIN telt + spoor, andere zaak geweigerd, akkoord voor andere actie geweigerd,
  korting met akkoord geeft exact dezelfde lijnen als voorheen (−3 PRICE_CHANGE + nieuwe lijn −465), eenmalig,
  verlopen geweigerd, eigenaar meteen, functie en tabel niet rechtstreeks bereikbaar.
- Samen met KEUKEN-VEILIG-1 (`20261101230200`, worktree sellqo-keuken, ook ankerpatch op `horeca_apply_one`; ankers overlappen niet): lokaal keuken eerst, dan 230250 en 230260, elk twee keer → beide markers in de functie, `test_kassa_nachtrun.sql` 44/44.
- Anker-uniciteit tegen de LIVE definitie gecontroleerd (read-only `query_database`): `add_line`-anker 1×.
- Vitest `src/kassa/app/__tests__/kassaUx6.test.ts` (regels akkoord nodig) — zie KASSA-UX-6 voor de rest.
- Harnas `kassa-rechten` (als ober Tom) op 390 en 1280: schildjes, PIN-venster bij korting en bij annuleren.

**Bewust ongemoeid / Vervolg**
- Fiscale events, FDM-berichten, `KASSA_SW_VERSION`: ongemoeid.
- Een `void_line` op een verstuurde lijn die nog van vóór deze batch in een offline-wachtrij staat
  (ober), wordt na de migratie geweigerd en als melding getoond — gewenst gedrag.
- Rapport "kortingen/annuleringen per goedkeurder" kan nu uit `kassa_approvals` + `fiscal_audit_log`;
  niet gebouwd.
- Volgorde uitrol: eerst de migratie, dan de kassa-frontend (een oude kassa blijft werken voor
  owner/manager; een ober krijgt dan een weigering i.p.v. stil door te gaan).

**Changelog (NL)**
- Titel: Korting en annuleren vragen nu het akkoord van een verantwoordelijke
- Beschrijving: Korting, "van het huis" en het annuleren van een al verstuurde bestelling doen eigenaars en
  verantwoordelijken meteen; andere medewerkers vragen eerst hun PIN. Zo zie je altijd wie wat toeliet.

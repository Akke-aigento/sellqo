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

### Review 1 → fixes (1 november 2026)

Op dezelfde migratie `20261101230250_kassa_rechten_1.sql` (nog nergens uitgerold), na `git merge night-final`.

| # | Bevinding | Fix |
|---|---|---|
| 1 (blokker) | `change_qty` op een lijn met korting: 10× Pils gratis, dan 9× min = negatieve rekening | Server: tweede anker in `horeca_apply_one` (change_qty-tak) weigert bij `price_changes`/`corrects_line_id`/`neg_reason` (55000). UI: `qtyLocked()` in `quickTap.ts`; `planMinus` slaat die lijnen over, de − op de rekeninglijn en ± in het lijnvenster staan uit met uitleg. Weghalen blijft kunnen. |
| 2 (hoog) | Owner-uitzondering steunde op een `staff_id` die het toestel zelf meegeeft | `kassa_staff_login` geeft een sessietoken (32 random bytes, enkel sha256 bewaard in `kassa_staff_sessions`; zaak, medewerker, toestel; vervalt einde bedrijfsdag). `kassa_staff_logout` trekt het in bij Wissel én bij vergrendelen door inactiviteit (`KassaSessionProvider onEnd`). `kassa_require_approval` aanvaardt de owner/manager-uitzondering enkel met een geldig token van precies die `staff_id`; anders is een akkoord nodig. Het token zit enkel op `discount_line`, `void_line` en kas uit; geen ander commando verandert. Een owner zonder token (bv. aangemeld vóór deze versie) krijgt het PIN-venster met zichzelf voorgekozen. |
| 4 | Akkoord niet gebonden aan het bedrag | `kassa_approvals.percent/amount_cents/qty`; `kassa_approve` eist ze (korting: percent of bedrag, annuleren: aantal, kas uit: bedrag) en `kassa_require_approval` vergelijkt ze met het commando. |
| 5 | "Nooit vergrendelen" gold ook voor een eigenaar | `effectiveLockMinutes`: owner/manager altijd hoogstens 2 min (UI). Server: het token wordt bij elke vergrendeling ingetrokken (best effort). `admin.kassaLock.never_hint` en `desc` vermelden het. |
| 6 | Kas uit zonder akkoord | `kassa_cash_move` (ankerpatch vóór `kassa_open_session`): `direction = 'out'` vraagt dezelfde uitzondering/akkoord (actie `cash_out`, gebonden aan het bedrag). De kassa vraagt het akkoord vóór het ondertekenen (`CashScreen` → `ApprovalDialog`). Kas in blijft vrij. |
| 7 | `split:true` in de toog-verplaatstak | Geweigerd (22023) in `kassa_counter_guard` (migratie 230260). |
| 8 | "Rond af" negeerde de contante afronding | Helemaal contant: afronden vanaf `cashDue` (6,08 → klant geeft 6,10 → fooi 0,90; kaart 0,92). |
| 9 | Rollback via snapshot zou latere patches (KEUKEN) wissen | Header beschrijft nu per functie `replace(def, <blok>, '')`; getest in `test_kassa_nachtrun.sql` (in een transactie, daarna rollback): markers weg, KEUKEN-VEILIG-1 blijft. |
| 12 | Audit/opruimen | `fiscal_audit_log.details.staff_id` blijft null als het toestel geen medewerker meegaf; owner-uitzondering en goedkeurder checken `can_use_pos`; `kassa_approve` wist akkoorden ouder dan 1 dag, `kassa_staff_session_start` verlopen sessies ouder dan 1 dag. |

**Restrisico (eerlijk)**
- Het sessietoken is een bearer-geheim in het geheugen van het toestel. Wie de kassa ontgrendeld in handen
  heeft terwijl een eigenaar aangemeld is, kan wat de eigenaar kan; daarom vergrendelt die na ≤ 2 min.
- Intrekken bij vergrendelen gebeurt online; offline vergrendeld blijft het token geldig tot het einde van
  de bedrijfsdag (maar het toestel zelf vergeet het meteen).
- Een `void_line` van een eigenaar die offline in de wachtrij komt, en een kas uit die na het ondertekenen
  opnieuw moet, bewaren het token in de lokale wachtrij (localStorage) tot ze doorgaan.
- Het token is niet aan het toestel gebonden in de controle: `horeca_apply_one` kent het toestel niet
  (`horeca_apply` wel). Het toestel staat wel in de sessierij voor het spoor.
- Een kas-uit-akkoord geldt 30 min (i.p.v. 5) zodat een ondertekende beweging die even in de wachtrij
  blijft, nog doorgaat. Verloopt het toch na het ondertekenen, dan wordt de beweging geweigerd na de
  handtekening (komt in het auditspoor als `signed_but_rejected`).

**Vervolg (niet in deze batch)**
- #3: de prijs van een product kan nog via REST aangepast worden door wie schrijfrechten heeft; aparte batch.
- `KASSA_SW_VERSION` ophogen bij het samenvoegen (hoofdsessie).

**Verificatie review 1**
- SQL: `scripts/gks/sql/run.sh` (KEUKEN-VEILIG-1 → 230250 → 230260, elk twee keer) groen; `test_kassa_nachtrun.sql`
  nu 69 controles, o.a. 10× gratis → 9× min geweigerd, correctielijn geweigerd, akkoord −10 % niet bruikbaar voor
  −100 %, owner zonder token / met andermans token geweigerd, ober met eigen token geen uitzondering, kas uit
  ober geweigerd / met akkoord (gebonden aan bedrag) / owner met token, ingetrokken token geweigerd, audit
  staff_id null, can_use_pos, split vanaf toog geweigerd, rollback-instructies.
- tsc exit 0, eslint 0, i18n-parity ok, `vitest run src/kassa` 332 groen.
- Harnas 390/1280: kas uit als ober → PIN-venster met bedrag en reden.

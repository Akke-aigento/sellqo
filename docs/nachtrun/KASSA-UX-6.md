## KASSA-UX-6 — kassa-ergonomie uit de rollenwandeling — 1 november 2026

**Root cause** (recon van 1-11, elk punt in de code nagekeken vóór de bouw)
1. "Lege rekening schrappen" voerde `void_check` meteen uit, zonder bevestiging, ook met lijnen erop
   (`src/kassa/app/screens/CheckScreen.tsx` r. 313-317 vóór deze batch).
2. Een getypte lijnopmerking ging verloren bij Sluiten zonder Opslaan (`LineDialog`, r. ±482/525: enkel
   het formulier-submit riep `onNote`).
3. Naar links vegen op een ontwerp-lijn verwijderde meteen, zonder weg terug (r. 166).
4. Vergrendelen na vaste 2 minuten (`session.tsx` r. 32 `DEFAULT_IDLE_MS`), en daarna moest je je naam
   opnieuw kiezen (`PinLock.tsx` r. 22 `picked` start leeg).
5. Afrekenen: snelknoppen contant begonnen bij €20 (r. 234); fooi enkel als vrij veld (r. 276-286); gelijk
   delen gaf n regels zonder begeleiding per persoon (r. 107/200).
6. Fooi per ober zat al in de rapportdata (`reportActions.ts` r. 31 `tips_cents`) maar het X-rapport
   toonde enkel `total_cents` (`reportHtml.ts` r. 50). Geen eigen overzicht voor de medewerker.
7. Geen "herhaal vorige ronde".
8. Modus Bar had geen toogverkoop-knop (`KassaHome.tsx` r. 276-279) en een toogverkoop kon niet op naam
   (`canMove={!counter}`, menu verbergt verplaatsen; server `kassa_counter_guard` weigerde `move_*`).
9. Kas openen/sluiten: enkel één totaal (`CashScreen.tsx` r. 56-94).

**Uitgevoerd**
- `CheckScreen.tsx`: (1) bevestigingsvenster met aantal en bedrag (lege rekening blijft één tik; met lijnen
  heet het menu-item "Rekening schrappen"); (2) `LineDialog.close()` bewaart een gewijzigde opmerking bij
  sluiten (knop, Esc, buiten tikken); (3) vegen toont "2× Kriek weggehaald" met **Ongedaan maken** (zet
  dezelfde lijn terug: product, extra's, aantal, opmerking, gang). Geen knop bij een lijn met korting
  (die zou zonder korting terugkomen) — dan enkel de melding; (7) ⋯ → **Herhaal vorige ronde**: de nog
  openstaande stuks van de laatste ronde met nieuwe bestellingen als ontwerp-lijnen (correcties,
  tegenboekingen, herboekingen met korting en verplaatste kopieën niet; uitverkochte producten worden
  overgeslagen en gemeld); (8) toog: ⋯ → **Op naam of naar een tafel zetten** (bestaand verplaatsvenster;
  naam/vrije tafel = `move_check`, bestaande rekening = `move_lines` van alles). Een toogverkoop is nooit
  meer een doel in dat venster.
- `session.tsx` + `PinLock.tsx`: `resumeStaff` — na vergrendelen door inactiviteit staat de laatste
  medewerker voorgekozen (enkel PIN; "Niet …?" gaat terug). Na "Wissel" kies je zelf. `setIdleMs` voor de
  wachttijd per zaak.
- Wachttijd per zaak: kolom `horeca_pay_settings.kassa_lock_minutes` (1/2/5/10/nooit, standaard 2);
  instelling in het beheer **Kassa › Personeel** (`src/components/admin/pos/HorecaLockSetting.tsx`,
  één regel in `src/pages/admin/POS.tsx`); de kassa leest ze met `useKassaLockMinutes` (eigen query,
  lokaal gecachet; ontbreekt de kolom, dan 2 min en afrekenen lijdt er niet onder) in `KassaApp.tsx`.
- `PayDialog.tsx`: (5) snelknoppen gegeven €5/€10 erbij (`cashGivenOptions`); fooi **5 %**, **10 %**,
  **Rond af** (tot de volgende hele euro) naast het vrije veld; bij gelijk delen een kader
  "Persoon k van n · bedrag" met de betaalwijze per persoon, Vorige/**Volgende persoon** en daarna
  "Iedereen gekozen". Fiscaal identiek: nog altijd één afrekening met meerdere betaalmiddelen (UC4119),
  pas verstuurd bij Bevestig — dus kon zonder fiscale wijziging.
- `reportHtml.ts` + `ReportsScreen.tsx`: (6) fooi per medewerker onder zijn omzetregel in het X/Z-rapport
  (bestaande data). Nieuw scherm **Mijn dienst** (`MyShiftScreen.tsx`, ⋯-menu): afgerekend, omzet, fooi
  van de lopende bedrijfsdag via nieuwe RPC `kassa_my_shift` (leest `kassa_report_data` → regel van die
  medewerker; geen rapport, geen fiscaal event, RPT ongewijzigd).
- `KassaHome.tsx`: (8) knop **Toog / snelverkoop** bovenaan in modus Bar (na de wachttijd eerst de PIN via
  `guard()`); menu-item Mijn dienst.
- `CashScreen.tsx`: (9) **Tellen per biljet en munt** (€500 … €0,01) als optionele hulp; vult het totaal
  in, één bedrag intikken blijft mogelijk; fiscaal blijft het één DRAWER_DECLARATION.
- `src/kassa/app/horeca/kassaUx.ts` (nieuw, pure functies): `lastRoundLines`, `tipSuggestions`,
  `cashGivenOptions`, `DENOMINATIONS`/`countTotal`, `LOCK_MINUTES`/`normalizeLockMinutes`.
- `supabase/migrations/20261101230260_kassa_ux_6.sql`: kolom + check, `kassa_my_shift`, patch op
  `kassa_counter_guard` (twee unieke ankers, marker `KASSA-UX-6`, snapshot
  `snapshots.sellqo_20261101_fn_kassa_ux_6`): `move_check`/`move_lines` vanaf een toog toegelaten — enkel
  zonder verstuurde lijnen, `move_lines` enkel volledig; btw-tarief eerst naar ter plaatse (zelfde lus als
  `set_service eat_in`); `move_check` zet `kind='table'`, `service=null`; daarna voert `horeca_apply_one`
  de bestaande verplaatsing uit.
- i18n `kassa.ux6.*`, `kassa.home.tab.shift`, `admin.kassaLock.*` in nl/en/fr/de/uk.

**Security-keuzes**
- `kassa_my_shift`: security definer, `has_tenant_role(tenant_admin, staff)`, medewerker moet bij de zaak
  horen; enkel lezen. Een medewerker kan via een ander `staff_id` de cijfers van een collega opvragen
  (zelfde vertrouwensmodel als het X-rapport, dat iedereen aan de kassa mag maken).
- `kassa_lock_minutes`: bestaande RLS van `horeca_pay_settings` (insert/update enkel tenant_admin).
  "Nooit" kan, met een waarschuwing in het beheer.
- Toog → tab: geen fiscaal event nodig (aan de toog bestaan enkel ontwerp-lijnen); de server weigert het
  zodra er toch iets verstuurd is.

**Gedeelde-paden-waarschuwing**
- Geen storefront-paden. `horeca_pay_settings` is een horecatabel (niet in `storefront-api`).
  `kassa_counter_guard` draait enkel binnen `horeca_apply`; voor niet-toog-rekeningen verandert er niets
  (vroege `return null` vóór de patch).
- `src/pages/admin/POS.tsx` (beheer): één kaart extra in het tabblad Personeel.

**Verificatie**
- SQL: `scripts/gks/sql/run.sh` groen (zie KASSA-RECHTEN-1), met o.a. toog → "Piet" (kind table, 6 % → 12 %),
  toog bij bestaande rekening (alles verhuist, toog sluit), half verplaatsen geweigerd, `kassa_my_shift` =
  staff-regel van `kassa_report_data`, andere zaak/onbekende medewerker geweigerd, vergrendeltijd default 2
  en enkel 0/1/2/5/10. Ankers tegen de live definitie gecontroleerd (read-only).
- Vitest: `kassaUx6.test.ts` (8) en `kassaUx6Ui.test.tsx` (3: fooi-knoppen + contant, per persoon,
  PIN-scherm voorgekozen na inactiviteit maar niet na Wissel) — groen. **Nieuwe testbestanden → aan de
  Vitest-stap in `.github/workflows/ci.yml` toevoegen.**
- Harnas: nieuw scenario `scripts/harness/scenarios/kassa-rechten` (ober Tom; hergebruikt de data van
  kassa-home; `../../print` gemockt omdat `qr.js` in deze sandbox ontbreekt). Screenshots 390 en 1280
  bekeken: schildjes + PIN-venster, menu met Herhaal, herhaalde lijnen, vegen + Ongedaan maken, opmerking
  bewaard bij Sluiten, schrappen-bevestiging, toog op naam, afrekenen met fooi/€50/€100, per persoon,
  Mijn dienst, kas tellen (2×€50 + 7×€2 + 3×€0,50 = 115,50 in het veld), Bar met toogknop. Geen horizontale
  overloop (0 px), geen console-fouten.
- PIN-scherm met voorgekozen naam: enkel in vitest gecontroleerd, niet in het harnas (dat draait met idleMs 0).

**Bewust ongemoeid / Vervolg**
- Niet aangeraakt: keukenbonbord/StationViews/kitchenModel/useKitchenBoard/printen (KEUKEN),
  RequestInbox (API), attendance/inklokken (RAPPORT), gangen/course, `KASSA_SW_VERSION`.
- Per persoon contant: het wisselgeld blijft voor het totaal contant (één afronding over de som, PAY-02);
  geen wisselgeld per persoon getoond, om geen bedragen te tonen die niet met het ticket kloppen.
- In modus Bar vergrendelt de kassa niet bij inactiviteit (bestaand, KASSA-UX-3); een toogverkoop daar
  vraagt na de wachttijd wel eerst de PIN.
- Ongedaan maken na vegen = nieuwe lijn (nieuwe id), niet het terugdraaien van de oude; prijs komt van de server.

**Changelog (NL)**
- Titel: Sneller en veiliger werken aan de kassa
- Beschrijving: Je herhaalt een ronde met één tik, haalt een weggeveegde lijn terug, kiest fooi met 5 %,
  10 % of afronden en rekent bij gelijk delen persoon per persoon af. Na een pauze staat je naam al klaar,
  je stelt zelf in na hoeveel minuten de kassa vergrendelt, en in "Mijn dienst" zie je je omzet en fooi van vandaag.

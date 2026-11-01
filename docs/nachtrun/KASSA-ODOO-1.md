# KASSA-ODOO-1 — Z-rapporten van SellQo Kassa naar Odoo — 1 november 2026

Branch `night-odoo` (nachtrun 1-2 nov). Niets gepusht, gedeployed of naar DB/Odoo geschreven.

## Root cause

- `supabase/functions/sync-odoo-invoices/index.ts` boekt enkel `invoices` en `credit_notes`
  (`pagedIds`, r. 621-640). `sync-odoo-orders` haalt orders UIT Odoo (pull, `sale.order`), kiest
  geen dagboek of klant. Geen enkele functie leest `kassa_reports`, `pos_transactions` of
  `check_payments` (grep `supabase/functions` op `kassa_reports`: 0 treffers vóór deze batch).
- Kassaverkoop maakt geen factuur of order (`usePOS.ts` r. 380 `p_order_id: null`; `horeca_pay`
  in `20261024160000_tafel_3_counter_cash_reports.sql` schrijft `pos_transactions` +
  `check_payments`). Dagontvangsten van de kassa kwamen dus nooit in Odoo.
- Bron voor de boeking: `kassa_reports` (kind 'Z', append-only, trigger `kassa_reports_guard`).
  `data.vats` = `[{rate, gross_cents, vat_cents, net_cents}]`, bevroren door `kassa_report_data`
  (zelfde migratie r. 881-967): btw per betaling en tarief `round(gross × t / (100 + t))`, opgeteld.
  Live nagekeken: 1 Z in productie (Café De Wissel, demo), vorm klopt.

## Businessregels (toetsbaar)

| # | Regel | Waar | Test |
|---|---|---|---|
| R1 | Eén Z = één Odoo-boeking. `out_invoice`, of `out_refund` als het totaal van de Z negatief is (alle bedragen omgedraaid). Naam `Z-<jaar bedrijfsdag>-<Z-nr 5 cijfers>`, factuurdatum = bedrijfsdag, `ref` = `<verzamelklant> — Z <nr> (<dd-mm-jjjj>)`. | `planZBooking`, `zMoveName` | "live Z van 30-10", "retourdag" |
| R2 | Omzet per btw-tarief, hoeveelheid 1 per regel. Btw > 0: BRUTO met de prijs-inclusieve code op **exacte naam** "21% incl." / "12% incl." / "6% incl." (+ `amount`, `type_tax_use=sale`, `price_include_override=tax_included`). 0%: netto met exclusieve code "0%". Enkel 21/12/6/0 aanvaard; elk ander tarief = Z geweigerd. | `planZBooking`, `findTax` in index.ts, `parseZRates` | "0%", "ongeldige Z" |
| R3 | De Z-btw is som(half-up per ticket); Odoo rondt per regel af. Eén regel per tarief geeft half-up(som) en wijkt vaak enkele centen af (300 koffies van €2,60: 37 cent). Daarom wordt de omzet van een tarief verdeeld over een restregel + m gelijke regels "btw-afronding per ticket" zodat Σ half-up(regel) = Z-btw en Σ regels = Z-bruto. Geen regel op een exacte halve cent. Max. 400 regels per tarief (elke regel draagt ≤ ½ cent: een verschil van E cent vraagt ≥ 2E regels; 1.000 koffies = 250 regels). Lukt het niet, dan één regel per tarief → R5 houdt het concept tegen. | `splitGrossForOdoo` | "300 koffies", "brute kracht 1.500 dagen", "verdeling past niet" |
| R4 | Fooien zijn geen omzet en worden niet geboekt. Betaalwijzen, fooien, afronding contant, kas in/uit, annulaties en correcties enkel als info in `narration`. **Geen betalingen** in Odoo. | `buildNarration` | "fooien, betaalwijzen en afronding" |
| R5 | Concept maken → teruglezen → vergelijken: totalen (`amount_untaxed/tax/total`) én per tarief (maatstaf = Σ `price_subtotal` van de productregels per btw-code, btw = Σ `balance` van de btw-regels, teken volgens move_type), aantal regels, geen onbekende btw-codes (fiscale positie), geen andere regels met een bedrag (afronding/korting). Pas bij volledige gelijkheid `action_post` (als `odoo_auto_post` aan). Anders concept laten staan, log 'failed', melding `integrations` / `integration_error`, dedupe `odoo_pos_z_mismatch:<rapport-id>`. Andere fouten: dedupe `odoo_pos_z_failed:<rapport-id>`; dagboekfout: `odoo_pos_z_journal:<dagboek-id>`. | `compareMove`, `syncTenantZ` | "afwijking in Odoo", "verwisseling tussen tarieven" |
| R6 | Idempotent. `odoo_pos_z_sync_log` heeft een unieke index (tenant_id, kassa_report_id) voor pending/synced/skipped: claim vóór de Odoo-create. Een claim ouder dan 30 min = onderbroken run → 'failed', volgende run probeert opnieuw. Eén logregel per Z: een nieuwe poging zet de laatste 'failed'-rij voorwaardelijk terug op pending (`attempts` + 1), zodat een blijvende fout geen rij per uur bijmaakt. Een Odoo-boeking met dezelfde naam + dagboek + move_type wordt hergebruikt (crash na create), **enkel** als partner en datum kloppen; anders weigeren zonder iets te wijzigen. Nooit-geprobeerde Z's eerst, max. 20 per tenant per run, tijdsbudget 100 s. | `syncTenantZ` | "tweede run doet niets", "crash na het aanmaken", "verse/verlopen claim", "andere klant" |
| R7 | Lege Z (geen tarief met bedrag) = log 'skipped', niets in Odoo. | `planZBooking.empty` | "lege Z" |
| R8 | Nooit: `tenants.is_demo` (ook geen proefrun), Z's vóór `pos_z_sync_from`, Z's met `data.historical_import`, tenants met `pos_z_sync_enabled` uit (standaard) of `odoo_sync_enabled` uit, zonder startdatum. Een dagboek dat een andere tenant op dezelfde Odoo (url + db) als factuur- of kassadagboek gebruikt = run geweigerd. | index.ts, `syncTenantZ`, `journalTakenByOther` | "standaard uit", "lege/historische/vóór startdatum", "dagboek van een andere winkel" |
| R9 | `dryRun: true` schrijft niets: geen claim, log, melding, partner of Odoo-create/post. Leest Odoo wel (dagboek, btw-codes, bestaande boeking). Met `tenantId` mag een proefrun ook een tenant met de schakelaar uit bekijken (standaard laatste 31 dagen). | `syncTenantZ` | "proefrun" (assert: enkel selects) |
| R10 | Klant = verzamelklant `"<channel_aliases.pos_z of 'Kassaverkopen'> — <winkelnaam>"`, gecachet in `channel_partner_ids.pos_z` (zelfde mechanisme als de kanaalklanten van sync-odoo-invoices; sleutel `pos_z`, niet `pos`, want `pos` is een orders.sales_channel). Het gecachete id wordt enkel gebruikt als die partner nog bestaat én zo heet. Dagboek = `pos_z_journal_id`, leeg = `odoo_journal_id`; moet een verkoopdagboek zijn en de opgeslagen naam dragen. | `syncTenantZ` | "echte run" |

## Uitgevoerd

| Bestand | Wat |
|---|---|
| `supabase/functions/_shared/odooPosZ.ts` (nieuw) | Pure rekenregels (half-up, verdeling, plan, vergelijking) + `syncTenantZ` met ingespoten DB en Odoo (testbaar). Versie `KASSA-ODOO-1`. |
| `supabase/functions/sync-odoo-pos-z/index.ts` (nieuw) | HTTP: GET = `{ok, version:"KASSA-ODOO-1"}`; POST enkel cron/service (`denyUnlessCron`, x-cron-secret uit internal_config). Body `{tenantId?, dryRun?, fromDate?, reportIds?, maxPerRun?}`. Odoo-API met 30 s time-out per aanroep. |
| `supabase/functions/manage-odoo-connection/index.ts` | Additief: `claimed_by_other_tenant` telt ook `pos_z_journal_id` van andere winkels. `select('*')` zodat het ook vóór de migratie werkt. |
| `supabase/migrations/20261101230500_kassa_odoo_1.sql` | 4 kolommen op `tenant_odoo_settings` (`pos_z_sync_enabled` default false, `pos_z_sync_from`, `pos_z_journal_id/_name`) + tabel `odoo_pos_z_sync_log` met claim-index en RLS. |
| `supabase/migrations/20261101230501_kassa_odoo_1_docs.sql` | Helpartikel `kassa-naar-odoo` (tenant, /admin/connect, categorie Facturatie & Boekhouding), `on conflict do nothing`. |
| `supabase/migrations/20261101230502_kassa_odoo_1_cron.sql` | Cron `sync-odoo-pos-z-hourly` om :47. |
| `src/components/admin/accounting/OdooAccountingSettings.tsx` | Nieuwe kaart "Kassa-omzet naar Odoo": schakelaar (standaard uit; aanzetten vult vandaag in als startdatum), startdatum, kassadagboek ("zelfde als verkoopdagboek" = standaard), regeluitleg, laatste 5 Z's uit de log, eigen Opslaan. Kanaal `pos` verschijnt bij de kanaalnamen zodra de schakelaar aan staat. |
| `src/hooks/useTenantOdooSettings.ts` | Type uitgebreid met de 4 velden. |
| `src/i18n/locales/{nl,en,fr,de,uk}.json` | `admin.odooPosZ.*` (20 keys) + `admin.odooChannels.channels.pos`. |
| `supabase/functions/_shared/odooPosZ.test.ts` (nieuw) | 11 deno-tests rekenwerk. |
| `scripts/promo-compare/odooPosZ.test.ts` (nieuw) | 11 deno-tests runner tegen nep-DB (met claim- en dedupe-index) en nep-Odoo. |

**Cron-keuze:** actief, maar onschadelijk by design: de functie selecteert enkel tenants met
`pos_z_sync_enabled = true` (default false) + `odoo_sync_enabled` + startdatum. Zonder schakelaar =
één lege SELECT per uur. Voordeel: na het aanzetten in de admin is er geen tweede handeling die
vergeten kan worden. Wie de cron nog niet wil: dat ene bestand later draaien.

## Security-keuzes

- `odoo_pos_z_sync_log`: RLS aan; SELECT voor platform_admin en `tenant_admin`/`accountant` van de
  eigen winkel (patroon `stripe_payouts`); geen INSERT/UPDATE/DELETE voor clients (revoke all,
  grant select); schrijven enkel service_role.
- `tenant_odoo_settings`: bestaande RLS (schrijven tenant_admin/accountant). De nieuwe kolommen
  zijn niet gevoelig (vlag, datum, dagboek-id). Geen storefront-pad leest deze tabel.
- Edge function: geen gebruikersauth, enkel `x-cron-secret` of service-key (`denyUnlessCron`).
  Een tenant kan de functie dus niet zelf triggeren; GET geeft enkel de versie.
- Odoo-URL via `assertValidOdooUrl`, key via `decryptOdooKey` (zelfde als de andere Odoo-functies).
- (Review 1) Trigger `tenant_odoo_settings_pos_z_guard` (SECURITY INVOKER): `pos_z_enabled_at` en
  `pos_z_backfill_*` zijn voor clients alleen-lezen. RPC's `odoo_pos_z_backfill_count`,
  `odoo_pos_z_confirm_backfill`, `odoo_pos_z_accept`, `odoo_pos_z_retry`: SECURITY DEFINER,
  `search_path ''`, rolcheck via `odoo_pos_z_can_manage` (platform_admin of tenant_admin/accountant
  van die winkel; zelf niet uitvoerbaar door clients), execute enkel voor `authenticated`.

## Gedeelde paden

- Geen `storefront-api`/`storefront-customer-api`, geen van de vier gedeelde storefront-tabellen.
- `sync-odoo-invoices` en `_shared/odooBooking.ts` NIET gewijzigd. Wel gedeeld: dezelfde
  verkoopdagboeken en `channel_partner_ids` op `tenant_odoo_settings`. De Z-sync voegt de sleutel
  `pos` toe (read-modify-write, hetzelfde patroon als `ensureChannelPartner`; een gelijktijdige
  factuursync die een nieuwe kanaalklant aanmaakt kan theoretisch een sleutel verliezen → wordt
  bij de volgende run opnieuw opgezocht op naam, geen dubbele partner want `findPartner` op naam).
- `manage-odoo-connection`: enkel de berekening van `claimed_by_other_tenant` uitgebreid.
- `src/kassa/` niet aangeraakt.

## Verificatie

- `deno check` (import map /tmp/im_real.json, `--node-modules-dir=none`): sync-odoo-pos-z,
  _shared/odooPosZ.ts, manage-odoo-connection → exit 0.
- `deno test` odooPosZ.test.ts (11) + scripts/promo-compare/odooPosZ.test.ts (21, na review 1) +
  odooBooking.test.ts (6) → alle groen (zie eindrapport voor de cijfers).
- Trigger en RPC's op een lokale Postgres 16 als rol `authenticated` (zie Review 1, punt 1 en 4).
- Migraties twee keer na elkaar gedraaid op een lokale wegwerp-Postgres 16 met stubs → idempotent,
  claim-index weigert een tweede pending/synced, laat meerdere failed toe; cron 1×, doc 1×.
- `node scripts/i18n-parity.mjs` → volledige pariteit (5 talen, 10900 keys), exit 0.
- `npx eslint` op alle gewijzigde/nieuwe bestanden → 0 problemen (baseline OdooAccountingSettings: 0).
- `npx tsc --noEmit -p tsconfig.app.json` (volledig, na review 1) → exit 0, 0 fouten. (De eerste
  twee pogingen vóór review 1 werden door de sandbox OOM-gekild, exit 137.)
- `useTenantOdooSettings.upsert`: payload `as never` tot Lovable `types.ts` regenereert (de
  `pos_z_*`-kolommen bestaan nog niet in de gegenereerde types).
- Niet gedaan (kan niet in de nachtrun): echte Odoo-proefrun, UI op 390/1280 px.

## Review 1 → fixes (commit na e28df7e)

| # | Punt | Fix | Bewijs |
|---|---|---|---|
| 1 HOOG | Startdatum | UI: aanzetten = vandaag in **Europe/Brussels** (`Intl`, niet UTC). Een dag vóór het aanzetten (of vóór een eerder bevestigde dag): eerst RPC `odoo_pos_z_backfill_count` (Z's vanaf die dag die nog niet geboekt/overgeslagen/aanvaard/nagekeken zijn, zonder historische), `window.confirm` met dat aantal, dan RPC `odoo_pos_z_confirm_backfill(tenant, from, count)` die weigert als het aantal intussen veranderde. **Server:** trigger `tenant_odoo_settings_pos_z_guard` zet `pos_z_enabled_at` bij het aanzetten, zet `pos_z_enabled_at`/`pos_z_backfill_*` terug bij elke rechtstreekse client-schrijfactie (current_user authenticated/anon), weigert `pos_z_sync_from < least(Brusselse dag van pos_z_enabled_at, pos_z_backfill_from)` en wist de bevestiging bij uitzetten. De functie controleert hetzelfde nog eens (tweede slot) en negeert `fromDate` uit de body bij een echte run. | Lokale Postgres 16 als `authenticated`: client-backfill teruggezet, verleden geweigerd, telling 2 (historische niet), bevestiging met fout aantal geweigerd, juist aantal ok + `confirmed_by`, uitzetten wist, opnieuw aan met verleden geweigerd. Deno-test "review 1.1". |
| 2 | Compare-and-swap | Vrijgave van een verlopen claim: `.eq(sync_status,'pending').eq(created_at, gezien).eq(attempts, gezien)` + `select('id')`; geen rij terug = andere run, dan `busy`. failed→pending: `.eq(sync_status,'failed').eq(attempts, gezien)`. | Tests "review 1.2" (twee scenario's met een run die er tussenkomt). |
| 3 | Winkelfouten melden | `notifyTenant`: dedupe `odoo_pos_z_tenant:<soort>:<Brusselse datum>` voor geen verbinding, geen dagboek, dagboek van een ander, dagboekfout, ontbrekend aanzetmoment, onbevestigde startdatum. Eén melding per soort per dag; een nieuwe dag = nieuwe melding. | Test "review 1.3" (2 meldingen over 3 runs op 2 dagen). |
| 4 | Backoff, aanvaarden, notitie | Eén logregel per Z met `attempts`. Pogingen 1-3 elke run, 4-9 hoogstens één per 24 u (`finished_at`), bij 10 `needs_review` + melding `odoo_pos_z_needs_review:<id>`, daarna niets meer. Ongeldige Z = meteen `needs_review`. RPC `odoo_pos_z_accept(log, notitie)` (tenant_admin/accountant/platform, notitie verplicht, logt `accepted_by/at/note`, status `accepted` = afgehandeld) en `odoo_pos_z_retry(log)` (needs_review → failed, attempts 0). Knoppen **Aanvaarden** en **Opnieuw proberen** in "Laatste Z-rapporten", met de foutmelding; de lijst toont ook alle mislukte/na te kijken Z's (niet enkel de laatste 5). Notitie bij exact=false: "pas de regels aan … of boek deze Z apart met de hand en aanvaard ze daarna" (een inclusieve btw-code laat geen los btw-bedrag toe). | Test "review 1.4" (tijdlijn van 10 pogingen, retry, accepted); lokale SQL: accept zonder notitie geweigerd, client mag de log niet schrijven, ander account "geen toegang". |
| 5 | DB-last | Eerst `kassa_reports` met enkel `id, report_no, booking_date` + de lichte log, anti-join in het geheugen, `data` pas voor de batch (max. 20) via `.in('id', …)`. Eén Z per dag per zaak, dus enkele honderden lichte rijen per jaar; een SQL-anti-join-RPC is pas nodig bij veel meer. | Code (`loadReportIds`, `loadReportsData`). |
| 6 | Tijdsbudget, volgorde | `guardOdoo` kijkt vóór elke Odoo-aanroep op de klok; een `DeadlineError` telt niet als poging (attempts terug, geen melding, status `deferred`). index.ts doet stap 1 (zonder Odoo) voor alle tenants, sorteert op de oudste open Z en logt pas in Odoo waar er werk is. | Test "review 1.6". |
| 7 | Volgorde verdeling | Eerst voor alle m een oplossing met de rest in het teken van de omzet, pas daarna één met omgekeerd teken. | Test "review 1.7": 50 … 2000 cent, ±1/±2 cent verschil: nooit een regel ≤ 0. |
| 8 | Herpoging, URL, partner | Eerst de `odoo_move_id` uit de log lezen (`getMove`, ongeacht dagboek), enkel hergebruiken als naam, soort, klant en dag kloppen; anders weigeren. `journalTakenByOther` filtert op db en vergelijkt de URL genormaliseerd (hoofdletters, slash, :443). Gecachete partner enkel als de naam nog klopt. | Tests "review 1.8" (ander dagboek, geen tweede create; hernoemde partner) en "review 1.3" (URL met hoofdletters en slash). |
| 9 | Kanaalsleutel | `pos_z` (code, UI, i18n `admin.odooChannels.channels.pos_z`). | Test "echte run" (`channel_partner_ids.pos_z`). |

Migratie-timestamps ongewijzigd (230500/230501/230502); de inhoud van 230500 en 230501 is uitgebreid
(niet live gedraaid, dus veilig). Nieuwe statussen in de check en de claim-index: `needs_review`,
`accepted`.

## Bewust ongemoeid / Vervolg

1. **Beslispunt Akke/boekhouder (R3):** de exacte Z-btw vraagt bij drukke dagen met één vaste
   prijs veel regels (1.000 koffies → 250). Alternatieven:
   a. één regel per tarief en Odoo's afronding op het dagtotaal aanvaarden (enkele centen verschil
      met het Z-rapport; de vergelijking moet dan die marge toelaten);
   b. de Z als **boeking in een diversendagboek** (`entry`) met expliciete regels: omzet per tarief
      (maatstaf), btw per tarief (btw-rekening met de juiste roostertags) en een tegenboeking op een
      kas-/ontvangstenrekening. Dan staat de btw exact zoals op de Z in één regel per tarief, maar de
      btw-tags en rekeningen moeten per Odoo ingesteld worden, en het is een ander patroon dan
      sync-odoo-invoices (geen verkoopfactuur, geen verzamelklant).
   Aanbeveling: huidige aanpak houden (exact, zelfde conventie als de facturen); (b) overwegen als de
   boekhouder de regels-verdeling niet wil, na een test op een Odoo-kopie.
2. **Eerste echte run:** proefrun voor één tenant: `net.http_post` naar sync-odoo-pos-z met
   `x-cron-secret` en `{"dryRun":true,"tenantId":"…"}`; daarna één Z met `reportIds` en autoPost
   uit, het concept in Odoo nakijken.
3. **Btw-codenamen niet live nagekeken** in nomadix-bv (sandbox kan Odoo niet lezen). De functie
   faalt duidelijk ("…ontbreekt in Odoo") als "21% incl."/"12% incl."/"6% incl."/"0%" anders heten.
4. **Navigatie (samenhang):** het zijbalk-item SellQo Connect (`/admin/connect`) heeft
   `sidebarTracks: ['webshop']` en `featureKey: 'apiAccess'` (sidebarConfig.ts r. 283). Een zuivere
   horecazaak ziet de Odoo-instellingen dus niet in de zijbalk. Voorstel: een link "Kassa-omzet naar
   Odoo" bij de Z-rapporten in de admin, of horeca toevoegen aan de tracks. Niet gedaan (scope).
5. **Dubbele omzet:** maakt een zaak voor een kassaverkoop ook een SellQo-factuur, dan staat die
   omzet in de Z én als factuur. Gemeld in het helpartikel; technisch niet afgevangen (er is geen
   link tussen factuur en kassaticket).
6. **Waardebonnen/cadeaubonnen** die via een kassaregel met btw verkocht worden, zitten in de Z-omzet
   zoals de kassa ze telt (kassa_report_data). Niet apart behandeld.
7. **Nummering:** Z-boekingen in het gewone verkoopdagboek mengen prefixen met de facturen (zoals
   facturen en creditnota's nu al). Een eigen kassadagboek is aangeraden (UI + helpartikel).
8. **Plan-scope:** geen nieuwe feature-sleutel: valt onder de bestaande Odoo-integratie (die ook
   ongegate is op functieniveau). Niet grandfathered nodig (standaard uit).
9. CI: de twee nieuwe deno-testbestanden toevoegen aan `.github/workflows/ci.yml` (stap "Edge
   functions" voor `_shared/odooPosZ.test.ts`, stap met `import_map.resolve.json` of de
   `_shared`-stap voor `scripts/promo-compare/odooPosZ.test.ts`, die geen import map nodig heeft).
10. `src/integrations/supabase/types.ts` niet bijgewerkt (Lovable regenereert na de migratie); de
    log-query gebruikt tot dan het `as never`-patroon van src/kassa.

## Uitrol (na review, per stap Akke's go)

1. Migratie `20261101230500_kassa_odoo_1.sql` → natrekken: kolommen in
   `information_schema.columns`, `to_regclass('public.odoo_pos_z_sync_log')`.
2. Deploy `sync-odoo-pos-z` + `manage-odoo-connection` → vingerafdruk GET → `KASSA-ODOO-1`.
3. Publish admin (sellqo.app via `deploy_project`), zoeken naar `odooPosZ` in de bundel.
4. `20261101230501_kassa_odoo_1_docs.sql`, daarna `20261101230502_kassa_odoo_1_cron.sql`.
5. Proefrun (dryRun) per tenant vóór iemand de schakelaar aanzet.

## Changelog (NL, voor de hoofdsessie)

- **Titel:** Je kassa-omzet komt nu vanzelf in Odoo
- **Beschrijving:** Zet je bij Odoo Boekhouding "Z-rapporten van de kassa naar Odoo" aan, dan
  boekt SellQo elk afgesloten Z-rapport als één boeking: de omzet per btw-tarief, tot op de cent
  gelijk aan je Z-rapport. Fooien en betalingen worden niet geboekt; wijkt Odoo af, dan blijft de
  boeking een concept en krijg je een melding.
- Type: `feature`.

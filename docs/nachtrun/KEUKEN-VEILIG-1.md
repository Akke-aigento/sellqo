# KEUKEN-VEILIG-1 — wat keuken en bar moeten weten, staat op elke bon — 1 november 2026

Branch `night-keuken` (worktree `/home/claude/sellqo-keuken`). Nachtrun, niet gepusht, niet gedeployed, niets in de DB geschreven.

## Root cause

Elf bevindingen uit de rollenwandeling, elk nagetrokken in de code (en de ankers van de migratie read-only op de live DB):

1. **QR-opmerking enkel op lijn 1** — `horeca_table_request_accept` (`supabase/migrations/20261028120000_qr_rekening_1.sql` r. 257-266) zet de algemene opmerking van de gast alleen op de eerste lijn (`'note', case when v_first …`). `send_round` (`horeca_apply_one`, `20261024130000_tafel_1_checks.sql` r. 636-647) maakt één bon per post en vult `kitchen_tickets.note` niet. Is lijn 1 een drankje, dan staat "allergie noten" op de barbon en ziet de keuken het nooit. **Bevestigd.**
2. **Lijnopmerkingen grijs en klein** — `KitchenBoard.tsx` toonde `detail` als `text-sm text-muted-foreground`; de barbon zelfs als grijze suffix. Op de printbon (`horecaPrint.ts`) een gewone ingesprongen regel; de algemene opmerking stond onderaan. **Bevestigd.**
3. **Geen allergenen op de bon** — `products.allergens` en `product_addon_options.allergens` (ALLERGEN-1/2) kwamen nergens in `kitchen_tickets.items`, `order_items`-select of print. **Bevestigd.**
4. **Opmerking valt weg naast een variant + set_note-bug** — `cardFromTicket` en `horeca-print` deden `detail: i.variant ? variant : i.note ? note : null`: met een variant verdween de opmerking. En `set_note` in `horeca_apply_one` zette `course = nullif(cmd ->> 'course','')::integer`; de kassa (`CheckScreen.tsx` r. 378) stuurt nooit `course` mee, dus elke opmerking **wiste de gang**. **Beide bevestigd.** (In de kassa zelf bestaat geen variantkeuze; het formaat is een extra-groep — daar viel niets weg.)
5. **Eén tik zet alle bonnen op bezig** — `KassaHome.tsx` r. 122 `busy: setStatus.isPending` en `Kitchen.tsx` `busy={setStatus.isPending}`: één mutatie blokkeerde elke knop. **Bevestigd.**
6. **Bonbord peilt elke 10 s** — `useKitchenBoard.ts` r. 23, plus `refetchIntervalInBackground: true` (peilde ook met het scherm uit). **Bevestigd.**
7. **Bar: 3 tikken** — `NEXT_STATUS` new→preparing→ready→done voor elke post, ook de bar (`StationViews.tsx`). **Bevestigd.**
8. **Geluid standaard uit** — enkel op `/admin/keuken` (`Kitchen.tsx`: `localStorage === '1'`, standaard false). In de kassa stond het al standaard aan (`KassaApp.tsx` `readFlag(KASSA_SOUND_KEY, true)`). **Deels bevestigd.**
9. **"Te laat" enkel voor weborders** — `late = card.requestedTime ? … : false`; kassa-, QR- en tafelbonnen hebben geen gekozen tijd en werden nooit rood omrand. **Bevestigd.**
10. **Printerfouten stil** — `print_jobs.status = 'failed'` (cloudprnt `markDone`) en `printers.last_seen_at` waren enkel zichtbaar in Kassa › Bon & printers. **Bevestigd.**
11. **"Klaar" naar de zaal** — bestaat al: MELDING-1 stuurt `ticket_ready` als push (trigger `horeca_device_push_tr`, edge `horeca-device-push`) en `useKassaSignals` toont een melding + belletje op de open kassa. Ontbrak: een blijvend teken op de tafel zelf. **Deels bevestigd.**

## Uitgevoerd

**Migratie `supabase/migrations/20261101230200_keuken_veilig_1.sql`** (patcht live functies via `pg_get_functiondef` + `replace`, elk anker precies 1×, idempotent via marker `KEUKEN-VEILIG-1`; oude definities in `ops.keuken_veilig_1_prev_functions`):
- nieuw `public.horeca_line_allergens(product_id, addons)` → gesorteerde jsonb-array EU-codes (product ∪ gekozen extra's); execute ingetrokken voor public/anon/authenticated (enkel de definer-functies roepen hem aan).
- `horeca_apply_one` / `send_round`: elke bon van de ronde krijgt `note` = de algemene opmerking van de geaccepteerde QR-aanvraag(en) waarvan de lijnen in deze ronde zitten (`table_requests.line_ids && v_ids`), exact dezelfde tekst als op lijn 1; elke regel in `items` krijgt `allergens`.
- `horeca_apply_one` / `set_note`: zonder `course` in het commando blijft de gang staan.
- `horeca_pay` (toogbonnen): `allergens` per regel.

**Frontend**
- `src/components/admin/kitchen/kitchenModel.ts` — `KitchenItem` krijgt `note` en `allergens` (variant en opmerking apart; de QR-opmerking wordt bij lijn 1 niet herhaald als ze al op de bon staat); `isLate` (elke bon; zonder gekozen tijd na 20 min, bar na 10 min); `BAR_NEXT_STATUS`/`BAR_PREV_STATUS`, `flowNext`/`flowPrev`; `readyCheckIds`; `checkId` op de kaart; webshop-allergenen via `order_items.products(allergens)`.
- `KitchenBoard.tsx` — algemene opmerking groot en bovenaan (amber kader, icoon), lijnopmerking vet in kleur (»), allergenen als rode labels (scherm keuken én bar); rode rand voor elke te late bon; `flow="bar"` = één knop **Klaar** (new→done); `KitchenColumns` krijgt `busyKeys` i.p.v. `busy`.
- `useKitchenBoard.ts` — interval-parameter (`BOARD_POLL_FAST` = 3 s voor keuken-/barscherm, dashboard blijft 10 s), `refetchIntervalInBackground: false`, afgewerkte niet-webshopbonnen ouder dan 12 u niet meer opgehaald, `busyKeys` per bon via `useMutationState`, fout = toast i.p.v. het hele bord terugzetten.
- `printTicket.ts` + `kitchenBoardUtils.ts` — browserbon: opmerking bovenaan met kop, lijnopmerking vet, allergenen omkaderd; `allergenName()` uit `admin.allergens.*`.
- `src/kassa/app/screens/KassaHome.tsx` — snel peilen enkel als er bonnen in beeld staan (Keuken, Bar, of Binnenkomend naast het zaalplan); `busyKeys`; printerbanner; `readyChecks` naar het zaalplan.
- `StationViews.tsx` — barbonnen met `flow="bar"`; "terug" in de afgewerkte lijst zet de bon op nieuw.
- `TablesScreen.tsx` — tafel met een klare bon toont "Klaar om op te dienen" in de badge (plan en lijst).
- `src/pages/admin/Kitchen.tsx` — 3 s, `busyKeys`, geluid standaard aan (`readFlag(SOUND_KEY, true)`, de schakelaar blijft), autoplay-hint "tik één keer op het scherm" zolang de browser audio tegenhoudt (de hint is zelf een knop die het belletje speelt), printerbanner.
- `src/lib/ding.ts` — `audioBlocked()`.
- `src/components/horeca/printHealth.ts` (+ test) en `PrintHealthBanner.tsx` — elke 30 s (enkel zichtbaar scherm, enkel zaken met een actieve printer): mislukte bonnen (3 u), bonnen > 90 s in de wachtrij, actieve printers > 2 min stil. Rode balk met "Gezien" (per toestel, tot er een nieuw probleem is).
- i18n: `admin.kitchen.{status_failed, note_title, allergens_title, action_bar_done, sound_tap_hint, print_health_title|failed|stuck|offline|hint|seen}` en `kassa.tables.readyBadge`, in nl/en/fr/de/uk.

**Edge**
- `supabase/functions/_shared/horecaPrint.ts` — productiebon: algemene opmerking bovenaan tussen `****`-lijnen met `!! OPMERKING !!`; lijnopmerking `>> IN HOOFDLETTERS`; allergenen `!! ALLERGENEN: GLUTEN, MELK`; nieuwe teksten (`noteTitle`, `allergens`, `allergen` met de 14 codes) in de 5 talen.
- `supabase/functions/horeca-print/index.ts` — variant en opmerking apart, allergenen uit `items` en (webshop) uit `products(allergens)`; versie `KEUKEN-VEILIG-1`.

**Harnas** — `scripts/harness/scenarios/kassa-home`: bonnen met QR-opmerking, lijnopmerking, allergenen, te laat en klaar; printerwaarschuwing; stap "8b-bar-na-klaar"; `qr.js` gestubd (ontbreekt in de gedeelde node_modules).

## Security-keuzes

- Geen RLS, policies of grants op tabellen gewijzigd. `horeca_line_allergens` zonder execute voor public/anon/authenticated; de gepatchte functies blijven `security definer` met `search_path ''` (ongewijzigd).
- De printerbanner leest `printers` (kolom-grant zonder `token_hash`) en `print_jobs` met de bestaande select-policies (`get_user_tenant_ids`).
- `kitchen_tickets.note` bevat nu ook de QR-opmerking + gastnaam: dezelfde gegevens stonden al op `check_lines.note` en de bon is enkel leesbaar voor de eigen zaak.

## Gedeelde-paden-waarschuwing

- `storefront-api` / `storefront-customer-api`: **niet geraakt**. Geen gedeelde storefront-tabellen gewijzigd.
- `horeca_apply_one` en `horeca_pay` bedienen kassa, QR en toog: de patch is additief (één extra kolom in een insert, één extra sleutel in `items`, een `case` in `set_note`). Fiscale events en FDM-berichten blijven ongemoeid (send_round ondertekent zelf niets; bonnen zijn geen fiscaal document). `KASSA_SW_VERSION` niet verhoogd.
- `_shared/horecaPrint.ts` wordt ook door `horeca-receipt-mail` gebruikt: enkel productiebon-code en extra teksten; betaalbewijs ongewijzigd (test groen).
- `useKitchenBoard` bedient ook het dashboard (`Dashboard.tsx`, `HorecaCards`): interval daar ongewijzigd 10 s; de nieuwe `.or()`-filter laat alle webshopbonnen staan (die bepalen de orderstatus).

## Verificatie

- Lokale PostgreSQL 16 (`scripts/gks/sql/run.sh`, SETUP_ONLY) + migratie 2× (idempotent, tweede keer "al gepatcht"): `scripts/gks/sql/test_keuken_veilig.sql` 11/11 `t` (opmerking op beide bonnen, allergenen product+extra, gang blijft bij set_note, expliciete course werkt, geen note zonder QR-aanvraag). Bestaande kassatests na de patch: tafel 32/32, pay 62/62, tafel3 89/89, kaart 49/49, kaart3 33/33, kassa06 26/26, fiscal 5/5, personeel 10/10, heartbeat 5/5 — 0 `f`.
- Ankers read-only op de live DB (1-11, 23:xx): `horeca_apply_one` insert/items/set_note elk 1×, `horeca_pay` items 1×, nog geen marker.
- `npx vitest run src/components/admin/kitchen src/components/horeca` → 24/24. `npx vitest run src/kassa` → 257/258 tests groen; rood = `payDialog.test.tsx`, `print.test.ts`, `preview.test.ts` (kunnen `qr.js` niet laden: pakket ontbreekt in `/tmp/sqtc/node_modules`, staat los van deze batch) en één time-out in `simulator.test.ts` onder geheugendruk (los opnieuw: groen).
- `deno test horecaPrint.test.ts` → 8/8 (nieuwe test: elke taal × 32/42/48 kolommen). `deno check horeca-print/index.ts` → 0.
- `node scripts/i18n-parity.mjs` → volledige pariteit (exit 0).
- `npx eslint` op alle gewijzigde bestanden → 0 fouten (exit 0).
- `tsc`: de volledige `tsc -p tsconfig.app.json` werd 3× door de OOM-killer gestopt (exit 137, parallelle bouwers). Een tsconfig met enkel de gewijzigde ingangen (+ Dashboard/HorecaCards) gaf enkel de twee bestaande `qr.js`-fouten (`src/kassa/print/qr.ts`), niets uit deze batch. **Volledige tsc nog te draaien door de hoofdsessie.**
- Harnas `kassa-home` (390/1024/1280): bekeken — keuken (opmerking bovenaan, »-lijnopmerking, allergeenlabels, rode rand na 24 min), bar (één knop Klaar; na één tik is de bon weg), zaal (tafel 4 "Klaar om op te dienen"), printerbanner.

## Bewust ongemoeid / Vervolg

- **Bar en het ober-signaal**: de bar springt nu van nieuw naar afgewerkt; een barbon komt dus niet meer op "klaar" en geeft geen `ticket_ready`-push/kassamelding. Bewuste keuze (de opdracht: één tik). Wil Akke dat de ober ook voor drank een signaal krijgt: de bartik als twee updates (ready → done) of de trigger ook bij new→done laten melden — apart beslissen.
- **Ober-signaal keuken**: niets nieuws gebouwd buiten de badge op de tafel; MELDING-1 (push + kassamelding) bestond al.
- `/admin/keuken` met post "Bar" gekozen houdt de drie kolommen (keukenflow); enkel de barkolom in de kassa gebruikt de één-tik-flow.
- Allergenen van extra's bij **webshoporders** niet (enkel van het product; `order_items.addons` draagt geen option_id-garantie). Bij kassa/QR/toog wel.
- Op een **GKS-kassa** (FDM) drukt `horeca_print_tr` geen keukenbonnen af (kassa doet dat zelf, nog niet gebouwd): daar enkel scherm.
- `RequestInbox.tsx`, `CheckScreen.tsx` en andere KASSA-bestanden niet aangeraakt. `horeca_table_request_accept` niet gewijzigd (de QR-opmerking blijft ook op lijn 1 voor de bediening).
- Nieuw vitest-bestand voor CI: `src/components/horeca/printHealth.test.ts` (en de bestaande `kitchenModel.test.ts`/`printTicket.test.ts` als die nog niet in de Vitest-stap staan).
- **Volgorde uitrol**: (1) edge `horeca-print` + `horeca-receipt-mail` deployen (gedeelde `_shared/horecaPrint.ts`; vingerafdruk `GET horeca-print` → `version: "KEUKEN-VEILIG-1"`), (2) migratie 20261101230200, (3) frontend publiceren + nieuwe app-build. De volgorde 1↔2 is niet kritisch (oude horeca-print negeert de nieuwe sleutels).
- Na de migratie natrekken: `select position('KEUKEN-VEILIG-1' in pg_get_functiondef('public.horeca_apply_one'::regproc)) > 0;` (idem `horeca_pay`) en `select count(*) from ops.keuken_veilig_1_prev_functions;` = 2.
- doc_articles/newsletter: niet geschreven (hoofdsessie).

## Vervolg in dezelfde batch — KEUKEN-VEILIG-1b (beslissingen van de hoofdsessie, 1-11)

1. **Bar-signaal**: de ober krijgt ook voor drank "klaar".
   - Migratie `supabase/migrations/20261101230210_keuken_veilig_1b_bar_ready.sql`: patcht `horeca_device_push_tr` (één anker, live 1× nagetrokken, marker `KEUKEN-VEILIG-1b`, vorige definitie in `ops.keuken_veilig_1b_prev_functions`). `ticket_ready` gaat nu ook uit als een bon van een **barpost** van nieuw/in bereiding rechtstreeks naar afgewerkt springt. Stond de bon eerst op klaar (`old.status = 'ready'`), dan geen tweede melding. Keukenbonnen die afgewerkt worden zonder klaar: geen melding (ongewijzigd).
   - Kassamelding (`src/kassa/app/useKassaSignals.ts`): leest eenmalig de barposten (`prep_stations.kind = 'bar'`) en vraagt `status = ready` **of** (`status = done` en barpost). Een afgewerkte barbon meldt enkel als hij op dit toestel nooit als klaar voorbijkwam (geen dubbele melding). Test uitgebreid in `src/kassa/app/__tests__/signals.test.tsx`.
   - Lokale SQL-test: `scripts/gks/sql/test_keuken_veilig_1b.sql` (stub van `horeca_device_notify`): barbon in één tik → 1 melding, keukenbon afgewerkt → 0, klaar dan afgewerkt → 1 (niet 2). Migratie 2× gedraaid (idempotent).
2. **Allergenen van extra's bij webshoporders**: kan, want `order_items.addons` bevat de `option_id` (storefront `ChosenAddon`; live nog geen orders met extra's). `useKitchenBoard` haalt enkel bij orders met extra's `product_addon_options(id, allergens)` op (eigen zaak); `horeca-print` (`printOrder`) doet hetzelfde. Versie `horeca-print` → `KEUKEN-VEILIG-1b`. Geen migratie nodig.
3. **/admin/keuken (en Keuken in de kassa) met post "Bar"**: `KitchenColumns` krijgt `flow`; post Bar = één lijst open bonnen (oudste eerst), compacte kaarten met één knop **Klaar**, "terug" in de afgewerkte lijst zet de bon op nieuw. Harnas-stap `9b-keuken-post-bar` (390/1024/1280) bekeken.

**Verificatie 1b**: volledige `npx tsc --noEmit -p tsconfig.app.json` → **exit 0** (nu wel gelukt). `npx vitest run src/components/admin/kitchen src/components/horeca src/kassa` → 331 groen, 1 overgeslagen, 0 rood (qr.js staat intussen in de gedeelde node_modules). `deno check horeca-print` → 0. eslint op de gewijzigde bestanden → 0. Harnas `kassa-home` → exit 0.

**Uitrol (bijgewerkt)**: (1) `horeca-print` + `horeca-receipt-mail` deployen (vingerafdruk `GET horeca-print` → `KEUKEN-VEILIG-1b`), (2) migraties 20261101230200 en 20261101230210, (3) frontend publiceren + app-build. Natrek: `select position('KEUKEN-VEILIG-1b' in pg_get_functiondef('public.horeca_device_push_tr'::regproc)) > 0;`

## Changelog (NL)

**Allergieën en opmerkingen vallen niet meer weg tussen keuken en bar**
Een opmerking van je gast via de QR (bv. een allergie) staat nu op elke bon van die bestelling, ook in de keuken, en opmerkingen en allergenen van je producten staan groot op het scherm en op de afgedrukte bon. Aan de bar werk je een bon af met één tik (de bediening krijgt toch een seintje dat de drank klaar is), te late bonnen kleuren rood en je kassa waarschuwt als een bonprinter niet afdrukt.

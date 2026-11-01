## OBER-ROEPEN-1 — gasten roepen de bediening of vragen de rekening via de QR — 2 november 2026

(+ bonus RESERVATIE-MELDING-1, onderaan.) Branch `night-api`. Contract: `docs/nachtrun/API-CONTRACT.md` §4.

**Root cause**
- Er bestond geen manier om vanaf een gescande tafel de bediening te roepen of de rekening te vragen.
  De kassa had enkel QR-bestellingen (`table_requests`) in Binnenkomend.

**Uitgevoerd**
- `supabase/migrations/20261101230300_ober_roepen_1.sql`:
  - nieuwe tabel `table_calls` (id, tenant, tafel, label, `kind` waiter|bill, `status` open|handled,
    `repeat_count`, `last_called_at`, handled_at/by). Bewust een eigen tabel en geen nieuwe kind op
    `table_requests` (daar zijn `items` verplicht en betekent bevestigen "lijnen op de rekening").
  - `table_call_place(...)` (service_role): idempotent op de oproep-ID; advisory lock per tafel+soort;
    binnen 2 min dezelfde oproep terug (`duplicate: true`, `retry_after_s`); na 2 min en nog open →
    `repeat_count + 1` en opnieuw een melding; max. 100 open oproepen per zaak (`TOO_MANY_REQUESTS`).
  - `horeca_table_call_handle(...)` (authenticated, `has_tenant_role` tenant_admin/staff, staff-check
    zoals `horeca_table_request_reject`); idempotent; `horeca_bump` zodat alle kassa's verversen.
  - trigger `trg_table_calls_device_push` → eigen functie `table_call_push_tr` →
    `horeca_device_notify(tenant, 'qr_request', …, ctx.call)`. MELDING-1's `horeca_device_push_tr`
    blijft ongemoeid; geen nieuw event-type (dus geen wijziging aan de check op `horeca_notify_devices.events`).
- `supabase/migrations/20261101230330_ober_roepen_1_docs.sql`: helpartikel `tafel-oproepen` (/kassa).
- `storefront-api/index.ts`: actie `table_call` (tafel via `resolveTableInput`: QR-token, vrij nummer
  enkel zonder zaalplan; `TABLE_CALL_OFF` als `qr_mode = 'off'`; zelfde standaard 'view' als
  `resolve_domain`), IP-rem 10 per 10 min (HTTP 429 `RATE_LIMITED`), in `CLOSED_SHOP_BLOCKED_ACTIONS`.
  Stempel `QR-STATUS-1` (GET) / `qr-status-1` (header); `event409.test.ts` en `tableCheckPay.test.ts` mee.
- `supabase/functions/_shared/horecaPush.ts` + `horeca-device-push/index.ts` (stempel `OBER-ROEPEN-1`):
  tekst "Tafel 4 roept de bediening" / "Tafel 4 vraagt de rekening" (+ "2e keer") in 5 talen, eigen tag per oproep.
- Kassa (`src/kassa/app/`): `horeca/requests.ts` (`TableCall`, `handleCall`), `horeca/store.ts`
  (transport `calls`, `store.calls`, `callsLoaded`; een fout of ontbrekende tabel blokkeert niets),
  `screens/RequestInbox.tsx` (`CallList`: tafel, soort, hoelang, "n× geroepen", knop **Afgehandeld**),
  `screens/StationViews.tsx` (sectie "Oproepen van tafels" bovenaan Binnenkomend),
  `screens/KassaHome.tsx` (tellers QR-knop en Bar tellen oproepen mee), `useKassaSignals.ts` +
  `KassaApp.tsx` (belletje + toast bij een nieuwe of herhaalde oproep).
- i18n: `kassa.calls.*` (nieuw) en drie bestaande teksten aangepast zodat ze kloppen met wat er nu
  binnenkomt: `deviceAlerts.event.qr_request`, `kassa.bar.empty`, `kassa.bar.emptyNoBar` (5 talen).
- Geen wijziging aan fiscale event-types, FDM-berichten, `fiscal_events` of `KASSA_SW_VERSION`.
  Een oproep raakt geen rekening.

**Security-keuzes**
- `table_calls`: RLS aan, enkel SELECT voor leden van de zaak (`get_user_tenant_ids`), geen anon-rechten,
  schrijven enkel via security-definer-functies. Geen persoonsgegevens in de tabel.
- `table_call_place` enkel service_role; `horeca_table_call_handle` controleert de rol in de zaak.
- Spam: rem per tafel/soort (databank), per zaak (100 open), per IP (edge function), dichte winkel = 423.

**Gedeelde-paden-waarschuwing**
- `storefront-api`: nieuwe actie, niets bestaands gewijzigd. Geen gedeelde tabel geraakt
  (`tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages` ongemoeid).
- `horeca-device-push` / `_shared/horecaPush.ts`: bestaande teksten byte-gelijk (bestaande test groen);
  enkel een extra tak voor `ctx.call` / `ctx.reservation`.
- Kassa-signalen: `useKassaSignals` kreeg een optionele 5e parameter; bestaande aanroepen/tests ongewijzigd.

**Verificatie**
- `deno check` storefront-api + horeca-device-push: exit 0. `_shared/horecaPush.test.ts`: 9/9.
- `qrStatus.test.ts` (table_call: invoer, token → tafel, vrij nummer geweigerd, DB-rem, IP-rem 429, uit).
- `npx vitest run src/kassa/app/__tests__/calls.test.tsx`: 7/7 (store, lijst, Afgehandeld → RPC, fout per oproep, PIN-bewaking).
- `npx vitest run src/kassa`: 265/265 tests groen; 3 testbestanden (payDialog, print, preview) laden
  niet door `qr.js` dat in de sandbox-node_modules ontbreekt — los van deze batch, zelfde op HEAD.
- `tsc -p tsconfig.app.json` volledig: door de sandbox gekild (exit 137, geheugen, parallelle bouwers).
  Afgebakende tsc op alle gewijzigde kassabestanden + hun imports: enkel de 2 bestaande `qr.js`-meldingen.
  **Hoofdsessie: volledige tsc opnieuw draaien.**
- Lint gewijzigde bestanden: 239 vóór = 239 na, zelfde regels; nieuwe bestanden 0.
- `node scripts/i18n-parity.mjs`: volledige pariteit, exit 0.
- Harnas `kassa-home` met twee oproepen (tafel 7 roept 2×, Ter 2 vraagt de rekening): 390, 1024, 1280 px,
  geen horizontale overloop, geen console-fouten, "Afgehandeld" klikbaar. Screenshots:
  `/tmp/harness/ober-roepen-{390,1024,1280}.png`. `shoot.mjs` zelf haalde de 30 s `networkidle` niet
  (eerste vite-lading in de sandbox te traag, en `qr.js` ontbreekt); daarom via `--serve` + eigen
  Playwright-script (tijdelijke qr.js-mock, niet gecommit).

**Bewust ongemoeid / Vervolg**
- Geen instelling "oproepen aan/uit": werkt zodra het QR-menu aanstaat. Wil Akke het per zaak kunnen
  uitzetten (Instelbaar, nooit maatwerk), dan een schakelaar onder Bestellen › QR-menu
  (`fulfillment_settings.qr_calls`). Ook geen feature-sleutel in `pricing_plans.features` (zelfde
  pakket als het QR-menu) — **scope-regel nog te bevestigen door Akke**.
- Een `bill`-oproep sluit niet vanzelf als de rekening afgerekend wordt; de bediening tikt Afgehandeld.
  Na 3 u verdwijnt een open oproep uit de kassa.
- Tafel in het zaalplan krijgt (nog) geen eigen kleur voor een oproep; de oproep staat in Binnenkomend.
- `doc_articles`: `category_id` a0000001-…-0006 overgenomen van qr-tafelrekening; live natrekken.

**Changelog (NL)**
- Titel: Gasten roepen de bediening of vragen de rekening via de QR-code
- Beschrijving: Je gasten tikken op hun tafel-QR om de bediening te roepen of de rekening te vragen.
  Je ziet het meteen op de kassa bij Binnenkomend, met een melding op je toestellen, en tikt op
  Afgehandeld als je langs geweest bent.

---

## RESERVATIE-MELDING-1 — reservatie-aanvragen ook op de toestellen van de zaak — 2 november 2026

**Root cause**
- `reservation_request_place` (`20261030220000_reservatie_2.sql`) maakt al een melding in het belletje
  (`notifications`, category `customers` — geldige enum-waarde —, type `reservation_request`, priority
  `high`, action_url `/admin/bestellen?tab=reservaties`, en `OrderingHub` leest `?tab=`). Via de bestaande
  triggers `notify_push_on_notification` en `trigger_notification_email` gaat die al als push en mail
  naar de zaakvoerder. De meldingen-, push- en mailkant bestond dus al. Wat ontbrak: kassa- en
  posttoestellen (`horeca_notify_devices`, `personal = false`) krijgen geen persoonlijke meldingen.

**Uitgevoerd**
- `supabase/migrations/20261101230320_reservatie_melding_1.sql`: trigger `trg_table_reservations_device_push`
  (na insert, enkel `source = 'online'` en `status = 'requested'`) → `horeca_device_notify(..., 'qr_request', ctx.reservation)`.
  Eigen functie, `reservation_request_place` ongemoeid.
- `horecaPush.ts`: "Nieuwe reservatie-aanvraag" — "4 pers. · 02/11 19:30. Bevestig of weiger." in 5 talen,
  zonder naam van de gast (gedeeld toestel). Link: kassa → /kassa, ander toestel → /admin/bestellen?tab=reservaties.

**Security-keuzes**: geen rechten geraakt; geen naam/e-mail/telefoon in de push.
**Gedeelde paden**: geen. **Verificatie**: `horecaPush.test.ts` 9/9 (alle talen, geen "undefined", juiste link).
**Vervolg**: geen extra mail (de bestaande notificatiemail volgt de meldingsinstellingen van de zaak).

**Changelog (NL)**
- Titel: Nieuwe reservatie-aanvragen ook als melding op je kassa
- Beschrijving: Vraagt iemand online een reservatie aan, dan krijgen je kassa en andere toestellen die
  QR-bestellingen melden ook een melding, met het aantal personen en het uur.

---

## Uitrol (één go, in deze volgorde)

1. Migraties (via Lovable of de connector): `20261101230300_ober_roepen_1.sql`,
   `20261101230310_qr_idemp_1.sql`, `20261101230320_reservatie_melding_1.sql`. Natrekken:
   `select to_regclass('public.table_calls')`, kolom `storefront_carts.converted_order_id`,
   `pg_trigger` op `trg_table_calls_device_push` en `trg_table_reservations_device_push`.
2. Edge functions deployen: **`horeca-device-push`** (eerst: anders tonen oproepen en reservaties de
   oude tekst "QR-bestelling wacht") en **`storefront-api`**. Vingerafdruk: GET → `OBER-ROEPEN-1`
   resp. `QR-STATUS-1`. Vóór de storefront-api-deploy de live stempel vergelijken (verwacht
   `RESERVATIE-2`; anders gaan er andere batches mee).
   Niet nodig: `stripe-connect-webhook`, `storefront-customer-api`.
3. Publish admin (sellqo.app) + nieuwe native build voor de kassa-app (oproepen in Binnenkomend).
4. `20261101230330_ober_roepen_1_docs.sql` (helpartikel) na de publish.
5. CI: `scripts/promo-compare/qrStatus.test.ts` toevoegen aan de deno-stap (ci.yml r. 160) en
   `src/kassa/app/__tests__/calls.test.tsx` aan de Vitest-stap (r. 63).

## STATUS-1 — de gast volgt zijn bestelling: bevestigd, in bereiding, klaar, opgediend — 2 november 2026

Branch `night-api`. Contract voor de storefront: `docs/nachtrun/API-CONTRACT.md` §3.

**Root cause**
- `storefront-api/index.ts` `tableRequestStatus` (QR-REKENING-1) gaf per aanvraag enkel
  pending/accepted/rejected. Na "bevestigd" wist de gast niets meer, terwijl de keuken de voortgang
  al bijhoudt in `kitchen_tickets.status` (`new → preparing → ready → done`, per post en per ronde:
  `round_id` + `station_id`, zie `20261024130000_tafel_1_checks.sql` `send_round`). Voor
  orders (qr_flow = order, afhalen, levering) bestond er geen statusactie voor de gast.

**Uitgevoerd** (enkel `supabase/functions/storefront-api/index.ts`, geen migratie)
- `table_request_status` uitgebreid, additief:
  - oud (`request_id` alleen): zelfde velden en foutcodes + `progress`. `line_ids` wordt intern gelezen
    maar niet teruggegeven (test controleert de exacte sleutels).
  - `request_ids` (max. 20) → `{ requests: [...] }`; `order_id` → `{ order }`; `call_ids` (max. 10,
    OBER-ROEPEN-1) → `{ calls }`. Combineren mag.
- Voortgang per aanvraag: `table_requests.line_ids` → `check_lines` (`round_id`, `station_id`, `state`)
  → `kitchen_tickets` van precies die ronde én post. Een bon van dezelfde ronde voor een andere post
  (lijnen van een collega) telt niet mee.
- Voortgang per order: `kitchen_tickets.order_id`; geen bon = `confirmed` (webshopbonnen ontstaan pas
  bij de eerste klik op het keukenscherm); `orders.status = 'cancelled'` → `cancelled`.
- `stage`: alles `done` → served; alles `ready`/`done` → ready; iets bezig → preparing; enkel `new` →
  queued; alle bonnen geannuleerd → cancelled.

**Security-keuzes**
- Geen nieuwe rechten. Lezen gebeurt met de service role in de edge function, altijd met
  `.eq('tenant_id', tenantId)`, en enkel op de onraadbare ID's die de gast zelf kreeg (aanvraag-,
  order- of oproep-ID). Getest: een aanvraag-ID van een andere tenant komt niet terug; een order van
  een andere tenant geeft `order: null`.
- Wat de gast ziet: status, stationsnaam van de zaak, tijdstip. Geen bedragen per bon, geen andere
  tafels, geen personeelsnamen.

**Gedeelde-paden-waarschuwing**
- `storefront-api` gedeeld met zes custom frontends: het oude antwoord voor `request_id` krijgt één
  sleutel (`progress`) bij; geen sleutel weg of hernoemd. Nieuwe parameters zijn optioneel. Of een
  custom frontend `table_request_status` gebruikt, kon hier niet gelezen worden; een extra sleutel in
  een JSON-object breekt een lezer die enkel de bestaande sleutels gebruikt niet.

**Verificatie**
- `deno check`: exit 0. `qrStatus.test.ts`: oude vorm (exacte sleutels), lijst met voortgang
  (preparing, 2 posten, de vreemde bon niet), order (served), oproepen, andere tenant: allemaal groen.

**Bewust ongemoeid / Vervolg**
- Geen realtime: de storefront pollt (aanrader: elke 10–15 s zolang er iets niet `served`/`rejected` is,
  stoppen als het tabblad verborgen is). Eén oproep haalt alles in één keer (lijst).
- "Opgediend" = keukenbon op afgewerkt (`done`). Er is geen apart "op tafel gezet"-moment in de data.

**Changelog (NL)**
- Titel: Je gasten zien hoe ver hun bestelling staat
- Beschrijving: Na het bestellen via de QR-code ziet je gast of zijn bestelling bevestigd is, in
  bereiding is, klaar is of opgediend werd. Dat volgt vanzelf uit de bonnen op je keukenscherm; je
  hoeft niets extra te doen.

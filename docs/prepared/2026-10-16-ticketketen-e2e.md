# NACHTTEST: end-to-end generale repetitie van de ticketketen (SellQo Speeltuin)

Uitgevoerd op 2026-10-15, tussen 23:33 en 23:45 UTC. Tenant: SellQo Speeltuin `bc18b2e3-dcda-4af1-8203-8f04a16836cd`.
Er is geen code gewijzigd en niets gecommit. Er zijn geen echte betalingen gedaan: alles liep via het gratis pad (100% korting).
Fonske is niet aangeraakt. Nagemeten: 0 nieuwe tickets en 0 gewijzigde orders op `95f6685b…` sinds 23:30 UTC.

## Samenvatting: bugs naar ernst

| # | Ernst | Bug | Bewijs |
|---|---|---|---|
| 1 | **HOOG** | Een geannuleerde order laat de tickets geldig. Het ticket scant nog `ok`, de capaciteit komt niet vrij en de korting telt wel terug. | Stap 5: na `status='cancelled'` gaf de scan `result:"ok"` en `check_event_capacity` bleef op `event_full` staan. |
| 2 | **HOOG** | `generate_order_number` = `MAX+1` zonder lock. Twee gelijktijdige checkouts bij dezelfde tenant geven `duplicate key … orders_tenant_id_order_number_key` (HTTP 500). | Stap 3: 2 van 2 races gereproduceerd (#0002 en #0003 wonnen, de verliezer kreeg een 500). |
| 3 | **HOOG** | Overboeking na betaling is onzichtbaar: de order staat op paid zonder tickets. Er komt alleen een rij in `admin_actions_log`, die nergens in de UI of in een melding verschijnt (`grep overbooking_prevented src supabase/functions` = 0 hits). Het gratis pad antwoordt dan gewoon `success`. Het Stripe-pad heeft geen reservering, dus het venster duurt zo lang als de Stripe-checkout. | Stap 3b: DB-test met order #9001 → 0 tickets plus 1 logrij. |
| 4 | MIDDEL | Een order met alleen tickets springt na de ticketmail meteen naar `delivered`. Volgens de transitiematrix kan `delivered` niet naar `cancelled`, dus een admin kan zo'n order alleen via "Status corrigeren" (tenant_admin plus reden) annuleren. | Na checkout stond #0001 al op `delivered` (`send-ticket-confirmation/index.ts:404-420`, `src/lib/orderTransitions.ts:14`, `update-order-fulfillment-status/index.ts:35-41`). |
| 5 | MIDDEL | Een gratis checkout duurt ongeveer 7 tot 10 s. Factuur, orderbevestiging en ticketmail worden na elkaar ge-`await` vóór de response. Dat is slechte UX en vergroot het race-venster. | Stap 2: de response kwam pas na ±10 s. `storefront-api/index.ts:3939-3958`. |
| 6 | MIDDEL | Scanner bij slecht 4G: geen timeout, geen indicator dat er een scan loopt, scans tijdens een hangende call vallen stil weg, en na een fout wordt dezelfde QR 4 s genegeerd. | Stap 6 (code-review). |
| 7 | LAAG | `cart_add_item` met `EVENT_FULL` geeft HTTP **500**, met een JSON-**string** in `error`. Dat is een bedrijfsfout, geen serverfout. Ruis in monitoring, en frontends moeten dubbel parsen. | Stap 3: `status_code:500`, `error:"{\"code\":\"EVENT_FULL\",…}"`. `storefront-api/index.ts:2674` + `5272-5279`. |
| 8 | LAAG | De standaard-storefront (`sellqo-storefront/src/routes/afrekenen.tsx:355`) eist een betaalmethode, ook bij €0. Een tenant zonder methodes (zoals Speeltuin: geen Stripe, geen IBAN) kan dus zelfs een gratis order niet afronden in de UI. | `available_payment_methods: []` in de `checkout_customer`-respons. |
| 9 | LAAG | Een geannuleerd ticket komt terug als `result:"invalid", reason:"ticket_cancelled"`. De UI-case `'cancelled'` (`DoorScanner.tsx:282`) wordt nooit geraakt, dus de deur toont "Ongeldig" in plaats van "Geannuleerd". | Stap 5. |
| 10 | LAAG | `update-order-fulfillment-status` schrijft de audit met `admin_user_id: null` bij service_role, maar die kolom is NOT NULL. De audit faalt dan stil (alleen bij service-calls). | Schema: `admin_actions_log.admin_user_id` is NOT NULL. Regel ±236. |
| 11 | INFO | Een event-gebonden crew-scanlink checkt tickets ook dagen vóór het event in. Het venster geldt alleen in auto-modus. | Stap 4: event over 10 dagen → `ok`. |
| 12 | INFO | De €0-factuur blijft `paid` na annulering (geen creditnota). Voor €0 is dat onschuldig, maar hetzelfde geldt voor betaalde tickets. | Stap 7: INV-2026-0001 t/m 0004. |

---

## Stap 0: snapshot vooraf
Speeltuin: 0 producten, 0 orders, 0 events, 0 kortingscodes, 0 scanner-toegangen, 0 facturen, 0 klanten, 0 ticket_instances, 0 admin_actions_log, 7 notificaties en 1 bestaande cart `78efc11d…`. Die cart is niet aangeraakt.

## Stap 1: setup (writes)
Ik heb de wizard (`src/hooks/useCreateEvent.ts`) nagebootst:
- `products` `5df09449-fb02-4092-8acf-ab6db80feeef`: "NACHTTEST pubcrawl", €25, `product_type='ticket'`, `track_inventory=false`.
- `event_details` `f8f8fde8-9721-4be8-9ece-ac51f6259b98`: datum current_date+10 (UTC; werd 2026-10-25), capaciteit 3, early bird €19, `early_bird_deadline = now()+5d`.
  - De wizard zet zelf geen deadline (alleen `early_bird_quantity`). De deadline zit in EventCoreSettingsCard/EventDetail.
- De trigger `event_details_create_defaults` maakte tickettype `765842b1…` (reentry `none`) en zone "Ingang" `a9074c92…` aan. ✓
- `discount_codes` `ac3f4e4e-f50a-43f1-9b9c-f1955817331f`: NACHTTEST100, percentage 100, zonder limiet.
- `event_scanner_access` `a170af8d…` ("NACHTTEST deur", direction in, check_in). Het token wordt server-side gegenereerd.

## Stap 2: kopen via storefront-api (zoals de standaardshop)
Tenant-resolutie gebeurt via `tenant_id` in de body, zonder API-key (`verify_jwt=false`).

| Actie | Verwacht | Gemeten |
|---|---|---|
| cart_create (sessie A) | cart | `f61d86d6…` ✓ |
| cart_add_item 2× met event_detail_id | €19 early bird | `unit_price:19`, `current_price:25`, subtotaal 38 ✓ |
| cart_apply_discount `nachttest100` (kleine letters) | 100% | `discount_amount:38`, `total:0` ✓ (case-insensitief) |
| checkout_customer info@sellqo.app | ok | ✓, maar `available_payment_methods: []` (zie bug 8) |
| checkout_complete (`bank_transfer`) | gratis pad, paid | `#0001`, `payment_type:"none"`, total 0 ✓, wel pas na ±10 s (bug 5) |

DB-natrek op #0001:
- payment_status `paid` ✓
- **status `delivered`** (bug 4)
- order_items qty 2 à €19 ✓
- 2 ticket_instances `valid`, seq 1 en 2 ✓
- `ticket_mail_log` send_count 1, source `service` ✓
- `discount_code_usage` 1 rij (€38) en `usage_count` 1 ✓
- factuur INV-2026-0001 `paid` €0
- cart `converted` ✓

Er zijn echte mails naar info@sellqo.app gegaan: orderbevestiging plus ticketmail, voor #0001 t/m #0004.

## Stap 3: capaciteit en race
Na A was er nog 1 plaats over.

| Test | Verwacht | Gemeten |
|---|---|---|
| Cart B: add 2 | EVENT_FULL | `EVENT_FULL`, `spots_left:1` ✓, maar als **HTTP 500** met een stringified error (bug 7) |
| Carts C en D: add 1 (elk) | ok | ok ✓ (de cart reserveert niets) |
| **Race 1**: checkout_complete C en D in één select (vooraf `event_spots_left:1`) | één krijgt een ticket, de ander EVENT_FULL of een overbooking-log | **D → #0002 met 1 ticket. C → HTTP 500 `duplicate key value violates unique constraint "orders_tenant_id_order_number_key"`** |
| C opnieuw afronden | EVENT_FULL | `EVENT_FULL` (HTTP 200, `success:false`) ✓ |
| **Race 2** (na het vrijmaken van 1 plaats): E en F gelijktijdig | idem | **E → #0003. F → opnieuw dezelfde duplicate-key 500** (2 van 2 reproduceerbaar) |
| Race 3, gespreid (F nog eens, dan G ±3 s later) | tweede EVENT_FULL | F → #0004. G → `EVENT_FULL` ✓ (de capaciteitspoort vóór betaling werkt bij gespreide calls) |

Conclusie race: bij echte gelijktijdigheid wint de overboekingsbeveiliging het niet eens. De verliezer struikelt eerder op het ordernummer en krijgt een 500 "duplicate key". Dat raakt **elke tenant en elk orderpad** (Stripe-webhook, overschrijving, gratis): `generate_order_number` doet `SELECT MAX(...)+1` zonder lock. Bij een Fonske-ticketdrop is dit realistisch.

De achtergelaten state van de verliezer: cart blijft `checkout` met `payment_method='free'`, er is geen order en er is geen gebruik geteld. Een retry werkt dus, maar wel met een 500 als klantervaring.

**3b. Overboekingspad (deterministisch op DB-niveau).** Via pg_net was dit niet in het juiste venster te krijgen. Daarom heb ik het rechtstreeks getest op een vol event: order `#9001` (`bb088e3b…`) eerst pending met een event-regel, daarna `payment_status='paid'`.
- Resultaat: **0 tickets**, 1 rij `admin_actions_log` `ticket_issuance_overbooking_prevented` (`reason:event_full`, `paid_amount:0`), geen ticket_mail_log.
- De order blijft `paid` en `pending`.
- Die logregel wordt nergens getoond of gemeld (bug 3).
- In het gratis pad (`storefront-api/index.ts:3928-3935`) wordt de RPC-fout alleen gelogd en is de respons `success:true`.
- In het Stripe-pad zit tussen de capaciteitspoort (`3801-3826`) en de uitgifte de volledige Stripe-checkout. Daar zit geen reservering op. Een betaalde klant zonder ticket is dus mogelijk, en die krijgt geen signaal.

## Stap 4: scannen (crew-token, `ticket-checkin` en `scanner-door`)

| Test | Verwacht | Gemeten |
|---|---|---|
| Scan ticket A1 | ok | `result:"ok"`, attendee, seq 1, checked_in_at ✓ |
| Opnieuw A1 | already met tijd | `result:"already"`, `checked_in_at` = eerste tijdstip ✓ |
| Nep-token | invalid | `result:"invalid", reason:"unknown_token"` ✓ (geen ticket_scans-rij, want de kolom is NOT NULL) |
| Zoek "Race" | ticket D | 1 hit met #0002 en qr_token ✓ |
| Zoek "0001" (ordernummer) | 2 tickets | 2 hits ✓ |
| Zoek "info@sellqo" (e-mail) | alle tickets | 3 hits ✓ (geeft geen e-mail terug, wel het qr_token) |
| Stats | sold/inside | `sold:3, inside:2` ✓ (tijdens de parallelle scan) |
| **2 gelijktijdige scans** van A2 | één ok, één already | `ok` + `already`, met identiek `checked_in_at` ✓ (`UPDATE … WHERE status='valid'` is race-safe) |

`ticket_scans` (4 rijen, allemaal `scanner_access_id` gezet): ok, already_inside, ok, already_inside ✓.

## Stap 5: annuleren
Het admin-pad is `useOrders.updateOrderStatus` → edge function `update-order-fulfillment-status`. Die heeft een JWT van tenant_admin of staff nodig, dus ik heb hem niet zelf aangeroepen. Ik heb de equivalente DB-write gedaan: `orders.status='cancelled', cancelled_at=now()`. Die function doet zelf niets anders dan die update plus een auditregel (regels 222-235). Bovendien had de order al status `delivered`, dus via de normale dropdown kan het niet (bug 4).

| Check na annuleren #0002 | Verwacht | Gemeten |
|---|---|---|
| ticket_instances | cancelled | **`valid`** ❌ |
| Scan van het ticket | invalid | **`result:"ok"`, "NACHTTEST Race D" binnen** ❌ |
| Capaciteit | 1 vrij | **`event_full`, 0 vrij** ❌ |
| Discount usage | terug | `usage_count` 2→1, de usage-rij weg ✓ (trigger `trg_orders_discount_usage`) |

Oorzaak: geen enkele code zet `ticket_instances` op cancelled of refunded. Gecontroleerd met `grep` in src en functions, en in pg_proc: alleen `perform_scan` en `assign_event_seat_to_ticket` doen een UPDATE op ticket_instances. Hetzelfde geldt voor terugbetalingen.

Daarna heb ik de tickets handmatig op `cancelled` gezet, als proef voor de fix:
- scan → `invalid / ticket_cancelled` ✓
- capaciteit → 1 vrij ✓
- stats `sold:2` ✓

## Stap 6: scanner offline en traag netwerk (code-review)
Bestanden: `src/components/door/DoorScanner.tsx` en `src/pages/public/DoorScan.tsx`. Er is geen service worker die iets cachet: `public/sw.js` doet alleen push.

1. **Geen timeout.** `invokeWithToken` (`DoorScan.tsx:28-35`) roept `supabase.functions.invoke` aan zonder AbortController of timeout. Op slecht 4G kan één call tientallen seconden tot minuten hangen.
2. **Stille drop van scans.** Tijdens zo'n hangende call staat `busyRef=true` (`DoorScanner.tsx:130-134`). Elke volgende QR wordt dan zonder enige feedback genegeerd. Er is ook geen spinner of "bezig"-indicator voor de scan. De portier ziet niets en de rij staat stil.
3. **Fout geeft een rode "Mislukt"-kaart**, met de ruwe foutmelding ("Failed to send a request to the Edge Function"). Er is geen automatische retry en geen offline-wachtrij. De kolommen `ticket_scans.offline_synced` en `offline_scanned_at` bestaan, maar worden niet gebruikt.
4. **Dezelfde QR opnieuw scannen na een fout wordt 4 s genegeerd.** Het `finally` zet `lastRef` opnieuw voor dat token (`DoorScanner.tsx:139-140`, `SAME_TOKEN_COOLDOWN_MS=4000`). De portier denkt dat de scanner hapert.
5. **Verloren respons.** Komt de check-in wel aan op de server maar valt de respons weg, dan ziet de portier "Mislukt". Scant hij opnieuw, dan krijgt hij "Al binnen (hh:mm)". Dubbele inschrijving is onmogelijk, want de server is idempotent. Het risico is dat een geldige gast als dubbel ticket wordt geweigerd. Mitigatie: het tijdstip toont de vorige scan van seconden geleden.
6. **De teller is stil stale.** `refreshStats` slikt fouten (`DoorScanner.tsx:105`). Op slecht 4G klopt "binnen/verkocht" niet, en er is geen indicatie.
7. **Zoeken bij een netwerkfout** toont lege resultaten (`setHits([])`, regel 227). Dat ziet eruit als "niet gevonden".
8. **Herladen van de pagina zonder netwerk** lukt niet (geen cache). Een portier die de app per ongeluk sluit, staat zonder scanner.

## Stap 7: opruimen (writes) en bewijs
Writes:
- orders #0001, #0002, #0003, #0004 en #9001 → `status='cancelled'` plus internal note.
- Alle ticket_instances van het event → `cancelled`.
- Scanner-toegang `is_active=false`, code `is_active=false`, event `status='cancelled'`, tickettype `is_active=false`, product `is_active=false` en `hide_from_storefront=true`.
- 7 NACHTTEST-carts en hun items verwijderd.

Bewijsquery na het opruimen:
- orders: 5× `cancelled`
- tickets: `{cancelled:5}`
- code: `active:false`, `usage_count:0`, 0 usage-rijen
- scanner `false`, event `cancelled`, product inactief en verborgen
- carts: alleen de oorspronkelijke `78efc11d…` over
- capaciteit 3 vrij
- Fonske: 0 nieuwe tickets en 0 aangeraakte orders

Wat blijft staan, omdat verwijderen niet kan of niet hoort:
- 4 facturen INV-2026-0001 t/m 0004 (€0, `paid`)
- 1 klant `ca777f7b…` (info@sellqo.app)
- 1 rij `admin_actions_log` (overboekingstest)
- 6 ticket_scans
- 4 ticket_mail_log-rijen
- ±16 extra notificaties
- product, event, zone en tickettype (FK's vanuit ticket_instances en order_items)

Alles is inactief of geannuleerd. Wil je de Speeltuin helemaal schoon: facturen en klant kunnen weg via een aparte, expliciete delete.

## Fixvoorstellen

1. **Bug 1 (tickets bij annuleren/terugbetalen).** Een DB-trigger op `orders`: `AFTER UPDATE OF status, payment_status`. Die zet `ticket_instances` met status `valid` op `cancelled` als `NEW.status='cancelled'`, en op `refunded` als `payment_status in ('refunded')`. Zo dekt hij elk pad (admin, webhook, correctie), net als `trg_orders_discount_usage`.
   - Ingecheckte tickets niet aanraken, of wel: dat is een keuze voor Akke.
   - Gevolg: `get_event_signup_count` geeft de plaats automatisch vrij en `can_scan` weigert al op `ticket_cancelled`.
2. **Bug 2 (ordernummer).** In `generate_order_number`: `PERFORM pg_advisory_xact_lock(hashtextextended('order_number:'||_tenant_id,0))`. Dat werkt alleen als nummeren en insert in dezelfde transactie zitten, en dat is niet zo: het is een RPC gevolgd door een losse insert. Beter dus een tellertabel `tenant_order_counters` met `UPDATE … SET n=n+1 RETURNING n` (atomair).
   - Of, minimaal: in `createOrderFromCart` (`storefront-api/index.ts:3287` en de insert op `3395`) bij `23505` op `orders_tenant_id_order_number_key` opnieuw nummeren en tot 3× retryen.
   - Check ook de andere aanroepers van `generate_order_number` (Stripe-webhook, POS).
3. **Bug 3 (overboeking).**
   - In `issue_tickets_for_order_core` naast de logregel ook een `notifications`-rij met category `orders` (geldige enum) en `type='ticket_overbooking'`.
   - Op de order bijvoorbeeld `internal_notes` of een vlag zetten.
   - In het gratis pad na de RPC het aantal tickets natellen. Te weinig: order annuleren en `EVENT_FULL` teruggeven.
   - Voor Stripe: een korte capaciteitshold (`ticket_holds` met expires_at, meegeteld in `check_event_capacity`) bij checkout_complete, of een auto-refund op overboeking.
4. **Bug 4 (delivered).** Tickets-only orders op `processing` laten, of in `orderTransitions.ts` en `update-order-fulfillment-status` `delivered → cancelled` toestaan voor ticketorders. Daarna bug 1 laten opvangen.
5. **Bug 5 (traag gratis pad).** De drie `await fetch` in `storefront-api/index.ts:3939-3958` via `EdgeRuntime.waitUntil(...)` laten lopen en meteen antwoorden.
6. **Bug 6 (scanner).**
   - `AbortController` met een timeout van 8 s in `invokeWithToken`.
   - Een zichtbare "Bezig…"-staat zolang `busyRef` aan staat.
   - Bij een netwerkfout `lastRef` resetten, zodat een rescan meteen kan.
   - Een duidelijke "Geen verbinding, scan opnieuw"-tekst in plaats van de ruwe error.
   - Een offline-indicator op `navigator.onLine`.
   - Later: een offline-wachtrij met `offline_scanned_at` (kolommen bestaan al).
7. **Bug 7.** In `cartAddItem` een getypeerde `EventCapacityError` gooien. De main catch (`5272`) geeft daarop HTTP 409 met `error:{code,message,spots_left}`, net zoals bij `DiscountCodeError`. Dit raakt het contract met de custom frontends, dus eerst checken hoe Fonske dit nu parset.
8. **Bug 8.** In `afrekenen.tsx` bij `state.total === 0` geen betaalmethode eisen en `payment_method_id: 'free'` sturen. De API kiest het gratis pad toch al op basis van het totaal.
9. **Bug 9.** In `DoorScanner.tsx:282` ook `reason` `ticket_cancelled` en `ticket_refunded` als "Geannuleerd" tonen.
10. **Bug 10.** De auditregel overslaan of een systeem-user gebruiken bij service_role.

## Niet testbaar / beperkingen
- **Admin-annulering via de edge function:** daar is een tenant_admin-JWT voor nodig, en die heb ik niet. Ik heb de equivalente update gedaan.
- **Stripe-pad en overschrijvingspad:** niet getest, want er mocht geen geld bewegen en Speeltuin heeft geen IBAN en geen Stripe. De overboekingsrisico's daarvan komen uit code-analyse.
- **Het overboekingspad via de echte API-race:** onbereikbaar, omdat bug 2 eerst toeslaat en de pg_net-timing bij gespreide calls te grof is. Daarom heb ik het deterministisch op DB-niveau getest (#9001).
- **Scanner-UI live met camera en slecht netwerk:** alleen code-review.
- **Inhoud en rendering van de echte mails:** alleen het bestaan van de `ticket_mail_log`-rij is gecontroleerd.

## Efficiëntie en skill-reflex
- Deze run is een herbruikbaar patroon (setup, kopen, race, scan, annuleren, opruimen via pg_net). Dat hoort als script `scripts/e2e-tickets.sql` of als skill `sellqo-ticket-e2e`: dezelfde stappen, maar idempotent en met een vaste cleanup.
- Voorstel voor `sellqo-engineering-rules` of de project-instructies: "Een order annuleren of terugbetalen raakt ticket_instances NIET (stand 16-10). Elke annuleer- of refundfix voor events moet tickets meenemen." Pas toevoegen nadat bug 1 gefixt of besproken is.

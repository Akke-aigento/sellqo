# API-contract nachtrun 1-2 nov 2026 — storefront-api (bouwer API, branch night-api)

Voor de bouwer van `sellqo-storefront`. Alles is **additief**: bestaande acties, parameters en
velden blijven werken zoals voorheen. Versiestempel na deploy: `GET storefront-api` →
`{ "ok": true, "version": "QR-STATUS-1" }`, header `X-SellQo-Api-Rev: qr-status-1`.

## Envelop (ongewijzigd)

Elke `POST` met `{ action, tenant_id, params }` geeft HTTP 200 met
`{ "success": true, "data": <resultaat> }`. Een **verwachte weigering** zit ín `data`:
`{ "success": true, "data": { "success": false, "error": { "code": "…", "message": "…" } } }`.
Lees dus altijd eerst `data.success === false`. Onverwachte serverfouten: HTTP 500 met
`{ success: false, error: "<tekst>" }`.

---

## 1. QR-IDEMP-1 — `checkout_complete` opnieuw na een netwerkfout

Ongewijzigde aanroep: `{ action: "checkout_complete", params: { cart_id, payment_method_id, success_url?, cancel_url? } }`.

**Nieuw:** is het mandje al een order geworden (`checkout_status = 'converted'`) en vindt de server
de order van **dit** mandje terug, dan komt er geen fout meer maar hetzelfde succes als de eerste
keer, plus `duplicate: true`. De vorm hangt af van hoe de order betaald wordt:

| order | `data` |
|---|---|
| betalen bij afhalen/levering (`pay_on_pickup`) | `{ order_id, order_number, status: "awaiting_payment", payment_type: "manual", pay_on_pickup: true, total, currency, duplicate: true }` |
| overschrijving, nog niet betaald | `{ order_id, order_number, status: "awaiting_payment", payment_type: "qr", total, currency, bank_details{…}, qr_data{…}\|null, duplicate: true }` (identiek aan de eerste keer) |
| al betaald (Stripe, gratis order, overschrijving binnen) | `{ success: true, order_id, order_number, status: "completed", payment_type: "none", total, currency, duplicate: true }` |

Vindt de server de order niet terug (oude mandjes van vóór deze batch zonder Stripe-sessie), dan
blijft het oude antwoord: `{ success:false, error:{ code: "ORDER_ALREADY_PAID", message: "Deze bestelling is al afgerond" } }`.

**Storefront:** bij een time-out of netwerkfout op `checkout_complete` mag je dezelfde aanroep
(zelfde `cart_id`) gewoon opnieuw doen. `duplicate: true` → behandel als succes en ga naar de
bevestiging met `order_id`/`order_number`. Let op: bij Stripe ontstaat de order pas na betaling;
een herhaling vóór betaling geeft (zoals voorheen) een nieuwe `checkout_url`.

## 2. QR-IDEMP-1 — online rekening betalen: hervatten of vrijgeven

Het `payment_id` maakt de browser zelf (UUID). **Bewaar het in `sessionStorage`/`localStorage`
vóór je `table_check_pay` aanroept**, samen met de parameters (kind, lines, share_n/k, tip_cents).

### 2a. Hervatten — `table_check_pay` met hetzelfde `payment_id` en dezelfde parameters (bestond al)
Geeft `{ payment_id, checkout_url }` van dezelfde Stripe-sessie (of maakt de sessie alsnog aan als
die er nog niet was). Andere parameters met hetzelfde id → `CHECK_PAY_INVALID`.

### 2b. Nieuw: stand + url — `table_check_pay_status`
`params: { payment_id }` → zoals voorheen `{ payment_id, status, kind, amount_cents, tip_cents, table_label, reason, paid_at }`
plus **nieuw**: `checkout_url: string | null` — de url van de Stripe-sessie als die nog open is
(status `pending`). Zo kan je na een netwerkfout de betaalpagina terug openen zonder de parameters.

### 2c. Nieuw: oude poging vrijgeven bij een nieuwe — `table_check_pay` + `release_payment_ids`
`params: { …zoals voorheen, release_payment_ids?: string[] }` (max. 5 UUID's). Vóór de nieuwe poging
start, geeft de server elke opgegeven poging vrij die nog `pending` is en **op dezelfde tafel** staat
(Stripe-sessie wordt verlopen; is ze intussen toch betaald, dan blijft ze staan). Onbekende,
andere-tafel- of al afgeronde id's worden stil overgeslagen. Zelfde effect als
`table_check_pay_cancel` per id, in één oproep. Het `payment_id` van de nieuwe poging zelf wordt
nooit vrijgegeven.

`table_check_pay_cancel` (bestond al) blijft het losse vrijgeven: `params: { payment_id }` → `{ status }`.

**Aanbevolen flow storefront:** bewaar elke gestarte `payment_id`. Bij openen van de
rekeningpagina: `table_check_pay_status` op de bewaarde id → `pending` + `checkout_url` = knop
"Verder betalen"; `pending` zonder url of de gast kiest iets anders → nieuwe poging met
`release_payment_ids: [oude id]`. `paid` → bevestiging.

## 3. STATUS-1 — `table_request_status` (uitgebreid)

Drie vormen; combineren mag (één oproep, meerdere sleutels in het antwoord).

**a) Oud, ongewijzigd + één veld erbij:** `params: { request_id }` →
`{ id, status, reason, table_label, item_count, total_cents, created_at, decided_at, progress }`.
Fouten zoals voorheen: `NOT_FOUND`.

**b) Nieuw, lijst:** `params: { request_ids: string[] }` (max. 20) →
`{ requests: [ { id, status, reason, table_label, item_count, total_cents, created_at, decided_at, progress } ] }`.
Onbekende id's ontbreken gewoon in de lijst (geen fout).

**c) Nieuw, order (qr_flow = order, afhalen, levering):** `params: { order_id }` →
`{ order: { id, order_number, status, service_type, requested_time, table_label, created_at, progress } | null }`.
`order.status` = `"received"` of `"cancelled"`.

**d) Nieuw, oproepen (zie §4):** `params: { call_ids: string[] }` (max. 10) →
`{ calls: [ { id, kind, status, created_at, handled_at } ] }`.

Combineren: zodra `request_ids`, `order_id` of `call_ids` meegaat, krijg je enkel de sleutels
`requests` / `order` / `calls` (en ook `request` als je daarnaast `request_id` meegeeft).

`progress`:
```json
{
  "stage": "awaiting_confirmation | rejected | confirmed | queued | preparing | ready | served | cancelled",
  "stations": [ { "name": "Keuken", "status": "new | preparing | ready | done | cancelled" } ],
  "updated_at": "2026-11-02T19:41:00Z"
}
```
- `awaiting_confirmation` — tafelaanvraag wacht op het personeel.
- `rejected` — geweigerd (reden in `reason`).
- `confirmed` — bevestigd / order ontvangen, nog niet in de keuken.
- `queued` — bon(nen) in de keuken, nog niet gestart.
- `preparing` — minstens één post is bezig.
- `ready` — alles klaar (wacht op opdienen/afhalen).
- `served` — alles opgediend/afgehaald (keukenbon op "afgewerkt").
- `cancelled` — alle bonnen geannuleerd, of de order is geannuleerd.

Autorisatie: enkel met de onraadbare ID's die de gast zelf kreeg, en enkel binnen deze zaak.
Er komt nooit info van andere tafels mee (de stations-namen zijn die van de zaak zelf; bonnen van
dezelfde ronde maar een andere post dan de lijnen van de gast tellen niet mee).

## 4. OBER-ROEPEN-1 — `table_call` (nieuw)

`params: { table_token: string, kind: "waiter" | "bill", call_id?: string(uuid) }`
(`table` = vrij tafelnummer mag enkel in een zaak zonder zaalplan, zoals `checkout_table`).

Succes: `{ call_id, kind, status: "open" | "handled", created_at, duplicate: boolean, retry_after_s: number }`
- Eerste oproep → nieuwe oproep, `duplicate: false`, `retry_after_s: 120`.
- Opnieuw binnen 2 min (zelfde tafel, zelfde kind, ook vanaf een andere gsm) → dezelfde oproep
  terug, `duplicate: true`, `retry_after_s` = resterende seconden. **Geen fout**: toon "De bediening
  is verwittigd".
- Opnieuw na 2 min terwijl de oproep nog open staat → dezelfde oproep, de kassa ziet "2×" en er gaat
  opnieuw een melding uit (`duplicate: false`).
- Zelfde `call_id` opnieuw (netwerkfout) → dezelfde oproep (idempotent).

Fouten (`data.success === false`):
| code | wanneer |
|---|---|
| `TABLE_CALL_OFF` | QR staat uit in deze zaak (`qr_mode = 'off'`) |
| `TABLE_CALL_INVALID` | `kind` of `call_id` ongeldig |
| `TABLE_NOT_FOUND` / `TABLE_TOKEN_REQUIRED` / `VALIDATION_ERROR` | tafel niet gevonden (zoals `resolve_table`) |
| `TOO_MANY_REQUESTS` | te veel open oproepen in de zaak (> 100) of te veel van hetzelfde IP (> 10 / 10 min, HTTP 429 `RATE_LIMITED`) |
| `SHOP_CLOSED` | winkel dicht (HTTP 423, zoals andere bestelacties) |

Stand opvolgen: `table_request_status` met `call_ids` (§3d). `status: "handled"` = personeel
tikte "Afgehandeld" in de kassa.

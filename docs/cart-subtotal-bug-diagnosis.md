# Cart subtotal bug — diagnosis (2026-06-08)

## TL;DR

De oorspronkelijke hypothese ("`storefront_carts.subtotal` blijft 0 omdat
cart-mutaties de kolom nooit bijwerken") is **onjuist**. Die kolom bestaat
niet. Subtotaal wordt overal in-memory berekend en de Mancini-DB-data
is intact. Het symptoom "€0 op checkout" komt vrijwel zeker uit een
frontend-pad of een silently-failing `cart_add_item` tijdens
`initServerCart`, niet uit een DB/trigger-issue.

---

## 1. DB-schema check

`storefront_carts` kolommen (information_schema):

```
id, tenant_id, session_id, customer_id, currency, expires_at,
created_at, updated_at, checkout_status, customer_email,
customer_first_name, customer_last_name, customer_phone,
shipping_address, billing_address, billing_same_as_shipping,
shipping_method_id, shipping_cost, discount_amount, stripe_session_id,
payment_method, discount_codes, calculated_fee_cents, locale
```

**Er is geen `subtotal` kolom.** De voorgestelde trigger/backfill kon
daarom niet draaien (migration faalde met `42703: column "subtotal" of
relation "storefront_carts" does not exist`).

## 2. Live Mancini cart-state (SQL)

`tenant_id = 2606c5b9-caf8-4a42-94cd-80e3f3f31988`, top 6 carts:

| cart_id (kort)  | session_id (kort) | status   | item_id | qty | unit_price | computed | updated_at |
|-----------------|-------------------|----------|---------|-----|-----------:|---------:|------------|
| 8ae01eef…cefc   | 999b9b35…2420     | shopping | aanwezig| 1   | 450.00     | 450.00   | 20:22 |
| d4fd6295…1eb    | 7e608e3c…8031     | shopping | —       | —   | —          | —        | 19:54 |
| 89ff5253…fefebc | bf513748…e286b    | checkout | aanwezig| 1   | 200.00     | 200.00   | 18:20 |
| 0b4b32bb…8be0   | 62330c9b…3abc     | shopping | aanwezig| 1   | 600.00     | 600.00   | 17:06 |
| f43cf829…6f2    | fc989791…d319     | shopping | aanwezig| 1   | 450.00     | 450.00   | 31-05 |

Observaties:
- Cart-items voor Mancini hebben **altijd `unit_price > 0`**. Geen
  silent-zero bug in `cart_add_item`.
- De test-cart van 20:22 (1× Monogram Jacket €450) bestaat correct,
  maar staat nog op `checkout_status='shopping'`. Dat betekent dat
  `checkoutStart()` (regel 1697-1724) op die cart **niet succesvol is
  uitgevoerd** — `checkoutStart` zet status naar `'checkout'`.
- Daarnaast bestaat een tweede shopping-cart van 19:54 voor dezelfde
  browser-sessie zónder items. Mogelijk een artefact van `cart_create`
  vóór items geladen werden.

## 3. Code-pad analyse

### Edge function (`supabase/functions/storefront-api/index.ts`)

- Client wordt geïnstantieerd met `SUPABASE_SERVICE_ROLE_KEY` (regel
  2935) → **RLS bypass, kan geen 0-rijen leveren door policies**.
- `cartGet` (regel 1183-1227): selecteert items, berekent
  `subtotal = Σ(quantity × unit_price)` in-memory, retourneert in
  response.
- `getCartForCheckout` (regel 1389-1420): identiek patroon, retourneert
  `{ ...cart, cartItems, subtotal }`. De expliciete `subtotal` key
  overschrijft elke `subtotal` uit `...cart` (die er niet is).
- `buildCartResponse` (regel 1425-1546): leest `cart.subtotal` op
  regel 1436 — dat is dus de **in-memory computed value**, geen
  DB-kolom. Subtotal wordt op regel 1517 in het response-object gezet.
- `cartAddItem` (regel 1229-1287): valideert product + variant,
  bepaalt `unitPrice = variant.price ?? product.price`, doet upsert
  met `unit_price` veld. Gooit een echte Error als variant niet
  gevonden → frontend krijgt het door.
- Alle `checkout_*` actions die het response shape hergebruiken
  (`checkout_start`, `_customer`, `_address`, `_shipping`,
  `_select_payment_method`, `_apply_discount`, `_remove_discount`) gaan
  via `buildCartResponse` → consistente subtotal.

### Frontend (`src/pages/storefront/ShopCheckout.tsx`)

- Regel 66: `const { items: cartItems, getSubtotal, ... } = useCart();`
- Regel 173: `const subtotal = getSubtotal();` — **lokale**
  CartContext-waarde (localStorage), niet server.
- Regel 764: order-samenvatting toont `formatPrice(subtotal)` →
  lokaal subtotaal, **onafhankelijk van checkoutData**.
- Regel 794: totaal toont
  `formatPrice(checkoutData?.total ?? (subtotal + fee))` → server
  total met fallback naar lokaal.
- `initServerCart` (regel 222-254): bij elke checkout-submit:
  1. `cart_create` (krijgt bestaande session-cart of nieuwe),
  2. `cart_get` op die cart,
  3. **alle bestaande server-items `cart_remove_item`**,
  4. **alle lokale `cartItems` opnieuw `cart_add_item`**.

## 4. Welke hypothese verklaart het symptoom?

Het oorspronkelijke verhaal "checkout-pagina toont €0 door DB-subtotal=0"
kan niet kloppen omdat er geen DB-subtotal is en de in-memory berekening
correct werkt. Resterende waarschijnlijke oorzaken voor een echte
€0-observatie:

1. **Lokale CartContext is leeg** (incognito + andere
   tenantSlug-key, of cart geleegd na `clearCart()`). Regel 764 valt dan
   terug op `getSubtotal() = 0`. Dit gebeurt **vóór** een server-call;
   geen DB-issue.
2. **Silent destructive sync in `initServerCart`** (regel 233-251):
   als één `cart_add_item` faalt (bv. inactieve variant, stock-error)
   terwijl de vorige loop al alle bestaande items heeft gewist, eindigt
   de server-cart leeg of incompleet → buildCartResponse retourneert
   `subtotal=0` of een lagere waarde. Lokale `subtotal` blijft
   correct, maar `checkoutData.total` (regel 794) wordt 0.
3. **Race / dubbele cart**: `cart_create` heeft tussentijds een nieuwe
   cart aangemaakt (zie 19:54 lege Mancini-cart). Als de frontend de
   verkeerde `cart_id` cached, leest checkout van een lege cart.
4. **`checkoutData.total` bevat een echte 0** door payment-fee
   berekening op een lege of niet-gesynced cart na een falende
   `checkout_select_payment_method` call.

Hypothese 2 is het meest waarschijnlijk gegeven dat de 20:22 Mancini
test-cart `shopping` is gebleven (= checkoutStart faalde of werd nooit
aangeroepen op dezelfde cart waar de items op staan).

## 5. Aanbevolen fix (geen wijzigingen uitgevoerd)

- **Niet** de DB-trigger / `subtotal` kolom toevoegen. Er is geen
  schema-bug.
- **Wel** `initServerCart` (ShopCheckout.tsx regel 222-254) hardenen:
  - Verwijder de "remove-all-then-re-add"-strategie of wrap hem in een
    try/catch zodat een gefaalde `cart_add_item` niet leidt tot een
    half-lege cart. Idealiter: verwijder alleen items die niet in de
    lokale cart zitten, en update quantity voor de rest. Of stuur een
    nieuwe `cart_sync` action naar de edge function die atomair de
    items vervangt.
  - Log uitkomst van elke `cart_add_item` en bail-out met `toast` als
    er iets faalt — geen silent half-state naar checkout.
- **Diagnostisch**: voeg `console.log` toe rond `checkout_start`
  response in `handleCustomerDetailsSubmit` om te zien of
  `startData.subtotal` correct binnenkomt — of vraag de gebruiker om
  network-tab te delen van een mislukte run.
- **Cleanup**: lege/verlaten shopping-carts ouder dan X uur opruimen
  (cron-job) om dubbele-cart-races te voorkomen.

## 6. Wat we NIET hoeven te doen

- Geen `subtotal` kolom toevoegen aan `storefront_carts`.
- Geen `recompute_storefront_cart_subtotal` trigger.
- Geen backfill — bestaande carts hebben geen subtotal-veld dat
  ge-backfilled moet worden.

## 7. SQL-snapshot voor reproductie

```sql
SELECT c.id, c.session_id, c.checkout_status, c.updated_at,
       ci.id AS item_id, ci.product_id, ci.variant_id,
       ci.quantity, ci.unit_price,
       (ci.quantity * ci.unit_price) AS computed_line_total
FROM storefront_carts c
LEFT JOIN storefront_cart_items ci ON ci.cart_id = c.id
WHERE c.tenant_id = '2606c5b9-caf8-4a42-94cd-80e3f3f31988'::uuid
ORDER BY c.updated_at DESC NULLS LAST LIMIT 20;
```

Resultaat zie §2.

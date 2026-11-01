## QR-IDEMP-1 — afrekenen en rekening online betalen veilig herhalen na een netwerkfout — 2 november 2026

Branch `night-api`. Contract voor de storefront: `docs/nachtrun/API-CONTRACT.md` §1–2.

**Root cause**
- `supabase/functions/storefront-api/index.ts` `checkoutComplete`: een mandje met
  `checkout_status = 'converted'` gaf altijd `ORDER_ALREADY_PAID` "Deze bestelling is al afgerond".
  Kwam het antwoord van de eerste `checkout_complete` nooit aan (netwerk weg, gsm in slaap) en
  probeerde de gast opnieuw, dan zag hij een foutmelding voor een bestelling die wél gelukt was
  (afhalen, overschrijving, gratis). De order was vanuit het mandje niet terug te vinden: `orders`
  heeft geen mandje-ID; enkel Stripe-orders zijn te vinden via `stripe_checkout_session_id`.
- `tableCheckPay`: elke poging houdt de rekening (of de gekozen items) 10 min vast (`hold_until` in
  `table_check_pay_start`), de Stripe-sessie leeft 31 min (`STRIPE_SESSION_MINUTES`). Maakte de
  browser na een netwerkfout een nieuw `payment_id`, dan blokkeerde de oude poging de nieuwe
  (`CHECK_PAY_BUSY` / `CHECK_LINES_TAKEN`). Hervatten met hetzelfde id bestond al (idempotent op
  `payment_id`), vrijgeven ook (`table_check_pay_cancel`), maar de storefront kon de url van een open
  sessie niet opvragen zonder alle parameters opnieuw mee te geven, en niet in één oproep vrijgeven + starten.

**Uitgevoerd**
- `supabase/migrations/20261101230310_qr_idemp_1.sql`: `storefront_carts.converted_order_id uuid`
  (additief, geen FK, geen default).
- `storefront-api/index.ts`:
  - `createOrderFromCart`: na het omzetten een aparte update `converted_order_id = order.id`; een fout
    (kolom bestaat nog niet) wordt enkel gelogd en houdt de bestelling nooit tegen.
  - `orderForConvertedCart` + `duplicateCheckoutResponse`: order via `converted_order_id`, anders via de
    Stripe-sessie van het mandje; altijd `.eq('tenant_id', tenantId)`. Vorm = die van de eerste keer
    (`pay_on_pickup` → manual; `bank_transfer` onbetaald → bankgegevens + QR; betaald → completed/none)
    plus `duplicate: true`. Niet gevonden → de oude fout, ongewijzigd.
  - `bankTransferResponse`: het bestaande overschrijvingsantwoord letterlijk uit `checkoutComplete`
    gehaald (zelfde velden en waarden), zodat de herhaling exact hetzelfde teruggeeft.
  - `releaseCheckPayment`: de logica van `table_check_pay_cancel` als helper; de actie zelf gedraagt
    zich identiek.
  - `table_check_pay`: optioneel `release_payment_ids` (max. 5): eerst die pogingen vrijgeven, enkel
    als ze op de open rekening van dezelfde tafel staan; het eigen `payment_id` nooit.
  - `table_check_pay_status`: extra veld `checkout_url` (url van de nog open Stripe-sessie, anders null).
  - `checkoutPlaceOrder`: enkel een expliciet type op het resultaat van `checkoutComplete` (deno check).

**Security-keuzes**
- Geen RLS/grants geraakt. De herhaalde checkout geeft enkel de order van het mandje waarvan de
  aanroeper het (onraadbare) mandje-ID kent, en enkel binnen dezelfde tenant (getest met een
  `converted_order_id` die naar een order van een andere tenant wijst → oude fout).
- `converted_order_id` gaat nooit als ruwe kolom naar een frontend: `cart_get`/`buildCartResponse`
  mappen expliciet; `getCartForCheckout` gebruikt `select('*')` maar enkel intern.
- Vrijgeven met `release_payment_ids`: zelfde recht als `table_check_pay_cancel` (wie het id kent),
  beperkt tot dezelfde tafel. Een betaalde sessie wordt nooit vrijgegeven.

**Gedeelde-paden-waarschuwing**
- `storefront-api` is gedeeld met de zes custom frontends. Alles is additief: nieuwe optionele
  parameter, nieuwe velden. Eén gedragswijziging: `checkout_complete` op een omgezet mandje waarvan de
  order teruggevonden wordt, geeft nu succes in plaats van `ORDER_ALREADY_PAID`. Waarom veilig, ook
  zonder hun code te kunnen lezen:
  - de fout werd in de data-envelop teruggegeven (`data.success === false`, HTTP 200); een frontend
    die erop rekende, toonde de melding "al afgerond". Nu krijgt hij exact de vorm van een geslaagde
    `checkout_complete` voor dezelfde order (dezelfde sleutels als de eerste keer + `duplicate`). Elke
    frontend die het eerste antwoord aankon, kan dit ook: hij gaat naar dezelfde bevestiging.
  - Er wordt niets aangemaakt, afgeboekt of gemaild bij de herhaling (puur lezen): geen dubbele order,
    geen dubbele voorraad, geen dubbele mail.
  - Stripe: het mandje wordt pas omgezet na betaling; de herhaling geeft dan `completed`, net wat
    `checkout_verify_payment` op hetzelfde moment ook zegt. Vóór betaling verandert er niets.
  - Wordt de order niet gevonden, dan blijft de oude fout byte-gelijk.
- `checkout_place_order` (roept `checkoutComplete` intern aan) werkt mee: bij een herhaling krijgt hij
  `order_id`/`order_number` en schrijft hij hooguit de klantnotitie opnieuw (zoals bij de eerste keer).

**Verificatie**
- `deno check` storefront-api + horeca-device-push: exit 0.
- `scripts/promo-compare/qrStatus.test.ts` (nieuw, 17 tests): 0 failed. Dekt de drie
  herhaal-vormen, de oude fout, een order van een andere tenant, vrijgeven enkel op dezelfde tafel en
  vóór de start.
- Bestaande harnassen: tableRequest 6/6, tableCheckPay 10/10, event409 5/5, resolve 4/4,
  billingLock 12/12, ticketResend 4/4, horecaDevicePush 5/5.
- Rooktest `smoke.ts` (lokaal, import map naar npm): "Rooktest storefront-api groen".

**Bewust ongemoeid / Vervolg**
- Twee *gelijktijdige* `checkout_complete` op hetzelfde nog niet omgezette mandje (dubbel tikken in
  dezelfde milliseconde) kunnen nog steeds elk een order maken: dat is een race in de bestaande
  flow (geen lock op het mandje), niet het netwerkfout-geval. Vervolgbatch: een atomische
  "claim" op `storefront_carts` (update … where checkout_status <> 'converted' returning) vóór de order.
- De Stripe-webhook (`stripe-connect-webhook`) zet `converted_order_id` niet; niet nodig (Stripe-orders
  worden via de sessie gevonden), dus die functie hoeft niet mee gedeployed te worden.
- Stripe vóór betaling: een herhaling maakt (zoals voorheen) een nieuwe sessie. Hergebruik van een
  open sessie is een aparte keuze (bedrag kan intussen veranderd zijn).

**Changelog (NL)**
- Titel: Opnieuw afrekenen na een haperende verbinding geeft geen foutmelding meer
- Beschrijving: Valt de verbinding weg net na het afrekenen en probeert je klant opnieuw, dan ziet hij
  gewoon de bevestiging van zijn bestelling in plaats van een foutmelding. Betaalt een gast de
  tafelrekening online en loopt dat mis, dan kan hij verder betalen of opnieuw beginnen zonder dat de
  rekening vastloopt.

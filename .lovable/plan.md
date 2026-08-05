# CYCLE-3 — Webhook als enige factureer-plek voor pay-first

## Doel
Bij pay-first abonnementen maakt de runner geen factuur. Zodra de betaling bij Stripe lukt, maakt de webhook de factuur aan als betaalbewijs (status betaald), koppelt die aan de billing cycle, genereert PDF/UBL en mailt de klant. Het bestaande invoice-first pad blijft ongewijzigd.

## 1. Tak-logica en plaatsing (`_shared/subscriptionCharge.ts`)

Plaatsing: nieuwe tak **vóór** de bestaande `invoice_id`-tak, direct na de event-type filter.

```text
payment_intent.succeeded|payment_failed
  ├─ metadata.billing_cycle_id aanwezig?  → nieuwe pay-first tak → return true
  ├─ metadata.invoice_id aanwezig?        → bestaande tak (byte-voor-byte ongewijzigd)
  └─ anders                               → return false
```

Praktisch: de huidige functie wordt de private helper `handleInvoiceCharge()` (inhoud onveranderd, alleen verplaatst), plus een nieuwe `handleCycleCharge()`; `handleSubscriptionChargeWebhook` wordt een dispatcher op metadata. Het `SupabaseLike`-type wordt uitgebreid met `rpc` en `functions.invoke` (nu alleen `from`).

### succeeded met `billing_cycle_id`
1. Cycle laden (`billing_cycles`: id, tenant_id, customer_id, subscription_id, period_start, period_end, subtotal, vat_amount, total, status, invoice_id). Niet gevonden → log + `return true`.
2. Idempotentie: `status === 'settled' || invoice_id !== null` → log + `return true`. Filter kijkt **uitsluitend** naar deze twee velden, dus `pending`, `processing`, `awaiting_payment`, `expired` en `reopened` lopen alle door dezelfde code — het reopened/expired-geval heeft daarmee geen aparte tak nodig (bevestigd).
3. `generate_invoice_number(cycle.tenant_id)` via rpc.
4. Insert in `invoices`: status `paid`, `paid_at = now()`, `issue_date = due_date = vandaag (UTC date)`, `subtotal`/`tax_amount`/`total` = `Number()` van de cycle-kolommen, `subscription_id`, `customer_id`, `tenant_id`, `stripe_payment_intent_id` indien de kolom bestaat (anders overslaan). `.select().single()`.
5. Eén `invoice_lines`-regel (zie §2).
6. Cycle updaten: `status='settled'`, `invoice_id`, `stripe_payment_intent_id = intent.id`, met guard `.is('invoice_id', null)` zodat een parallelle webhook nooit overschrijft. 0 rijen geraakt → er was al een factuur: log en stop (weesfactuur-risico, zie risico's).
7. Best-effort `generate-subscription-invoice-pdf` via service-role fetch (zelfde patroon als de runner). Odoo-sync pakt de betaalde factuur daarna via de bestaande hourly cron op.
8. Best-effort `send-invoice-email` (`{ invoice_id }`), variant zonder betaalinstructies aangezien de factuur al betaald is. Fouten worden gelogd, nooit gethrowd.
9. `return true`.

### payment_failed met `billing_cycle_id`
- `billing_cycles` update naar `status='awaiting_payment'` met `.neq('status','settled')` en `.is('invoice_id', null)`; `due_date`/`grace_until` worden **niet** aangeraakt (runner zette die al). Alleen als beide leeg zijn worden ze gevuld (due = vandaag, grace = +7 dagen).
- `last_charge_attempt_at`/attempt-teller wordt alleen bijgewerkt als zulke kolommen op `billing_cycles` bestaan; anders overgeslagen (geen schemawijziging in deze batch).
- De bestaande mandaat-detach/revoke-detectie wordt gedeeld met de invoice-tak (uitgetrokken naar `flagMandateIfDetached()`) en ook hier aangeroepen.
- Geen herinneringen of suspensie — dat is CYCLE-2/LOCK-1.

## 2. invoice_lines-ontwerp + trade-off
Eén regel:
- `description`: `<subscription.name> (<period_start> t/m <period_end>)` (datums in NL-notatie), fallback `"Abonnement"` als de subscription niet meer te laden is.
- `quantity: 1`, `unit_price = net_amount = cycle.subtotal`, `vat_amount = cycle.vat_amount`, `line_total = gross_amount = cycle.total`, `line_type: 'product'`, `sort_order: 0`.
- `vat_rate`: **afgeleid uit de cycle-totalen** — `round(vat_amount / subtotal * 100, 2)`, met `0` als subtotal 0 is.

Trade-off: de actuele `subscription_lines` bevatten meer detail en een expliciet btw-percentage, maar kunnen tussen cycle-aanmaak en betaling gewijzigd zijn (downgrade, prijswijziging). De cycle-totalen zijn wat er daadwerkelijk geïnd is en dus de waarheid op de factuur. Daarom: bedragen altijd uit de cycle, tarief afgeleid. Bij een niet-standaard afgeleide waarde (bijv. 20,99) rondt de weergave op 2 decimalen; als het afgeleide tarief binnen 0,05 van een gangbaar tarief ligt (0/6/12/21) wordt dat tarief gebruikt zodat de btw-rapportage in de juiste vakken valt.

## 3. Idempotentie- en race-analyse
- **Dubbele webhook (zelfde event 2x)**: run 2 ziet `settled`/`invoice_id` en stopt. Bij exact gelijktijdige verwerking beschermt de `.is('invoice_id', null)`-guard op de cycle-update; de verliezer logt en stopt.
- **Pending-race (instant kaart, runner nog niet klaar)**: de tak filtert niet op status, dus een cycle op `pending` settelt gewoon. De pending-sweep van de runner ziet daarna `settled` en moet die overslaan — de sweep-query wordt gecontroleerd en desnoods aangescherpt op `status='pending'` én `invoice_id is null`.
- **failed ná succeeded** (retry-volgorde omgedraaid): de failed-update heeft `.neq('status','settled')` + `.is('invoice_id', null)`, dus een gesettelde cycle wordt nooit teruggezet.
- **succeeded ná failed**: normaal geval, cycle op `awaiting_payment` settelt door (reopened-pad).
- **Crash tussen invoice-insert en cycle-update**: de factuur bestaat dan zonder cycle-link. Facturen worden nooit verwijderd; herstel is een handmatige/administratieve actie. Beperkend: de cycle-update volgt direct op de insert, vóór PDF en mail.

## 4. Deploy-lijst
- `platform-stripe-webhook`
- `stripe-connect-webhook`

Beide embedden `_shared`, dus beide moeten opnieuw uitgerold worden. `stripe-connect-webhook` heeft verder niets extra nodig: hij roept de handler al met een service-role client aan en vangt de payment_intent-events al af; de tak gebruikt dezelfde client. De runner wordt alleen opnieuw gedeployed als de sweep-query aangescherpt moet worden.

## 5. Risico's
- Weesfactuur als de cycle-update faalt na de invoice-insert (zie boven) — zichtbaar in logs, factuur blijft staan.
- Afgeleid btw-tarief kan afwijken van het bedoelde tarief bij gemengde tarieven binnen één abonnement; de cycle houdt maar één totaal bij. Voor abonnementen met meerdere tarieven blijft invoice-first veiliger.
- Factuurnummers worden pas bij betaling uitgegeven, dus de nummering volgt de betaal- en niet de periode-volgorde.
- Mail en PDF zijn best-effort: bij uitval krijgt de klant de belofte "factuur direct na betaling" niet waargemaakt; er is nog geen retry-mechanisme (kandidaat voor CYCLE-2).

## 6. Open vragen
1. Bestaat er op `billing_cycles` al een kolom voor het intent-id en/of attempt-teller die de failed-tak mag vullen, of laten we die velden hier volledig ongemoeid?
2. Moet de mail ook uitgaan als `subscriptions.auto_send` uit staat? Voorstel: bij pay-first altijd mailen, omdat de factuur het betaalbewijs is.
3. Bij `expired` → betaald: eerst kort naar `reopened` en dan `settled`, of in één stap naar `settled`? Voorstel: één stap, met logregel dat het een heropening was.

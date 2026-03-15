

## Twee problemen gevonden

### Probleem 1: Dubbele e-mail bij nieuwe bestelling

Er zijn **twee database triggers** op de `orders` tabel die allebei afgaan wanneer `payment_status` naar `'paid'` verandert:

1. **`handle_order_notification`** — stuurt een `order_new` notificatie (bij INSERT met paid, of UPDATE naar paid)
2. **`handle_payment_notification`** — stuurt een `order_paid` notificatie (bij UPDATE van payment_status)

Beide inserts in de `notifications` tabel triggeren vervolgens `notify_email_on_notification`, die het `create-notification` edge function aanroept voor e-mailverzending. Resultaat: **2 e-mails** ("Nieuwe bestelling" + "Betaling ontvangen") voor dezelfde bestelling.

**Oplossing**: De `handle_payment_notification` trigger moet de `'paid'` case overslaan, aangezien `handle_order_notification` dit al afhandelt. Alleen `'failed'` en `'refunded'` blijven relevant.

```sql
-- In handle_payment_notification: verwijder de WHEN 'paid' case
-- Alleen 'failed' en 'refunded' behouden
```

### Probleem 2: Klanten krijgen GEEN automatische Track & Trace e-mail

De huidige flow:
- Tracking wordt ingevuld (handmatig of via Bol.com sync)
- De **merchant** krijgt een in-app notificatie (`order_shipped`)
- Maar er is **geen automatische klant-e-mail** met de trackingcode

Klant-e-mails worden alleen verstuurd als een admin handmatig "Klant informeren" aanvinkt in het tracking-formulier (`useOrderShipping` hook met `notifyCustomer=true`). Er is geen trigger die automatisch een e-mail naar de klant stuurt wanneer tracking wordt toegevoegd.

**Oplossing**: Een nieuwe database trigger aanmaken die detecteert wanneer `tracking_number` wordt ingevuld op een order, en dan automatisch een klant-e-mail verstuurt via `send-customer-message`.

### Technische wijzigingen

**1. Database migratie — Fix dubbele notificatie**

Pas `handle_payment_notification` aan: verwijder de `WHEN 'paid'` case zodat alleen `failed` en `refunded` notificaties overblijven.

**2. Database migratie — Auto Track & Trace e-mail naar klant**

Nieuwe trigger functie `auto_send_tracking_email`:
- Triggered op UPDATE van `orders` tabel
- Conditie: `tracking_number` verandert van NULL naar een waarde, EN `customer_email` is ingevuld
- Roept `send-customer-message` edge function aan via `pg_net` met een tracking e-mail template
- Bevat carrier naam, tracknummer, en tracking URL
- Respecteert de `customer_communication_settings` tabel (als die bestaat) voor opt-out

**3. Edge function update niet nodig** — `send-customer-message` bestaat al en ondersteunt de benodigde functionaliteit.

### Samenvatting

| Wijziging | Doel |
|-----------|------|
| `handle_payment_notification`: verwijder `'paid'` case | Fix dubbele e-mail bij nieuwe bestelling |
| Nieuwe trigger `auto_send_tracking_email` | Automatische klant-e-mail bij tracking update |


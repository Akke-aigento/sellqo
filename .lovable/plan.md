

## Analyse: 3x bestelbevestiging email

### Het probleem

Er zijn **3 email-bronnen** die afgaan bij elke Bol.com bestelling:

```text
Bol.com order binnenkomt
       │
       ▼
sync-bol-orders INSERT in orders (payment_status='paid')
       │
       ├──► DB trigger handle_order_notification()
       │         │
       │         ▼
       │    send_notification() → INSERT in notifications (type: order_new)
       │         │
       │         ▼
       │    trigger_notification_email → create-notification edge fn → EMAIL #1
       │
       └──► sync-bol-orders roept EXPLICIET create-notification aan (type: marketplace_order_new)
                  │
                  ├──► create-notification INSERT in notifications
                  │         │
                  │         ▼
                  │    trigger_notification_email → create-notification → EMAIL #2
                  │
                  └──► create-notification zelf stuurt OOK email → EMAIL #3
```

**Email #1**: `order_new` — via DB trigger op `orders` tabel → `notifications` insert → `trigger_notification_email`
**Email #2**: `marketplace_order_new` — via de `trigger_notification_email` op de `notifications` tabel (recursief)
**Email #3**: `marketplace_order_new` — via de expliciete `create-notification` call vanuit `sync-bol-orders` die zelf ook een email stuurt

### Oorzaak

Het probleem is **dubbele email-paden**: de `create-notification` edge function stuurt zelf een email EN de `trigger_notification_email` DB trigger roept diezelfde edge function nóg een keer aan na de INSERT.

### Oplossing

**Twee fixes:**

1. **`sync-bol-orders/index.ts`**: Verwijder de expliciete `create-notification` aanroep voor `marketplace_order_new`. De `order_new` notificatie via de DB trigger is voldoende — dit is dezelfde bestelling. Als je het marketplace-type wilt behouden, verander dan de DB trigger om `marketplace_order_new` te gebruiken voor orders met `marketplace_source IS NOT NULL`.

2. **`create-notification/index.ts`**: Voeg een guard toe zodat de edge function GEEN email stuurt als `skip_in_app = true` (want dan is hij al aangeroepen vanuit de DB trigger die de email al afhandelt). OF verwijder de `trigger_notification_email` DB trigger en laat het email-versturen volledig aan de edge function over.

**Aanbevolen aanpak** (minste risico):
- Verwijder de expliciete `create-notification` call uit `sync-bol-orders` (deze is overbodig want de DB trigger doet dit al)
- In `create-notification`: als `skip_in_app = true`, sla alleen de email-logica uit (de aanroeper is de DB trigger, niet een "echte" caller)

Dit reduceert het naar **1 email per bestelling** via het pad: `orders INSERT → handle_order_notification → send_notification → notifications INSERT → trigger_notification_email → create-notification (skip_in_app=true, stuurt email)`.

### Bestanden die gewijzigd worden
- `supabase/functions/sync-bol-orders/index.ts` — verwijder expliciete `create-notification` call
- `supabase/functions/create-notification/index.ts` — email NIET versturen wanneer `skip_in_app = false` (de directe call), omdat de trigger dat al doet. Of omgekeerd: alleen email sturen bij de trigger-call.


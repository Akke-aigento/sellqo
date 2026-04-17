

## Probleem
De `send-order-confirmation` edge function faalt voor élke bestelling met:
> `column tenants_1.contact_email does not exist`

De function selecteert `tenants(... support_email, contact_email, ...)` maar in de `tenants` tabel bestaat alleen `support_email` (en `owner_email`, `billing_email`, `notification_email`) — géén `contact_email`. Hierdoor wordt de order opgehaald maar de query crasht direct, waardoor er nooit een mail uitgaat.

## Fix
In `supabase/functions/send-order-confirmation/index.ts`:

1. **Regel 243-244** — verwijder `contact_email` uit de tenants select:
   ```ts
   tenants(name, primary_color, logo_url, support_email,
     street, house_number, postal_code, city, country),
   ```

2. **Regel 274** — vervang fallback chain door bestaande kolommen:
   ```ts
   const supportEmail = tenant?.support_email || tenant?.owner_email || 'admin@sellqo.app';
   ```
   (en `owner_email` toevoegen aan select indien nodig als extra fallback)

3. **Redeploy** `send-order-confirmation`.

## Verificatie achteraf
- Plaats nieuwe testbestelling → check edge function logs op `Email sent successfully` ipv error
- Klant ontvangt branded "Bedankt voor je bestelling" mail

## Optioneel: handmatig versturen voor de gemiste order
Order `35e73fc7-d1f8-43b5-a055-39b4d7288cef` is nooit bevestigd per mail. Na de fix kunnen we deze handmatig opnieuw triggeren door `send-order-confirmation` aan te roepen met dat order_id, zodat jij/de klant alsnog de bevestiging krijgt.

## Niet aanraken
- Geen wijziging aan trigger-points (stripe-connect-webhook, storefront-api) — die werken correct.
- Geen wijziging aan layout/templates — die zijn goed.


# Fix: "Bekijk bestelling" link in notificatie-emails werkt niet

## Probleem

De `action_url` in de `notifications` tabel is opgeslagen als **relatief pad**, bijv:
- `/admin/orders/13eec77c-7b7f-4624-bda4-7a4413d1fbee`
- `/admin/invoices?invoice=5377c52b-...`

In de in-app notificaties werkt dat prima (React Router navigeert intern), maar in de email wordt het direct in `<a href="/admin/orders/...">` gezet. Email-clients (Gmail, Outlook) hebben geen base URL, dus de link doet niets / opent een ongeldige URL.

## Oplossing

In `supabase/functions/create-notification/index.ts` het relatieve pad omzetten naar een absolute URL voordat het in de email-HTML wordt geplaatst.

### Logica voor base URL bepaling

1. Probeer eerst een env var `ADMIN_BASE_URL` (zodat we per omgeving kunnen overrulen)
2. Fallback naar `https://sellqo.app` (productie admin)
3. Als `action_url` al begint met `http://` of `https://` → laat ongemoeid (al absoluut)
4. Als het begint met `/` → prefix met base URL
5. Anders → prefix met base URL + `/`

### Concrete wijziging

In de email-HTML template, vervang:
```js
<a href="${notification.action_url}" ...>
```

Door een vooraf berekende `fullActionUrl`:
```js
const ADMIN_BASE_URL = Deno.env.get('ADMIN_BASE_URL') || 'https://sellqo.app';
const fullActionUrl = notification.action_url
  ? (notification.action_url.startsWith('http')
      ? notification.action_url
      : `${ADMIN_BASE_URL}${notification.action_url.startsWith('/') ? '' : '/'}${notification.action_url}`)
  : null;
```

En dan in de HTML `${fullActionUrl}` gebruiken in plaats van `${notification.action_url}`.

## Wat NIET wijzigt

- De `notifications.action_url` kolom blijft relatieve paden opslaan (in-app navigatie blijft werken zoals nu).
- Andere callers die `action_url` zetten (`stripe-connect-webhook`, `storefront-api`, `sync-bol-orders`, `check-scheduled-notifications`, etc.) hoeven niets aan te passen.
- Alleen de email-rendering in `create-notification` wordt gefixt.

## Bestanden

- `supabase/functions/create-notification/index.ts` — base URL prefix logica toevoegen + email HTML aanpassen
- Deploy de edge function

## Test

Na deploy: trigger een nieuwe order-notificatie (of stuur een test door met `notification_email`) en controleer dat de "Bekijk details →" link in de mail nu naar `https://sellqo.app/admin/orders/...` gaat en de juiste pagina opent.

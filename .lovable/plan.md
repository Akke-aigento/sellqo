

## Automatische Verzendstatus Updates

### Wat ontbreekt

De infrastructuur is er al grotendeels:
- `tenant_tracking_settings` tabel met 17TRACK API key veld en polling interval
- `tracking_status` en `last_tracking_check` kolommen op orders
- `shipping_status_updates` tabel voor event history
- UI in instellingen voor 17TRACK configuratie

Maar er is **geen edge function** die daadwerkelijk de tracking API pollt en statussen bijwerkt. Dat is het missende puzzelstuk.

### Plan

**1. Nieuwe edge function: `poll-tracking-status`**

Een cron-achtige functie die:
- Alle tenants met `auto_poll_17track = true` en een API key ophaalt
- Per tenant alle orders met status `shipped` + `tracking_number` die langer dan `poll_interval_hours` geleden (of nooit) gecheckt zijn
- In batches de 17TRACK API aanroept (`POST https://api.17track.net/track/v2.2/gettrackinfo`)
- De response mapt naar genormaliseerde statussen (shipped → in_transit → out_for_delivery → delivered / exception)
- De order `tracking_status`, `last_tracking_check`, en eventueel `status` + `delivered_at` bijwerkt
- Een record in `shipping_status_updates` toevoegt per statuswijziging
- Klantnotificaties triggert op basis van de tenant notificatie-instellingen

**2. Database cron job**

SQL migration om een `pg_cron` job toe te voegen die `poll-tracking-status` elke 30 minuten aanroept (vergelijkbaar met de bestaande `marketplace-sync-scheduler`).

**3. UI: Tracking status badge op order detail**

In `TrackingInfoCard.tsx` een visuele status badge tonen (bijv. "Onderweg", "Bezorgd", "Probleem") op basis van `tracking_status`, plus de laatste check-tijd.

### Technische details

**17TRACK API call:**
```typescript
const response = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', {
  method: 'POST',
  headers: { '17token': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify([{ number: trackingNumber, carrier: carrierCode }])
});
```

**Status mapping:**
- 17TRACK statuscodes: 0=NotFound, 10=InTransit, 20=Expired, 30=PickedUp, 35=Undelivered, 40=Delivered, 50=Alert
- → SellQo: `not_found`, `in_transit`, `out_for_delivery`, `delivered`, `exception`

### Bestanden

| Actie | Bestand |
|-------|---------|
| Nieuw | `supabase/functions/poll-tracking-status/index.ts` |
| Migration | Cron job voor polling elke 30 min |
| Edit | `src/components/admin/TrackingInfoCard.tsx` — status badge + laatste check |
| Edit | `src/types/order.ts` — tracking_status toevoegen aan Order type |


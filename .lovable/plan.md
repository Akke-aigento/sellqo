

## Probleem: Tracking status wordt nooit bijgewerkt

### Root cause gevonden

De cron job `poll-tracking-status-every-30min` draait elke 30 minuten, maar de `pg_net.http_post` call heeft een **standaard timeout van 5 seconden**. De `poll-tracking-status` functie moet voor elke order een externe carrier API aanroepen (bpost, PostNL, etc.), wat veel langer duurt dan 5 seconden.

Bewijs uit `net._http_response`:
- Elke 5 minuten verschijnen er 2 timeouts: `"Timeout of 5000 ms reached"`
- `tracking_status` en `last_tracking_check` zijn **NULL** op alle orders
- Er zijn **geen logs** voor de `poll-tracking-status` functie (request wordt afgebroken voordat de functie kan antwoorden)

Daarnaast ontbreekt `poll-tracking-status` in `config.toml` (`verify_jwt` defaults to `true`), wat een extra faalreden kan zijn als de anon key niet geaccepteerd wordt.

### Oplossing

**1. Config.toml — `verify_jwt = false` toevoegen**

Voeg `[functions.poll-tracking-status]` toe met `verify_jwt = false` zodat de cron job correct kan authenticeren.

**2. Cron job updaten met langere timeout**

Verwijder de oude cron job en maak een nieuwe aan met `timeout_milliseconds := 25000` (25 seconden) in de `net.http_post` call.

```sql
SELECT cron.unschedule('poll-tracking-status-every-30min');

SELECT cron.schedule(
  'poll-tracking-status-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := '...',
    headers := '...'::jsonb,
    body := '...'::jsonb,
    timeout_milliseconds := 25000
  ) AS request_id;
  $$
);
```

**3. Edge function optimaliseren — paralleliseren en batch-limiet verlagen**

De functie pollt nu tot 40 orders sequentieel. Verander naar:
- Batch-limiet van 10 orders per run (minder kans op timeout)
- `Promise.allSettled()` voor parallelle carrier API calls (max 5 tegelijk)
- Early response pattern: stuur direct een 200 terug en verwerk op de achtergrond (niet nodig bij langere timeout, maar als optimalisatie)

### Samenvatting wijzigingen

| Bestand / Actie | Wijziging |
|-----------------|-----------|
| `supabase/config.toml` | `[functions.poll-tracking-status]` met `verify_jwt = false` toevoegen |
| SQL (direct uitvoeren) | Cron job opnieuw aanmaken met `timeout_milliseconds := 25000` |
| `supabase/functions/poll-tracking-status/index.ts` | Batch-limiet verlagen naar 10, carrier calls paralleliseren |


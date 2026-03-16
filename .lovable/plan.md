
Diagnose (grondig nagekeken)

1) De cron draait wél en pakt orders op  
- Job `poll-tracking-status-every-30min` staat actief.  
- Logs tonen: `Polling 8 orders...` gevolgd door `Polling complete. 0 orders updated`.

2) Kernfout in de bpost-fetcher (echte blocker)  
- `poll-tracking-status` gebruikt nu:  
  `https://track.bpost.cloud/btr/web/api/items?...`  
- Deze URL geeft HTML terug (doctype), geen JSON → parse error (`Unexpected token '<'`), exact zoals in logs.

3) Tweede blocker: voor sommige bpost-codes is postcode nodig  
- Voor 24-cijferige `3232...` codes geeft endpoint zonder postcode vaak `NO_DATA_FOUND`.  
- Met postcode uit afleveradres geeft dezelfde code wel geldige tracking-events terug.

4) Waarom “blijft hangen” zichtbaar in UI  
- Bij fetch-fail wordt geen status geüpdatet → `tracking_status` blijft `NULL`.  
- Daardoor blijft de badge leeg en lijkt auto-update “kapot”.

Implementatieplan

1. bpost endpoint vervangen in `supabase/functions/poll-tracking-status/index.ts`  
- Van `/btr/web/api/items` naar `/track/items`.  
- Robuuste parsing: eerst JSON, fallback op tekst-parsing als response niet proper JSON is.

2. Postcode meenemen in polling-query en bpost-call  
- In order-select ook `shipping_address` (en fallback `billing_address`) ophalen.  
- `fetchBpost(trackingNumber, postalCode?)` maken en postcode normaliseren (spaties eruit, uppercase).

3. Statusmapping verbeteren voor nieuwe bpost payload  
- Beschrijving halen uit `events[0].key.NL.description` (fallback EN/FR/DE).  
- `DELIVERED`/`DELIVERED_TO_SAFEPLACE` en “geleverd” correct mappen naar `delivered`.  
- `NO_DATA_FOUND` mappen naar `not_found` (i.p.v. silent failure).

4. Retry-gedrag stabiel maken  
- Bij mislukte fetch toch `last_tracking_check` updaten (zodat niet elke run direct opnieuw blijft hameren).  
- Alleen `tracking_status` aanpassen wanneer er een betrouwbare status is.

5. Validatie na implementatie  
- Handmatige run van `poll-tracking-status` en logs controleren: geen JSON parse errors meer.  
- Verifiëren dat orders zoals #1123–#1126 een `tracking_status` krijgen en dat delivered-orders automatisch op `delivered` springen.  
- UI-check: badge + “Gecheckt x geleden” zichtbaar en automatisch bijgewerkt.

Technische impact

- Geen database migratie nodig.  
- Alleen edge function aanpassing (polling logic + bpost fetch).  
- Bestaande cron kan ongewijzigd blijven.

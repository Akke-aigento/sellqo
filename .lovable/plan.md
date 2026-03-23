

## Fix: Tracking URLs in Bol.com edge functions (`jfrfracking.info` → juiste carrier URLs)

### Analyse

De `jfrfracking.info` URL is **geen bewuste keuze** — het is een kapot placeholder-domein dat niet werkt. Het wordt op **5 plekken** gebruikt als fallback `tracking_url` wanneer een tracking nummer wordt opgeslagen. De hele Bol.com API-flow (shipment creation, label fetching, retry logic, v10 API calls) blijft **100% ongewijzigd**. We passen alleen de string aan die de tracking URL genereert.

### Wat verandert

**1. Nieuwe shared helper** — `supabase/functions/_shared/carrierTrackingUrls.ts`
Een kleine functie die dezelfde URL-patronen bevat als de frontend `carrierPatterns.ts`:
- `BPOST_BE` / `bpost` → `https://track.bpost.cloud/btr/web/#/search?itemCode={tracking}`
- `TNT` / `postnl` → `https://postnl.nl/tracktrace/?B={tracking}`
- `DHL` → `https://www.dhl.com/nl-nl/home/tracking.html?tracking-id={tracking}`
- etc.

**2. `confirm-bol-shipment/index.ts`** — 2 plekken
Regel 256 en 308: `jfrfracking.info` template vervangen door helper-call. Verder niets.

**3. `create-bol-vvb-label/index.ts`** — 3 plekken
Regel 287, 526 en 956: zelfde vervanging. Verder niets.

**4. Database fix** — eenmalige migratie
```sql
UPDATE orders 
SET tracking_url = CASE 
  WHEN carrier ILIKE '%bpost%' THEN 'https://track.bpost.cloud/btr/web/#/search?itemCode=' || tracking_number
  WHEN carrier ILIKE '%postnl%' OR carrier = 'TNT' THEN 'https://postnl.nl/tracktrace/?B=' || tracking_number
  ELSE 'https://17track.net/nl/track?nums=' || tracking_number
END
WHERE tracking_url LIKE '%jfrfracking.info%' AND tracking_number IS NOT NULL;
```

### Wat NIET verandert
- Bol.com API calls (POST /shipments, GET /shipping-labels, etc.)
- Shipment creation logica, retry logica, PDF crop logica
- Label opslag flow
- `update-bol-tracking` edge function
- Frontend code (`carrierPatterns.ts`, `TrackingInfoCard.tsx`, `useOrderShipping.ts`)
- DB triggers, sync_status logica, shipped_awaiting_tracking flow

### Bestanden
- `supabase/functions/_shared/carrierTrackingUrls.ts` — nieuw (klein helper bestand)
- `supabase/functions/confirm-bol-shipment/index.ts` — 2x string replacement
- `supabase/functions/create-bol-vvb-label/index.ts` — 3x string replacement
- Database migratie — bestaande foute URLs corrigeren


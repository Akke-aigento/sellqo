

# Fix: Accept status moet geverifieerd worden bij Bol.com

## Het probleem

De `accept-bol-order` functie zet de order **meteen** op `sync_status: 'accepted'` zodra Bol.com een HTTP 200 teruggeeft. Maar bij Bol.com v10 API betekent een 200 alleen **"verzoek ontvangen"** -- het daadwerkelijke resultaat komt pas later via de `processStatusId`. De accept kan nog FAILURE of TIMEOUT worden.

```text
Huidige (foute) flow:
1. PUT /orders/{id}/accept -> 200 OK + processStatusId
2. sync_status = 'accepted'  <-- METEEN, zonder verificatie
3. processStatusId wordt WEGGEGOOID en nooit gecontroleerd

Wat er moet gebeuren:
1. PUT /orders/{id}/accept -> 200 OK + processStatusId
2. sync_status = 'accept_pending' + processStatusId opslaan
3. Poll process-status tot SUCCESS/FAILURE
4. Alleen bij SUCCESS -> sync_status = 'accepted'
5. Bij FAILURE -> sync_status = 'accept_failed'
```

Daarnaast: de retry-logica (regel 624-633) markeert orders als `'accepted'` bij een Bol.com 403 fout, wat ook onbetrouwbaar is.

## Oplossing

### 1. Bestand: `supabase/functions/accept-bol-order/index.ts`

- Na een succesvolle 200 response: `sync_status` op `'accept_pending'` zetten (niet `'accepted'`)
- De `processStatusId` opslaan in de order (nieuw veld of in `raw_marketplace_data`)
- De process status **pollen** (max 10 pogingen, 2 sec interval) -- vergelijkbaar met hoe `create-bol-vvb-label` dit al doet
- Alleen bij `SUCCESS` -> `sync_status = 'accepted'`
- Bij `FAILURE` of `TIMEOUT` -> `sync_status = 'accept_failed'` met foutmelding

### 2. Database: nieuw veld toevoegen

Kolom `bol_process_status_id` (text, nullable) toevoegen aan de `orders` tabel om de process status ID op te slaan voor tracking.

### 3. Bestand: `supabase/functions/sync-bol-orders/index.ts`

**Retry-blok aanpassen:**
- Naast `sync_status = 'synced'` ook zoeken naar `sync_status = 'accept_pending'` (orders waarvan de poll mislukt is)
- Voor `'accept_pending'` orders: eerst de opgeslagen `processStatusId` controleren via de Bol.com process-status API
- Bij SUCCESS -> `'accepted'`, bij FAILURE -> `'accept_failed'`
- De 403-fallback verwijderen die nu onterecht orders als accepted markeert (regel 624-633)

**VVB retry-blok:**
- Blijft zoeken op `sync_status = 'accepted'` (nu betrouwbaar omdat het pas op accepted staat na echte Bol.com verificatie)

### 4. Bestand: Frontend status weergave

De UI moet `'accept_pending'` en `'accept_failed'` statussen correct tonen zodat de gebruiker ziet wat er aan de hand is.

## Technische details

- De Bol.com process-status API endpoint is: `GET /retailer/process-status/{processStatusId}`
- Mogelijke statussen: `PENDING`, `SUCCESS`, `FAILURE`, `TIMEOUT`
- De poll-logica is al bewezen in `create-bol-vvb-label` (15 pogingen, 2 sec interval)
- Voor accept gebruiken we 10 pogingen met 2 sec interval (20 sec max) -- accepts zijn sneller dan labels
- Als de poll niet klaar is binnen die tijd, blijft de status op `'accept_pending'` en pakt de retry het op bij de volgende sync-cycle
- De `processStatusId` wordt opgeslagen zodat we bij retry niet opnieuw hoeven te accepten, maar gewoon de status kunnen checken


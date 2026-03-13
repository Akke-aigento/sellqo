

## Track & Trace automatisch updaten bij Bol.com

### Probleem

De huidige flow:
1. VVB label wordt aangemaakt → tracking nummer is vaak nog niet beschikbaar
2. `confirm-bol-shipment` maakt een shipment aan bij Bol.com **zonder** tracking
3. Later komt het tracking nummer beschikbaar (via `poll-tracking-status` of `tracking-webhook`)
4. Het tracking nummer wordt lokaal opgeslagen, maar **nooit teruggestuurd naar Bol.com**

Bol.com vereist een track & trace code. De API ondersteunt dit via `PUT /retailer/transports/{transportId}` om tracking achteraf toe te voegen aan een bestaand shipment.

### Oplossing

**Twee aanpassingen:**

#### 1. Transport ID opslaan bij shipment creation
**Bestand: `supabase/functions/confirm-bol-shipment/index.ts`**

Na het succesvol aanmaken van een shipment retourneert Bol.com een `processStatusId`. We moeten ook het `shipmentId` of `transportId` opvragen. Alternatief: we slaan op dat tracking nog moet worden geüpdatet en gebruiken de shipments API om het `transportId` op te halen wanneer tracking beschikbaar komt.

- Voeg een veld `bol_transport_id` toe aan de order update (of gebruik `raw_marketplace_data`)
- Als er géén tracking nummer was bij shipment creation, markeer de order met `sync_status: 'shipped_awaiting_tracking'`

#### 2. Tracking updaten bij Bol.com wanneer het beschikbaar wordt
**Nieuw bestand: `supabase/functions/update-bol-tracking/index.ts`**

Een nieuwe edge function die:
1. Orders zoekt met `sync_status = 'shipped_awaiting_tracking'` en een `tracking_number`
2. Het `transportId` ophaalt via `GET /retailer/shipments?order-id={bolOrderId}`
3. `PUT /retailer/transports/{transportId}` aanroept met het tracking nummer
4. `sync_status` updatet naar `'shipped'`

**Bestand: `supabase/functions/poll-tracking-status/index.ts`**

Na het lokaal updaten van een order die van Bol.com komt en een tracking nummer heeft gekregen:
- Roep `update-bol-tracking` aan om het tracking nummer door te sturen naar Bol.com

**Bestand: `supabase/functions/tracking-webhook/index.ts`**

Dezelfde logica: na het ontvangen van tracking via de webhook, als het een Bol.com order is, roep `update-bol-tracking` aan (dit gebeurt al deels via `confirm-bol-shipment`, maar dat probeert een **nieuw** shipment aan te maken in plaats van tracking te updaten op een bestaand shipment).

#### 3. Fallback in VVB label flow
**Bestand: `supabase/functions/confirm-bol-shipment/index.ts`**

Als er wél tracking is bij shipment creation, gewoon meesturen (dit werkt al). Als er géén tracking is, markeer als `shipped_awaiting_tracking` in plaats van `shipped`.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/update-bol-tracking/index.ts` | **Nieuw** — haalt transportId op en doet `PUT /retailer/transports/{transportId}` |
| `supabase/functions/confirm-bol-shipment/index.ts` | Markeer `shipped_awaiting_tracking` als geen tracking beschikbaar |
| `supabase/functions/poll-tracking-status/index.ts` | Na tracking update van Bol.com order → trigger `update-bol-tracking` |
| `supabase/functions/tracking-webhook/index.ts` | Vervang `confirm-bol-shipment` aanroep door `update-bol-tracking` voor orders die al shipped zijn |


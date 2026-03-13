

## Bol.com Track & Trace wordt niet gesyncht — Root Cause Analyse

### Problemen gevonden

Er zijn **3 problemen** die samen ervoor zorgen dat tracking nooit bij Bol.com terechtkomt:

#### Probleem 1: `sync-bol-orders` overschrijft sync_status
Na het succesvol aanmaken van een VVB label zet `create-bol-vvb-label` de `sync_status` op `shipped` (of `shipped_awaiting_tracking` via `confirm-bol-shipment`). Maar **daarna** overschrijft `sync-bol-orders` (regel 494-497) dit met `sync_status: 'accepted'`. Hierdoor vindt `update-bol-tracking` de order nooit (die zoekt op `shipped_awaiting_tracking`).

```text
Timeline:
  create-bol-vvb-label → sync_status = "shipped"
  confirm-bol-shipment → sync_status = "shipped_awaiting_tracking"  
  sync-bol-orders      → sync_status = "accepted"  ← OVERSCHRIJFT!
  
  update-bol-tracking zoekt: sync_status = "shipped_awaiting_tracking"
  Vindt: niets → tracking wordt nooit gepusht
```

#### Probleem 2: Tracking nummer is nooit opgehaald
De order heeft `tracking_number: null`. Bij VVB labels genereert Bol.com/bpost het tracking nummer, maar dit is vaak pas na enkele minuten beschikbaar. De huidige code probeert het eenmalig op te halen bij label creatie (via HEAD header + shipments API), maar als het er dan nog niet is, wordt het **nooit meer opnieuw geprobeerd**.

`poll-tracking-status` kan alleen orders met een bestaand tracking_number ophalen — het haalt geen tracking OP van Bol.com.

#### Probleem 3: Geen mechanisme om tracking van Bol.com op te halen
Er ontbreekt een periodiek proces dat voor VVB-orders de tracking ophaalt van Bol.com wanneer die pas later beschikbaar komt.

### Oplossing

**3 wijzigingen:**

#### 1. Fix sync_status overwrite in `sync-bol-orders`
**Bestand: `supabase/functions/sync-bol-orders/index.ts`** (regels 491-497)

Na succesvolle VVB label creatie: lees de huidige sync_status terug en overschrijf NIET als die al `shipped` of `shipped_awaiting_tracking` is.

```typescript
// Na VVB label success: alleen naar 'accepted' als status nog lager is
const { data: currentOrder } = await supabase.from('orders')
  .select('sync_status').eq('id', newOrder.id).single();
const currentStatus = currentOrder?.sync_status;
if (!currentStatus || currentStatus === 'pending' || currentStatus === 'accept_pending') {
  await supabase.from('orders').update({
    sync_status: 'accepted',
    updated_at: new Date().toISOString()
  }).eq('id', newOrder.id);
}
```

#### 2. Tracking ophalen van Bol.com voor VVB orders
**Bestand: `supabase/functions/update-bol-tracking/index.ts`**

Voeg een **derde modus** toe: naast single-order en batch-push, ook een batch-**pull** voor orders die `shipped` of `shipped_awaiting_tracking` zijn maar géén tracking_number hebben. Voor deze orders:
1. Haal tracking op via `GET /retailer/shipments?order-id={bolOrderId}`
2. Sla tracking lokaal op
3. Push tracking naar Bol.com transport als dat nodig is

#### 3. Batch mode verbreden
**Bestand: `supabase/functions/update-bol-tracking/index.ts`**

De huidige batch query zoekt alleen op `sync_status = 'shipped_awaiting_tracking'`. Verbreed dit naar ook `sync_status IN ('accepted', 'shipped')` voor orders met status `shipped` maar zonder tracking.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-bol-orders/index.ts` | Stop met overschrijven sync_status naar `accepted` na VVB |
| `supabase/functions/update-bol-tracking/index.ts` | Pull tracking van Bol.com + verbreed batch query |


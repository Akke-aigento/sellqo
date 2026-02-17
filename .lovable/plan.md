

# Fix: Drie bugs in de VVB/Accept flow

## Gevonden problemen

Na analyse van de logs en database voor order #1109 (C0000XML9F):

```text
1. accept-bol-order -> 403 "Unauthorized Request" -> order NIET geaccepteerd
2. sync_status bleef 'synced' (correct door nieuwe code)
3. create-bol-vvb-label WEL aangeroepen, maakt een shipping_labels record aan
   maar met external_id=null, label_url=null, tracking_number=null
4. VVB-RETRY slaat order over omdat er al een shipping_labels record BESTAAT
   (checkt niet of het record compleet is)
5. create-bol-vvb-label heeft nog oude 403-fallback die orders als 'accepted'
   markeert zonder verificatie (regel 448-450)
```

## Drie bugs te fixen

### Bug 1: VVB-RETRY checkt alleen OF een label bestaat, niet of het COMPLEET is

**Bestand:** `supabase/functions/sync-bol-orders/index.ts`

De huidige query zoekt orders zonder shipping_labels record. Maar als een label record bestaat met `external_id = null` en `label_url = null`, wordt de order overgeslagen.

**Fix:** Bij het ophalen van bestaande labels, alleen records meetellen die daadwerkelijk een `external_id` OF `label_url` hebben. Incomplete labels (zonder beide) worden genegeerd zodat de retry ze opnieuw probeert.

### Bug 2: create-bol-vvb-label slaat lege labels op als 'created'

**Bestand:** `supabase/functions/create-bol-vvb-label/index.ts`

Regel 738-753: het label wordt altijd opgeslagen met `status: 'created'`, ook als `transporterLabelId` null is (polling nooit SUCCESS kreeg). Dit maakt dat VVB-RETRY denkt dat het label klaar is.

**Fix:** 
- Als `transporterLabelId` null is, status op `'pending'` zetten in plaats van `'created'`
- Dit zorgt ervoor dat incomplete labels herkenbaar zijn

### Bug 3: create-bol-vvb-label heeft nog oude 403-fallback

**Bestand:** `supabase/functions/create-bol-vvb-label/index.ts`

Regel 448-450: bij een 403 van accept-bol-order wordt de order nog steeds als `'accepted'` gemarkeerd zonder verificatie. Dit is dezelfde bug die we net in sync-bol-orders hebben gefixt.

**Fix:** De 403-fallback verwijderen. Als accept faalt, niet doorgaan met VVB label aanmaak -- laat de retry-logica het oppakken.

### Extra: Order #1109 herstellen

De incomplete shipping_labels record voor order #1109 moet opgeschoond worden zodat de retry het opnieuw kan oppakken.

## Technische details

### sync-bol-orders wijziging (VVB-RETRY)
```text
Huidig:  SELECT order_id FROM shipping_labels WHERE order_id IN (...)
Nieuw:   SELECT order_id FROM shipping_labels WHERE order_id IN (...)
         AND (external_id IS NOT NULL OR label_url IS NOT NULL)
```

### create-bol-vvb-label wijzigingen
1. Label insert: `status: transporterLabelId ? 'created' : 'pending'`
2. Verwijder regel 448-450 (403 fallback die sync_status op 'accepted' zet)
3. Als accept faalt (niet-403), return error in plaats van doorgaan

### Database cleanup
- Verwijder het incomplete shipping_labels record voor order #1109
- Zorg dat sync_status 'synced' blijft zodat de retry het oppakt


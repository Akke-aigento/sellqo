
# Fix: Automatische VVB Label aanmaak na Accept

## Het probleem

De bestelling `C0000XML9F` is correct geimporteerd en automatisch geaccepteerd (sync_status = 'accepted'), maar het VVB label is **niet** aangemaakt. Dit komt door een gat in de retry-logica:

```text
Huidige flow:
1. Order importeren -> sync_status = 'synced'
2. Auto-accept -> sync_status = 'accepted'
3. VVB label aanmaken -> (gebeurt alleen in dezelfde functie-aanroep als stap 2)

Retry mechanisme:
- Zoekt alleen orders met sync_status = 'synced'
- Orders die al 'accepted' zijn worden OVERGESLAGEN
- Er is GEEN retry voor gemiste VVB labels
```

Als de VVB label aanmaak faalt of wordt overgeslagen (bijv. door een timeout, rate limit, of korte fout), is er geen manier om dit later alsnog te doen -- behalve handmatig via de UI.

## Oplossing

Een extra retry-blok toevoegen in `sync-bol-orders` dat specifiek zoekt naar orders die wel geaccepteerd zijn (`sync_status = 'accepted'`) maar nog geen VVB label hebben.

## Wijzigingen

### Bestand: `supabase/functions/sync-bol-orders/index.ts`

Na het bestaande retry-blok voor auto-accept (regel ~648), een nieuw blok toevoegen:

1. **Zoek gemiste VVB labels**: Query orders met:
   - `sync_status = 'accepted'`
   - `marketplace_source = 'bol_com'`
   - `marketplace_connection_id = connection.id`
   - Status is `pending` of `processing` (niet al verzonden)
   - Geen bestaand VVB label in `shipping_labels` tabel

2. **Maak VVB labels aan**: Voor elke gevonden order de `create-bol-vvb-label` edge function aanroepen

3. **Logging**: Duidelijke `[VVB-RETRY]` logging zodat je in de logs kunt zien wat er gebeurt

### Technische details

- Het retry-blok draait alleen als `vvbEnabled = true` in de connection settings
- Er wordt een LEFT JOIN (of subquery) gebruikt om te checken of er al een shipping label bestaat voor de order
- Maximaal 5 orders per sync-cycle om rate limits te voorkomen
- Rate limiting van 1 seconde tussen VVB aanroepen
- Carrier valt terug op `'POSTNL'` als `vvbDefaultCarrier` niet is ingesteld (wat nu het geval is)

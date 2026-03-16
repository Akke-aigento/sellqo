

## Probleem: Tracking fix is gedeployed maar nog niet uitgevoerd

### Wat er aan de hand is

De bpost API geeft **duidelijk "Zending geleverd"** terug voor orders als #1122 (geleverd op 11 maart!), maar de database toont nog `tracking_status = in_transit`.

**Root cause**: De `normalizeStatus` fix (met `geleverd` regex) is pas **na** de laatste poll (11:46) gedeployed. Door het 4-uurs poll-interval worden deze orders pas om ~15:46 opnieuw gecheckt. De oude code die om 11:46 draaide herkende "Zending geleverd" niet.

### Bewijs
- bpost API voor #1122 (`CD116065228BE`): `events[0].key.NL.description = "Zending geleverd"`, `actualDeliveryTime = 2026-03-11 18:29`
- DB: `tracking_status = in_transit`, `last_tracking_check = 11:46`
- Handmatige trigger net: `0 orders updated` (interval-filter blokkeert hercheck)

### Oplossing

**1. Database migratie**: Reset `last_tracking_check` op alle shipped orders zodat ze direct opnieuw gepolled worden. Verlaag ook het poll-interval van 4 naar 1 uur.

```sql
-- Reset timer zodat orders direct opnieuw gecheckt worden
UPDATE orders SET last_tracking_check = NULL
WHERE status = 'shipped' AND tracking_number IS NOT NULL;

-- Poll-interval naar 1 uur (4 uur is te traag)
UPDATE tenant_tracking_settings SET poll_interval_hours = 1;
```

**2. Na deployment**: Handmatig de poll-functie triggeren om direct resultaat te zien. De volgende cron-run (elke 30 min) pakt het daarna automatisch op.

| Wijziging | Doel |
|-----------|------|
| Reset `last_tracking_check` | Orders direct opnieuw laten pollen |
| Poll-interval 4→1 uur | Snellere status-updates voortaan |



# Plan: Fix Klantservice Health Score - Berichten in Prullenbak/Map Uitsluiten

## Probleem

De Shop Health Score toont "Onbeantwoord (48+ uur): 5" maar deze telling klopt niet. Berichten die:
- Naar de prullenbak zijn verplaatst
- Naar een andere map zijn verplaatst
- Gearchiveerd zijn
- Beantwoord zijn

Worden nog steeds meegeteld als "onbeantwoord", terwijl ze eigenlijk niet meer relevant zijn voor de klantservice score.

## Oorzaak

In `src/hooks/useShopHealth.ts` (regel 95-101) wordt gefilterd op:
```typescript
const unreadMessages = messages?.filter(m => 
  m.direction === 'inbound' && m.delivery_status !== 'opened'
) || [];
```

Dit mist de volgende cruciale filters:
- `message_status` (active/archived/deleted)
- `folder_id` (berichten in mappen)
- `replied_at` (reeds beantwoorde berichten)

## Oplossing

Pas de filter in `useShopHealth.ts` aan zodat alleen actieve, onbeantwoorde berichten in de inbox worden meegeteld:

```typescript
// Customer service analysis - only count active inbox messages that need attention
const unreadMessages = messages?.filter(m => 
  m.direction === 'inbound' &&               // Inbound messages only
  !m.read_at &&                               // Not yet opened/read
  !m.replied_at &&                            // Not yet replied to
  (!m.message_status || m.message_status === 'active') &&  // Active status only
  !m.folder_id                                // Not moved to any folder
) || [];
```

Dit zorgt ervoor dat:
1. ✅ Berichten in de prullenbak (`message_status = 'deleted'`) worden **uitgesloten**
2. ✅ Gearchiveerde berichten (`message_status = 'archived'`) worden **uitgesloten**
3. ✅ Berichten in een map (`folder_id !== null`) worden **uitgesloten** 
4. ✅ Beantwoorde berichten (`replied_at !== null`) worden **uitgesloten**
5. ✅ Gelezen berichten (`read_at !== null`) worden **uitgesloten**

## Technische Details

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useShopHealth.ts` | Update filter voor `unreadMessages` op regel 95-101 |

## Resultaat

- Verplaatsen naar prullenbak = bericht telt niet meer mee als onbeantwoord
- Verplaatsen naar map = bericht telt niet meer mee als onbeantwoord  
- Archiveren = bericht telt niet meer mee als onbeantwoord
- Beantwoorden = bericht telt niet meer mee als onbeantwoord
- De health score reflecteert nu alleen berichten die daadwerkelijk aandacht nodig hebben

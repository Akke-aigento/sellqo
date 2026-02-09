
# Fix: Automatische Bol.com Synchronisatie Implementeren

## Probleem Geanalyseerd

De automatische synchronisatie werkt niet omdat:

1. **Geen Sync Scheduler Edge Function** - Er is geen cron job of scheduler die periodiek de `sync-bol-orders` en `sync-bol-inventory` edge functions aanroept
2. **Settings worden opgeslagen maar niet gebruikt** - De `syncInterval` (15 minuten) en `autoImport` (true) staan correct in de database, maar er is geen code die hierop reageert
3. **Laatste sync: 3 februari** - Bijna een week geleden, alleen handmatig aangeroepen

### Database Bewijs
```
last_sync_at: 2026-02-03 19:24:38
settings.autoImport: true
settings.syncInterval: 15
```

## Oplossing

### Stap 1: Marketplace Sync Scheduler Edge Function

**Nieuw bestand:** `supabase/functions/marketplace-sync-scheduler/index.ts`

Een nieuwe edge function die:
- Alle actieve marketplace connecties ophaalt
- Per connectie checkt of `autoImport` is ingeschakeld
- Kijkt of de `last_sync_at` langer geleden is dan `syncInterval` minuten
- De juiste sync functie aanroept (`sync-bol-orders`, `sync-shopify-orders`, etc.)
- Na de sync de voorraad synchroniseert als `autoSyncInventory` aan staat

```text
+-------------------+     +------------------------+     +------------------+
|  Cron Trigger     | --> | marketplace-sync-      | --> | sync-bol-orders  |
|  (elke 5 min)     |     | scheduler              |     | sync-bol-inventory
+-------------------+     +------------------------+     +------------------+
                                   |
                                   v
                          +------------------------+
                          | marketplace_connections|
                          | - last_sync_at         |
                          | - settings.syncInterval|
                          | - settings.autoImport  |
                          +------------------------+
```

### Stap 2: Config.toml Updaten

De edge function moet JWT-verificatie uitschakelen zodat deze door een externe cron service kan worden aangeroepen:

```toml
[functions.marketplace-sync-scheduler]
verify_jwt = false
```

### Stap 3: Externe Cron Service

Voor productie is een externe service nodig die de scheduler elke 5 minuten aanroept:
- **Optie A:** Supabase heeft geen native cron, dus een service zoals `cron-job.org`, `Vercel Cron`, of `GitHub Actions` kan dit doen
- **Optie B:** Client-side polling (minder betrouwbaar maar werkt als fallback)

### Stap 4: Client-Side Fallback (Optioneel)

Een React hook die de sync periodiek triggert wanneer de gebruiker de marketplace pagina bekijkt:

**Bestand:** `src/hooks/useAutoSync.ts`

```typescript
// Trigger sync elke X minuten wanneer de gebruiker actief is
useEffect(() => {
  const interval = setInterval(() => {
    if (connection?.settings?.autoImport) {
      triggerSync(connection.id);
    }
  }, connection.settings.syncInterval * 60 * 1000);
  
  return () => clearInterval(interval);
}, [connection]);
```

## Technische Details

### Edge Function Logic

```typescript
// marketplace-sync-scheduler/index.ts
Deno.serve(async (req) => {
  // 1. Haal alle actieve connecties op
  const { data: connections } = await supabase
    .from('marketplace_connections')
    .select('*')
    .eq('is_active', true);
  
  // 2. Voor elke connectie
  for (const conn of connections) {
    const settings = conn.settings;
    const lastSync = new Date(conn.last_sync_at || 0);
    const syncInterval = settings.syncInterval || 15; // minuten
    const now = new Date();
    
    // 3. Check of sync nodig is
    const minutesSinceLastSync = (now - lastSync) / 60000;
    
    if (settings.autoImport && minutesSinceLastSync >= syncInterval) {
      // 4. Trigger de juiste sync functie
      await fetch(`${projectUrl}/functions/v1/${syncFunction}`, {
        method: 'POST',
        body: JSON.stringify({ connectionId: conn.id })
      });
    }
  }
});
```

## Te Wijzigen/Creëren Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/functions/marketplace-sync-scheduler/index.ts` | **NIEUW** - Scheduler logic |
| `supabase/config.toml` | Update - Toevoegen `verify_jwt = false` |
| `src/hooks/useAutoSync.ts` | **NIEUW** - Client-side fallback (optioneel) |
| `src/pages/admin/MarketplaceDetail.tsx` | Update - Integreren van `useAutoSync` hook |

## Verwacht Resultaat

| Vóór Fix | Na Fix |
|----------|--------|
| Sync alleen bij handmatige actie | Automatische sync elke X minuten |
| Laatste sync 6 dagen geleden | Sync draait elke 15 minuten |
| `autoImport` setting doet niets | Setting wordt actief gebruikt |

## Cron Setup (Post-Implementatie)

Na het deployen van de scheduler, moet je een externe cron instellen. Aanbevolen: `cron-job.org` (gratis voor basis gebruik):

```
URL: https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/marketplace-sync-scheduler
Interval: Elke 5 minuten
Method: POST
Headers: Authorization: Bearer [ANON_KEY]
```

Dit zorgt ervoor dat de scheduler elke 5 minuten controleert welke connecties een sync nodig hebben, gebaseerd op hun individuele `syncInterval` settings.

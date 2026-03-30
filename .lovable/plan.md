

## Diepe Analyse: Waarom Order #1133 Niet Auto-Geaccepteerd Werd

### Bevindingen uit de database

| Veld | Waarde |
|---|---|
| Order | #1133 / C0002TLHJ6 |
| status | `shipped` (handmatig verzonden) |
| sync_status | `synced` (nooit geaccepteerd) |
| bol_process_status_id | `null` (accept call is nooit geslaagd) |
| carrier | bpost / CD117583469BE |
| Factuur | INV-2026-0122, status `sent` |

Ter vergelijking: alle eerdere orders hebben `sync_status: 'shipped'` of `'shipped_awaiting_tracking'`.

### Root Cause: Race Condition in de Retry-Logica

De keten is als volgt:

```text
1. Order binnenkomt via sync → status='processing', sync_status='synced'
2. Auto-accept wordt aangeroepen → FAALT (waarschijnlijk 403 of timeout)
3. sync_status blijft 'synced', bol_process_status_id blijft null
4. Gebruiker ziet order in dashboard en verzend handmatig → status='shipped'
5. Retry-mechanisme zoekt orders met:
   - sync_status = 'synced'  ✅ matcht
   - status IN ('processing', 'pending')  ❌ MATCHT NIET (is nu 'shipped')
6. Order wordt PERMANENT overgeslagen door retry
```

**Het probleem zit in regel 552**: de retry-filter `.in('status', ['processing', 'pending'])` sluit `shipped` orders uit. Dit is bedoeld om al-afgehandelde orders over te slaan, maar het slaat ook orders over die **handmatig verzonden zijn zonder dat de accept bij Bol.com ooit is doorgekomen**.

Dit is een **logische bug**: de retry kijkt naar `status` (order lifecycle) maar zou naar `sync_status` moeten kijken (marketplace lifecycle).

### Waarom de 403 optrad bij de eerste poging

De accept-bol-order logs zijn leeg (geroteerd na 2 dagen), dus de exacte fout is niet meer te achterhalen. Mogelijke oorzaken:
- Bol.com API was tijdelijk onbereikbaar
- Rate limiting op de Bol.com API
- Order was al automatisch geaccepteerd door Bol.com (bij FBB orders bijv.)
- Token was verlopen tussen sync en accept call

### Gevolgen

1. **Bol.com accept**: onbekend of het ooit bij Bol.com is geaccepteerd — de order is wel verzonden dus Bol.com heeft het waarschijnlijk zelf geaccepteerd of de verzending overschrijft de accept
2. **VVB label**: niet automatisch aangemaakt (VVB-retry zoekt ook alleen `sync_status='accepted'` + `status IN ('pending','processing')`)
3. **Factuur**: WEL aangemaakt (via auto-invoice-cron, die niet afhankelijk is van sync_status)

### Fix Plan

**1. Retry-filter verbreden in `sync-bol-orders/index.ts`**

De retry moet NIET filteren op order `status`, maar alleen op `sync_status`:

```typescript
// Huidige code (regel 550-552):
.eq('sync_status', 'synced')
.in('status', ['processing', 'pending'])

// Fix:
.eq('sync_status', 'synced')
// Geen status filter - als sync_status 'synced' is, moet het altijd geretried worden
```

Dezelfde fix voor VVB-retry (regel 730-732) en accept-pending retry (regel 646-648).

**2. Fallback: accept-failure graceful afhandelen**

Als de accept faalt met 403, markeer de order als `sync_status: 'accept_skipped'` met een duidelijke reden i.p.v. het stil te laten falen. Op die manier:
- Wordt de order niet eindeloos geretried
- Is in het dashboard zichtbaar dat de accept niet gelukt is
- De VVB-retry kan alsnog doorgaan

**3. Huidige order #1133 fixen**

Migratie die de `sync_status` van order #1133 bijwerkt naar `shipped` (consistent met de rest).

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-bol-orders/index.ts` | Retry-filters verbreden: geen `status` filter meer, alleen `sync_status`. Accept-failure graceful afhandelen |
| `supabase/functions/accept-bol-order/index.ts` | Bij 403: duidelijke foutmelding loggen + `sync_status='accept_skipped'` zetten |
| Nieuwe migratie | Order #1133 sync_status updaten naar 'shipped' |


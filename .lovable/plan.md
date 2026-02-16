
# Fix: Automatische Order Acceptatie & VVB Label Creatie

## Diagnose

### Probleem 1: Auto-accept werkt niet
De bestelling werd bij de **eerste sync** correct geimporteerd, maar de auto-accept code heeft twee problemen:
- De `fetch()` response body wordt niet uitgelezen (Deno resource leak), waardoor de call stil kan falen
- **Ernstiger**: als de sync een 2e keer draait voordat de auto-accept klaar is, wordt de order als "already exists" overgeslagen en de auto-accept code wordt dan nooit meer bereikt. Er is geen fallback-mechanisme voor orders die wel zijn geimporteerd maar niet geaccepteerd

### Probleem 2: VVB label wordt nooit automatisch aangemaakt
Er bestaat een `create-bol-vvb-label` Edge Function, maar deze wordt **nergens automatisch aangeroepen** na een succesvolle auto-accept. Het is puur een handmatige actie. De instelling `vvbEnabled: true` bestaat in de settings, maar er is geen code die er iets mee doet in de sync-flow.

---

## Oplossing

### 1. `sync-bol-orders/index.ts` -- Robuuste auto-accept + auto-VVB

**Wijzigingen:**

a) **Response uitlezen bij auto-accept** -- De `fetch()` naar `accept-bol-order` moet de response body consumeren en het resultaat loggen. Als de accept faalt, loggen we de foutmelding.

b) **Auto-VVB label na succesvolle accept** -- Als `vvbEnabled` aan staat in de settings, na een succesvolle auto-accept automatisch `create-bol-vvb-label` aanroepen met de order_id en de default carrier uit de settings.

c) **Retry-mechanisme voor gemiste orders** -- Na de main sync-loop, een extra check toevoegen: zoek orders die `sync_status = 'synced'` hebben (niet 'accepted') en waar `autoAcceptOrder` aan staat. Deze orders worden alsnog automatisch geaccepteerd + VVB label aangemaakt. Dit vangt het scenario op waar de eerste import wel lukte maar de accept niet.

### 2. `accept-bol-order/index.ts` -- Kleine verbetering

De huidige code werkt functioneel, maar update de `sync_status` naar `'accepted'`. Dit wordt gebruikt als marker door het retry-mechanisme.

---

## Technische Details

### Nieuwe flow in `sync-bol-orders/index.ts`

```text
Order geimporteerd (nieuw)
  -> autoAcceptOrder = true?
     -> Roep accept-bol-order aan (met await + response uitlezen)
     -> Succesvol?
        -> Update sync_status naar 'accepted'
        -> vvbEnabled = true?
           -> Roep create-bol-vvb-label aan
           -> Log resultaat (succes/fout)

Na alle orders verwerkt:
  -> Zoek orders met sync_status = 'synced' (niet accepted)
     voor deze connectie waar autoAcceptOrder = true
  -> Probeer alsnog auto-accept + VVB voor max 5 orders
```

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-bol-orders/index.ts` | Auto-accept response handling + auto-VVB call + retry voor gemiste orders |

### Veiligheidsmaatregelen

- Alle auto-accept/VVB calls zijn non-blocking (try/catch) zodat de sync niet faalt als 1 order een probleem heeft
- Maximaal 5 retry-orders per sync-run om rate limits te respecteren
- Logging van alle stappen zodat je in de logs precies kunt zien wat er gebeurt
- VVB label wordt alleen aangemaakt als de accept succesvol was (anders geen label zonder acceptatie)

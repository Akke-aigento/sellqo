

## Fix: Bol.com order niet "Verwerkt" — retry voor bestaande stuck labels

### Probleem
Order #1136 (C00037NR5W) heeft een VVB label met `external_id` maar zonder `tracking_number` en `label_url`. Hierdoor:
- De `confirm-bol-shipment` stap is nooit uitgevoerd (vereist tracking_number)
- Bol.com toont de order nog steeds als "Eigen verzendwijze" — niet verwerkt

### Wat er al gefixt is (vorige ronde)
- Nieuwe labels krijgen alleen `status: 'created'` als PDF + tracking aanwezig zijn
- Auto-retry in `sync-bol-orders` voor labels met status `pending`

### Wat er nog ontbreekt
De auto-retry pakt labels met `status = 'created'` maar `label_url IS NULL` **niet** op. Dit bestaande label valt dus buiten de retry.

### Oplossing

**1. Retry-query uitbreiden in `sync-bol-orders`**

Het `[LABEL-PDF-RETRY]` blok moet ook labels oppikken met:
- `status = 'created'` EN `label_url IS NULL`
- Dit vangt bestaande stuck labels zoals #1136 op

**2. Fix bestaand label: status corrigeren**

Database migration om het huidige stuck label te fixen:
```sql
UPDATE shipping_labels 
SET status = 'pending' 
WHERE status = 'created' 
  AND label_url IS NULL 
  AND external_id IS NOT NULL;
```

Dit zorgt dat de bestaande retry-logica ze ook oppakt.

**3. Bevestig dat confirm-shipment automatisch volgt**

Na succesvolle retry → tracking_number wordt opgehaald → `create-bol-vvb-label` roept automatisch `confirm-bol-shipment` aan (lijn 759-795) → Bol.com markeert order als verwerkt.

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/sync-bol-orders/index.ts` | Retry-query uitbreiden: ook `status='created' AND label_url IS NULL` |
| Database migration | Eenmalige fix: stuck labels van `created` naar `pending` zetten |


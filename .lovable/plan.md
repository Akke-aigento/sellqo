

## Fix: Bol.com Order Flow — Accept stap verwijderen

### Probleem

De `accept-bol-order` functie roept `PUT /retailer/orders/{orderId}/accept` aan — een endpoint dat nooit bestaan heeft in de Bol.com API. Dit geeft 403 errors, waardoor orders op `synced`/`accept_failed` blijven hangen en VVB labels niet aangemaakt worden.

### Wijzigingen

**1. `supabase/functions/accept-bol-order/index.ts`** — Herschrijven als wrapper
- Verwijder alle Bol.com API calls (token request, PUT accept, poll process status)
- Behoud functie-interface (request/response format)
- Enige actie: `sync_status = 'accepted'` in DB zetten
- Return `{ success: true }`
- Comment bovenaan met uitleg

**2. `supabase/functions/sync-bol-orders/index.ts`** — 3 blokken aanpassen

| Blok (lijnen) | Wijziging |
|---|---|
| Auto-accept bij import (466-536) | Vervang `accept-bol-order` call door directe DB update `sync_status = 'accepted'`, daarna VVB label aanmaken zoals nu |
| Retry auto-accept (551-658) | Zelfde: directe DB update naar `accepted`, daarna VVB label |
| Accept-pending retry (661-738) | Volledig verwijderen |
| VVB retry (741-815) | Ongewijzigd laten — filter blijft `sync_status = 'accepted'` |

**3. `supabase/functions/create-bol-vvb-label/index.ts`** — Auto-accept sectie (423-467)
- Vervang de `accept-bol-order` functie-aanroep door directe DB update: `sync_status = 'accepted'`
- Ga door met VVB label aanmaken (geen return bij falen meer)

**4. Database migratie** — Fix bestaande vastgelopen orders
```sql
UPDATE orders 
SET sync_status = 'accepted', updated_at = now()
WHERE marketplace_source = 'bol_com' 
  AND sync_status IN ('synced', 'accept_failed', 'accept_pending')
  AND status NOT IN ('cancelled', 'refunded', 'shipped', 'delivered');
```

### Resultaat
- Nieuwe orders → direct `accepted` → VVB labels worden aangemaakt
- Bestaande vastgelopen orders → gefixed door migratie → opgepakt door VVB retry
- Geen Bol.com API calls meer voor een niet-bestaand endpoint


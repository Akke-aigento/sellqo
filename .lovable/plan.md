

## Bol.com Retouren Sync

### Wat er nu is
- `SyncDataType` bevat `returns` — typeondersteuning is er al
- `SyncRules` heeft `returns?: SyncRuleConfig` — configuratie-plek bestaat
- **Maar**: geen `sync-bol-returns` edge function, geen retourentabel, geen UI

### Wat we bouwen

**1. Database: `returns` tabel**

| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| order_id | uuid FK nullable | Link naar SellQo order |
| marketplace_connection_id | uuid FK | |
| marketplace_return_id | varchar | Bol.com return ID |
| marketplace_order_id | varchar | Bol.com order ID |
| status | enum | `registered`, `in_transit`, `received`, `approved`, `rejected`, `exchanged`, `repaired` |
| return_reason | text | Reden van klant |
| return_reason_code | varchar | Bol.com reason code |
| customer_name | text | |
| items | jsonb | Array van retour-items (product, quantity, EAN) |
| handling_result | varchar | `RETURN_RECEIVED`, `EXCHANGE_PRODUCT`, `REPAIR` etc. |
| registration_date | timestamptz | Wanneer retour aangemeld |
| raw_marketplace_data | jsonb | Volledige Bol.com response |
| created_at / updated_at | timestamptz | |

RLS: tenant-based access.

**2. Edge function: `sync-bol-returns/index.ts`**
- Haalt retouren op via `GET /retailer/returns` (Bol.com v10 API)
- Filtert op `handled=false` voor nieuwe retouren + `handled=true` voor status updates
- Upsert op `marketplace_return_id` (geen duplicaten)
- Matcht aan bestaande orders via `marketplace_order_id`

**3. UI: Retouren tab in MarketplaceDetail**
- Nieuwe tab "Retouren" naast Producten/Orders
- Tabel met: datum, order, klant, reden, status, items
- Badge met aantal open retouren

**4. Integratie**
- `useAutoSync` hook uitbreiden met returns sync
- `marketplace-sync-scheduler` uitbreiden zodat retouren mee worden gesynchroniseerd
- `trigger-manual-sync` reageert al op `dataType: 'returns'` — hoeft alleen de juiste function aan te roepen

### Bestanden

| Bestand | Actie |
|---|---|
| SQL migratie | `returns` tabel + enum + RLS policies |
| `supabase/functions/sync-bol-returns/index.ts` | **Nieuw** — ophalen en upserten van Bol.com retouren |
| `src/pages/admin/MarketplaceDetail.tsx` | "Retouren" tab toevoegen |
| `src/components/admin/marketplace/BolReturnsTab.tsx` | **Nieuw** — retourentabel met status, filters |
| `src/hooks/useAutoSync.ts` | Returns sync toevoegen aan auto-sync loop |
| `supabase/functions/marketplace-sync-scheduler/index.ts` | Returns sync toevoegen |
| `supabase/functions/trigger-manual-sync/index.ts` | `returns` case koppelen aan `sync-bol-returns` |


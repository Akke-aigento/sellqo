

## Prompt 2: Extra Ads Module tabellen + global summary view

### Wat wordt aangemaakt

**3 nieuwe tabellen:**

1. **`ads_ai_recommendations`** — AI aanbevelingen voor bid/keyword/budget optimalisatie
2. **`ads_ai_rules`** — Merchant-geconfigureerde automation regels
3. **`ads_product_channel_map`** — Product-kanaal koppeling met voorraaddrempel

**1 view:**

- **`ads_global_daily_summary`** — Geaggregeerde dagelijkse performance per kanaal (nu alleen Bol.com, later UNION ALL voor andere kanalen)

### Technische details

- `tenant_id` wordt UUID (niet TEXT) om consistent te zijn met de zojuist aangemaakte `ads_bolcom_*` tabellen en de `tenants` tabel
- RLS policies volgen exact hetzelfde patroon: `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))` voor SELECT/INSERT/UPDATE/DELETE
- Indexes op `tenant_id`, `channel`, `status`, `product_id` waar relevant
- View heeft geen RLS nodig — wordt via de onderliggende tabel-RLS afgeschermd (queries op de view passen automatisch de RLS van `ads_bolcom_performance` toe)

### Bestanden

| Wat | Actie |
|---|---|
| Database migratie | 3 tabellen + 1 view + RLS + indexes |

Geen frontend wijzigingen nodig — dit is puur database schema.


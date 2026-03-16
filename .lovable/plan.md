

## Root Cause: NULL-filter bug in de query

De `poll-tracking-status` functie bevat deze query (regel 376):

```typescript
.neq("tracking_status", "delivered")
```

Alle orders hebben `tracking_status = NULL` (nooit eerder gepolld). In PostgreSQL geldt: `NULL != 'delivered'` evalueert naar `NULL` — niet naar `TRUE`. PostgREST/Supabase filtert rijen met NULL-resultaat **weg**.

**Resultaat**: alle orders worden uitgefilterd, de functie vindt 0 orders, en er wordt nooit gepolld. Dit bevestigt de logs: `"Polling complete. 0 orders updated."` zonder enige "Polling X orders" melding.

### Bewijs uit database

| Order | tracking_status | last_tracking_check |
|-------|----------------|-------------------|
| #1126 | NULL | NULL |
| #1125 | NULL | NULL |
| #1124 | NULL | NULL |
| Alle andere... | NULL | NULL |

### Fix

**Bestand**: `supabase/functions/poll-tracking-status/index.ts`, regel 376

Vervang:
```typescript
.neq("tracking_status", "delivered")
```

Door:
```typescript
.or("tracking_status.is.null,tracking_status.neq.delivered")
```

Dit zorgt ervoor dat orders met `tracking_status = NULL` (nooit gepolld) EN orders met een status anders dan "delivered" wél worden opgepikt.

Eén regel wijziging, geen database migratie nodig.


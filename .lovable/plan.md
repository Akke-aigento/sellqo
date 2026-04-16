

# Plan: Klanten- en opslagtelling fixen in abonnementspagina

## Probleem

Twee metrics op de Facturatie-pagina tonen altijd 0:

1. **Klanten** — de query telt alleen `customers`, maar klanten die via de webshop binnenkomen staan in `storefront_customers`. Die worden niet meegeteld.
2. **Opslag (GB)** — is hardcoded op `0` met een `// TODO` commentaar. Er wordt nooit iets berekend.

## Wijzigingen

**Bestand:** `src/hooks/useTenantSubscription.ts`

### 1. Klanten: beide tabellen tellen

Huidige code (regel 71):
```typescript
supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
```

Wordt:
```typescript
// Tel customers + storefront_customers (deduplicated count niet nodig — plan limiet gaat over totaal)
Promise.all([
  supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
  supabase.from('storefront_customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
]).then(([a, b]) => ({ count: (a.count || 0) + (b.count || 0) })),
```

### 2. Opslag: werkelijke storage berekenen

De bestanden in storage buckets zijn geprefixed met `tenant_id`. We kunnen de totale opslag berekenen via een RPC of directe query. Aangezien `storage.objects` niet beschikbaar is via de client library, maak ik een database functie:

**Migratie:** Nieuwe functie `get_tenant_storage_bytes(tenant_uuid)`
```sql
CREATE OR REPLACE FUNCTION public.get_tenant_storage_bytes(p_tenant_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE name LIKE p_tenant_id::text || '/%'
$$;
```

**In de hook:** de TODO vervangen door:
```typescript
storage: {
  current: Number((storageBytes / (1024 * 1024 * 1024)).toFixed(2)), // bytes → GB
  limit: plan.limit_storage_gb,
  percentage: calcPercentage(storageBytes / (1024*1024*1024), plan.limit_storage_gb),
}
```

## Samenvatting

| Metric | Nu | Straks |
|--------|-----|--------|
| Klanten | Alleen `customers` (0) | `customers` + `storefront_customers` (2) |
| Opslag | Hardcoded 0 | Werkelijke opslag uit storage buckets |

Twee bestanden worden aangepast, één database functie aangemaakt. Geen UI-wijzigingen nodig.


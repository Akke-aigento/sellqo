

# Fix: Orders Sorteren op Originele Besteldatum

## Probleem Analyse

De geïmporteerde orders worden gesorteerd op **importdatum** (`created_at`) in plaats van de **originele besteldatum**. Dit komt door twee problemen:

### Probleem 1: `original_created_at` wordt niet opgeslagen
De CSV import edge function ontvangt wel de originele datum uit de mapping, maar slaat deze **niet op** in de database:

```typescript
// buildOrderData() in run-csv-import/index.ts
return {
  tenant_id: tenantId,
  // ... andere velden ...
  import_source: record.import_source || "csv",
  // MIST: original_created_at ← wordt niet meegenomen!
};
```

### Probleem 2: Query sorteert op verkeerde kolom
```typescript
// useOrders.ts lijn 25
.order('created_at', { ascending: false })  // ← importdatum, niet besteldatum
```

---

## Oplossing

### Stap 1: Edge Function - Originele Datum Opslaan

**Bestand:** `supabase/functions/run-csv-import/index.ts`

Voeg `original_created_at` toe aan `buildOrderData()`:

```typescript
function buildOrderData(tenantId: string, record: Record<string, unknown>, customerId: string | null) {
  return {
    // ... bestaande velden ...
    import_source: record.import_source || "csv",
    // TOEVOEGEN:
    original_created_at: record.original_created_at || null,
  };
}
```

### Stap 2: Query - Sorteer op Juiste Datum

**Bestand:** `src/hooks/useOrders.ts`

Wijzig de sortering om `original_created_at` te gebruiken (met fallback naar `created_at`):

```typescript
// De SQL/Supabase aanpak: sorteer op COALESCE(original_created_at, created_at)
// Supabase JS ondersteunt geen COALESCE in order(), dus we doen dit met RPC of client-side

// Optie 1: Client-side sorteren (eenvoudigst)
const { data, error } = await query;
if (error) throw error;

// Sorteer op originele datum (met fallback naar created_at)
const sortedData = (data as Order[]).sort((a, b) => {
  const dateA = a.original_created_at || a.created_at;
  const dateB = b.original_created_at || b.created_at;
  return new Date(dateB).getTime() - new Date(dateA).getTime();
});

return sortedData;
```

### Stap 3: Type Definities Bijwerken

**Bestand:** `src/types/order.ts`

Voeg `original_created_at` toe aan de Order interface:

```typescript
export interface Order {
  // ... bestaande velden ...
  import_source?: string | null;
  original_created_at?: string | null;  // ← TOEVOEGEN
}
```

---

## Database Fix voor Bestaande Data

Na het implementeren van de code fix, kun je de bestaande orders fixen met een SQL query in Cloud View > Run SQL:

```sql
-- Update orders waar original_created_at NULL is maar er wel een raw_marketplace_data is
UPDATE orders
SET original_created_at = (raw_marketplace_data->>'created_at')::timestamptz
WHERE original_created_at IS NULL 
  AND raw_marketplace_data->>'created_at' IS NOT NULL;
```

---

## Verwacht Resultaat

| Vóór Fix | Na Fix |
|----------|--------|
| Orders gesorteerd op importdatum | Orders gesorteerd op originele besteldatum |
| Nieuwste import bovenaan | Nieuwste bestelling bovenaan |
| `original_created_at` altijd NULL | Originele datum bewaard bij import |

---

## Te Wijzigen Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/run-csv-import/index.ts` | Voeg `original_created_at` toe aan `buildOrderData()` |
| `src/hooks/useOrders.ts` | Sorteer op `original_created_at` met fallback |
| `src/types/order.ts` | Voeg `original_created_at` toe aan Order interface |


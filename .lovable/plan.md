

# Volledige Analyse: Import Wizard Doet NIETS

## Kernprobleem

Het JSON bestand dat je uploadt (`import-log-mock-id.json`) bewijst precies wat er mis is:

```json
{
  "job_id": "mock-id",    // <-- Let op: "mock-id" is HARDCODED
  "status": "completed",
  "statistics": { "total": 51, "success": 48, ... }
}
```

Dit is **FAKE data**. De wizard **simuleert** een import maar **schrijft nooit naar de database**.

## Bewijs uit de Code

In `src/components/admin/import/ImportWizard.tsx` regels 84-120:

```typescript
const handleStartImport = async () => {
  setIsProcessing(true);
  try {
    // TODO: Implement actual import via edge function
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 2000));  // <-- NOPE: 2 sec wachten, NIETS doen
    
    setImportResult({
      id: 'mock-id',                    // <-- HARDCODED fake ID
      tenant_id: 'mock-tenant',         // <-- FAKE tenant
      status: 'completed',              // <-- Altijd "completed"
      total_rows: 51,                   // <-- HARDCODED nummers
      success_count: 48,
      errors: [{ row: 3, error: 'Invalid email format' }],  // <-- FAKE error
    });
    
    setStep(5);  // Ga naar "result" scherm
  } finally {
    setIsProcessing(false);
  }
};
```

Dit is letterlijk wat er staat: **"TODO: Implement actual import"**

## Wat WEL Werkt

| Component | Status | Wat het doet |
|-----------|--------|--------------|
| CSV parsing | ✅ Werkt | Leest headers + rijen correct |
| Field mapping | ✅ Werkt | 200+ Shopify velden automatisch gemapt |
| Preview/Validatie | ✅ Werkt | Transformeert + valideert data correct |
| **Start Import** | ❌ Simuleert alleen | Wacht 2 sec, toont fake resultaat |
| Database writes | ❌ Bestaat niet | Geen INSERT statements naar customers/products/orders |

## Wat er Ontbreekt

Er is **geen backend import-runner**. De complete import-executie ontbreekt:

1. **Geen Edge Function** voor `run-csv-import` of vergelijkbaar
2. **Geen database inserts** vanuit de wizard
3. **Geen upsert logica** (update vs insert)
4. **Geen order line-item groepering** (Shopify CSV = 1 regel per item)

## Database Check Bevestigt Dit

```sql
-- Actuele data in database:
customers: 0 records
products: 1 record   (waarschijnlijk handmatig of via ander proces)
orders: 1 record     (idem)
import_jobs: 0 records  <-- Geen enkele import ooit geregistreerd
```

---

# Implementatie Plan

## Stap 1: Edge Function `run-csv-import` aanmaken

Nieuwe edge function in `supabase/functions/run-csv-import/index.ts`:

```typescript
// Ontvangt:
// - tenant_id
// - platform (shopify/woocommerce/csv)
// - data_type (customers/products/orders)
// - records[] (getransformeerde data uit wizard)
// - options (updateExisting, matchField, etc.)

// Doet:
// 1. Creëert import_job record
// 2. Loopt door records
// 3. Per record: upsert naar customers/products/orders
// 4. Voor orders: groepeert line-items
// 5. Houdt success/fail/skip counts bij
// 6. Update import_job met resultaat
```

### Orders Line-Item Groepering

Shopify Orders CSV = 1 rij per line-item. Order #1001 met 3 producten = 3 CSV rijen.

De edge function moet:
```typescript
// Groepeer CSV rows per order_number (Name veld)
const orderGroups = new Map<string, Record<string, unknown>[]>();
for (const row of records) {
  const orderNum = row.order_number as string;
  if (!orderGroups.has(orderNum)) orderGroups.set(orderNum, []);
  orderGroups.get(orderNum)!.push(row);
}

// Per groep: maak 1 order + N order_items
for (const [orderNum, rows] of orderGroups) {
  const firstRow = rows[0];
  
  // Insert order (header data uit eerste rij)
  const { data: order } = await supabase.from('orders').upsert({
    tenant_id,
    order_number: orderNum,
    customer_email: firstRow.customer_email,
    total: firstRow.total,
    billing_address: firstRow.billing_address,
    shipping_address: firstRow.shipping_address,
    // ... rest van order velden
  }, { onConflict: 'tenant_id,order_number' });
  
  // Insert order_items (één per rij)
  for (const row of rows) {
    const lineItem = row.raw_marketplace_data as Record<string, unknown>;
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_name: lineItem.lineitem_name,
      sku: lineItem.lineitem_sku,
      quantity: lineItem.lineitem_quantity,
      unit_price: lineItem.lineitem_price,
      // ...
    });
  }
}
```

## Stap 2: ImportWizard aanpassen om Edge Function aan te roepen

Vervang de `handleStartImport` functie:

```typescript
const handleStartImport = async () => {
  if (!currentTenant?.id) {
    toast({ title: 'Fout', description: 'Geen tenant geselecteerd', variant: 'destructive' });
    return;
  }

  setIsProcessing(true);
  
  try {
    // Per data type: verzamel getransformeerde data
    for (const dataType of selectedDataTypes) {
      const records = previewData.get(dataType)?.filter(r => r.selected).map(r => r.data) || [];
      const mapping = mappings.get(dataType) || [];
      
      // Roep edge function aan
      const { data, error } = await supabase.functions.invoke('run-csv-import', {
        body: {
          tenant_id: currentTenant.id,
          platform: platform,
          data_type: dataType,
          records: records,
          options: {
            updateExisting: options.updateExisting,
            matchField: getMatchField(dataType),  // email / sku / order_number
          },
        },
      });
      
      if (error) throw error;
      
      // Bewaar resultaat per type
      setImportResult(prev => ({ ...prev, [dataType]: data }));
    }
    
    setStep(5);
    toast({ title: 'Import voltooid!', description: 'Data is succesvol geïmporteerd.' });
    
  } catch (error) {
    toast({
      title: 'Import mislukt',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setIsProcessing(false);
  }
};
```

## Stap 3: Match-sleutels Implementeren (jouw keuze: standaard sleutels)

| Data Type | Match Veld | Fallback |
|-----------|------------|----------|
| Customers | `email` | - |
| Products | `sku` | `slug` |
| Orders | `order_number` (Shopify "Name") | `marketplace_order_id` (Shopify "Id") |

## Stap 4: Upsert Logica per Type

### Customers
```sql
INSERT INTO customers (tenant_id, email, first_name, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (tenant_id, email) 
DO UPDATE SET 
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  -- etc, alle niet-null velden
```

### Products
```sql
INSERT INTO products (tenant_id, sku, name, price, ...)
VALUES ($1, $2, $3, $4, ...)
ON CONFLICT (tenant_id, sku)
DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  -- etc
```

### Orders (complexer: eerst check, dan insert of update)
```typescript
// Check of order al bestaat
const { data: existing } = await supabase
  .from('orders')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('order_number', orderNumber)
  .single();

if (existing && options.updateExisting) {
  // Update existing order
  await supabase.from('orders').update({ ... }).eq('id', existing.id);
  // Delete old items, insert new items
  await supabase.from('order_items').delete().eq('order_id', existing.id);
  // Insert items...
} else if (!existing) {
  // Insert new order + items
}
```

## Stap 5: Order-Items met Product Koppeling (jouw keuze: via SKU, fallback null)

```typescript
// Probeer product_id te vinden via SKU
let productId = null;
if (lineItem.lineitem_sku) {
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('sku', lineItem.lineitem_sku)
    .single();
  
  if (product) productId = product.id;
}

// Insert order_item met of zonder product_id
await supabase.from('order_items').insert({
  order_id: orderId,
  product_id: productId,  // null als niet gevonden
  product_name: lineItem.lineitem_name,  // Altijd bewaren
  sku: lineItem.lineitem_sku,            // Altijd bewaren
  quantity: lineItem.lineitem_quantity,
  unit_price: lineItem.lineitem_price,
});
```

---

## Technische Samenvatting

### Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `supabase/functions/run-csv-import/index.ts` | Kernlogica: upserts + order groepering + statistieken |

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/import/ImportWizard.tsx` | Vervang mock door edge function call |
| `src/types/import.ts` | Voeg `matchField` toe aan `ImportOptions` |
| `supabase/config.toml` | Registreer `run-csv-import` function |

### Database aanpassingen nodig

| Tabel | Wijziging |
|-------|-----------|
| `customers` | Voeg UNIQUE constraint toe op `(tenant_id, email)` |
| `products` | Voeg UNIQUE constraint toe op `(tenant_id, sku)` |
| `orders` | Voeg UNIQUE constraint toe op `(tenant_id, order_number)` |

---

## Resultaat na Implementatie

- ✅ "Start import" knop roept edge function aan
- ✅ Edge function schrijft data naar `customers`, `products`, `orders`, `order_items`
- ✅ Dubbele records worden geüpdatet (niet gedupliceerd)
- ✅ Orders worden correct gegroepeerd (1 order + N items uit meerdere CSV rijen)
- ✅ Order-items worden gekoppeld aan bestaande producten via SKU
- ✅ `import_jobs` tabel houdt historie bij van alle imports
- ✅ Echte statistieken (success/fail/skip counts) worden geretourneerd


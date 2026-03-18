

## Bugs gevonden in stock export hooks — en correctieplan

### Probleem: `order_items` en `purchase_order_items` hebben GEEN `tenant_id` kolom

De 4 stock exports in `src/hooks/useStockExports.ts` filteren allemaal op `.eq('tenant_id', ...)` op tabellen die die kolom niet hebben. Dit betekent dat **alle 4 de voorraad-exports crashen of lege data teruggeven**.

Specifieke fouten:

| Hook | Tabel | Bug |
|------|-------|-----|
| `useStockMovementExport` | `order_items` | `.eq('tenant_id')` — kolom bestaat niet |
| `useStockMovementExport` | `purchase_order_items` | `.eq('tenant_id')` — kolom bestaat niet |
| `useStockMovementExport` | `purchase_order_items` | Gebruikt `quantity` — kolom heet `quantity_ordered` |
| `useDeadStockExport` | `order_items` | `.eq('tenant_id')` — kolom bestaat niet |
| `useStockTurnoverExport` | `order_items` | `.eq('tenant_id')` — kolom bestaat niet |
| `useReorderAdviceExport` | `order_items` | `.eq('tenant_id')` — kolom bestaat niet |
| Alle stock hooks | `order_items` | Gebruikt `as any` type cast — maskeert TypeScript fouten |

### Correct patroon (al gebruikt in `useProductMarginExport`)

```typescript
// CORRECT: join door orders voor tenant filtering
supabase.from('order_items')
  .select('product_id, quantity, orders!inner(tenant_id)')
  .eq('orders.tenant_id', currentTenant.id)

// CORRECT: join door purchase_orders voor tenant filtering  
supabase.from('purchase_order_items')
  .select('product_id, quantity_ordered, purchase_orders!inner(tenant_id)')
  .eq('purchase_orders.tenant_id', currentTenant.id)
```

### Accounting exports: OK
De hooks in `useAccountingExports.ts` zijn correct — ze queryen alleen tabellen die wél `tenant_id` hebben (invoices, supplier_documents, orders, products, pos_transactions, customers). De `useProductMarginExport` gebruikt het correcte join-patroon voor `order_items`.

### Technische aanpak

**`src/hooks/useStockExports.ts`** — Alle 4 hooks fixen:

1. **`useStockMovementExport`**: 
   - `order_items` query: join via `orders!inner(tenant_id, order_number)` + filter `orders.tenant_id`
   - `purchase_order_items` query: join via `purchase_orders!inner(tenant_id, order_number)` + filter `purchase_orders.tenant_id`
   - Fix veldnaam `quantity` → `quantity_ordered` voor purchase items
   - Verwijder `as any` casts, gebruik correcte types

2. **`useDeadStockExport`**: 
   - `order_items` query: join via `orders!inner(tenant_id)` + filter `orders.tenant_id`
   - Verwijder `as any` cast

3. **`useStockTurnoverExport`**: 
   - Zelfde fix als DeadStock

4. **`useReorderAdviceExport`**: 
   - Zelfde fix als DeadStock

### Bestanden
- `src/hooks/useStockExports.ts` — alle 4 hooks corrigeren


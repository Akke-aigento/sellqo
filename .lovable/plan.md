

## Opschoning: Testdata Aaron Mercken verwijderen bij VanXcel

### Wat er verwijderd wordt

| Tabel | Aantal | Criteria |
|---|---|---|
| `order_items` | 26 | Gekoppeld aan de testbestellingen |
| `invoices` | 20+ | Gekoppeld aan de testbestellingen (via `order_id`) |
| `orders` | 26 | `tenant_id` = VanXcel + `customer_email` = `aaron.mercken@hotmail.com` |

Geen platform_invoices gevonden — die hoeven niet verwijderd te worden.

### Volgorde (foreign keys)

Vanwege foreign key constraints moet de volgorde zijn:
1. Eerst `order_items` verwijderen (referentie naar `orders`)
2. Dan `invoices` verwijderen (referentie naar `orders`)
3. Dan `orders` verwijderen

### Uitvoering

Drie DELETE statements via een database migration:

```sql
-- 1. Order items
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders 
  WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd' 
  AND customer_email = 'aaron.mercken@hotmail.com'
);

-- 2. Invoices
DELETE FROM invoices WHERE order_id IN (
  SELECT id FROM orders 
  WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd' 
  AND customer_email = 'aaron.mercken@hotmail.com'
);

-- 3. Orders
DELETE FROM orders 
WHERE tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd' 
AND customer_email = 'aaron.mercken@hotmail.com';
```

### Geen code-wijzigingen nodig

Dit is puur een data-opschoning.


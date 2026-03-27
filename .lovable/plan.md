

## Retouren Koppelen aan Bestellingen & Klantgesprek Starten

### Huidige staat
- `returns` tabel heeft `order_id` (nullable) maar **geen `customer_id`**
- De detail-sheet toont `customer_name` als tekst, maar kan niet doorlinken naar de klant
- Er is geen manier om vanuit een retour een gesprek met de klant te starten
- De `order` join haalt al `order_number`, `total`, `customer_email` op — maar niet `customer_id`

### Plan

**1. Database: `customer_id` toevoegen aan `returns`**
- Nieuwe kolom `customer_id UUID REFERENCES customers(id) ON DELETE SET NULL`
- Index voor snelle lookups
- Bestaande retouren: backfill via `UPDATE returns SET customer_id = orders.customer_id FROM orders WHERE returns.order_id = orders.id`

**2. Edge function `process-order-refund` aanpassen**
- Bij aanmaken retour: `customer_id` meesturen vanuit de order

**3. `useReturns` hook uitbreiden**
- Join uitbreiden: `order:orders (order_number, total, customer_email, customer_id)` + `customer:customers (id, first_name, last_name, email)`
- `ReturnRecord` type uitbreiden met `customer_id` en `customer` join

**4. ReturnsOverview detail-sheet uitbreiden**
- **Klantnaam klikbaar** → navigeert naar `/admin/customers/:customerId`
- **Bestelnummer klikbaar** → navigeert naar `/admin/orders/:orderId` (al deels aanwezig)
- **"Gesprek starten" knop** → navigeert naar inbox met pre-filled context:
  - Route: `/admin/inbox?compose=true&to={customer_email}&subject=Retour {order_number}`
  - Of: opent `ComposeDialog` direct met retour-context

**5. Inbox compose integratie**
- De bestaande `ComposeDialog` accepteert al query params of kan via state worden aangestuurd
- We navigeren naar `/admin/inbox` met search params die de compose dialog triggeren met het juiste e-mailadres en onderwerp

### Bestanden

| Bestand | Wijziging |
|---|---|
| Nieuwe migratie | `customer_id` kolom + backfill + index |
| `supabase/functions/process-order-refund/index.ts` | `customer_id` meesturen bij insert |
| `src/hooks/useReturns.ts` | Join uitbreiden, type updaten |
| `src/components/admin/ReturnsOverview.tsx` | Klikbare klant, klikbare order, "Gesprek starten" knop |

### Resultaat
- Elke retour is direct gekoppeld aan klant + bestelling
- Vanuit retour-detail: 1 klik naar klantpagina, 1 klik naar bestelling, 1 klik om e-mail te sturen over de retour


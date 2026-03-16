

## Probleem: POS-transacties worden NIET als bestellingen opgeslagen

Na analyse is het duidelijk: `createTransaction` in `usePOS.ts` (regel 307-329) schrijft **alleen** naar `pos_transactions`. Er wordt nooit een record in de `orders` tabel aangemaakt — `order_id` is altijd `null`.

Dit betekent:
- POS-verkopen verschijnen **niet** op de bestellingenpagina
- POS-omzet wordt **niet** meegenomen in order-statistieken (dashboard, rapporten)
- Er is geen uniforme orderhistorie

### Hoe professionele systemen dit doen

**Shopify POS, Square, Lightspeed** — ze maken allemaal een "order" aan bij elke POS-transactie. De order krijgt een verkoopkanaal-label (bijv. "POS" of "In-store") zodat je in één overzicht online én fysieke verkopen ziet. De POS-transactie is dan een betaalbewijs gekoppeld aan die order.

### Implementatieplan

**1. Order aanmaken bij POS-transactie**

In `usePOS.ts` → `createTransaction`, na het succesvol inserten van de `pos_transaction`:
- Roep `generate_order_number` RPC aan
- Insert een `orders` record met:
  - `order_number` van de RPC
  - `status: 'delivered'` (fysieke verkoop is direct afgeleverd)
  - `payment_status: 'paid'`
  - `marketplace_source: null`, nieuw veld `sales_channel: 'pos'`
  - Klantgegevens als die geselecteerd is
  - Totalen van de transactie
- Insert `order_items` voor elk cart item
- Update de `pos_transaction` met de gegenereerde `order_id`

**2. Sales channel kolom toevoegen**

Database migratie:
- `ALTER TABLE orders ADD COLUMN sales_channel TEXT DEFAULT 'webshop'` — waarden: `'webshop'`, `'pos'`, `'bol_com'`, `'amazon'`, etc.
- Backfill bestaande orders op basis van `marketplace_source`

**3. Bestellingenpagina: POS-orders herkenbaar maken**

- Badge tonen met "POS" / "Webshop" / "Bol.com" naast het ordernummer
- Optioneel filteroptie op sales channel toevoegen

**4. Dashboard statistieken**

De `useOrderStats` hook telt al alle orders — zodra POS-orders in de `orders` tabel staan, worden ze automatisch meegenomen in omzet en aantallen.

### Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/usePOS.ts` | Order + order_items aanmaken na transactie |
| `src/types/order.ts` | `sales_channel` toevoegen aan `Order` type |
| `src/hooks/useOrders.ts` | Filter op `sales_channel` toevoegen |
| Orderpagina componenten | Badge voor verkoopkanaal |
| Database migratie | `sales_channel` kolom + backfill |


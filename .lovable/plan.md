

## Fix: `discount_code` kolom bestaat niet op `storefront_carts`

### Probleem
Lijn 1937 in `storefront-api/index.ts` selecteert `discount_code` uit `storefront_carts`, maar die kolom bestaat niet. De cart heeft alleen:
- `discount_codes` (text array) — kan 0, 1 of meerdere codes bevatten
- `discount_amount` (numeric)

De `orders` tabel heeft `discount_code` (text, enkelvoud) en `discount_code_id` (uuid).

### Oplossing

**Bestand:** `supabase/functions/storefront-api/index.ts`

1. **Lijn 1937** — Verwijder `discount_code` uit de `.select()` query (laat `discount_codes` staan, die bestaat wél)

2. **Lijn 2041** — Vervang `cart.discount_code || null` door:
   ```typescript
   (cart.discount_codes && cart.discount_codes.length > 0)
     ? cart.discount_codes.join(', ')
     : null
   ```
   Dit werkt correct voor alle scenario's:
   - **Geen codes**: `null`
   - **1 code**: `"KORTING10"`
   - **Meerdere codes**: `"KORTING10, ZOMER20"`

3. **Deploy** de edge function en test met de bestaande cart

### Waarom dit veilig is
- Het `orders.discount_code` veld is `text` — een komma-gescheiden string past daar prima
- De `discount_code_id` (uuid) blijft `null` bij meerdere codes — dat is OK want het wordt niet gebruikt voor berekeningen
- De `discount_amount` wordt apart berekend en opgeslagen




## Analyse: 4 fixes in storefront-api

Er is geen `sellqo-proxy` edge function — alle cart logica zit in `storefront-api/index.ts`. De bugs zitten daar:

### Bevindingen

1. **CORS**: Geen `Access-Control-Allow-Methods` header aanwezig. Browsers blokkeren DELETE/PATCH/PUT preflight requests niet zolang de `Allow-Headers` correct zijn (die zijn dat), maar het toevoegen van `Allow-Methods` is best practice en voorkomt edge cases.

2. **DELETE en PATCH routes**: DELETE route **bestaat al** (line 1957). PATCH route **ontbreekt** — er is alleen PUT (line 1953). Dit betekent dat als de frontend PATCH stuurt, het een 404 krijgt.

3. **Prijs fallback**: In `cartGet` (line 1093) wordt `item.unit_price` gebruikt voor `line_total`. Dit is de prijs die bij het toevoegen werd opgeslagen. Als die 0 was (bv. cadeaukaart zonder variant-prijs), blijft het €0.00. De fix zit in `cartAddItem` (line 1128) — daar wordt al `variant.price ?? product.price` gedaan, dus het probleem is dat sommige items zijn toegevoegd vóór die fix, of dat `unit_price` nooit goed werd opgeslagen.

### Plan

**File: `supabase/functions/storefront-api/index.ts`**

1. **CORS headers uitbreiden** (line 4-7): Voeg `Access-Control-Allow-Methods` toe:
   ```
   "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
   ```

2. **PATCH route toevoegen** (na line 1956): Voeg PATCH als alias voor de bestaande PUT cart item update toe:
   ```typescript
   if (method === 'PATCH' && resourceId && subResource === 'items' && subResourceId) {
     const body = await req.json();
     return jsonResponse({ success: true, data: await cartUpdateItem(supabase, tenantId, { item_id: subResourceId, ...body }) }, 200, 'no-cache');
   }
   ```

3. **Prijs fallback in cartGet normalizer** (line 1090): Pas `unit_price` aan zodat als het 0/null is, de product-level prijs als fallback wordt gebruikt:
   ```typescript
   const effectivePrice = item.unit_price || variant?.price || item.products?.price || 0;
   ```
   En gebruik `effectivePrice` voor zowel `unit_price` als `line_total`.


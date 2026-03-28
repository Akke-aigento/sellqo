

## Storefront API: Bundel Product Data Ontsluiten

### Probleem
De `storefront-api` edge function retourneert geen `product_type`, bundel-configuratie of bundel-items. Een custom frontend kan dus niet weten dat een product een bundel is, laat staan de inhoud tonen.

### Wat we aanpassen

**1. `getProduct()` — bundel data toevoegen (storefront-api/index.ts)**

Na de bestaande variant/review queries, als `product.product_type === 'bundle'`:
- Query `product_bundle_items` met child product join: `id, name, slug, price, images, featured_image, stock, track_inventory`
- Retourneer in de response:
  - `product_type` (altijd, voor alle producten)
  - `bundle_pricing_model`, `bundle_discount_type`, `bundle_discount_value`
  - `bundle_items[]` array met per item: child product info, quantity, min/max quantity, customer_can_adjust, sort_order
  - `bundle_individual_total` — som van (child.price × quantity) voor prijsvergelijking
  - `bundle_savings` — verschil tussen individual total en bundelprijs (als > 0)

**2. `getProducts()` — product_type meegeven in lijstweergave**

Voeg `product_type` toe aan de select query en de response map, zodat de frontend bundels kan markeren in overzichten.

**3. Prompt voor custom frontend project**

Na de API-aanpassing maak ik een kant-en-klare prompt die je in het VanXcel-project kunt plakken, met:
- Hoe de API aan te roepen
- De exacte response structuur
- Voorbeeld component-logica voor bundelweergave (productenlijst, prijsvergelijking, kortingsbadge)

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | `getProduct`: bundle_items query + response velden. `getProducts`: product_type in select + output |


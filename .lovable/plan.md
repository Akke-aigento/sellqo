
# Fase 3: Volledige Product Varianten + Password Reset E-mail

## Overzicht

Drie onderdelen worden geimplementeerd:
1. **Password reset e-mail via Resend** (voltooiing Fase 2)
2. **Volledige product_variants tabel** met eigen SKU, voorraad, prijs per variant
3. **Storefront API aanpassingen** voor variant-support in product detail, cart en checkout

---

## 1. Password Reset E-mail (Resend)

De `request_password_reset` actie in `storefront-customer-api` wordt uitgebreid om een daadwerkelijke e-mail te sturen via Resend met een reset-link. De RESEND_API_KEY is al geconfigureerd.

---

## 2. Database: product_variants tabel

Nieuwe tabel `product_variants`:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | FK naar products |
| tenant_id | UUID | FK naar tenants |
| title | TEXT | Bijv. "Rood / L" |
| sku | TEXT | Uniek per tenant (nullable) |
| barcode | TEXT | EAN/UPC (nullable) |
| price | DECIMAL | Override productprijs (nullable = gebruik productprijs) |
| compare_at_price | DECIMAL | Van-prijs override (nullable) |
| cost_price | DECIMAL | Kostprijs override (nullable) |
| stock | INT | Voorraad per variant (default 0) |
| track_inventory | BOOLEAN | Default true |
| image_url | TEXT | Afbeelding voor deze variant |
| attribute_values | JSONB | Bijv. {"color": "Rood", "size": "L"} |
| weight | DECIMAL | Gewicht override (nullable) |
| position | INT | Sorteervolgorde |
| is_active | BOOLEAN | Default true |
| created_at / updated_at | TIMESTAMPTZ | Timestamps |

Nieuwe tabel `product_variant_options` (optie-definities per product):

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | FK naar products |
| tenant_id | UUID | FK naar tenants |
| name | TEXT | Bijv. "Kleur", "Maat" |
| values | TEXT[] | Bijv. ["Rood", "Blauw", "Groen"] |
| position | INT | Sorteervolgorde |

Wijzigingen aan bestaande tabellen:
- `storefront_cart_items`: voeg `variant_id UUID` kolom toe (nullable, FK naar product_variants)
- `order_items`: voeg `variant_id UUID` kolom toe (nullable, FK naar product_variants)

RLS: Alle nieuwe tabellen krijgen service-role-only policies (net als andere storefront tabellen).

---

## 3. Storefront API Aanpassingen

### get_product
- Query `product_variants` en `product_variant_options` bij het ophalen van een product
- Response bevat `variants[]` array en `options[]` array
- Elke variant bevat: id, title, sku, price (of fallback naar productprijs), stock, in_stock, image_url, attribute_values

### get_products (lijst)
- Voeg `has_variants` boolean toe per product
- Voeg `price_range: { min, max }` toe als varianten bestaan
- Optionele filter: `variant_attribute` (bijv. color=Rood)

### cart_add_item
- Accepteer optionele `variant_id` parameter
- Valideer dat variant bij product hoort
- Gebruik variant prijs (indien gezet) in plaats van productprijs
- Voorraadcheck op variant-niveau als variant_id aanwezig
- Cart items worden uniek per `product_id + variant_id` combinatie

### cart_get
- Toon variant info bij cart items (title, attribute_values, image)

### checkout_place_order
- Sla `variant_id` en `variant_title` op in order_items
- Decrementeer voorraad op variant-niveau (niet product-niveau) als variant gekozen
- Voeg `decrement_variant_stock` database functie toe

---

## 4. Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/migrations/XXXX.sql` | product_variants, product_variant_options tabellen; cart_items + order_items variant_id kolom; decrement_variant_stock functie |
| `supabase/functions/storefront-api/index.ts` | get_product (variants), get_products (price_range), cart_add/get/update (variant_id), checkout (variant stock) |
| `supabase/functions/storefront-customer-api/index.ts` | request_password_reset (Resend e-mail) |
| `.lovable/plan.md` | Fase 3 status |

---

## Technisch Detail: Voorraad Flow met Varianten

```text
Product (parent)
  stock = SUM van alle variant stocks (of eigen stock als geen varianten)
  
Variant A (Rood/S)  stock = 10
Variant B (Rood/M)  stock = 5  
Variant C (Blauw/S) stock = 8

Cart add: product_id + variant_id
  -> check variant.stock >= quantity
  -> unit_price = variant.price ?? product.price

Checkout:
  -> decrement variant stock
  -> order_item.variant_id = variant.id
  -> order_item.variant_title = "Rood / S"
```

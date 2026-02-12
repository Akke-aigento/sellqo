
# Fase 3: Volledige Product Varianten + Password Reset E-mail — ✅ VOLTOOID

## Status: VOLTOOID

### 1. Password Reset E-mail (Resend) — ✅
- `request_password_reset` stuurt nu een echte e-mail via Resend
- HTML template met "Nieuw wachtwoord instellen" CTA
- Fallback: als Resend faalt wordt token nog steeds opgeslagen

### 2. Database: product_variants — ✅
- `product_variants` tabel aangemaakt (SKU, barcode, prijs override, stock, attribute_values JSONB)
- `product_variant_options` tabel aangemaakt (optie-definities per product)
- `variant_id` kolom toegevoegd aan `storefront_cart_items` en `order_items`
- `decrement_variant_stock` database functie aangemaakt
- Unique index op cart items per product+variant combinatie

### 3. Storefront API Aanpassingen — ✅
- `get_product`: retourneert `variants[]`, `options[]`, `has_variants`
- `get_products`: retourneert `has_variants`, `price_range: { min, max }`
- `cart_add_item`: accepteert `variant_id`, valideert variant, gebruikt variant prijs/stock
- `cart_get`: toont variant info (title, attribute_values, image)
- `checkout_place_order`: slaat variant_id/variant_title op in order_items, decrementeert variant stock

### 4. Frontend CartContext — ✅
- `CartItem` interface uitgebreid met `variantId` en `variantTitle`
- `addToCart` matcht nu op `productId + variantId` combinatie
- ShopCart toont variant titel bij cart items

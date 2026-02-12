
# Storefront API — Status

## ✅ Geïmplementeerd

### Database
- `storefront_carts` + `storefront_cart_items` + `storefront_customers` tabellen aangemaakt

### storefront-api (alle acties)
| Actie | Status |
|-------|--------|
| `resolve_domain` | ✅ |
| `get_tenant` | ✅ (locale-aware) |
| `get_config` | ✅ |
| `get_products` | ✅ (sortering, paginering, filters) |
| `get_product` | ✅ (detail + reviews + related) |
| `get_categories` | ✅ (hiërarchie + productaantal) |
| `get_pages` | ✅ (lijst + detail) |
| `get_homepage` | ✅ |
| `get_reviews` | ✅ |
| `search_products` | ✅ (+ autocomplete) |
| `get_seo` | ✅ (hreflang + OG) |
| `get_sitemap_data` | ✅ |
| `get_shipping_methods` | ✅ |
| `get_service_points` | ✅ |
| `calculate_promotions` | ✅ |
| `validate_discount_code` | ✅ |
| `cart_create` | ✅ |
| `cart_get` | ✅ |
| `cart_add_item` | ✅ |
| `cart_update_item` | ✅ |
| `cart_remove_item` | ✅ |
| `cart_apply_discount` | ✅ |
| `cart_remove_discount` | ✅ |
| `checkout_start` | ✅ |
| `checkout_set_addresses` | ✅ |
| `checkout_get_shipping_options` | ✅ |
| `checkout_get_payment_methods` | ✅ |
| `checkout_place_order` | ✅ (Stripe + bankoverschrijving) |
| `checkout_get_confirmation` | ✅ |

### storefront-customer-api
| Actie | Status |
|-------|--------|
| `register` | ✅ |
| `login` | ✅ |
| `get_profile` | ✅ |
| `update_profile` | ✅ |
| `get_orders` | ✅ |
| `get_order` | ✅ |
| `get_addresses` | ✅ |
| `add_address` | ✅ |
| `update_address` | ✅ |
| `delete_address` | ✅ |
| `change_password` | ✅ |

## Fase 2 (Later)
- Nieuwsbrief aanmelding via API
- Wishlist/favorieten
- Product varianten
- Real-time voorraad updates
- Caching laag
- Rate limiting per tenant
- Password reset via e-mail

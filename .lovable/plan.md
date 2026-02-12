
# Fase 2 Implementatie: Status ✅ VOLTOOID

## Wat is geïmplementeerd

### 1. Newsletter Aanmelding via API ✅
- `newsletter_subscribe` actie in `storefront-api`
- Valideert e-mail, controleert duplicaten, synct met externe providers (Mailchimp/Klaviyo)
- Double opt-in support

### 2. Wishlist / Favorieten ✅
- `storefront_favorites` tabel aangemaakt
- `wishlist_get`, `wishlist_add`, `wishlist_remove` acties in `storefront-customer-api`
- Product-verrijkte responses met prijs, afbeeldingen, voorraadstatus

### 3. Password Reset ✅
- `request_password_reset` — genereert HMAC-token (1 uur geldig), slaat op in database
- `reset_password` — valideert token + e-mail, update wachtwoord
- Veilige response (lekt niet of e-mail bestaat)
- **Opmerking:** E-mailverzending nog niet geïmplementeerd (vereist SendGrid/Resend API key)

### 4. Rate Limiting ✅
- In-memory rate limiter: 1000 requests/minuut per tenant
- 429 Too Many Requests response bij overschrijding

### 5. HTTP Caching Headers ✅
- `Cache-Control` headers op read-only endpoints:
  - Config/categories/pages: 5 min
  - Products: 1 min
  - Reviews: 2 min
  - SEO: 10 min
  - Sitemap: 1 uur

## Nog open (Fase 3)
- Product varianten (SKU's, prijzen per variant)
- E-mailservice integratie voor password reset
- WebSocket-gebaseerde real-time stock updates
- Persistent (Redis/database) rate limiting

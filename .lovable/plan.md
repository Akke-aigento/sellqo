
# Fase 2 Implementatie: Storefront API Uitbreidingen

## Overzicht Fase 2

Fase 2 bestaat uit vijf modulaire uitbreidingen die na elkaar of parallel kunnen worden gebouwd. Prioriteit is **Newsletter via API** en **Password Reset**, omdat deze vrijwel direct bruikbaar zijn. **Wishlist/Favorites** is optioneel maar gemakkelijk implementeerbaar.

## 1. Newsletter Aanmelding via API

### Huidge situatie
- Aparte `newsletter-subscribe` edge function bestaat al
- Ondersteunt internal, Mailchimp, Klaviyo providers
- Double opt-in en sync status tracking

### Implementatie
**Nieuw in `storefront-api`:**
- Actie `newsletter_subscribe` die:
  - E-mail valideert
  - Controleert of al aangemeld
  - Neemt contact op met `newsletter-subscribe` function of voert logica direct uit
  - Retourneert success en bericht

**Geen nieuwe database-tabellen nodig** — gebruikt bestaande `newsletter_subscribers` tabel.

**Flow:**
```
POST /storefront-api
{
  "action": "newsletter_subscribe",
  "tenant_id": "...",
  "params": { "email": "user@example.com", "first_name": "John" }
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully subscribed",
  "provider": "internal|mailchimp|klaviyo",
  "double_optin": false
}
```

---

## 2. Wishlist / Favorieten

### Huidge situatie
- UI button "Add to Wishlist" bestaat al in `ShopProductDetail.tsx`
- `show_wishlist` feature flag bestaat al in theme settings
- **Geen database-tabel** voor product wishlist/favorites

### Implementatie
**Nieuw in database:**
- Tabel `storefront_favorites`:
  - `id, tenant_id, customer_id, product_id, created_at`
  - Unieke constraint op `(tenant_id, customer_id, product_id)`

**Nieuwe acties in `storefront-api` (geverifieerd met token):**
- `wishlist_add` — Product aan wishlist toevoegen
- `wishlist_remove` — Product verwijderen
- `wishlist_get` — Alle favorieten ophalen

**Flow (requires auth token):**
```
POST /storefront-api
{
  "action": "wishlist_add",
  "tenant_id": "...",
  "params": { "product_id": "..." },
  "headers": { "x-storefront-token": "..." }
}
```

Response:
```json
{
  "success": true,
  "message": "Product added to wishlist"
}
```

---

## 3. Product Varianten (Voorbereid, niet volledig)

### Huidge situatie
- Variants worden niet opgeslagen in `products` tabel
- Config heeft `variant_style` maar geen implementatie

### Decision nodig
Product variants zijn complex omdat ze:
1. SKU's, voorraad per variant
2. Prijs per variant (override product prijs)
3. Afbeeldingen per variant
4. Kleur/maat/andere opties

**Dit is uit scope voor Fase 2** tenzij er een bestaand variant-systeem is. Voorgesteld: **dit uitstellen naar Fase 3**, of een simpel `variant_options` JSONB veld toevoegen aan `products` voor toekomstige use.

---

## 4. Real-Time Voorraad Updates

### Huidge situatie
- `products.stock` wordt gedecrementeerd bij bestellingen
- Geen WebSocket/realtime op dit moment

### Implementatie
**Simpele benadering (zonder WebSocket):**
- `get_product` action retourneert `stock` + `stock_updated_at`
- Frontend kan polling doen (bijv. om 10 seconden) voor live-updates
- RLS policy ervoor zorgen dat anonyme requests het `stock` veld kunnen zien

**WebSocket benadering (meer complex):**
- Supabase Realtime inschakelen op `products` tabel
- Frontend luistert naar changes op `product_id`

**Aanbeveling:** Polling is voltoende voor Fase 2. WebSocket kan later.

---

## 5. Caching Laag

### Implementatie
**Vereenvoudigd:**
- `get_products` en `get_categories` resultaten 5 minuten cachen in edge function
- Invalidatie op product/category update (via database trigger)
- Cache key: `<tenant_id>:<action>:<params_hash>`

**Techniek:**
- Deno `std/cache` of in-memory Map (niet persistent over deployments)
- Of: Cache headers op de HTTP response (`Cache-Control: max-age=300`)

**Aanbeveling:** HTTP cache headers voltoende voor MVP. In-memory cache kan later.

---

## 6. Rate Limiting per Tenant

### Implementatie
- Edge function middleware die request rate controleert
- Storage: Gebruik `SUPABASE_SERVICE_ROLE_KEY` om per-tenant limits op te slaan in een `rate_limit_tracker` tabel
- Limiet: bijv. 100 requests per minuut per tenant
- Op overschrijding: `429 Too Many Requests`

**Voor Fase 2:** Eenvoudig limit (bijv. 1000/min) voor abuse protection. Fijnafstemming later.

---

## 7. Password Reset via E-mail

### Huidge situatie
- `storefront-customer-api` heeft `register` en `login`
- **Geen password reset functionaliteit**

### Implementatie
**Twee acties in `storefront-customer-api`:**

1. **`request_password_reset`** (anoniem)
   - Input: `email`
   - Validatie: e-mail bestaat
   - Genereer reset token (HMAC met 1 uur expiry)
   - **Stuur e-mail met reset link** (via SendGrid, PostMark, of localhost voor dev)
   - Response: "Check your email"

2. **`reset_password`** (anoniem, maar met token)
   - Input: `email, reset_token, new_password`
   - Valideer token
   - Update password_hash
   - Response: "Password reset successfully"

**Database:**
- Voeg `password_reset_token` en `password_reset_expires_at` velden toe aan `storefront_customers`
- Of: Aparte `password_reset_tokens` tabel

**E-mail vereiste:**
- Zal een **SendGrid API key** (of alternatief) nodig hebben
- Reset link format: `https://custom-frontend.lovable.app/reset-password?token=...&email=...`

**Issue:** SellQo heeft geen eigen e-mailservice geïmplementeerd. Dit vereist integratie met een externe service.

---

## Implementatiestrategie

### Prioriteit (Aanbevolen Volgorde)

| # | Feature | Inspanning | Impact | Volgorde |
|---|---------|-----------|--------|---------|
| 1 | Newsletter API | Laag | Hoog | **Start hier** |
| 2 | Wishlist/Favorites | Laag | Gemiddeld | Parallel |
| 3 | Password Reset | Gemiddeld | Hoog | Daarna (vereist e-mail) |
| 4 | Rate Limiting | Laag | Laag (security) | Snel na |
| 5 | Caching | Gemiddeld | Gemiddeld (perf) | Daarna |
| 6 | Real-Time Stock | Laag (polling) / Hoog (WS) | Laag | Optioneel |
| 7 | Product Variants | **Hoog** | Hoog | **Fase 3** |

### Fase 2 Deliverables

**Mínimaal (MVP):**
1. Newsletter API action
2. Wishlist tabel + CRUD acties
3. Password reset met token generatie (e-mail optioneel voor MVP)
4. Rate limiting middleware

**Optioneel:**
5. Caching headers
6. Polling endpoint voor stock updates

### Bestanden die aangemaakt/gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/migrations/XXXX.sql` | `storefront_favorites` tabel, `storefront_customers` kolommen (`password_reset_token`, `password_reset_expires_at`) |
| `supabase/functions/storefront-api/index.ts` | `newsletter_subscribe` actie |
| `supabase/functions/storefront-customer-api/index.ts` | `request_password_reset`, `reset_password`, `wishlist_add`, `wishlist_remove`, `wishlist_get` acties |
| `.lovable/plan.md` | Fase 2 status update |

---

## Kritieke Decision: E-mail voor Password Reset

Password reset vereist **e-mail verzending**. Opties:

1. **SendGrid** — Meest betrouwbaar, free tier (100/dag)
2. **Resend** — Modern, goedkoop, EU-gebaseerd
3. **Localhost nodemailer** (dev only)
4. **MVP zonder e-mail** — Token genereren, maar frontend toont het direct (niet realistisch voor production)

**Aanbeveling:** SendGrid setup starten of Resend. Dit vereist een API key die in secrets moet worden opgeslagen.

---

## Volgorde van Implementatie (Week 1)

1. **Dag 1-2:** Database migratie (favorites tabel, customer reset token velden)
2. **Dag 2:** Newsletter API action
3. **Dag 3:** Wishlist CRUD acties
4. **Dag 4:** Password reset (tot token generatie, e-mail later)
5. **Dag 5:** Rate limiting, caching headers, testen


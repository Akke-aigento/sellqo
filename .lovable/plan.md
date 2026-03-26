

## Custom Frontend Documentatie Uitbreiden — Ontbrekende Prompts

### Huidige staat
De `CustomFrontendConfigurator.tsx` bevat 5 prompts die de basis dekken (client, proxy, checkout, footer, contact). Maar de API heeft intussen veel meer functionaliteit die **niet gedocumenteerd** is in de prompts.

### Wat ontbreekt (en dus niet functioneel zou zijn op een custom frontend)

| Feature | API Endpoints (bestaan al) | Prompt? |
|---|---|---|
| **Klantaccounts** (registratie, login, e-mailverificatie, profiel, wachtwoord reset) | `storefront-customer-api`: register, login, verify_email, resend_verification, get_profile, update_profile, change_password, request_password_reset, reset_password | ✅ Prompt 6 |
| **Bestelgeschiedenis & adressen** | get_orders, get_order, get_addresses, add/update/delete_address | ✅ Prompt 7 |
| **Wishlist/Favorieten** | wishlist_get, wishlist_add, wishlist_remove | ✅ Prompt 7 |
| **B2B velden** (bedrijfsnaam, BTW-nummer met VIES validatie) | register + update_profile params: company_name, vat_number | ✅ Prompt 6 |
| **Bundel producten** | get_product retourneert nu bundle_items + bundle_individual_total | ✅ Prompt 8 |
| **Nieuwsbrief** | POST /newsletter/subscribe | ✅ Prompt 9 |
| **Reviews** | GET /reviews, GET /products/{slug}/reviews | ✅ Prompt 8 |
| **Zoeken** | GET /search?q=... | ✅ Prompt 8 |
| **Navigatie** | GET /navigation (main menu, footer menu) | ✅ Prompt 9 |
| **Gift cards** | GET /gift-cards, POST /gift-cards/balance | ✅ Prompt 9 |
| **Verzendmethoden & servicepunten** | GET /shipping, GET /service-points | ✅ Prompt 11 |
| **Promoties/kortingen** | calculate_promotions, validate_discount_code, cart discount endpoints | ✅ Prompt 11 |
| **SEO & Sitemap** | GET /seo, GET /sitemap | ✅ Prompt 10 |
| **Settings sub-endpoints** | GET /settings/social, /trust, /conversion, /checkout, /languages | ✅ Prompt 10 |
| **Migratie-compatibele registratie** | Claim-flow voor gemigreerde klanten zonder wachtwoord | ✅ Prompt 6 |

### Status: ✅ VOLLEDIG — Alle 11 prompts zijn geïmplementeerd

---

## Segmenten, Advertenties & Campagnes — Verbeteringen

### Fase 1 — Kritische ontbrekende functionaliteit ✅ VOLTOOID

| # | Wat | Status |
|---|---|---|
| 1 | **Productselectie stap in CampaignWizard** | ✅ |
| 2 | **Doelgroep/Segment stap in CampaignWizard** | ✅ |
| 3 | **Datumkiezer in CampaignWizard** | ✅ |
| 4 | **Creatives beheer (CreativeManager)** | ✅ |
| 5 | **Campagne detail pagina** | ✅ |

### Fase 2 — Segmenten verbeteren ✅ VOLTOOID

| # | Wat | Status |
|---|---|---|
| 6 | **Segment bewerken** | ✅ |
| 7 | **Extra filters (auto-tags, registratiedatum)** | ✅ |
| 8 | **Klantpreview** | 🔜 Volgende iteratie |

### Fase 3 — Samenhang & Cross-channel

| # | Wat | Status |
|---|---|---|
| 9 | Gedeelde segmenten widget | 🔜 |
| 10 | Performance grafieken per campagne | 🔜 |
| 11 | AI Suggesties invullen | 🔜 |



# Audit: Storefront Configuratie vs. Implementatie

## Overzicht

Na grondige analyse van alle admin-instellingen (in `StorefrontFeaturesSettings.tsx` en `storefront-config.ts`) versus de daadwerkelijke storefront-code, zijn er **13 niet-geimplementeerde instellingen** gevonden die wel configureerbaar zijn in het admin-paneel maar geen effect hebben op de webshop.

---

## Status per Instelling

### WERKEND (al geimplementeerd)

| Instelling | Locatie |
|-----------|---------|
| Newsletter popup (aan/uit, delay, incentive tekst) | `ShopLayout.tsx` -> `NewsletterPopup` |
| Cookie banner (aan/uit, style) | `ShopLayout.tsx` -> `CookieBanner` |
| Nav style (simple / mega_menu) | `ShopLayout.tsx` -> `MegaMenu` |
| Header sticky | `ShopLayout.tsx` header classes |
| Search display (visible / icon / hidden) | `ShopLayout.tsx` -> `StandardHeader` |
| Mobile bottom nav | `ShopLayout.tsx` -> `MobileBottomNav` |
| Show stock count | `ShopProductDetail.tsx` |
| Show viewers count | `ShopProductDetail.tsx` |
| Show recent purchases | `ShopLayout.tsx` -> `RecentPurchaseToast` |
| Exit intent popup | `ShopLayout.tsx` -> `ExitIntentPopup` |
| Image zoom (hover / click / lightbox / none) | `ShopProductDetail.tsx` |
| Variant style (dropdown / swatches / buttons) | `ShopProductDetail.tsx` |
| Products per row | `ShopProducts.tsx` grid columns |
| Product card style (minimal / standard / detailed) | `ShopProducts.tsx` -> `ProductCard` |
| Show breadcrumbs | `ShopProducts.tsx`, `ShopProductDetail.tsx` |
| Show wishlist | `ShopProductDetail.tsx`, `ShopProducts.tsx` |

### NIET WERKEND (admin-instelling zonder effect)

| # | Instelling | Admin-veld | Probleem |
|---|-----------|------------|---------|
| 1 | **Gastbestelling toestaan** | `checkout_guest_enabled` | Checkout vereist geen account en negeert deze instelling volledig |
| 2 | **Telefoonnummer verplicht** | `checkout_phone_required` | Telefoonveld is altijd optioneel in `ShopCheckout.tsx`, validatie ontbreekt |
| 3 | **Bedrijfsveld (hidden/optional/required)** | `checkout_company_field` | Er is helemaal geen bedrijfsnaam-veld in het checkout-formulier |
| 4 | **Adres autocomplete** | `checkout_address_autocomplete` | Geen integratie met Google Places of PostcodeAPI |
| 5 | **Reviews weergave (full/stars_only/hidden)** | `product_reviews_display` | De instelling wordt gelezen maar er worden geen reviews getoond op de productpagina |
| 6 | **Voorraad indicator** | `product_stock_indicator` | De instelling wordt niet gelezen; voorraadstatus wordt altijd getoond |
| 7 | **Gerelateerde producten** | `product_related_mode` | Geen "Gerelateerde producten" sectie op de productdetailpagina |
| 8 | **Trust badges** | `trust_badges` | Veld bestaat in de database maar wordt nergens weergegeven |
| 9 | **Newsletter provider (internal/mailchimp/klaviyo)** | `newsletter_provider` | De popup slaat inschrijvingen nergens op -- geen backend, geen provider-integratie |
| 10 | **Meertaligheid** | `storefront_multilingual_enabled`, `storefront_languages`, `storefront_default_language`, `storefront_language_selector_style` | Er is geen taalselector in de storefront en content wordt niet vertaald |
| 11 | **Newsletter globale toggle** | `newsletter_enabled` | De popup wordt aangestuurd door `newsletter_popup_enabled`, maar de globale `newsletter_enabled` toggle wordt niet gecheckt |
| 12 | **Newsletter popup vertraging** | `newsletter_popup_delay_seconds` | Werkt, maar de popup slaat het e-mailadres niet daadwerkelijk op |
| 13 | **Cookie banner consent opslag** | `cookie_banner_enabled` | Banner wordt getoond, maar consent-keuzes worden niet opgeslagen of gerespecteerd |

---

## Implementatieplan

### Fase 1: Checkout Instellingen (4 items)

**Bestanden**: `ShopCheckout.tsx`

1. **`checkout_phone_required`**: Telefoonnummer verplicht maken op basis van instelling (asterisk + validatie)
2. **`checkout_company_field`**: Bedrijfsnaam-veld toevoegen met `hidden`/`optional`/`required` logica
3. **`checkout_guest_enabled`**: Indien uitgeschakeld, een login/registreer stap tonen voor checkout
4. **`checkout_address_autocomplete`**: (Technisch complex, vereist externe API) -- markeren als "upcoming" of een simpele postcode-lookup implementeren

### Fase 2: Productpagina (3 items)

**Bestanden**: `ShopProductDetail.tsx`

5. **`product_stock_indicator`**: Voorraadstatus conditioneel tonen op basis van deze instelling
6. **`product_reviews_display`**: Reviews sectie toevoegen (of verbergen) op basis van instelling -- koppelen aan bestaand reviews-systeem
7. **`product_related_mode`**: Gerelateerde producten sectie toevoegen onderaan productpagina (auto: zelfde categorie, manual: handmatig, off: verborgen)

### Fase 3: Trust & Conversie (2 items)

**Bestanden**: `ShopLayout.tsx`, nieuw component

8. **`trust_badges`**: Trust badges weergeven in de footer of checkout (bijv. "Veilig betalen", "Gratis retour")
9. **`newsletter_provider` + opslag**: Newsletter popup daadwerkelijk laten opslaan in `newsletter_subscribers` tabel (of koppeling met externe provider)

### Fase 4: Meertaligheid (1 groot item)

**Bestanden**: `ShopLayout.tsx`, meerdere pagina's

10. **Taalselector + vertaalde content**: Language picker tonen in header, content serveren op basis van geselecteerde taal -- dit is een groot feature dat gebruikt maakt van de bestaande `content_translations` tabel

### Fase 5: Kleine fixes (3 items)

11. **`newsletter_enabled` global check**: Newsletter popup alleen tonen als zowel `newsletter_enabled` ALS `newsletter_popup_enabled` aan staan
12. **Cookie consent opslag**: Consent-keuzes opslaan in localStorage en respecteren (analytics/marketing cookies blokkeren)
13. **`product_stock_indicator`**: Op productlijsting ook conditioneel tonen

---

## Aanbevolen Prioriteit

1. **Fase 1** (Checkout) -- Direct merkbaar voor klanten, meest kritiek
2. **Fase 2** (Productpagina) -- Verrijkt de winkelervaring
3. **Fase 5** (Kleine fixes) -- Snel te implementeren
4. **Fase 3** (Trust/Newsletter) -- Verbetert conversie
5. **Fase 4** (Meertaligheid) -- Groot feature, aparte sprint

Elke fase kan onafhankelijk worden geimplementeerd. Ik raad aan om met Fase 1 (Checkout) te beginnen, aangezien dit het bestelproces direct verbetert.


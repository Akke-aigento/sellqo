
# Diepgaande Audit: Nog Niet-Werkende Storefront Instellingen

## Nog openstaande problemen (4 stuks)

### 1. Meertalige Webshop (Language Selector in Storefront)

**Status**: Admin-instellingen bestaan (4 velden in database + volledige admin UI), maar de storefront toont GEEN taalselector en content wordt niet vertaald.

**Wat ontbreekt**:
- Geen taalwisselaar in de header (alle 3 header-varianten: Standard, Centered, Minimal)
- Geen koppeling met de `content_translations` tabel voor productvertalingen
- De instellingen `storefront_languages`, `storefront_default_language`, en `storefront_language_selector_style` worden niet gelezen in `ShopLayout.tsx`

**Implementatie**:
- Nieuw component `StorefrontLanguageSelector.tsx` met 3 stijlen: dropdown, flags, text
- Integratie in alle 3 header-componenten (`StandardHeader`, `CenteredHeader`, `MinimalHeader`)
- Taalvoorkeur opslaan in `localStorage`
- Productgegevens ophalen uit `content_translations` wanneer een niet-standaard taal is geselecteerd
- Storefront-context uitbreiden met huidige taal, zodat alle pagina's (product, categorie, checkout) de juiste vertaling tonen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/storefront/StorefrontLanguageSelector.tsx` | Nieuw component met dropdown/flags/text stijlen |
| `src/components/storefront/ShopLayout.tsx` | Language selector toevoegen aan alle 3 headers + taal-instellingen lezen |
| `src/hooks/usePublicStorefront.ts` | Taal-context toevoegen + vertaalde content ophalen uit `content_translations` |
| `src/pages/storefront/ShopProductDetail.tsx` | Vertaalde product-velden tonen (naam, beschrijving) |
| `src/pages/storefront/ShopProducts.tsx` | Vertaalde productnamen in lijstweergave |

---

### 2. Reviews op Productpagina

**Status**: De variabele `reviewsDisplay` wordt uitgelezen uit settings maar wordt NERGENS gebruikt in de JSX. Er is geen reviews-sectie op de productdetailpagina.

**Wat ontbreekt**:
- Geen reviews-sectie onder de productbeschrijving
- De instelling `product_reviews_display` (`full` / `stars_only` / `hidden`) heeft geen effect
- Bestaande `usePublicReviews` hook en review-componenten worden alleen in de layout/footer gebruikt

**Implementatie**:
- Reviews ophalen per product (via product-specifieke reviews of algemene winkel-reviews)
- Sectie onder productinfo tonen met volledige reviews (`full`), alleen sterren (`stars_only`), of niets (`hidden`)
- Gemiddelde sterren-rating tonen naast de productnaam

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/storefront/ShopProductDetail.tsx` | Reviews-sectie toevoegen + sterren bij productnaam + `reviewsDisplay` conditioneel |
| `src/components/storefront/ProductReviewsSection.tsx` | Nieuw component: reviews lijst + gemiddelde rating |

---

### 3. Gastbestelling (Guest Checkout)

**Status**: `checkout_guest_enabled` bestaat in de database en is configureerbaar in admin, maar wordt NIET gecontroleerd in de checkout-flow.

**Wat ontbreekt**:
- Wanneer gastbestelling UIT staat, zou de klant eerst moeten inloggen/registreren
- Momenteel kan iedereen altijd bestellen zonder account

**Implementatie**:
- Bij het laden van checkout: als `checkout_guest_enabled === false`, controleer of er een ingelogde gebruiker is
- Zo niet: toon een login/registratie-blok in plaats van het bestelformulier
- Na inloggen: vul e-mail, naam etc. automatisch in uit het klantprofiel

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/storefront/ShopCheckout.tsx` | Guest-check toevoegen + login/registratie blok tonen als gastbestelling uit staat |

---

### 4. Trust Badges Admin UI

**Status**: De storefront toont trust badges correct als ze zijn ingesteld, maar er is GEEN admin-interface om te kiezen welke badges je wilt tonen.

**Wat ontbreekt**:
- In de "Trust & Compliance" accordion-sectie staan alleen cookie-banner instellingen
- Er is geen manier om trust badges (Veilig Betalen, Gratis Verzending, SSL Beveiligd, etc.) aan of uit te zetten
- Het `trust_badges` veld in de database wordt nooit ingevuld via de admin

**Implementatie**:
- Checkbox-lijst toevoegen in de Trust & Compliance sectie met alle beschikbare badges
- Badges: `veilig_betalen`, `gratis_verzending`, `gratis_retour`, `ssl_beveiligd`, `ideal`, `keurmerk`
- Opslaan als string-array in het `trust_badges` veld

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/StorefrontFeaturesSettings.tsx` | Trust badges checkbox-lijst toevoegen in de Trust & Compliance sectie + trust_badges opnemen in formData |

---

## Samenvatting prioriteit

1. **Trust Badges Admin UI** -- Snelle fix, 1 bestand
2. **Guest Checkout** -- Belangrijk voor beveiliging, 1 bestand
3. **Reviews op Productpagina** -- Verrijkt winkelervaring, 2 bestanden
4. **Meertalige Storefront** -- Grootste feature, 5+ bestanden, maar admin-kant is al klaar

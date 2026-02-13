
# Storefront Preview: Volledige Audit en Reparatie

Na een grondige analyse van de code EN de database-configuratie heb ik de volgende ontbrekende elementen gevonden:

---

## Gevonden Problemen

| # | Element | Status | Impact |
|---|---------|--------|--------|
| 1 | **"Home" link in StandardHeader** | Ontbreekt | CenteredHeader en MinimalHeader hebben het wel, StandardHeader (de actieve stijl) niet |
| 2 | **Logo uit themeSettings** | Wordt genegeerd | Alle headers/footer gebruiken `tenant.logo_url` (leeg), maar de geupload logo zit in `themeSettings.logo_url` |
| 3 | **Favicon** | Alleen op homepage | ShopHome zet het via Helmet, maar op product/cart/checkout pagina's ontbreekt het |
| 4 | **Juridische pagina's in footer** | Volledig ontbrekend | 2 gepubliceerde legal pages (Privacybeleid, Algemene Voorwaarden) worden nergens getoond. Er is zelfs geen route voor ze |
| 5 | **Mobiel hamburger menu bij Standard/Centered header** | Ontbreekt | Alleen MinimalHeader heeft een mobiel menu. Bij Standard en Centered verdwijnt navigatie op kleine schermen |
| 6 | **Breadcrumbs op productenpagina** | Ontbreekt | `show_breadcrumbs` staat aan, maar alleen ShopProductDetail toont breadcrumbs. ShopProducts en ShopCart missen ze |
| 7 | **ProductCard currency** | Hardcoded EUR | ProductCard formatteert altijd EUR, ongeacht `tenant.currency` |
| 8 | **Zoekfunctie in header** | Doet niets | StandardHeader heeft een zoek-icoon dat `searchOpen` toggelt, maar er verschijnt geen zoekbalk |
| 9 | **Footer sociale links filteren** | Toont lege sectie | `Object.keys(social_links).length > 0` is true voor `{}`, waardoor "Volg Ons" verschijnt zonder inhoud als er een leeg object is |
| 10 | **`themeSettings` niet doorgegeven aan StandardHeader/MinimalHeader** | Ontbreekt | CenteredHeader ontvangt `themeSettings` als prop (voor heading_font), Standard en Minimal niet |
| 11 | **Meta tags ontbreken op subpagina's** | Ontbreekt | ShopProducts heeft Helmet, maar ShopCart, ShopPage missen favicon. Geen consistente meta/SEO |
| 12 | **Categorie pagina breadcrumbs** | Ontbreekt | Als je op een categorie filtert is er geen breadcrumb-pad |

---

## Technische Aanpassingen

### 1. ShopLayout.tsx - Header verbeteringen

**StandardHeader:**
- "Home" link toevoegen als eerste navigatie-item
- `themeSettings` prop accepteren en logo_url daaruit prioriteren
- Mobiel hamburger menu toevoegen (zoals MinimalHeader)
- Zoekbalk tonen wanneer `searchOpen` actief is (input veld dat verschijnt onder de header)

**CenteredHeader:**
- Mobiel hamburger menu toevoegen voor kleine schermen
- `themeSettings.logo_url` prioriteit geven boven `tenant.logo_url`

**MinimalHeader:**
- `themeSettings` prop accepteren voor logo prioriteit

**Footer:**
- `themeSettings?.logo_url || tenant.logo_url` voor logo weergave
- Nieuwe "Juridisch" kolom met links naar gepubliceerde legal pages
- Social links check verbeteren: filteren op daadwerkelijk ingevulde waarden

**Favicon:**
- `useEffect` in ShopLayout die dynamisch de favicon zet via DOM manipulatie, zodat het op ALLE pagina's werkt
- Favicon Helmet verwijderen uit ShopHome.tsx

### 2. usePublicStorefront.ts - Legal pages query

Nieuwe query toevoegen die gepubliceerde legal pages ophaalt:
```
legal_pages -> tenant_id, is_published=true -> page_type, title_nl
```

Return als `legalPages` in het hook resultaat.

### 3. Nieuwe route en pagina: ShopLegalPage.tsx

Nieuwe storefront pagina aanmaken voor `/shop/:tenantSlug/legal/:pageType` die:
- De legal page content ophaalt op basis van tenant_id en page_type
- Het in ShopLayout rendert met juiste heading font
- Breadcrumbs toont

Route toevoegen in App.tsx.

### 4. ShopProducts.tsx - Breadcrumbs

Breadcrumbs toevoegen boven de producten header wanneer `show_breadcrumbs` actief is:
```
Home > Producten > [Categorie naam]
```

### 5. ShopCart.tsx - Breadcrumbs

Breadcrumbs toevoegen:
```
Home > Winkelwagen
```

### 6. ProductCard.tsx - Currency prop

`currency` prop toevoegen en doorgeven vanuit ShopProducts en andere plekken waar ProductCard gebruikt wordt.

### 7. Zoekbalk in StandardHeader

Wanneer `searchOpen` waar is, een input veld tonen dat navigeert naar `/shop/{slug}/products?q={zoekterm}`.

---

## Samenvatting wijzigingen per bestand

| Bestand | Wijzigingen |
|---------|-------------|
| `src/components/storefront/ShopLayout.tsx` | Home link, logo prioriteit uit themeSettings, mobiel menu voor Standard+Centered, zoekbalk, legal pages in footer, favicon useEffect, social links fix, themeSettings prop doorvoeren |
| `src/hooks/usePublicStorefront.ts` | Legal pages query toevoegen, `legalPages` returnen |
| `src/pages/storefront/ShopHome.tsx` | Favicon Helmet tag verwijderen |
| `src/pages/storefront/ShopProducts.tsx` | Breadcrumbs toevoegen, currency doorgeven aan ProductCard |
| `src/pages/storefront/ShopCart.tsx` | Breadcrumbs toevoegen |
| `src/pages/storefront/ShopLegalPage.tsx` | **Nieuw**: pagina voor juridische content |
| `src/components/storefront/ProductCard.tsx` | Currency prop accepteren en gebruiken |
| `src/App.tsx` | Route toevoegen voor `/shop/:tenantSlug/legal/:pageType` |

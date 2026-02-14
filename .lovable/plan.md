

# Storefront Instellingen: Volledige Koppeling Audit

## Het Probleem

De admin-instellingen onder "Functies & Gedrag" worden correct opgeslagen in de database, maar de storefront **leest en gebruikt ze niet**. De volgende configuratie-opties hebben geen enkel effect op de daadwerkelijke webshop:

---

## Alle Niet-werkende Instellingen

| # | Instelling | Opgeslagen als | Effect in storefront |
|---|-----------|---------------|---------------------|
| 1 | **Navigatie stijl** (simple/mega_menu) | `nav_style` | Geen -- header is altijd hetzelfde, geen mega menu implementatie |
| 2 | **Sticky header** aan/uit | `header_sticky` | Geen -- header is altijd `sticky top-0` |
| 3 | **Zoekbalk weergave** (visible/icon/hidden) | `search_display` | Geen -- zoek-icoon altijd getoond als icon, nooit visible of hidden |
| 4 | **Mobiele bottom navigatie** | `mobile_bottom_nav` | Geen -- niet gebouwd |
| 5 | **Cookie banner** aan/uit + stijl | `cookie_banner_enabled`, `cookie_banner_style` | Geen -- geen cookie banner component bestaat |
| 6 | **Voorraad teller tonen** | `show_stock_count` | Geen -- niet gebruikt in ProductCard of productdetail |
| 7 | **Kijkers tellen tonen** | `show_viewers_count` | Geen -- niet gebouwd |
| 8 | **Recente aankopen tonen** | `show_recent_purchases` | Geen -- niet gebouwd |
| 9 | **Exit intent popup** | `exit_intent_popup` | Geen -- niet gebouwd |
| 10 | **Nieuwsbrief popup** | `newsletter_popup_enabled` + delay | Geen -- geen popup component |
| 11 | **Product afbeelding zoom** | `product_image_zoom` | Geen -- niet doorgegeven aan productdetail |
| 12 | **Variant weergave stijl** | `product_variant_style` | Geen -- altijd standaard buttons |
| 13 | **Reviews weergave** | `product_reviews_display` | Geen -- niet gecheckt in productdetail |

---

## Implementatieplan

### Fase 1: Navigatie-instellingen (direct zichtbaar verschil)

**ShopLayout.tsx aanpassen:**

- **`nav_style: 'mega_menu'`**: Wanneer actief, categorien tonen in een uitklapbaar dropdown paneel (hover op desktop) met subcategorieen en eventueel afbeeldingen. Het `simple` formaat blijft de huidige platte links.
- **`header_sticky`**: De header krijgt conditioneel de `sticky top-0` class. Als `false`, wordt het een gewone statische header.
- **`search_display`**:
  - `'visible'`: Zoekbalk altijd zichtbaar in de header (inline input)
  - `'icon'`: Huidige gedrag (icoon dat uitklapt)
  - `'hidden'`: Geen zoekfunctie in de header
- **`mobile_bottom_nav`**: Wanneer actief, een vaste navigatiebalk onderaan het scherm op mobiel met Home, Zoeken, Categorieen, Winkelwagen iconen.

### Fase 2: Cookie Banner Component

**Nieuw bestand: `src/components/storefront/CookieBanner.tsx`**

Een component die verschijnt wanneer `cookie_banner_enabled` actief is:
- `'minimal'`: Kleine balk onderaan met "Accepteren" knop
- `'detailed'`: Balk met categoriekeuzes (functioneel, analytisch, marketing)
- `'popup'`: Centered modal
- Consent opslaan in localStorage zodat het niet herhaalt

Renderen in ShopLayout wanneer `themeSettings.cookie_banner_enabled` true is.

### Fase 3: Conversie-elementen

**Stock count** (`show_stock_count`):
- In `ShopProductDetail.tsx`: Toon "Nog X op voorraad" wanneer voorraad laag is (bijv. < 10)

**Kijkers teller** (`show_viewers_count`):
- Simuleer met een random getal (bijv. "3 mensen bekijken dit nu") op de productdetailpagina

**Recente aankopen popup** (`show_recent_purchases`):
- Toast-achtige melding die periodiek verschijnt: "Iemand uit Amsterdam kocht [product] 5 min geleden"

**Exit intent popup** (`exit_intent_popup`):
- Detecteer muis die het venster verlaat (mouseout event op document)
- Toon een popup met korting of nieuwsbrief aanmelding
- Eenmalig per sessie (sessionStorage)

### Fase 4: Nieuwsbrief Popup

**Nieuw bestand: `src/components/storefront/NewsletterPopup.tsx`**

Wanneer `newsletter_popup_enabled` actief:
- Wacht `newsletter_popup_delay_seconds` seconden
- Toon een modale popup met email input
- Toon `newsletter_incentive_text` als dat ingevuld is
- Opslaan in een `newsletter_subscribers` tabel of alleen lokaal markeren als getoond

### Fase 5: Product Detail Instellingen

**ShopProductDetail.tsx aanpassen:**

- **`product_image_zoom`**: Implementeer de gekozen zoom modus (hover magnifier, click zoom, of lightbox modal)
- **`product_variant_style`**: Render varianten als dropdown, swatches (kleurcirkels), of buttons op basis van instelling
- **`product_reviews_display`**: `'full'` toont reviews met tekst, `'stars_only'` toont alleen sterren, `'hidden'` verbergt reviews sectie

---

## Samenvatting wijzigingen per bestand

| Bestand | Wijzigingen |
|---------|-------------|
| `src/components/storefront/ShopLayout.tsx` | Mega menu navigatie, conditioneel sticky header, search_display logica, mobile bottom nav, cookie banner integratie, nieuwsbrief popup integratie, recente aankopen integratie |
| `src/components/storefront/CookieBanner.tsx` | **Nieuw**: Cookie consent component met 3 stijlen |
| `src/components/storefront/NewsletterPopup.tsx` | **Nieuw**: Nieuwsbrief popup met delay en incentive |
| `src/components/storefront/RecentPurchaseToast.tsx` | **Nieuw**: "Iemand kocht..." melding |
| `src/components/storefront/ExitIntentPopup.tsx` | **Nieuw**: Popup bij verlaten pagina |
| `src/components/storefront/MobileBottomNav.tsx` | **Nieuw**: Vaste navigatie onderaan op mobiel |
| `src/components/storefront/MegaMenu.tsx` | **Nieuw**: Uitklapbaar categorieenmenu |
| `src/pages/storefront/ShopProductDetail.tsx` | Image zoom, variant stijl, reviews display instelling uitlezen en toepassen |
| `src/components/storefront/ProductCard.tsx` | Stock count indicator wanneer ingeschakeld |


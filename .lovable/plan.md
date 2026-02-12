
# Storefront API Uitbreiden voor Custom Frontends

## Huidige Stand van Zaken

### Wat al bestaat en werkt

| Actie | Status | Beschrijving |
|-------|--------|-------------|
| `resolve_domain` | Werkend | Hostname naar tenant_id, locale, custom frontend URL, hreflang domeinen |
| `get_tenant` | Basis | Naam, logo, kleur, valuta, contact. Locale-aware vertalingen voor store_name/description |
| `get_products` | Basis | Lijst met category filter, zoekterm, limit. Locale-aware vertalingen. Geen sortering, paginering, prijsfilter, tags |
| `get_shipping_methods` | Werkend | Actieve verzendmethoden met prijzen en levertijden |
| `get_service_points` | Werkend | Sendcloud/MyParcel afhaalpunten op basis van postcode |
| `calculate_promotions` | Volledig | Volume, BOGO, bundels, automatische kortingen, cadeaus, stacking rules |
| `validate_discount_code` | Werkend | Kortingscode validatie met limieten en minimumbedrag |
| `storefront-resolve` | Werkend | Standalone endpoint voor domain discovery |

### Wat NIET bestaat

| Functionaliteit | Status |
|-----------------|--------|
| Winkelconfiguratie (features, betaalmethoden, navigatie) | Ontbreekt |
| Categorieen endpoint | Ontbreekt |
| Product detail (enkel product) | Ontbreekt |
| Sortering, paginering, prijsfilter op producten | Ontbreekt |
| Server-side winkelwagen (cart) | Geen `carts` tabel -- ontbreekt volledig |
| Checkout via API | Ontbreekt (bestaande checkout is admin-side) |
| Klantaccounts (registratie, login, profiel) | Ontbreekt |
| Reviews per product | Ontbreekt (alleen `external_reviews` tabel, geen product reviews) |
| Pagina's endpoint | Ontbreekt |
| SEO-metadata endpoint | Ontbreekt |
| Zoekfunctie (autocomplete) | Ontbreekt |
| Promoties/banners endpoint | Ontbreekt |
| Homepage secties | Ontbreekt |
| Nieuwsbrief aanmelding | Bestaat als apart endpoint (`newsletter-subscribe`) |

## Implementatieplan -- Fase 1 (Kern)

De eerste fase bevat alles wat nodig is om een werkende webshop te draaien: configuratie, producten, categorieen, cart, checkout.

### Database: Nieuwe tabellen

**`storefront_carts`** -- Server-side winkelwagen

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | Cart ID |
| tenant_id | uuid FK | Tenant |
| session_id | text | Anonieme sessie-identifier |
| customer_id | uuid FK nullable | Gekoppelde klant (na inloggen) |
| currency | text | Valuta |
| discount_code | text nullable | Toegepaste kortingscode |
| expires_at | timestamptz | Verlooptijd (30 dagen) |
| created_at / updated_at | timestamptz | Timestamps |

**`storefront_cart_items`** -- Items in de cart

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | Item ID |
| cart_id | uuid FK | Cart |
| product_id | uuid FK | Product |
| quantity | integer | Aantal |
| unit_price | numeric | Prijs op moment van toevoegen |
| created_at | timestamptz | Timestamp |

**`storefront_customers`** -- Klantaccounts voor de storefront (apart van admin `customers` tabel)

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | Klant ID |
| tenant_id | uuid FK | Tenant |
| email | text | E-mail |
| password_hash | text | Gehashd wachtwoord |
| first_name | text | Voornaam |
| last_name | text | Achternaam |
| phone | text nullable | Telefoon |
| addresses | jsonb | Opgeslagen adressen |
| is_active | boolean | Account actief |
| last_login_at | timestamptz | Laatste login |
| created_at / updated_at | timestamptz | Timestamps |

Opmerking: We gebruiken GEEN Supabase Auth voor storefront-klanten, omdat klanten per tenant zijn gescheiden. In plaats daarvan worden wachtwoorden gehashd opgeslagen en tokens gegenereerd per sessie. Alternatief: we koppelen aan de bestaande `customers` tabel en voegen een `password_hash` kolom toe. Dit wordt bepaald bij implementatie op basis van de meest praktische aanpak.

### Nieuwe API-acties

#### `get_config` -- Winkelconfiguratie

Retourneert alles wat de frontend nodig heeft om zichzelf te initialiseren:

- Winkelnaam, logo, favicon, kleuren, fonts
- Valuta, land, BTW-percentage
- Actieve talen + domein-mapping (uit `tenant_domains`)
- Canonical domein
- Contact- en bedrijfsgegevens
- Social media links
- Feature flags: reviews actief, nieuwsbrief actief, gastbestelling toegestaan, wishlist, zoekbalk, breadcrumbs
- Betaalinformatie: Stripe actief (op basis van `stripe_charges_enabled`), bankoverschrijving actief
- Announcement bar tekst
- Navigatie-stijl (simple/mega_menu)
- Cookie banner instellingen

#### `get_categories` -- Categorieen

- Alle actieve, zichtbare categorieen met hierarchie (parent_id)
- Naam, slug, beschrijving, afbeelding
- Locale-aware vertalingen uit `content_translations`
- Productaantal per categorie

#### `get_product` -- Enkel product

- Alle productdetails: titel, beschrijving, short_description, afbeeldingen, prijs, vergelijkprijs, SKU, barcode, voorraadstatus, gewicht
- Categorie info
- Tags
- SEO-metadata (meta_title, meta_description)
- Gerelateerde producten (op basis van categorie of tags)
- Locale-aware vertalingen

#### `get_products` uitbreiden

- **Sortering**: `sort_by` parameter (price_asc, price_desc, newest, name_asc, name_desc, featured)
- **Paginering**: `page` + `per_page` parameters, retourneert `total_count` en `total_pages`
- **Filters**: `min_price`, `max_price`, `tags`, `in_stock_only`, `is_featured`

#### `get_pages` -- Statische pagina's

- Lijst van gepubliceerde pagina's (slug, titel, show_in_nav, nav_order)
- Enkele pagina ophalen op slug met content
- Locale-aware vertalingen

#### `get_homepage` -- Homepage secties

- Alle zichtbare homepage secties uit `homepage_sections`
- Gesorteerd op sort_order
- Content en settings per sectie

#### `get_reviews` -- Reviews per product of algemeen

- Reviews uit `external_reviews` tabel
- Filter op zichtbaar + featured
- Gemiddelde score berekening
- Platform badges

#### Cart-acties (mutatief)

| Actie | Beschrijving |
|-------|-------------|
| `cart_create` | Maakt een nieuwe cart aan, retourneert cart_id |
| `cart_get` | Haalt cart op met items en prijsberekening |
| `cart_add_item` | Voegt product toe of verhoogt hoeveelheid |
| `cart_update_item` | Wijzigt hoeveelheid |
| `cart_remove_item` | Verwijdert item |
| `cart_apply_discount` | Past kortingscode toe |
| `cart_remove_discount` | Verwijdert kortingscode |

Cart-acties valideren voorraad en berekenen subtotaal, BTW en kortingen real-time.

#### Checkout-acties (mutatief)

| Actie | Beschrijving |
|-------|-------------|
| `checkout_start` | Maakt een checkout aan vanuit cart_id |
| `checkout_set_addresses` | Stelt verzend- en factuuradres in |
| `checkout_get_shipping_options` | Haalt beschikbare verzendopties op basis van adres |
| `checkout_set_shipping` | Selecteert verzendmethode |
| `checkout_get_payment_methods` | Retourneert beschikbare betaalmethoden |
| `checkout_place_order` | Plaatst de bestelling, maakt order aan, start betaling |
| `checkout_get_confirmation` | Haalt bestelbevestiging op |

De `checkout_place_order` actie:
1. Valideert voorraad van alle items
2. Berekent BTW op basis van verzendland
3. Maakt een `orders` record aan met status `pending`
4. Maakt `order_items` records aan
5. Decrementeert voorraad
6. Start Stripe Checkout sessie (via bestaande `create-checkout-session` logica)
7. Retourneert Stripe checkout URL

#### `search_products` -- Zoekfunctie

- Zoekt op productnaam, beschrijving, SKU, tags
- Relevantie-sortering (exacte match > bevat)
- Optioneel: `autocomplete` mode die alleen namen retourneert

#### SEO-acties

| Actie | Beschrijving |
|-------|-------------|
| `get_seo` | Retourneert SEO-data voor een product, categorie of pagina (meta_title, meta_description, canonical URL, hreflang tags, Open Graph data) |
| `get_sitemap_data` | Retourneert alle publieke URLs voor sitemapgeneratie |

### Nieuwe edge function: `storefront-customer-api`

Aparte edge function voor klant-gerelateerde acties die authenticatie vereisen:

| Actie | Beschrijving |
|-------|-------------|
| `register` | Registreer nieuw klantaccount |
| `login` | Inloggen, retourneert session token |
| `get_profile` | Profiel ophalen |
| `update_profile` | Profiel bewerken |
| `get_orders` | Bestelgeschiedenis |
| `get_order` | Besteldetails |
| `get_addresses` | Opgeslagen adressen |
| `add_address` | Adres toevoegen |
| `update_address` | Adres bewerken |
| `delete_address` | Adres verwijderen |
| `request_password_reset` | Wachtwoord reset aanvragen |
| `reset_password` | Wachtwoord resetten met token |

## Implementatieplan -- Fase 2 (Later)

- Nieuwsbrief aanmelding via API (bestaande `newsletter-subscribe` inbouwen)
- Wishlist/favorieten (nieuwe tabel + acties)
- Product varianten (als er een varianten-systeem komt)
- Real-time voorraad updates via websocket
- Caching laag voor productlijsten
- Rate limiting per tenant

## Bestanden die aangemaakt worden

| Bestand | Beschrijving |
|---------|-------------|
| `supabase/functions/storefront-customer-api/index.ts` | Klantaccount edge function |

## Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/storefront-api/index.ts` | Alle nieuwe acties toevoegen: get_config, get_categories, get_product, get_pages, get_homepage, get_reviews, cart_*, checkout_*, search_products, get_seo |

## Database migratie

Nieuwe tabellen: `storefront_carts`, `storefront_cart_items`, `storefront_customers` met juiste RLS policies.

## Volgorde van implementatie

Vanwege de omvang wordt dit in stappen gebouwd:

1. **Database migratie**: Cart en customer tabellen aanmaken
2. **Read-only acties**: get_config, get_categories, get_product (detail), get_products (uitbreiden), get_pages, get_homepage, get_reviews, search_products, get_seo
3. **Cart-acties**: cart_create, cart_get, cart_add_item, cart_update_item, cart_remove_item, cart_apply_discount
4. **Checkout-acties**: checkout_start t/m checkout_place_order
5. **Klantaccount API**: storefront-customer-api edge function

Per stap wordt de code geimplementeerd, gedeployed en getest.

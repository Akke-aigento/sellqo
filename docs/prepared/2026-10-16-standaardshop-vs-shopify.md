# D — Standaardshop (sellqo-storefront) vs Shopify-standaard: gap-analyse

Recon 16-10-2026, read-only. Niets gewijzigd, niets gepusht.

**Bronnen**
- Storefront-repo: `Akke-aigento/sellqo-storefront` (aparte repo, NIET in de sellqo-repo). Shallow clone in `/home/claude/sellqo-storefront`, HEAD `71ff6b3` (FEST-1/2). ~4.800 regels: TanStack Start op Cloudflare Workers, data alleen via `storefront-api`.
- Theme-editor: `/home/claude/sellqo/src/pages/admin/StorefrontCustomize.tsx` (795 r.) + `src/components/admin/storefront/schema/*`. Het schema staat in `sellqo-storefront/src/theme/schema.json` (gepubliceerd op `/theme/schema.json`).
- Docs: `docs/webshop-masterplan.md`, `docs/webshop-fase5-7-visie.md`, role-audit SHOP-1..7, SHOP-API-1..3, EDITOR-1, THEME-*, SEO-1, PERF-1, SHOP-OPEN-1.
- Live: `net.http_get` via de connector (sellqo-project), responses 260345–260354: vanxcel home + PDP, demo-tech home/PDP/collectie/sitemap/robots/404, demo-kleding PDP, vanxcel robots.

**Live meetresultaten (kort)**
| URL | Status | Bevinding |
|---|---|---|
| vanxcel.sellqo.shop/ | 200 | noindex (pilot), robots `Disallow: /`. **Geen meta description, geen og:image** op de home. Bestellen staat uit ("Online bestellen kan binnenkort"). |
| vanxcel PDP powerstrip | 200 | Titel, description, canonical, og:image en JSON-LD Product (sku, gtin) aanwezig. Beelden komen van `cdn.shopify.com` (o.a. een GIF): **geen srcset/resize**, want `img()` verkleint alleen Supabase-URL's. |
| demo-tech home | 200 | geïndexeerd; geen description/og:image; geen Organization/WebSite-LD |
| demo-tech collectie audio | 200 | canonical ok, geen description |
| demo-kleding PDP | 200 | JSON-LD toont 3 identieke Offers (één per variant), geen AggregateOffer, brand = winkelnaam |
| demo-tech sitemap.xml | 200 | bevat **`/menu` in een tech-winkel**: `qrMode` valt terug op `'view'` (`src/lib/sellqo.server.ts`), dus elke winkel zonder `qr_mode='off'` krijgt /menu in de sitemap |
| demo-tech robots.txt | 200 | goed (checkout/mandje/zoeken/preview dicht, sitemap-regel) |
| demo-tech /bestaatniet | **404** | juiste status; titel enkel "Voltaro", kale pagina zonder zoekveld of links |

---

## 1. Shopify-standaard-checklist (53 items)

✓ aanwezig · ~ deels · ✗ ontbreekt. Paden relatief aan `/home/claude/sellqo-storefront/`.

### Home & navigatie
| # | Item | Score | Bewijs |
|---|---|---|---|
| 1 | Homepage-secties instelbaar | ✓ | `src/components/Sections.tsx:503-519`: 14 types; fallback-opbouw in `src/routes/index.tsx` |
| 2 | Aankondigingsbalk | ✓ | `ShopChrome.tsx` `AnnouncementBar`. Eén bericht, geen roterende berichten |
| 3 | Mega-/dropdownmenu | ~ | `ShopChrome.tsx` `buildNav`: 1 niveau dropdown, geen megamenu met beelden |
| 4 | Mobiel menu (drawer) | ✓ | `ShopChrome.tsx` Header: Esc, scroll-lock. ~ geen focus-trap |
| 5 | Sticky header | ✓ | `theme.header_sticky` |
| 6 | Favicon + theme-color | ✓ | `__root.tsx:43-58`; letter-favicon als terugval (`lib/favicon.ts`), live bevestigd |
| 7 | Laadfeedback bij navigeren | ✓ | `__root.tsx` `NavProgress` (SHOP-7) |
| 8 | Footer met juridisch, contact en social | ✓ | `ShopChrome.tsx` Footer. ~ kolommen niet instelbaar |

### Collectie
| 9 | Sortering | ✓ | `routes/collecties.$slug.tsx` SORTS (4 opties; geen naam A-Z) |
| 10 | Filters (opties, beschikbaar, prijs) | ✓ | `collecties.$slug.tsx` Filters + `get_product_filters` |
| 11 | Filters op /producten en /zoeken | ✗ | `producten.index.tsx` en `zoeken.tsx` hebben alleen sortering of niets |
| 12 | Collectiebanner/omschrijving | ✗ | `cat.image_url` gaat alleen naar og:image; geen beschrijving gerenderd |
| 13 | Paginering | ~ | Werkt, maar toont álle paginanummers (wordt lelijk bij 20+ pagina's) |
| 14 | Productkaart: sale-badge, "vanaf", uitverkocht | ✓ | `ShopChrome.tsx` ProductGrid/SaleBadge |
| 15 | Quick-add / tweede foto bij hover | ✗ | Kaart linkt alleen naar de PDP |

### Productpagina (PDP)
| 16 | Varianten met doorgestreepte uitverkochte waarden | ✓ | `producten.$slug.tsx:184-279` |
| 17 | Kleur-swatches | ✗ | Alle opties zijn tekstknoppen |
| 18 | Variant in de URL (`?variant=`) | ✗ | Keuze staat alleen in state: niet te delen, niet in Shopping-feed |
| 19 | Voorraadindicator / "nog X" | ✓ | `:283-288`, drempel 5, thema-toggle |
| 20 | Galerij met thumbnails | ✓ | `:220-234` |
| 21 | Zoom/lightbox + swipe op gsm | ✗ | Geen lightbox, geen swipe; op gsm alleen het thumbnail-grid |
| 22 | Quantity picker | ✓ | `CartUI.tsx` QuantityStepper, begrensd op voorraad |
| 23 | Sticky add-to-cart op gsm | ✓ | `:335-346` |
| 24 | Trust: levering/retour/betaalmethodes | ~ | `:305-315`: tekstlabels, geen betaallogo's |
| 25 | Gerelateerde producten | ✓ | `:327-332` (`related_products`) |
| 26 | Productreviews + sterren | ✗ | `get_reviews` negeert `product_id` (storefront-api `index.ts:1442`): alleen winkelreviews mogelijk |
| 27 | "Mail me bij voorraad" | ✗ | Geen API-actie |
| 28 | Recent bekeken | ✗ | Niets in localStorage |
| 29 | Specificaties/accordeon, SKU zichtbaar | ~ | Beschrijving als één HTML-blok, SKU alleen in JSON-LD |

### Mandje & checkout
| 30 | Mini-cart (hover) + lade na toevoegen | ✓ | `CartUI.tsx` CartButton/CartDrawer (SHOP-5) |
| 31 | Mandjepagina met aantallen/verwijderen | ✓ | `routes/winkelmandje.tsx` |
| 32 | Kortingscode | ~ | Op de mandjepagina ✓; niet in de lade en niet in de checkout |
| 33 | Gratis-verzending-drempel | ~ | Tekst "Nog €X tot gratis verzending" (`CartUI.tsx` Totals); geen voortgangsbalk |
| 34 | Upsell in mandje/lade | ✗ | — |
| 35 | Checkout: gastbestelling, verzendmethode, betalen | ✓ | `routes/afrekenen.tsx`: details → verzending → Stripe/overschrijving/QR, afhaalslots |
| 36 | Checkout: B2B (bedrijf + btw-nr, VIES, verlegging) | ✗ | Geen company/vat-veld; API heeft `checkout_validate_vat` |
| 37 | Checkout: link naar voorwaarden/privacy bij de bestelknop | ✗ | grep op terms/voorwaarden in `afrekenen.tsx`: niets. De knoptekst "Bestellen en betalen" is wel goed |
| 38 | Afhaalpunten (bpost/PostNL) | ✗ | API `get_service_points` bestaat, de storefront gebruikt het niet |
| 39 | Bedankpagina / bestelstatus | ~ | `bestelling.tsx` + done-stap; geen bestelling opzoeken achteraf |

### Zoeken & account
| 40 | Zoeken met suggesties (predictive) | ~ | `/zoeken` werkt (`get_products` met search); **geen suggesties**, terwijl de API `search_products` met `autocomplete:true` heeft (`index.ts:1471-1500`) |
| 41 | Klantaccount (login, bestellingen, adressen) + verlanglijst | ✗ | `storefront-customer-api` heeft register/login/orders/addresses/wishlist_*; de storefront gebruikt het niet |

### SEO, performance, a11y, juridisch, overig
| 42 | SEO per pagina (title, description, canonical, OG) | ~ | `lib/seo.ts` ✓ op PDP; **home/collectie zonder description en og:image** (live) |
| 43 | JSON-LD Product / Breadcrumb / Organization / WebSite | ~ | Product ✓ (`producten.$slug.tsx:66-80`); Breadcrumb ✗ (alleen visueel); Organization/WebSite+SearchAction ✗; varianten als losse Offers, geen AggregateOffer; brand = winkelnaam |
| 44 | sitemap.xml + robots.txt | ✓/~ | `routes/sitemap[.]xml.ts`, `lib/seoFiles.ts` ✓; bug: `/menu` in elke niet-horecawinkel; geen lastmod |
| 45 | Beeldformaten + lazy | ~ | Supabase render + srcset + lazy ✓ (PERF-1); externe beelden (VanXcel = cdn.shopify.com) ongeschaald; hero zonder `fetchpriority="high"` (`Sections.tsx` Hero) |
| 46 | Toegankelijkheid | ~ | Skip-link, aria-labels, role=dialog ✓; geen focus-trap in lade/menu |
| 47 | Cookiebanner (consent vóór pixels) | ~ | `components/Tracking.tsx` ✓; **keuze niet te herroepen** (geen "Cookie-instellingen"-link); geen Google Consent Mode v2 |
| 48 | Juridische pagina's (voorwaarden, privacy, retour) | ✓ | `/info/$slug` via `get_pages` |
| 49 | 404-pagina | ~ | Juiste 404-status; kale pagina, titel zonder "Niet gevonden" |
| 50 | Nieuwsbrief | ~ | Sectie ✓, maar verborgen als bestellen uit staat (`Sections.tsx:511`); niet in de footer |
| 51 | Meertaligheid | ✗ | `<html lang="nl">` vast (`__root.tsx:195`); alle UI-tekst hardcoded NL; API ondersteunt `locale` + translations |
| 52 | Valutaformat | ~ | `formatPrice` nl-BE ✓; PDP/mandje/grid geven `currency` vaak niet door, dus altijd EUR |
| 53 | Contactformulier | ✗ | API `submit_contact_form` bestaat; alleen een contactgegevens-sectie |

**Score:** ruwweg 40% ✓, 30% ~, 30% ✗. De basis (mandje, PDP-kern, filters, SEO-bestanden) staat; wat ontbreekt zit in conversie, account/i18n en SEO-afwerking.

---

## 2. Theme-editor ("Aanpassen") vs Shopify theme editor

**Wat SellQo nu kan** (`StorefrontCustomize.tsx`, `theme/schema.json`):
- Live iframe-preview met desktop/gsm, klik-om-te-selecteren, slepen, tonen/verbergen, "ongedaan maken" (alles terugdraaien). Opslaan = meteen live.
- 14 homepage-secties: hero, featured_products, collection, categories_grid, text_image, testimonials, newsletter, video, announcement, usp_bar, faq, contact_hours, menu_card, event_agenda. Per sectie: achtergrond (4) en ruimte; productsecties ook kolommen en fotovorm.
- Globaal: 12 presets, merkkleur, achtergrond- en tekstkleur (afgeleide tinten), lettertypes, logo en favicon, knopvorm, afronding, header-layout, logogrootte, zoekknop, sticky header, opmaak (hero-stijl, titelstijl, kaartstijl, breedte, hoofdletters), voorraadindicator.
- Aankondigingsbalk, genest menu (MenuEditor), footer-tekst, productpagina (gerelateerd, levering/retour, betaalmethodes, sticky knop) en tracking (GA4, Meta, TikTok).

**Wat Shopify biedt en hier ontbreekt:**
| Gap | Omvang |
|---|---|
| Secties/blokken op **andere templates** (PDP, collectie, mandje, 404). Hier alleen de home plus vaste PDP-toggles | L |
| Sectietypes: slideshow, logolijst, multicolumn, collage/beeldgalerij, rich text, contactformulier, collapsible content, blogberichten, **reviews** (`external_reviews` staat er als "later", `Sections.tsx:519`) | M per stuk |
| Footer als blokken (eigen kolommen/menu's, nieuwsbrief in de footer) | M |
| Kleurschema's per sectie (nu 4 vaste achtergronden) en typografieschaal | M |
| Mandjetype (lade/pagina/melding), kaart-hover (2e foto), badge-positie | S |
| Concept vs live / themaversies / dupliceren; stap-voor-stap undo/redo | L (datamodel → beslissing) |
| SEO voor home (title/description/deelbeeld) in de editor | S (kan via bestaande `get_seo`/SEO-instellingen) |
| Custom CSS/Liquid-blok | beslissing (security: gedeeld domein) |

**Skill-onderhoudsflag (i18n):** `StorefrontCustomize.tsx:548` (`'Automatisch'`, `` `${n} items` ``) en `:721` ("Juridische pagina's, contactgegevens en sociale media komen automatisch…") zijn hardcoded NL in de core-admin. Dat schendt `sellqo-i18n-verplicht`.

---

## 3. Geprioriteerde gap-lijst (top 15)

"Veilig" betekent: alleen de renderer in `sellqo-storefront`, alleen bestaande API-acties, geen wijziging aan het storefront-api-contract en geen effect op custom frontends. De hele repo staat los van custom frontends, dus elk storefront-item raakt die per definitie niet.

| # | Gap | Omvang | Veilig? | Bestanden |
|---|---|---|---|---|
| 1 | **Checkout juridisch:** links naar voorwaarden, privacy en herroeping bij de bestelknop (verplicht in BE/EU) | S | ✅ veilig (Akke even de tekst laten lezen) | `src/routes/afrekenen.tsx` (rond de knop ±r.354), `bundle.legal_pages` |
| 2 | **SEO-fundament:** home/collectie description + og:image (logo/hero), Organization + WebSite/SearchAction-LD, BreadcrumbList-LD op PDP/collectie, AggregateOffer i.p.v. N identieke Offers, `/menu` alleen in de sitemap bij horeca | S | ✅ | `src/lib/seo.ts`, `src/routes/index.tsx`, `src/routes/collecties.$slug.tsx`, `src/routes/producten.$slug.tsx:66-80`, `src/lib/seoFiles.ts`, `src/routes/sitemap[.]xml.ts` (+ evt. bestaande `get_seo`) |
| 3 | **Zoeksuggesties** (predictive dropdown: producten met foto/prijs) | M | ✅ bestaande `search_products` + `autocomplete:true` | `src/components/ShopChrome.tsx` (SearchForm), `src/lib/shop.ts` (nieuwe serverfn) |
| 4 | **Galerij:** lightbox/zoom, swipe op gsm, pijltjes, toetsenbord | M | ✅ | `src/routes/producten.$slug.tsx:220-234` (evt. nieuw `src/components/Gallery.tsx`) |
| 5 | **Mandje-conversie:** voortgangsbalk gratis verzending, kortingscode ook in de lade, kleine upsell (related) | S | ✅ (`cart_apply_discount` bestaat al) | `src/components/CartUI.tsx` (Totals/CartDrawer), `src/lib/cart.ts` |
| 6 | **Recent bekeken** (localStorage, PDP + 404) | S | ✅ | `src/routes/producten.$slug.tsx`, nieuw `src/lib/recent.ts` |
| 7 | **Variant-URL + swatches + SKU:** `?variant=<id>` (deelbaar, Shopping), kleurbolletjes als de waarde een kleur is, SKU zichtbaar | S/M | ✅ | `src/routes/producten.$slug.tsx` (validateSearch, opties ±r.257-279) |
| 8 | **Performance:** `fetchpriority="high"` op hero/PDP-hoofdbeeld; Shopify-CDN-beelden schalen (`?width=`) zoals Supabase | S | ✅ | `src/lib/img.ts`, `src/components/Sections.tsx` (Hero), `producten.$slug.tsx:223` |
| 9 | **Cookie-instellingen heropenen** (footer-link) + Google Consent Mode v2 | S | ✅ | `src/components/Tracking.tsx`, `src/components/ShopChrome.tsx` (Footer) |
| 10 | **404 en lege staten:** "Niet gevonden \| winkel", zoekveld, bestsellers/recent bekeken | S | ✅ | `src/routes/__root.tsx` NotFound (r.101-108) |
| 11 | **Winkelreviews-sectie** (`external_reviews` via `get_reviews`) + editor-entry | M | ✅ renderer; editor-entry in de sellqo-repo is additief (ADDABLE/schema) | `src/components/Sections.tsx:519`, `src/theme/schema.json`; admin `StorefrontCustomize.tsx` ADDABLE |
| 12 | **B2B-checkout:** bedrijfsnaam + btw-nr, VIES-check, verlegging | M | ⚠️ beslissing: contract ok (`checkout_validate_vat` bestaat), maar raakt totalen/btw; testbestelling = echte order | `src/routes/afrekenen.tsx`, `src/lib/cart.ts` (`saveCheckoutDetails`); patroon: skill `sellqo-custom-frontend-runbook` |
| 13 | **Klantaccounts + verlanglijst** (login, bestelhistoriek, adressen, wachtwoordreset) | L | ⚠️ beslissing: sessie/cookies op gedeeld `*.sellqo.shop`, reset/verify-maillinks naar welke host, GDPR | nieuwe routes `src/routes/account.*`, serverfns naar `storefront-customer-api` |
| 14 | **Meertaligheid** (NL/FR/EN/DE: UI-strings, `html lang`, hreflang, `locale` naar de API, valuta/locale doorgeven) | L | ⚠️ beslissing: URL-schema (`/fr/…` vs domein per taal), welke talen per winkel, vertaalbron | heel `src/`; `__root.tsx:195`, `lib/format.ts`, `lib/seo.ts` |
| 15 | **Productreviews + AggregateRating** en **"mail bij voorraad"** | M/L | ⚠️ beslissing: storefront-api-wijziging nodig (`get_reviews` negeert `product_id`; geen back-in-stock-actie) | sellqo `supabase/functions/storefront-api/index.ts:1442` + storefront PDP |

Net buiten de top 15 (allemaal veilig, S/M): filters/sortering op `/producten` en `/zoeken`, collectiebanner en -omschrijving (vraagt `description` in de bundle, dus mogelijk een API-uitbreiding), compacte paginering, focus-trap in lade en menu, nieuwsbrief in de footer, contactformulier-sectie (`submit_contact_form`: stuurt echte mail, dus testen op een demo), afhaalpunten in de checkout (`get_service_points`: geldpad → beslissing).

### "Veilig te bouwen"-selectie (één of twee batches, alleen `sellqo-storefront`)
**Batch SHOP-8 (S-items, ±1 sessie):** #1, #2, #5, #6, #8, #9, #10
- `src/routes/afrekenen.tsx`, `src/lib/seo.ts`, `src/lib/seoFiles.ts`, `src/routes/sitemap[.]xml.ts`, `src/routes/index.tsx`, `src/routes/collecties.$slug.tsx`, `src/routes/producten.$slug.tsx`, `src/components/CartUI.tsx`, `src/lib/img.ts`, `src/components/Sections.tsx`, `src/components/Tracking.tsx`, `src/components/ShopChrome.tsx`, `src/routes/__root.tsx`, nieuw `src/lib/recent.ts`.

**Batch SHOP-9 (M-items):** #3, #4, #7, #11
- `src/components/ShopChrome.tsx`, `src/lib/shop.ts`, `src/routes/producten.$slug.tsx`, nieuw `src/components/Gallery.tsx`, `src/components/Sections.tsx`, `src/theme/schema.json`. De editor-entry voor reviews (additief) staat in `/home/claude/sellqo/src/pages/admin/StorefrontCustomize.tsx`.

**Beslissing van Akke nodig:** #12 B2B-checkout, #13 accounts/verlanglijst, #14 meertaligheid, #15 productreviews/back-in-stock, plus de editor-architectuur (secties op PDP/collectie, concept-vs-live, custom CSS).

### Aandachtspunten bij bouwen
- De repo heeft **geen tests** (geen vitest in `package.json`). Verifiëren kan via `npm run typecheck` + build + Playwright tegen de nep-API (zoals in SHOP-5), en daarna live via `net.http_get` (de sandbox bereikt `*.sellqo.shop` niet direct: proxy 403).
- Na een push: GitHub Actions moet groen staan (deploy naar Cloudflare). Lovable komt er niet aan te pas.
- VanXcel staat op noindex en bestellen uit; voor mandje/checkout-tests is `/preview/<PREVIEW_KEY>` nodig, en **elke testbestelling is een echte order**.

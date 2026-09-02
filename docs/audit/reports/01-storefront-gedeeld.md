# Audit batch 1 — Storefront: gedeelde bevindingen

**Pinned SHA:** `03781985` · **Datum:** 2026-09-02 · **Assen:** A–G · **Laag 1** (statisch)
**Geldt voor:** alle 10 `/shop/:tenantSlug/*`-pagina's. Per-pagina-rapporten verwijzen hiernaar met ID.

**Gedeelde bestanden:** `src/hooks/usePublicStorefront.ts` (586 r.), `src/components/storefront/ShopLayout.tsx` (848 r.), `src/context/CartContext`, `src/context/WishlistContext`.

## Verdict-samenvatting
🔴 3 · 🟡 3 · 🟢 3

---

## 🔴 S-1 — De taalkiezer van de winkel doet niets (as A + F)

- **Wat:** de storefront toont een taalkiezer aan klanten. Wisselen van taal verandert **geen enkel woord** op de pagina.
- **Waar:**
  - `src/components/storefront/ShopLayout.tsx:121-124` — de volledige handler:
    ```ts
    const handleLanguageChange = (lang: string) => {
      setStorefrontLanguage(lang);
      localStorage.setItem('storefront_language', lang);
    };
    ```
  - Gerenderd in alle drie de header-varianten: `:607-612` (Standard), `:745-748` (Centered), `:822-825` (Minimal).
- **Root cause:** `storefront_language` wordt geschreven op regel 123 en in de héle `src/`-boom maar op één plek gelezen: regel 70, om de kiezer z'n eigen actieve vlag te herstellen. Er is geen `i18n.changeLanguage()`, geen query die de taal meekrijgt, geen hervertaling. De 21 `t()`-aanroepen in `ShopLayout` lopen via `useTranslation()` en volgen dus `i18n.language` — de **app**-taal, die deze kiezer niet aanraakt.
- **Bevestigend bewijs:** `useLocalizedProduct` (`usePublicStorefront.ts:531-560`), de hook die productvertalingen uit `content_translations` leest, wordt **nergens** aangeroepen. De tenant-admin kán die vertalingen wel opslaan (`src/components/admin/products/ProductTranslationTabs.tsx:39,71`). Vertalingen worden dus ingevoerd, opgeslagen — en nooit getoond.
- **Waarom dit zwaar weegt:** CLAUDE.md §2 — *"Een knop, sleepgreep of menu-item dat niets doet is erger dan de afwezigheid ervan."* De kiezer verschijnt alleen bij `multilingualEnabled && storefrontLanguages.length > 1` (`:607`), dus precies bij tenants die bewust meertaligheid hebben aangezet en ervoor betalen.
- **Fixrichting:** `storefrontLanguage` de bron maken voor zowel `i18n` als de datalaag, en `useLocalizedProduct` aansluiten. **Platform:** CC. **Frozen-path-risico:** nee — de custom frontends renderen zelf en raken `ShopLayout` niet.

## 🔴 S-2 — Checkout stuurt de verkeerde taal naar `storefront-api`

- **Wat:** de locale die aan de server-cart en de klant wordt vastgeklonken komt uit `i18n.language`, niet uit de taal die de klant in de winkel koos.
- **Waar:** `src/pages/storefront/ShopCheckout.tsx:270` (`cart_create`) en `:320` (`checkout_customer`), beide `(i18n.language || 'nl').slice(0, 2).toLowerCase()`.
- **Root cause:** twee losgekoppelde taalsystemen — `storefrontLanguage` (S-1) en `i18n.language` (browserdetectie / app-switcher). De checkout kent alleen de tweede.
- **Gevolg:** deze locale landt op de order en bepaalt in welke taal de orderbevestiging vertrekt. Een Franstalige klant die de winkel op Frans zet, kan een Nederlandse bevestigingsmail krijgen. Dit koppelt direct aan 🔴 V-3 uit run 0.
- **Fixrichting:** dezelfde bron gebruiken als S-1. **Platform:** CC. **Frozen-path-risico:** **ja, let op** — dit raakt de aanroep naar `storefront-api`. Alleen de meegestuurde *waarde* wijzigt, niet het contract; het `locale`-veld bestaat al. Additief, maar hoort in dezelfde batch als S-1 en met een expliciete contract-check.

## 🔴 S-3 — De storefront-pagina's zijn feitelijk eentalig Nederlands

- **Wat:** over 2805 regels klantgerichte paginacode staan **3** `t()`-aanroepen (alle drie in `ShopCheckout`) tegenover 14 hardcoded Nederlandse `toast`-teksten en tientallen hardcoded NL-labels.

| Bestand | `t()` | NL-toasts | Voorbeeld |
|---|---|---|---|
| `ShopCart.tsx` | 0 | 2 | `toast.success('Product verwijderd uit winkelwagen')` :53 |
| `ShopCheckout.tsx` | 3 | 11 | `toast.error('Vul alle verplichte velden in')` :244 |
| `ShopProductDetail.tsx` | 0 | 1 | `toast.error('Selecteer alstublieft alle opties')` :147 |
| `ShopHome/Products/Page/Legal/Wishlist/QR/OrderConfirmation` | 0 | 0 | labels hardcoded NL, bv. `ShopHome.tsx:42` "Welkom bij", `ShopWishlist.tsx:35` "Verlanglijst" |

- **Root cause:** `ShopLayout` (de chrome) is wél vertaald — 21 `t()`-aanroepen, 66 `storefront.*`-keys in `nl.json`, volledige 5-talige pariteit. De pagina's eronder zijn dat nooit geworden. De infrastructuur is er dus volledig; alleen de pagina's zijn niet aangesloten.
- **Fixrichting:** paginateksten door `t()` halen met nieuwe `storefront.*`-keys; i18n-pariteit bewaakt de rest. **Platform:** CC. **Frozen-path-risico:** nee.

---

## 🟡 Natrek voor laag 3

### 🟡 S-4 — Is de embed `products → categories` ondubbelzinnig?
`usePublicStorefront.ts:311` en `:375` embedden `categories(id, name, slug)` op `products`. Er bestaan twee paden naar `categories`: de directe kolom `products.category_id` én de koppeltabel `product_categories` (de code gebruikt beide, `:319-333`). Dat is precies de opstelling waarin PostgREST een embed als ambigu kan afwijzen (runbook §8, patroon 1) — de query faalt dan stil en de hele productlijst komt leeg terug.
```sql
SELECT c.conname, c.contype,
       src.relname AS from_table, tgt.relname AS to_table,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class src ON src.oid = c.conrelid
JOIN pg_class tgt ON tgt.oid = c.confrelid
WHERE c.contype = 'f'
  AND (   (src.relname = 'products'           AND tgt.relname = 'categories')
       OR (src.relname = 'product_categories' AND tgt.relname IN ('categories','products')))
ORDER BY src.relname, c.conname;
```
**Verwacht bij "veilig":** precies één FK `products → categories`. Meer dan één ⇒ 🔴, fix met expliciete hint `categories!<fk_naam>(...)`.

### 🟡 S-5 — Wie mag `tenant_theme_settings.custom_head_scripts` schrijven?
`ShopLayout.tsx:132-160` leest `themeSettings.custom_head_scripts`, parseert het als HTML en **herbouwt elk `<script>` zodat de browser het uitvoert** (`:145-149`). Dat is een bedoelde feature (analytics-snippets), maar het betekent dat schrijfrecht op die kolom gelijkstaat aan code-uitvoering op elke bezoeker van de winkel. Alleen tenant_admin hoort dit te kunnen.
```sql
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy WHERE polrelid = 'public.tenant_theme_settings'::regclass;

SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.tenant_theme_settings'::regclass;

SELECT role, resource, can_read, can_write
FROM public.role_permissions WHERE resource IN ('storefront','settings','themes');
```
**Let op — gedeeld pad:** `tenant_theme_settings` gaat via `select('*')` in `storefront-api` naar alle vijf de custom frontends (CLAUDE.md §2). Aan deze tabel wordt in deze audit niets gewijzigd; dit is louter een rechtenvraag.

### 🟡 S-6 — Echte tenant-slug voor een storefront-herscan
Run 0 draaide op de gegokte slug `sellqo-speeltuin` met een gestubde lege REST-laag; alle 10 routes gaven 0 tekens. Voor een zinnige visuele controle is de echte slug nodig.
```sql
SELECT id, slug, name, is_demo, use_custom_frontend
FROM public.tenants
WHERE is_demo = true OR id::text LIKE 'bc18b2e3%';
```

---

## 🟢 Geverifieerd correct

1. **`ShopLayout` vangt een onbekende winkel netjes af.** `:265-275` toont "Shop niet gevonden" met een terugkeerknop, en doet dat mét `t()`. De 0-tekens-observatie uit run 0 kwam doordat mijn gestubde `[]` truthy is; met een echte `.maybeSingle()` levert 0 rijen `null` en slaat de guard aan.
2. **Winkel-offline-status is bewust "fail open".** `:281` schermt alleen af bij de expliciete waarde `'offline'`; een lege of onbekende status geeft een gewoon zichtbare winkel. Het commentaar op `:277-280` benoemt die keuze én dat custom frontends hier niet langslopen. Correct en gedocumenteerd.
3. **Geen `.maybeSingle()` op een meerrijige set.** Alle vier de publieke `.maybeSingle()`-aanroepen (`:61` theme, `:119` tenant, `:381` product, `:458` page) staan op een `eq`-filter over een unieke sleutel. `.single()` komt alleen voor op `:496` (domein-lookup) en zit achter een eigen bestaanscheck.

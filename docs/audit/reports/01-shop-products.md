# Audit: /shop/:tenantSlug/products — Productoverzicht
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopProducts.tsx (315 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 2 · 🟢 3

## Bevindingen

### 🔴 C1 — Het productoverzicht haalt de hele catalogus op, zonder limiet of paginering
- **Wat:** `/products` laadt **elk** actief product van de tenant in één query en rendert ze allemaal. Er is geen `limit`, geen paginering, geen infinite scroll.
- **Waar:** `src/pages/storefront/ShopProducts.tsx:39-42` roept `usePublicProducts` aan met alleen `categoryId` en `search` — **zonder `limit`**. In `src/hooks/usePublicStorefront.ts:338-340` staat de limiet achter een voorwaarde:
  ```ts
  if (options?.limit) { query = query.limit(options.limit); }
  ```
  Geen `limit` meegegeven ⇒ geen `.limit()` op de query.
- **Root cause:** de limiet is optioneel gemaakt voor hergebruik in homepage-secties (die wél een limiet meegeven); de overzichtspagina, de enige plek waar het écht om volume gaat, geeft er geen.
- **Gevolg:** dit is runbook §8 patroon 6 (onbounded ophaal). Bij een paar honderd producten merkt niemand het; bij enkele duizenden wordt de klantgerichte overzichtspagina traag tot onbruikbaar, op mobiel het eerst. `select` haalt bovendien `description` en de volledige `images`-array mee, dus het gaat om forse rijen.
- **Fixrichting:** paginering of een `limit` + "meer laden" op deze pagina. **Platform:** CC. **Frozen-path-risico:** nee.
- **Ernst-natrek:** zie 🟡 C2.

### 🟡 C2 — Hoe groot zijn de catalogi echt? (bepaalt de urgentie van C1)
```sql
SELECT t.slug, count(*) AS actieve_producten
FROM public.products p JOIN public.tenants t ON t.id = p.tenant_id
WHERE p.is_active = true AND p.hide_from_storefront = false
GROUP BY t.slug ORDER BY actieve_producten DESC LIMIT 15;
```
**Duiding:** onder ~200 blijft C1 een 🟡-schuld; boven ~1000 is het een acute prestatiebug.

### 🟡 C3 — Categoriefilter doet twee queries en kan een enorme `IN`-lijst bouwen
`usePublicStorefront.ts:319-333`: bij een `categoryId` wordt eerst `product_categories` bevraagd, waarna álle gevonden `product_id`'s als `.in('id', linkedIds)` in de tweede query gaan. Bij een categorie met duizenden producten wordt dat een zeer lange URL — PostgREST/PostgREST-proxies kappen requests af boven de URL-lengtelimiet, waarna de lijst stil leeg terugkomt.
```sql
SELECT c.name, count(*) AS gekoppelde_producten
FROM public.product_categories pc JOIN public.categories c ON c.id = pc.category_id
GROUP BY c.name ORDER BY gekoppelde_producten DESC LIMIT 10;
```
**Duiding:** een categorie boven ~1000 producten maakt dit reëel. Fixrichting dan: filteren via een join/`inner`-embed in plaats van een `IN`-lijst.

## 🟢 Geverifieerd correct
1. **Filters staan in de URL.** `:29-31` en `:44-53` lezen en schrijven `?category=` en `?q=` via `useSearchParams` — deelbaar, en de terugknop werkt.
2. **Zoeken gebeurt server-side.** `usePublicStorefront.ts:335-337` gebruikt `ilike` op `name`; er wordt niet eerst alles opgehaald om daarna client-side te filteren.
3. **Lege en ladende staat zijn onderscheiden.** `:217` toont zes skeleton-kaarten tijdens het laden, `:229` een "Filters wissen"-knop bij 0 resultaten — geen stille lege pagina.

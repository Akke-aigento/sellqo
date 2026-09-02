# Audit: /shop/:tenantSlug/page/:pageSlug — CMS-pagina
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopPage.tsx (81 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 0 · 🟡 2 · 🟢 4

## Bevindingen

### 🟡 D1 — Wie mag `storefront_pages.content` schrijven? (XSS-oppervlak)
`src/pages/storefront/ShopPage.tsx:70` zet de pagina-inhoud ongesanitiseerd op het scherm:
```tsx
dangerouslySetInnerHTML={{ __html: page.content }}
```
De inhoud komt uit de tenant-CMS. Dat is een bedoelde feature (rich content), maar wie deze kolom kan schrijven, voert script uit bij elke bezoeker van die winkel. Zelfde klasse als 🟡 D-3 in run 0 en D1 in `01-shop-legal.md`; samen te beoordelen.
```sql
SELECT polname, polcmd,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy WHERE polrelid = 'public.storefront_pages'::regclass;

SELECT relrowsecurity FROM pg_class WHERE oid = 'public.storefront_pages'::regclass;
```
**Let op — gedeelde tabel:** `storefront_pages` is een van de tabellen die de vijf custom frontends delen (CLAUDE.md §1). Hier wordt niets aan gewijzigd; dit is uitsluitend een rechtenvraag.

### 🟡 E1 — Eén taal per slug, geen vertaalde CMS-pagina's
`storefront_pages` heeft één `title`/`content`-paar, zonder taalvarianten — anders dan `legal_pages`, dat wél `_nl/_en/_de/_fr` kent. Een meertalige winkel kan een CMS-pagina dus alleen vertalen door aparte slugs aan te maken, en de navigatie (`usePublicStorefront.ts:214-215`) toont ze dan allemaal naast elkaar. Bevestiging van het kolommenbeeld:
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='storefront_pages' ORDER BY ordinal_position;
```
**Duiding:** ontbreken taalkolommen, dan is dit een ontwerpkeuze en geen bug — maar wel een die S-1 blokkeert voor CMS-pagina's. Beslissing bij Akke.

## 🟢 Geverifieerd correct
1. **Alleen gepubliceerde pagina's zijn publiek.** `usePublicStorefront.ts:456` filtert `.eq('is_published', true)` naast `tenant_id` en `slug` — concepten lekken niet.
2. **Drie duidelijk gescheiden staten.** Laadskelet (`:13-25`), niet-gevonden met terugkeerknop (`:27-38`) en inhoud — geen stille lege pagina, geen verborgen laadfout.
3. **Meta-titel en -beschrijving worden meegegeven** (`:42-45`), met terugval van `meta_title` op `title`.
4. **Broodkruimels respecteren de themakeuze** (`:49` — `show_breadcrumbs !== false`), dus een tenant die ze uitzet krijgt ze ook echt niet.

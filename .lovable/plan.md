# Plan: Producten dupliceren

Voeg een "Dupliceer" actie toe aan elk product in de admin, die een volledige kopie maakt incl. alle gerelateerde data — als concept (inactief) zodat de gebruiker rustig kan aanpassen voor publicatie.

## Scope: wat wordt gekopieerd

Uit `products` (alle kolommen) + gerelateerde tabellen:
- `product_variants` + `product_variant_options` (varianten incl. eigen prijs, stock, SKU, barcode, gewicht, afbeelding)
- `product_categories` (junction — alle gekoppelde categorieën)
- `product_specifications` + `product_custom_specs`
- `product_files` (digitale bestanden — referentie naar zelfde storage objects, geen file-kopie)
- `content_translations` (alle taalvarianten van naam/beschrijving/SEO)
- `images[]` / `featured_image` (URLs hergebruiken — geen storage duplicatie nodig)
- `tags`, `social_channels`, `meta_*`, `shopify_optimized_*`, BTW, kostprijs, gewicht, etc.

## Wat NIET wordt gekopieerd (bewust)

- `id`, `created_at`, `updated_at`
- `sku` / `barcode` op parent en varianten → leeg of suffix `-copy` (uniciteit + voorkomt marketplace conflicts)
- Marketplace-koppelingen: `shopify_product_id`, `shopify_variant_id`, `shopify_listing_status`, `shopify_last_synced_at`, `bol_*`, idem voor andere kanalen → `null` (anders sync-collisions)
- `is_active` → `false` (start als concept)
- `slug` → gegenereerd op basis van naam + suffix om unique-constraint te respecteren
- Statistieken/aggregaten (views, sales count e.d.) → 0/null
- Orders, reviews, sync-logs (geen historische data)

## Naamgeving

Default: `"<originele naam> (kopie)"`. Slug krijgt random suffix om uniek te zijn binnen tenant.

## Technische uitvoering

1. **Edge Function `duplicate-product`** (JWT-auth via `authenticateRequest`, tenant-scoped):
   - Input: `{ product_id }`
   - Verifieert dat product tot caller's tenant behoort
   - Leest origineel + alle relaties in één batch
   - Maakt nieuwe rij in `products` met geschoonde velden
   - Kopieert relaties met nieuwe `product_id` (en bij varianten: nieuwe variant-id mapping voor `product_variant_options`)
   - Wrappen in try/catch; bij mislukken: rollback via DELETE op nieuwe product_id (geen DB transactie mogelijk in PostgREST, dus compensatie)
   - Output: `{ id: nieuwProductId }`

2. **Hook `useDuplicateProduct`** in `src/hooks/useProducts.ts`:
   - `useMutation` die de edge function aanroept
   - Bij succes: invalidate `products` query + toast + return id

3. **UI in `src/pages/admin/Products.tsx`**:
   - Nieuwe `DropdownMenuItem` "Dupliceren" met `Copy` icoon in beide dropdowns (grid- en list-view, rond regels 616 en 781)
   - Tussen "Bewerken" en delete
   - Loading state per rij; bij succes navigeer naar `/admin/products/<nieuwId>` zodat de gebruiker direct kan finetunen

4. **Permissies**: gebruik bestaande `useCan('products', 'create')` om het menu-item te tonen — dupliceren = aanmaken.

## Edge cases

- Product zonder varianten: skip varianten-stap zonder error
- Product met digitale levering (`product_files`): kopieer alleen rij-referenties; bestanden in storage blijven gedeeld (zelfde URL)
- Tenant-isolatie: alle inserts expliciet met `tenant_id` van de caller
- Unieke constraints (slug, SKU): retry slug met extra suffix; SKU's leegmaken zodat user ze invult
- Multi-language translations: `content_translations` rijen krijgen nieuwe `entity_id`

## Bestanden

- nieuw: `supabase/functions/duplicate-product/index.ts`
- update: `supabase/config.toml` (functie registreren met JWT verify)
- update: `src/hooks/useProducts.ts` (hook + export)
- update: `src/pages/admin/Products.tsx` (menu items + handler)

Geen DB-migraties nodig.

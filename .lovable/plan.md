

# Variant als Zelfstandig Product met Cross-linking

## Concept

Varianten kunnen optioneel als eigen product in de catalogus verschijnen (eigen slug, categorie, SEO), maar blijven onderling gekoppeld via het parent product. Op de productdetailpagina kan de klant wisselen tussen varianten, waarbij navigatie naar de andere productpagina plaatsvindt.

---

## Database Aanpassingen

Nieuwe kolom op `product_variants`:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| linked_product_id | UUID (nullable) | FK naar `products.id` -- het zelfstandige product dat deze variant vertegenwoordigt |

Dit maakt een bidirectionele koppeling:
- Vanuit een product: "Welke variant ben ik?" (via `product_variants.linked_product_id = products.id`)
- Vanuit een variant: "Welk zelfstandig product hoort hierbij?" (via `linked_product_id`)

Nieuwe kolom op `products`:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| parent_product_id | UUID (nullable) | FK naar `products.id` -- het "moederproduct" waar dit product een variant van is |

---

## Hoe het werkt

```text
Parent Product: "T-shirt" (product_id = A)
  - Variant "Rood / M" -> linked_product_id = product B
  - Variant "Blauw / M" -> linked_product_id = product C

Product B: "T-shirt Rood" (parent_product_id = A, categorie: "Sale")
Product C: "T-shirt Blauw" (parent_product_id = A, categorie: "Zomer")
```

Scenario klant bezoekt "T-shirt Rood" (product B):
1. Systeem ziet `parent_product_id = A`
2. Haalt alle varianten op van product A
3. Toont variant selector (Kleur: Rood selected, Blauw beschikbaar)
4. Klant kiest "Blauw" -> navigeert naar product C ("/shop/t-shirt-blauw")

---

## API Aanpassingen

### get_product (storefront-api)
- Als product een `parent_product_id` heeft:
  - Haal opties en varianten op van het parent product
  - Markeer de huidige variant als "selected"
  - Voeg `linked_product_slug` toe aan elke variant zodat frontend kan navigeren
- Response bevat extra velden:
  - `is_variant_product: true`
  - `parent_product_id`
  - `sibling_variants[]` met per variant: `{ id, title, attribute_values, linked_product_slug, image_url, price }`

### get_products (catalogus)
- Geen wijziging nodig: elk product verschijnt gewoon in zijn eigen categorie
- Optioneel: filter `parent_product_id IS NULL` als je alleen "hoofd" producten wilt tonen

---

## Frontend Aanpassingen

### ShopProductDetail.tsx
- Detecteer of product een `is_variant_product` is
- Als ja: toon de variant selector met sibling variants
- Bij variant wissel: navigeer naar de `linked_product_slug` in plaats van alleen state te wijzigen
- Gebruik `react-router-dom` `useNavigate` voor de navigatie

Logica:
```text
handleAttributeChange(optionName, value):
  1. Bereken welke variant matcht met nieuwe selectie
  2. Als variant een linked_product_slug heeft:
     -> navigate(`/shop/${tenantSlug}/${linked_product_slug}`)
  3. Anders: gewone state update (voor niet-gekoppelde varianten)
```

---

## Beheer (Admin)

In de product-editor wordt een optie toegevoegd:
- Bij elke variant: "Koppel aan bestaand product" dropdown
- Selecteer een product uit de catalogus -> slaat `linked_product_id` op
- Of: "Maak zelfstandig product aan" -> maakt een nieuw product aan met `parent_product_id` ingevuld

Dit is een toekomstige admin UI uitbreiding. De database en API worden nu alvast voorbereid.

---

## Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/migrations/XXXX.sql` | `linked_product_id` op product_variants, `parent_product_id` op products |
| `supabase/functions/storefront-api/index.ts` | get_product: sibling variants ophalen en linked_product_slug meegeven |
| `src/pages/storefront/ShopProductDetail.tsx` | Navigatie bij variant wissel naar gekoppeld product |
| `src/components/storefront/VariantSelector.tsx` | Geen wijziging nodig (dezelfde UI) |

---

## Technische Details

### Migratie SQL
- `ALTER TABLE product_variants ADD COLUMN linked_product_id UUID REFERENCES products(id) ON DELETE SET NULL`
- `ALTER TABLE products ADD COLUMN parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL`
- Index op `products.parent_product_id` voor snelle lookups

### Edge Function Logica (get_product)
```text
1. Fetch product by slug
2. IF product.parent_product_id exists:
   a. Fetch parent product's variant_options
   b. Fetch all variants of parent product
   c. For each variant with linked_product_id:
      - Join product slug
   d. Determine which variant matches current product (via linked_product_id = current product id)
   e. Return sibling_variants[] + selected_variant_index
3. ELSE IF product has variants (is parent):
   a. Normal variant flow (bestaand)
   b. Include linked_product_slug per variant waar beschikbaar
```

### Frontend Navigatie
- `useNavigate()` voor client-side navigatie
- Smooth transition: variant selector toont loading state tijdens navigatie
- URL verandert naar het gekoppelde product slug

---

## Samenvatting

Dit systeem biedt het beste van twee werelden:
- **Catalogus flexibiliteit**: elke variant kan in eigen categorie, met eigen SEO, eigen prijs
- **Klantervaring**: naadloze variant selectie op de productpagina met navigatie tussen gekoppelde producten
- **Backwards compatible**: bestaande producten zonder koppelingen blijven gewoon werken


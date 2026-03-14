

## Probleem: Categorieën worden niet volledig verwijderd

### Analyse

De database heeft foreign key constraints die het verwijderen van categorieën **blokkeren** zonder foutmelding aan de gebruiker:

1. **`products.category_id`** → `NO ACTION` — als een product nog de legacy `category_id` kolom naar deze categorie heeft, faalt de delete stilletjes
2. **`categories.parent_id`** → `NO ACTION` — als subcategorieën bestaan, faalt de delete
3. **`import_category_mappings`** → `NO ACTION` — oude importmappings blokkeren ook

De `product_categories` junction tabel en `seo_keywords` hebben al `CASCADE` — die zijn correct.

**Resultaat**: de gebruiker klikt "verwijderen", krijgt geen duidelijke fout, maar de categorie blijft in de database staan. Daarna geeft het aanmaken van een nieuwe categorie met dezelfde slug de "duplicate key" fout.

### Oplossing

**1. Database migratie — FK constraints fixen**

```sql
-- products.category_id → SET NULL bij delete
ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- categories.parent_id → SET NULL bij delete (subcategorieën worden root)
ALTER TABLE categories DROP CONSTRAINT categories_parent_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL;

-- import_category_mappings → SET NULL bij delete
ALTER TABLE import_category_mappings DROP CONSTRAINT import_category_mappings_parent_category_id_fkey;
ALTER TABLE import_category_mappings ADD CONSTRAINT import_category_mappings_parent_category_id_fkey 
  FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL;
-- (idem voor matched_existing_id, user_assigned_parent, created_category_id)
```

**2. Delete-logica verbeteren — `src/hooks/useCategories.ts`**

In de `deleteCategory` mutation en `bulkDelete` mutation: na het verwijderen, invalidate ook product-gerelateerde queries zodat de UI consistent blijft.

**3. Slug-conflict preventie — `src/components/admin/CategoryFormDialog.tsx`**

De slug wordt correct gegenereerd (spaties → streepjes). Het echte probleem is dat de oude categorie nog in de DB staat. Na de FK-fix verdwijnt dit probleem. Optioneel: bij een `23505` (unique violation) error, een duidelijker foutmelding tonen.

### Samenvatting

- 1 database migratie: 4 FK constraints aanpassen naar `ON DELETE SET NULL`
- Kleine code-aanpassing in `useCategories.ts` voor betere error handling
- Optioneel: slug-conflict melding verduidelijken in `CategoryFormDialog`


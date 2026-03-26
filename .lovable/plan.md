

## Fix: Bundel Producten Worden Niet Opgeslagen

### Root Cause

In `ProductForm.tsx` (regels 458-481) worden de bundel-gerelateerde database operaties uitgevoerd **zonder error checking**. De `supabase.from(...).upsert()`, `.delete()`, en `.insert()` calls retourneren mogelijke fouten, maar die worden compleet genegeerd. Hierdoor faalt het opslaan stilletjes — waarschijnlijk door:

1. **RLS policies** op `product_bundles` en/of `bundle_products` die de insert blokkeren
2. **Foreign key constraint**: `bundle_products.bundle_id` verwijst naar `product_bundles.id` — als de upsert in `product_bundles` faalt, faalt de insert in `bundle_products` ook

### Aanpak (1 bestand)

**`src/pages/admin/ProductForm.tsx`** — regels 455-482:

1. **Error checking toevoegen** aan alle 3 de database calls:
   - `product_bundles` upsert → check `error`, throw als het faalt
   - `bundle_products` delete → check `error`
   - `bundle_products` insert → check `error`
2. **Slug collision voorkomen**: voeg een unieke suffix toe aan de bundel-slug (bijv. timestamp of product ID fragment)
3. **Discount type default**: zet `discount_type` naar `'none'` i.p.v. een lege string (schema vereist een waarde)

### Verwacht resultaat
- Bundel items worden correct opgeslagen bij aanmaken en bewerken
- Bij fouten krijgt de tenant een duidelijke foutmelding i.p.v. stille failure


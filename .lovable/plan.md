
# Knop Link Dropdown + Upload Fix

## Twee problemen gevonden

### 1. Knop Link: dropdown met categorieeen
Het huidige "Knop Link" veld is een vrij tekstveld. Dit wordt vervangen door een dropdown (Select) met vaste pagina-opties en de beschikbare productcategorieen.

De dropdown bevat:
- Vaste routes: `/products` (Alle producten), `/cart` (Winkelwagen), `/` (Homepage)
- Dynamische categorieen uit de database (bijv. `/products?category=schoenen`)

Dit wordt toegepast op beide plekken waar "Knop Link" voorkomt in `SectionEditor.tsx`: de **hero** sectie en de **text_image** sectie.

### 2. Upload error: ontbrekende storage bucket
De `VisualMediaPicker` upload naar een bucket genaamd `tenant-assets`, maar die bucket bestaat niet. Alleen `product-images` en `marketing-assets` bestaan. Er moet een `tenant-assets` bucket aangemaakt worden (publiek, zodat afbeeldingen zichtbaar zijn op de storefront).

## Technische Wijzigingen

| Bestand / Actie | Wijziging |
|-----------------|-----------|
| **SQL Migratie** | `tenant-assets` storage bucket aanmaken met publieke toegang + RLS policy voor authenticated uploads |
| **`SectionEditor.tsx`** | Op 2 plekken het `Input`-veld voor "Knop Link" vervangen door een `Select` dropdown met vaste pagina's + categorieen uit `useCategories()` hook (al geimporteerd) |

### Detail: Dropdown opties

```text
Vaste opties:
  /products        -> "Alle Producten"
  /cart             -> "Winkelwagen"
  /                 -> "Homepage"

Categorie opties (dynamisch):
  /products?category={slug}  -> Categorienaam
```

### Detail: Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets', 'tenant-assets', true);
CREATE POLICY "Authenticated users can upload tenant assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-assets');
CREATE POLICY "Public read access for tenant assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tenant-assets');
```

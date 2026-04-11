

## Analyse: Wordt `featured_image` correct opgeslagen?

### Bevindingen

**De save-logica werkt technisch correct.** Het formulier stuurt `featured_image` mee bij opslaan via `...data` spread → `supabase.update(data)`. De waarde komt dus WEL in de database.

**Maar er zijn twee problemen:**

#### 1. Lege string i.p.v. null (28 producten geraakt)
Het Zod schema heeft `featured_image: z.string().optional().default('')`. Bij het laden van een product met `featured_image: null` wordt dit geconverteerd naar `''`. Bij opslaan wordt `''` naar de database geschreven — geen geldige URL, maar ook niet `null`.

**Database-bewijs:** 28 producten hebben afbeeldingen in de `images` array maar een lege/null `featured_image`. Dit zijn waarschijnlijk Shopify-imports of producten die vóór de featured_image logica zijn aangemaakt.

#### 2. Geen automatische sync bij bestaande producten
Wanneer een product afbeeldingen heeft maar geen `featured_image`, wordt de eerste afbeelding niet automatisch als featured ingesteld — pas als de gebruiker handmatig de hoofdafbeelding selecteert en opslaat.

### Oplossing

#### A. Form-laadlogica fixen (`ProductForm.tsx`)
Bij het laden van een product: als `featured_image` leeg is maar `images[0]` bestaat, automatisch `featured_image` op `images[0]` zetten.

#### B. Save-logica: lege string → null
In `onSubmit`: als `featured_image` een lege string is, converteer naar `null` (of naar `images[0]` als die bestaat).

#### C. Database-fix: bestaande producten repareren
Eenmalige migratie die voor alle producten met lege `featured_image` maar wel `images[0]` de featured_image op de eerste image zet:
```sql
UPDATE products 
SET featured_image = images[1] 
WHERE (featured_image IS NULL OR featured_image = '') 
  AND images IS NOT NULL 
  AND array_length(images, 1) > 0;
```

#### D. Storefront API fallback behouden
De Storefront API heeft al een fallback (`featured_image || images[0]`), maar het is beter de bron te fixen.

### Bestanden
| Bestand | Wat |
|---------|-----|
| `src/pages/admin/ProductForm.tsx` | featured_image auto-set bij laden + lege string → null bij save |
| Nieuwe migratie | Bestaande producten: `featured_image = images[1]` waar leeg |


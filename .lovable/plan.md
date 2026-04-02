

## Fix: Afbeeldingen worden overschreven door lege Variant Image

### Probleem

Na consolidatie bevat `Image Src` alle product-afbeeldingen als comma-separated string (bijv. `"url1.jpg,url2.jpg,url3.jpg"`). De `imageArray` transform zet dit correct om naar een array.

**Maar**: de CSV header `Variant Image` komt NA `Image Src` in de kolomvolgorde. Na consolidatie is `Variant Image` in de hoofdrij leeg (variant images zitten in `_variants_json`). De `imageArray` transform van een lege string retourneert `[]`, wat de eerder correct ingevulde `images` array **overschrijft**.

Bewezen: de edge function werkt correct — wanneer `images: ["url1", "url2"]` wordt meegegeven, slaat hij ze netjes op. Het probleem zit puur in de client-side transform.

### Fix

**`src/lib/importMappings.ts`** — Twee wijzigingen:

1. **`Variant Image` mapping wijzigen**: target veranderen van `images` naar `raw_import_data` (of verwijderen), zodat het niet meer de `Image Src` images overschrijft. Variant images zitten al in `_variants_json`.

```ts
// WAS:
'Variant Image': { target: 'images', transform: 'imageArray' },
// WORDT:
'Variant Image': { target: 'raw_import_data', transform: 'jsonString:variant_image' },
```

2. **`imageArray` transform robuuster maken**: als het resultaat een lege array is en er al een waarde bestaat voor het target veld, niet overschrijven. Dit als extra veiligheid.

In `transformRecord`, voeg array-merge logica toe:
```ts
// Na transformatie, als het een array is:
if (Array.isArray(transformedValue)) {
  const existing = result[config.target];
  if (Array.isArray(existing)) {
    // Merge arrays, deduplicate
    result[config.target] = [...new Set([...existing, ...transformedValue])];
    continue;
  }
}
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/lib/importMappings.ts` | Variant Image target wijzigen + array merge in transformRecord |

### Geen database of edge function wijzigingen nodig


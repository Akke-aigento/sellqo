
# Fix: Shopify Product CSV Row Consolidatie (44 producten i.p.v. 152 rijen)

## Probleem Analyse

Je CSV bestand heeft **2882 regels** voor slechts **44 unieke producten**. Shopify exporteert:

```text
Rij 1:  Handle: "powerstrip-2x"  | Title: "VanXcel Powerstrip" | Image: img1.png
Rij 2:  Handle: "powerstrip-2x"  | Title: (LEEG)               | Image: img2.png  
Rij 3:  Handle: "powerstrip-2x"  | Title: (LEEG)               | Image: img3.png
...
Rij 10: Handle: "fuse-150a"      | Title: "VanXcel Fuse 150A"  | Image: img1.png
Rij 11: Handle: "fuse-150a"      | Title: (LEEG)               | Image: img2.png
```

De huidige parser behandelt ELKE rij als apart product:
- 44 rijen MET Title → valide producten
- 108 rijen ZONDER Title → "Product name is required" errors

**Totaal: 44 + 108 = 152 records (precies wat je ziet!)**

---

## Oplossing: Consolideer Rijen op Handle

### Strategie

Na het parsen van de CSV, groepeer alle rijen met dezelfde `Handle`:
- Eerste rij met Title = hoofdproduct
- Volgende rijen = extra afbeeldingen + variant data

Resultaat: 2882 rijen → 44 geconsolideerde producten

### Wat wordt samengevoegd?

| Veld | Gedrag |
|------|--------|
| Title, Description, Price, SKU | Van eerste rij (hoofd-product) |
| Image Src | **ALLE** images verzameld in array |
| Variant data | Opgeslagen in `raw_import_data` voor later gebruik |
| Overige velden | Eerste rij wint, rest genegeerd |

---

## Technische Implementatie

### Bestand 1: `src/lib/importMappings.ts`

Nieuwe functie toevoegen: `consolidateShopifyProductRows()`

```typescript
export function consolidateShopifyProductRows(
  rows: Record<string, string>[]
): Record<string, string>[] {
  // Detecteer of dit een Shopify product export is
  const hasHandle = rows.some(r => 'Handle' in r);
  const hasTitle = rows.some(r => 'Title' in r);
  if (!hasHandle || !hasTitle) return rows;
  
  const productMap = new Map<string, Record<string, string>>();
  const imagesMap = new Map<string, string[]>();
  const variantsMap = new Map<string, Record<string, string>[]>();
  
  for (const row of rows) {
    const handle = row['Handle']?.trim();
    if (!handle) continue;
    
    if (!productMap.has(handle)) {
      // Eerste rij met deze Handle = hoofdproduct
      productMap.set(handle, { ...row });
      imagesMap.set(handle, []);
      variantsMap.set(handle, []);
    }
    
    // Verzamel alle images
    const imageSrc = row['Image Src']?.trim();
    if (imageSrc) {
      const images = imagesMap.get(handle)!;
      if (!images.includes(imageSrc)) {
        images.push(imageSrc);
      }
    }
    
    // Verzamel variant data (rijen met Option1 Value maar zonder Title)
    const hasVariantData = row['Option1 Value'] && !row['Title']?.trim();
    if (hasVariantData) {
      variantsMap.get(handle)?.push({
        sku: row['Variant SKU'] || '',
        price: row['Variant Price'] || '',
        stock: row['Variant Inventory Qty'] || '',
        option1: row['Option1 Value'] || '',
        option2: row['Option2 Value'] || '',
        option3: row['Option3 Value'] || '',
        barcode: row['Variant Barcode'] || '',
      });
    }
  }
  
  // Bouw geconsolideerde rijen
  const consolidated: Record<string, string>[] = [];
  
  for (const [handle, mainRow] of productMap) {
    const images = imagesMap.get(handle) || [];
    const variants = variantsMap.get(handle) || [];
    
    // Voeg alle images toe als comma-separated string
    if (images.length > 0) {
      mainRow['Image Src'] = images.join(',');
    }
    
    // Voeg variant count toe voor referentie
    if (variants.length > 0) {
      mainRow['_variant_count'] = String(variants.length);
      mainRow['_variants_json'] = JSON.stringify(variants);
    }
    
    consolidated.push(mainRow);
  }
  
  console.log(`Consolidated ${rows.length} rows into ${consolidated.length} products`);
  return consolidated;
}
```

### Bestand 2: `src/components/admin/import/FileUpload.tsx`

Integreer consolidatie voor product imports:

```typescript
import { consolidateShopifyProductRows } from '@/lib/importMappings';

// In handleFile():
const { headers, rows } = await parseCSV(file);

// Consolideer Shopify product rijen vóór verdere verwerking
let processedRows = rows;
if (dataType === 'products' && headers.includes('Handle') && headers.includes('Title')) {
  processedRows = consolidateShopifyProductRows(rows);
  console.log(`Product consolidation: ${rows.length} → ${processedRows.length}`);
}

onFileUpload(dataType, {
  file,
  dataType,
  rowCount: processedRows.length,  // Update row count!
  headers,
  sampleData: processedRows.slice(0, 5),
  allData: processedRows,          // Geconsolideerde data
});
```

### Bestand 3: `src/lib/importMappings.ts` - Image Array Transform

Update de `imageArray` transformer om comma-separated strings correct te handlen:

```typescript
imageArray: (v) => {
  if (!v) return [];
  // Split op komma, filter lege strings en duplicaten
  const urls = v.split(',')
    .map(url => url.trim())
    .filter(Boolean);
  return [...new Set(urls)]; // Remove duplicates
},
```

---

## Verwacht Resultaat

| Vóór Fix | Na Fix |
|----------|--------|
| 152 records (44 valid, 108 errors) | **44 records (44 valid)** |
| "Product name is required" x108 | Geen errors |
| Afbeeldingen verloren | Alle images in `images[]` array |
| Geen variant info | Variants in `raw_import_data` |

---

## Bonus: Console Logging

Na de fix zie je in de console:
```
Consolidated 2882 rows into 44 products
Product consolidation: 2882 → 44
Preview computed: 44 total, 44 valid
```

---

## Bestanden die Worden Gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `src/lib/importMappings.ts` | Nieuwe `consolidateShopifyProductRows()` functie |
| `src/components/admin/import/FileUpload.tsx` | Roep consolidatie aan voor product imports |

---

## Edge Cases Afgehandeld

1. **Alleen image-rijen** (geen variant data): Correct afgehandeld, images worden verzameld
2. **Producten met varianten**: Variant data opgeslagen in `_variants_json`
3. **Non-Shopify CSV's**: Geen consolidatie als `Handle`/`Title` kolommen ontbreken
4. **Duplicate images**: Automatisch gefilterd met `Set()`
5. **Lege Handle**: Rij wordt overgeslagen (geen product identificatie)

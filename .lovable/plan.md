

## Fix: Varianten en afbeeldingen worden niet doorgegeven aan edge function

### Probleem

De consolidatie-functie voegt `_variants_json`, `_option1_name`, `_option2_name`, `_option3_name` correct toe aan de CSV-rij. Maar `transformRecord()` verwerkt alleen velden die in de `mapping` staan. Deze interne keys zitten niet in `SHOPIFY_PRODUCT_MAPPING`, dus ze worden weggegooid voordat de data naar de edge function gestuurd wordt. De edge function code voor varianten is correct — hij krijgt alleen nooit input.

### Wijzigingen

**1. `src/types/import.ts`** — Interne variant-keys toevoegen aan `PRODUCT_TARGET_FIELDS`

Voeg toe na de custom spec velden:
```
'_variants_json',
'_option1_name',
'_option2_name',
'_option3_name',
```

**2. `src/lib/importMappings.ts`** — Mapping entries toevoegen aan `SHOPIFY_PRODUCT_MAPPING`

Voeg toe als pass-through mappings (zodat `transformRecord` ze meeneemt):
```ts
'_variants_json': { target: '_variants_json' },
'_option1_name': { target: '_option1_name' },
'_option2_name': { target: '_option2_name' },
'_option3_name': { target: '_option3_name' },
'_variant_count': { target: '_variant_count' },
```

**3. `src/components/admin/import/FieldMappingStep.tsx`** — Interne velden verbergen in dropdown

Filter velden die met `_variant` of `_option` beginnen uit de Select opties, zodat ze niet zichtbaar zijn voor de gebruiker maar wel doorgegeven worden.

### Resultaat
- `_variants_json` bereikt de edge function → varianten worden aangemaakt
- `_option1_name` etc. bereiken de edge function → opties krijgen juiste namen (Maat, Kleur etc.)
- Variant afbeeldingen (in `_variants_json.image`) worden opgeslagen als `image_url` op de variant
- Product afbeeldingen via `Image Src` consolidatie werken al correct

### Bestanden

| Bestand | Actie |
|---|---|
| `src/types/import.ts` | 4 interne keys toevoegen aan `PRODUCT_TARGET_FIELDS` |
| `src/lib/importMappings.ts` | 5 pass-through mappings toevoegen aan `SHOPIFY_PRODUCT_MAPPING` |
| `src/components/admin/import/FieldMappingStep.tsx` | Interne velden verbergen in dropdown |

### Geen database of edge function wijzigingen nodig
De edge function variant-code is correct — alleen de data-pipeline ernaar toe was kapot.


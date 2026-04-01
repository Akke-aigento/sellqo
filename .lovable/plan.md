

## Fix: Spec/Custom Spec targets zichtbaar maken in import mapping UI

### Probleem

De mapping-logica werkt correct — `_spec_color`, `_custom_spec_Kleding_fit` etc. worden als target ingesteld. Maar `PRODUCT_TARGET_FIELDS` in `src/types/import.ts` bevat deze targets niet. Hierdoor:
- De Select dropdown toont ze niet als opties
- Auto-gemapte velden verschijnen als **leeg** in de UI (waarde bestaat maar geen matching SelectItem)
- De edge function ontvangt ze WEL correct en verwerkt ze naar de juiste tabellen

### Wijzigingen

**1. `src/types/import.ts`** — Spec targets toevoegen aan `PRODUCT_TARGET_FIELDS`

Voeg toe na `raw_import_data`:
```
// Specification fields (product_specifications table)
'_spec_color',
'_spec_size', 
'_spec_material',
'_spec_storage_instructions',
// Custom specification fields (product_custom_specs table, groep "Kleding")
'_custom_spec_Kleding_accessory_size',
'_custom_spec_Kleding_activewear_features',
'_custom_spec_Kleding_activity',
'_custom_spec_Kleding_age_group',
... (alle 22 custom specs)
```

**2. `src/components/admin/import/FieldMappingStep.tsx`** — Leesbare labels tonen

In de SelectItem rendering, vervang `field.replace(/_/g, ' ')` met een formatter die:
- `_spec_color` → "Specificatie: Kleur"
- `_custom_spec_Kleding_fit` → "Kleding: Fit"
- Alle andere velden → huidige logica (underscore → spatie)

Helper functie:
```ts
function formatTargetField(field: string): string {
  if (field.startsWith('_spec_')) {
    const col = field.replace('_spec_', '');
    const labels: Record<string, string> = {
      color: 'Kleur', size: 'Maat', material: 'Materiaal',
      storage_instructions: 'Bewaarinstructies'
    };
    return `Specificatie: ${labels[col] || col}`;
  }
  if (field.startsWith('_custom_spec_')) {
    const rest = field.replace('_custom_spec_', '');
    const idx = rest.indexOf('_');
    const group = rest.substring(0, idx);
    const key = rest.substring(idx + 1).replace(/_/g, ' ');
    return `${group}: ${key}`;
  }
  return field.replace(/_/g, ' ');
}
```

### Resultaat
- Dropdown toont alle spec targets met leesbare namen
- Auto-mapping werkt EN is zichtbaar
- Edge function verwerkt data naar `product_specifications` en `product_custom_specs` (ongewijzigd)

### Geen database wijzigingen nodig


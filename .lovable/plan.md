

## Fix: Bundel producten worden niet opgeslagen

### Root cause
De database tabel `product_bundle_items` heeft een CHECK constraint: `quantity > 0`. De UI staat quantity **0** toe (min="0"), waardoor de insert faalt met een constraint violation. De error wordt niet goed getoond aan de gebruiker.

Dezelfde issue geldt voor `min_quantity`: constraint `min_quantity > 0` maar UI staat 0 toe.

### Oplossing: Database migratie

De CHECK constraints aanpassen zodat 0 is toegestaan:

```sql
ALTER TABLE product_bundle_items DROP CONSTRAINT product_bundle_items_quantity_positive;
ALTER TABLE product_bundle_items ADD CONSTRAINT product_bundle_items_quantity_non_negative CHECK (quantity >= 0);

ALTER TABLE product_bundle_items DROP CONSTRAINT product_bundle_items_min_positive;
ALTER TABLE product_bundle_items ADD CONSTRAINT product_bundle_items_min_non_negative CHECK (min_quantity IS NULL OR min_quantity >= 0);
```

### Bestand

| Wat | Wijziging |
|---|---|
| Nieuwe migratie | CHECK constraints aanpassen: `quantity >= 0` en `min_quantity >= 0` |

Geen code-wijzigingen nodig — de save-logica in `ProductForm.tsx` en `useSaveBundleItems()` werkt al correct, alleen de DB constraint blokkeert het.


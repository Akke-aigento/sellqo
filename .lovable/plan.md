

## Unieke SKU, EAN/Barcode & Interne Referentie per variant

### Huidige situatie
- De database heeft al `sku` en `barcode` kolommen op `product_variants`
- De admin-tabel toont alleen SKU als bewerkbaar veld
- Er is geen `internal_reference` kolom in de database

### Wijzigingen

**Database migratie** -- 1 kolom toevoegen:
- `internal_reference` (text, nullable) op `product_variants` -- vrij tekstveld voor interne codes, magazijnlocaties, inkoopcodes, etc.

**Bestand 1: `src/hooks/useProductVariants.ts`**
- `internal_reference` toevoegen aan de `ProductVariant` interface
- `internal_reference` toevoegen aan `VariantFormData` interface
- `barcode` en `internal_reference` meenemen in `startEditVariant` data

**Bestand 2: `src/components/admin/products/ProductVariantsTab.tsx`**
- De tabelheader uitbreiden met kolommen: **EAN/Barcode** en **Interne ref.**
- Bij inline bewerken: invoervelden tonen voor `barcode` en `internal_reference`
- Bij weergave: de waarden tonen (of "—" als leeg)
- `barcode` en `internal_reference` meenemen in `startEditVariant`

### Resultaat tabel-layout

```text
| Afbeelding | Variant | SKU | EAN/Barcode | Interne ref. | Prijs | Voorraad | Actief | Gekoppeld | Acties |
```

### Scope
- 1 database migratie (1 kolom)
- 2 bestanden aangepast
- Geen storefront-wijzigingen nodig

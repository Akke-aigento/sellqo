
## Twee verbeteringen: Duidelijke foutmeldingen en optionele SKU/EAN

### Probleem 1: Onbegrijpelijke foutmeldingen
De toasts tonen nu ruwe database-foutmeldingen zoals `duplicate key value violates unique constraint "products_tenant_sku_unique"`. Tenants snappen hier niks van.

### Probleem 2: SKU/EAN verplicht door lege strings
Het formulier stuurt `sku: ''` naar de database. De unique constraint op `(tenant_id, sku) WHERE sku IS NOT NULL` werkt correct met `NULL`, maar lege strings `''` zijn niet `NULL` -- dus twee producten met lege SKU botsen op de constraint.

---

### Oplossing

**Bestand 1: `src/hooks/useProducts.ts`** -- Foutvertalingen toevoegen

In de `onError` handlers van `createProduct` en `updateProduct`, de ruwe database-fout vertalen naar begrijpelijke Nederlandse tekst:

- `products_tenant_sku_unique` -> "Er bestaat al een product met deze SKU. Kies een unieke SKU of laat het veld leeg."
- `products_tenant_slug_key` / `products_slug_key` -> "Er bestaat al een product met deze URL-slug. Pas de slug aan."
- Overige fouten -> "Er ging iets mis bij het opslaan. Probeer het opnieuw."

**Bestand 2: `src/pages/admin/ProductForm.tsx`** -- Lege strings omzetten naar `null`

In de `onSubmit` functie, lege strings voor `sku` en `barcode` omzetten naar `null` zodat de database-constraint ze correct negeert:

```typescript
const submitData = {
  ...data,
  category_id: data.category_id || null,
  sku: data.sku?.trim() || null,
  barcode: data.barcode?.trim() || null,
};
```

### Resultaat
- SKU en EAN zijn echt optioneel: leeg laten werkt zonder fout
- Bij dubbele SKU krijgt de tenant een duidelijke melding: "Er bestaat al een product met deze SKU"
- Overige fouten worden ook in normaal Nederlands getoond

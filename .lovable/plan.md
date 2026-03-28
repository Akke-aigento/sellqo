

## Fix: SKU lege string → null bij opslaan

### Probleem
De unique index `products_tenant_sku_unique` filtert alleen `NULL` waarden uit (`WHERE sku IS NOT NULL`). Maar het formulier stuurt `sku: ''` (lege string) als er niets is ingevuld. Meerdere producten met lege string SKU botsen dan op de unique constraint.

### Oplossing
In `src/pages/admin/ProductForm.tsx` — bij het opslaan (de `onSubmit` handler): lege strings voor `sku` en `barcode` omzetten naar `null` voordat ze naar de database gaan.

```typescript
sku: values.sku?.trim() || null,
barcode: values.barcode?.trim() || null,
```

Dit is de enige wijziging. Geen database migratie nodig — de index werkt al correct met `NULL`.

### Bestand
`src/pages/admin/ProductForm.tsx` — onSubmit handler aanpassen


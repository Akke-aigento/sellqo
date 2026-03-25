

## Bundel Producten Toevoegen in ProductForm

### Probleem
Wanneer je "Bundel" selecteert als product type, verschijnt er geen sectie om producten/diensten aan de bundel toe te voegen. Die functionaliteit zit alleen in de `BundleFormDialog` (Promoties → Bundels), niet in het ProductForm.

### Oplossing
Voeg een "Bundel inhoud" sectie toe aan het ProductForm die verschijnt wanneer `product_type === 'bundle'`. Hergebruik de bestaande `ProductMultiSelect` component en het `bundle_products` tabel-patroon.

### Aanpak (1 bestand + 1 nieuw component)

**1. `src/components/admin/products/BundleProductsSection.tsx`** (nieuw)
- Standalone component met een lijst van geselecteerde producten
- Per product: naam, hoeveelheid (number input), verplicht toggle, verwijder knop
- "Product toevoegen" knop die `ProductMultiSelect` opent
- Props: `value` (array van bundle items) + `onChange` callback

**2. `src/pages/admin/ProductForm.tsx`**
- Voeg `isBundle = productType === 'bundle'` toe (naast bestaande `isDigital`, `isGiftCard`)
- Na de gift card sectie, voeg conditioneel `{isBundle && <BundleProductsSection />}` toe
- Bij `handleProductTypeChange('bundle')`: zet `requires_shipping` en `track_inventory` naar false
- Bij submit: sla bundle products op via `bundle_products` tabel (zelfde patroon als `useCreateBundle`)
- Bij edit: laad bestaande bundle products en toon ze

### Hoe het werkt
- Tenant kiest "Bundel" als product type
- Sectie "Bundel inhoud" verschijnt onder product informatie
- Tenant voegt producten toe, stelt hoeveelheid in per item
- Bij opslaan worden de bundle items opgeslagen in de `bundle_products` tabel gekoppeld aan het product


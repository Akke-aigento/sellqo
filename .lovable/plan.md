## Korting-formulieren: Productselectors Toegevoegd ✅

### Wat is gewijzigd

1. **ProductMultiSelect** - Herbruikbare zoekbare productselector met afbeeldingen, naam, prijs, SKU
2. **CategoryMultiSelect** - Herbruikbare zoekbare categorieselector
3. **BundleFormDialog** - Volledig herbouwd met:
   - Producten toevoegen/verwijderen
   - Kwantiteit per product
   - Verplicht-toggle per product
   - "Klant past aan"-toggle per product (allow_quantity_change)
   - Groepnaam voor mix & match
4. **BogoPromotionFormDialog** - Koop-producten en krijg-producten selectors
5. **VolumeDiscountFormDialog** - Product- en categorieselector bij "Specifieke producten"/"Categorie"
6. **AutoDiscountFormDialog** - Trigger-producten selector en "Toepassen op" productselector
7. **GiftPromotionFormDialog** - Trigger-producten selector bij "Specifieke producten"
8. **DB migratie** - `allow_quantity_change` kolom toegevoegd aan `bundle_products`
9. **Types** - `BundleProduct` en `ProductBundleFormData` uitgebreid
10. **useBundles hook** - `allow_quantity_change` mee in insert/update

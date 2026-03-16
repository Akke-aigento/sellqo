

## Analyse: Alle Korting-formulieren missen productselectors

Na grondig bekijken van alle 7 promotie-formulieren is het probleem duidelijk: **geen enkel formulier heeft een productselector**. Ze slaan alleen metadata op (naam, type, korting%) maar je kunt nergens producten aanduiden.

### Wat er ontbreekt per formuliertype

| Formulier | Wat ontbreekt |
|-----------|---------------|
| **BundleFormDialog** | Producten toevoegen, kwantiteit per product, verplicht-toggle, klant-kwantiteit-aanpasbaar toggle |
| **BogoPromotionFormDialog** | "Koop"-producten selecteren, "Krijg"-producten selecteren (buy_product_ids, get_product_ids) |
| **VolumeDiscountFormDialog** | Productselector wanneer "Specifieke producten" gekozen, categorieselector voor "Categorie" |
| **AutoDiscountFormDialog** | Product/categorie selector bij "Specifieke producten" trigger en "Toepassen op" |
| **GiftPromotionFormDialog** | Trigger-producten selector bij "Specifieke producten" trigger (trigger_product_ids) |

### Implementatieplan

**1. Herbruikbare ProductMultiSelect component bouwen**
- Nieuwe component `src/components/admin/promotions/ProductMultiSelect.tsx`
- Zoekbaar dropdown met checkbox-selectie (Combobox/Command pattern)
- Toont productafbeelding, naam en prijs
- Props: `selectedIds`, `onChange`, `label`, `placeholder`
- Gebruikt bestaande `useProducts()` hook

**2. BundleFormDialog volledig herbouwen** (grootste wijziging)
- Producten-sectie toevoegen met "Product toevoegen" knop
- Per product in de bundel:
  - Product selecteren via ProductMultiSelect
  - Kwantiteit instellen (number input)
  - Verplicht toggle (Switch)
  - Klant mag kwantiteit aanpassen toggle (Switch) -- nieuw veld `allow_quantity_change` op `bundle_products`
  - Groepnaam (optioneel, voor mix & match)
  - Verwijder-knop
- `useFieldArray` voor dynamische productenlijst
- Formulierdata correct doorsluizen naar `useCreateBundle` / `useUpdateBundle`
- Bij bewerken: bestaande producten laden

**3. BogoPromotionFormDialog uitbreiden**
- ProductMultiSelect voor "Koop producten" (`buy_product_ids`)
- ProductMultiSelect voor "Krijg producten" (`get_product_ids`)
- Tonen wanneer relevant (niet bij "alle producten")

**4. VolumeDiscountFormDialog uitbreiden**
- ProductMultiSelect tonen wanneer `applies_to === 'product'`
- Categorieselector tonen wanneer `applies_to === 'category'`
- `product_ids` en `category_ids` meesturen in formData

**5. AutoDiscountFormDialog uitbreiden**
- ProductMultiSelect bij trigger "Specifieke producten" (`trigger_product_ids`)
- ProductMultiSelect bij "Toepassen op specifieke producten" (`product_ids`)

**6. GiftPromotionFormDialog uitbreiden**
- ProductMultiSelect bij trigger "Specifieke producten" (`trigger_product_ids`)

**7. Database migratie**
- Kolom `allow_quantity_change` (boolean, default false) toevoegen aan `bundle_products` tabel
- Type `BundleProduct` updaten in `src/types/promotions.ts`

### Technische aanpak
- ProductMultiSelect gebaseerd op bestaande Shadcn Command/Popover pattern
- Formulieren worden breder (`max-w-2xl`) om ruimte te maken voor productsecties
- Alle hooks (useBundles, useBogoPromotions, etc.) sluizen de product_ids al correct door -- het zijn alleen de formulieren die ze niet invullen


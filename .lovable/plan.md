

## Analyse: Product/Categorie-selectie ontbreekt in promotieformulieren

### Huidige situatie per promotietype

| Promotietype | Product-selectie | Categorie-selectie | Status |
|---|---|---|---|
| **Kortingscodes** | Ontbreekt volledig | Ontbreekt volledig | KRITIEK — `applies_to` veld bestaat maar selectors ontbreken, `product_ids` en `category_ids` worden hardcoded als `[]` |
| **BOGO Acties** | Werkt (koop + krijg) | Ontbreekt — `buy_category_ids` en `get_category_ids` bestaan in type maar geen UI | GAP |
| **Auto-kortingen** | Werkt (trigger + toepassing) | Ontbreekt — optie "specifieke categorieën" bestaat maar toont geen selector | GAP |
| **Cadeauacties** | Werkt (trigger + cadeau) | Ontbreekt — `trigger_category_ids` bestaat in type maar geen UI | GAP |
| **Klantengroepen** | Geen product-prijzen UI | n.v.t. | GAP — `CustomerGroupProductPrice` type bestaat maar geen beheer-UI |
| Bundels | Werkt | n.v.t. | OK |
| Staffelkortingen | Werkt | Werkt | OK |
| Loyaliteit | n.v.t. | n.v.t. | OK |
| Stapelregels | n.v.t. | n.v.t. | OK |
| Cadeaukaarten | n.v.t. | n.v.t. | OK |

### Plan: 5 formulieren repareren

**1. Kortingscodes — `DiscountCodeDialog.tsx`** (hoogste prioriteit)
- `ProductMultiSelect` en `CategoryMultiSelect` importeren
- `product_ids` en `category_ids` als form-velden toevoegen (arrays)
- Conditioneel tonen wanneer `applies_to` = `specific_products` of `specific_categories`
- `handleSubmit` aanpassen: de daadwerkelijke geselecteerde IDs meegeven i.p.v. hardcoded `[]`
- Bij bewerken: bestaande `product_ids`/`category_ids` laden in het formulier

**2. BOGO Acties — `BogoPromotionFormDialog.tsx`**
- `CategoryMultiSelect` importeren
- Onder "Koop-producten": `CategoryMultiSelect` toevoegen voor `buy_category_ids`
- Onder "Krijg-producten": `CategoryMultiSelect` toevoegen voor `get_category_ids`
- Label: "Of selecteer categorieën" als alternatief naast productenselectie

**3. Auto-kortingen — `AutoDiscountFormDialog.tsx`**
- `CategoryMultiSelect` importeren
- Wanneer `applies_to === 'specific_categories'`: `CategoryMultiSelect` tonen
- Nieuw form-veld `category_ids` toevoegen aan schema + submit-handler

**4. Cadeauacties — `GiftPromotionFormDialog.tsx`**
- `CategoryMultiSelect` importeren
- Wanneer `trigger_type === 'specific_products'` of nieuw `'specific_categories'`: `CategoryMultiSelect` tonen voor `trigger_category_ids`

**5. Klantengroepen — `CustomerGroupFormDialog.tsx`** (lagere prioriteit, optioneel)
- Sectie toevoegen voor "Aangepaste productprijzen"
- Per product: custom prijs of kortingspercentage instellen
- Gebruikt bestaand `CustomerGroupProductPrice` type

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/admin/DiscountCodeDialog.tsx` | Product/categorie selectors + form state + submit fix |
| `src/components/admin/promotions/BogoPromotionFormDialog.tsx` | CategoryMultiSelect voor koop/krijg |
| `src/components/admin/promotions/AutoDiscountFormDialog.tsx` | CategoryMultiSelect bij `specific_categories` |
| `src/components/admin/promotions/GiftPromotionFormDialog.tsx` | CategoryMultiSelect voor trigger-categorieën |
| `src/components/admin/promotions/CustomerGroupFormDialog.tsx` | Productprijzen-sectie (optioneel) |

Alle promotieformulieren gebruiken dezelfde bestaande `ProductMultiSelect` en `CategoryMultiSelect` componenten — geen nieuwe componenten nodig.


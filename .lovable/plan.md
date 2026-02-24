
## Fix: Cadeaukaart storefront weergave + categorie-koppeling verdwijnt

### Probleem 1: Storefront toont standaard productpagina voor cadeaukaarten

**Oorzaak:** De `usePublicProduct` query in `src/hooks/usePublicStorefront.ts` haalt het veld `product_type` niet op, noch de cadeaukaart-velden (`gift_card_denominations`, `gift_card_allow_custom`, etc.). Hierdoor is `product.product_type` altijd `undefined` op de storefront, en toont de pagina de standaard layout met EUR 0,00, quantity selector en "Toevoegen aan winkelwagen".

**Oplossing:** De select-query in `usePublicProduct` uitbreiden met alle benodigde velden:

```text
product_type, gift_card_denominations, gift_card_allow_custom,
gift_card_min_amount, gift_card_max_amount, gift_card_design_id,
gift_card_expiry_months, short_description, hide_from_storefront
```

**Bestand:** `src/hooks/usePublicStorefront.ts` (regel ~303-308)

---

### Probleem 2: Categoriekoppelingen verdwijnen na opslaan

**Oorzaak:** In `src/pages/admin/ProductForm.tsx` wordt de categorie-initialisatie gedaan met een conditie in de render body:

```text
if (isEditing && savedCategoryIds.length > 0 && !categoriesInitialized) {
  setSelectedCategoryIds(savedCategoryIds);
  ...
}
```

Dit patroon heeft twee problemen:
- Als `savedCategoryIds` nog leeg is (data aan het laden), wordt de initialisatie overgeslagen
- Als de gebruiker het product opslaat voordat de categories geladen zijn, stuurt `onSubmit` een lege `selectedCategoryIds` array naar `syncCategories`, die eerst alles verwijdert en dan niets invoegt

**Oplossing:** De categorie-initialisatie verplaatsen naar een `useEffect` met correcte dependencies, en een guard toevoegen in `onSubmit` om syncCategories alleen aan te roepen als de data geinitialiseerd is.

**Bestand:** `src/pages/admin/ProductForm.tsx`

Wijzigingen:
1. Vervang de render-body conditie door een `useEffect` die reageert op `savedCategoryIds` en `savedPrimaryCategoryId`
2. In `onSubmit`: check of `categoriesInitialized` true is voordat `syncCategories` wordt aangeroepen, anders overslaan

---

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/usePublicStorefront.ts` | `product_type` en gift card velden toevoegen aan `usePublicProduct` select query |
| `src/pages/admin/ProductForm.tsx` | Categorie-initialisatie verplaatsen naar `useEffect`; guard in `onSubmit` |

### Resultaat
- Storefront herkent cadeaukaarten en toont het 3-staps aankoopformulier (bedrag kiezen, ontvanger, bevestiging)
- Categoriekoppelingen blijven behouden na het opslaan van producten

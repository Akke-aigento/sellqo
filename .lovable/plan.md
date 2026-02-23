

## Analyse & Fix: Dubbele kader + varianten verschijnen niet

### Probleem 1: Dubbele kader (UI)

In `ProductForm.tsx` (regel 1002-1010) wordt `ProductVariantsTab` al in een `<Card>` gewrapped met een eigen `<CardHeader>` ("Varianten" / "Beheer productvarianten..."). Maar `ProductVariantsTab` zelf rendert intern ook twee `<Card>` componenten (Variant opties + Varianten tabel). Dit geeft het "dubbele kader" effect dat je ziet.

**Fix**: Verwijder de buitenste Card-wrapper in `ProductForm.tsx` en render `ProductVariantsTab` direct. De component heeft al zijn eigen Cards met headers.

**Bestand**: `src/pages/admin/ProductForm.tsx` (regels 1000-1017)

Verander van:
```
<Card>
  <CardHeader>
    <CardTitle>Varianten</CardTitle>
    <CardDescription>Beheer productvarianten...</CardDescription>
  </CardHeader>
  <CardContent>
    <ProductVariantsTab productId={id} />
  </CardContent>
</Card>
```
Naar:
```
<ProductVariantsTab productId={id} />
```

En de else-tak (product nog niet opgeslagen) blijft als losse Card.

---

### Probleem 2: Varianten verschijnen niet in frontend

Dit is geen code-bug meer (de storefront-fix van de vorige stap is correct). Het probleem is dat er momenteel **0 varianten in de database staan** voor dit product. Er is wel een optie "XS" aangemaakt met waarde "Extra Small", maar er zijn geen varianten gegenereerd.

De flow is: Opties toevoegen -> "Varianten genereren uit opties" klikken -> varianten worden aangemaakt in `product_variants` tabel.

Zonder die stap bestaat er geen data om te tonen. De storefront-code werkt correct: `has_variants` is `false` omdat er geen rijen in `product_variants` zijn.

**Geen code-fix nodig** -- na het oplossen van de dubbele kader kun je in de admin opties toevoegen en op "Varianten genereren uit opties" klikken. De varianten verschijnen dan automatisch in de frontend.

---

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/ProductForm.tsx` | Verwijder dubbele Card-wrapper rond `ProductVariantsTab` |

1 bestand, minimale wijziging.


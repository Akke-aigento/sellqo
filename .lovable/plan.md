
Doel: bulk categorie-wijzigingen moeten écht persistenter werken én meteen zichtbaar zijn in zowel lijst- als gridweergave.

Diagnose (grondig)
- De bulkflow schrijft nu naar `product_categories`, maar synchroniseert **niet** consequent de legacy `products.category_id`.
- Gevolg: grid/list-delen die op `category_id` vertrouwen tonen leeg/oud, waardoor het lijkt alsof opslaan faalt.
- Extra probleem: `productCategoryMap` in `Products.tsx` wordt alleen herladen wanneer `products` wijzigt; categorie-only bulkupdates wijzigen `products` vaak niet, dus UI blijft stale.
- In data zie je dit patroon al: product heeft rows in `product_categories` maar `products.category_id = null`.

Implementatieplan

1) Categorie-bulklogica herwerken in `src/pages/admin/Products.tsx`
- Vervang de huidige nested add/remove loops door één “sync per product” flow:
  - huidige categorieën per geselecteerd product ophalen
  - add/remove toepassen in memory
  - gewenste set normaliseren (sort_order oplopend, 1 primary)
  - DB sync uitvoeren: delete obsolete + upsert desired met correcte `is_primary/sort_order`
- Daarna per product `products.category_id` updaten naar de gekozen primary (of `null` als geen categorieën meer).

2) UI meteen consistent maken na bulk categorie-update
- In `Products.tsx` een expliciete `refreshProductCategoryMap()` helper maken.
- Deze helper:
  - haalt alleen mappings op voor relevante producten (niet blind alle rows)
  - heeft nette error handling
- Aanroepen:
  - bij initiële load
  - direct na succesvolle categorie-bulksync
- Daarnaast `products` query invalideren zodat grid/list die nog op `category_id` steunen ook meteen klopt.

3) Robuustheid/errorfeedback behouden
- Categorie-sync in bestaande `tryOp` laten, maar foutdetails uitbreiden (welke product-sync faalde).
- Bij partial failure: duidelijke fouttoast + dialog open laten.
- Bij succes: selectie resetten + succesmelding met aantallen.

4) Validatie na fix
- Test A: bulk “categorie toevoegen” op producten zonder categorie → direct zichtbaar in lijst + grid, en `category_id` gevuld.
- Test B: bulk “categorie verwijderen” (incl. laatste categorie) → direct zichtbaar, `category_id` wordt null.
- Test C: combinatie add+remove in één run → primaire categorie blijft correct, geen “ghost” categorieën.
- Test D: harde refresh van pagina toont exact dezelfde resultaten (persistente opslag bevestigd).

Bestand(en)
- `src/pages/admin/Products.tsx` (kernfix: synclogica + map refresh + invalidaties)

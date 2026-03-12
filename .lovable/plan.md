
Doel: fixen dat meerdere categorieën na opslaan + refresh niet blijven hangen.

Waarschijnlijk oorzaak (op basis van code + data):
1) Race condition in `ProductForm`: `selectedCategoryIds` kan door de init-effect teruggezet worden naar oude DB-waarden terwijl gebruiker al selecteert.
2) Guard `if (productId && categoriesInitialized)` kan sync overslaan (silent), waardoor alleen product zelf wordt opgeslagen.
3) `syncCategories` gebruikt een fragiele `.not('in', '(...)')` filterstring voor UUID’s; dit is foutgevoelig en lastig te valideren.
4) RLS op `product_categories` is niet in lijn met `products` (platform-admin pad ontbreekt), waardoor categorie-koppelingen voor sommige rollen niet weggeschreven kunnen worden.

Implementatieplan:

1. Frontend state-race oplossen (`src/pages/admin/ProductForm.tsx`)
- Voeg `hasCategoryInteraction` (state/ref) toe.
- Zet die op `true` zodra gebruiker categorieën wijzigt.
- Init-effect mag `selectedCategoryIds`/`primaryCategoryId` alleen hydrateren als gebruiker nog niets aangepast heeft.
- Verwijder de “skip sync” valkuil: sync altijd met een veilige bron:
  - als user al wijzigde: gebruik lokale selectie
  - anders: gebruik serverwaarden (zodat snelle save niets wist)
- Disable “Opslaan” en categorie-selector tijdens initiële category-hydration op edit, zodat we geen halve state submitten.

2. Sync-logica robuust maken (`src/hooks/useProductCategories.ts`)
- Vervang `.not('category_id', 'in', '(... )')` door deterministic diff-flow:
  - haal bestaande category_ids op voor product
  - bereken `toDelete` en `toUpsert`
  - delete met `.in('category_id', toDelete)` (array-based, veilig)
  - upsert gewenste rows met `onConflict: 'product_id,category_id'`
- Na write: korte verify-read (`select category_id`) en set-vergelijking met gewenste input.
- Bij mismatch: throw expliciete fout (“categorieën konden niet volledig opgeslagen worden”), zodat UI duidelijke feedback toont.

3. RLS consistent maken voor categorie-koppelingen (database migration)
- Update `product_categories` policies zodat ze hetzelfde toegangsmodel volgen als `products`:
  - tenant users met juiste rol voor eigen tenant
  - platform admins expliciet toegestaan
  - correcte `WITH CHECK` voor insert/update
- Dit voorkomt dat product-update wel lukt maar junction-update stil faalt voor bepaalde accounts.

4. UX feedback
- In `onSubmit` foutmelding specifieker maken voor categorie-sync (bv. “Product opgeslagen, maar categorieën niet — probeer opnieuw”).
- Succesmelding kan optioneel aantal gekoppelde categorieën tonen.

Validatie (acceptatiecriteria):
1) Product openen, 2-3 categorieën selecteren, opslaan, refresh: exact dezelfde selectie blijft staan.
2) Primair label blijft correct na refresh.
3) Categorie verwijderen en opnieuw opslaan: verwijderde categorie blijft weg.
4) Testen met tenant-admin én platform-admin account.
5) DB-check: `product_categories` bevat exact dezelfde set als UI-selectie na save.

Technische impact:
- Bestanden:
  - `src/pages/admin/ProductForm.tsx`
  - `src/hooks/useProductCategories.ts`
  - nieuwe migration voor `product_categories` RLS policies
- Geen breaking wijziging aan API contract of UI-structuur; wel betrouwbaardere save-flow.

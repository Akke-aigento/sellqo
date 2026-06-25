## Probleem
De geschatte kost toont `~0 credits` ook wanneer er duidelijk velden ontbreken (1 geselecteerd item × 3 talen × 5 velden zou in missing-mode > 0 moeten zijn).

## Root cause (twee bugs)

**Bug 1 — `missingByLangByField` wordt niet doorgegeven.**
In `TranslationHub.getAllEntities()` mappen we producten/categorieën uit `useProducts()` / `useCategories()` en mergen alleen `coverage`, `missing` en `missingByLang` uit `pendingEntities`. Het nieuwe `missingByLangByField` blijft achter → in `bulkCost` is `byField` altijd `undefined` → de fallback berekent met `missingByLang[lang]` die óók niet meegekomen is voor entities buiten `pendingEntities`.

**Bug 2 — `pendingEntities` is gecapt op 100.**
De queries `from('products').select(...).limit(100)` en hetzelfde voor categories. Voor de geselecteerde rij die buiten die 100 valt (sortering kan verschillen t.o.v. `useProducts`) is `pe === undefined` → `coverage: 0`, `missingByLang: {}`, `missingByLangByField: {}` → cost `0`.

## Fix

### `src/hooks/useTranslations.ts`
- In de `pending-translations` queryFn: verwijder `.limit(100)` op zowel `products` als `categories` (we filteren al op `tenant_id` + `is_active`; tellingen voor dekking moeten volledig zijn).

### `src/pages/admin/TranslationHub.tsx`
- In `getAllEntities()` (zowel product- als category-tak): voeg `missingByLangByField: pe?.missingByLangByField ?? {}` toe aan het returned object.
- In `bulkCost`-berekening (missing-mode): wanneer `byField?.[lang]` ontbreekt én de entity coverage 0 is én er géén translations bekend zijn, val terug op `bulkFields.length` (alle geselecteerde velden ontbreken) i.p.v. `0`. Concreet: als `missingByLang[lang]` undefined is, behandel het als `availableFields.length` zodat een onbekende entity niet stilletjes als "alles vertaald" geldt.

## Verificatie
- Selecteer 1 onvertaald product, 3 talen, alle 5 velden, mode `missing` → kost = `1 × 5 × 3 × perCreditCost` (bv. 15 credits).
- Wissel mode naar `all` → zelfde getal.
- Vink "Meta titel" en "Meta beschrijving" uit → kost zakt naar `1 × 3 × 3` = 9.
- Selecteer een product dat al 100% vertaald is → kost blijft 0 in `missing`-mode (correct).

## Buiten scope
- Refactor van de hele cost-engine of server-side preview-endpoint — overkill voor deze fix.

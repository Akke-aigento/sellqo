

# Categorieën met hiërarchie (boom) tonen bij productkoppeling

## Probleem
De categorieën-tabel ondersteunt al `parent_id` (hiërarchie) en duplicate namen (unique constraint is alleen op `tenant_id + slug`). Dus "T-shirts" onder "Mannen" en "T-shirts" onder "Vrouwen" is technisch al mogelijk — de slug moet alleen uniek zijn (bijv. `mannen-tshirts` vs `vrouwen-tshirts`).

**Maar**: de categorie-picker in het ProductForm toont categorieën als een platte lijst — alleen de naam, zonder ouder-context. Dus als je twee keer "T-shirts" hebt, weet je niet welke bij Mannen of Vrouwen hoort.

## Aanpak

### 1. Categorie-picker: boomstructuur tonen
**Bestand:** `src/pages/admin/ProductForm.tsx`

De huidige `categories.map()` in de Popover/Command vervangen door een hiërarchische weergave:
- Hoofdcategorieën (zonder parent) als groepskoppen tonen
- Subcategorieën ingesprongen eronder
- Naam weergeven als `Mannen › T-shirts` zodat het altijd duidelijk is welke het is, ook in de geselecteerde badges

```text
Selecteer categorieën...
┌─────────────────────────┐
│ 🔍 Zoek categorie...    │
├─────────────────────────┤
│ ▸ Mannen                │  ← hoofdcategorie (selecteerbaar)
│   ☐ T-shirts            │  ← subcategorie (ingesprongen)
│   ☐ Broeken             │
│ ▸ Vrouwen               │
│   ☐ T-shirts            │
│   ☐ Broeken             │
└─────────────────────────┘
```

### 2. Geselecteerde badges: pad tonen
In de badges onder de picker het volledige pad tonen: `Mannen › T-shirts` i.p.v. alleen `T-shirts`. Zo is altijd duidelijk welke categorie bedoeld is.

### 3. Categoriebeheer: slug-suggestie verbeteren
**Bestand:** `src/pages/admin/Categories.tsx` (of het formulier-component)

Bij het aanmaken van een subcategorie de slug automatisch prefixen met de ouder-slug, bijv. `vrouwen-tshirts`. Dit voorkomt slug-conflicten bij duplicaatcategorienamen.

## Wat er niet verandert
- Database — de structuur ondersteunt dit al (parent_id + unique op tenant+slug)
- Categoriebeheer zelf — drag & drop en boomweergave bestaan al
- Geen migratie nodig

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/pages/admin/ProductForm.tsx` | Categorie-picker: hiërarchisch renderen + pad in badges |
| `src/hooks/useCategories.ts` | Helper toevoegen: `getCategoryPath(id)` → "Mannen › T-shirts" |
| Categorie-aanmaak (formulier) | Slug auto-prefix met ouder-slug bij subcategorieën |


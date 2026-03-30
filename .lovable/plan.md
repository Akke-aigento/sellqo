

## Fix: Multi-Categorie Toewijzing in ProductForm

### Probleem
De `product_categories` junction-tabel (met `product_id`, `category_id`, `is_primary`, `sort_order`) bestaat in de database, maar het ProductForm gebruikt alleen het legacy `category_id` veld — een enkel select-dropdown. Meerdere categorieën toewijzen is dus niet mogelijk.

### Oplossing

**In `src/pages/admin/ProductForm.tsx`:**

1. **Schema aanpassen**: Voeg `category_ids: z.array(z.string()).default([])` toe naast het bestaande `category_id`
2. **Categorie-UI vervangen**: Vervang de enkele `Select` door een multi-select met checkboxen (Popover + Command patroon, zoals al gebruikt bij bundel-producten):
   - Klik opent een popover met doorzoekbare lijst van categorieën
   - Checkboxen per categorie — meerdere aanklikbaar
   - Geselecteerde categorieën als badges onder het veld
   - Eerste geselecteerde categorie = `is_primary: true`
3. **Bij laden (edit)**: Query `product_categories` voor het product en vul `category_ids` in
4. **Bij opslaan**: 
   - Schrijf naar `product_categories` junction-tabel (delete + insert, differential sync)
   - Zet `category_id` (legacy) op de primaire categorie voor backward compatibility
   - Eerste categorie in de lijst = primair

**In `src/hooks/useProducts.ts`:**

5. **Fetch**: Bij het laden van een enkel product, ook `product_categories` ophalen zodat het formulier de huidige categorieën kent

### Geen database wijzigingen
De `product_categories` tabel met `is_primary` en `sort_order` kolommen bestaat al. Geen migratie nodig.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/pages/admin/ProductForm.tsx` | Multi-category select UI + opslaan naar junction-tabel |
| `src/hooks/useProducts.ts` | Product-categories ophalen bij edit |


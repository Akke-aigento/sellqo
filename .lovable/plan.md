

## Fix: Bundel opslaan mislukt + Prijsveld verbergen voor bundels

### Root cause
De kolommen `bundle_pricing_model`, `bundle_discount_type`, `bundle_discount_value` bestaan **niet** in de `products` tabel in de database. De migratie (`20260327000000_add_product_bundle_items.sql`) is waarschijnlijk niet uitgevoerd. Daardoor geeft Supabase error `PGRST204: Could not find the 'bundle_discount_type' column`.

### Wat we doen

**1. Database migratie uitvoeren**
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_pricing_model text`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_discount_type text` met CHECK constraint
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_discount_value numeric`
- Hierdoor worden de bundelvelden daadwerkelijk opgeslagen

**2. Prijzen-kaart verbergen voor bundels**
- In `ProductForm.tsx`: de "Prijzen" `Card` (regels ~736-784) wrappen met `{!isBundle && (...)}` 
- Het reguliere `price` veld verdwijnt dan voor bundel-producten
- De gebruiker moet het prijsmodel instellen in de bundel-configuratie sectie (vaste prijs of dynamisch)

**3. Bij "Vaste bundelprijs" model: prijs invullen in bundel-sectie**
- Als `bundle_pricing_model === 'fixed'`: toon een prijsveld **binnen** de bundel-configuratie kaart
- Dit veld schrijft naar `form.price` zodat het product een verkoopprijs heeft
- Bij `dynamic`: prijs wordt berekend uit de som van individuele producten (kan op 0 blijven of auto-berekend worden bij opslaan)

### Bestanden

| Bestand | Wijziging |
|---|---|
| Nieuwe migratie | Bundle kolommen toevoegen aan products tabel |
| `src/pages/admin/ProductForm.tsx` | Prijzen-kaart verbergen voor bundels; prijsveld tonen in bundel-config bij "vaste prijs" model |


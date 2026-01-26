
# Plan: Uitgebreide Product Bulk Bewerking

## Huidige Situatie

De producten pagina heeft momenteel beperkte bulk acties:

```text
HUIDIGE BULK ACTIES
───────────────────
✅ Activeren (is_active: true)
✅ Deactiveren (is_active: false)
✅ Verwijderen

❌ Categorie wijzigen
❌ Prijs aanpassen (vast bedrag, percentage)
❌ Voorraad aanpassen
❌ BTW-tarief wijzigen
❌ Tags toevoegen/verwijderen
❌ Zichtbaarheid (online/winkel)
❌ Verzending vereist
❌ Featured status
❌ Social channels activeren
❌ Marketplace sync
```

## Oplossing: ProductBulkEditDialog

Een uitgebreid dialoogvenster met tabs voor verschillende bewerkingscategorieën:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bulk bewerking (24 producten geselecteerd)                           [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Basis]  [Prijzen]  [Voorraad]  [Zichtbaarheid]  [Kanalen]  [Tags]        │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  BASIS TAB                                                                  │
│  ─────────                                                                  │
│  ☐ Categorie wijzigen                                                      │
│     [Selecteer categorie ▾]                                                │
│                                                                             │
│  ☐ BTW-tarief wijzigen                                                     │
│     [Selecteer BTW-tarief ▾]                                               │
│                                                                             │
│  ☐ Product type wijzigen                                                   │
│     [Fysiek ▾]                                                             │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  PRIJZEN TAB                                                                │
│  ───────────                                                                │
│  ☐ Verkoopprijs aanpassen                                                  │
│     ○ Vast bedrag: [€___] toevoegen/aftrekken                              │
│     ○ Percentage: [___]% verhogen/verlagen                                 │
│     ○ Exacte prijs: [€___]                                                 │
│                                                                             │
│  ☐ Vergelijkingsprijs (doorstreepprijs)                                    │
│     ○ Verwijderen                                                          │
│     ○ Instellen op huidige prijs (voor kortingsactie)                      │
│     ○ Exacte prijs: [€___]                                                 │
│                                                                             │
│  ☐ Kostprijs aanpassen                                                     │
│     [€___]                                                                 │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  VOORRAAD TAB                                                               │
│  ────────────                                                               │
│  ☐ Voorraad aanpassen                                                      │
│     ○ Toevoegen: [___] stuks                                               │
│     ○ Aftrekken: [___] stuks                                               │
│     ○ Exact instellen: [___] stuks                                         │
│                                                                             │
│  ☐ Voorraad tracking                                                       │
│     ○ Inschakelen                                                          │
│     ○ Uitschakelen                                                         │
│                                                                             │
│  ☐ Backorder toestaan                                                      │
│     ○ Ja                                                                   │
│     ○ Nee                                                                  │
│                                                                             │
│  ☐ Lage voorraad drempel                                                   │
│     [___] stuks                                                            │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  ZICHTBAARHEID TAB                                                          │
│  ─────────────────                                                          │
│  ☐ Status                                                                  │
│     ○ Activeren                                                            │
│     ○ Deactiveren                                                          │
│                                                                             │
│  ☐ Webshop zichtbaarheid                                                   │
│     ○ Online tonen                                                         │
│     ○ Alleen winkel (POS)                                                  │
│                                                                             │
│  ☐ Featured/Uitgelicht                                                     │
│     ○ Uitlichten                                                           │
│     ○ Niet uitlichten                                                      │
│                                                                             │
│  ☐ Verzending vereist                                                      │
│     ○ Ja                                                                   │
│     ○ Nee                                                                  │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  KANALEN TAB                                                                │
│  ───────────                                                                │
│  ☐ Social Commerce kanalen                                                 │
│     ☑ Facebook Shop                                                        │
│     ☑ Instagram Shop                                                       │
│     ☐ Google Shopping                                                      │
│     ☐ Pinterest                                                            │
│                                                                             │
│  ☐ Marketplace sync                                                        │
│     ☑ Bol.com                                                              │
│     ☐ Amazon                                                               │
│                                                                             │
│  [Sync nu starten]                                                         │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  TAGS TAB                                                                   │
│  ─────────                                                                  │
│  ☐ Tags toevoegen                                                          │
│     [+ Tag toevoegen]                                                      │
│     sale  nieuw  bestseller                                                │
│                                                                             │
│  ☐ Tags verwijderen                                                        │
│     [Selecteer te verwijderen tags]                                        │
│                                                                             │
│  ☐ Alle tags vervangen door                                                │
│     [+ Tags invoeren]                                                      │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ⚠️ Let op: Deze wijzigingen worden toegepast op 24 producten              │
│                                                                             │
│                              [Annuleren]  [Wijzigingen toepassen]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technische Implementatie

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/components/admin/products/ProductBulkEditDialog.tsx` | Hoofddialoog met tabs |
| `src/components/admin/products/bulk/BulkBasicTab.tsx` | Categorie, BTW, product type |
| `src/components/admin/products/bulk/BulkPricingTab.tsx` | Prijsaanpassingen |
| `src/components/admin/products/bulk/BulkStockTab.tsx` | Voorraad beheer |
| `src/components/admin/products/bulk/BulkVisibilityTab.tsx` | Status en zichtbaarheid |
| `src/components/admin/products/bulk/BulkChannelsTab.tsx` | Social & marketplace kanalen |
| `src/components/admin/products/bulk/BulkTagsTab.tsx` | Tags beheer |

### Updated Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/Products.tsx` | Bulk edit knop en dialog state toevoegen |
| `src/hooks/useProducts.ts` | Extra bulk mutations voor complexe operaties |

### Bulk Actions Bar (Uitgebreid)

De huidige balk wordt uitgebreid met een "Bewerken" knop:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  24 geselecteerd                                                            │
│                                                                             │
│  [Bewerken]  [Activeren]  [Deactiveren]  [Verwijderen]                     │
│      ↑                                                                      │
│  Opent ProductBulkEditDialog                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bulk Edit State Type

```typescript
interface BulkEditState {
  // Basis
  category_id?: string | null;
  vat_rate_id?: string | null;
  product_type?: ProductType;
  
  // Prijzen
  price_adjustment?: {
    type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact';
    value: number;
  };
  compare_at_price_action?: 'remove' | 'set_current' | 'exact';
  compare_at_price_value?: number;
  cost_price?: number | null;
  
  // Voorraad
  stock_adjustment?: {
    type: 'add' | 'subtract' | 'exact';
    value: number;
  };
  track_inventory?: boolean;
  allow_backorder?: boolean;
  low_stock_threshold?: number;
  
  // Zichtbaarheid
  is_active?: boolean;
  hide_from_storefront?: boolean;
  is_featured?: boolean;
  requires_shipping?: boolean;
  
  // Tags
  tags_to_add?: string[];
  tags_to_remove?: string[];
  tags_replace_all?: string[];
  
  // Kanalen
  social_channels?: Record<string, boolean>;
  sync_marketplaces?: string[];
}
```

### Prijsaanpassing Logica

Voor prijs- en voorraadaanpassingen die per product berekend moeten worden, is een speciale edge function of RPC nodig:

```sql
-- Database function voor bulk prijs aanpassing
CREATE OR REPLACE FUNCTION bulk_adjust_prices(
  p_product_ids UUID[],
  p_adjustment_type TEXT,  -- 'add', 'subtract', 'percentage_up', 'percentage_down', 'exact'
  p_adjustment_value DECIMAL
) RETURNS void AS $$
BEGIN
  IF p_adjustment_type = 'add' THEN
    UPDATE products SET price = price + p_adjustment_value WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'subtract' THEN
    UPDATE products SET price = GREATEST(0, price - p_adjustment_value) WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'percentage_up' THEN
    UPDATE products SET price = price * (1 + p_adjustment_value / 100) WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'percentage_down' THEN
    UPDATE products SET price = price * (1 - p_adjustment_value / 100) WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'exact' THEN
    UPDATE products SET price = p_adjustment_value WHERE id = ANY(p_product_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Voorraad Aanpassing Logica

```sql
-- Database function voor bulk voorraad aanpassing
CREATE OR REPLACE FUNCTION bulk_adjust_stock(
  p_product_ids UUID[],
  p_adjustment_type TEXT,  -- 'add', 'subtract', 'exact'
  p_adjustment_value INTEGER
) RETURNS void AS $$
BEGIN
  IF p_adjustment_type = 'add' THEN
    UPDATE products SET stock = stock + p_adjustment_value WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'subtract' THEN
    UPDATE products SET stock = GREATEST(0, stock - p_adjustment_value) WHERE id = ANY(p_product_ids);
  ELSIF p_adjustment_type = 'exact' THEN
    UPDATE products SET stock = p_adjustment_value WHERE id = ANY(p_product_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Tags Merge Logica

```sql
-- Database function voor tags beheer
CREATE OR REPLACE FUNCTION bulk_update_tags(
  p_product_ids UUID[],
  p_tags_to_add TEXT[],
  p_tags_to_remove TEXT[],
  p_replace_all BOOLEAN DEFAULT false,
  p_replacement_tags TEXT[] DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  IF p_replace_all THEN
    UPDATE products SET tags = p_replacement_tags WHERE id = ANY(p_product_ids);
  ELSE
    -- Add tags
    IF array_length(p_tags_to_add, 1) > 0 THEN
      UPDATE products 
      SET tags = array(SELECT DISTINCT unnest(tags || p_tags_to_add))
      WHERE id = ANY(p_product_ids);
    END IF;
    
    -- Remove tags
    IF array_length(p_tags_to_remove, 1) > 0 THEN
      UPDATE products 
      SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest(p_tags_to_remove))
      WHERE id = ANY(p_product_ids);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Implementatie Volgorde

### Fase 1: Database & Basis UI
1. Database migratie met bulk functies (prijzen, voorraad, tags)
2. `ProductBulkEditDialog.tsx` - Hoofdcomponent met tabs structuur
3. `BulkBasicTab.tsx` - Categorie, BTW-tarief, product type

### Fase 2: Prijzen & Voorraad
4. `BulkPricingTab.tsx` - Prijs aanpassingen met verschillende modi
5. `BulkStockTab.tsx` - Voorraad beheer
6. Hook updates in `useProducts.ts` voor nieuwe mutations

### Fase 3: Zichtbaarheid & Tags
7. `BulkVisibilityTab.tsx` - Status, zichtbaarheid, featured
8. `BulkTagsTab.tsx` - Tags toevoegen/verwijderen/vervangen

### Fase 4: Kanalen & Integratie
9. `BulkChannelsTab.tsx` - Social commerce en marketplace sync
10. Products.tsx integratie - Bulk edit knop en dialog state

## Functie Overzicht

| Functie | Tab | Beschrijving |
|---------|-----|--------------|
| Categorie wijzigen | Basis | Verplaats naar andere categorie |
| BTW-tarief | Basis | Wijzig BTW-tarief voor alle producten |
| Product type | Basis | Wijzig naar fysiek/digitaal/dienst |
| Prijs verhogen/verlagen | Prijzen | Vast bedrag of percentage |
| Doorstreepprijs | Prijzen | Instellen/verwijderen voor acties |
| Kostprijs | Prijzen | Marge berekening |
| Voorraad +/- | Voorraad | Snel bijwerken |
| Tracking aan/uit | Voorraad | Voor niet-fysieke producten |
| Backorder | Voorraad | Wel/niet toestaan |
| Drempelwaarde | Voorraad | Low stock alerts |
| Activeren/Deactiveren | Zichtbaarheid | Online/offline |
| Webshop/POS | Zichtbaarheid | Waar te tonen |
| Featured | Zichtbaarheid | Uitlichten op homepage |
| Verzending | Zichtbaarheid | Physical shipping |
| Tags toevoegen | Tags | Meerdere tegelijk |
| Tags verwijderen | Tags | Selectief verwijderen |
| Social channels | Kanalen | FB/IG/Google/Pinterest |
| Marketplace sync | Kanalen | Bol.com/Amazon sync starten |

## Resultaat

Na implementatie heeft de merchant een krachtige bulk editor waarmee:
- Honderden producten tegelijk kunnen worden bijgewerkt
- Kortingsacties snel kunnen worden opgezet (prijzen + doorstreepprijzen)
- Voorraad na levering snel kan worden bijgewerkt
- Producten naar nieuwe kanalen kunnen worden gepusht
- Tags voor filtering/marketing kunnen worden beheerd

Dit is vergelijkbaar met wat Shopify, WooCommerce en vergelijkbare platforms bieden voor professioneel productbeheer.

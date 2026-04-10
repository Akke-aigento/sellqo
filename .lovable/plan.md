

## Fix: Voorraad berekenen op basis van varianten

### Probleem
De admin productlijst en productformulier tonen altijd `product.stock` — het veld op productniveau. Maar zodra een product varianten heeft, wordt de voorraad per variant beheerd. Het product-level stock veld is dan misleidend en niet representatief.

Dit speelt op meerdere plekken:
- **Products.tsx** (productlijst): `getStockBadge()` toont alleen `product.stock`
- **Products.tsx** (filters): stock-filters gebruiken `product.stock`
- **Storefront API**: berekent `in_stock` al correct op variant-niveau ✅

### Oplossing

#### 1. `useProducts.ts` — Varianten meefetchen
De products query uitbreiden om ook varianten op te halen:
```
product_variants(id, stock, track_inventory, is_active)
```

#### 2. `Products.tsx` — `getStockBadge()` slim maken
- Als product varianten heeft → tel de totale stock op van alle actieve varianten
- Als geen varianten → gebruik `product.stock` zoals nu
- Toon bijv. "15 stuks (3 varianten)" bij varianten

#### 3. `Products.tsx` — Stock filters aanpassen
- Dezelfde logica: bij varianten de som van variant-stock gebruiken voor filtering

#### 4. `ProductForm.tsx` — Stock veld verbergen/readonly bij varianten
- Als het product varianten heeft, het algemene stock-veld disablen of verbergen met een melding "Voorraad wordt per variant beheerd"

### Bestanden
| Bestand | Wat |
|---------|-----|
| `src/hooks/useProducts.ts` | Varianten meefetchen in query |
| `src/pages/admin/Products.tsx` | Stock badge + filters variant-aware maken |
| `src/pages/admin/ProductForm.tsx` | Stock veld verbergen bij varianten |




# Hoofdproduct voorraad blokkeren bij varianten

## Probleem
Wanneer een product varianten heeft, zou voorraad alleen op variantniveau beheerd mogen worden. Het individuele bewerkscherm (ProductForm) handelt dit al correct af — daar verschijnt een melding "Voorraad wordt per variant beheerd". Maar in de **Grid View** is de stock-cel op de productrij nog steeds bewerkbaar, wat tot verwarring leidt.

## Aanpak

### 1. Grid View — stock-cel read-only maken bij varianten
**Bestand:** `src/components/admin/products/grid/ProductGridView.tsx`

In de `renderCell` functie (of bij de cel-click handler): wanneer `col.field === 'stock'` en het product actieve varianten heeft, de cel niet-bewerkbaar maken en in plaats daarvan de totale variantvoorraad tonen met een klein label (bijv. "12 (3 var.)").

De `handleCellClick` handler moet een klik op de stock-cel negeren als het product varianten heeft.

### 2. Grid View — visuele indicator
De stock-cel voor producten met varianten krijgt een andere styling (bijv. `text-muted-foreground italic`) om duidelijk te maken dat het een berekende waarde is, niet bewerkbaar.

### 3. Bulk stock-aanpassing — producten met varianten overslaan
**Bestand:** `src/pages/admin/Products.tsx`

Bij de bulk stock adjustment: producten met actieve varianten uitsluiten (of een waarschuwing tonen). Dit voorkomt dat de bulk-actie de product-level stock aanpast terwijl de echte voorraad op variantniveau zit.

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/components/admin/products/grid/ProductGridView.tsx` | Stock-cel niet-bewerkbaar + totaal tonen bij varianten |
| `src/pages/admin/Products.tsx` | Bulk stock: producten met varianten overslaan/waarschuwen |

## Wat er niet verandert
- ProductForm (al correct geïmplementeerd)
- Variant stock editing (blijft werken)
- Geen database-wijzigingen


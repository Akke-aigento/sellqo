

# Voorraad-tracking doorgeven aan varianten

## Probleem
Wanneer op productniveau `track_inventory` uit staat (bijv. bij diensten of digitale producten), worden de variantvoorraadvelden nog steeds getoond en bewerkbaar. De varianten hebben een eigen `track_inventory` kolom in de database, maar die wordt nergens in de UI aangestuurd. Dit is verwarrend en kan tot inconsistente data leiden.

## Aanpak

### 1. ProductVariantsTab: parent track_inventory doorgeven
**Bestand:** `src/pages/admin/ProductForm.tsx`
- De huidige `track_inventory` waarde uit het formulier meegeven als prop aan `ProductVariantsTab`.

### 2. ProductVariantsTab: voorraadvelden verbergen/disablen
**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`
- Nieuwe prop `trackInventory: boolean` accepteren.
- Wanneer `trackInventory === false`:
  - In de **card-layout**: de `InlineStockStepper` en het voorraadveld in de edit-modus verbergen, en een subtiele tekst tonen ("Voorraad wordt niet bijgehouden").
  - In de **tabel-layout**: de stock-kolom verbergen of "–" tonen.
  - Bij het **aanmaken/syncen** van varianten: `track_inventory: false` meegeven zodat de database consistent is.

### 3. Sync: bij wijziging track_inventory op product, varianten updaten
**Bestand:** `src/pages/admin/ProductForm.tsx`
- Bij opslaan van het product: als `track_inventory` gewijzigd is, ook alle bijbehorende varianten updaten met dezelfde waarde (simpele bulk-update via Supabase).

## Bestanden
| Bestand | Actie |
|---------|-------|
| `src/pages/admin/ProductForm.tsx` | `trackInventory` prop doorgeven + sync naar varianten bij opslaan |
| `src/components/admin/products/ProductVariantsTab.tsx` | Prop accepteren, voorraadvelden verbergen als tracking uit staat |


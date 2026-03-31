

## Fix: Push Bol Campaign — verkeerde kolomnaam

### Root cause
De edge function `push-bol-campaign` zoekt naar kolom `ean` in de `products` tabel, maar die kolom bestaat niet. De EAN-nummers staan in de kolom **`barcode`** (en optioneel `bol_ean`).

Hierdoor vindt de functie geen EANs en geeft fout: *"Geen producten met EAN gevonden"*.

### Fix

**Bestand**: `supabase/functions/push-bol-campaign/index.ts` (regel ~175-185)

Wijzig de product-query van:
```ts
.select("id, ean, name")
```
naar:
```ts
.select("id, barcode, bol_ean, name")
```

En de EAN-extractie van:
```ts
eans = products.map(p => p.ean).filter(...)
```
naar:
```ts
eans = products.map(p => p.bol_ean || p.barcode).filter(...)
```

Dit gebruikt `bol_ean` als die gevuld is (specifiek Bol EAN), anders valt het terug op `barcode`.

### Bijkomend issue
Product "VanXcel 1000W Powerstation" heeft een **fout barcode** met een leidende quote: `'5430004790211`. Dit moet handmatig gecorrigeerd worden in het productbeheer (verwijder de `'`).

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/push-bol-campaign/index.ts` | `ean` → `barcode`/`bol_ean` in product query en mapping |




## Fix: Duidelijke "uitverkocht" melding in plaats van generieke fout

### Probleem
Als een product uitverkocht is en een klant de hoeveelheid probeert te verhogen, geeft de Storefront API een generieke `"Insufficient stock"` error. De custom frontend (mancini-milano) vangt dit op als "Could not update quantity. Please try again." — niet informatief voor de klant.

Daarnaast toont de cart drawer op de custom frontend "Shipping: Free" terwijl er verzendkosten zijn (dat is al gefixt in de vorige update voor de ingebouwde storefront, maar de custom frontend leest direct de API).

### Oplossing

#### 1. Storefront API — Betere foutmeldingen (`supabase/functions/storefront-api/index.ts`)

Vervang de generieke `throw new Error('Insufficient stock')` door gestructureerde foutresponses met:
- Een duidelijke error code (`INSUFFICIENT_STOCK`)
- Een klantvriendelijke message in het Nederlands
- De beschikbare voorraad meegeven zodat de frontend dit kan tonen

**Bij `cartAddItem` (regel ~1245, ~1255):**
```typescript
// Was: throw new Error('Insufficient stock');
// Wordt:
throw new Error(JSON.stringify({
  code: 'INSUFFICIENT_STOCK',
  message: `Dit product is uitverkocht`,
  available_stock: stockSource.stock
}));
```

**Bij `cartUpdateItem` (regel ~1280):**
```typescript
throw new Error(JSON.stringify({
  code: 'INSUFFICIENT_STOCK', 
  message: `Slechts ${product.stock} beschikbaar`,
  available_stock: product.stock
}));
```

Daarnaast: de `cartUpdateItem` functie checkt nu alleen product-level stock, niet variant-level. Dit moet ook gefixt worden om variant stock correct te valideren.

#### 2. Storefront API — Variant stock check in `cartUpdateItem`

De huidige `cartUpdateItem` haalt alleen `products.stock` op maar negeert variant stock. Fix: ook `variant_id` ophalen uit het cart item en variant stock checken als die er is.

### Wat er verandert
| Wat | Was | Wordt |
|-----|-----|-------|
| Error bij uitverkocht | `"Insufficient stock"` | `{"code":"INSUFFICIENT_STOCK","message":"Dit product is uitverkocht","available_stock":0}` |
| Variant stock check in update | Alleen product-level | Product + variant level |

### Impact
- De custom frontend kan nu de `code` parsen en een nette melding tonen
- Zelfs zonder frontend-aanpassing is de `message` al in het Nederlands en begrijpelijker
- De edge function wordt automatisch gedeployd

Eén bestand: `supabase/functions/storefront-api/index.ts`


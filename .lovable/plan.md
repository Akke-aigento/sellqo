

## Bug: Bol.com voorraadsync vindt Offer ID niet

### Probleem

De edge function `sync-bol-inventory` zoekt de Bol.com Offer ID uitsluitend in `marketplace_mappings.bol_com.offerId`. Maar bij VanXcel staat de Offer ID (`193210736985`) direct op het product in de kolom `bol_offer_id`, terwijl `marketplace_mappings` leeg is (`{}`).

Het resultaat:
1. `bolMapping` = undefined (want `marketplace_mappings` is `{}`)
2. Code probeert EAN-lookup via Bol API → vindt niets → **skipt het product**
3. `products_synced: 0`

```text
Product in database:
  bol_offer_id: "193210736985"     ← BESTAAT
  marketplace_mappings: {}          ← LEEG
  
Code checkt:
  mappings.bol_com?.offerId         ← undefined → lookup → fail → skip
```

### Oplossing

**Bestand: `supabase/functions/sync-bol-inventory/index.ts`**

Voeg een fallback toe: als `marketplace_mappings.bol_com.offerId` niet bestaat, gebruik `product.bol_offer_id`. Dit is een 2-regel wijziging:

Na het ophalen van `bolMapping` (regel 203), controleer of er geen `offerId` is maar wél een `product.bol_offer_id`:

```typescript
// Fallback: use bol_offer_id column if marketplace_mappings is empty
if (!bolMapping?.offerId && product.bol_offer_id) {
  bolMapping = {
    offerId: product.bol_offer_id,
    lastSync: product.last_inventory_sync || undefined,
    autoLinked: false
  };
  mappings = { ...mappings, bol_com: bolMapping };
}
```

Dit wordt geplaatst **vóór** de EAN-lookup (regel 206), zodat de duurdere API-call alleen plaatsvindt als er écht geen Offer ID bekend is.

| Bestand | Wijziging |
|---|---|
| `supabase/functions/sync-bol-inventory/index.ts` | Fallback naar `product.bol_offer_id` vóór EAN-lookup |


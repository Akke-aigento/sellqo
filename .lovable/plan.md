

# Plan: Auto-koppel Bol.com Offer IDs via EAN

## Overzicht

Wanneer een product een `bol_ean` heeft maar geen `offerId` in `marketplace_mappings`, kan de voorraadsync niet werken. Dit plan implementeert een functie om automatisch Offer IDs op te halen via de Bol.com API endpoint `/retailer/products/{ean}/offers`.

## Hoe Het Werkt

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Product met EAN maar zonder Offer ID                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  📦 iPhone 15 Pro Max                                                 │ │
│  │     EAN: 8719274850014  ✓                                             │ │
│  │     Offer ID: ❌ Niet gekoppeld                                        │ │
│  │                                                                       │ │
│  │     [🔍 Zoek Offer ID via EAN]                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                              │
│  API Call: GET /retailer/products/8719274850014/offers                     │
│                              ↓                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  ✅ Offer ID gevonden: 908b6d06-2067-4klf-8490-c21d0c233e61           │ │
│  │                                                                       │ │
│  │  Automatisch opgeslagen in marketplace_mappings                       │ │
│  │  → Voorraadsync werkt nu automatisch!                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Kernfunctionaliteiten

### 1. Edge Function: `lookup-bol-offer-id`
Nieuwe edge function die:
- EAN ontvangt als input
- Bol.com API aanroept: `GET /retailer/products/{ean}/offers`
- Filtert op eigen retailer ID om alleen JOUW offers te vinden
- Offer ID teruggeeft

### 2. Auto-Lookup bij Inventory Sync
De bestaande `sync-bol-inventory` function uitbreiden:
- Als product EAN heeft maar geen Offer ID → automatisch opzoeken
- Offer ID opslaan in `marketplace_mappings`
- Doorgaan met voorraadsync

### 3. Handmatige Lookup Knop
In `ProductMarketplaceTab.tsx`:
- Knop "Offer ID ophalen" wanneer EAN wel ingevuld is maar Offer ID ontbreekt
- Loading state tijdens ophalen
- Feedback of het gelukt is

### 4. Bulk Auto-Koppel
In marketplace instellingen:
- Knop om alle producten met EAN maar zonder Offer ID te koppelen
- Progress indicator
- Overzicht van resultaten

## Technische Implementatie

### Nieuwe Edge Function

```typescript
// supabase/functions/lookup-bol-offer-id/index.ts

// Input: { ean: string, tenant_id: string, connection_id: string, product_id?: string }
// 
// Flow:
// 1. Haal Bol.com credentials op via connection_id
// 2. Vraag OAuth token aan
// 3. Call GET /retailer/products/{ean}/offers
// 4. Filter offers op "retailerId" === jouw seller ID
// 5. Als gevonden: sla op in product.marketplace_mappings.bol_com.offerId
// 6. Return success/failure met offerId

const bolResponse = await fetch(
  `${BOL_API_BASE}/products/${ean}/offers?country-code=NL`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.retailer.v10+json'
    }
  }
);

// Response bevat:
// {
//   "offers": [{
//     "offerId": "908b6d06-2067-4klf-8490-c21d0c233e61",
//     "retailerId": "8748934",  // ← Vergelijk met jouw retailer ID
//     "countryCode": "NL",
//     ...
//   }]
// }
```

### Aangepaste Inventory Sync

```typescript
// sync-bol-inventory/index.ts - uitbreiding

for (const product of products || []) {
  const mappings = (product.marketplace_mappings || {}) as ProductMarketplaceMappings;
  const bolMapping = mappings.bol_com;
  
  // NIEUW: Als EAN aanwezig maar geen Offer ID, probeer op te halen
  if (!bolMapping?.offerId && product.bol_ean) {
    console.log(`Product ${product.id} has EAN but no Offer ID, looking up...`);
    
    const offerId = await lookupOfferIdByEan(
      accessToken, 
      product.bol_ean, 
      connection.credentials.sellerId
    );
    
    if (offerId) {
      // Opslaan in database
      const updatedMappings = {
        ...mappings,
        bol_com: {
          offerId,
          lastSync: new Date().toISOString(),
          autoLinked: true  // Markeer als automatisch gekoppeld
        }
      };
      
      await supabase
        .from('products')
        .update({ marketplace_mappings: updatedMappings })
        .eq('id', product.id);
        
      // Ga door met sync
      bolMapping.offerId = offerId;
    } else {
      console.log(`No matching offer found for EAN ${product.bol_ean}`);
      continue;
    }
  }
  
  // Bestaande sync logica...
}
```

### UI Component Updates

**ProductMarketplaceTab.tsx**:
```typescript
// Nieuwe state
const [isLookingUpOfferId, setIsLookingUpOfferId] = useState(false);

// Nieuwe functie
const handleLookupOfferId = async () => {
  if (!bolEan || !bolConnection?.id) return;
  
  setIsLookingUpOfferId(true);
  try {
    const { data, error } = await supabase.functions.invoke('lookup-bol-offer-id', {
      body: {
        ean: bolEan,
        tenant_id: product.tenant_id,
        connection_id: bolConnection.id,
        product_id: product.id
      }
    });
    
    if (error) throw error;
    
    if (data.offerId) {
      toast.success(`Offer ID gevonden en opgeslagen: ${data.offerId.slice(0, 8)}...`);
      onRefresh?.();
    } else {
      toast.error('Geen offer gevonden voor deze EAN. Zorg dat het product al op Bol.com staat.');
    }
  } catch (error) {
    toast.error('Kon Offer ID niet ophalen');
  } finally {
    setIsLookingUpOfferId(false);
  }
};

// In JSX - toon knop als EAN aanwezig maar geen offerId
{bolEan && !mappings.bol_com?.offerId && (
  <Alert className="mt-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="flex items-center justify-between">
      <span>
        EAN is ingevuld maar Offer ID ontbreekt. 
        Voorraadsync werkt pas na koppeling.
      </span>
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleLookupOfferId}
        disabled={isLookingUpOfferId}
      >
        {isLookingUpOfferId ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Zoeken...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Offer ID ophalen
          </>
        )}
      </Button>
    </AlertDescription>
  </Alert>
)}
```

## Visueel Ontwerp

### Product Marketplace Tab

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bol.com                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EAN Code                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 8719274850014                                                    ✓   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ ⚠️ Waarschuwing ────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  EAN is ingevuld maar Offer ID ontbreekt.                            │  │
│  │  Voorraadsync werkt pas na koppeling.                                │  │
│  │                                                          [🔍 Offer ID ophalen]  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Offer ID                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ (Niet gekoppeld - wordt automatisch opgehaald)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Na Succesvolle Lookup

```text
│  Offer ID                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 908b6d06-2067-4klf-8490-c21d0c233e61                        🔗 Auto  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ✅ Automatisch gekoppeld via EAN lookup                                    │
```

## Bulk Auto-Koppel (Optioneel)

In marketplace connection instellingen:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Productkoppelingen                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Status:                                                                 │
│  • 45 producten met EAN                                                     │
│  • 32 gekoppeld aan Bol.com offers                                          │
│  • 13 wachten op koppeling                                                  │
│                                                                             │
│                        [🔍 Auto-koppel alle 13 producten]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `supabase/functions/lookup-bol-offer-id/index.ts` | Nieuw | Edge function voor EAN → Offer ID lookup |
| `supabase/functions/sync-bol-inventory/index.ts` | Update | Auto-lookup integratie voor ontbrekende Offer IDs |
| `src/components/admin/marketplace/ProductMarketplaceTab.tsx` | Update | Lookup knop en status weergave |
| `src/types/product.ts` | Update | `autoLinked` flag toevoegen aan mapping type |

## API Flow

```text
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  lookup-bol-offer-id │────▶│  Bol.com API    │
│             │     │  Edge Function       │     │                 │
│  Product    │     │                      │     │  GET /products/ │
│  Detail     │     │  1. Get credentials  │     │  {ean}/offers   │
│  Page       │     │  2. Get OAuth token  │     │                 │
│             │     │  3. Call Bol API     │     │  Returns:       │
│             │◀────│  4. Filter by seller │◀────│  offers[]       │
│             │     │  5. Save to DB       │     │                 │
│  ✅ Offer   │     │  6. Return result    │     │                 │
│  ID saved   │     │                      │     │                 │
└─────────────┘     └──────────────────────┘     └─────────────────┘
```

## Resultaat

Na implementatie:

1. **Automatische koppeling** - Inventory sync probeert automatisch Offer IDs op te halen
2. **Handmatige optie** - Knop om direct een Offer ID op te zoeken voor een product
3. **Visuele feedback** - Duidelijke indicatie of koppeling geslaagd is
4. **Geen handmatig werk** - Merchants hoeven niet meer zelf Offer IDs op te zoeken in Bol.com

Dit maakt het veel eenvoudiger om orders en voorraad te synchroniseren zonder volledige product export naar Bol.com!



# Plan: Historische Orders Importeren via Shipments API

## Probleemanalyse

De huidige `sync-bol-orders` functie gebruikt de **Orders API** (`/retailer/orders`). Uit de officiële Bol.com documentatie blijkt echter:

| API Endpoint | Data beschikbaarheid |
|--------------|---------------------|
| `/orders` (status=ALL) | Verzonden orders slechts **48 uur** na verzending |
| `/shipments` | Shipments van de laatste **3 maanden** |
| `/shipments/{id}` | Details tot **2 jaar** terug |

Dit verklaart waarom slechts 1 order (waarschijnlijk een recente/open order) werd gevonden, terwijl je ~100 historische orders verwacht.

## Oplossing

We moeten een **Shipments-based import** implementeren naast de bestaande Orders sync:

### Stap 1: Nieuwe Edge Function voor Shipment Import

Maak `supabase/functions/import-bol-shipments/index.ts` aan:
- Fetch alle shipments via `GET /retailer/shipments` (max 3 maanden)
- Per shipment: haal details op via `GET /shipments/{shipmentId}` (bevat order info)
- Importeer als order in SellQo database

### Stap 2: API Implementatie

**Shipments endpoint parameters:**
```
GET /retailer/shipments
  ?fulfilment-method=FBR|FBB
  &page=1
```

**Per shipment detail ophalen:**
```
GET /retailer/shipments/{shipmentId}
```

De shipment response bevat:
- `orderId` - link naar de originele order
- `shipmentItems[]` - producten met EAN, prijs, quantity
- `customerDetails` - klantgegevens
- `shipmentDate` - verzenddatum

### Stap 3: Order Creatie Logica

Voor elke shipment:
1. Check of order al bestaat via `marketplace_order_id`
2. Zo niet: creëer order met status `shipped`
3. Voeg order items toe op basis van `shipmentItems`

### Stap 4: UI Integratie

Update `MarketplaceDetail.tsx`:
- Voeg "Import Historisch via Shipments" knop toe
- Roept de nieuwe edge function aan
- Toont resultaat met aantal geïmporteerde orders

### Stap 5: Beperkingen communiceren

De Shipments API is beperkt tot **3 maanden**. Voor oudere orders:
- Optioneel: Implementeer export vanuit Bol.com verkooprekening (handmatige CSV import)
- Documenteer deze beperking in de UI

## Bestanden te maken/wijzigen

| Bestand | Actie |
|---------|-------|
| `supabase/functions/import-bol-shipments/index.ts` | **Nieuw** - Shipments import functie |
| `supabase/config.toml` | Registreer nieuwe function |
| `src/pages/admin/MarketplaceDetail.tsx` | Voeg "Import via Shipments" knop toe |

## Technische Details

### Shipments API Response Structuur
```json
{
  "shipments": [
    {
      "shipmentId": "12345",
      "orderId": "67890",
      "shipmentDate": "2025-12-15",
      "shipmentItems": [
        {
          "orderItemId": "111",
          "ean": "8712626055143",
          "title": "Product Title",
          "quantity": 1,
          "unitPrice": 19.99
        }
      ],
      "customerDetails": {
        "firstName": "Hans",
        "surname": "de Groot",
        "streetName": "Hoofdstraat",
        "houseNumber": "1",
        "zipCode": "1234AB",
        "city": "Amsterdam"
      }
    }
  ]
}
```

### Import Logica
```text
┌─────────────────────────────────────┐
│   GET /shipments?page=1             │
│   (max 50 per pagina, 3 maanden)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Voor elke shipment:               │
│   - Check of orderId al bestaat     │
│   - Zo niet: GET /shipments/{id}    │
│   - Creëer order met status=shipped │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Resultaat:                        │
│   - X orders geïmporteerd           │
│   - Y al bestaand (overgeslagen)    │
└─────────────────────────────────────┘
```

## Verwachte Resultaat

Na implementatie:
- Klik op "Import Historisch via Shipments" 
- Alle verzonden orders van de laatste 3 maanden worden geïmporteerd
- Orders ouder dan 3 maanden zijn helaas niet beschikbaar via de API

## Belangrijke Kanttekening

De Bol.com API beperkt historische data tot 3 maanden voor shipments en 48 uur voor verzonden orders. Voor de volledige 2 jaar aan historische orders zou je:
1. Regelmatig moeten syncen (minimaal elke paar dagen) om orders te vangen voordat ze uit de API verdwijnen
2. Handmatig een CSV export uit Bol.com Seller Central moeten uploaden (toekomstige feature)

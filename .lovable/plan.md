
# Fix: VVB Label & Accept Order - Drie Bugs Gevonden

## Bug 1: Verkeerde parsing van delivery-options response

De Bol.com API retourneert een **platte structuur** per deliveryOption:

```text
{
  "deliveryOptions": [
    {
      "shippingLabelOfferId": "c2a0f857-...",
      "transporterCode": "BPOST_BE",
      "labelType": "PARCEL",
      "labelPrice": { "totalPrice": 5.9 }
    }
  ]
}
```

Maar de huidige code zoekt naar een **geneste** `shippingLabelOffers` array binnen elke optie (die niet bestaat). Resultaat: `allOffers` is altijd leeg, dus "No shipping label offers available".

**Fix**: Elke deliveryOption IS direct een offer. Geen nesting.

## Bug 2: Verkeerd endpoint voor label creatie (Stap 2)

De code gebruikt `/retailer/transporter-labels` (regel 223), maar de Bol.com v10 API vereist `/retailer/shipping-labels` voor het aanmaken van labels. Dit verklaart de 403 Forbidden error -- het endpoint bestaat niet of heeft andere permissies.

**Fix**: Wijzig naar `/retailer/shipping-labels`.

## Bug 3: Inconsistente token-functie

De `create-bol-vvb-label` functie mist de `Content-Type: application/x-www-form-urlencoded` header bij het ophalen van het OAuth token en plaatst `grant_type` in de URL in plaats van de body. Hoewel dit soms werkt, is het niet conform de OAuth2 spec en kan het intermittent falen.

**Fix**: Token-functie overnemen van `sync-bol-orders` (die bewezen werkt).

## Oplossing

### Bestand: `supabase/functions/create-bol-vvb-label/index.ts`

| Locatie | Wijziging |
|---------|-----------|
| Regel 43-59 | Token-functie vervangen door de versie uit sync-bol-orders (met Content-Type header en grant_type in body) |
| Regel 190-208 | Parsing logica vereenvoudigen: elke deliveryOption is direct een offer, geen genest `shippingLabelOffers` |
| Regel 222-223 | Endpoint wijzigen van `/retailer/transporter-labels` naar `/retailer/shipping-labels` |
| Regel 306-307 | PDF-download endpoint ook wijzigen van `/retailer/transporter-labels/` naar `/retailer/shipping-labels/` |
| Regel 350-351 | Details-endpoint ook wijzigen naar `/retailer/shipping-labels/` |
| Diversen | Extra diagnostische logging toevoegen bij elke API-call |

### Bestand: `supabase/functions/accept-bol-order/index.ts`

| Locatie | Wijziging |
|---------|-----------|
| Regel 117 | Extra logging toevoegen: token length, request body, response status + body |
| Regel 132-136 | Specifieke 403-afhandeling: als Bol.com 403 retourneert, loggen met details en duidelijke foutmelding teruggeven |

### Verwachte flow na fix

```text
1. Token ophalen (met correcte Content-Type header)
2. delivery-options aanroepen -> krijgt shippingLabelOfferId
3. Elke deliveryOption direct als offer gebruiken (geen nesting)
4. /retailer/shipping-labels aanroepen met shippingLabelOfferId
5. Process-status pollen tot SUCCESS
6. Label PDF downloaden van /retailer/shipping-labels/{id}
```

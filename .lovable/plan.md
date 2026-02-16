
# Fix: VVB Label Aanmaken - Twee API-Fouten

## Gevonden Problemen

De edge function `create-bol-vvb-label` retourneert: **"No shipping label offers available for this order"** met een lege array. Dit komt door twee fouten in het API-verzoek:

### Probleem 1: Ontbrekend `quantity` veld
De Bol.com API v10 vereist dat elk orderItem in het delivery-options verzoek een `quantity` bevat. De huidige code stuurt alleen `orderItemId`:

```text
Huidige code:    { "orderItems": [{ "orderItemId": "3878044388" }] }
Correct formaat: { "orderItems": [{ "orderItemId": "3878044388", "quantity": 1 }] }
```

Zonder `quantity` retourneert de API een lege lijst.

### Probleem 2: Verkeerde response-veldnaam
De API retourneert het veld `deliveryOptions`, maar de code zoekt naar `purchasableShippingLabels`. Daardoor wordt het resultaat altijd als leeg gezien, zelfs als de API wel opties teruggeeft.

## Oplossing

### Gewijzigd bestand

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/create-bol-vvb-label/index.ts` | (1) `quantity` toevoegen aan elk orderItem in het request, (2) response-veld wijzigen van `purchasableShippingLabels` naar `deliveryOptions`, (3) carrier-matching aanpassen aan het juiste veldformaat van delivery-options |

### Specifieke codewijzigingen

**Regel 167** -- `quantity` toevoegen aan de map-functie:
- Van: `orderItems: bolOrderItemIds.map((id) => ({ orderItemId: id }))`
- Naar: `orderItems: bolOrderItemIds.map((id, idx) => ({ orderItemId: id, quantity: orderItems[idx].quantity || 1 }))`

Hiervoor moet de mapping aangepast worden zodat we de `quantity` per item meesturen uit de order_items data.

**Regel 188** -- Response-veld corrigeren:
- Van: `offersData.purchasableShippingLabels`
- Naar: `offersData.deliveryOptions`

**Regel 189-191** -- Carrier-matching aanpassen aan de structuur van `deliveryOptions`. Het veld heet waarschijnlijk `transporterCode` maar kan ook genest zijn -- we voegen extra logging toe zodat we precies zien wat terugkomt.

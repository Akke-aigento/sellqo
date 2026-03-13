

## Tracking ophalen voor VVB orders — op basis van Bol.com documentatie

### Wat zegt de Bol.com API documentatie?

Uit de officiele Bol.com v10 docs:

1. **`GET /retailer/shipments?order-id={id}`** retourneert `transport.trackAndTrace` — maar bij VVB orders kan dit veld leeg zijn als de tracking nog niet is toegewezen aan het transport object.

2. **`HEAD /retailer/shipping-labels/{shippingLabelId}`** retourneert tracking via **response headers**:
   - `X-Track-And-Trace-Code: 3SBLCQ438474942`
   - `X-Transporter-Code: TNT`

   Dit is de aanbevolen methode om tracking op te halen voor VVB labels. Bol.com documentatie zegt letterlijk: *"If you only want to get the Track and Trace code and Transporter code we advise you to use a HTTP HEAD request"*

### Wat gaat er mis?

De `update-bol-tracking` functie vraagt alleen `GET /retailer/shipments` op. Als daar geen `trackAndTrace` in staat (wat bij VVB orders voorkomt), stopt hij. De HEAD fallback via `/retailer/shipping-labels/{labelId}` ontbreekt — terwijl de `create-bol-vvb-label` functie deze methode WEL al gebruikt (regels 848-860).

### Oplossing

**Bestand: `supabase/functions/update-bol-tracking/index.ts`**

1. **Shipping label ID ophalen**: Als de shipments API geen tracking retourneert, haal het `external_id` (= `transporterLabelId`) op uit de `shipping_labels` tabel voor die order.

2. **HEAD request als fallback**: Doe een `HEAD /retailer/shipping-labels/{labelId}` en lees `X-Track-And-Trace-Code` en `X-Transporter-Code` uit de headers.

3. **Tracking opslaan**: Sla de opgehaalde tracking op in zowel de `orders` tabel als de `shipping_labels` tabel.

```text
Huidige flow:
  GET /shipments?order-id=X → transport.trackAndTrace = null → ❌ "No tracking"

Nieuwe flow:
  GET /shipments?order-id=X → transport.trackAndTrace = null
  → Lookup shipping_labels.external_id voor order
  → HEAD /shipping-labels/{labelId}
  → X-Track-And-Trace-Code header → ✅ Tracking gevonden!
  → Opslaan in orders + shipping_labels
```

| Bestand | Wijziging |
|---|---|
| `supabase/functions/update-bol-tracking/index.ts` | HEAD fallback via `/shipping-labels/{labelId}` toevoegen voor VVB tracking |




# Fix: VVB Label Aanmaken - Verkeerd API Endpoint

## Probleem

De Bol.com API heeft twee aparte endpoints voor verzendlabels:

| Stap | Correct endpoint | Wat het doet |
|------|-----------------|-------------|
| 1 | `POST /retailer/shipping-labels/delivery-options` | Beschikbare labelopties ophalen (geeft `shippingLabelOfferId` terug) |
| 2 | `POST /retailer/shipping-labels` | Label aanmaken (vereist `shippingLabelOfferId` uit stap 1) |

De huidige code gebruikt voor **beide** stappen hetzelfde endpoint (`/retailer/shipping-labels`). Daardoor faalt stap 1 direct met de foutmelding: *"shippingLabelOfferId: Required field is missing"*.

## Oplossing

### `supabase/functions/create-bol-vvb-label/index.ts`

**Stap 1 (regel 157-170)**: Verander het endpoint van `/retailer/shipping-labels` naar `/retailer/shipping-labels/delivery-options`. Dit endpoint accepteert een lijst `orderItems` en retourneert de beschikbare verzendopties inclusief `shippingLabelOfferId`.

**Stap 2 (regel 209-223)**: Dit endpoint is al correct (`/retailer/shipping-labels`). Hier hoeft niets te veranderen -- het ontvangt het `shippingLabelOfferId` uit stap 1 en maakt het label aan.

**Extra**: CORS headers bijwerken met de uitgebreide set (o.a. `x-supabase-client-platform`) zodat calls vanuit de frontend niet geblokkeerd worden.

### Gewijzigd bestand

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/create-bol-vvb-label/index.ts` | Fix endpoint URL stap 1: `/shipping-labels` wordt `/shipping-labels/delivery-options` + CORS headers update |


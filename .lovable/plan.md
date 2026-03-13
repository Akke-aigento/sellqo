

## Analyse & Plan

### BUG 1: Track & Trace niet gelezen uit PDF GET response headers

**Analyse**: De HEAD request zit WEL al in de main flow (lijn 846-868). Maar de PDF GET request op lijn 784-793 retourneert OOK de tracking headers — die worden nu genegeerd. De PDF wordt gedownload als blob (lijn 798) maar de headers `X-Track-And-Trace-Code` en `X-Transporter-Code` worden niet uitgelezen. De HEAD request daarna doet hetzelfde, maar soms geeft de GET response ze al eerder terug.

**Fix**: Direct na `pdfResponse.status` check (lijn 797), voor de blob download, de tracking headers uitlezen:

```typescript
// Extract tracking from PDF response headers (line ~797)
const trackingFromHeader = pdfResponse.headers.get("X-Track-And-Trace-Code");
const carrierFromHeader = pdfResponse.headers.get("X-Transporter-Code");
console.log(`PDF headers - tracking: ${trackingFromHeader}, carrier: ${carrierFromHeader}`);
if (trackingFromHeader && !trackingNumber) {
  trackingNumber = trackingFromHeader;
}
```

| Bestand | Wijziging |
|---|---|
| `supabase/functions/create-bol-vvb-label/index.ts` | Header-extractie toevoegen na PDF GET response (lijn ~797) |

---

### BUG 2: Voorraad sync

**Analyse**: De `sync-bol-inventory` functie ziet er correct uit:
- Query filtert op `sync_inventory = true` en `bol_ean IS NOT NULL`
- Offer ID lookup: eerst `marketplace_mappings.bol_com.offerId`, dan `bol_offer_id` kolom, dan EAN-based lookup
- Endpoint is correct: `PUT /retailer/offers/{offerId}/stock` met `{ amount, managedByRetailer: true }`
- v10 headers zijn correct

**Potentieel probleem**: De kolom `sync_inventory` staat default op `true`, maar producten moeten WEL een `bol_ean` hebben. Als producten geen EAN ingevuld hebben, worden ze overgeslagen. Dit is geen bug maar verwacht gedrag.

**Geen code-wijziging nodig** voor de inventory sync — de logica is correct. Als het niet werkt, ontbreken ofwel EAN's op producten, ofwel de `bol_offer_id` / `marketplace_mappings`.

---

### Aanvullende check: `marketplace_order_item_id` in sync-bol-orders

**Analyse**: Lijn 419 slaat `marketplace_order_item_id: item.orderItemId` correct op bij import. De `create-bol-vvb-label` functie leest dit correct uit (lijn 567-568) en stuurt het door naar `confirm-bol-shipment` (lijn 965-966).

**Geen probleem gevonden** — de mapping is correct.

---

### Samenvatting

| Item | Status | Actie |
|---|---|---|
| BUG 1: Tracking uit PDF headers | Bug bevestigd | Header-extractie toevoegen na PDF GET |
| BUG 2: Voorraad sync | Code is correct | Geen wijziging nodig |
| marketplace_order_item_id | Correct opgeslagen | Geen wijziging nodig |

**1 bestand wordt gewijzigd**: `supabase/functions/create-bol-vvb-label/index.ts`


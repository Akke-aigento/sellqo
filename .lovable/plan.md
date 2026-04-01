

## Fix: VVB Label Process Status Polling — Wrong URL

### Probleem

De `create-bol-vvb-label` functie pollt `https://api.bol.com/retailer/process-status/{id}` maar Bol.com v10 heeft dit verplaatst naar `https://api.bol.com/shared/process-status/{id}`. Bewijs: de label creation response bevat zelf de correcte URL in het `links` array.

Gevolg: alle 15 poll-pogingen falen met 403, waardoor `transporterLabelId` en `trackingNumber` null blijven. Het label wordt als "pending" opgeslagen zonder PDF of tracking.

### Oplossing

**`supabase/functions/create-bol-vvb-label/index.ts`** — 1 wijziging (lijn 579-580):

Gebruik de URL uit het `links` array van de label creation response (meest robuust), met fallback naar `/shared/process-status/`:

```typescript
// Haal de poll URL uit de response links (Bol.com geeft dit zelf mee)
const processLink = (labelData.links || []).find((l: any) => l.rel === "self");
const processStatusUrl = processLink?.href 
  || `https://api.bol.com/shared/process-status/${processStatusId}`;
```

En vervang in de poll-loop (lijn 579):
```
// WAS:  `https://api.bol.com/retailer/process-status/${processStatusId}`
// WORDT: processStatusUrl
```

### Verwacht resultaat
- Process status poll retourneert SUCCESS met `entityId` (= transporterLabelId)
- PDF wordt opgehaald en opgeslagen in storage
- Tracking nummer wordt ingevuld op de order
- Order wordt als "shipped" gemarkeerd
- Shipment wordt bevestigd bij Bol.com



# Fix: VVB Label Download - label_url is leeg

## Probleem

Het VVB label is aangemaakt bij Bol.com, maar in de database zijn `label_url` en `tracking_number` beide `null`. Daardoor werkt de download-knop niet.

De oorzaak zit in de process-status polling (stap 2b van het label-aanmaakproces). Na het aanmaken van het label retourneert Bol.com een `processStatusId`. De code pollt dit, maar wanneer de status `SUCCESS` is, probeert het de label-ID te extraheren uit een `self` link:

```text
const labelLink = links.find(l => l.rel === 'self');
transporterLabelId = labelLink.href.split('/').pop();
```

Het probleem is dat de Bol.com v10 process-status response het label-ID als `entityId` retourneert, niet via een `self` link. Als `transporterLabelId` `null` blijft, worden stap 3 (PDF downloaden) en stap 4 (tracking ophalen) overgeslagen.

## Oplossing

### Bestand: `supabase/functions/create-bol-vvb-label/index.ts`

| Locatie | Wijziging |
|---------|-----------|
| Regel 288-296 | Process-status parsing uitbreiden: eerst `entityId` proberen, dan `links` als fallback |
| Regel 290 | Extra logging toevoegen om de volledige process-status response te loggen |
| Regel 314-374 | Fallback toevoegen: als `transporterLabelId` nog steeds null is na polling, toch een label record aanmaken met beschikbare informatie en retry-logica |

### Specifieke codewijziging

De huidige parsing (regel 290-296):

```text
if (statusData.status === 'SUCCESS') {
  const links = statusData.links || [];
  const labelLink = links.find(l => l.rel === 'self');
  if (labelLink) {
    transporterLabelId = labelLink.href.split('/').pop();
  }
  break;
}
```

Wordt:

```text
if (statusData.status === 'SUCCESS') {
  console.log('Process status SUCCESS, full response:', JSON.stringify(statusData));
  
  // Bol.com v10: entityId bevat het shipping label ID
  transporterLabelId = statusData.entityId || null;
  
  // Fallback: probeer uit links te halen
  if (!transporterLabelId) {
    const links = statusData.links || [];
    const labelLink = links.find(l => l.rel === 'self' || l.rel === 'get');
    if (labelLink) {
      transporterLabelId = labelLink.href.split('/').pop();
    }
  }
  
  console.log('Extracted transporterLabelId:', transporterLabelId);
  break;
}
```

### Verwacht resultaat

Na deze fix zal het VVB label-aanmaakproces:
1. Het label-ID correct extraheren uit de process-status response
2. Het label-PDF downloaden en opslaan in storage
3. De `label_url` en `tracking_number` correct invullen in de database
4. De download-knop op de orderpagina werkt direct

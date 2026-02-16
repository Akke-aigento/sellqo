
# Fix: VVB Label Download + Tracking Ophalen

## Probleem

De database toont voor deze order een shipping_labels record met `label_url: null` en `tracking_number: null`. Het label is wel aangemaakt bij Bol.com (status "created", carrier "BPOST_BE"), maar de PDF en tracking zijn nooit opgehaald.

Er zijn twee oorzaken:

### Oorzaak 1: Polling timeout
De process-status polling doet maximaal 10 pogingen met 2 seconden wachttijd (= 20 seconden totaal). Bol.com kan langer nodig hebben om het label te verwerken, waardoor `transporterLabelId` null blijft en stap 3 (PDF downloaden) en stap 4 (tracking ophalen) worden overgeslagen.

### Oorzaak 2: Tracking ophalen via verkeerde methode
De code probeert tracking op te halen via een GET request met JSON Accept-header, maar de Bol.com documentatie schrijft voor dat het trackingnummer via een **HEAD request** op het shipping-labels endpoint wordt teruggegeven in de response header `X-Track-And-Trace-Code`.

## Oplossing

### Bestand: `supabase/functions/create-bol-vvb-label/index.ts`

**Wijziging 1: Polling verbeteren**
- Aantal pogingen verhogen van 10 naar 15
- Wachttijd verhogen van 2 naar 3 seconden (totaal: 45 seconden)
- Betere logging bij elke poging

**Wijziging 2: Tracking ophalen via HEAD request**
De huidige code (regels 398-412) die een GET + JSON doet vervangen door een HEAD request die het trackingnummer uit de `X-Track-And-Trace-Code` header haalt, conform de Bol.com v10 documentatie.

```text
Huidig (fout):
  GET /shipping-labels/{id}
  Accept: application/vnd.retailer.v10+json
  -> JSON body: detailsData.trackAndTrace

Nieuw (correct):
  HEAD /shipping-labels/{id}
  -> Response header: X-Track-And-Trace-Code
```

### Bestand: `src/components/admin/BolActionsCard.tsx`

**Wijziging 3: Retry-knop toevoegen voor labels zonder URL**

Op dit moment worden de download/print-knoppen alleen getoond als `label_url` bestaat. Een "Opnieuw ophalen" knop toevoegen die verschijnt wanneer er wel een label record bestaat maar `label_url` null is. Deze knop roept een nieuwe flow aan die het label opnieuw probeert op te halen op basis van het opgeslagen `external_id` (het transporterLabelId).

### Bestand: `supabase/functions/create-bol-vvb-label/index.ts`

**Wijziging 4: Retry endpoint toevoegen**

Ondersteuning toevoegen voor een `retry` mode in de request body. Wanneer `retry: true` en een `label_id` worden meegegeven, slaat de functie de label-aanmaak over en probeert alleen de PDF te downloaden en tracking op te halen voor een bestaand label.

## Verwacht resultaat

- Nieuwe VVB labels: langer pollen (45s), tracking via HEAD request
- Bestaande labels zonder URL: retry-knop om alsnog PDF + tracking op te halen
- De download-knop werkt direct na succesvolle retry

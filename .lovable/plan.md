## Situatie

Geen SQL nodig — de cropping gebeurt op de PDF in storage, niet in de database. De `create-bol-vvb-label` edge function heeft al een `recrop: true` modus die:

1. Het originele label opnieuw downloadt bij Bol (via `transporterLabelId`)
2. Het door de nieuwe scale-to-fit logica haalt
3. Het bestaande bestand in storage overschrijft (zelfde `label_url`)
4. Geen nieuw label aanmaakt bij Bol (geen kosten, geen nieuwe tracking)

## De 2 betreffende labels

Beide VanXcel, BPOST_BE, dymo4xl formaat:

| Order | Label ID |
|---|---|
| #1145 | `de8eb4d7-9af4-430b-8f0a-591e70676c16` |
| #1144 | `31db0584-54d1-46b1-8296-fe0ebe6e5144` |

## Plan

1. Voor elk van de 2 labels de edge function aanroepen met:
   ```json
   { "order_id": "...", "retry": true, "recrop": true, "label_id": "..." }
   ```
2. Verifiëren door de PDF opnieuw te downloaden en als afbeelding te renderen → checken of de rechterkant (barcode + info kolom) nu volledig zichtbaar is.
3. Als beide labels visueel correct zijn → klaar. Je hoeft dan niks in de UI te doen, de bestaande `label_url` werkt gewoon weer.
4. Indien de fix nog niet goed is → debuggen op basis van de nieuwe render, niet op de oude PDF.

## Optioneel: knop in UI

Als je dit vaker wil kunnen doen zonder mij, kan ik in de `BolActionsCard` een "Re-crop label" knop toevoegen die exact deze call doet. Laat maar weten of je dat erbij wil.

Wil je dat ik nu de 2 labels recrop en visueel valideer?

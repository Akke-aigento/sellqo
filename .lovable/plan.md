## Doel

De laatste 3 VanXcel Bol-orders (#1140, #1141, #1142) hebben hun PDF-label opgehaald en geüpload **vóór** de cropping-fix (oude `cropToA6` met harde A6-grenzen). De `external_id` (transporterLabelId) staat nog in de database, dus we kunnen het originele PDF opnieuw bij Bol ophalen en met de nieuwe `cropToLabel` functie herschrijven — zonder een nieuw label te maken (geen extra kosten, zelfde tracking).

## Aanpak

### 1. Recrop-modus toevoegen aan `create-bol-vvb-label`

Nieuwe optionele parameter `recrop: true`:
- Skipt de "already_fetched" early-return in de retry branch
- Haalt het originele PDF opnieuw op via `GET /retailer/shipping-labels/{external_id}` met de bestaande `external_id`
- Crop met de nieuwe `cropToLabel` (A5 fallback voor internationale labels)
- Upload naar dezelfde storage path met `upsert: true` — bestaande `label_url` blijft geldig
- Werkt `tracking_number` niet bij (blijft hetzelfde), markeert geen extra shipment confirm

### 2. Drie orders opnieuw verwerken

Aanroepen via de bestaande edge-function infrastructuur (handmatig of via een eenmalig script) voor:
| Order  | label_id                              | external_id                            |
|--------|---------------------------------------|----------------------------------------|
| #1142  | b76163d0-6f57-4977-af0c-ce3a62e13141  | cbcc827e-01de-4dc0-887b-d9f9be9e3ba6   |
| #1141  | 0170f045-970d-4cdc-81bc-361de409f4d2  | 4d6b3486-38a7-4861-8c13-c37ae929973d   |
| #1140  | ae79f422-865b-4e6c-9e6a-9ed48ccdeb48  | 6ef1bc34-a935-472e-ad6c-2a1e776af1b4   |

Body per call:
```json
{ "order_id": "<uuid>", "label_id": "<uuid>", "retry": true, "recrop": true }
```

### 3. Verificatie

- PDF in storage opnieuw downloaden en visueel checken: zenderadres, landcode en barcode volledig zichtbaar
- `label_url` ongewijzigd (hetzelfde public URL, browser cache mogelijk verversen)
- Geen nieuwe entry in `shipping_labels`, geen extra Bol API-label gegenereerd

## Belangrijke notities

- De Bol shipping-label PDFs blijven (per Bol docs) een tijd beschikbaar via `external_id`. Als één of meerdere PDF's al verlopen zijn (404), faalt de recrop voor dat label en kunnen we alleen via `force_new` een volledig nieuw label aanmaken (kost een nieuw VVB-label) — dat doen we alleen op uitdrukkelijke bevestiging.
- De drie orders zijn NL-adressen via BPOST_BE; meestal passen die al in A6, maar de nieuwe `cropToLabel` is veiliger voor randgevallen waar Bol een groter formaat retourneert.

## Wijzigingen

- `supabase/functions/create-bol-vvb-label/index.ts`: `recrop` flag toevoegen aan retry branch (skip `already_fetched` short-circuit, hergebruik bestaande PDF-fetch + crop + upload code).
- Eenmalige uitvoer: 3× function-aanroep voor de orders hierboven.

## Wat ik zie op je screenshot

Je print via de **browser print-dialoog** (geen WebUSB) op een **Dymo LabelWriter LW650XL PRO** met paper-size **Label S0904980** (Dymo 4XL Shipping Label, 102 × 210 mm).

Twee dingen om te weten:
- Voor het **detecteren via USB** (Chrome/Edge) wordt Dymo *al* herkend op vendor-ID `0x0922` — dus elke Dymo wordt automatisch als "Dymo Printer" aangeboden in de WebUSB-flow. Daar hoeven we niets toe te voegen.
- Wat *ontbreekt* is een **paper-size preset** voor jouw S0904980-label in de lijst van Verzendlabel formaten. Nu staan er alleen A6 / 4×6 / Brother 62 / A5 / A4. Als je nu A4 of A6 kiest en "Fit to paper" gebruikt schaalt Chrome het wél, maar dat is niet ideaal qua scherpte en marges.

## Plan

### 1. Nieuw labelformaat toevoegen: Dymo LW 4XL (102 × 210 mm)
- **Frontend** — `src/components/admin/settings/LabelFormatSettings.tsx`
  Nieuwe optie in `FORMAT_OPTIONS` + `LabelFormat` union:
  - `value: 'dymo_lw_4xl'`
  - label: *"Dymo LabelWriter 4XL — 102 × 210 mm"*
  - hint: *"Dymo LW550/LW650 met S0904980 verzendlabels"*
- **Edge function** — `supabase/functions/create-bol-vvb-label/index.ts`
  - Toevoegen aan `LabelFormat` union + `FORMAT_DIMENSIONS` map: `dymo_lw_4xl: { w: 289, h: 595 }` (102 × 210 mm in PDF-points)
  - Toevoegen aan `FORMAT_SUFFIX`: `dymo_lw_4xl: "-dymo4xl"`
  - Crop-logica werkt automatisch zodra dimensies bekend zijn

### 2. Knop "Vind je jouw printer niet?"
Onderin de `LabelFormatSettings`-kaart:

```
[ Vind je jouw printer/labelformaat niet? Stuur ons een verzoek → ]
```

Klikken opent een dialog `RequestPrinterDialog.tsx` met velden:
- Printer-merk + model (verplicht, vrije tekst)
- Labelformaat / paper-size (bv. "S0904980, 102 × 210 mm")
- Optioneel: extra info / link naar specs
- Tenant + user worden automatisch meegestuurd

Submit → maakt een record in `support_tickets` met:
- `category: 'printer_request'`
- `subject: "Printer toevoegen: <merk> <model>"`
- `body: <samengestelde details>`
- routing zoals al bestaat (naar SellQo interne tenant — Support Alert Routing memory)

Bevestiging: *"Bedankt! We bekijken je verzoek en voegen je printer/labelformaat toe waar mogelijk."*

### 3. Geen automatische toevoeging zonder review
Bewust **niet** auto-toevoegen aan de tenant-lijst, omdat:
- Een nieuw paper-size vereist juiste PDF-crop dimensies (anders scheef/afgesneden label)
- We willen één gecureerde lijst voor alle tenants houden i.p.v. per-tenant custom formaten
- Alternatief idee voor later: een "custom" optie waarbij de gebruiker zelf mm-breedte/hoogte invult, maar dat is een groter project (preview, validatie, kalibratie). Voorstel: nu eerst de request-flow, en als blijkt dat veel tenants verschillende exotische printers hebben, dan in v2 een custom-size editor.

## Wat ik **niet** raak
- WebUSB-detectie (Dymo werkt al)
- Bestaande crop-logica
- Andere formaten of `BolVVBSettings`
- Database schema (gebruikt bestaande `support_tickets`)

## Vraag
Akkoord met deze drie stappen? Of wil je liever dat de "request"-knop een **custom mm-invoer** wordt (eigen breedte/hoogte) i.p.v. een verzoek naar ons?



## Pakbon Visueel Verbeteren

### Huidige problemen
1. **Geen logo** — tenant heeft `logo_url` maar dit wordt niet meegegeven aan de PDF generator
2. **Saai/kaal design** — alleen tekst, geen kleur, geen visuele scheiding
3. **Layout niet optimaal** — verzendadres label en waarden staan te dicht op elkaar

### Plan

**File: `src/utils/packingSlipPdf.ts`** — Volledig herontwerp van de pakbon:

1. **Logo toevoegen**
   - Voeg `logo_url?: string` toe aan `PackingSlipTenant` interface
   - Fetch het logo (PNG/JPG), embed in PDF met `doc.embedPng/embedJpg`
   - Toon logo linksboven (max 120x50pt), bedrijfsnaam ernaast

2. **Visueler design**
   - Gekleurde header bar (accent kleur bovenaan de pagina)
   - "PAKBON" titel in een gestylede banner of met accent kleur
   - Duidelijke twee-kolom layout: links bestelinfo, rechts verzendadres in een licht gekleurd kader
   - Tabel met alternerende rijkleuren (zebra striping)
   - Mooiere footer met bedankt-bericht en bedrijfsgegevens

3. **Layout fixes**
   - Betere spacing tussen secties
   - Verzendadres label en waarden correct uitgelijnd
   - SKU kolom smaller, omschrijving kolom breder

**Callers updaten** (3 bestanden):
- `src/pages/admin/OrderDetail.tsx` — voeg `logo_url: currentTenant.logo_url` toe
- `src/components/admin/OrderBulkActions.tsx` — idem
- `src/components/admin/FulfillmentBulkActions.tsx` — idem

### Visueel concept

```text
┌──────────────────────────────────────┐
│ ████████ ACCENT BAR ████████████████ │
│                                      │
│ [LOGO]  VanXcel                      │
│         Beekstraat 49                │
│         3051 Oud Heverlee            │
│                                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                      │
│   PAKBON                             │
│                                      │
│ ┌─────────────┐  ┌────────────────┐  │
│ │ Bestelling  │  │ Verzendadres   │  │
│ │ #1122       │  │ Yvonne Nuij    │  │
│ │ 6 mrt 2026  │  │ Matthijs...21  │  │
│ └─────────────┘  └────────────────┘  │
│                                      │
│ ┌────┬──────────────────┬────────┐   │
│ │SKU │ Omschrijving     │ Aantal │   │
│ ├────┼──────────────────┼────────┤   │
│ │... │ VanXcel kabel... │   1    │   │
│ │... │ VanXcel kabel... │   1    │   │
│ └────┴──────────────────┴────────┘   │
│                                      │
│ Totaal: 2 artikelen                  │
│                                      │
│ ─────────────────────────────────── │
│ Bedankt voor je bestelling!          │
│ VanXcel · Beekstraat 49 · ...        │
└──────────────────────────────────────┘
```


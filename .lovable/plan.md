## Probleem

De geleverde label-PDF heeft mediabox `[0, 175.47, 297.64, 595]` (≈ A6 staand: 297.64 × 419.53 pt). Maar de werkelijke label-inhoud die Bol/bpost stuurt voor internationale `bpack World Business` zendingen is **A5 staand** (≈ 419.53 × 595.27 pt). Daardoor wordt aan de **rechterkant** flink content afgesneden:

- "Sender address" kolom (Nomadix / Beekstraat 49 / 3051 Oud Heverlee / Belgium) — half/heel weg
- "NL" landcode rechts naast adres — weg
- "OUTSIDE THE EU" einde van de tekst — weg  
- Streepjescode + tracking nr `CD119629590BE` + EPC-vakje rechts — afgekapt

In de uitgebreide render (mediabox opgerekt) zien we dat alle elementen netjes binnen ~A5-portrait passen. De crop is dus simpelweg te smal.

## Oorzaak

In `supabase/functions/create-bol-vvb-label/index.ts` regel 28-47:

```ts
const A6_WIDTH = 297.64;
const A6_HEIGHT = 419.53;
page.setCropBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
page.setMediaBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
```

Hardcoded A6 — werkt voor binnenlandse bpost A6-labels maar niet voor de A5 internationale/World Business labels (die op een A4-pagina geprint staan in de top-left A5-zone).

## Fix

Vervang `cropToA6` door een slimmere `cropToLabel` die het label-formaat bepaalt op basis van de source page-grootte:

1. Als `pageHeight > 700` → A4-bron met A5-label in top-left → crop naar **A5 portrait** (419.53 × 595.27)
2. Als `pageHeight ≈ 595` (A4 landscape) en `pageWidth ≈ 842` → bevat 2× A6 of 1× A5 → crop naar A5 portrait top-left
3. Als de page al ≤ A5 is → geen crop, gewoon doorlaten zoals hij is

Concreet voor dit geval (pagina 595 hoog): crop naar `[0, 0, 419.53, 595]` (volledige hoogte, breedte uitgebreid van 297.64 → 419.53).

```ts
async function cropToLabel(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const PDFDoc = await loadPdfLib();
  const pdfDoc = await PDFDoc.load(pdfBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const A5_WIDTH = 419.53;
  const A5_HEIGHT = 595.27;

  // Bepaal label-zone (top-left) op basis van source pagina
  let cropW = Math.min(width, A5_WIDTH);
  let cropH = Math.min(height, A5_HEIGHT);
  // Als source kleiner is dan A5: laat het zoals het is
  if (width <= A5_WIDTH + 5 && height <= A5_HEIGHT + 5) {
    cropW = width;
    cropH = height;
  }
  const x = 0;
  const y = height - cropH; // top-left

  page.setCropBox(x, y, cropW, cropH);
  page.setMediaBox(x, y, cropW, cropH);

  const newPdf = await PDFDoc.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);
  return await newPdf.save();
}
```

En `cropToA6(...)` calls hernoemen naar `cropToLabel(...)`.

## Impact

- Geen DB-wijzigingen, geen schema-changes
- Eén edge function aanpassing: `supabase/functions/create-bol-vvb-label/index.ts`
- Bestaande binnenlandse A6-labels blijven werken (vallen onder regel 3, of worden in A5-vak geplaatst — beide formaten passen op een 10×15 cm thermolabelprinter)
- Internationale bpack World Business labels tonen nu volledige zender-/EPC-/tracking-info

## Verificatie

Na deploy een nieuw VVB-label genereren voor een internationale order en controleren dat:
- Sender address volledig zichtbaar
- "NL" / landcode zichtbaar  
- Volledige barcode + tracking nr + EPC-vakje zichtbaar
- Tekst "PLEASE ALWAYS ADD CN23 DOCUMENTS FOR ALL SHIPMENTS OUTSIDE THE EU" niet afgekapt

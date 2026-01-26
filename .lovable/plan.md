
# Automatische A6 PDF Cropping voor VVB Labels

## Probleem Analyse

Zoals in je voorbeeld te zien is:
- Bol.com levert labels als A4 PDF (210mm × 297mm)
- Het feitelijke label is A6 formaat (~105mm × 148mm)
- Het label staat **linksboven** gepositioneerd, niet gecentreerd
- Dit vereist handmatig knippen, wat tijdrovend en irritant is

## Oplossing

Ik ga de `create-bol-vvb-label` Edge Function uitbreiden met automatische PDF cropping die:

1. **Detecteert waar het label staat** (linksboven in dit geval)
2. **Automatisch bijsnijdt** naar exact A6 formaat
3. **Een print-klaar A6 PDF opslaat** die direct op A6 papier of labelprinter geprint kan worden

## Technische Implementatie

### 1. Update Edge Function - PDF Cropping

**Bestand:** `supabase/functions/create-bol-vvb-label/index.ts`

Toevoegen van PDF cropping met `pdf-lib`:

```typescript
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// Na het ophalen van de PDF van Bol.com:
async function cropToA6(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  
  // A6 dimensies in PDF points (1 inch = 72 points)
  // A6 = 105mm × 148mm = 297.64 × 419.53 points
  const A6_WIDTH = 297.64;
  const A6_HEIGHT = 419.53;
  
  // Het label staat linksboven, dus we croppen vanaf daar
  // MediaBox bepaalt de zichtbare pagina grenzen
  const { width, height } = page.getSize();
  
  // Crop box: linksboven A6 gedeelte
  // In PDF coördinaten is Y=0 onderaan, dus we berekenen vanaf boven
  page.setCropBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  page.setMediaBox(0, height - A6_HEIGHT, A6_WIDTH, A6_HEIGHT);
  
  // Maak nieuwe PDF met alleen het gecropte gedeelte
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);
  
  return await newPdf.save();
}
```

### 2. UI Settings Uitbreiding

**Bestand:** `src/components/admin/marketplace/BolVVBSettings.tsx`

Toevoegen van labelformaat keuze:

```
┌─────────────────────────────────────────────────────────────────┐
│  Labelformaat                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ○ A4 Origineel (handmatig knippen nodig)                      │
│  ● A6 Automatisch bijgesneden (aanbevolen)                     │
│                                                                 │
│  ℹ️ A6 labels kunnen direct op een labelprinter of A6 papier   │
│     geprint worden zonder knippen.                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Type Uitbreiding

**Bestand:** `src/types/marketplace.ts`

```typescript
export interface MarketplaceSettings {
  // ... bestaande velden ...
  vvbLabelFormat?: 'a4_original' | 'a6_cropped';  // Label output formaat
}
```

## Wijzigingen Overzicht

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/create-bol-vvb-label/index.ts` | PDF cropping logica met pdf-lib |
| `src/types/marketplace.ts` | `vvbLabelFormat` toevoegen |
| `src/components/admin/marketplace/BolVVBSettings.tsx` | Labelformaat radio buttons |

## Resultaat

✅ **Geen knippen meer nodig** - Labels komen er direct als A6 uit
✅ **Labelprinter compatibel** - Direct printen op Dymo, Zebra, etc.
✅ **Instelbaar** - Je kunt kiezen tussen A4 origineel of A6 bijgesneden
✅ **Automatisch** - Werkt voor alle VVB labels zonder extra handelingen

## Technische Details

De cropping werkt als volgt:
1. Bol.com PDF wordt ontvangen (A4, label linksboven)
2. `pdf-lib` laadt de PDF
3. CropBox wordt ingesteld op de linkerbovenhoek (A6 formaat)
4. Nieuwe PDF wordt gegenereerd met alleen het label
5. A6 PDF wordt opgeslagen in storage

Dit is **volledig server-side** dus er is geen impact op de gebruikerservaring - je krijgt gewoon een nette A6 PDF in plaats van een A4 met lege ruimte.

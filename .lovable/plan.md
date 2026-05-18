## Wat er misgaat

1. Ik heb je bijgevoegde PDF geopend en gerenderd als afbeelding.
2. Daarin is de rechterkant al afgesneden: de barcode loopt uit beeld en ook het rechter informatieblok is niet volledig zichtbaar.
3. Dat betekent: het probleem zit al in het gegenereerde labelbestand zelf, dus niet pas in de browser printdialoog.
4. De PDF is **289 × 595 pt**. Dat komt exact overeen met het formaat `dymo_lw_4xl` in de code.
5. In `supabase/functions/create-bol-vvb-label/index.ts` wordt het label hard gecropt via `cropToLabel()`:
   - vaste breedte/hoogte per formaat
   - altijd vanaf **linksboven**
   - met `setCropBox()` en `setMediaBox()`
6. Voor jouw label is die crop te smal. Daardoor wordt de rechterkant letterlijk weggeknipt vóór het label opgeslagen wordt.
7. De batch-print code is niet de hoofdschuldige:
   - `src/hooks/useBatchLabelPrint.ts` haalt gewoon `label_url` op
   - `src/utils/pdfMerge.ts` kopieert pagina’s alleen samen
   - dus batch print neemt het al fout gecropte label gewoon over

## Conclusie

Ja, ik zie het probleem duidelijk: **de labelgenerator cropt te agressief met een vaste top-left cropbox**, en daardoor wordt de rechterkant van dit Bol/bpost-label permanent afgesneden.

## Plan om dit te fixen

1. De crop-logica in `create-bol-vvb-label` aanpassen zodat dit type label niet meer met deze te smalle vaste breedte wordt afgesneden.
2. Veilige fallback instellen voor Bol-labels die niet betrouwbaar in `dymo_lw_4xl` passen (bijvoorbeeld origineel formaat of een ruimer bewezen formaat).
3. De crop-presets slimmer maken per label/layout in plaats van één generieke top-left crop voor alles.
4. Een bestaand label opnieuw genereren/recroppen en visueel valideren met exact dezelfde outputflow.
5. Controleren dat batch print daarna dezelfde correcte PDF meeneemt zonder extra clipping.

## Technische noot

De concrete root cause zit hier:

```text
supabase/functions/create-bol-vvb-label/index.ts
cropToLabel()
- dims for dymo_lw_4xl: 289 x 595
- x = 0
- y = height - cropH
- page.setCropBox(x, y, cropW, cropH)
- page.setMediaBox(x, y, cropW, cropH)
```

Dat is een harde afkap, geen schaal- of printprobleem.

Als je wilt, kan ik nu de fix hiervoor uitwerken.
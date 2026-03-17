

## Fix Order Detail Pagina - Mobiel + Print Label

### Twee problemen

**1. Print Label knop doet niets op mobiel**
De `printViaBrowser` functie in `useLabelPrinter.ts` maakt een verborgen iframe met de PDF URL en probeert `iframe.contentWindow.print()`. Dit faalt op mobiele browsers (vooral iOS Safari) omdat:
- Cross-origin PDF's in iframes worden geblokkeerd
- `contentWindow.print()` wordt niet ondersteund op mobiel

De fallback (`window.open`) wordt alleen getriggerd bij een exception, maar het stille falen triggert geen exception.

**Oplossing**: Wijzig `printViaBrowser` zodat het op mobiel direct `window.open(pdfUrl, '_blank')` doet in plaats van de iframe-truc. Detectie via `navigator.maxTouchPoints > 0` of viewport-breedte.

**2. Layout OrderDetail niet goed op mobiel**
Op 390px viewport is de layout krap. Specifieke verbeteringen:
- De header met order nummer + 3 badges wrappen slecht
- De grid `lg:grid-cols-3` is correct (stacks op mobiel), maar de rechterkolom kaarten hebben te veel padding/nesting
- Status dropdowns in "Acties & Status" card: `grid-cols-2` is krap op 390px
- Klant & Adressen card: buttons "Email" + "Profiel" overlappen

### Wijzigingen

| Bestand | Wat |
|---------|-----|
| `src/hooks/useLabelPrinter.ts` | `printViaBrowser`: op mobiel/touch direct `window.open()`, geen iframe |
| `src/pages/admin/OrderDetail.tsx` | Compactere header badges, betere spacing acties, responsive button layout |

### Detail per bestand

**useLabelPrinter.ts** - `printViaBrowser` functie:
```typescript
const printViaBrowser = useCallback((pdfUrl: string): boolean => {
  // Mobile browsers can't print from hidden iframes
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
    || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
  
  if (isMobileDevice) {
    window.open(pdfUrl, '_blank');
    return true;
  }
  // ... bestaande iframe logica voor desktop
}, []);
```

**OrderDetail.tsx** - Layout fixes:
- Header badges: wrap beter met `gap-1.5` en kleinere badges op mobiel
- "Acties & Status" card: stack dropdowns verticaal op heel kleine schermen (`grid-cols-1 sm:grid-cols-2`)
- Klant buttons: `flex-wrap` toevoegen zodat ze netjes wrappen
- Verzending kaart: minder padding, compactere knoppen


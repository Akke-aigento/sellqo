

## Logo prominent maken op cadeaukaart-ontwerpen

### Probleem

Het logo is nu een klein icoontje (h-5 w-5 = 20x20px in de preview, h-10 w-10 = 40x40px in de renderer) naast de winkelnaam. Het valt nauwelijks op.

### Oplossing

Het logo wordt het **centrale visuele element** van elke kaart -- groot, opvallend, en het eerste wat je ziet. De tekst-informatie (bedrag, code, winkelnaam) wordt compact onderaan geplaatst zodat het logo de meeste ruimte inneemt.

### Nieuwe layout (beide componenten)

**GiftCardTemplatePreview (compact kaart in admin/storefront selector):**

```text
+----------------------------------+
|                                  |
|         [LOGO - groot]           |
|         (max ~50% hoogte)        |
|          object-contain          |
|                                  |
|  CADEAUKAART                     |
|  Winkelnaam            € 25,00   |
+----------------------------------+
```

- Logo: `max-h-[45%] max-w-[60%] object-contain` gecentreerd bovenaan
- Tekst compacter onderaan: winkelnaam links, bedrag rechts
- Op donkere templates krijgt het logo een subtiele `drop-shadow` of lichte achtergrondgloed

**GiftCardTemplateRenderer (volledige kaart bij bevestiging/e-mail):**

```text
+----------------------------------+
|      CADEAUKAART                 |
|                                  |
|         [LOGO - groot]           |
|       (max ~120px hoog)          |
|          object-contain          |
|                                  |
|      Winkelnaam                  |
|                                  |
|      € 25,00                     |
|      Voor: Jan                   |
|      "Gefeliciteerd!"            |
|      ────────────────            |
|      Code: XXXX-XXXX            |
|      Geldig t/m 24-02-2027      |
+----------------------------------+
```

- Logo: `h-24 max-w-[70%] object-contain` (96px hoog, schaalt mee)
- Gecentreerd boven de winkelnaam
- Voldoende witruimte rondom het logo

### Technische details

**Bestand: `src/components/shared/GiftCardTemplates.tsx`**

Wijzigingen in `GiftCardTemplatePreview`:
- Logo verplaatsen van de kleine inline positie naar een gecentreerd blok dat het midden van de kaart inneemt
- Logo sizing: `h-12 max-w-[60%]` (compact) -- veel groter dan de huidige `h-5 w-5`
- Flex layout: `items-center justify-center flex-1` voor het logo-gedeelte
- Tekst (cadeaukaart label + winkelnaam + bedrag) compact onderaan in een footer-achtige balk
- Bij donkere templates: `drop-shadow-lg` of `bg-white/10 rounded-lg p-2` achter het logo voor contrast

Wijzigingen in `GiftCardTemplateRenderer`:
- Logo sizing: `h-20 md:h-24 max-w-[70%] object-contain` -- veel groter dan huidige `h-10 w-10`
- Gecentreerd boven de winkelnaam met `mx-auto` en `text-center`
- Extra verticale ruimte (`mb-4`) onder het logo
- Bij donkere templates: subtiele achtergrondgloed

**Fallback**: als er geen logo is, blijft de huidige tekst-only layout intact (winkelnaam prominent als tekst).

| Bestand | Wijziging |
|---|---|
| `src/components/shared/GiftCardTemplates.tsx` | Logo centraal en groot positioneren in zowel Preview als Renderer |

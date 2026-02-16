
# Contrastcontrole & Kleurpalet Verbetering

## Het probleem

Op de screenshot is duidelijk te zien dat op een donkere achtergrond:
- **Koppen** (h2/h3 in productbeschrijving) zijn onleesbaar -- ze gebruiken een kleur die te dicht bij de achtergrond ligt
- **Links** in de rich-text content (prose) zijn slecht zichtbaar
- **Accent-kleurtekst** (prijskoppen, feature-titels) heeft te weinig contrast
- De **Color Palette Generator** genereert paletten zonder contrast te valideren

Dit komt omdat:
1. De `prose` (rich-text) class geen custom styling heeft voor koppen en links wanneer thema-kleuren worden overschreven
2. De palette generator nooit checkt of kleuren voldoende WCAG-contrast hebben
3. Er nergens een waarschuwing wordt getoond aan de merchant als de gekozen kleuren onleesbaar zijn

---

## Oplossing: 3 onderdelen

### 1. WCAG Contrast Checker utility

Een `getContrastRatio(color1, color2)` functie toevoegen die de WCAG 2.1 contrastverhouding berekent (minimaal 4.5:1 voor tekst, 3:1 voor grote tekst). Deze utility wordt gedeeld door de palette generator en de kleurkiezer.

**Bestand**: `src/lib/color-utils.ts` (nieuw)

---

### 2. Contrastwaarschuwingen in de Admin Kleurkiezer

Bij elk kleurveld (primair, accent, tekst) wordt live de contrastverhouding berekend ten opzichte van de achtergrondkleur. Als het contrast onvoldoende is (< 4.5:1), verschijnt er een oranje/rode waarschuwing:

- Ratio >= 4.5 -- Groen vinkje "AA OK"
- Ratio >= 3.0 maar < 4.5 -- Oranje waarschuwing "Laag contrast - grote tekst OK"
- Ratio < 3.0 -- Rode waarschuwing "Onleesbaar! Pas kleur aan"

Dit wordt getoond naast elk kleurveld in het "Kleuren" blok van `ThemeCustomizer.tsx`.

**Bestand**: `src/components/admin/storefront/ThemeCustomizer.tsx`

---

### 3. Palette Generator: contrast-aware paletten

De palette generator wordt verbeterd:
- Na het genereren van een palet wordt elk kleurpaar gecontroleerd (tekst vs achtergrond, accent vs achtergrond, primary vs achtergrond)
- Paletten met slechte contrastverhoudingen worden automatisch gecorrigeerd (lichtheid aanpassen)
- Een klein contrast-indicator icoontje wordt getoond bij elk palet (groen = goed, oranje = matig)
- Bij donkere achtergronden worden accent/primary-kleuren lichter gemaakt zodat ze leesbaar zijn

**Bestand**: `src/components/admin/storefront/ColorPaletteGenerator.tsx`

---

### 4. Storefront: prose/rich-text contrast fix

De `prose` class op productpagina's en contentpagina's krijgt expliciete styling die meebeweegt met de thema-variabelen:
- Koppen: `text-foreground` (niet een accent-kleur)
- Links: worden gecontroleerd op contrast, fallback naar een leesbare variant
- Lijsten en body-tekst: `text-foreground` of `text-muted-foreground`

**Bestanden**: `src/pages/storefront/ShopProductDetail.tsx`, `src/pages/storefront/ShopPage.tsx`, `src/pages/storefront/ShopLegalPage.tsx`

---

## Technische Details

### Contrast Ratio Formule (WCAG 2.1)

```text
relativeLuminance(color) = 0.2126*R + 0.7152*G + 0.0722*B
  (met gamma-correctie: component <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4)

contrastRatio = (L1 + 0.05) / (L2 + 0.05)
  waar L1 = lichtste, L2 = donkerste
```

### Bestanden die worden aangemaakt of gewijzigd

| Bestand | Actie |
|---------|-------|
| `src/lib/color-utils.ts` | Nieuw: WCAG contrast utilities |
| `src/components/admin/storefront/ThemeCustomizer.tsx` | Contrastwaarschuwingen bij kleurvelden |
| `src/components/admin/storefront/ColorPaletteGenerator.tsx` | Contrast-aware palette generatie + indicators |
| `src/pages/storefront/ShopProductDetail.tsx` | Prose styling fix voor rich-text |
| `src/pages/storefront/ShopPage.tsx` | Prose styling fix |
| `src/pages/storefront/ShopLegalPage.tsx` | Prose styling fix |

### UI Voorbeeld Contrastwaarschuwing

```text
[#FF6B35] Accent    Prijzen & badges    [!] Ratio 2.1:1 - Onleesbaar op donkere achtergrond
[#1E3A5F] Primair   Knoppen & accenten  [v] Ratio 8.4:1 - AA OK
```

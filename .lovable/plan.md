
# Fix: Visual Editor Gespiegelde Tekst (Robuuste Oplossing)

## Probleem

De tekst in de Visual Editor wordt nog steeds gespiegeld weergegeven (bijv. "Van" wordt "naV") ondanks de eerder toegepaste `CSS.Translate` fix.

## Root Cause Analyse

Na onderzoek van dnd-kit GitHub issues (#817, #1411) is het probleem geidentificeerd:

| Oorzaak | Beschrijving |
|---------|--------------|
| Variable item heights | Hero secties zijn ~60vh, terwijl andere secties veel kleiner zijn |
| Transform object pollution | De `transform` object van `useSortable` kan nog steeds scale waarden bevatten |
| CSS.Translate limitatie | `CSS.Translate.toString()` leest alleen `x` en `y`, maar het probleem ontstaat elders in de render |

De echte oorzaak is dat `dnd-kit` met `verticalListSortingStrategy` soms de items probeert te schalen om ze te laten "passen", wat leidt tot negatieve `scaleX` waarden.

---

## Oplossing: Handmatige Transform String

In plaats van `CSS.Translate.toString()` te gebruiken, bouwen we de transform string handmatig met alleen de `y` waarde (aangezien het een verticale lijst is):

```typescript
// In EditableSection.tsx
const style = {
  // Alleen verticale beweging toepassen, geen horizontale of scale transforms
  transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
  transition,
};
```

Dit forceert:
- Geen horizontale beweging (`x = 0`)
- Geen scale transforms (`scaleX`, `scaleY` genegeerd)
- GPU-accelerated rendering via `translate3d`

---

## Technische Wijziging

**Bestand:** `src/components/admin/storefront/visual-editor/EditableSection.tsx`

**Huidige code (regel 44-47):**
```typescript
const style = {
  transform: CSS.Translate.toString(transform),
  transition,
};
```

**Nieuwe code:**
```typescript
const style = {
  // Handmatig transform string bouwen om mirroring te voorkomen
  // Alleen Y-as translatie voor verticale drag & drop
  transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
  transition,
};
```

---

## Waarom Dit Werkt

1. **Expliciet geen scaleX/scaleY** - Door handmatig de transform te bouwen, worden scale transforms volledig genegeerd
2. **Alleen Y-as** - Voor verticale lijsten is horizontale beweging niet nodig
3. **translate3d** - Activeert GPU acceleratie voor smoother animaties
4. **Null-safe** - Als `transform` undefined is, wordt geen transform toegepast

---

## Alternatieve Aanpak (Backup)

Als bovenstaande fix niet werkt, kunnen we ook de CSS `transform-style` property gebruiken om nested transforms te isoleren:

```css
.editable-section {
  transform-style: flat;
  backface-visibility: hidden;
}
```

Dit voorkomt dat parent transforms worden geerfd door child elementen.

---

## Test Scenario's

Na implementatie testen:
1. Tekst in Hero sectie moet correct renderen ("Van" niet "naV")
2. Drag & drop moet nog steeds werken
3. Secties verplaatsen moet visueel correct animeren
4. Geen flikkering bij het slepen

---

## Samenvatting

De fix vervangt de dnd-kit CSS utility functie met een handmatige transform string die expliciet alleen verticale translatie toepast. Dit voorkomt alle mogelijke scale transforms die de tekst kunnen spiegelen.

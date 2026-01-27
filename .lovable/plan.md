
# Fix: Visual Editor Spiegelbeeld Tekst

## Probleem

De tekst in de Visual Editor wordt gespiegeld weergegeven (bijv. "VanShop" wordt "pohSnaV"). Dit gebeurt in alle editable sections.

## Oorzaak

Het probleem zit in `EditableSection.tsx` regel 45:

```typescript
const style = {
  transform: CSS.Transform.toString(transform),  // <- Dit is de boosdoener
  transition,
};
```

De `CSS.Transform.toString()` functie van `@dnd-kit/utilities` berekent niet alleen de positie (`translate`), maar ook een **schaal (`scale`)** om items visueel te laten passen bij het wisselen. Bij secties met variabele hoogtes (zoals een Hero sectie vs. een Newsletter sectie) kan dit resulteren in negatieve schaalwaarden, wat de tekst spiegelt.

## Oplossing

Vervang `CSS.Transform.toString` door `CSS.Translate.toString`:

| Huidig | Nieuw |
|--------|-------|
| `CSS.Transform.toString(transform)` | `CSS.Translate.toString(transform)` |

Dit negeert de schaal-component en past alleen de X/Y verplaatsing toe tijdens drag & drop.

---

## Technische Wijziging

**Bestand:** `src/components/admin/storefront/visual-editor/EditableSection.tsx`

**Regel 4:** Import aanpassen
```typescript
// Van:
import { CSS } from '@dnd-kit/utilities';

// Naar (geen wijziging nodig, CSS bevat beide):
import { CSS } from '@dnd-kit/utilities';
```

**Regel 44-47:** Style object aanpassen
```typescript
// Van:
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};

// Naar:
const style = {
  transform: CSS.Translate.toString(transform),
  transition,
};
```

---

## Resultaat

Na deze fix:
- Tekst wordt correct weergegeven (niet meer gespiegeld)
- Drag & drop blijft volledig functioneel
- Geen visuele vervorming meer bij het slepen van secties met verschillende hoogtes

---

## Samenvatting

Dit is een bekende issue in `@dnd-kit` bij sorteerbare lijsten met items van variabele grootte. De `CSS.Translate` functie is de aanbevolen oplossing uit de officiële documentatie en GitHub issues.

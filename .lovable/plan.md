

## Fix: Actiebalk staat inline i.p.v. fixed onderaan

### Probleem
Bij de vorige wijziging werd `relative` toegevoegd aan de container div zodat de absolute X-knop correct gepositioneerd wordt. Maar `relative` overschrijft `fixed` in Tailwind, waardoor de balk niet meer fixed onderaan het scherm staat maar inline in de pagina wordt gerenderd.

### Oorzaak
Regel 59 in `CategoryBulkActions.tsx` (en identiek in `OrderBulkActions.tsx` regel 237 en `FulfillmentBulkActions.tsx` regel 211):
```
className="fixed ... relative"
```
`relative` wint van `fixed` → balk is niet meer floating.

### Fix
Verwijder `relative` uit de className van alle 3 bestanden. De absolute X-knop werkt prima binnen een `fixed` container — `fixed` creëert ook een containing block voor absolute children.

| Bestand | Actie |
|---------|-------|
| `CategoryBulkActions.tsx` regel 59 | Verwijder `relative` uit className |
| `OrderBulkActions.tsx` regel 237 | Verwijder `relative` uit className |
| `FulfillmentBulkActions.tsx` regel 211 | Verwijder `relative` uit className |

Eén woord verwijderen per bestand, klaar.


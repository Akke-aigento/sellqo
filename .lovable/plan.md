

## Fix: CartDrawer layout overflow

### Problemen (zichtbaar in screenshot)

1. **Regeltotaal valt buiten het vak**: De prijs rechts ("€ 178,0") wordt afgeknipt en overlapt bijna de rand van de drawer.
2. **Footer loopt over**: "Subtotaal" en "€ 267,00" zitten tegen elkaar geplakt, en de knoppen "Afrekenen" en "Verder winkelen" vallen deels buiten beeld.

### Oorzaak

- De cart-item rij is een `flex` container met 3 delen: afbeelding (vast), info (flex-1), en regeltotaal (geen breedte-beperking). Lange productnamen en prijzen duwen het totaal buiten de container.
- De `SheetFooter` heeft `flex-col` maar de standaard Sheet-styling voegt extra flexbox-gedrag toe dat de layout breekt.

### Oplossing

**Bestand: `src/components/storefront/CartDrawer.tsx`**

1. **Item-rij layout fixen**:
   - Voeg `overflow-hidden` toe aan de item-container
   - Verplaats de regeltotaal-prijs naar binnen de info-kolom (onder de stukprijs), zodat er geen derde kolom meer nodig is die kan overlopen
   - Alternatief: geef de totaalprijs een `min-w-[70px] text-right` zodat het netjes uitlijnt

2. **Footer fixen**:
   - Voeg `sm:flex-col` en `!flex-col` toe om Radix Sheet default styling te overschrijven
   - Zorg dat subtotaal-rij, afrekenen-knop en verder-winkelen-knop elk op een eigen regel staan met correcte padding

### Technische details

```text
CartDrawer.tsx wijzigingen:

Regel 43 (item container):
- Was: className="py-4 flex gap-4"
- Wordt: className="py-4 flex gap-3 overflow-hidden"

Regel 75 (regeltotaal):
- Was: className="font-semibold text-sm flex-shrink-0"
- Wordt: className="font-semibold text-sm flex-shrink-0 min-w-[70px] text-right whitespace-nowrap"

Regel 83 (footer):
- Was: className="flex-col gap-3 px-6 py-4 border-t"
- Wordt: className="!flex-col gap-3 px-6 py-4 border-t sm:flex-col"
```

### Resultaat
- Prijzen blijven netjes binnen hun kolom
- Footer-elementen staan elk op een eigen regel zonder overlap
- Layout werkt correct op alle schermbreedtes


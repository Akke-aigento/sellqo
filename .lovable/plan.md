

## Fix: Productpagina layout wordt afgesneden op kleinere schermen

### Probleem
De productpagina gebruikt `lg:grid-cols-[1fr_400px]` (breekt bij 1024px viewport). Maar de admin-sidebar neemt ~280px in, waardoor de effectieve content-breedte ~750px is bij een 1024px scherm. De rechterkolom van 400px past dan niet meer en wordt afgesneden.

### Oplossing

**`src/pages/admin/ProductForm.tsx`**

1. Verander het breakpoint van `lg` naar `xl` (1280px) zodat de 2-kolom layout pas actief wordt wanneer er genoeg ruimte is
2. Verklein de rechterkolom van `400px` naar `350px` voor betere fit
3. Voeg `min-w-0` toe aan beide kolommen om overflow te voorkomen

```
// Huidig (regel 618):
grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6

// Nieuw:
grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6
```

Dit zorgt ervoor dat:
- Op schermen < 1280px de kolommen netjes onder elkaar stapelen
- Op bredere schermen de 2-kolom layout werkt zonder afsnijding
- De afbeeldingen-sidebar altijd volledig zichtbaar is

### Bestanden
| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/ProductForm.tsx` | Grid breakpoint `lg` → `xl`, kolombreedte `400px` → `350px`, `min-w-0` op kolommen |

